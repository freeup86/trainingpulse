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
          SUM(weight) as total_weight,
          SUM(CASE WHEN status = 'completed' THEN weight ELSE 0 END) as completed_weight,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_subtasks,
          COUNT(CASE WHEN is_blocking = true AND status != 'completed' THEN 1 END) as blocking_incomplete
        FROM course_subtasks 
        WHERE course_id = $1
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

      // Always use simple calculation based on subtask count (not weight)
      const percentage = Math.round((Number(stats.completed_subtasks || 0) / Number(stats.total_subtasks || 1)) * 100);
      const calculationMethod = 'simple';

      return {
        percentage: isNaN(percentage) ? 0 : Math.min(percentage, 100),
        totalSubtasks: parseInt(stats.total_subtasks || 0),
        completedSubtasks: parseInt(stats.completed_subtasks || 0),
        hasBlockingIncomplete: parseInt(stats.blocking_incomplete || 0) > 0,
        calculationMethod,
        totalWeight: parseInt(stats.total_weight || 0),
        completedWeight: parseInt(stats.completed_weight || 0)
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

      // Update only if there are changes or forced
      if (forceUpdate || statusChanged || percentageChanged) {
        await transaction(async (client) => {
          // Update course status
          await client.query(`
            UPDATE courses 
            SET 
              calculated_status = $1,
              completion_percentage = $2,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [calculatedStatus, completionPercentage, courseId]);

          // Log the status change in audit table
          if (statusChanged || percentageChanged) {
            await client.query(`
              INSERT INTO audit_logs (
                user_id, entity_type, entity_id, action, changes, created_at
              ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [
              triggeredBy,
              'course',
              courseId,
              'status_updated',
              JSON.stringify({
                previous: {
                  status: current.calculated_status,
                  percentage: current.completion_percentage
                },
                new: {
                  status: calculatedStatus,
                  percentage: completionPercentage
                },
                reason: statusData.statusReason,
                method: 'automatic_aggregation'
              })
            ]);
          }
        });

        // Emit status change event for real-time updates
        if (!skipEventEmission) {
          await this.emitStatusChangeEvent(courseId, statusData, {
            statusChanged,
            percentageChanged,
            previous: {
              status: current.calculated_status,
              percentage: current.completion_percentage
            }
          });
        }

        logger.info('Course status updated', {
          courseId,
          previousStatus: current.calculated_status,
          newStatus: calculatedStatus,
          previousPercentage: current.completion_percentage,
          newPercentage: completionPercentage,
          triggeredBy
        });
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