const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { get, set } = require('../config/redis');

// Validation schemas
const createTeamSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  managerId: Joi.number().integer().positive().required()
});

const updateTeamSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  managerId: Joi.number().integer().positive().optional(),
  active: Joi.boolean().optional()
});

const addMemberSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
  role: Joi.string().valid('designer', 'reviewer', 'viewer').required()
});

class TeamController {
  /**
   * GET /teams - Get all teams
   */
  getTeams = asyncHandler(async (req, res) => {
    const { active = true, includeMembers = false } = req.query;

    // Build query based on user role
    let teamsQuery = `
      SELECT 
        t.id,
        t.name,
        t.description,
        t.manager_id,
        t.active,
        t.created_at,
        t.updated_at,
        u.name as manager_name,
        u.email as manager_email,
        (SELECT COUNT(*) FROM users WHERE team_id = t.id AND active = true) as member_count
      FROM teams t
      LEFT JOIN users u ON t.manager_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Filter by active status
    if (active !== 'all') {
      teamsQuery += ` AND t.active = $${++paramCount}`;
      params.push(active === 'true' || active === true);
    }

    // Non-admins can only see their own team
    if (req.user.role !== 'admin') {
      teamsQuery += ` AND t.id = $${++paramCount}`;
      params.push(req.user.team_id);
    }

    teamsQuery += ` ORDER BY t.name`;

    const teamsResult = await query(teamsQuery, params);
    const teams = teamsResult.rows;

    // Include team members if requested
    if (includeMembers) {
      for (const team of teams) {
        const membersResult = await query(`
          SELECT 
            u.id,
            u.name,
            u.email,
            u.role,
            u.active,
            u.daily_capacity_hours
          FROM users u
          WHERE u.team_id = $1
          ORDER BY u.name
        `, [team.id]);
        
        team.members = membersResult.rows;
      }
    }

    res.json({
      success: true,
      data: teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        managerId: team.manager_id,
        managerName: team.manager_name,
        managerEmail: team.manager_email,
        memberCount: parseInt(team.member_count),
        active: team.active,
        members: team.members || undefined,
        createdAt: team.created_at,
        updatedAt: team.updated_at
      }))
    });
  });

  /**
   * GET /teams/:id - Get team by ID
   */
  getTeamById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.team_id !== parseInt(id)) {
      throw new AuthorizationError('You can only view your own team');
    }

    // Try cache first
    const cacheKey = `team:${id}`;
    const cached = await get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached
      });
    }

    const teamResult = await query(`
      SELECT 
        t.*,
        u.name as manager_name,
        u.email as manager_email
      FROM teams t
      LEFT JOIN users u ON t.manager_id = u.id
      WHERE t.id = $1
    `, [id]);

    if (teamResult.rows.length === 0) {
      throw new ValidationError('Team not found');
    }

    const team = teamResult.rows[0];

    // Get team members
    const membersResult = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.active,
        u.daily_capacity_hours,
        u.created_at,
        (SELECT COUNT(*) FROM course_assignments WHERE user_id = u.id) as assignment_count
      FROM users u
      WHERE u.team_id = $1
      ORDER BY u.role, u.name
    `, [id]);

    // Get team statistics
    const statsResult = await query(`
      SELECT 
        COUNT(DISTINCT c.id) as total_courses,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_courses,
        COUNT(DISTINCT CASE WHEN c.status IN ('in_progress', 'review') THEN c.id END) as active_courses,
        COUNT(DISTINCT CASE WHEN c.due_date < CURRENT_DATE AND c.status NOT IN ('completed', 'cancelled') THEN c.id END) as overdue_courses
      FROM courses c
      JOIN course_assignments ca ON c.id = ca.course_id
      JOIN users u ON ca.user_id = u.id
      WHERE u.team_id = $1
    `, [id]);

    const teamData = {
      id: team.id,
      name: team.name,
      description: team.description,
      managerId: team.manager_id,
      managerName: team.manager_name,
      managerEmail: team.manager_email,
      active: team.active,
      members: membersResult.rows.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        active: member.active,
        dailyCapacityHours: member.daily_capacity_hours,
        assignmentCount: parseInt(member.assignment_count),
        joinedAt: member.created_at
      })),
      statistics: {
        totalCourses: parseInt(statsResult.rows[0].total_courses),
        completedCourses: parseInt(statsResult.rows[0].completed_courses),
        activeCourses: parseInt(statsResult.rows[0].active_courses),
        overdueCourses: parseInt(statsResult.rows[0].overdue_courses)
      },
      createdAt: team.created_at,
      updatedAt: team.updated_at
    };

    // Cache for 5 minutes
    await set(cacheKey, teamData, 300);

    res.json({
      success: true,
      data: teamData
    });
  });

  /**
   * POST /teams - Create new team
   */
  createTeam = asyncHandler(async (req, res) => {
    // Only admins can create teams
    if (req.user.role !== 'admin') {
      throw new AuthorizationError('Only administrators can create teams');
    }

    // Validate input
    const { error, value } = createTeamSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid team data', error.details);
    }

    const { name, description, managerId } = value;

    const team = await transaction(async (client) => {
      // Verify manager exists and has appropriate role
      const managerResult = await client.query(
        'SELECT id, role FROM users WHERE id = $1 AND active = true',
        [managerId]
      );

      if (managerResult.rows.length === 0) {
        throw new ValidationError('Manager not found');
      }

      if (!['admin', 'manager'].includes(managerResult.rows[0].role)) {
        throw new ValidationError('Selected user must have admin or manager role');
      }

      // Create team
      const teamResult = await client.query(`
        INSERT INTO teams (name, description, manager_id, created_at, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [name, description, managerId]);

      const newTeam = teamResult.rows[0];

      // Update manager's team_id
      await client.query(
        'UPDATE users SET team_id = $1 WHERE id = $2',
        [newTeam.id, managerId]
      );

      return newTeam;
    });

    logger.info('Team created', {
      teamId: team.id,
      name: team.name,
      managerId: team.manager_id,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        managerId: team.manager_id,
        active: team.active,
        createdAt: team.created_at
      },
      message: 'Team created successfully'
    });
  });

  /**
   * PUT /teams/:id - Update team
   */
  updateTeam = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Only admins and team managers can update teams
    if (req.user.role !== 'admin') {
      const teamResult = await query(
        'SELECT manager_id FROM teams WHERE id = $1',
        [id]
      );
      
      if (teamResult.rows.length === 0) {
        throw new ValidationError('Team not found');
      }

      if (teamResult.rows[0].manager_id !== req.user.id) {
        throw new AuthorizationError('Only team managers can update their team');
      }
    }

    // Validate input
    const { error, value } = updateTeamSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid update data', error.details);
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    Object.entries(value).forEach(([key, val]) => {
      const columnName = key === 'managerId' ? 'manager_id' : key;
      updates.push(`${columnName} = $${++paramCount}`);
      params.push(val);
    });

    if (updates.length === 0) {
      throw new ValidationError('No valid updates provided');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const updateQuery = `
      UPDATE teams 
      SET ${updates.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, params);

    if (result.rows.length === 0) {
      throw new ValidationError('Team not found');
    }

    // Clear cache
    const cacheKey = `team:${id}`;
    await set(cacheKey, null, 0);

    logger.info('Team updated', {
      teamId: id,
      updates: Object.keys(value),
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        managerId: result.rows[0].manager_id,
        active: result.rows[0].active,
        updatedAt: result.rows[0].updated_at
      },
      message: 'Team updated successfully'
    });
  });

  /**
   * POST /teams/:id/members - Add member to team
   */
  addTeamMember = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check authorization
    if (req.user.role !== 'admin') {
      const teamResult = await query(
        'SELECT manager_id FROM teams WHERE id = $1',
        [id]
      );
      
      if (teamResult.rows.length === 0) {
        throw new ValidationError('Team not found');
      }

      if (teamResult.rows[0].manager_id !== req.user.id) {
        throw new AuthorizationError('Only team managers can add members');
      }
    }

    // Validate input
    const { error, value } = addMemberSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid member data', error.details);
    }

    const { userId, role } = value;

    const updatedUser = await transaction(async (client) => {
      // Check if user exists
      const userResult = await client.query(
        'SELECT id, team_id, name, email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new ValidationError('User not found');
      }

      const user = userResult.rows[0];
      
      if (user.team_id) {
        throw new ValidationError('User is already assigned to a team');
      }

      // Update user's team and role
      const updateResult = await client.query(`
        UPDATE users 
        SET team_id = $1, role = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [id, role, userId]);

      return updateResult.rows[0];
    });

    // Clear team cache
    const cacheKey = `team:${id}`;
    await set(cacheKey, null, 0);

    logger.info('Team member added', {
      teamId: id,
      userId,
      role,
      addedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        userId: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        teamId: updatedUser.team_id
      },
      message: 'Team member added successfully'
    });
  });

  /**
   * DELETE /teams/:id/members/:userId - Remove member from team
   */
  removeTeamMember = asyncHandler(async (req, res) => {
    const { id, userId } = req.params;

    // Check authorization
    if (req.user.role !== 'admin') {
      const teamResult = await query(
        'SELECT manager_id FROM teams WHERE id = $1',
        [id]
      );
      
      if (teamResult.rows.length === 0) {
        throw new ValidationError('Team not found');
      }

      if (teamResult.rows[0].manager_id !== req.user.id) {
        throw new AuthorizationError('Only team managers can remove members');
      }
    }

    // Don't allow removing team manager
    const managerCheck = await query(
      'SELECT manager_id FROM teams WHERE id = $1 AND manager_id = $2',
      [id, userId]
    );

    if (managerCheck.rows.length > 0) {
      throw new ValidationError('Cannot remove team manager from team');
    }

    // Remove user from team
    const result = await query(`
      UPDATE users 
      SET team_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND team_id = $2
      RETURNING id, name, email
    `, [userId, id]);

    if (result.rows.length === 0) {
      throw new ValidationError('User not found in this team');
    }

    // Clear team cache
    const cacheKey = `team:${id}`;
    await set(cacheKey, null, 0);

    logger.info('Team member removed', {
      teamId: id,
      userId,
      removedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        userId: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email
      },
      message: 'Team member removed successfully'
    });
  });

  /**
   * GET /teams/:id/performance - Get team performance metrics
   */
  getTeamPerformance = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.team_id !== parseInt(id)) {
      throw new AuthorizationError('You can only view your own team\'s performance');
    }

    // Parse period
    const intervalMap = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      '6m': '6 months',
      '1y': '1 year'
    };
    const interval = intervalMap[period] || '30 days';

    // Get team performance metrics
    const performanceResult = await query(`
      WITH team_courses AS (
        SELECT DISTINCT c.*
        FROM courses c
        JOIN course_assignments ca ON c.id = ca.course_id
        JOIN users u ON ca.user_id = u.id
        WHERE u.team_id = $1
          AND c.created_at > NOW() - INTERVAL '${interval}'
      )
      SELECT 
        COUNT(*) as total_courses,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_courses,
        COUNT(CASE WHEN status = 'completed' AND due_date >= completed_at THEN 1 END) as on_time_completions,
        COUNT(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue_courses,
        AVG(CASE 
          WHEN status = 'completed' AND completed_at IS NOT NULL AND start_date IS NOT NULL
          THEN EXTRACT(days FROM (completed_at - start_date))
        END) as avg_completion_days,
        AVG(CASE 
          WHEN status = 'completed' AND actual_hours IS NOT NULL 
          THEN actual_hours 
        END) as avg_actual_hours,
        AVG(CASE 
          WHEN estimated_hours IS NOT NULL 
          THEN estimated_hours 
        END) as avg_estimated_hours
      FROM team_courses
    `, [id]);

    // Get member performance
    const memberPerformanceResult = await query(`
      SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(DISTINCT ca.course_id) as assigned_courses,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_courses,
        COUNT(DISTINCT CASE WHEN c.status IN ('in_progress', 'review') THEN c.id END) as active_courses,
        AVG(CASE 
          WHEN c.status = 'completed' AND c.completed_at IS NOT NULL AND ca.assigned_at IS NOT NULL
          THEN EXTRACT(days FROM (c.completed_at - ca.assigned_at))
        END) as avg_completion_days
      FROM users u
      LEFT JOIN course_assignments ca ON u.id = ca.user_id
      LEFT JOIN courses c ON ca.course_id = c.id AND c.created_at > NOW() - INTERVAL '${interval}'
      WHERE u.team_id = $1 AND u.active = true
      GROUP BY u.id, u.name, u.role
      ORDER BY completed_courses DESC, u.name
    `, [id]);

    const metrics = performanceResult.rows[0];
    const completionRate = metrics.total_courses > 0 
      ? (parseInt(metrics.completed_courses) / parseInt(metrics.total_courses)) * 100 
      : 0;
    const onTimeRate = metrics.completed_courses > 0
      ? (parseInt(metrics.on_time_completions) / parseInt(metrics.completed_courses)) * 100
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalCourses: parseInt(metrics.total_courses),
          completedCourses: parseInt(metrics.completed_courses),
          onTimeCompletions: parseInt(metrics.on_time_completions),
          overdueCourses: parseInt(metrics.overdue_courses),
          completionRate: Math.round(completionRate * 100) / 100,
          onTimeRate: Math.round(onTimeRate * 100) / 100,
          avgCompletionDays: metrics.avg_completion_days ? Math.round(parseFloat(metrics.avg_completion_days)) : null,
          avgActualHours: metrics.avg_actual_hours ? Math.round(parseFloat(metrics.avg_actual_hours) * 10) / 10 : null,
          avgEstimatedHours: metrics.avg_estimated_hours ? Math.round(parseFloat(metrics.avg_estimated_hours) * 10) / 10 : null
        },
        memberPerformance: memberPerformanceResult.rows.map(member => ({
          id: member.id,
          name: member.name,
          role: member.role,
          assignedCourses: parseInt(member.assigned_courses),
          completedCourses: parseInt(member.completed_courses),
          activeCourses: parseInt(member.active_courses),
          avgCompletionDays: member.avg_completion_days ? Math.round(parseFloat(member.avg_completion_days)) : null
        })),
        period,
        generatedAt: new Date().toISOString()
      }
    });
  });
}

module.exports = new TeamController();