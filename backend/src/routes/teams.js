const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { validateRequest } = require('../middleware/validateRequest');
const { body, param, query } = require('express-validator');
const { query: db, transaction, buildPaginationClause } = require('../config/database');
const logger = require('../utils/logger');

// Get all teams
router.get('/', 
  authenticate,
  [
    query('search').optional().isString().trim(),
    query('active').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { search, active, limit = 50, offset = 0 } = req.query;
      
      let whereConditions = [];
      let queryParams = [];
      let paramCounter = 1;

      if (search) {
        whereConditions.push(`(t.name ILIKE $${paramCounter} OR t.description ILIKE $${paramCounter})`);
        queryParams.push(`%${search}%`);
        paramCounter++;
      }

      if (active !== undefined) {
        whereConditions.push(`t.active = $${paramCounter}`);
        queryParams.push(active);
        paramCounter++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get teams with member count
      const teamsQuery = `
        SELECT 
          t.*,
          COUNT(DISTINCT u.id) as member_count,
          m.name as manager_name,
          m.email as manager_email,
          (
            SELECT COUNT(DISTINCT c.id)
            FROM courses c
            JOIN course_assignments ca ON c.id = ca.course_id
            JOIN users u2 ON ca.user_id = u2.id
            WHERE u2.team_id = t.id
              AND c.status NOT IN ('completed', 'archived', 'cancelled')
          ) as active_projects
        FROM teams t
        LEFT JOIN users u ON u.team_id = t.id
        LEFT JOIN users m ON t.manager_id = m.id
        ${whereClause}
        GROUP BY t.id, m.name, m.email
        ORDER BY t.name ASC
        LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
      `;

      queryParams.push(limit, offset);

      const teamsResult = await db(teamsQuery, queryParams);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM teams t
        ${whereClause}
      `;
      const countResult = await db(countQuery, queryParams.slice(0, -2)); // Remove limit/offset params
      const total = parseInt(countResult.rows[0].total);

      res.json({
        success: true,
        data: {
          teams: teamsResult.rows.map(team => ({
            ...team,
            memberCount: parseInt(team.member_count),
            activeProjects: parseInt(team.active_projects),
            manager: team.manager_name ? {
              id: team.manager_id,
              name: team.manager_name,
              email: team.manager_email
            } : null
          })),
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + teamsResult.rows.length < total
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get team by ID
router.get('/:id',
  authenticate,
  [
    param('id').isInt()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const teamQuery = `
        SELECT 
          t.*,
          m.name as manager_name,
          m.email as manager_email
        FROM teams t
        LEFT JOIN users m ON t.manager_id = m.id
        WHERE t.id = $1
      `;

      const teamResult = await db(teamQuery, [req.params.id]);

      if (teamResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Team not found'
        });
      }

      const team = teamResult.rows[0];

      // Get team members
      const membersQuery = `
        SELECT 
          id, name, email, role, active, 
          daily_capacity_hours, last_login
        FROM users
        WHERE team_id = $1
        ORDER BY name ASC
      `;

      const membersResult = await db(membersQuery, [req.params.id]);

      res.json({
        success: true,
        data: {
          ...team,
          manager: team.manager_name ? {
            id: team.manager_id,
            name: team.manager_name,
            email: team.manager_email
          } : null,
          members: membersResult.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create new team
router.post('/',
  authenticate,
  authorize(['admin', 'manager']),
  [
    body('name').notEmpty().isString().trim(),
    body('description').optional().isString().trim(),
    body('managerId').optional().isInt(),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { name, description, managerId, active = true } = req.body;

      // Check if team name already exists
      const existingTeam = await db(
        'SELECT id FROM teams WHERE name = $1',
        [name]
      );

      if (existingTeam.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Team name already exists'
        });
      }

      const createQuery = `
        INSERT INTO teams (name, description, manager_id, active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await db(createQuery, [name, description, managerId, active]);
      const team = result.rows[0];

      logger.info('Team created', {
        teamId: team.id,
        name: team.name,
        createdBy: req.user.id
      });

      res.status(201).json({
        success: true,
        data: team
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update team
router.put('/:id',
  authenticate,
  authorize(['admin', 'manager']),
  [
    param('id').isInt(),
    body('name').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('managerId').optional().isInt(),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Check if team exists
      const teamCheck = await db('SELECT * FROM teams WHERE id = $1', [id]);
      if (teamCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Team not found'
        });
      }

      // Check if new name already exists
      if (updates.name && updates.name !== teamCheck.rows[0].name) {
        const nameCheck = await db(
          'SELECT id FROM teams WHERE name = $1 AND id != $2',
          [updates.name, id]
        );
        if (nameCheck.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Team name already exists'
          });
        }
      }

      // Build update query
      const updateFields = [];
      const updateValues = [];
      let paramCounter = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramCounter++}`);
        updateValues.push(updates.name);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramCounter++}`);
        updateValues.push(updates.description);
      }
      if (updates.managerId !== undefined) {
        updateFields.push(`manager_id = $${paramCounter++}`);
        updateValues.push(updates.managerId);
      }
      if (updates.active !== undefined) {
        updateFields.push(`active = $${paramCounter++}`);
        updateValues.push(updates.active);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid update fields provided'
        });
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(id);

      const updateQuery = `
        UPDATE teams
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCounter}
        RETURNING *
      `;

      const result = await db(updateQuery, updateValues);

      logger.info('Team updated', {
        teamId: id,
        updatedBy: req.user.id,
        changes: updates
      });

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add member to team
router.post('/:id/members',
  authenticate,
  authorize(['admin', 'manager']),
  [
    param('id').isInt(),
    body('userId').notEmpty().isInt()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      // Check if team exists
      const teamCheck = await db('SELECT id FROM teams WHERE id = $1', [id]);
      if (teamCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Team not found'
        });
      }

      // Check if user exists
      const userCheck = await db('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Update user's team
      await db(
        'UPDATE users SET team_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [id, userId]
      );

      logger.info('Team member added', {
        teamId: id,
        userId,
        addedBy: req.user.id
      });

      res.json({
        success: true,
        message: 'Member added successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Remove member from team
router.delete('/:id/members/:userId',
  authenticate,
  authorize(['admin', 'manager']),
  [
    param('id').isInt(),
    param('userId').isInt()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id, userId } = req.params;

      // Check if team exists
      const teamCheck = await db('SELECT id FROM teams WHERE id = $1', [id]);
      if (teamCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Team not found'
        });
      }

      // Remove user from team
      const result = await db(
        'UPDATE users SET team_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND team_id = $2 RETURNING id',
        [userId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found in this team'
        });
      }

      logger.info('Team member removed', {
        teamId: id,
        userId,
        removedBy: req.user.id
      });

      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get team performance metrics
router.get('/:id/performance',
  authenticate,
  [
    param('id').isInt(),
    query('period').optional().isIn(['7d', '30d', '90d', '6m', '1y']).default('30d')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { period } = req.query;

      // Check if team exists
      const teamCheck = await db('SELECT id FROM teams WHERE id = $1', [id]);
      if (teamCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Team not found'
        });
      }

      // Calculate period start date
      const periodMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '6m': 180,
        '1y': 365
      };
      const daysAgo = periodMap[period] || 30;

      const performanceQuery = `
        WITH team_members AS (
          SELECT id FROM users WHERE team_id = $1
        ),
        completed_assignments AS (
          SELECT 
            ca.id,
            ca.course_id,
            ca.user_id,
            ca.assigned_at,
            c.updated_at as completed_at
          FROM course_assignments ca
          JOIN courses c ON ca.course_id = c.id
          WHERE ca.user_id IN (SELECT id FROM team_members)
            AND c.status = 'completed'
            AND c.updated_at >= CURRENT_DATE - INTERVAL '${daysAgo} days'
        ),
        all_assignments AS (
          SELECT 
            ca.id,
            ca.course_id,
            ca.user_id
          FROM course_assignments ca
          WHERE ca.user_id IN (SELECT id FROM team_members)
            AND ca.assigned_at >= CURRENT_DATE - INTERVAL '${daysAgo} days'
        )
        SELECT 
          COUNT(DISTINCT comp.id) as completed_count,
          COUNT(DISTINCT all_a.id) as total_count,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (comp.completed_at - comp.assigned_at)) / 86400
          )::INTEGER, 0) as avg_delivery_days,
          (
            SELECT COUNT(DISTINCT c.id)
            FROM courses c
            JOIN course_assignments ca ON c.id = ca.course_id
            WHERE ca.user_id IN (SELECT id FROM team_members)
              AND c.status NOT IN ('completed', 'archived', 'cancelled')
          ) as active_projects
        FROM all_assignments all_a
        LEFT JOIN completed_assignments comp ON all_a.id = comp.id
      `;

      const result = await db(performanceQuery, [id]);
      const metrics = result.rows[0];

      const performance = {
        completionRate: metrics.total_count > 0 
          ? Math.round((metrics.completed_count / metrics.total_count) * 100) 
          : 0,
        avgDeliveryTime: parseInt(metrics.avg_delivery_days) || 0,
        activeProjects: parseInt(metrics.active_projects) || 0,
        completedProjects: parseInt(metrics.completed_count) || 0
      };

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;