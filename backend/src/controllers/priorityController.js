const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

/**
 * Get all priorities
 */
exports.getAllPriorities = async (req, res) => {
  try {
    const query = `
      SELECT id, value, label, icon, color, sort_order, is_active, is_default, created_at, updated_at
      FROM priorities 
      WHERE is_active = true
      ORDER BY sort_order ASC, created_at ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching priorities:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PRIORITIES_ERROR',
        message: 'Failed to fetch priorities'
      }
    });
  }
};

/**
 * Get priority by ID
 */
exports.getPriorityById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT id, value, label, icon, color, sort_order, is_active, is_default, created_at, updated_at
      FROM priorities 
      WHERE id = $1 AND is_active = true
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRIORITY_NOT_FOUND',
          message: 'Priority not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching priority by ID:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PRIORITY_ERROR',
        message: 'Failed to fetch priority'
      }
    });
  }
};

/**
 * Create new priority
 */
exports.createPriority = async (req, res) => {
  try {
    const { value, label, icon = 'Flag', color = 'text-gray-500 dark:text-gray-400', sort_order = 0, is_default = false } = req.body;
    
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
    const existingQuery = 'SELECT id FROM priorities WHERE value = $1';
    const existingResult = await pool.query(existingQuery, [value.toLowerCase()]);
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_PRIORITY',
          message: 'Priority with this value already exists'
        }
      });
    }
    
    // If setting as default, unset other defaults
    if (is_default) {
      await pool.query('UPDATE priorities SET is_default = false WHERE is_default = true');
    }
    
    // Create new priority
    const insertQuery = `
      INSERT INTO priorities (value, label, icon, color, sort_order, is_default, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, value, label, icon, color, sort_order, is_active, is_default, created_at, updated_at
    `;
    
    const result = await pool.query(insertQuery, [
      value.toLowerCase(),
      label,
      icon,
      color,
      sort_order,
      is_default
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating priority:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_PRIORITY_ERROR',
        message: 'Failed to create priority'
      }
    });
  }
};

/**
 * Update priority
 */
exports.updatePriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, icon, color, sort_order, is_active, is_default } = req.body;
    
    // Check if priority exists
    const existingQuery = 'SELECT * FROM priorities WHERE id = $1';
    const existingResult = await pool.query(existingQuery, [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRIORITY_NOT_FOUND',
          message: 'Priority not found'
        }
      });
    }
    
    const existingPriority = existingResult.rows[0];
    
    // If setting as default, unset other defaults
    if (is_default && !existingPriority.is_default) {
      await pool.query('UPDATE priorities SET is_default = false WHERE is_default = true');
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      values.push(label);
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramCount++}`);
      values.push(icon);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(color);
    }
    if (sort_order !== undefined) {
      updates.push(`sort_order = $${paramCount++}`);
      values.push(sort_order);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    if (is_default !== undefined) {
      updates.push(`is_default = $${paramCount++}`);
      values.push(is_default);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: 'No updates provided'
        }
      });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const updateQuery = `
      UPDATE priorities 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, value, label, icon, color, sort_order, is_active, is_default, created_at, updated_at
    `;
    
    const result = await pool.query(updateQuery, values);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating priority:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PRIORITY_ERROR',
        message: 'Failed to update priority'
      }
    });
  }
};

/**
 * Delete priority
 */
exports.deletePriority = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if priority is in use
    const usageQuery = 'SELECT COUNT(*) as count FROM courses WHERE priority = (SELECT value FROM priorities WHERE id = $1)';
    const usageResult = await pool.query(usageQuery, [id]);
    
    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'PRIORITY_IN_USE',
          message: 'Cannot delete priority that is in use by courses'
        }
      });
    }
    
    // Soft delete by setting is_active to false
    const deleteQuery = `
      UPDATE priorities 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRIORITY_NOT_FOUND',
          message: 'Priority not found'
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Priority deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting priority:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_PRIORITY_ERROR',
        message: 'Failed to delete priority'
      }
    });
  }
};

/**
 * Get valid priority values for validation
 */
exports.getValidPriorityValues = async () => {
  try {
    const query = 'SELECT value FROM priorities WHERE is_active = true';
    const result = await pool.query(query);
    return result.rows.map(row => row.value);
  } catch (error) {
    logger.error('Error fetching valid priority values:', error);
    // Return default values as fallback
    return ['low', 'medium', 'high', 'critical', 'urgent'];
  }
};