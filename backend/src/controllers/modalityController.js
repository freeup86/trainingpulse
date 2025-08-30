const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Validation schemas
const createModalitySchema = Joi.object({
  value: Joi.string().min(1).max(50).required(),
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(255).allow('').optional(),
  sort_order: Joi.number().integer().min(0).default(0)
});

const updateModalitySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(255).allow('').optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional()
});

const createModalityTaskSchema = Joi.object({
  modality: Joi.string().required(), // Now accepts any modality value from DB
  task_type: Joi.string().min(1).max(50).required(),
  order_index: Joi.number().integer().min(1).required(),
  weight_percentage: Joi.number().integer().min(0).max(100).default(100)
});

const updateModalityTaskSchema = Joi.object({
  task_type: Joi.string().min(1).max(50).optional(),
  order_index: Joi.number().integer().min(1).optional(),
  weight_percentage: Joi.number().integer().min(0).max(100).optional()
});

class ModalityController {
  /**
   * GET /modalities - Get all modalities
   */
  getAllModalities = asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT 
        id,
        value,
        name,
        description,
        is_active,
        sort_order,
        created_at,
        updated_at
      FROM modalities
      WHERE is_active = true
      ORDER BY sort_order, name
    `);

    res.json({
      success: true,
      data: result.rows
    });
  });

  /**
   * GET /modalities/:id - Get modality by ID
   */
  getModalityById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        id,
        value,
        name,
        description,
        is_active,
        sort_order,
        created_at,
        updated_at
      FROM modalities
      WHERE id = $1 AND is_active = true
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Modality not found');
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  });

  /**
   * POST /modalities - Create a new modality
   */
  createModality = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = createModalitySchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid modality data', error.details);
    }

    const { value: modalityValue, name, description, sort_order } = value;

    // Check if value already exists
    const existingModality = await query(
      'SELECT id FROM modalities WHERE value = $1',
      [modalityValue]
    );
    
    if (existingModality.rows.length > 0) {
      throw new ValidationError('Modality with this value already exists');
    }
    
    // Create new modality
    const result = await query(`
      INSERT INTO modalities (value, name, description, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [modalityValue, name, description, sort_order]);
    
    logger.info('Modality created successfully', {
      modalityId: result.rows[0].id,
      value: modalityValue,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  });

  /**
   * PUT /modalities/:id - Update a modality
   */
  updateModality = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Validate input
    const { error, value } = updateModalitySchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid update data', error.details);
    }
    
    // Check if modality exists
    const existingModality = await query(
      'SELECT * FROM modalities WHERE id = $1',
      [id]
    );
    
    if (existingModality.rows.length === 0) {
      throw new NotFoundError('Modality not found');
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(value).forEach(key => {
      if (value[key] !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value[key]);
        paramIndex++;
      }
    });
    
    if (updates.length === 0) {
      throw new ValidationError('No valid fields to update');
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const result = await query(`
      UPDATE modalities
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `, values);
    
    logger.info('Modality updated successfully', {
      modalityId: id,
      updates: value,
      updatedBy: req.user.id
    });
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  });

  /**
   * DELETE /modalities/:id - Delete a modality
   */
  deleteModality = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if modality is in use
    const modality = await query(
      'SELECT value FROM modalities WHERE id = $1',
      [id]
    );
    
    if (modality.rows.length === 0) {
      throw new NotFoundError('Modality not found');
    }
    
    const modalityValue = modality.rows[0].value;
    
    // Check if used by courses
    const usageCheck = await query(
      'SELECT COUNT(*) as count FROM courses WHERE modality = $1',
      [modalityValue]
    );
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      throw new ValidationError('Cannot delete modality that is in use by courses');
    }
    
    // Soft delete
    await query(
      'UPDATE modalities SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    logger.info('Modality deleted successfully', {
      modalityId: id,
      deletedBy: req.user.id
    });
    
    res.json({
      success: true,
      message: 'Modality deleted successfully'
    });
  });

  /**
   * GET /modality-tasks - Get all modality tasks grouped by modality
   */
  getAllModalityTasks = asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT 
        mt.id,
        mt.task_type,
        mt.order_index,
        mt.weight_percentage,
        mt.created_at,
        m.value as modality,
        m.name as modality_name
      FROM modality_tasks mt
      JOIN modalities m ON mt.modality_id = m.id
      ORDER BY m.value, mt.order_index
    `);

    // Group by modality value
    const groupedTasks = result.rows.reduce((acc, task) => {
      const modalityKey = task.modality;
      
      if (!acc[modalityKey]) {
        acc[modalityKey] = [];
      }
      acc[modalityKey].push(task);
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedTasks
    });
  });

  /**
   * GET /modality-tasks/:modality - Get tasks for a specific modality
   */
  getModalityTasks = asyncHandler(async (req, res) => {
    const { modality } = req.params;

    const result = await query(`
      SELECT 
        mt.id,
        mt.task_type,
        mt.order_index,
        mt.weight_percentage,
        mt.created_at,
        m.value as modality,
        m.name as modality_name
      FROM modality_tasks mt
      JOIN modalities m ON mt.modality_id = m.id
      WHERE m.value = $1
      ORDER BY mt.order_index
    `, [modality]);

    res.json({
      success: true,
      data: result.rows
    });
  });

  /**
   * POST /modality-tasks - Create a new modality task
   */
  createModalityTask = asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = createModalityTaskSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid modality task data', error.details);
    }

    const { modality, task_type, order_index, weight_percentage } = value;

    try {
      // Get modality_id from modalities table
      const modalityResult = await query(`
        SELECT id FROM modalities WHERE value = $1
      `, [modality]);

      if (modalityResult.rows.length === 0) {
        throw new ValidationError('Invalid modality');
      }

      const modality_id = modalityResult.rows[0].id;

      // Check if task already exists for this modality
      const existingTask = await query(`
        SELECT id FROM modality_tasks 
        WHERE modality_id = $1 AND task_type = $2
      `, [modality_id, task_type]);

      if (existingTask.rows.length > 0) {
        throw new ValidationError('Task type already exists for this modality');
      }

      // Check if order_index is already used for this modality
      const existingOrder = await query(`
        SELECT id FROM modality_tasks 
        WHERE modality_id = $1 AND order_index = $2
      `, [modality_id, order_index]);

      if (existingOrder.rows.length > 0) {
        throw new ValidationError('Order index already exists for this modality');
      }

      // Create the modality task with foreign key
      const result = await query(`
        INSERT INTO modality_tasks (modality_id, modality, task_type, order_index, weight_percentage, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING *
      `, [modality_id, modality, task_type, order_index, weight_percentage]);

      const newTask = result.rows[0];

      logger.info('Modality task created successfully', {
        taskId: newTask.id,
        modality,
        task_type,
        createdBy: req.user.id
      });

      res.status(201).json({
        success: true,
        data: newTask,
        message: 'Modality task created successfully'
      });

    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new ValidationError('Task already exists for this modality');
      }
      throw error;
    }
  });

  /**
   * PUT /modality-tasks/:id - Update a modality task
   */
  updateModalityTask = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate input
    const { error, value } = updateModalityTaskSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid update data', error.details);
    }

    // Check if task exists
    const existingTask = await query('SELECT * FROM modality_tasks WHERE id = $1', [id]);
    if (existingTask.rows.length === 0) {
      throw new NotFoundError('Modality task not found');
    }

    const currentTask = existingTask.rows[0];

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(value).forEach(key => {
      if (value[key] !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value[key]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    // Check for conflicts
    if (value.task_type) {
      const conflictCheck = await query(`
        SELECT id FROM modality_tasks 
        WHERE modality_id = $1 AND task_type = $2 AND id != $3
      `, [currentTask.modality_id, value.task_type, id]);

      if (conflictCheck.rows.length > 0) {
        throw new ValidationError('Task type already exists for this modality');
      }
    }

    if (value.order_index) {
      const orderConflictCheck = await query(`
        SELECT id FROM modality_tasks 
        WHERE modality_id = $1 AND order_index = $2 AND id != $3
      `, [currentTask.modality_id, value.order_index, id]);

      if (orderConflictCheck.rows.length > 0) {
        throw new ValidationError('Order index already exists for this modality');
      }
    }

    values.push(id);

    const result = await query(`
      UPDATE modality_tasks 
      SET ${updates.join(', ')} 
      WHERE id = $${values.length}
      RETURNING *
    `, values);

    const updatedTask = result.rows[0];

    logger.info('Modality task updated successfully', {
      taskId: id,
      updates: value,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: updatedTask,
      message: 'Modality task updated successfully'
    });
  });

  /**
   * DELETE /modality-tasks/:id - Delete a modality task
   */
  deleteModalityTask = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if task exists
    const existingTask = await query('SELECT * FROM modality_tasks WHERE id = $1', [id]);
    if (existingTask.rows.length === 0) {
      throw new NotFoundError('Modality task not found');
    }

    const task = existingTask.rows[0];

    // Check if there are any active courses using this modality that might have subtasks of this type
    const usageCheck = await query(`
      SELECT COUNT(*) as usage_count
      FROM course_subtasks cs
      JOIN courses c ON cs.course_id = c.id
      WHERE c.modality = $1 AND cs.task_type = $2 AND c.status != 'deleted'
    `, [task.modality, task.task_type]);

    const usageCount = parseInt(usageCheck.rows[0].usage_count);
    
    if (usageCount > 0) {
      throw new ValidationError(
        `Cannot delete task type '${task.task_type}' for modality '${task.modality}'. ` +
        `It is currently used by ${usageCount} course(s). ` +
        `Please remove or change the task type in those courses first.`
      );
    }

    // Delete the task
    await query('DELETE FROM modality_tasks WHERE id = $1', [id]);

    logger.info('Modality task deleted successfully', {
      taskId: id,
      modality: task.modality,
      task_type: task.task_type,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Modality task deleted successfully'
    });
  });

  /**
   * POST /modality-tasks/reorder - Reorder tasks for a modality
   */
  reorderModalityTasks = asyncHandler(async (req, res) => {
    const { modality, taskIds } = req.body;

    // Validate input
    if (!modality || !Array.isArray(taskIds) || taskIds.length === 0) {
      throw new ValidationError('Modality and taskIds array are required');
    }

    // Verify all tasks belong to the specified modality
    const tasks = await query(`
      SELECT id FROM modality_tasks 
      WHERE modality = $1 AND id = ANY($2)
    `, [modality, taskIds]);

    if (tasks.rows.length !== taskIds.length) {
      throw new ValidationError('Some tasks do not belong to the specified modality');
    }

    await transaction(async (client) => {
      // Update order_index for each task
      for (let i = 0; i < taskIds.length; i++) {
        await client.query(`
          UPDATE modality_tasks 
          SET order_index = $1
          WHERE id = $2
        `, [i + 1, taskIds[i]]);
      }
    });

    logger.info('Modality tasks reordered successfully', {
      modality,
      newOrder: taskIds,
      reorderedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Tasks reordered successfully'
    });
  });
}

module.exports = new ModalityController();