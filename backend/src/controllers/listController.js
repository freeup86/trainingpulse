const { query, transaction } = require('../config/database');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class ListController {
  // Get all lists within a folder
  async getLists(req, res) {
    try {
      const { folderId } = req.query;
      const userId = req.user.id;
      
      if (!folderId) {
        throw new AppError('Folder ID is required', 400);
      }

      // Check if user has access to the folder
      const folderAccess = await query(
        `SELECT f.id FROM folders f
         INNER JOIN programs p ON f.program_id = p.id
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE f.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
        [folderId, userId]
      );

      if (folderAccess.rows.length === 0) {
        // Return empty list instead of 404 for deleted/non-existent folders
        // This prevents frontend errors during deletion workflows
        logger.info(`Folder ${folderId} not found or access denied, returning empty list`);
        return res.json({
          success: true,
          data: []
        });
      }

      const sql = `
        SELECT 
          l.*,
          u.name as created_by_name,
          COUNT(DISTINCT c.id) as course_count,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', c.id,
                'title', c.title,
                'status', c.status,
                'calculated_status', c.calculated_status,
                'priority', c.priority,
                'completion_percentage', c.completion_percentage,
                'created_at', c.created_at
              )
            ) FILTER (WHERE c.id IS NOT NULL), 
            '[]'
          ) as courses
        FROM lists l
        LEFT JOIN users u ON l.created_by = u.id
        LEFT JOIN courses c ON l.id = c.list_id
        WHERE l.folder_id = $1
        GROUP BY l.id, u.name
        ORDER BY l.position, l.created_at
      `;
      
      const result = await query(sql, [folderId]);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching lists:', error);
      throw error;
    }
  }

  // Get single list with its courses
  async getList(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const sql = `
        SELECT 
          l.*,
          f.name as folder_name,
          p.name as program_name,
          u.name as created_by_name,
          json_agg(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'title', c.title,
              'description', c.description,
              'status', c.status,
              'calculated_status', c.calculated_status,
              'priority', c.priority,
              'modality', c.modality,
              'completion_percentage', c.completion_percentage,
              'start_date', c.start_date,
              'due_date', c.due_date,
              'created_at', c.created_at
            )
          ) FILTER (WHERE c.id IS NOT NULL) as courses
        FROM lists l
        INNER JOIN folders f ON l.folder_id = f.id
        INNER JOIN programs p ON f.program_id = p.id
        LEFT JOIN program_members pm ON p.id = pm.program_id
        LEFT JOIN users u ON l.created_by = u.id
        LEFT JOIN courses c ON l.id = c.list_id
        WHERE l.id = $1 
        AND (p.owner_id = $2 OR pm.user_id = $2)
        GROUP BY l.id, f.name, p.name, u.name
      `;
      
      const result = await query(sql, [id, userId]);
      
      if (result.rows.length === 0) {
        throw new AppError('List not found or access denied', 404);
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching list:', error);
      throw error;
    }
  }

  // Create new list
  async createList(req, res) {
    try {
      const { name, description, folderId, color, position } = req.body;
      const userId = req.user.id;
      
      // Check if user has access to create lists in this folder
      const folderAccess = await query(
        `SELECT f.id, p.id as program_id FROM folders f
         INNER JOIN programs p ON f.program_id = p.id
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE f.id = $1 AND (p.owner_id = $2 OR (pm.user_id = $2 AND pm.role IN ('owner', 'admin')))`,
        [folderId, userId]
      );

      if (folderAccess.rows.length === 0) {
        throw new AppError('Insufficient permissions to create list', 403);
      }

      const programId = folderAccess.rows[0].program_id;

      const result = await transaction(async (client) => {
        // Create list
        const listSql = `
          INSERT INTO lists (name, description, folder_id, color, position, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $6)
          RETURNING *
        `;
        
        const listResult = await client.query(listSql, [
          name, description, folderId, color, position || 0, userId
        ]);
        
        const list = listResult.rows[0];
        
        // Log activity
        await client.query(
          `INSERT INTO activities (program_id, entity_type, entity_id, action, user_id)
           VALUES ($1, 'list', $2, 'created', $3)`,
          [programId, list.id, userId]
        );
        
        return list;
      });
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error creating list:', error);
      throw new AppError('Failed to create list', 500);
    }
  }

  // Update list
  async updateList(req, res) {
    try {
      const { id } = req.params;
      const { name, description, color, position, is_collapsed } = req.body;
      const userId = req.user.id;
      
      // Check permissions
      const permissionCheck = await query(
        `SELECT l.id FROM lists l
         INNER JOIN folders f ON l.folder_id = f.id
         INNER JOIN programs p ON f.program_id = p.id
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE l.id = $1 AND (p.owner_id = $2 OR (pm.user_id = $2 AND pm.role IN ('owner', 'admin')))`,
        [id, userId]
      );

      if (permissionCheck.rows.length === 0) {
        throw new AppError('Insufficient permissions', 403);
      }

      const sql = `
        UPDATE lists 
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            color = COALESCE($3, color),
            position = COALESCE($4, position),
            is_collapsed = COALESCE($5, is_collapsed),
            updated_by = $6
        WHERE id = $7
        RETURNING *
      `;
      
      const result = await query(sql, [name, description, color, position, is_collapsed, userId, id]);
      
      if (result.rows.length === 0) {
        throw new AppError('List not found', 404);
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error updating list:', error);
      throw error;
    }
  }

  // Delete list
  async deleteList(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check permissions and get list info
      const listCheck = await query(
        `SELECT l.*, f.name as folder_name FROM lists l
         INNER JOIN folders f ON l.folder_id = f.id
         INNER JOIN programs p ON f.program_id = p.id
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE l.id = $1 AND (p.owner_id = $2 OR (pm.user_id = $2 AND pm.role IN ('owner', 'admin')))`,
        [id, userId]
      );

      if (listCheck.rows.length === 0) {
        throw new AppError('List not found or insufficient permissions', 404);
      }

      // Check if list has courses
      const courseCheck = await query(
        'SELECT COUNT(*) as course_count FROM courses WHERE list_id = $1',
        [id]
      );

      const courseCount = parseInt(courseCheck.rows[0].course_count);
      if (courseCount > 0) {
        throw new AppError(`Cannot delete list that contains ${courseCount} courses`, 400);
      }

      await query('DELETE FROM lists WHERE id = $1', [id]);
      
      res.json({
        success: true,
        message: 'List deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting list:', error);
      throw error;
    }
  }

  // Reorder lists
  async reorderLists(req, res) {
    try {
      const { folderId, list_orders } = req.body; // list_orders = [{ id, position }]
      const userId = req.user.id;
      
      // Check permissions
      const permissionCheck = await query(
        `SELECT f.id FROM folders f
         INNER JOIN programs p ON f.program_id = p.id
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE f.id = $1 AND (p.owner_id = $2 OR (pm.user_id = $2 AND pm.role IN ('owner', 'admin')))`,
        [folderId, userId]
      );

      if (permissionCheck.rows.length === 0) {
        throw new AppError('Insufficient permissions', 403);
      }

      await transaction(async (client) => {
        for (const { id, position } of list_orders) {
          await client.query(
            'UPDATE lists SET position = $1, updated_by = $2 WHERE id = $3 AND folder_id = $4',
            [position, userId, id, folderId]
          );
        }
      });
      
      res.json({
        success: true,
        message: 'Lists reordered successfully'
      });
    } catch (error) {
      logger.error('Error reordering lists:', error);
      throw new AppError('Failed to reorder lists', 500);
    }
  }

  // Move list to different folder
  async moveList(req, res) {
    try {
      const { id } = req.params;
      const { folderId, position } = req.body;
      const userId = req.user.id;
      
      // Check permissions for both source and destination
      const permissionCheck = await query(
        `SELECT COUNT(*) as count FROM (
          SELECT 1 FROM lists l
          INNER JOIN folders f ON l.folder_id = f.id
          INNER JOIN programs p ON f.program_id = p.id
          LEFT JOIN program_members pm ON p.id = pm.program_id
          WHERE l.id = $1 AND (p.owner_id = $3 OR (pm.user_id = $3 AND pm.role IN ('owner', 'admin')))
          
          UNION ALL
          
          SELECT 1 FROM folders f
          INNER JOIN programs p ON f.program_id = p.id
          LEFT JOIN program_members pm ON p.id = pm.program_id
          WHERE f.id = $2 AND (p.owner_id = $3 OR (pm.user_id = $3 AND pm.role IN ('owner', 'admin')))
        ) perms`,
        [id, folderId, userId]
      );

      if (parseInt(permissionCheck.rows[0].count) < 2) {
        throw new AppError('Insufficient permissions', 403);
      }

      const sql = `
        UPDATE lists 
        SET folder_id = $1, 
            position = COALESCE($2, 0),
            updated_by = $3
        WHERE id = $4
        RETURNING *
      `;
      
      const result = await query(sql, [folderId, position, userId, id]);
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error moving list:', error);
      throw error;
    }
  }
}

module.exports = new ListController();