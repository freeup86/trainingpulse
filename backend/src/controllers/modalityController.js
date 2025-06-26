const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { asyncHandler, ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Validation schemas
const createModalityTaskSchema = Joi.object({
  modality: Joi.string().valid('WBT', 'ILT/VLT', 'Micro Learning', 'SIMS', 'DAP').required(),
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
   * GET /modality-tasks - Get all modality tasks grouped by modality
   */
  getAllModalityTasks = asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT 
        id,
        modality,
        task_type,
        order_index,
        weight_percentage,
        created_at
      FROM modality_tasks
      ORDER BY modality, order_index
    `);

    // Group by modality
    const groupedTasks = result.rows.reduce((acc, task) => {
      if (!acc[task.modality]) {
        acc[task.modality] = [];
      }
      acc[task.modality].push(task);
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
        id,
        modality,
        task_type,
        order_index,
        weight_percentage,
        created_at
      FROM modality_tasks
      WHERE modality = $1
      ORDER BY order_index
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
      // Check if task already exists for this modality
      const existingTask = await query(`
        SELECT id FROM modality_tasks 
        WHERE modality = $1 AND task_type = $2
      `, [modality, task_type]);

      if (existingTask.rows.length > 0) {
        throw new ValidationError('Task type already exists for this modality');
      }

      // Check if order_index is already used for this modality
      const existingOrder = await query(`
        SELECT id FROM modality_tasks 
        WHERE modality = $1 AND order_index = $2
      `, [modality, order_index]);

      if (existingOrder.rows.length > 0) {
        throw new ValidationError('Order index already exists for this modality');
      }

      // Create the modality task
      const result = await query(`
        INSERT INTO modality_tasks (modality, task_type, order_index, weight_percentage, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING *
      `, [modality, task_type, order_index, weight_percentage]);

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
        WHERE modality = $1 AND task_type = $2 AND id != $3
      `, [currentTask.modality, value.task_type, id]);

      if (conflictCheck.rows.length > 0) {
        throw new ValidationError('Task type already exists for this modality');
      }
    }

    if (value.order_index) {
      const orderConflictCheck = await query(`
        SELECT id FROM modality_tasks 
        WHERE modality = $1 AND order_index = $2 AND id != $3
      `, [currentTask.modality, value.order_index, id]);

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