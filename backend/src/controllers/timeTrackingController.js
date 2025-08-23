const { query, transaction } = require('../config/database');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class TimeTrackingController {
  // Get time entries with filters
  async getTimeEntries(req, res) {
    try {
      const { user_id, task_id, course_id, start_date, end_date, is_billable } = req.query;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      let sql = `
        SELECT 
          te.*,
          u.name as user_name,
          cs.title as task_name,
          c.title as course_name
        FROM time_entries te
        LEFT JOIN users u ON te.user_id = u.id
        LEFT JOIN course_subtasks cs ON te.task_id = cs.id
        LEFT JOIN courses c ON te.course_id = c.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 1;
      
      if (user_id) {
        sql += ` AND te.user_id = $${paramCount++}`;
        params.push(user_id);
      }
      
      if (task_id) {
        sql += ` AND te.task_id = $${paramCount++}`;
        params.push(task_id);
      }
      
      if (course_id) {
        sql += ` AND te.course_id = $${paramCount++}`;
        params.push(course_id);
      }
      
      if (start_date) {
        sql += ` AND te.start_time >= $${paramCount++}`;
        params.push(start_date);
      }
      
      if (end_date) {
        sql += ` AND te.start_time <= $${paramCount++}`;
        params.push(end_date);
      }
      
      if (is_billable !== undefined) {
        sql += ` AND te.is_billable = $${paramCount++}`;
        params.push(is_billable === 'true');
      }
      
      sql += ` ORDER BY te.start_time DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      params.push(limit, offset);
      
      const result = await query(sql, params);
      
      // Get total count
      let countSql = `
        SELECT COUNT(*) as total
        FROM time_entries te
        WHERE 1=1
      `;
      const countParams = params.slice(0, params.length - 2); // Remove limit and offset
      
      if (user_id) countSql += ` AND te.user_id = $1`;
      if (task_id) countSql += ` AND te.task_id = $${countParams.indexOf(task_id) + 1}`;
      if (course_id) countSql += ` AND te.course_id = $${countParams.indexOf(course_id) + 1}`;
      if (start_date) countSql += ` AND te.start_time >= $${countParams.indexOf(start_date) + 1}`;
      if (end_date) countSql += ` AND te.start_time <= $${countParams.indexOf(end_date) + 1}`;
      if (is_billable !== undefined) countSql += ` AND te.is_billable = $${countParams.indexOf(is_billable === 'true') + 1}`;
      
      const countResult = await query(countSql, countParams);
      
      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching time entries:', error);
      throw new AppError('Failed to fetch time entries', 500);
    }
  }
  
  // Get single time entry
  async getTimeEntry(req, res) {
    try {
      const { id } = req.params;
      
      const sql = `
        SELECT 
          te.*,
          u.name as user_name,
          cs.title as task_name,
          c.title as course_name
        FROM time_entries te
        LEFT JOIN users u ON te.user_id = u.id
        LEFT JOIN course_subtasks cs ON te.task_id = cs.id
        LEFT JOIN courses c ON te.course_id = c.id
        WHERE te.id = $1
      `;
      
      const result = await query(sql, [id]);
      
      if (result.rows.length === 0) {
        throw new AppError('Time entry not found', 404);
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching time entry:', error);
      throw error;
    }
  }
  
  // Start time tracking
  async startTimeTracking(req, res) {
    try {
      const { task_id, course_id, description } = req.body;
      const user_id = req.user.id;
      
      // Check if user has any active time entries
      const activeCheck = await query(
        'SELECT id FROM time_entries WHERE user_id = $1 AND end_time IS NULL',
        [user_id]
      );
      
      if (activeCheck.rows.length > 0) {
        throw new AppError('You already have an active time entry. Please stop it first.', 400);
      }
      
      const sql = `
        INSERT INTO time_entries (user_id, task_id, course_id, start_time, description)
        VALUES ($1, $2, $3, NOW(), $4)
        RETURNING *
      `;
      
      const result = await query(sql, [user_id, task_id, course_id, description]);
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error starting time tracking:', error);
      throw error;
    }
  }
  
  // Stop time tracking
  async stopTimeTracking(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      
      const result = await transaction(async (client) => {
        // Get the time entry and verify ownership
        const entryResult = await client.query(
          'SELECT * FROM time_entries WHERE id = $1 AND user_id = $2',
          [id, user_id]
        );
        
        if (entryResult.rows.length === 0) {
          throw new AppError('Time entry not found or access denied', 404);
        }
        
        const entry = entryResult.rows[0];
        
        if (entry.end_time) {
          throw new AppError('Time entry is already stopped', 400);
        }
        
        // Calculate duration
        const endTime = new Date();
        const startTime = new Date(entry.start_time);
        const duration = Math.round((endTime - startTime) / (1000 * 60)); // Duration in minutes
        
        // Update the entry
        const updateResult = await client.query(
          'UPDATE time_entries SET end_time = $1, duration = $2 WHERE id = $3 RETURNING *',
          [endTime, duration, id]
        );
        
        return updateResult.rows[0];
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error stopping time tracking:', error);
      throw error;
    }
  }
  
  // Create time entry
  async createTimeEntry(req, res) {
    try {
      const {
        task_id,
        course_id,
        start_time,
        end_time,
        duration,
        description,
        is_billable = false,
        tags = []
      } = req.body;
      const user_id = req.user.id;
      
      // Calculate duration if not provided
      let calculatedDuration = duration;
      if (!calculatedDuration && start_time && end_time) {
        const start = new Date(start_time);
        const end = new Date(end_time);
        calculatedDuration = Math.round((end - start) / (1000 * 60)); // Duration in minutes
      }
      
      const sql = `
        INSERT INTO time_entries (
          user_id, task_id, course_id, start_time, end_time, 
          duration, description, is_billable, tags
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const result = await query(sql, [
        user_id, task_id, course_id, start_time, end_time,
        calculatedDuration, description, is_billable, JSON.stringify(tags)
      ]);
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error creating time entry:', error);
      throw new AppError('Failed to create time entry', 500);
    }
  }
  
  // Update time entry
  async updateTimeEntry(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      const updates = req.body;
      
      // Verify ownership
      const ownerCheck = await query(
        'SELECT id FROM time_entries WHERE id = $1 AND user_id = $2',
        [id, user_id]
      );
      
      if (ownerCheck.rows.length === 0) {
        throw new AppError('Time entry not found or access denied', 404);
      }
      
      const result = await transaction(async (client) => {
        // Build update query
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        Object.entries(updates).forEach(([key, value]) => {
          if (['start_time', 'end_time', 'duration', 'description', 'is_billable', 'tags'].includes(key)) {
            updateFields.push(`${key} = $${paramCount++}`);
            values.push(key === 'tags' ? JSON.stringify(value) : value);
          }
        });
        
        if (updateFields.length === 0) {
          throw new AppError('No valid fields to update', 400);
        }
        
        // Recalculate duration if start_time or end_time changed
        if (updates.start_time || updates.end_time) {
          const currentEntry = await client.query('SELECT * FROM time_entries WHERE id = $1', [id]);
          const entry = currentEntry.rows[0];
          
          const startTime = new Date(updates.start_time || entry.start_time);
          const endTime = new Date(updates.end_time || entry.end_time);
          
          if (endTime > startTime) {
            const calculatedDuration = Math.round((endTime - startTime) / (1000 * 60));
            updateFields.push(`duration = $${paramCount++}`);
            values.push(calculatedDuration);
          }
        }
        
        values.push(id);
        
        const sql = `
          UPDATE time_entries 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
        
        return await client.query(sql, values);
      });
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error updating time entry:', error);
      throw error;
    }
  }
  
  // Delete time entry
  async deleteTimeEntry(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      
      const result = await query(
        'DELETE FROM time_entries WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, user_id]
      );
      
      if (result.rows.length === 0) {
        throw new AppError('Time entry not found or access denied', 404);
      }
      
      res.json({
        success: true,
        message: 'Time entry deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting time entry:', error);
      throw error;
    }
  }
  
  // Get time entries by user
  async getTimeEntriesByUser(req, res) {
    try {
      const { userId } = req.params;
      const { start_date, end_date } = req.query;
      
      let sql = `
        SELECT 
          te.*,
          cs.title as task_name,
          c.title as course_name
        FROM time_entries te
        LEFT JOIN course_subtasks cs ON te.task_id = cs.id
        LEFT JOIN courses c ON te.course_id = c.id
        WHERE te.user_id = $1
      `;
      
      const params = [userId];
      let paramCount = 2;
      
      if (start_date) {
        sql += ` AND te.start_time >= $${paramCount++}`;
        params.push(start_date);
      }
      
      if (end_date) {
        sql += ` AND te.start_time <= $${paramCount++}`;
        params.push(end_date);
      }
      
      sql += ` ORDER BY te.start_time DESC`;
      
      const result = await query(sql, params);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching user time entries:', error);
      throw new AppError('Failed to fetch user time entries', 500);
    }
  }
  
  // Get time entries by task
  async getTimeEntriesByTask(req, res) {
    try {
      const { taskId } = req.params;
      
      const sql = `
        SELECT 
          te.*,
          u.name as user_name
        FROM time_entries te
        LEFT JOIN users u ON te.user_id = u.id
        WHERE te.task_id = $1
        ORDER BY te.start_time DESC
      `;
      
      const result = await query(sql, [taskId]);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching task time entries:', error);
      throw new AppError('Failed to fetch task time entries', 500);
    }
  }
}

module.exports = new TimeTrackingController();