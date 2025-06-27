const { query, transaction } = require('../config/database');
const { publish } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Smart Status Aggregation Service
 * Automatically calculates course status from subtask completion
 * Handles course-type specific rules and workflow states
 */
class StatusAggregator {
  constructor() {
    this.statusRules = this.initializeStatusRules();
  }

  /**
   * Initialize status calculation rules by course type
   */
  initializeStatusRules() {
    return {
      standard: {
        planning: { threshold: 0, requiresBlocking: false },
        content_development: { threshold: 20, requiresBlocking: true },
        sme_review: { threshold: 70, requiresBlocking: true },
        instructional_review: { threshold: 85, requiresBlocking: true },
        final_approval: { threshold: 95, requiresBlocking: true },
        published: { threshold: 100, requiresBlocking: true },
        on_hold: { threshold: 0, requiresBlocking: false }
      },
      compliance: {
        planning: { threshold: 0, requiresBlocking: false },
        content_development: { threshold: 15, requiresBlocking: true },
        legal_review: { threshold: 60, requiresBlocking: true },
        compliance_review: { threshold: 80, requiresBlocking: true },
        final_approval: { threshold: 95, requiresBlocking: true },
        published: { threshold: 100, requiresBlocking: true }
      },
      certification: {
        planning: { threshold: 0, requiresBlocking: false },
        content_development: { threshold: 25, requiresBlocking: true },
        sme_review: { threshold: 70, requiresBlocking: true },
        final_approval: { threshold: 90, requiresBlocking: true },
        published: { threshold: 100, requiresBlocking: true }
      }
    };
  }

  /**
   * Calculate course completion percentage from subtasks
   */
  async calculateCompletionPercentage(courseId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_subtasks,
          SUM(COALESCE(mt.weight_percentage, 100)) as total_weight_percentage,
          SUM(
            COALESCE(mt.weight_percentage, 100) * COALESCE(ps.completion_percentage, 0) / 100.0
          ) as weighted_completion_points,
          COUNT(CASE WHEN cs.status = 'final_signoff_received' THEN 1 END) as final_signoff_count,
          COUNT(CASE WHEN cs.is_blocking = true AND cs.status NOT IN ('completed', 'final_signoff_received') THEN 1 END) as blocking_incomplete
        FROM course_subtasks cs
        LEFT JOIN courses c ON cs.course_id = c.id
        LEFT JOIN modality_tasks mt ON c.modality = mt.modality AND cs.task_type = mt.task_type
        LEFT JOIN phase_statuses ps ON cs.status = ps.value
        WHERE cs.course_id = $1
      `, [courseId]);

      const stats = result.rows[0];
      
      if (stats.total_subtasks === 0) {
        return {
          percentage: 0,
          totalSubtasks: 0,
          completedSubtasks: 0,
          hasBlockingIncomplete: false,
          calculationMethod: 'no_subtasks'
        };
      }

      // Use weighted percentage-based calculation based on modality task weights and phase status completion percentages
      const totalWeightPercentage = Number(stats.total_weight_percentage || 0);
      const weightedCompletionPoints = Number(stats.weighted_completion_points || 0);
      const percentage = totalWeightPercentage > 0 ? Math.round((weightedCompletionPoints / totalWeightPercentage) * 100) : 0;
      const calculationMethod = 'weighted_percentage_based';

      console.log('DEBUG: Weighted completion percentage calculation', {
        courseId,
        totalSubtasks: stats.total_subtasks,
        totalWeightPercentage,
        weightedCompletionPoints,
        percentage,
        finalSignoffCount: stats.final_signoff_count,
        stats
      });

      return {
        percentage: isNaN(percentage) ? 0 : Math.min(percentage, 100),
        totalSubtasks: parseInt(stats.total_subtasks || 0),
        completedSubtasks: parseInt(stats.final_signoff_count || 0), // Only count final signoff as truly completed
        hasBlockingIncomplete: parseInt(stats.blocking_incomplete || 0) > 0,
        calculationMethod,
        totalWeightPercentage: totalWeightPercentage,
        weightedCompletionPoints: weightedCompletionPoints,
        totalCompletionPoints: weightedCompletionPoints,
        totalPossiblePoints: totalWeightPercentage
      };

    } catch (error) {
      logger.logError(error, {
        context: 'StatusAggregator.calculateCompletionPercentage',
        courseId
      });
      throw error;
    }
  }

  /**
   * Determine course status based on completion percentage and workflow state
   */
  async calculateCourseStatus(courseId) {
    try {
      // Get course details and current workflow state
      const courseResult = await query(`
        SELECT 
          c.id,
          c.type,
          c.status as manual_status,
          c.due_date,
          wi.current_state as workflow_state,
          wt.name as workflow_template_name
        FROM courses c
        LEFT JOIN workflow_instances wi ON c.id = wi.course_id AND wi.is_complete = false
        LEFT JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
        WHERE c.id = $1
      `, [courseId]);

      if (courseResult.rows.length === 0) {
        throw new Error(`Course ${courseId} not found`);
      }

      const course = courseResult.rows[0];
      const completionData = await this.calculateCompletionPercentage(courseId);
      
      // Check if course is overdue
      const isOverdue = course.due_date && new Date(course.due_date) < new Date();
      
      // Calculate intelligent status
      const intelligentStatus = this.determineIntelligentStatus(
        course,
        completionData,
        isOverdue
      );

      return {
        courseId: parseInt(courseId),
        courseType: course.type,
        manualStatus: course.manual_status,
        workflowState: course.workflow_state,
        workflowTemplate: course.workflow_template_name,
        calculatedStatus: intelligentStatus.status,
        completionPercentage: completionData.percentage,
        isOverdue,
        hasBlockingIncomplete: completionData.hasBlockingIncomplete,
        statusReason: intelligentStatus.reason,
        recommendations: intelligentStatus.recommendations,
        completionData
      };

    } catch (error) {
      logger.logError(error, {
        context: 'StatusAggregator.calculateCourseStatus',
        courseId
      });
      throw error;
    }
  }

  /**
   * Determine intelligent status based on multiple factors
   */
  determineIntelligentStatus(course, completionData, isOverdue) {
    const { percentage, hasBlockingIncomplete } = completionData;
    const { workflow_state: workflowState, type: courseType } = course;
    
    const recommendations = [];
    let status, reason;

    // Handle overdue courses
    if (isOverdue && percentage < 100) {
      status = 'overdue';
      reason = 'Course has passed its due date';
      recommendations.push('Immediate attention required - course is overdue');
    }
    // Handle courses with blocking incomplete tasks
    else if (hasBlockingIncomplete && percentage > 0) {
      status = 'blocked';
      reason = 'Blocking tasks are preventing progress';
      recommendations.push('Complete blocking tasks to proceed');
    }
    // Handle workflow-based status determination
    else if (workflowState) {
      const statusMapping = this.getWorkflowStatusMapping(workflowState, courseType);
      status = statusMapping.status;
      reason = statusMapping.reason;
      
      // Add recommendations based on workflow state
      if (workflowState === 'planning' && percentage === 0) {
        recommendations.push('Define learning objectives and create course outline');
      } else if (workflowState === 'content_development' && percentage < 50) {
        recommendations.push('Focus on content development to reach review stage');
      } else if (workflowState.includes('review') && percentage > 80) {
        recommendations.push('Course ready for review - assign reviewers');
      }
    }
    // Default completion-based status
    else {
      if (percentage === 0) {
        status = 'not_started';
        reason = 'No progress made on course';
      } else if (percentage < 25) {
        status = 'planning';
        reason = 'Initial planning phase';
      } else if (percentage < 75) {
        status = 'in_progress';
        reason = 'Active development in progress';
      } else if (percentage < 100) {
        status = 'review';
        reason = 'Near completion, ready for review';
      } else {
        status = 'completed';
        reason = 'All tasks completed';
      }
    }

    // Add general recommendations based on completion percentage
    if (percentage > 75 && !isOverdue) {
      recommendations.push('Course is progressing well - on track for completion');
    } else if (percentage < 25) {
      recommendations.push('Consider reviewing task breakdown and assignments');
    }

    return { status, reason, recommendations };
  }

  /**
   * Get the next status in the automatic progression sequence
   */
  getNextStatus(currentStatus) {
    const statusProgression = {
      'pre_development': 'outlines',
      'outlines': 'storyboard', 
      'storyboard': 'development',
      'development': 'completed'
    };
    
    return statusProgression[currentStatus] || null;
  }

  /**
   * Map workflow states to intelligent status
   */
  getWorkflowStatusMapping(workflowState, courseType) {
    const mappings = {
      planning: { status: 'planning', reason: 'Course in planning phase' },
      content_development: { status: 'in_progress', reason: 'Content development in progress' },
      sme_review: { status: 'review', reason: 'Under subject matter expert review' },
      instructional_review: { status: 'review', reason: 'Under instructional design review' },
      legal_review: { status: 'review', reason: 'Under legal review' },
      compliance_review: { status: 'review', reason: 'Under compliance review' },
      final_approval: { status: 'approval', reason: 'Awaiting final approval' },
      published: { status: 'completed', reason: 'Course published and complete' },
      on_hold: { status: 'on_hold', reason: 'Course development on hold' }
    };

    return mappings[workflowState] || { 
      status: 'unknown', 
      reason: `Unknown workflow state: ${workflowState}` 
    };
  }

  /**
   * Update course status in database and emit events
   */
  async updateCourseStatus(courseId, options = {}) {
    try {
      const { 
        forceUpdate = false, 
        skipEventEmission = false,
        triggeredBy = null 
      } = options;

      const statusData = await this.calculateCourseStatus(courseId);
      const { calculatedStatus, completionPercentage } = statusData;

      // Get current values to check if update is needed
      const currentResult = await query(
        'SELECT calculated_status, completion_percentage FROM courses WHERE id = $1',
        [courseId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Course ${courseId} not found`);
      }

      const current = currentResult.rows[0];
      const statusChanged = current.calculated_status !== calculatedStatus;
      const percentageChanged = current.completion_percentage !== completionPercentage;

      // Check for automatic status progression when completion reaches 100%
      let automaticStatusChange = null;
      console.log('DEBUG: Checking automatic status progression', {
        courseId,
        completionPercentage,
        shouldTrigger: completionPercentage === 100
      });
      
      if (completionPercentage === 100) {
        const courseResult = await query('SELECT status FROM courses WHERE id = $1', [courseId]);
        if (courseResult.rows.length > 0) {
          const currentStatus = courseResult.rows[0].status;
          const nextStatus = this.getNextStatus(currentStatus);
          
          console.log('DEBUG: Status progression check', {
            courseId,
            currentStatus,
            nextStatus,
            canProgress: nextStatus && nextStatus !== currentStatus
          });
          
          if (nextStatus && nextStatus !== currentStatus) {
            automaticStatusChange = {
              from: currentStatus,
              to: nextStatus
            };
            console.log('DEBUG: Automatic status progression will occur', automaticStatusChange);
          } else {
            console.log('DEBUG: No automatic status progression needed', {
              currentStatus,
              nextStatus,
              reason: !nextStatus ? 'No next status defined' : 'Already at target status'
            });
          }
        }
      }

      // Update only if there are changes or forced
      if (forceUpdate || statusChanged || percentageChanged || automaticStatusChange) {
        await transaction(async (client) => {
          // Prepare update query
          let updateQuery = `
            UPDATE courses 
            SET 
              calculated_status = $1,
              completion_percentage = $2,
              updated_at = CURRENT_TIMESTAMP`;
          let updateParams = [calculatedStatus, completionPercentage];
          
          // Add automatic status progression if needed
          if (automaticStatusChange) {
            updateQuery += `, status = $${updateParams.length + 1}`;
            updateParams.push(automaticStatusChange.to);
            
            logger.info('Automatic status progression triggered', {
              courseId,
              fromStatus: automaticStatusChange.from,
              toStatus: automaticStatusChange.to,
              completionPercentage,
              triggeredBy
            });
            
            // Archive current phase data before resetting
            await this.archivePhaseData(client, courseId, automaticStatusChange.from, triggeredBy);
            
            // Reset all phase statuses and dates for the new course status
            await this.resetPhaseData(client, courseId);
          }
          
          updateQuery += ` WHERE id = $${updateParams.length + 1}`;
          updateParams.push(courseId);
          
          // Execute the update
          await client.query(updateQuery, updateParams);

          // Log the status change in audit table
          if (statusChanged || percentageChanged || automaticStatusChange) {
            const auditChanges = {
              previous: {
                calculated_status: current.calculated_status,
                percentage: current.completion_percentage
              },
              new: {
                calculated_status: calculatedStatus,
                percentage: completionPercentage
              },
              reason: statusData.statusReason,
              method: 'automatic_aggregation'
            };
            
            // Add automatic status progression info if it occurred
            if (automaticStatusChange) {
              auditChanges.automaticStatusProgression = automaticStatusChange;
              auditChanges.method = 'automatic_progression_on_completion';
            }
            
            await client.query(`
              INSERT INTO audit_logs (
                user_id, entity_type, entity_id, action, changes, created_at
              ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [
              triggeredBy,
              'course',
              courseId,
              automaticStatusChange ? 'status_auto_progressed' : 'status_updated',
              JSON.stringify(auditChanges)
            ]);
          }
        });

        // Emit status change event for real-time updates
        if (!skipEventEmission) {
          await this.emitStatusChangeEvent(courseId, statusData, {
            statusChanged,
            percentageChanged,
            automaticStatusChange,
            previous: {
              status: current.calculated_status,
              percentage: current.completion_percentage
            }
          });
        }

        const logMessage = automaticStatusChange 
          ? 'Course status automatically progressed'
          : 'Course status updated';
          
        const logData = {
          courseId,
          previousStatus: current.calculated_status,
          newStatus: calculatedStatus,
          previousPercentage: current.completion_percentage,
          newPercentage: completionPercentage,
          triggeredBy
        };
        
        if (automaticStatusChange) {
          logData.automaticProgression = automaticStatusChange;
        }
        
        logger.info(logMessage, logData);
      }

      return statusData;

    } catch (error) {
      logger.logError(error, {
        context: 'StatusAggregator.updateCourseStatus',
        courseId,
        options
      });
      throw error;
    }
  }

  /**
   * Emit status change event for real-time notifications
   */
  async emitStatusChangeEvent(courseId, statusData, changeInfo) {
    try {
      const eventData = {
        eventType: 'course_status_changed',
        courseId,
        timestamp: new Date().toISOString(),
        statusData,
        changeInfo
      };

      // Publish to Redis for real-time updates
      await publish('course_status_changes', eventData);
      await publish(`course_${courseId}_status`, eventData);

      logger.debug('Status change event emitted', {
        courseId,
        newStatus: statusData.calculatedStatus,
        newPercentage: statusData.completionPercentage
      });

    } catch (error) {
      logger.logError(error, {
        context: 'StatusAggregator.emitStatusChangeEvent',
        courseId
      });
    }
  }

  /**
   * Bulk update status for multiple courses
   */
  async bulkUpdateStatus(courseIds, options = {}) {
    const results = [];
    const errors = [];

    for (const courseId of courseIds) {
      try {
        const result = await this.updateCourseStatus(courseId, options);
        results.push(result);
      } catch (error) {
        errors.push({ courseId, error: error.message });
      }
    }

    logger.info('Bulk status update completed', {
      totalCourses: courseIds.length,
      successful: results.length,
      failed: errors.length
    });

    return { results, errors };
  }

  /**
   * Archive phase data when course status changes
   */
  async archivePhaseData(client, courseId, courseStatus, userId) {
    try {
      // Get all subtasks with their phase history
      const subtasksResult = await client.query(`
        SELECT 
          cs.id,
          cs.title,
          cs.status,
          cs.start_date,
          cs.finish_date,
          cs.completed_at
        FROM course_subtasks cs
        WHERE cs.course_id = $1
      `, [courseId]);
      
      for (const subtask of subtasksResult.rows) {
        // Get phase status history for this subtask
        const historyResult = await client.query(`
          SELECT 
            status,
            started_at,
            finished_at
          FROM phase_status_history
          WHERE subtask_id = $1
          ORDER BY started_at ASC
        `, [subtask.id]);
        
        // Archive the data
        await client.query(`
          INSERT INTO course_phase_archives (
            course_id,
            course_status,
            subtask_id,
            subtask_title,
            phase_status,
            phase_history,
            start_date,
            finish_date,
            completed_at,
            archived_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (course_id, subtask_id, course_status) 
          DO UPDATE SET
            phase_status = EXCLUDED.phase_status,
            phase_history = EXCLUDED.phase_history,
            start_date = EXCLUDED.start_date,
            finish_date = EXCLUDED.finish_date,
            completed_at = EXCLUDED.completed_at,
            archived_at = CURRENT_TIMESTAMP,
            archived_by = EXCLUDED.archived_by
        `, [
          courseId,
          courseStatus,
          subtask.id,
          subtask.title,
          subtask.status,
          JSON.stringify(historyResult.rows),
          subtask.start_date,
          subtask.finish_date,
          subtask.completed_at,
          userId
        ]);
      }
      
      logger.info('Archived phase data for course status transition', {
        courseId,
        courseStatus,
        subtaskCount: subtasksResult.rows.length,
        archivedBy: userId
      });
      
    } catch (error) {
      logger.error('Error archiving phase data', {
        error: error.message,
        courseId,
        courseStatus
      });
      throw error;
    }
  }

  /**
   * Reset phase data for new course status
   */
  async resetPhaseData(client, courseId) {
    try {
      // Reset all subtask statuses to empty (No Status) and clear ALL phase-specific dates
      await client.query(`
        UPDATE course_subtasks
        SET 
          status = '',
          start_date = NULL,
          finish_date = NULL,
          completed_at = NULL,
          -- Clear all phase-specific date columns
          alpha_draft_start_date = NULL,
          alpha_draft_end_date = NULL,
          alpha_draft_date = NULL,
          alpha_review_start_date = NULL,
          alpha_review_end_date = NULL,
          alpha_review_date = NULL,
          beta_revision_start_date = NULL,
          beta_revision_end_date = NULL,
          beta_revision_date = NULL,
          beta_review_start_date = NULL,
          beta_review_end_date = NULL,
          beta_review_date = NULL,
          final_revision_start_date = NULL,
          final_revision_end_date = NULL,
          final_revision_date = NULL,
          final_signoff_sent_start_date = NULL,
          final_signoff_sent_end_date = NULL,
          final_signoff_sent_date = NULL,
          final_signoff_received_start_date = NULL,
          final_signoff_received_date = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE course_id = $1
      `, [courseId]);
      
      // Delete all phase status history for this course's subtasks
      await client.query(`
        DELETE FROM phase_status_history
        WHERE subtask_id IN (
          SELECT id FROM course_subtasks WHERE course_id = $1
        )
      `, [courseId]);
      
      logger.info('Reset phase data for new course status', {
        courseId,
        message: 'Cleared all phase statuses, dates, and history'
      });
      
    } catch (error) {
      logger.error('Error resetting phase data', {
        error: error.message,
        courseId
      });
      throw error;
    }
  }

  /**
   * Get courses that need status recalculation
   */
  async getCoursesNeedingUpdate() {
    try {
      // Find courses with recent subtask changes
      const result = await query(`
        SELECT DISTINCT c.id as course_id
        FROM courses c
        INNER JOIN course_subtasks cs ON c.id = cs.course_id
        WHERE cs.updated_at > c.updated_at
           OR c.calculated_status IS NULL
           OR c.completion_percentage IS NULL
        ORDER BY cs.updated_at DESC
        LIMIT 100
      `);

      return result.rows.map(row => row.course_id);

    } catch (error) {
      logger.logError(error, {
        context: 'StatusAggregator.getCoursesNeedingUpdate'
      });
      throw error;
    }
  }

  /**
   * Run periodic status update job
   */
  async runPeriodicUpdate() {
    try {
      logger.info('Starting periodic status update job');
      
      const courseIds = await this.getCoursesNeedingUpdate();
      
      if (courseIds.length === 0) {
        logger.info('No courses need status updates');
        return { updated: 0, errors: 0 };
      }

      const { results, errors } = await this.bulkUpdateStatus(courseIds, {
        skipEventEmission: true // Reduce noise for bulk updates
      });

      logger.info('Periodic status update completed', {
        coursesChecked: courseIds.length,
        updated: results.length,
        errors: errors.length
      });

      return { updated: results.length, errors: errors.length };

    } catch (error) {
      logger.logError(error, {
        context: 'StatusAggregator.runPeriodicUpdate'
      });
      throw error;
    }
  }
}

module.exports = StatusAggregator;