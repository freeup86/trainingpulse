const { query, transaction } = require('../config/database');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class ProgramController {
  // Get all programs with optional filters
  async getPrograms(req, res) {
    try {
      const { type, status, parent_id, search } = req.query;
      const userId = req.user.id;
      
      logger.info('Getting programs for user:', { userId, filters: { type, status, parent_id, search } });
      
      let sql = `
        SELECT 
          p.*,
          u.name as owner_name,
          COUNT(DISTINCT c.id) as course_count,
          COUNT(DISTINCT pm.user_id) as member_count,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', pm2.user_id,
                'full_name', u2.name,
                'role', pm2.role
              )
            ) FILTER (WHERE pm2.user_id IS NOT NULL), 
            '[]'
          ) as members
        FROM programs p
        LEFT JOIN users u ON p.owner_id = u.id
        LEFT JOIN courses c ON p.id = c.program_id
        LEFT JOIN program_members pm ON p.id = pm.program_id
        LEFT JOIN program_members pm2 ON p.id = pm2.program_id
        LEFT JOIN users u2 ON pm2.user_id = u2.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 1;
      
      // Add filters
      if (type) {
        sql += ` AND p.type = $${paramCount++}`;
        params.push(type);
      }
      
      if (status) {
        sql += ` AND p.status = $${paramCount++}`;
        params.push(status);
      }
      
      if (parent_id) {
        sql += ` AND p.parent_id = $${paramCount++}`;
        params.push(parent_id);
      } else if (parent_id === null) {
        sql += ` AND p.parent_id IS NULL`;
      }
      
      if (search) {
        sql += ` AND (p.name ILIKE $${paramCount++} OR p.description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
        paramCount++;
      }
      
      // Check access - user must be a member or owner
      sql += ` AND (p.owner_id = $${paramCount++} OR EXISTS (
        SELECT 1 FROM program_members WHERE program_id = p.id AND user_id = $${paramCount++}
      ))`;
      params.push(userId, userId);
      
      sql += ` GROUP BY p.id, u.name ORDER BY p.created_at DESC`;
      
      logger.info('Executing SQL:', { sql, params });
      
      const result = await query(sql, params);
      
      logger.info('Programs query result:', { rowCount: result.rows.length, rows: result.rows });
      
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Error fetching programs:', error);
      throw new AppError('Failed to fetch programs', 500);
    }
  }
  
  // Get single program with details
  async getProgram(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const sql = `
        SELECT 
          p.*,
          u.name as owner_name,
          COUNT(DISTINCT c.id) as course_count,
          COUNT(DISTINCT pm.user_id) as member_count,
          json_agg(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.title,
              'status', c.status,
              'calculated_status', c.calculated_status
            )
          ) FILTER (WHERE c.id IS NOT NULL) as recent_courses,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', pm2.user_id,
                'full_name', u2.name,
                'email', u2.email,
                'role', pm2.role
              )
            ) FILTER (WHERE pm2.user_id IS NOT NULL), 
            '[]'
          ) as members
        FROM programs p
        LEFT JOIN users u ON p.owner_id = u.id
        LEFT JOIN courses c ON p.id = c.program_id
        LEFT JOIN program_members pm ON p.id = pm.program_id
        LEFT JOIN program_members pm2 ON p.id = pm2.program_id
        LEFT JOIN users u2 ON pm2.user_id = u2.id
        WHERE p.id = $1
        AND (p.owner_id = $2 OR EXISTS (
          SELECT 1 FROM program_members WHERE program_id = p.id AND user_id = $2
        ))
        GROUP BY p.id, u.name
      `;
      
      const result = await query(sql, [id, userId]);
      
      if (result.rows.length === 0) {
        throw new AppError('Program not found or access denied', 404);
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error fetching program:', error);
      throw error;
    }
  }
  
  // Create new program
  async createProgram(req, res) {
    try {
      const {
        name,
        code,
        description,
        type = 'program',
        color,
        icon,
        parent_id,
        contact_name,
        contact_email,
        contact_phone,
        settings = {},
        metadata = {},
        members = []
      } = req.body;
      
      // Convert empty strings to null for optional fields
      const cleanedCode = code && code.trim() !== '' ? code : null;
      const cleanedDescription = description && description.trim() !== '' ? description : null;
      const cleanedColor = color && color.trim() !== '' ? color : null;
      const cleanedIcon = icon && icon.trim() !== '' ? icon : null;
      const cleanedContactName = contact_name && contact_name.trim() !== '' ? contact_name : null;
      const cleanedContactEmail = contact_email && contact_email.trim() !== '' ? contact_email : null;
      const cleanedContactPhone = contact_phone && contact_phone.trim() !== '' ? contact_phone : null;
      
      const userId = req.user.id;
      
      logger.info('Creating program:', { 
        programData: { name, code, description, type, color, icon, parent_id },
        userId, 
        userInfo: req.user,
        members: members
      });
      
      const result = await transaction(async (client) => {
        // Create program
        const programSql = `
          INSERT INTO programs (
            name, code, description, type, color, icon, parent_id,
            owner_id, contact_name, contact_email, contact_phone,
            settings, metadata, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
          RETURNING *
        `;
        
        const programResult = await client.query(programSql, [
          name, cleanedCode, cleanedDescription, type, cleanedColor, cleanedIcon, parent_id,
          userId, cleanedContactName, cleanedContactEmail, cleanedContactPhone,
          settings, metadata, userId
        ]);
        
        const program = programResult.rows[0];
        
        // Add creator as admin member
        const memberSql = `
          INSERT INTO program_members (program_id, user_id, role, invited_by)
          VALUES ($1, $2, 'admin', $2)
        `;
        
        const memberResult = await client.query(memberSql, [program.id, userId]);
        logger.info('Added program creator as admin:', { programId: program.id, userId, memberResult: memberResult.rowCount });
        
        // Add additional members if provided
        if (members && Array.isArray(members) && members.length > 0) {
          logger.info('Adding additional members:', { programId: program.id, members });
          
          for (const memberId of members) {
            // Skip if the member is the creator (already added as admin)
            if (memberId !== userId) {
              try {
                const additionalMemberSql = `
                  INSERT INTO program_members (program_id, user_id, role, invited_by)
                  VALUES ($1, $2, 'member', $3)
                  ON CONFLICT (program_id, user_id) DO NOTHING
                `;
                
                const additionalMemberResult = await client.query(additionalMemberSql, [program.id, memberId, userId]);
                logger.info('Added additional member:', { 
                  programId: program.id, 
                  memberId, 
                  invitedBy: userId,
                  rowCount: additionalMemberResult.rowCount 
                });
              } catch (memberError) {
                logger.error('Failed to add member:', { programId: program.id, memberId, error: memberError });
                // Continue with other members even if one fails
              }
            }
          }
        }
        
        // Log activity (entity_id should be TEXT to support both UUID and INTEGER)
        const activitySql = `
          INSERT INTO activities (program_id, entity_type, entity_id, action, user_id)
          VALUES ($1, 'program', $2, 'created', $3)
        `;
        
        await client.query(activitySql, [program.id, program.id.toString(), userId]);
        
        return program;
      });
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error creating program:', error);
      
      // Handle unique constraint violation for program code
      if (error.code === '23505' && error.constraint === 'programs_code_key') {
        throw new AppError('A program with this code already exists. Please use a different code.', 400);
      }
      
      throw new AppError('Failed to create program', 500);
    }
  }
  
  // Update program
  async updateProgram(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;
      
      // Check permission
      const permissionCheck = await query(
        `SELECT role FROM program_members WHERE program_id = $1 AND user_id = $2`,
        [id, userId]
      );
      
      if (permissionCheck.rows.length === 0 || 
          !['owner', 'admin'].includes(permissionCheck.rows[0].role)) {
        throw new AppError('Insufficient permissions', 403);
      }
      
      const result = await transaction(async (client) => {
        // Build update query
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        Object.entries(updates).forEach(([key, value]) => {
          if (['name', 'description', 'type', 'status', 'color', 'icon', 
               'contact_name', 'contact_email', 'contact_phone', 
               'settings', 'metadata'].includes(key)) {
            updateFields.push(`${key} = $${paramCount++}`);
            values.push(value);
          }
        });
        
        if (updateFields.length === 0) {
          throw new AppError('No valid fields to update', 400);
        }
        
        updateFields.push(`updated_by = $${paramCount++}`);
        values.push(userId);
        
        values.push(id);
        
        const sql = `
          UPDATE programs 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
        
        const result = await client.query(sql, values);
        
        // Log activity
        await client.query(
          `INSERT INTO activities (program_id, entity_type, entity_id, action, changes, user_id)
           VALUES ($1, 'program', $1, 'updated', $2, $3)`,
          [id, updates, userId]
        );
        
        return result.rows[0];
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error updating program:', error);
      throw error;
    }
  }
  
  // Delete program
  async deleteProgram(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check if user is owner
      const ownerCheck = await query(
        `SELECT owner_id FROM programs WHERE id = $1`,
        [id]
      );
      
      if (ownerCheck.rows.length === 0) {
        throw new AppError('Program not found', 404);
      }
      
      if (ownerCheck.rows[0].owner_id !== userId) {
        throw new AppError('Only program owner can delete', 403);
      }
      
      await query(`DELETE FROM programs WHERE id = $1`, [id]);
      
      res.json({
        success: true,
        message: 'Program deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting program:', error);
      throw error;
    }
  }
  
  // Add member to program
  async addMember(req, res) {
    try {
      const { id } = req.params;
      const { user_id, role = 'member' } = req.body;
      const invitedBy = req.user.id;
      
      // Check permission
      const permissionCheck = await query(
        `SELECT role FROM program_members WHERE program_id = $1 AND user_id = $2`,
        [id, invitedBy]
      );
      
      if (permissionCheck.rows.length === 0 || 
          !['owner', 'admin'].includes(permissionCheck.rows[0].role)) {
        throw new AppError('Insufficient permissions', 403);
      }
      
      const sql = `
        INSERT INTO program_members (program_id, user_id, role, invited_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (program_id, user_id) 
        DO UPDATE SET role = $3
        RETURNING *
      `;
      
      const result = await query(sql, [id, user_id, role, invitedBy]);
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Error adding program member:', error);
      throw new AppError('Failed to add member', 500);
    }
  }
  
  // Remove member from program
  async removeMember(req, res) {
    try {
      const { id, userId } = req.params;
      const requesterId = req.user.id;
      
      // Check permission
      const permissionCheck = await query(
        `SELECT role FROM program_members WHERE program_id = $1 AND user_id = $2`,
        [id, requesterId]
      );
      
      if (permissionCheck.rows.length === 0 || 
          !['owner', 'admin'].includes(permissionCheck.rows[0].role)) {
        throw new AppError('Insufficient permissions', 403);
      }
      
      await query(
        `DELETE FROM program_members WHERE program_id = $1 AND user_id = $2`,
        [id, userId]
      );
      
      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      logger.error('Error removing program member:', error);
      throw new AppError('Failed to remove member', 500);
    }
  }
  
  // Duplicate course
  async duplicateCourse(req, res) {
    try {
      const { courseId } = req.params;
      const { program_id } = req.body;
      const userId = req.user.id;
      
      const result = await transaction(async (client) => {
        // Get original course
        const originalCourse = await client.query(
          `SELECT * FROM courses WHERE id = $1`,
          [courseId]
        );
        
        if (originalCourse.rows.length === 0) {
          throw new AppError('Course not found', 404);
        }
        
        const course = originalCourse.rows[0];
        
        // Create new course
        const newCourseSql = `
          INSERT INTO courses (
            title, description, status, priority, program_id,
            start_date, due_date, metadata, created_by, updated_by,
            completion_percentage, is_template, list_id, folder_id
          ) 
          SELECT 
            title || ' (copy)', description, 'draft', priority, 
            COALESCE($1, program_id), null, null, metadata, $2, $2,
            0, false, list_id, folder_id
          FROM courses 
          WHERE id = $3
          RETURNING *
        `;
        
        const newCourse = await client.query(newCourseSql, [
          program_id, userId, courseId
        ]);
        
        const newCourseId = newCourse.rows[0].id;
        
        // Copy subtasks
        await client.query(`
          INSERT INTO course_subtasks (
            course_id, title, status, is_blocking,
            weight, order_index
          )
          SELECT 
            $1, title, 'pending', is_blocking,
            weight, order_index
          FROM course_subtasks
          WHERE course_id = $2
        `, [newCourseId, courseId]);
        
        // Skip copying custom field values and activity logging
        // since course IDs are integers but these tables expect UUIDs
        // These features are for programs which use UUIDs
        
        return newCourse.rows[0];
      });
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error duplicating course:', error);
      throw error;
    }
  }
}

module.exports = new ProgramController();