const { query, transaction } = require('../config/database');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class FolderController {
  // Get all folders within a program
  async getFolders(req, res) {
    try {
      const { programId } = req.query;
      const userId = req.user.id;
      
      if (!programId) {
        throw new AppError('Program ID is required', 400);
      }

      // Check if user has access to the program
      const programAccess = await query(
        `SELECT p.id FROM programs p
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
        [programId, userId]
      );

      if (programAccess.rows.length === 0) {
        throw new AppError('Program not found or access denied', 404);
      }

      const sql = `
        SELECT 
          f.*,
          u.name as created_by_name,
          COUNT(DISTINCT l.id) as list_count,
          COUNT(DISTINCT c.id) as course_count
        FROM folders f
        LEFT JOIN users u ON f.created_by = u.id
        LEFT JOIN lists l ON f.id = l.folder_id
        LEFT JOIN courses c ON l.id = c.list_id
        WHERE f.program_id = $1
        GROUP BY f.id, u.name
        ORDER BY f.position, f.created_at
      `;
      
      const result = await query(sql, [programId]);
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching folders:', error);
      throw error;
    }
  }

  // Get single folder with its lists
  async getFolder(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const sql = `
        SELECT 
          f.*,
          p.name as program_name,
          u.name as created_by_name,
          json_agg(
            DISTINCT jsonb_build_object(
              'id', l.id,
              'name', l.name,
              'description', l.description,
              'color', l.color,
              'position', l.position,
              'course_count', COALESCE(course_counts.count, 0),
              'created_at', l.created_at
            )
          ) FILTER (WHERE l.id IS NOT NULL) as lists
        FROM folders f
        INNER JOIN programs p ON f.program_id = p.id
        LEFT JOIN program_members pm ON p.id = pm.program_id
        LEFT JOIN users u ON f.created_by = u.id
        LEFT JOIN lists l ON f.id = l.folder_id
        LEFT JOIN (
          SELECT list_id, COUNT(*) as count
          FROM courses
          GROUP BY list_id
        ) course_counts ON l.id = course_counts.list_id
        WHERE f.id = $1 
        AND (p.owner_id = $2 OR pm.user_id = $2)
        GROUP BY f.id, p.name, u.name
      `;
      
      const result = await query(sql, [id, userId]);
      
      if (result.rows.length === 0) {
        throw new AppError('Folder not found or access denied', 404);
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching folder:', error);
      throw error;
    }
  }

  // Create new folder
  async createFolder(req, res) {
    try {
      const { name, description, programId, color, position } = req.body;
      const userId = req.user.id;
      
      // Check if user has access to create folders in this program
      const programAccess = await query(
        `SELECT pm.role FROM programs p
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE p.id = $1 AND (p.owner_id = $2 OR (pm.user_id = $2 AND pm.role IN ('owner', 'admin')))`,
        [programId, userId]
      );

      if (programAccess.rows.length === 0) {
        throw new AppError('Insufficient permissions to create folder', 403);
      }

      const result = await transaction(async (client) => {
        // Create folder
        const folderSql = `
          INSERT INTO folders (name, description, program_id, color, position, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $6)
          RETURNING *
        `;
        
        const folderResult = await client.query(folderSql, [
          name, description, programId, color, position || 0, userId
        ]);
        
        const folder = folderResult.rows[0];
        
        // Log activity
        await client.query(
          `INSERT INTO activities (program_id, entity_type, entity_id, action, user_id)
           VALUES ($1, 'folder', $2, 'created', $3)`,
          [programId, folder.id, userId]
        );
        
        return folder;
      });
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error creating folder:', error);
      throw new AppError('Failed to create folder', 500);
    }
  }

  // Update folder
  async updateFolder(req, res) {
    try {
      const { id } = req.params;
      const { name, description, color, position, is_collapsed } = req.body;
      const userId = req.user.id;
      
      // Check permissions
      const permissionCheck = await query(
        `SELECT p.id FROM folders f
         INNER JOIN programs p ON f.program_id = p.id
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE f.id = $1 AND (p.owner_id = $2 OR (pm.user_id = $2 AND pm.role IN ('owner', 'admin')))`,
        [id, userId]
      );

      if (permissionCheck.rows.length === 0) {
        throw new AppError('Insufficient permissions', 403);
      }

      const sql = `
        UPDATE folders 
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
        throw new AppError('Folder not found', 404);
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error updating folder:', error);
      throw error;
    }
  }

  // Delete folder
  async deleteFolder(req, res) {
    try {
      const { id } = req.params;
      const { force } = req.query;
      const userId = req.user.id;
      
      // Check permissions and get folder info
      const folderCheck = await query(
        `SELECT f.*, p.id as program_id FROM folders f
         INNER JOIN programs p ON f.program_id = p.id
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE f.id = $1 AND (p.owner_id = $2 OR (pm.user_id = $2 AND pm.role IN ('owner', 'admin')))`,
        [id, userId]
      );

      if (folderCheck.rows.length === 0) {
        throw new AppError('Folder not found or insufficient permissions', 404);
      }

      // Check if folder has lists/courses with separate queries for better accuracy
      const listCheck = await query(
        'SELECT id, name FROM lists WHERE folder_id = $1',
        [id]
      );
      
      if (listCheck.rows.length > 0) {
        const listNames = listCheck.rows.map(l => l.name).join(', ');
        logger.info(`Folder ${id} contains ${listCheck.rows.length} lists: ${listNames}`);
        
        if (force !== 'true') {
          throw new AppError(`Cannot delete folder that contains ${listCheck.rows.length} lists: ${listNames}`, 400);
        }
        
        // Force deletion - delete all courses in the lists first
        logger.info(`Force deleting folder ${id} and its contents`);
        await query(
          `DELETE FROM courses WHERE list_id IN (SELECT id FROM lists WHERE folder_id = $1)`,
          [id]
        );
        
        // Delete all lists in the folder
        await query('DELETE FROM lists WHERE folder_id = $1', [id]);
      }

      // Double-check for any remaining courses in lists that belong to this folder
      const courseCheck = await query(
        `SELECT COUNT(c.id) as count 
         FROM courses c 
         INNER JOIN lists l ON c.list_id = l.id 
         WHERE l.folder_id = $1`,
        [id]
      );
      
      const courseCount = parseInt(courseCheck.rows[0].count);
      if (courseCount > 0 && force !== 'true') {
        throw new AppError(`Cannot delete folder that contains lists with ${courseCount} courses`, 400);
      }

      logger.info(`Deleting folder ${id}`);

      await query('DELETE FROM folders WHERE id = $1', [id]);
      
      res.json({
        success: true,
        message: 'Folder deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting folder:', error);
      throw error;
    }
  }

  // Reorder folders
  async reorderFolders(req, res) {
    try {
      const { programId, folder_orders } = req.body; // folder_orders = [{ id, position }]
      const userId = req.user.id;
      
      // Check permissions
      const permissionCheck = await query(
        `SELECT p.id FROM programs p
         LEFT JOIN program_members pm ON p.id = pm.program_id
         WHERE p.id = $1 AND (p.owner_id = $2 OR (pm.user_id = $2 AND pm.role IN ('owner', 'admin')))`,
        [programId, userId]
      );

      if (permissionCheck.rows.length === 0) {
        throw new AppError('Insufficient permissions', 403);
      }

      await transaction(async (client) => {
        for (const { id, position } of folder_orders) {
          await client.query(
            'UPDATE folders SET position = $1, updated_by = $2 WHERE id = $3 AND program_id = $4',
            [position, userId, id, programId]
          );
        }
      });
      
      res.json({
        success: true,
        message: 'Folders reordered successfully'
      });
    } catch (error) {
      logger.error('Error reordering folders:', error);
      throw new AppError('Failed to reorder folders', 500);
    }
  }
}

module.exports = new FolderController();