const { query, transaction, buildWhereClause } = require('../config/database');
const { get, set } = require('../config/redis');
const DependencyManager = require('./DependencyManager');
const StatusAggregator = require('./StatusAggregator');
const logger = require('../utils/logger');
const { ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');

/**
 * Bulk Update Wizard Service
 * Handles bulk operations on multiple courses with impact analysis and preview
 */
class BulkUpdateService {
  constructor() {
    this.dependencyManager = new DependencyManager();
    this.statusAggregator = new StatusAggregator();
    this.cachePrefix = 'bulk_update';
    this.maxCoursesPerOperation = 100;
  }

  /**
   * Preview bulk update operation
   */
  async previewBulkUpdate(options, userId) {
    try {
      const {
        filter = {},
        updates = {},
        options: updateOptions = {}
      } = options;

      // Validate user permissions
      await this.validateBulkPermissions(userId, filter);

      // Get matching courses
      const matchingCourses = await this.getMatchingCourses(filter, userId);

      if (matchingCourses.length === 0) {
        return {
          previewId: null,
          totalCourses: 0,
          validCourses: 0,
          invalidCourses: 0,
          preview: [],
          warnings: ['No courses match the specified criteria'],
          estimatedDuration: 0
        };
      }

      if (matchingCourses.length > this.maxCoursesPerOperation) {
        throw new ValidationError(`Too many courses selected. Maximum ${this.maxCoursesPerOperation} courses allowed per operation.`);
      }

      // Generate preview data
      const previewData = await this.generatePreviewData(matchingCourses, updates, updateOptions, userId);

      // Cache preview for execution
      const previewId = uuidv4();
      await set(`${this.cachePrefix}:preview:${previewId}`, {
        ...previewData,
        userId,
        createdAt: new Date().toISOString(),
        originalFilter: filter,
        originalUpdates: updates,
        originalOptions: updateOptions
      }, 1800); // 30 minutes

      logger.info('Bulk update preview generated', {
        previewId,
        userId,
        totalCourses: matchingCourses.length,
        validCourses: previewData.validCourses,
        filterCriteria: Object.keys(filter),
        updateFields: Object.keys(updates)
      });

      return {
        previewId,
        ...previewData
      };

    } catch (error) {
      logger.logError(error, {
        context: 'BulkUpdateService.previewBulkUpdate',
        userId,
        options
      });
      throw error;
    }
  }

  /**
   * Execute bulk update operation
   */
  async executeBulkUpdate(previewId, userId) {
    try {
      // Get cached preview data
      const previewData = await get(`${this.cachePrefix}:preview:${previewId}`);
      
      if (!previewData) {
        throw new ValidationError('Preview not found or expired. Please regenerate preview.');
      }

      if (previewData.userId !== userId) {
        throw new AuthorizationError('You can only execute your own bulk updates.');
      }

      // Re-validate permissions
      await this.validateBulkPermissions(userId, previewData.originalFilter);

      // Execute the bulk update
      const executionResult = await this.performBulkUpdate(previewData, userId);

      // Clear the preview cache
      const { del } = require('../config/redis');
      await del(`${this.cachePrefix}:preview:${previewId}`);

      logger.info('Bulk update executed successfully', {
        previewId,
        userId,
        successful: executionResult.successful,
        failed: executionResult.failed,
        duration: executionResult.executionTime
      });

      return executionResult;

    } catch (error) {
      logger.logError(error, {
        context: 'BulkUpdateService.executeBulkUpdate',
        previewId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get bulk update history for a user
   */
  async getBulkUpdateHistory(userId, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;

      const result = await query(`
        SELECT 
          al.id,
          al.created_at,
          al.changes,
          COUNT(CASE WHEN al.action = 'bulk_update_success' THEN 1 END) as successful_updates,
          COUNT(CASE WHEN al.action = 'bulk_update_error' THEN 1 END) as failed_updates
        FROM audit_logs al
        WHERE al.user_id = $1
          AND al.entity_type = 'bulk_operation'
          AND al.action IN ('bulk_update_success', 'bulk_update_error')
        GROUP BY al.id, al.created_at, al.changes
        ORDER BY al.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      return {
        history: result.rows.map(row => ({
          id: row.id,
          executedAt: row.created_at,
          successful: parseInt(row.successful_updates),
          failed: parseInt(row.failed_updates),
          details: row.changes
        })),
        pagination: {
          limit,
          offset,
          hasMore: result.rows.length === limit
        }
      };

    } catch (error) {
      logger.logError(error, {
        context: 'BulkUpdateService.getBulkUpdateHistory',
        userId,
        options
      });
      throw error;
    }
  }

  /**
   * Validate bulk operation permissions
   */
  async validateBulkPermissions(userId, filter) {
    // Get user details
    const userResult = await query('SELECT role, team_id FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      throw new AuthorizationError('User not found');
    }

    const user = userResult.rows[0];

    // Only admins and managers can perform bulk updates
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new AuthorizationError('Only administrators and managers can perform bulk updates');
    }

    // Managers can only update courses in their team or assigned to them
    if (user.role === 'manager') {
      // Add team/assignment filter for managers
      if (!filter.teamId && !filter.assignedToUser) {
        // Default to their team
        filter.teamId = user.team_id;
      }
    }

    return true;
  }

  /**
   * Get courses matching the filter criteria
   */
  async getMatchingCourses(filter, userId) {
    try {
      // Build base query
      let baseQuery = `
        SELECT DISTINCT c.*
        FROM courses c
        LEFT JOIN course_assignments ca ON c.id = ca.course_id
        LEFT JOIN users u ON ca.user_id = u.id
      `;

      // Build WHERE clause
      const conditions = [];
      const params = [];
      let paramCount = 0;

      // Always exclude deleted courses
      conditions.push("c.status != 'deleted'");

      // Apply filters
      if (filter.status) {
        conditions.push(`c.status = $${++paramCount}`);
        params.push(filter.status);
      }

      if (filter.type) {
        conditions.push(`c.type = $${++paramCount}`);
        params.push(filter.type);
      }

      if (filter.priority) {
        conditions.push(`c.priority = $${++paramCount}`);
        params.push(filter.priority);
      }

      if (filter.dueBefore) {
        conditions.push(`c.due_date <= $${++paramCount}`);
        params.push(filter.dueBefore);
      }

      if (filter.dueAfter) {
        conditions.push(`c.due_date >= $${++paramCount}`);
        params.push(filter.dueAfter);
      }

      if (filter.teamId) {
        conditions.push(`EXISTS (
          SELECT 1 FROM course_assignments ca2 
          JOIN users u2 ON ca2.user_id = u2.id 
          WHERE ca2.course_id = c.id AND u2.team_id = $${++paramCount}
        )`);
        params.push(filter.teamId);
      }

      if (filter.assignedToUser) {
        conditions.push(`ca.user_id = $${++paramCount}`);
        params.push(filter.assignedToUser);
      }

      if (filter.courseIds && filter.courseIds.length > 0) {
        const placeholders = filter.courseIds.map(() => `$${++paramCount}`).join(',');
        conditions.push(`c.id IN (${placeholders})`);
        params.push(...filter.courseIds);
      }

      if (filter.search) {
        conditions.push(`(c.title ILIKE $${++paramCount} OR c.description ILIKE $${++paramCount})`);
        params.push(`%${filter.search}%`, `%${filter.search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const finalQuery = `${baseQuery} ${whereClause} ORDER BY c.id`;

      const result = await query(finalQuery, params);
      return result.rows;

    } catch (error) {
      logger.logError(error, {
        context: 'BulkUpdateService.getMatchingCourses',
        filter,
        userId
      });
      throw error;
    }
  }

  /**
   * Generate preview data for bulk update
   */
  async generatePreviewData(courses, updates, options, userId) {
    try {
      const preview = [];
      const warnings = [];
      const errors = [];
      let validCourses = 0;
      let invalidCourses = 0;

      for (const course of courses) {
        try {
          const coursePreview = await this.generateCoursePreview(course, updates, options);
          
          if (coursePreview.isValid) {
            validCourses++;
          } else {
            invalidCourses++;
          }

          preview.push(coursePreview);

        } catch (error) {
          invalidCourses++;
          errors.push({
            courseId: course.id,
            courseTitle: course.title,
            error: error.message
          });
        }
      }

      // Analyze overall impact
      const impactAnalysis = await this.analyzeOverallImpact(preview, updates, options);

      // Generate warnings
      if (impactAnalysis.highImpactChanges > 0) {
        warnings.push(`${impactAnalysis.highImpactChanges} courses have high-impact changes`);
      }

      if (impactAnalysis.dependencyConflicts > 0) {
        warnings.push(`${impactAnalysis.dependencyConflicts} dependency conflicts detected`);
      }

      if (validCourses > 50) {
        warnings.push('Large bulk operation - consider splitting into smaller batches');
      }

      return {
        totalCourses: courses.length,
        validCourses,
        invalidCourses,
        preview,
        warnings,
        errors,
        impactAnalysis,
        estimatedDuration: this.estimateExecutionTime(validCourses, updates),
        canExecute: validCourses > 0 && errors.length === 0
      };

    } catch (error) {
      logger.logError(error, {
        context: 'BulkUpdateService.generatePreviewData',
        coursesCount: courses.length,
        updates
      });
      throw error;
    }
  }

  /**
   * Generate preview for a single course
   */
  async generateCoursePreview(course, updates, options) {
    const coursePreview = {
      courseId: course.id,
      title: course.title,
      currentValues: {},
      newValues: {},
      changes: {},
      warnings: [],
      isValid: true,
      impactLevel: 'low'
    };

    // Analyze each update field
    for (const [field, newValue] of Object.entries(updates)) {
      const currentValue = course[field.replace(/([A-Z])/g, '_$1').toLowerCase()];
      
      if (currentValue !== newValue) {
        coursePreview.currentValues[field] = currentValue;
        coursePreview.newValues[field] = newValue;
        coursePreview.changes[field] = {
          from: currentValue,
          to: newValue
        };

        // Analyze impact of this change
        const fieldImpact = await this.analyzeFieldImpact(course, field, currentValue, newValue);
        
        if (fieldImpact.warnings.length > 0) {
          coursePreview.warnings.push(...fieldImpact.warnings);
        }

        if (fieldImpact.level === 'high' || coursePreview.impactLevel === 'medium') {
          coursePreview.impactLevel = fieldImpact.level;
        } else if (fieldImpact.level === 'medium' && coursePreview.impactLevel === 'low') {
          coursePreview.impactLevel = 'medium';
        }

        if (!fieldImpact.isValid) {
          coursePreview.isValid = false;
        }
      }
    }

    // Check dependencies if due date is changing
    if (coursePreview.changes.dueDate) {
      const dependencyImpact = await this.analyzeDependencyImpact(course.id, coursePreview.newValues.dueDate);
      if (dependencyImpact.affectedCourses > 0) {
        coursePreview.warnings.push(`${dependencyImpact.affectedCourses} dependent courses will be affected`);
        coursePreview.impactLevel = 'high';
      }
    }

    return coursePreview;
  }

  /**
   * Analyze impact of changing a specific field
   */
  async analyzeFieldImpact(course, field, currentValue, newValue) {
    const impact = {
      level: 'low',
      warnings: [],
      isValid: true
    };

    switch (field) {
      case 'dueDate':
        const currentDate = new Date(currentValue);
        const newDate = new Date(newValue);
        const daysDiff = Math.ceil((newDate - currentDate) / (1000 * 60 * 60 * 24));

        if (Math.abs(daysDiff) > 30) {
          impact.level = 'high';
          impact.warnings.push(`Significant schedule change: ${Math.abs(daysDiff)} days`);
        } else if (Math.abs(daysDiff) > 7) {
          impact.level = 'medium';
          impact.warnings.push(`Moderate schedule change: ${Math.abs(daysDiff)} days`);
        }

        if (newDate < new Date()) {
          impact.warnings.push('New due date is in the past');
          impact.isValid = false;
        }
        break;

      case 'priority':
        if (currentValue === 'critical' && newValue !== 'critical') {
          impact.level = 'high';
          impact.warnings.push('Downgrading critical priority course');
        } else if (newValue === 'critical' && currentValue !== 'critical') {
          impact.level = 'medium';
          impact.warnings.push('Upgrading to critical priority');
        }
        break;

      case 'status':
        if (currentValue === 'in_progress' && newValue === 'on_hold') {
          impact.level = 'medium';
          impact.warnings.push('Putting active course on hold');
        } else if (newValue === 'cancelled') {
          impact.level = 'high';
          impact.warnings.push('Course will be cancelled');
        }
        break;

      case 'type':
        if (currentValue !== newValue) {
          impact.level = 'medium';
          impact.warnings.push('Changing course type may affect workflow');
        }
        break;
    }

    return impact;
  }

  /**
   * Analyze dependency impact for due date changes
   */
  async analyzeDependencyImpact(courseId, newDueDate) {
    try {
      const dependencyGraph = await this.dependencyManager.getDependencyGraph(courseId, {
        includeDownstream: true,
        includeUpstream: false
      });

      return {
        affectedCourses: dependencyGraph.downstream.length,
        hasCircularDependencies: false // This would be detected during dependency creation
      };

    } catch (error) {
      logger.logError(error, {
        context: 'BulkUpdateService.analyzeDependencyImpact',
        courseId,
        newDueDate
      });
      return { affectedCourses: 0, hasCircularDependencies: false };
    }
  }

  /**
   * Analyze overall impact of the bulk operation
   */
  async analyzeOverallImpact(preview, updates, options) {
    const analysis = {
      highImpactChanges: 0,
      mediumImpactChanges: 0,
      lowImpactChanges: 0,
      dependencyConflicts: 0,
      resourceConflicts: 0,
      estimatedTimeImpact: 0
    };

    preview.forEach(coursePreview => {
      switch (coursePreview.impactLevel) {
        case 'high':
          analysis.highImpactChanges++;
          break;
        case 'medium':
          analysis.mediumImpactChanges++;
          break;
        default:
          analysis.lowImpactChanges++;
      }

      // Count specific types of conflicts
      if (coursePreview.warnings.some(w => w.includes('dependent courses'))) {
        analysis.dependencyConflicts++;
      }
    });

    return analysis;
  }

  /**
   * Perform the actual bulk update
   */
  async performBulkUpdate(previewData, userId) {
    const startTime = Date.now();
    const results = [];
    const errors = [];

    try {
      await transaction(async (client) => {
        for (const coursePreview of previewData.preview) {
          if (!coursePreview.isValid) {
            errors.push({
              courseId: coursePreview.courseId,
              title: coursePreview.title,
              error: 'Course failed validation'
            });
            continue;
          }

          try {
            await this.updateSingleCourse(client, coursePreview, userId);
            results.push({
              courseId: coursePreview.courseId,
              title: coursePreview.title,
              changes: coursePreview.changes,
              success: true
            });

          } catch (error) {
            errors.push({
              courseId: coursePreview.courseId,
              title: coursePreview.title,
              error: error.message
            });
          }
        }

        // Log the bulk operation
        await client.query(`
          INSERT INTO audit_logs (
            user_id, entity_type, entity_id, action, changes, created_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
          userId,
          'bulk_operation',
          null,
          'bulk_update_executed',
          JSON.stringify({
            successful: results.length,
            failed: errors.length,
            updates: previewData.originalUpdates,
            filter: previewData.originalFilter
          })
        ]);
      });

      // Trigger status recalculation for updated courses
      const updatedCourseIds = results.map(r => r.courseId);
      if (updatedCourseIds.length > 0) {
        await this.statusAggregator.bulkUpdateStatus(updatedCourseIds, { triggeredBy: userId });
      }

      const executionTime = Date.now() - startTime;

      return {
        successful: results.length,
        failed: errors.length,
        results,
        errors,
        executionTime,
        executedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, {
        context: 'BulkUpdateService.performBulkUpdate',
        userId,
        previewDataLength: previewData.preview.length
      });
      throw error;
    }
  }

  /**
   * Update a single course within a transaction
   */
  async updateSingleCourse(client, coursePreview, userId) {
    const { courseId, newValues } = coursePreview;

    // Build update query
    const updateFields = [];
    const values = [courseId];
    let paramCount = 1;

    Object.entries(newValues).forEach(([field, value]) => {
      const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
      updateFields.push(`${dbField} = $${++paramCount}`);
      values.push(value);
    });

    if (updateFields.length === 0) {
      return; // No changes to make
    }

    const updateQuery = `
      UPDATE courses 
      SET ${updateFields.join(', ')}, updated_by = $${++paramCount}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    values.push(userId);

    await client.query(updateQuery, values);

    // Log individual course update
    await client.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action, changes, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      userId,
      'course',
      courseId,
      'bulk_updated',
      JSON.stringify(coursePreview.changes)
    ]);
  }

  /**
   * Estimate execution time for bulk operation
   */
  estimateExecutionTime(courseCount, updates) {
    // Base time per course (in seconds)
    let baseTimePerCourse = 0.5;

    // Add time for complex updates
    if (updates.dueDate) baseTimePerCourse += 0.2; // Dependency analysis
    if (updates.status) baseTimePerCourse += 0.1;
    if (updates.priority) baseTimePerCourse += 0.1;

    const totalSeconds = courseCount * baseTimePerCourse;
    
    // Add overhead for transaction and validation
    const overhead = Math.min(courseCount * 0.1, 10); // Max 10 seconds overhead
    
    return Math.ceil(totalSeconds + overhead);
  }

  /**
   * Cancel a bulk operation (if it's in progress)
   */
  async cancelBulkOperation(previewId, userId) {
    try {
      const previewData = await get(`${this.cachePrefix}:preview:${previewId}`);
      
      if (!previewData) {
        throw new ValidationError('Bulk operation not found');
      }

      if (previewData.userId !== userId) {
        throw new AuthorizationError('You can only cancel your own bulk operations');
      }

      // Clear the preview cache
      const { del } = require('../config/redis');
      await del(`${this.cachePrefix}:preview:${previewId}`);

      logger.info('Bulk operation cancelled', {
        previewId,
        userId
      });

      return {
        success: true,
        message: 'Bulk operation cancelled successfully'
      };

    } catch (error) {
      logger.logError(error, {
        context: 'BulkUpdateService.cancelBulkOperation',
        previewId,
        userId
      });
      throw error;
    }
  }
}

module.exports = BulkUpdateService;