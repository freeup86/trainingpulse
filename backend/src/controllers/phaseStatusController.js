const { query, transaction } = require('../config/database');
const asyncHandler = require('../middleware/asyncHandler');
const { ValidationError, NotFoundError } = require('../utils/errors');
const Joi = require('joi');
const logger = require('../utils/logger');

// Validation schemas
const createPhaseStatusSchema = Joi.object({
  value: Joi.string().min(1).max(50).required().trim(),
  label: Joi.string().min(1).max(100).required().trim(),
  description: Joi.string().max(500).optional().allow(''),
  color: Joi.string().min(1).max(50).required().trim(),
  darkColor: Joi.string().max(50).optional().allow(''),
  icon: Joi.string().max(50).default('PlayCircle'),
  sortOrder: Joi.number().integer().min(1).default(1),
  isActive: Joi.boolean().default(true),
  isDefault: Joi.boolean().default(false),
  completionPercentage: Joi.number().integer().min(0).max(100).default(0)
});

const updatePhaseStatusSchema = Joi.object({
  value: Joi.string().min(1).max(50).optional().trim(),
  label: Joi.string().min(1).max(100).optional().trim(),
  description: Joi.string().max(500).optional().allow(''),
  color: Joi.string().min(1).max(50).optional().trim(),
  darkColor: Joi.string().max(50).optional().allow(''),
  icon: Joi.string().max(50).optional(),
  sortOrder: Joi.number().integer().min(1).optional(),
  isActive: Joi.boolean().optional(),
  isDefault: Joi.boolean().optional(),
  completionPercentage: Joi.number().integer().min(0).max(100).optional()
});

class PhaseStatusController {
  /**
   * GET /phase-statuses - Get all phase statuses
   */
  getAll = asyncHandler(async (req, res) => {
    const { includeInactive = 'false' } = req.query;
    
    let whereClause = '';
    if (includeInactive !== 'true') {
      whereClause = 'WHERE is_active = true';
    }

    const result = await query(`
      SELECT 
        id, value, label, description, color, dark_color as "darkColor",
        icon, sort_order as "sortOrder", is_active as "isActive", 
        is_default as "isDefault", completion_percentage as "completionPercentage",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM phase_statuses 
      ${whereClause}
      ORDER BY sort_order ASC, label ASC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  });

  /**
   * GET /phase-statuses/:id - Get single phase status
   */
  getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        id, value, label, description, color, dark_color as "darkColor",
        icon, sort_order as "sortOrder", is_active as "isActive", 
        is_default as "isDefault", completion_percentage as "completionPercentage",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM phase_statuses 
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Phase status with ID ${id} not found`);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  });

  /**
   * POST /phase-statuses - Create new phase status
   */
  create = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = createPhaseStatusSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid phase status data', error.details);
    }

    const {
      value: statusValue,
      label,
      description,
      color,
      darkColor,
      icon,
      sortOrder,
      isActive,
      isDefault,
      completionPercentage
    } = value;

    const result = await transaction(async (client) => {
      // Check if value already exists
      const existingResult = await client.query(
        'SELECT id FROM phase_statuses WHERE value = $1',
        [statusValue]
      );

      if (existingResult.rows.length > 0) {
        throw new ValidationError(`Phase status with value '${statusValue}' already exists`);
      }

      // If this is set as default, unset other defaults
      if (isDefault) {
        await client.query(
          'UPDATE phase_statuses SET is_default = false WHERE is_default = true'
        );
      }

      // Create new phase status
      const insertResult = await client.query(`
        INSERT INTO phase_statuses (
          value, label, description, color, dark_color, icon, 
          sort_order, is_active, is_default, completion_percentage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING 
          id, value, label, description, color, dark_color as "darkColor",
          icon, sort_order as "sortOrder", is_active as "isActive", 
          is_default as "isDefault", completion_percentage as "completionPercentage",
          created_at as "createdAt", updated_at as "updatedAt"
      `, [
        statusValue, label, description || null, color, darkColor || null, 
        icon, sortOrder, isActive, isDefault, completionPercentage
      ]);

      return insertResult.rows[0];
    });

    logger.info('Phase status created', {
      id: result.id,
      value: statusValue,
      label,
      userId: req.user.id
    });

    res.status(201).json({
      success: true,
      data: {
        phaseStatus: result,
        message: 'Phase status created successfully'
      }
    });
  });

  /**
   * PUT /phase-statuses/:id - Update phase status
   */
  update = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate input
    const { error, value } = updatePhaseStatusSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid phase status data', error.details);
    }

    const {
      value: statusValue,
      label,
      description,
      color,
      darkColor,
      icon,
      sortOrder,
      isActive,
      isDefault,
      completionPercentage
    } = value;

    const result = await transaction(async (client) => {
      // Check if phase status exists
      const existingResult = await client.query(
        'SELECT * FROM phase_statuses WHERE id = $1',
        [id]
      );

      if (existingResult.rows.length === 0) {
        throw new NotFoundError(`Phase status with ID ${id} not found`);
      }

      // Check if new value conflicts with existing (if value is being updated)
      if (statusValue && statusValue !== existingResult.rows[0].value) {
        const duplicateResult = await client.query(
          'SELECT id FROM phase_statuses WHERE value = $1 AND id != $2',
          [statusValue, id]
        );

        if (duplicateResult.rows.length > 0) {
          throw new ValidationError(`Phase status with value '${statusValue}' already exists`);
        }
      }

      // If this is being set as default, unset other defaults
      if (isDefault) {
        await client.query(
          'UPDATE phase_statuses SET is_default = false WHERE is_default = true AND id != $1',
          [id]
        );
      }

      // Build update query dynamically
      const updates = {};
      const fields = {
        value: statusValue,
        label,
        description,
        color,
        dark_color: darkColor,
        icon,
        sort_order: sortOrder,
        is_active: isActive,
        is_default: isDefault,
        completion_percentage: completionPercentage
      };

      Object.entries(fields).forEach(([key, val]) => {
        if (val !== undefined) {
          updates[key] = val;
        }
      });

      if (Object.keys(updates).length === 0) {
        return existingResult.rows[0];
      }

      const setClause = Object.keys(updates)
        .map((field, index) => `${field} = $${index + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(updates)];

      const updateResult = await client.query(`
        UPDATE phase_statuses 
        SET ${setClause}
        WHERE id = $1
        RETURNING 
          id, value, label, description, color, dark_color as "darkColor",
          icon, sort_order as "sortOrder", is_active as "isActive", 
          is_default as "isDefault", completion_percentage as "completionPercentage",
          created_at as "createdAt", updated_at as "updatedAt"
      `, values);

      return updateResult.rows[0];
    });

    logger.info('Phase status updated', {
      id,
      updates: Object.keys(value).filter(k => value[k] !== undefined),
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        phaseStatus: result,
        message: 'Phase status updated successfully'
      }
    });
  });

  /**
   * DELETE /phase-statuses/:id - Delete phase status
   */
  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await transaction(async (client) => {
      // Check if phase status exists
      const existingResult = await client.query(
        'SELECT * FROM phase_statuses WHERE id = $1',
        [id]
      );

      if (existingResult.rows.length === 0) {
        throw new NotFoundError(`Phase status with ID ${id} not found`);
      }

      const phaseStatus = existingResult.rows[0];

      // Check if this status is being used by any subtasks
      const usageResult = await client.query(
        'SELECT COUNT(*) as count FROM course_subtasks WHERE status = $1',
        [phaseStatus.value]
      );

      if (parseInt(usageResult.rows[0].count) > 0) {
        throw new ValidationError(
          `Cannot delete phase status '${phaseStatus.label}' because it is currently being used by ${usageResult.rows[0].count} phase(s)`
        );
      }

      // Delete the phase status
      await client.query('DELETE FROM phase_statuses WHERE id = $1', [id]);

      return phaseStatus;
    });

    logger.info('Phase status deleted', {
      id,
      value: result.value,
      label: result.label,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        message: 'Phase status deleted successfully'
      }
    });
  });

  /**
   * POST /phase-statuses/reorder - Reorder phase statuses
   */
  reorder = asyncHandler(async (req, res) => {
    const { statusIds } = req.body;

    if (!Array.isArray(statusIds) || statusIds.length === 0) {
      throw new ValidationError('statusIds must be a non-empty array');
    }

    await transaction(async (client) => {
      // Update sort order for each status
      for (let i = 0; i < statusIds.length; i++) {
        await client.query(
          'UPDATE phase_statuses SET sort_order = $1 WHERE id = $2',
          [i + 1, statusIds[i]]
        );
      }
    });

    logger.info('Phase statuses reordered', {
      statusIds,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        message: 'Phase statuses reordered successfully'
      }
    });
  });
}

module.exports = new PhaseStatusController();