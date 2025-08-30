const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all statuses
 */
exports.getAllStatuses = async (req, res) => {
  try {
    const sql = `
      SELECT id, value, label, icon, color, order_index, is_active, created_at, updated_at
      FROM statuses 
      WHERE is_active = true
      ORDER BY order_index ASC, created_at ASC
    `;
    
    const result = await query(sql);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching statuses:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_STATUSES_ERROR',
        message: 'Failed to fetch statuses'
      }
    });
  }
};

/**
 * Get status by ID
 */
exports.getStatusById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sql = `
      SELECT id, value, label, icon, color, order_index, is_active, created_at, updated_at
      FROM statuses 
      WHERE id = $1 AND is_active = true
    `;
    
    const result = await query(sql, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STATUS_NOT_FOUND',
          message: 'Status not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching status by ID:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_STATUS_ERROR',
        message: 'Failed to fetch status'
      }
    });
  }
};

/**
 * Create new status
 */
exports.createStatus = async (req, res) => {
  try {
    const { value, label, icon = 'Circle', color = 'text-gray-500 dark:text-gray-400' } = req.body;
    
    // Validate required fields
    if (!value || !label) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Value and label are required'
        }
      });
    }
    
    // Check if value already exists
    const existingQuery = 'SELECT id FROM statuses WHERE value = $1';
    const existingResult = await query(existingQuery, [value]);
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_VALUE',
          message: 'Status value already exists'
        }
      });
    }
    
    // Get the next order index
    const orderQuery = 'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM statuses';
    const orderResult = await query(orderQuery);
    const nextOrder = orderResult.rows[0].next_order;
    
    const sql = `
      INSERT INTO statuses (value, label, icon, color, order_index)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, value, label, icon, color, order_index, is_active, created_at, updated_at
    `;
    
    const result = await query(sql, [value, label, icon, color, nextOrder]);
    
    logger.info(`Status created: ${value} by user ${req.user.id}`);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_STATUS_ERROR',
        message: 'Failed to create status'
      }
    });
  }
};

/**
 * Update status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, label, icon, color, order_index } = req.body;
    
    // Check if status exists
    const existingQuery = 'SELECT id FROM statuses WHERE id = $1 AND is_active = true';
    const existingResult = await query(existingQuery, [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STATUS_NOT_FOUND',
          message: 'Status not found'
        }
      });
    }
    
    // Check for duplicate value if value is being updated
    if (value) {
      const duplicateQuery = 'SELECT id FROM statuses WHERE value = $1 AND id != $2';
      const duplicateResult = await query(duplicateQuery, [value, id]);
      
      if (duplicateResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_VALUE',
            message: 'Status value already exists'
          }
        });
      }
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (value !== undefined) {
      updateFields.push(`value = $${paramIndex++}`);
      updateValues.push(value);
    }
    if (label !== undefined) {
      updateFields.push(`label = $${paramIndex++}`);
      updateValues.push(label);
    }
    if (icon !== undefined) {
      updateFields.push(`icon = $${paramIndex++}`);
      updateValues.push(icon);
    }
    if (color !== undefined) {
      updateFields.push(`color = $${paramIndex++}`);
      updateValues.push(color);
    }
    if (order_index !== undefined) {
      updateFields.push(`order_index = $${paramIndex++}`);
      updateValues.push(order_index);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: 'No fields to update'
        }
      });
    }
    
    updateValues.push(id);
    
    const sql = `
      UPDATE statuses 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, value, label, icon, color, order_index, is_active, created_at, updated_at
    `;
    
    const result = await query(sql, updateValues);
    
    logger.info(`Status updated: ${id} by user ${req.user.id}`);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_STATUS_ERROR',
        message: 'Failed to update status'
      }
    });
  }
};

/**
 * Delete status (soft delete)
 */
exports.deleteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if status exists
    const existingQuery = 'SELECT id, value FROM statuses WHERE id = $1 AND is_active = true';
    const existingResult = await query(existingQuery, [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STATUS_NOT_FOUND',
          message: 'Status not found'
        }
      });
    }
    
    // Check if status is being used by any courses
    const usageQuery = 'SELECT COUNT(*) as count FROM courses WHERE status = $1';
    const usageResult = await query(usageQuery, [existingResult.rows[0].value]);
    
    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'STATUS_IN_USE',
          message: `Cannot delete status. It is currently used by ${usageResult.rows[0].count} course(s)`
        }
      });
    }
    
    // Soft delete (set is_active to false)
    const sql = 'UPDATE statuses SET is_active = false WHERE id = $1';
    await query(sql, [id]);
    
    logger.info(`Status deleted: ${id} by user ${req.user.id}`);
    
    res.json({
      success: true,
      data: { message: 'Status deleted successfully' }
    });
  } catch (error) {
    logger.error('Error deleting status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_STATUS_ERROR',
        message: 'Failed to delete status'
      }
    });
  }
};