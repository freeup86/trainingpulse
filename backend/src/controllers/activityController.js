const { query } = require('../config/database');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class ActivityController {
  // Get activities by entity (e.g., course, program, folder)
  async getByEntity(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const { limit = 20, action = '', entity_type = '', user_id = '' } = req.query;
      const userId = req.user.id;

      // Build WHERE conditions
      let whereConditions = ['a.entity_type = $1', 'a.entity_id = $2'];
      let queryParams = [entityType, entityId];
      let paramCount = 2;

      if (action) {
        paramCount++;
        whereConditions.push(`a.action = $${paramCount}`);
        queryParams.push(action);
      }

      if (entity_type && entity_type !== entityType) {
        paramCount++;
        whereConditions.push(`a.entity_type = $${paramCount}`);
        queryParams.push(entity_type);
      }

      if (user_id) {
        paramCount++;
        whereConditions.push(`a.user_id = $${paramCount}`);
        queryParams.push(user_id);
      }

      const sql = `
        SELECT 
          a.*,
          u.name as user_name,
          u.email as user_email
        FROM activities a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY a.created_at DESC
        LIMIT $${paramCount + 1}
      `;
      
      queryParams.push(parseInt(limit));
      
      const result = await query(sql, queryParams);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching activities:', error);
      throw new AppError('Failed to fetch activities', 500);
    }
  }

  // Get all activities with filters
  async getAll(req, res) {
    try {
      const { limit = 50, action = '', entity_type = '', user_id = '', program_id = '' } = req.query;
      const userId = req.user.id;

      // Build WHERE conditions
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramCount = 0;

      if (action) {
        paramCount++;
        whereConditions.push(`a.action = $${paramCount}`);
        queryParams.push(action);
      }

      if (entity_type) {
        paramCount++;
        whereConditions.push(`a.entity_type = $${paramCount}`);
        queryParams.push(entity_type);
      }

      if (user_id) {
        paramCount++;
        whereConditions.push(`a.user_id = $${paramCount}`);
        queryParams.push(user_id);
      }

      if (program_id) {
        paramCount++;
        whereConditions.push(`a.program_id = $${paramCount}`);
        queryParams.push(program_id);
      }

      const sql = `
        SELECT 
          a.*,
          u.name as user_name,
          u.email as user_email
        FROM activities a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY a.created_at DESC
        LIMIT $${paramCount + 1}
      `;
      
      queryParams.push(parseInt(limit));
      
      const result = await query(sql, queryParams);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching activities:', error);
      throw new AppError('Failed to fetch activities', 500);
    }
  }

  // Get activities by program
  async getByProgram(req, res) {
    try {
      const { programId } = req.params;
      const { limit = 20 } = req.query;
      const userId = req.user.id;

      const sql = `
        SELECT 
          a.*,
          u.name as user_name,
          u.email as user_email
        FROM activities a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.program_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2
      `;
      
      const result = await query(sql, [programId, parseInt(limit)]);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching program activities:', error);
      throw new AppError('Failed to fetch program activities', 500);
    }
  }
}

module.exports = new ActivityController();