const { query, transaction } = require('../config/database');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class CommentsController {
  // Get comments for an entity
  async getCommentsByEntity(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      
      const sql = `
        WITH RECURSIVE comment_tree AS (
          -- Get root comments
          SELECT 
            c.*,
            u.name as author_name,
            u.email as author_email,
            0 as depth
          FROM comments c
          LEFT JOIN users u ON c.created_by = u.id
          WHERE c.entity_type = $1 
            AND c.entity_id = $2 
            AND c.parent_id IS NULL
            AND c.is_deleted = false
          
          UNION ALL
          
          -- Get child comments recursively
          SELECT 
            c.*,
            u.name as author_name,
            u.email as author_email,
            ct.depth + 1
          FROM comments c
          LEFT JOIN users u ON c.created_by = u.id
          INNER JOIN comment_tree ct ON c.parent_id = ct.id
          WHERE c.is_deleted = false
        )
        SELECT * FROM comment_tree
        ORDER BY depth, created_at ASC
        LIMIT $3 OFFSET $4
      `;
      
      const result = await query(sql, [entityType, entityId, limit, offset]);
      
      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM comments
        WHERE entity_type = $1 AND entity_id = $2 AND is_deleted = false
      `;
      const countResult = await query(countSql, [entityType, entityId]);
      
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
      logger.error('Error fetching comments:', error);
      throw new AppError('Failed to fetch comments', 500);
    }
  }
  
  // Create comment
  async createComment(req, res) {
    try {
      const {
        entity_type,
        entity_id,
        parent_id,
        content,
        mentions = [],
        attachments = []
      } = req.body;
      const user_id = req.user.id;
      
      const result = await transaction(async (client) => {
        // Create comment
        const commentSql = `
          INSERT INTO comments (
            entity_type, entity_id, parent_id, content, 
            mentions, attachments, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        
        const commentResult = await client.query(commentSql, [
          entity_type, entity_id, parent_id, content,
          JSON.stringify(mentions), JSON.stringify(attachments), user_id
        ]);
        
        const comment = commentResult.rows[0];
        
        // Log activity
        const activitySql = `
          INSERT INTO activities (
            entity_type, entity_id, action, metadata, user_id
          )
          VALUES ($1, $2, 'commented', $3, $4)
        `;
        
        await client.query(activitySql, [
          entity_type, entity_id,
          JSON.stringify({ comment_id: comment.id, content: content.substring(0, 100) }),
          user_id
        ]);
        
        // TODO: Send notifications to mentioned users
        
        return comment;
      });
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error creating comment:', error);
      throw new AppError('Failed to create comment', 500);
    }
  }
  
  // Update comment
  async updateComment(req, res) {
    try {
      const { id } = req.params;
      const { content, mentions = [], attachments = [] } = req.body;
      const user_id = req.user.id;
      
      // Verify ownership
      const ownerCheck = await query(
        'SELECT created_by FROM comments WHERE id = $1 AND is_deleted = false',
        [id]
      );
      
      if (ownerCheck.rows.length === 0) {
        throw new AppError('Comment not found', 404);
      }
      
      if (ownerCheck.rows[0].created_by !== user_id) {
        throw new AppError('You can only edit your own comments', 403);
      }
      
      const sql = `
        UPDATE comments 
        SET content = $1, mentions = $2, attachments = $3, 
            is_edited = true, edited_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;
      
      const result = await query(sql, [
        content,
        JSON.stringify(mentions),
        JSON.stringify(attachments),
        id
      ]);
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error updating comment:', error);
      throw error;
    }
  }
  
  // Delete comment
  async deleteComment(req, res) {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      
      // Verify ownership
      const ownerCheck = await query(
        'SELECT created_by FROM comments WHERE id = $1 AND is_deleted = false',
        [id]
      );
      
      if (ownerCheck.rows.length === 0) {
        throw new AppError('Comment not found', 404);
      }
      
      if (ownerCheck.rows[0].created_by !== user_id) {
        throw new AppError('You can only delete your own comments', 403);
      }
      
      // Soft delete
      await query(
        'UPDATE comments SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      
      res.json({
        success: true,
        message: 'Comment deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting comment:', error);
      throw error;
    }
  }
  
  // Reply to comment
  async replyToComment(req, res) {
    try {
      const { parentId } = req.params;
      const { content, mentions = [], attachments = [] } = req.body;
      const user_id = req.user.id;
      
      // Get parent comment to inherit entity info
      const parentResult = await query(
        'SELECT entity_type, entity_id FROM comments WHERE id = $1 AND is_deleted = false',
        [parentId]
      );
      
      if (parentResult.rows.length === 0) {
        throw new AppError('Parent comment not found', 404);
      }
      
      const parent = parentResult.rows[0];
      
      const result = await transaction(async (client) => {
        // Create reply
        const commentSql = `
          INSERT INTO comments (
            entity_type, entity_id, parent_id, content, 
            mentions, attachments, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        
        const commentResult = await client.query(commentSql, [
          parent.entity_type, parent.entity_id, parentId, content,
          JSON.stringify(mentions), JSON.stringify(attachments), user_id
        ]);
        
        const comment = commentResult.rows[0];
        
        // Log activity
        const activitySql = `
          INSERT INTO activities (
            entity_type, entity_id, action, metadata, user_id
          )
          VALUES ($1, $2, 'replied', $3, $4)
        `;
        
        await client.query(activitySql, [
          parent.entity_type, parent.entity_id,
          JSON.stringify({ 
            comment_id: comment.id, 
            parent_comment_id: parentId,
            content: content.substring(0, 100) 
          }),
          user_id
        ]);
        
        return comment;
      });
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error creating reply:', error);
      throw error;
    }
  }
}

module.exports = new CommentsController();