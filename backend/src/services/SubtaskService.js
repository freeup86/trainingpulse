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
        status = '', // Start with blank status
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
      
      // Debug logging for final_signoff_sent columns
      console.log('DEBUG: Current subtask final_signoff_sent columns:', {
        final_signoff_sent_start_date: currentSubtask.final_signoff_sent_start_date,
        final_signoff_sent_end_date: currentSubtask.final_signoff_sent_end_date,
        final_signoff_sent_date: currentSubtask.final_signoff_sent_date,
        status: currentSubtask.status
      });

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
      const statusChanged = updates.status !== undefined && updates.status !== currentSubtask.status;
      if (statusChanged) {
        const oldStatus = currentSubtask.status;
        const newStatus = updates.status;
        
        console.log('DEBUG: Status change detected', {
          subtaskId,
          oldStatus: `"${oldStatus}"`,
          newStatus: `"${newStatus}"`,
          oldStatusType: typeof oldStatus,
          newStatusType: typeof newStatus
        });
        
        // Special case: If changing to "No Status" (empty string), clear all dates immediately
        if (newStatus === '') {
          console.log('DEBUG: Clearing ALL dates because newStatus is empty string');
          
          // Clear basic dates
          updates.start_date = null;
          updates.finish_date = null;
          updates.completed_at = null;
          updates.final_start_date = null;
          updates.final_end_date = null;
          updates.final_revision_entered_date = null;
          updates.final_revision_end_date = null;
          updates.final_signoff_entered_date = null;
          changes.start_date = { from: currentSubtask.start_date, to: null };
          changes.finish_date = { from: currentSubtask.finish_date, to: null };
          changes.completed_at = { from: currentSubtask.completed_at, to: null };
          changes.final_start_date = { from: currentSubtask.final_start_date, to: null };
          changes.final_end_date = { from: currentSubtask.final_end_date, to: null };
          changes.final_revision_entered_date = { from: currentSubtask.final_revision_entered_date, to: null };
          changes.final_revision_end_date = { from: currentSubtask.final_revision_end_date, to: null };
          changes.final_signoff_entered_date = { from: currentSubtask.final_signoff_entered_date, to: null };
          
          // Clear all phase-specific dates
          const phaseStatusToColumns = {
            'alpha_draft': { start: 'alpha_draft_start_date', end: 'alpha_draft_end_date', completion: 'alpha_draft_date' },
            'alpha_review': { start: 'alpha_review_start_date', end: 'alpha_review_end_date', completion: 'alpha_review_date' },
            'beta_revision': { start: 'beta_revision_start_date', end: 'beta_revision_end_date', completion: 'beta_revision_date' },
            'beta_review': { start: 'beta_review_start_date', end: 'beta_review_end_date', completion: 'beta_review_date' },
            'final_revision': { start: 'final_revision_start_date', end: 'final_revision_end_date', completion: 'final_revision_date' },
            'final_signoff_sent': { start: 'final_signoff_sent_start_date', end: 'final_signoff_sent_end_date', completion: 'final_signoff_sent_date' },
            'final_signoff_received': { start: 'final_signoff_received_start_date', end: null, completion: 'final_signoff_received_date' }
          };
          
          // Clear all phase dates
          Object.values(phaseStatusToColumns).forEach(columns => {
            // Clear start date
            if (currentSubtask[columns.start]) {
              updates[columns.start] = null;
              changes[columns.start] = { from: currentSubtask[columns.start], to: null };
            }
            // Clear end date
            if (currentSubtask[columns.end]) {
              updates[columns.end] = null;
              changes[columns.end] = { from: currentSubtask[columns.end], to: null };
            }
            // Clear completion date
            if (currentSubtask[columns.completion]) {
              updates[columns.completion] = null;
              changes[columns.completion] = { from: currentSubtask[columns.completion], to: null };
            }
          });
        } else {
          // Set start_date when moving from 'pending' to any active status
          if (oldStatus === 'pending' && newStatus !== 'pending' && !currentSubtask.start_date) {
            updates.start_date = new Date();
            changes.start_date = { from: null, to: updates.start_date };
          }
          
          // Set finish_date when moving to completion statuses
          const completionStatuses = ['final_revision', 'final_signoff_sent', 'final_signoff_received', 'completed'];
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

          // Set specific phase start and end dates
          const phaseStatusToColumns = {
            'alpha_draft': { start: 'alpha_draft_start_date', end: 'alpha_draft_end_date', completion: 'alpha_draft_date' },
            'alpha_review': { start: 'alpha_review_start_date', end: 'alpha_review_end_date', completion: 'alpha_review_date' },
            'beta_revision': { start: 'beta_revision_start_date', end: 'beta_revision_end_date', completion: 'beta_revision_date' },
            'beta_review': { start: 'beta_review_start_date', end: 'beta_review_end_date', completion: 'beta_review_date' },
            'final_revision': { start: 'final_revision_start_date', end: 'final_revision_end_date', completion: 'final_revision_date' },
            'final_signoff_sent': { start: 'final_signoff_sent_start_date', end: 'final_signoff_sent_end_date', completion: 'final_signoff_sent_date' },
            'final_signoff_received': { start: 'final_signoff_received_start_date', end: null, completion: 'final_signoff_received_date' }
          };
          
          // Note: 'final_signoff' status doesn't have its own columns, it uses the generic final_start_date/final_end_date

          // When moving TO a phase status, set the start date (do this BEFORE backward movement clearing)
          if (phaseStatusToColumns[newStatus]) {
            const columns = phaseStatusToColumns[newStatus];
            // Always set the start date when entering a phase status
            updates[columns.start] = new Date();
            changes[columns.start] = { from: currentSubtask[columns.start], to: updates[columns.start] };
            
            // Also set the completion date for backwards compatibility
            updates[columns.completion] = new Date();
            changes[columns.completion] = { from: currentSubtask[columns.completion], to: updates[columns.completion] };
            
            // Clear the end date when re-entering a status
            if (columns.end) {
              updates[columns.end] = null;
              changes[columns.end] = { from: currentSubtask[columns.end], to: null };
            }
          }
          
          // Special handling for Final Start/End dates (for Final Revision and Final Signoff tracking)
          // This is OUTSIDE the phaseStatusToColumns check so it works for all statuses
          // Only 'final_signoff' should set the final_signoff_entered_date
          // 'final_signoff_sent' and 'final_signoff_received' are separate statuses that shouldn't set this date
          const isAnyFinalSignoff = (newStatus === 'final_signoff' || newStatus === 'final_signoff_sent' || newStatus === 'final_signoff_received');
          const wasAnyFinalSignoff = (oldStatus === 'final_signoff' || oldStatus === 'final_signoff_sent' || oldStatus === 'final_signoff_received');
          
          console.log('DEBUG: Final date check', {
            newStatus,
            oldStatus,
            isAnyFinalSignoff,
            wasAnyFinalSignoff,
            isFinalRevision: newStatus === 'final_revision',
            currentRevisionDate: currentSubtask.final_revision_entered_date,
            currentSignoffDate: currentSubtask.final_signoff_entered_date,
            currentFinalStartDate: currentSubtask.final_start_date,
            currentFinalEndDate: currentSubtask.final_end_date
          });
          
          // Handle Final Revision and Final Signoff dates
          if (newStatus === 'final_revision') {
            // Entering Final Revision - always update the revision entered date
            updates.final_revision_entered_date = new Date();
            changes.final_revision_entered_date = { from: currentSubtask.final_revision_entered_date, to: updates.final_revision_entered_date };
            
            // Clear revision end date when re-entering revision
            updates.final_revision_end_date = null;
            changes.final_revision_end_date = { from: currentSubtask.final_revision_end_date, to: null };
            
            // Clear only final_signoff_sent dates when entering final_revision
            updates.final_signoff_sent_start_date = null;
            updates.final_signoff_sent_end_date = null;
            updates.final_signoff_sent_date = null;
            changes.final_signoff_sent_start_date = { from: currentSubtask.final_signoff_sent_start_date, to: null };
            changes.final_signoff_sent_end_date = { from: currentSubtask.final_signoff_sent_end_date, to: null };
            changes.final_signoff_sent_date = { from: currentSubtask.final_signoff_sent_date, to: null };
            
            // If coming forward from final_signoff, set end date for signoff and preserve signoff dates
            if (oldStatus === 'final_signoff') {
              // Moving forward from final_signoff to revision - set signoff end date
              updates.final_end_date = new Date();
              changes.final_end_date = { from: currentSubtask.final_end_date, to: updates.final_end_date };
              console.log('DEBUG: Setting final_end_date (signoff end) when moving forward from final_signoff to revision');
              // Keep final_signoff_entered_date intact - don't clear it
            }
            
            console.log('DEBUG: Set final_revision_entered_date for final_revision');
          } else if (newStatus === 'final_signoff') {
            // Only 'final_signoff' sets the signoff entered date
            // Not 'final_signoff_sent' or 'final_signoff_received'
            updates.final_signoff_entered_date = new Date();
            changes.final_signoff_entered_date = { from: currentSubtask.final_signoff_entered_date, to: updates.final_signoff_entered_date };
            
            // Clear signoff end date when re-entering signoff
            updates.final_end_date = null;
            changes.final_end_date = { from: currentSubtask.final_end_date, to: null };
            
            // Note: Moving from final_revision to final_signoff is backward movement
            // The backward movement logic will handle clearing revision dates
            
            console.log('DEBUG: Setting final_signoff_entered_date for final_signoff status');
          } else if (isAnyFinalSignoff) {
            // For final_signoff_sent and final_signoff_received, don't set the signoff entered date
            console.log('DEBUG: Not setting final_signoff_entered_date for status:', newStatus);
            
            // When moving from revision to signoff, only set revision end date
            // Don't clear final_end_date as it tracks when signoff period ended previously
            if (oldStatus === 'final_revision') {
              // Moving from revision to signoff - set revision end date
              // Keep final_end_date intact as it represents when signoff previously ended
              
              // Set revision end date
              if (currentSubtask.final_revision_entered_date) {
                updates.final_revision_end_date = new Date();
                changes.final_revision_end_date = { from: currentSubtask.final_revision_end_date, to: updates.final_revision_end_date };
                console.log('DEBUG: Setting final_revision_end_date when moving from revision to signoff, preserving final_end_date');
              }
            }
            // When moving between signoff statuses, preserve everything
            else if (wasAnyFinalSignoff) {
              console.log('DEBUG: Moving between signoff statuses - preserving all dates');
              // Don't modify final_end_date or final_signoff_entered_date
            }
            
            console.log('DEBUG: Final signoff status:', newStatus, 'wasAnyFinalSignoff:', wasAnyFinalSignoff);
          }
          
          // Clear final dates if moving to a status before final_revision
          const finalPhases = ['final_revision', 'final_signoff', 'final_signoff_sent', 'final_signoff_received'];
          if (!finalPhases.includes(newStatus)) {
            if (currentSubtask.final_start_date || currentSubtask.final_end_date || 
                currentSubtask.final_revision_entered_date || currentSubtask.final_revision_end_date ||
                currentSubtask.final_signoff_entered_date) {
              updates.final_start_date = null;
              updates.final_end_date = null;
              updates.final_revision_entered_date = null;
              updates.final_revision_end_date = null;
              updates.final_signoff_entered_date = null;
              changes.final_start_date = { from: currentSubtask.final_start_date, to: null };
              changes.final_end_date = { from: currentSubtask.final_end_date, to: null };
              changes.final_revision_entered_date = { from: currentSubtask.final_revision_entered_date, to: null };
              changes.final_revision_end_date = { from: currentSubtask.final_revision_end_date, to: null };
              changes.final_signoff_entered_date = { from: currentSubtask.final_signoff_entered_date, to: null };
              console.log('DEBUG: Clearing all final dates when moving before final phases');
            }
          }

          // When moving FROM a phase status, set the end date for the previous phase (if it has an end date)
          if (oldStatus && phaseStatusToColumns[oldStatus] && oldStatus !== newStatus) {
            const oldColumns = phaseStatusToColumns[oldStatus];
            if (oldColumns.end && !currentSubtask[oldColumns.end]) {
              updates[oldColumns.end] = new Date();
              changes[oldColumns.end] = { from: null, to: updates[oldColumns.end] };
            }
          }

          // Clear future phase dates when moving backward in the workflow
          // This MUST happen BEFORE setting dates for the new status
          const phaseOrder = ['alpha_draft', 'alpha_review', 'beta_revision', 'beta_review', 'final_signoff', 'final_revision', 'final_signoff_sent', 'final_signoff_received'];
          const currentPhaseIndex = phaseOrder.indexOf(newStatus);
          const oldPhaseIndex = phaseOrder.indexOf(oldStatus);
          
          if (currentPhaseIndex >= 0 && currentPhaseIndex < oldPhaseIndex) {
            // Moving backward - clear all future phase dates (start, end, and completion)
            console.log('DEBUG: Backward movement detected from', oldStatus, '(index', oldPhaseIndex, ') to', newStatus, '(index', currentPhaseIndex, ')');
            console.log('DEBUG: Will clear dates for phases after', newStatus, ':', phaseOrder.slice(currentPhaseIndex + 1));
            console.log('DEBUG: Starting to process future phases for clearing');
            
            for (let i = currentPhaseIndex + 1; i < phaseOrder.length; i++) {
              const futurePhase = phaseOrder[i];
              console.log('DEBUG: Checking if should clear dates for phase:', futurePhase);
              
              // Skip clearing if this is a final_signoff_sent/received and we're moving TO final_signoff_sent
              if (futurePhase === 'final_signoff_sent' && newStatus === 'final_signoff_sent') {
                console.log('DEBUG: Skipping clear for final_signoff_sent since we are moving TO it');
                continue;
              }
              if (futurePhase === 'final_signoff_received' && newStatus === 'final_signoff_received') {
                console.log('DEBUG: Skipping clear for final_signoff_received since we are moving TO it');
                continue;
              }
              
              console.log('DEBUG: Clearing dates for phase:', futurePhase);
              
              // Handle special Final phase dates
              if (futurePhase === 'final_revision') {
                // Clear Final Revision dates
                if (currentSubtask.final_revision_entered_date) {
                  updates.final_revision_entered_date = null;
                  changes.final_revision_entered_date = { from: currentSubtask.final_revision_entered_date, to: null };
                }
                if (currentSubtask.final_revision_end_date) {
                  updates.final_revision_end_date = null;
                  changes.final_revision_end_date = { from: currentSubtask.final_revision_end_date, to: null };
                }
              } else if (futurePhase === 'final_signoff') {
                // Clear Final Signoff dates
                if (currentSubtask.final_signoff_entered_date) {
                  updates.final_signoff_entered_date = null;
                  changes.final_signoff_entered_date = { from: currentSubtask.final_signoff_entered_date, to: null };
                }
                if (currentSubtask.final_end_date) {
                  updates.final_end_date = null;
                  changes.final_end_date = { from: currentSubtask.final_end_date, to: null };
                }
              } else if (futurePhase === 'final_signoff_sent') {
                console.log('DEBUG: Clearing final_signoff_sent columns');
                console.log('DEBUG: Current values:', {
                  start: currentSubtask.final_signoff_sent_start_date,
                  end: currentSubtask.final_signoff_sent_end_date,
                  date: currentSubtask.final_signoff_sent_date
                });
                
                // Always clear these dates when moving backward past final_signoff_sent
                updates.final_signoff_sent_start_date = null;
                changes.final_signoff_sent_start_date = { from: currentSubtask.final_signoff_sent_start_date, to: null };
                console.log('DEBUG: Set updates.final_signoff_sent_start_date = null');
                
                updates.final_signoff_sent_end_date = null;
                changes.final_signoff_sent_end_date = { from: currentSubtask.final_signoff_sent_end_date, to: null };
                console.log('DEBUG: Set updates.final_signoff_sent_end_date = null');
                
                updates.final_signoff_sent_date = null;
                changes.final_signoff_sent_date = { from: currentSubtask.final_signoff_sent_date, to: null };
                console.log('DEBUG: Set updates.final_signoff_sent_date = null');
              } else if (futurePhase === 'final_signoff_received') {
                console.log('DEBUG: Clearing final_signoff_received columns');
                // Clear received dates using phaseStatusToColumns
                const receivedColumns = phaseStatusToColumns['final_signoff_received'];
                if (receivedColumns) {
                  if (receivedColumns.start && currentSubtask[receivedColumns.start]) {
                    updates[receivedColumns.start] = null;
                    changes[receivedColumns.start] = { from: currentSubtask[receivedColumns.start], to: null };
                  }
                  if (receivedColumns.completion && currentSubtask[receivedColumns.completion]) {
                    updates[receivedColumns.completion] = null;
                    changes[receivedColumns.completion] = { from: currentSubtask[receivedColumns.completion], to: null };
                  }
                }
              } else {
                // Handle other phases through phaseStatusToColumns
                const futureColumns = phaseStatusToColumns[futurePhase];
                console.log('DEBUG: Processing regular phase:', futurePhase, 'columns:', futureColumns);
                if (futureColumns) {
                  // Clear start date
                  if (futureColumns.start) {
                    console.log('DEBUG: Clearing', futureColumns.start, 'current value:', currentSubtask[futureColumns.start], 'updates value before:', updates[futureColumns.start]);
                    updates[futureColumns.start] = null;
                    changes[futureColumns.start] = { from: currentSubtask[futureColumns.start], to: null };
                  }
                  // Clear end date
                  if (futureColumns.end) {
                    console.log('DEBUG: Clearing', futureColumns.end, 'current value:', currentSubtask[futureColumns.end], 'updates value before:', updates[futureColumns.end]);
                    updates[futureColumns.end] = null;
                    changes[futureColumns.end] = { from: currentSubtask[futureColumns.end], to: null };
                  }
                  // Clear completion date
                  if (futureColumns.completion) {
                    console.log('DEBUG: Clearing', futureColumns.completion, 'current value:', currentSubtask[futureColumns.completion], 'updates value before:', updates[futureColumns.completion]);
                    updates[futureColumns.completion] = null;
                    changes[futureColumns.completion] = { from: currentSubtask[futureColumns.completion], to: null };
                  }
                }
              }
            }
            console.log('DEBUG: Completed backward movement clearing from', oldStatus, 'to', newStatus);
            console.log('DEBUG: All date updates after clearing:', Object.keys(updates).filter(k => k.includes('date')).reduce((obj, k) => ({ ...obj, [k]: updates[k] }), {}));
            
            // Now re-set the dates for the status we're moving TO (since backward clearing might have removed them)
            if (phaseStatusToColumns[newStatus]) {
              const columns = phaseStatusToColumns[newStatus];
              console.log('DEBUG: Re-setting dates for target status:', newStatus);
              
              // Always set the start date when entering a phase status after backward movement
              updates[columns.start] = new Date();
              changes[columns.start] = { from: currentSubtask[columns.start], to: updates[columns.start] };
              
              // Also set the completion date for backwards compatibility
              updates[columns.completion] = new Date();
              changes[columns.completion] = { from: currentSubtask[columns.completion], to: updates[columns.completion] };
              
              // Clear the end date when re-entering a status
              if (columns.end) {
                updates[columns.end] = null;
                changes[columns.end] = { from: currentSubtask[columns.end], to: null };
              }
            }
          }
        }
        
        // Track status history for detailed phase tracking
        changes.statusHistory = {
          oldStatus,
          newStatus,
          subtaskId
        };
      }

      if (Object.keys(updates).length === 0 && !changes.assignmentUpdate) {
        return currentSubtask; // No changes to make
      }

      const updatedSubtask = await transaction(async (client) => {
        let updated;
        
        // Only run SQL update if there are field updates
        if (Object.keys(updates).length > 0) {
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

          updated = result.rows[0];
        } else {
          // No field updates, just get current subtask and update timestamp
          const result = await client.query(`
            UPDATE course_subtasks 
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
          `, [subtaskId]);

          updated = result.rows[0];
        }

        // Handle status history tracking
        if (changes.statusHistory) {
          const { oldStatus, newStatus } = changes.statusHistory;
          
          logger.info('Status transition detected', {
            subtaskId,
            oldStatus,
            newStatus,
            userId
          });
          
          // Special case: If changing to "No Status" (empty string), clear all phase status history and dates
          if (newStatus === '') {
            console.log('DEBUG: Clearing all phase status history and dates for subtask', subtaskId);
            
            // Clear all phase status history
            const clearResult = await client.query(`
              DELETE FROM phase_status_history 
              WHERE subtask_id = $1
              RETURNING *
            `, [subtaskId]);
            
            console.log('DEBUG: Cleared phase status history records:', clearResult.rows);
            
            // Clear all phase dates on the subtask itself
            const clearDatesResult = await client.query(`
              UPDATE course_subtasks 
              SET start_date = NULL, finish_date = NULL, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
              RETURNING *
            `, [subtaskId]);
            
            console.log('DEBUG: Cleared phase dates on subtask:', clearDatesResult.rows[0]);
            
            logger.info('Cleared all phase status history and dates for No Status', {
              subtaskId,
              oldStatus,
              deletedRecords: clearResult.rows.length,
              deletedEntries: clearResult.rows,
              clearedDates: {
                start_date: clearDatesResult.rows[0]?.start_date,
                finish_date: clearDatesResult.rows[0]?.finish_date,
                completed_at: clearDatesResult.rows[0]?.completed_at
              }
            });
            
            return; // Exit early, no need to process further status logic
          }
          
          // Define phase hierarchy for backward movement detection
          const phaseHierarchy = ['alpha_review', 'beta_review', 'final_revision', 'final_signoff_received'];
          const oldIndex = phaseHierarchy.indexOf(oldStatus);
          const newIndex = phaseHierarchy.indexOf(newStatus);
          const isBackwardMovement = oldIndex > newIndex && oldIndex !== -1 && newIndex !== -1;
          
          // Special handling for Final Signoff status
          if (newStatus === 'final_signoff_received' && oldStatus === 'final_revision') {
            console.log('DEBUG: Moving to Final Signoff - setting final end date and final signoff date');
            
            // Set the finish date for the Final (Gold) phase in phase_status_history
            await client.query(`
              UPDATE phase_status_history 
              SET finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
              WHERE subtask_id = $1 AND status = 'final_revision' AND finished_at IS NULL
            `, [subtaskId]);
            
            // Set the finish_date on the subtask itself (this represents Final Gold completion)
            updates.finish_date = new Date();
            changes.finish_date = { from: currentSubtask.finish_date, to: updates.finish_date };
            
            logger.info('Set Final Gold completion dates for Final Signoff transition', {
              subtaskId,
              finalGoldFinishDate: updates.finish_date
            });
          }
          
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
            const deleteResult = await client.query(`
              DELETE FROM subtask_assignments 
              WHERE subtask_id = $1 AND user_id = ANY($2)
              RETURNING *
            `, [subtaskId, usersToRemove]);
            
            
            logger.info('Removed user assignments', {
              subtaskId,
              removedUsers: usersToRemove,
              removedBy: assignedBy
            });
          }
          
          // Add new assignments
          for (const userIdToAdd of usersToAdd) {
            const insertResult = await client.query(`
              INSERT INTO subtask_assignments (subtask_id, user_id, assigned_by, assigned_at)
              VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
              RETURNING *
            `, [subtaskId, userIdToAdd, assignedBy]);
            
          }
          
          if (usersToAdd.length > 0) {
            logger.info('Added user assignments', {
              subtaskId,
              addedUsers: usersToAdd,
              assignedBy
            });
          }
          
          // Verify final assignments
          const finalAssignmentsResult = await client.query(`
            SELECT user_id FROM subtask_assignments WHERE subtask_id = $1
          `, [subtaskId]);
          
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

      // If assignments were updated, fetch the current assignments to include in response
      if (changes.assignmentUpdate) {
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
        `, [subtaskId]);

        updatedSubtask.assignedUsers = assignmentsResult.rows.map(assignment => ({
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
        updatedSubtask.assignedUser = updatedSubtask.assignedUsers.length > 0 ? updatedSubtask.assignedUsers[0] : null;
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
          cs.alpha_draft_date,
          cs.alpha_review_date,
          cs.beta_revision_date,
          cs.beta_review_date,
          cs.final_revision_date,
          cs.final_signoff_sent_date,
          cs.final_signoff_received_date,
          cs.alpha_draft_start_date,
          cs.alpha_review_start_date,
          cs.beta_revision_start_date,
          cs.beta_review_start_date,
          cs.final_revision_start_date,
          cs.final_signoff_sent_start_date,
          cs.final_signoff_received_start_date,
          cs.alpha_draft_end_date,
          cs.alpha_review_end_date,
          cs.beta_revision_end_date,
          cs.beta_review_end_date,
          cs.final_revision_end_date,
          cs.final_signoff_sent_end_date,
          cs.final_start_date,
          cs.final_end_date,
          cs.final_revision_entered_date,
          cs.final_revision_end_date,
          cs.final_signoff_entered_date,
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
          alpha_draft_date: subtask.alpha_draft_date,
          alpha_review_date: subtask.alpha_review_date,
          beta_revision_date: subtask.beta_revision_date,
          beta_review_date: subtask.beta_review_date,
          final_revision_date: subtask.final_revision_date,
          final_signoff_sent_date: subtask.final_signoff_sent_date,
          final_signoff_received_date: subtask.final_signoff_received_date,
          alpha_draft_start_date: subtask.alpha_draft_start_date,
          alpha_review_start_date: subtask.alpha_review_start_date,
          beta_revision_start_date: subtask.beta_revision_start_date,
          beta_review_start_date: subtask.beta_review_start_date,
          final_revision_start_date: subtask.final_revision_start_date,
          final_signoff_sent_start_date: subtask.final_signoff_sent_start_date,
          final_signoff_received_start_date: subtask.final_signoff_received_start_date,
          alpha_draft_end_date: subtask.alpha_draft_end_date,
          alpha_review_end_date: subtask.alpha_review_end_date,
          beta_revision_end_date: subtask.beta_revision_end_date,
          beta_review_end_date: subtask.beta_review_end_date,
          final_revision_end_date: subtask.final_revision_end_date,
          final_signoff_sent_end_date: subtask.final_signoff_sent_end_date,
          final_start_date: subtask.final_start_date,
          final_end_date: subtask.final_end_date,
          final_revision_entered_date: subtask.final_revision_entered_date,
          final_revision_end_date: subtask.final_revision_end_date,
          final_signoff_entered_date: subtask.final_signoff_entered_date,
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