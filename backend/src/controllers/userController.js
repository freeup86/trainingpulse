const Joi = require('joi');
const bcrypt = require('bcrypt');
const { query, transaction, getClient } = require('../config/database');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { get, set } = require('../config/redis');

// Validation schemas
const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).optional(),
  dailyCapacityHours: Joi.number().min(0).max(24).optional(),
  role: Joi.string().valid('admin', 'manager', 'designer', 'reviewer', 'viewer').optional(),
  teamId: Joi.number().integer().positive().allow(null).optional(),
  active: Joi.boolean().optional(),
  phone: Joi.string().max(20).allow('').optional(),
  location: Joi.string().max(100).allow('').optional(),
  bio: Joi.string().max(500).allow('').optional(),
  website: Joi.string().uri().allow('').optional(),
  linkedIn: Joi.string().max(200).allow('').optional(),
  timezone: Joi.string().max(50).optional(),
  notificationPreferences: Joi.object({
    email: Joi.boolean(),
    inApp: Joi.boolean(),
    digest: Joi.string().valid('immediate', 'hourly', 'daily', 'weekly'),
    urgentOnly: Joi.boolean(),
    categories: Joi.object()
  }).optional()
});

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('admin', 'manager', 'designer', 'reviewer', 'viewer').required(),
  teamId: Joi.number().integer().positive().allow(null).optional(),
  dailyCapacityHours: Joi.number().min(0).max(24).default(8)
});

const capacityUpdateSchema = Joi.object({
  dailyCapacityHours: Joi.number().min(0).max(24).required(),
  effectiveDate: Joi.date().optional()
});

class UserController {
  /**
   * GET /users - Get all users
   */
  getUsers = asyncHandler(async (req, res) => {
    const { 
      active = true, 
      teamId = null, 
      role = null,
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    let userQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.team_id,
        u.daily_capacity_hours,
        u.active,
        u.created_at,
        u.last_login,
        t.name as team_name,
        (SELECT COUNT(*) FROM course_assignments WHERE user_id = u.id) as assignment_count
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Apply filters
    if (active !== 'all') {
      userQuery += ` AND u.active = $${++paramCount}`;
      params.push(active === 'true' || active === true);
    }

    if (teamId) {
      userQuery += ` AND u.team_id = $${++paramCount}`;
      params.push(teamId);
    }

    if (role) {
      userQuery += ` AND u.role = $${++paramCount}`;
      params.push(role);
    }

    // Non-admins can only see users in their team
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      userQuery += ` AND u.team_id = $${++paramCount}`;
      params.push(req.user.team_id);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users u WHERE 1=1` + 
      userQuery.split('WHERE 1=1')[1].split('ORDER BY')[0],
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    userQuery += ` ORDER BY u.name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), offset);

    const usersResult = await query(userQuery, params);

    res.json({
      success: true,
      data: {
        users: usersResult.rows.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          teamId: user.team_id,
          teamName: user.team_name,
          dailyCapacityHours: user.daily_capacity_hours,
          active: user.active,
          assignmentCount: parseInt(user.assignment_count),
          lastLogin: user.last_login,
          createdAt: user.created_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  });

  /**
   * GET /users/current - Get current user profile
   */
  getCurrentUser = asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }
    
    const userId = req.user.id;

    // Try cache first
    const cacheKey = `user:${userId}:profile`;
    const cached = await get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached
      });
    }

    const userResult = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.team_id,
        u.daily_capacity_hours,
        u.notification_preferences,
        u.phone,
        u.location,
        u.bio,
        u.website,
        u.linkedin,
        u.timezone,
        u.created_at,
        u.last_login,
        t.name as team_name,
        t.manager_id as team_manager_id,
        tm.name as team_manager_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      LEFT JOIN users tm ON t.manager_id = tm.id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw new ValidationError('User not found');
    }

    const user = userResult.rows[0];

    // Get user statistics
    const statsResult = await query(`
      SELECT 
        COUNT(DISTINCT ca.course_id) as total_assignments,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_courses,
        COUNT(DISTINCT CASE WHEN c.status IN ('in_progress', 'review') THEN c.id END) as active_courses,
        COUNT(DISTINCT CASE WHEN c.due_date < CURRENT_DATE AND c.status NOT IN ('completed', 'cancelled') THEN c.id END) as overdue_courses,
        AVG(CASE 
          WHEN c.status = 'completed' AND c.completed_at IS NOT NULL AND ca.assigned_at IS NOT NULL
          THEN EXTRACT(days FROM (c.completed_at - ca.assigned_at))
        END) as avg_completion_days
      FROM course_assignments ca
      LEFT JOIN courses c ON ca.course_id = c.id
      WHERE ca.user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0];

    const profileData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.team_id,
      teamName: user.team_name,
      teamManagerId: user.team_manager_id,
      teamManagerName: user.team_manager_name,
      dailyCapacityHours: user.daily_capacity_hours,
      notificationPreferences: user.notification_preferences || {},
      phone: user.phone,
      location: user.location,
      bio: user.bio,
      website: user.website,
      linkedIn: user.linkedin,
      timezone: user.timezone,
      statistics: {
        totalAssignments: parseInt(stats.total_assignments),
        completedCourses: parseInt(stats.completed_courses),
        activeCourses: parseInt(stats.active_courses),
        overdueCourses: parseInt(stats.overdue_courses),
        avgCompletionDays: stats.avg_completion_days ? Math.round(parseFloat(stats.avg_completion_days)) : null
      },
      lastLogin: user.last_login,
      createdAt: user.created_at
    };

    // Cache for 5 minutes
    await set(cacheKey, profileData, 300);

    res.json({
      success: true,
      data: profileData
    });
  });

  /**
   * GET /users/:id - Get user by ID
   */
  getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== parseInt(id)) {
      // Non-managers can only view users in their team
      const teamCheckResult = await query(
        'SELECT team_id FROM users WHERE id = $1',
        [id]
      );

      if (teamCheckResult.rows.length === 0 || teamCheckResult.rows[0].team_id !== req.user.team_id) {
        throw new AuthorizationError('You can only view users in your team');
      }
    }

    const userResult = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.team_id,
        u.daily_capacity_hours,
        u.active,
        u.created_at,
        u.updated_at,
        u.last_login,
        t.name as team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.id = $1
    `, [id]);

    if (userResult.rows.length === 0) {
      throw new ValidationError('User not found');
    }

    const user = userResult.rows[0];

    // Get recent assignments
    const assignmentsResult = await query(`
      SELECT 
        c.id,
        c.title,
        c.status,
        c.priority,
        c.due_date,
        ca.role as assignment_role,
        ca.assigned_at
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      WHERE ca.user_id = $1
      ORDER BY ca.assigned_at DESC
      LIMIT 10
    `, [id]);

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.team_id,
        teamName: user.team_name,
        dailyCapacityHours: user.daily_capacity_hours,
        active: user.active,
        recentAssignments: assignmentsResult.rows.map(assignment => ({
          courseId: assignment.id,
          title: assignment.title,
          status: assignment.status,
          priority: assignment.priority,
          dueDate: assignment.due_date,
          assignmentRole: assignment.assignment_role,
          assignedAt: assignment.assigned_at
        })),
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  });

  /**
   * POST /users - Create new user
   */
  createUser = asyncHandler(async (req, res) => {
    // Only admins can create users
    if (req.user.role !== 'admin') {
      throw new AuthorizationError('Only administrators can create users');
    }

    // Validate input
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid user data', error.details);
    }

    const { name, email, password, role, teamId, dailyCapacityHours } = value;

    const user = await transaction(async (client) => {
      // Check if email already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new ValidationError('Email already in use');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userResult = await client.query(`
        INSERT INTO users (
          name, email, password, role, team_id, 
          daily_capacity_hours, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, name, email, role, team_id, daily_capacity_hours, created_at
      `, [name, email, hashedPassword, role, teamId, dailyCapacityHours]);

      return userResult.rows[0];
    });

    logger.info('User created', {
      userId: user.id,
      email: user.email,
      role: user.role,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.team_id,
        dailyCapacityHours: user.daily_capacity_hours,
        createdAt: user.created_at
      },
      message: 'User created successfully'
    });
  });

  /**
   * PUT /users/:id - Update user
   */
  updateUser = asyncHandler(async (req, res) => {
    // For /users/current route, use the authenticated user's ID
    const id = req.params.id || req.user.id;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      throw new AuthorizationError('You can only update your own profile');
    }

    // Validate input
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid update data', error.details);
    }

    // Non-admins cannot change their own role or team
    if (req.user.role !== 'admin') {
      delete value.role;
      delete value.teamId;
      delete value.active;
    }

    const updatedUser = await transaction(async (client) => {
      // Check if email is being changed and is unique
      if (value.email) {
        const emailCheck = await client.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [value.email, id]
        );
        if (emailCheck.rows.length > 0) {
          throw new ValidationError('Email already in use');
        }
      }

      // Build update query
      const updates = [];
      const params = [];
      let paramCount = 0;

      for (const [key, val] of Object.entries(value)) {
        if (key === 'password') {
          updates.push(`password = $${++paramCount}`);
          params.push(await bcrypt.hash(val, 10));
        } else if (key === 'dailyCapacityHours') {
          updates.push(`daily_capacity_hours = $${++paramCount}`);
          params.push(val);
        } else if (key === 'teamId') {
          updates.push(`team_id = $${++paramCount}`);
          params.push(val);
        } else if (key === 'notificationPreferences') {
          updates.push(`notification_preferences = $${++paramCount}`);
          params.push(JSON.stringify(val));
        } else if (key === 'linkedIn') {
          updates.push(`linkedin = $${++paramCount}`);
          params.push(val);
        } else {
          updates.push(`${key} = $${++paramCount}`);
          params.push(val);
        }
      }

      if (updates.length === 0) {
        throw new ValidationError('No valid updates provided');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const updateQuery = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${++paramCount}
        RETURNING id, name, email, role, team_id, daily_capacity_hours, active, updated_at
      `;

      const result = await client.query(updateQuery, params);

      if (result.rows.length === 0) {
        throw new ValidationError('User not found');
      }

      return result.rows[0];
    });

    // Clear user cache
    await set(`user:${id}:profile`, null, 0);

    logger.info('User updated', {
      userId: id,
      updates: Object.keys(value),
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        teamId: updatedUser.team_id,
        dailyCapacityHours: updatedUser.daily_capacity_hours,
        active: updatedUser.active,
        updatedAt: updatedUser.updated_at
      },
      message: 'User updated successfully'
    });
  });

  /**
   * DELETE /users/:id - Deactivate user
   */
  deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Only admins can deactivate users
    if (req.user.role !== 'admin') {
      throw new AuthorizationError('Only administrators can deactivate users');
    }

    // Don't allow deactivating self
    if (req.user.id === parseInt(id)) {
      throw new ValidationError('You cannot deactivate your own account');
    }

    const result = await query(`
      UPDATE users 
      SET active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND active = true
      RETURNING id, name, email
    `, [id]);

    if (result.rows.length === 0) {
      throw new ValidationError('User not found or already deactivated');
    }

    // Clear user cache
    await set(`user:${id}:profile`, null, 0);

    logger.info('User deactivated', {
      userId: id,
      deactivatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email
      },
      message: 'User deactivated successfully'
    });
  });

  /**
   * PUT /users/:id/capacity - Update user capacity
   */
  updateCapacity = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (req.user.id !== parseInt(id)) {
        throw new AuthorizationError('You can only update your own capacity');
      }
    }

    // Validate input
    const { error, value } = capacityUpdateSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid capacity data', error.details);
    }

    const { dailyCapacityHours, effectiveDate } = value;

    const result = await query(`
      UPDATE users 
      SET daily_capacity_hours = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, daily_capacity_hours
    `, [dailyCapacityHours, id]);

    if (result.rows.length === 0) {
      throw new ValidationError('User not found');
    }

    // Clear user cache
    await set(`user:${id}:profile`, null, 0);

    logger.info('User capacity updated', {
      userId: id,
      newCapacity: dailyCapacityHours,
      effectiveDate,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        dailyCapacityHours: result.rows[0].daily_capacity_hours
      },
      message: 'Capacity updated successfully'
    });
  });

  /**
   * GET /users/:id/workload - Get user workload summary
   */
  getUserWorkload = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== parseInt(id)) {
      throw new AuthorizationError('You can only view your own workload');
    }

    // Default to current week if no dates provided
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    
    if (!startDate) {
      start.setDate(start.getDate() - start.getDay()); // Start of week
    }
    if (!endDate) {
      end.setDate(start.getDate() + 6); // End of week
    }

    // Get user capacity
    const userResult = await query(
      'SELECT daily_capacity_hours, name FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      throw new ValidationError('User not found');
    }

    const user = userResult.rows[0];

    // Get workload data
    const workloadResult = await query(`
      SELECT 
        c.id,
        c.title,
        c.status,
        c.priority,
        c.start_date,
        c.due_date,
        c.estimated_hours,
        c.estimated_daily_hours,
        ca.role as assignment_role
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      WHERE ca.user_id = $1
        AND c.status NOT IN ('completed', 'cancelled', 'deleted')
        AND c.start_date <= $3
        AND c.due_date >= $2
      ORDER BY c.due_date, c.priority DESC
    `, [id, start, end]);

    // Calculate daily workload
    const dailyWorkload = {};
    const current = new Date(start);
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      dailyWorkload[dateStr] = {
        date: dateStr,
        allocatedHours: 0,
        courses: []
      };
      current.setDate(current.getDate() + 1);
    }

    // Distribute course hours across days
    workloadResult.rows.forEach(course => {
      const courseStart = new Date(Math.max(new Date(course.start_date), start));
      const courseEnd = new Date(Math.min(new Date(course.due_date), end));
      const dailyHours = course.estimated_daily_hours || 
        (course.estimated_hours / Math.max(1, Math.ceil((courseEnd - courseStart) / (1000 * 60 * 60 * 24))));

      const current = new Date(courseStart);
      while (current <= courseEnd) {
        const dateStr = current.toISOString().split('T')[0];
        if (dailyWorkload[dateStr]) {
          dailyWorkload[dateStr].allocatedHours += dailyHours;
          dailyWorkload[dateStr].courses.push({
            id: course.id,
            title: course.title,
            priority: course.priority,
            hours: dailyHours,
            role: course.assignment_role
          });
        }
        current.setDate(current.getDate() + 1);
      }
    });

    // Calculate utilization
    const workloadArray = Object.values(dailyWorkload).map(day => ({
      ...day,
      utilization: user.daily_capacity_hours > 0 
        ? (day.allocatedHours / user.daily_capacity_hours) * 100 
        : 0,
      available: day.allocatedHours < user.daily_capacity_hours * 0.85
    }));

    res.json({
      success: true,
      data: {
        userId: parseInt(id),
        userName: user.name,
        dailyCapacityHours: user.daily_capacity_hours,
        dateRange: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        },
        workload: workloadArray,
        summary: {
          totalAllocatedHours: workloadArray.reduce((sum, day) => sum + day.allocatedHours, 0),
          avgUtilization: workloadArray.reduce((sum, day) => sum + day.utilization, 0) / workloadArray.length,
          overloadedDays: workloadArray.filter(day => day.utilization >= 100).length,
          availableDays: workloadArray.filter(day => day.available).length
        }
      }
    });
  });

  /**
   * GET /users/:id/profile - Get user profile
   */
  getUserProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Users can only view their own profile unless admin
    if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
      throw new AuthorizationError('Cannot view this profile');
    }

    const client = await getClient();

    try {
      const result = await client.query(`
        SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.active,
          u.daily_capacity_hours,
          u.timezone,
          u.last_login,
          u.created_at,
          u.updated_at,
          t.name as team,
          t.id as team_id
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const user = result.rows[0];

      res.json({
        success: true,
        data: user
      });
    } finally {
      client.release();
    }
  });

  /**
   * PUT /users/:id/profile - Update user profile
   */
  updateUserProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Users can only update their own profile unless admin
    if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
      throw new AuthorizationError('Cannot update this profile');
    }

    const { error } = updateUserSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid update data', error.details);
    }

    const allowedFields = ['name', 'email', 'phone', 'location', 'bio', 'website', 'linkedIn', 'timezone'];
    const updates = Object.keys(req.body)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid update fields provided');
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check if email is already taken
      if (updates.email) {
        const emailCheck = await client.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [updates.email, id]
        );
        if (emailCheck.rows.length > 0) {
          throw new ValidationError('Email already in use');
        }
      }

      // Build update query
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      const values = [id, ...Object.values(updates)];

      const result = await client.query(
        `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING id, name, email`,
        values
      );

      await client.query('COMMIT');

      logger.info('User profile updated', {
        userId: id,
        updatedBy: req.user.id,
        fields: Object.keys(updates)
      });

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Profile updated successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  /**
   * GET /users/:id/stats - Get user statistics
   */
  getUserStats = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const client = await getClient();

    try {
      const statsQuery = `
        WITH user_courses AS (
          SELECT 
            c.id,
            c.status,
            c.created_at,
            c.updated_at,
            ca.role as user_role
          FROM courses c
          JOIN course_assignments ca ON c.id = ca.course_id
          WHERE ca.user_id = $1 AND c.status != 'deleted'
        )
        SELECT 
          COUNT(*) FILTER (WHERE status = 'completed') as completed_courses,
          COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled', 'archived')) as active_courses,
          CASE 
            WHEN COUNT(*) > 0 THEN 
              ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*) * 100)
            ELSE 0
          END as completion_rate,
          COUNT(*) FILTER (WHERE user_role = 'reviewer') as reviews_given
        FROM user_courses
      `;

      const result = await client.query(statsQuery, [id]);

      res.json({
        success: true,
        data: {
          completedCourses: parseInt(result.rows[0].completed_courses) || 0,
          activeCourses: parseInt(result.rows[0].active_courses) || 0,
          completionRate: parseInt(result.rows[0].completion_rate) || 0,
          reviewsGiven: parseInt(result.rows[0].reviews_given) || 0
        }
      });
    } finally {
      client.release();
    }
  });

  /**
   * GET /users/:id/activity - Get user activity
   */
  getUserActivity = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const client = await getClient();

    try {
      // For now, return mock activity data
      // In a real implementation, this would query an activity log table
      const activities = [
        {
          id: 1,
          type: 'course_updated',
          description: 'Updated JavaScript Fundamentals course',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          type: 'review_submitted',
          description: 'Submitted review for React Advanced Concepts',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 3,
          type: 'assignment_completed',
          description: 'Completed Python Basics assignment',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      res.json({
        success: true,
        data: {
          activities
        }
      });
    } finally {
      client.release();
    }
  });

  /**
   * GET /users/:id/courses - Get user's assigned courses
   */
  getUserCourses = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;
    const client = await getClient();

    try {
      let whereClause = '';
      const values = [id];
      
      if (status) {
        whereClause = ' AND c.status = $2';
        values.push(status);
      }

      const coursesQuery = `
        SELECT 
          c.id,
          c.title,
          c.description,
          c.type,
          c.priority,
          c.status,
          c.calculated_status,
          c.start_date,
          c.due_date,
          c.completion_percentage,
          ca.role as assignment_role,
          ca.assigned_at,
          wi.current_state as workflow_state
        FROM courses c
        JOIN course_assignments ca ON c.id = ca.course_id
        LEFT JOIN workflow_instances wi ON c.id = wi.course_id AND wi.is_complete = false
        WHERE ca.user_id = $1 AND c.status != 'deleted' ${whereClause}
        ORDER BY c.due_date ASC NULLS LAST, c.priority DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await client.query(coursesQuery, values);

      res.json({
        success: true,
        data: {
          courses: result.rows.map(course => ({
            ...course,
            workflowState: course.workflow_state || course.status
          }))
        }
      });
    } finally {
      client.release();
    }
  });

  /**
   * GET /users/:id/subtask-assignments - Get user's subtask assignments
   */
  getUserSubtaskAssignments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    try {
      let whereClause = '';
      const values = [id];
      let paramCount = 1;
      
      if (status) {
        paramCount++;
        whereClause = ` AND cs.status = $${paramCount}`;
        values.push(status);
      }

      const assignmentsQuery = `
        SELECT 
          cs.id as subtask_id,
          cs.title as phase_title,
          cs.status as phase_status,
          cs.order_index,
          cs.start_date,
          cs.finish_date,
          c.id as course_id,
          c.title as course_title,
          c.description as course_description,
          c.priority as course_priority,
          c.due_date as course_due_date,
          sa.assigned_at,
          sa.assigned_by,
          assigner.name as assigned_by_name,
          psh.started_at as status_started_at,
          psh.finished_at as status_finished_at
        FROM subtask_assignments sa
        JOIN course_subtasks cs ON sa.subtask_id = cs.id
        JOIN courses c ON cs.course_id = c.id
        LEFT JOIN users assigner ON sa.assigned_by = assigner.id
        LEFT JOIN phase_status_history psh ON cs.id = psh.subtask_id AND psh.status = cs.status AND psh.finished_at IS NULL
        WHERE sa.user_id = $1 AND c.status != 'deleted' ${whereClause}
        ORDER BY c.priority DESC, c.due_date ASC NULLS LAST, cs.order_index ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await query(assignmentsQuery, values);

      res.json({
        success: true,
        data: {
          assignments: result.rows.map(assignment => ({
            subtask: {
              id: assignment.subtask_id,
              title: assignment.phase_title,
              status: assignment.phase_status,
              orderIndex: assignment.order_index,
              startDate: assignment.start_date,
              finishDate: assignment.finish_date,
              statusStartedAt: assignment.status_started_at,
              statusFinishedAt: assignment.status_finished_at
            },
            course: {
              id: assignment.course_id,
              title: assignment.course_title,
              description: assignment.course_description,
              priority: assignment.course_priority,
              dueDate: assignment.course_due_date
            },
            assignment: {
              assignedAt: assignment.assigned_at,
              assignedBy: assignment.assigned_by ? {
                id: assignment.assigned_by,
                name: assignment.assigned_by_name
              } : null
            }
          }))
        }
      });

    } catch (error) {
      logger.logError(error, {
        context: 'UserController.getUserSubtaskAssignments',
        userId: id
      });
      throw error;
    }
  });
}

module.exports = new UserController();