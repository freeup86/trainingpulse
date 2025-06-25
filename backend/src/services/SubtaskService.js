const { query, transaction } = require('../config/database');
const StatusAggregator = require('./StatusAggregator');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Subtask Service
 * Handles subtask CRUD operations and triggers status aggregation
 */
class SubtaskService {
  constructor() {
    this.statusAggregator = new StatusAggregator();
  }

  /**
   * Create a new subtask for a course
   */
  async createSubtask(courseId, subtaskData, userId) {
    try {
      const {
        title,
        status = 'alpha_review', // Start with alpha_review instead of pending
        isBlocking = false,
        weight = 1,
        orderIndex
      } = subtaskData;

      // Validate course exists
      const courseCheck = await query('SELECT id FROM courses WHERE id = $1', [courseId]);
      if (courseCheck.rows.length === 0) {
        throw new NotFoundError(`Course ${courseId} not found`);
      }

      // Determine order index if not provided
      let finalOrderIndex = orderIndex;
      if (finalOrderIndex === undefined) {
        const maxOrderResult = await query(
          'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM course_subtasks WHERE course_id = $1',
          [courseId]
        );
        finalOrderIndex = maxOrderResult.rows[0].next_order;
      }

      const subtask = await transaction(async (client) => {
        // Create subtask
        const result = await client.query(`
          INSERT INTO course_subtasks (
            course_id, title, status, is_blocking, weight, order_index, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *
        `, [courseId, title, status, isBlocking, weight, finalOrderIndex]);

        const newSubtask = result.rows[0];

        // Auto-create Alpha Review phase status history entry
        // Every new phase starts in Alpha Review
        await client.query(`
          INSERT INTO phase_status_history (subtask_id, status, started_at, created_at, updated_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [newSubtask.id, 'alpha_review']);

        // Log the creation
        await client.query(`
          INSERT INTO audit_logs (
            user_id, entity_type, entity_id, action, changes, created_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
          userId,
          'subtask',
          newSubtask.id,
          'created',
          JSON.stringify({
            courseId,
            title,
            status,
            isBlocking,
            weight,
            orderIndex: finalOrderIndex,
            autoCreatedAlphaReview: true
          })
        ]);

        return newSubtask;
      });

      // Trigger status recalculation
      await this.statusAggregator.updateCourseStatus(courseId, { triggeredBy: userId });

      logger.info('Subtask created', {
        subtaskId: subtask.id,
        courseId,
        title,
        userId
      });

      return subtask;

    } catch (error) {
      logger.logError(error, {
        context: 'SubtaskService.createSubtask',
        courseId,
        subtaskData,
        userId
      });
      throw error;
    }
  }

  /**
   * Update subtask status and properties
   */
  async updateSubtask(subtaskId, updateData, userId) {
    try {
      // Get current subtask data
      const currentResult = await query(
        'SELECT * FROM course_subtasks WHERE id = $1',
        [subtaskId]
      );

      if (currentResult.rows.length === 0) {
        throw new NotFoundError(`Subtask ${subtaskId} not found`);
      }

      const currentSubtask = currentResult.rows[0];
      const courseId = currentSubtask.course_id;

      // Prepare update data
      const allowedFields = ['title', 'status', 'is_blocking', 'weight', 'order_index', 'assigned_user_id', 'assigned_at', 'assigned_by'];
      const updates = {};
      const changes = {};

      allowedFields.forEach(field => {
        const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (updateData[camelField] !== undefined) {
          updates[field] = updateData[camelField];
          if (currentSubtask[field] !== updateData[camelField]) {
            changes[field] = {
              from: currentSubtask[field],
              to: updateData[camelField]
            };
          }
        }
      });

      // Handle assignment logic for multiple users
      if (updateData.assignedUserIds !== undefined) {
        // This will be handled separately in the transaction
        changes.assignmentUpdate = {
          newAssignedUserIds: updateData.assignedUserIds,
          assignedBy: userId
        };
      } else if (updateData.assignedUserId !== undefined) {
        // Backward compatibility for single user assignment
        changes.assignmentUpdate = {
          newAssignedUserIds: updateData.assignedUserId ? [updateData.assignedUserId] : [],
          assignedBy: userId
        };
      }

      // Handle completion timestamp
      if (updates.status === 'completed' && currentSubtask.status !== 'completed') {
        updates.completed_at = new Date();
        changes.completed_at = { from: null, to: updates.completed_at };
      } else if (updates.status !== 'completed' && currentSubtask.status === 'completed') {
        updates.completed_at = null;
        changes.completed_at = { from: currentSubtask.completed_at, to: null };
      }

      // Handle phase start and finish dates
      const statusChanged = updates.status && updates.status !== currentSubtask.status;
      if (statusChanged) {
        const oldStatus = currentSubtask.status;
        const newStatus = updates.status;
        
        // Set start_date when moving from 'pending' to any active status
        if (oldStatus === 'pending' && newStatus !== 'pending' && !currentSubtask.start_date) {
          updates.start_date = new Date();
          changes.start_date = { from: null, to: updates.start_date };
        }
        
        // Set finish_date when moving to completion statuses
        const completionStatuses = ['final', 'completed'];
        const wasNotCompleted = !completionStatuses.includes(oldStatus);
        const isNowCompleted = completionStatuses.includes(newStatus);
        
        if (wasNotCompleted && isNowCompleted && !currentSubtask.finish_date) {
          updates.finish_date = new Date();
          changes.finish_date = { from: null, to: updates.finish_date };
        }
        
        // Clear finish_date if moving away from completion status
        if (completionStatuses.includes(oldStatus) && !completionStatuses.includes(newStatus)) {
          updates.finish_date = null;
          changes.finish_date = { from: currentSubtask.finish_date, to: null };
        }
        
        // Track status history for detailed phase tracking
        changes.statusHistory = {
          oldStatus,
          newStatus,
          subtaskId
        };
      }

      if (Object.keys(updates).length === 0) {
        return currentSubtask; // No changes to make
      }

      const updatedSubtask = await transaction(async (client) => {
        // Build update query
        const setClause = Object.keys(updates)
          .map((field, index) => `${field} = $${index + 2}`)
          .join(', ');
        
        const values = [subtaskId, ...Object.values(updates)];

        const result = await client.query(`
          UPDATE course_subtasks 
          SET ${setClause}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
        `, values);

        const updated = result.rows[0];

        // Handle status history tracking
        if (changes.statusHistory) {
          const { oldStatus, newStatus } = changes.statusHistory;
          
          logger.info('Status transition detected', {
            subtaskId,
            oldStatus,
            newStatus,
            userId
          });
          
          // Define phase hierarchy for backward movement detection
          const phaseHierarchy = ['alpha_review', 'beta_review', 'final'];
          const oldIndex = phaseHierarchy.indexOf(oldStatus);
          const newIndex = phaseHierarchy.indexOf(newStatus);
          const isBackwardMovement = oldIndex > newIndex && oldIndex !== -1 && newIndex !== -1;
          
          logger.info('Phase transition analysis', {
            subtaskId,
            oldStatus,
            newStatus,
            oldIndex,
            newIndex,
            isBackwardMovement
          });
          
          // If moving backward, clear all future phase history entries
          if (isBackwardMovement) {
            const futurePhases = phaseHierarchy.slice(newIndex + 1);
            logger.info('Clearing future phase history', {
              subtaskId,
              futurePhases
            });
            
            for (const futurePhase of futurePhases) {
              const deleteResult = await client.query(`
                DELETE FROM phase_status_history 
                WHERE subtask_id = $1 AND status = $2
                RETURNING *
              `, [subtaskId, futurePhase]);
              
              if (deleteResult.rowCount > 0) {
                logger.info('Cleared future phase history', {
                  subtaskId,
                  clearedPhase: futurePhase,
                  deletedRecords: deleteResult.rows
                });
              }
            }
          }
          
          // Finish the previous status if it exists and is not pending
          if (oldStatus && oldStatus !== 'pending') {
            const updateResult = await client.query(`
              UPDATE phase_status_history 
              SET finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
              WHERE subtask_id = $1 AND status = $2 AND finished_at IS NULL
              RETURNING *
            `, [subtaskId, oldStatus]);
            
            logger.info('Finished previous status', {
              subtaskId,
              oldStatus,
              updatedRecords: updateResult.rowCount,
              finishedRecord: updateResult.rows[0]
            });
          }
          
          // Start or reactivate the new status if it's not pending
          if (newStatus && newStatus !== 'pending') {
            // First, check if this status already exists for this subtask
            const existingResult = await client.query(`
              SELECT * FROM phase_status_history 
              WHERE subtask_id = $1 AND status = $2
            `, [subtaskId, newStatus]);
            
            if (existingResult.rows.length > 0) {
              // Reactivate existing status by clearing finished_at and updating started_at
              const reactivateResult = await client.query(`
                UPDATE phase_status_history 
                SET finished_at = NULL, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE subtask_id = $1 AND status = $2
                RETURNING *
              `, [subtaskId, newStatus]);
              
              logger.info('Reactivated existing status', {
                subtaskId,
                newStatus,
                reactivatedRecord: reactivateResult.rows[0]
              });
            } else {
              // Create new status entry if it doesn't exist
              const insertResult = await client.query(`
                INSERT INTO phase_status_history (subtask_id, status, started_at, created_at, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
              `, [subtaskId, newStatus]);
              
              logger.info('Started new status', {
                subtaskId,
                newStatus,
                newRecord: insertResult.rows[0]
              });
            }
          }
        }

        // Handle assignment updates
        if (changes.assignmentUpdate) {
          const { newAssignedUserIds, assignedBy } = changes.assignmentUpdate;
          
          // Get current assignments
          const currentAssignmentsResult = await client.query(`
            SELECT user_id FROM subtask_assignments WHERE subtask_id = $1
          `, [subtaskId]);
          
          const currentUserIds = currentAssignmentsResult.rows.map(row => row.user_id);
          const newUserIds = newAssignedUserIds || [];
          
          // Find users to add and remove
          const usersToAdd = newUserIds.filter(uid => !currentUserIds.includes(uid));
          const usersToRemove = currentUserIds.filter(uid => !newUserIds.includes(uid));
          
          // Remove assignments
          if (usersToRemove.length > 0) {
            await client.query(`
              DELETE FROM subtask_assignments 
              WHERE subtask_id = $1 AND user_id = ANY($2)
            `, [subtaskId, usersToRemove]);
            
            logger.info('Removed user assignments', {
              subtaskId,
              removedUsers: usersToRemove,
              removedBy: assignedBy
            });
          }
          
          // Add new assignments
          for (const userIdToAdd of usersToAdd) {
            await client.query(`
              INSERT INTO subtask_assignments (subtask_id, user_id, assigned_by, assigned_at)
              VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            `, [subtaskId, userIdToAdd, assignedBy]);
          }
          
          if (usersToAdd.length > 0) {
            logger.info('Added user assignments', {
              subtaskId,
              addedUsers: usersToAdd,
              assignedBy
            });
          }
          
          changes.assignmentChanges = {
            added: usersToAdd,
            removed: usersToRemove,
            assignedBy
          };
        }

        // Log the update
        await client.query(`
          INSERT INTO audit_logs (
            user_id, entity_type, entity_id, action, changes, created_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
          userId,
          'subtask',
          subtaskId,
          'updated',
          JSON.stringify(changes)
        ]);

        return updated;
      });

      // Trigger status recalculation if significant changes occurred
      const significantChanges = ['status', 'is_blocking', 'weight'].some(field => 
        changes[field] !== undefined
      );

      if (significantChanges) {
        await this.statusAggregator.updateCourseStatus(courseId, { triggeredBy: userId });
      }

      logger.info('Subtask updated', {
        subtaskId,
        courseId,
        changes: Object.keys(changes),
        userId
      });

      return updatedSubtask;

    } catch (error) {
      logger.logError(error, {
        context: 'SubtaskService.updateSubtask',
        subtaskId,
        updateData,
        userId
      });
      throw error;
    }
  }

  /**
   * Delete a subtask
   */
  async deleteSubtask(subtaskId, userId) {
    try {
      const subtaskResult = await query(
        'SELECT course_id, title FROM course_subtasks WHERE id = $1',
        [subtaskId]
      );

      if (subtaskResult.rows.length === 0) {
        throw new NotFoundError(`Subtask ${subtaskId} not found`);
      }

      const { course_id: courseId, title } = subtaskResult.rows[0];

      await transaction(async (client) => {
        // Delete the subtask
        await client.query('DELETE FROM course_subtasks WHERE id = $1', [subtaskId]);

        // Log the deletion
        await client.query(`
          INSERT INTO audit_logs (
            user_id, entity_type, entity_id, action, changes, created_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
          userId,
          'subtask',
          subtaskId,
          'deleted',
          JSON.stringify({ courseId, title })
        ]);
      });

      // Trigger status recalculation
      await this.statusAggregator.updateCourseStatus(courseId, { triggeredBy: userId });

      logger.info('Subtask deleted', {
        subtaskId,
        courseId,
        title,
        userId
      });

      return { success: true, message: 'Subtask deleted successfully' };

    } catch (error) {
      logger.logError(error, {
        context: 'SubtaskService.deleteSubtask',
        subtaskId,
        userId
      });
      throw error;
    }
  }

  /**
   * Bulk update subtasks for a course
   */
  async bulkUpdateSubtasks(courseId, subtasks, userId) {
    try {
      // Validate course exists
      const courseCheck = await query('SELECT id FROM courses WHERE id = $1', [courseId]);
      if (courseCheck.rows.length === 0) {
        throw new NotFoundError(`Course ${courseId} not found`);
      }

      const results = [];
      const errors = [];

      await transaction(async (client) => {
        for (const subtaskUpdate of subtasks) {
          try {
            const { id, ...updateData } = subtaskUpdate;
            
            if (id) {
              // Update existing subtask
              const result = await this.updateSubtask(id, updateData, userId);
              results.push({ id, action: 'updated', data: result });
            } else {
              // Create new subtask
              const result = await this.createSubtask(courseId, updateData, userId);
              results.push({ id: result.id, action: 'created', data: result });
            }
          } catch (error) {
            errors.push({
              subtask: subtaskUpdate,
              error: error.message
            });
          }
        }
      });

      // Trigger single status recalculation for the course
      await this.statusAggregator.updateCourseStatus(courseId, { triggeredBy: userId });

      logger.info('Bulk subtask update completed', {
        courseId,
        totalSubtasks: subtasks.length,
        successful: results.length,
        failed: errors.length,
        userId
      });

      return { results, errors };

    } catch (error) {
      logger.logError(error, {
        context: 'SubtaskService.bulkUpdateSubtasks',
        courseId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get subtasks for a course
   */
  async getSubtasks(courseId, options = {}) {
    try {
      const { includeCompleted = true, orderBy = 'order_index' } = options;

      let whereClause = 'WHERE course_id = $1';
      const params = [courseId];

      if (!includeCompleted) {
        whereClause += ' AND status != $2';
        params.push('completed');
      }

      const orderClause = orderBy === 'order_index' 
        ? 'ORDER BY order_index ASC, created_at ASC'
        : 'ORDER BY created_at DESC';

      const result = await query(`
        SELECT 
          cs.id,
          cs.course_id,
          cs.title,
          cs.status,
          cs.is_blocking,
          cs.weight,
          cs.order_index,
          cs.completed_at,
          cs.start_date,
          cs.finish_date,
          cs.created_at,
          cs.updated_at
        FROM course_subtasks cs
        ${whereClause}
        ${orderClause}
      `, params);

      // Get status history and assignments for each subtask
      const subtasks = result.rows.map(subtask => {
        return {
          id: subtask.id,
          course_id: subtask.course_id,
          title: subtask.title,
          status: subtask.status,
          is_blocking: subtask.is_blocking,
          weight: subtask.weight,
          order_index: subtask.order_index,
          completed_at: subtask.completed_at,
          start_date: subtask.start_date,
          finish_date: subtask.finish_date,
          created_at: subtask.created_at,
          updated_at: subtask.updated_at
        };
      });

      for (const subtask of subtasks) {
        // Get status history
        const historyResult = await query(`
          SELECT id, status, started_at, finished_at
          FROM phase_status_history
          WHERE subtask_id = $1
          ORDER BY started_at ASC
        `, [subtask.id]);
        
        subtask.status_history = historyResult.rows;

        // Get assigned users
        const assignmentsResult = await query(`
          SELECT 
            sa.user_id,
            sa.assigned_at,
            sa.assigned_by,
            u.name as user_name,
            u.email as user_email,
            assigner.name as assigned_by_name
          FROM subtask_assignments sa
          JOIN users u ON sa.user_id = u.id
          LEFT JOIN users assigner ON sa.assigned_by = assigner.id
          WHERE sa.subtask_id = $1
          ORDER BY sa.assigned_at ASC
        `, [subtask.id]);

        subtask.assignedUsers = assignmentsResult.rows.map(assignment => ({
          id: assignment.user_id,
          name: assignment.user_name,
          email: assignment.user_email,
          assignedAt: assignment.assigned_at,
          assignedBy: assignment.assigned_by ? {
            id: assignment.assigned_by,
            name: assignment.assigned_by_name
          } : null
        }));

        // Backward compatibility: set assignedUser to first user if any
        subtask.assignedUser = subtask.assignedUsers.length > 0 ? subtask.assignedUsers[0] : null;
      }

      return subtasks;

    } catch (error) {
      logger.logError(error, {
        context: 'SubtaskService.getSubtasks',
        courseId,
        options
      });
      throw error;
    }
  }

  /**
   * Reorder subtasks for a course
   */
  async reorderSubtasks(courseId, orderedSubtaskIds, userId) {
    try {
      // Validate course exists
      const courseCheck = await query('SELECT id FROM courses WHERE id = $1', [courseId]);
      if (courseCheck.rows.length === 0) {
        throw new NotFoundError(`Course ${courseId} not found`);
      }

      await transaction(async (client) => {
        // Update order indices
        for (let i = 0; i < orderedSubtaskIds.length; i++) {
          await client.query(`
            UPDATE course_subtasks 
            SET order_index = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND course_id = $3
          `, [i + 1, orderedSubtaskIds[i], courseId]);
        }

        // Log the reordering
        await client.query(`
          INSERT INTO audit_logs (
            user_id, entity_type, entity_id, action, changes, created_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
          userId,
          'course',
          courseId,
          'subtasks_reordered',
          JSON.stringify({ newOrder: orderedSubtaskIds })
        ]);
      });

      logger.info('Subtasks reordered', {
        courseId,
        subtaskCount: orderedSubtaskIds.length,
        userId
      });

      return { success: true, message: 'Subtasks reordered successfully' };

    } catch (error) {
      logger.logError(error, {
        context: 'SubtaskService.reorderSubtasks',
        courseId,
        orderedSubtaskIds,
        userId
      });
      throw error;
    }
  }
}

module.exports = SubtaskService;