const Joi = require('joi');
const BottleneckAnalyzer = require('../services/BottleneckAnalyzer');
const ResourceHeatmapService = require('../services/ResourceHeatmapService');
const PerformanceAnalyzer = require('../services/PerformanceAnalyzer');
const { asyncHandler, ValidationError, AuthorizationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Validation schemas
const bottleneckAnalysisSchema = Joi.object({
  period: Joi.string().valid('7d', '30d', '90d', '6m', '1y').default('30d'),
  groupBy: Joi.string().valid('stage', 'reviewer', 'course_type', 'team', 'priority').default('stage'),
  threshold: Joi.number().min(1.5).max(5.0).default(2.0),
  includeResolved: Joi.boolean().default(false),
  teamId: Joi.number().integer().positive().optional(),
  courseType: Joi.string().valid('instructor_led', 'elearning', 'blended', 'microlearning', 'certification').optional(),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const workloadAnalysisSchema = Joi.object({
  period: Joi.string().valid('7d', '30d', '90d', '6m', '1y').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional(),
  teamId: Joi.number().integer().positive().optional(),
  userIds: Joi.array().items(Joi.number().integer().positive()).optional(),
  includeWeekends: Joi.boolean().default(false),
  capacityType: Joi.string().valid('hours', 'courses', 'workload').default('hours')
}).custom((value, helpers) => {
  // Either period OR (startDate and endDate) must be provided
  if (!value.period && (!value.startDate || !value.endDate)) {
    return helpers.error('any.custom', { message: 'Either period or both startDate and endDate must be provided' });
  }
  return value;
});

const impactAnalysisSchema = Joi.object({
  newDate: Joi.date().required(),
  cascade: Joi.boolean().default(true),
  maxDepth: Joi.number().integer().min(1).max(10).default(5)
});

const performanceAnalysisSchema = Joi.object({
  period: Joi.string().valid('7d', '30d', '90d', '6m', '1y').default('30d'),
  teamId: Joi.number().integer().positive().optional(),
  courseType: Joi.string().valid('instructor_led', 'elearning', 'blended', 'microlearning', 'certification').optional(),
  groupBy: Joi.string().valid('team', 'user', 'course_type', 'priority').default('team'),
  includeCompleted: Joi.boolean().default(true)
});

class AnalyticsController {
  constructor() {
    this.bottleneckAnalyzer = new BottleneckAnalyzer();
    this.resourceHeatmapService = new ResourceHeatmapService();
    this.performanceAnalyzer = new PerformanceAnalyzer();
  }

  /**
   * GET /analytics/bottlenecks - Get bottleneck analysis
   */
  getBottlenecks = asyncHandler(async (req, res) => {
    // Validate query parameters
    const { error, value } = bottleneckAnalysisSchema.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid analysis parameters', error.details);
    }

    const { period, groupBy, threshold, includeResolved, teamId, courseType, limit } = value;

    // Role-based filtering
    let finalTeamId = teamId;
    if (req.user.role === 'manager' && !teamId) {
      // Managers see their team by default
      finalTeamId = req.user.team_id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      // Other roles see only their team
      finalTeamId = req.user.team_id;
    }

    const analysis = await this.bottleneckAnalyzer.analyzeBottlenecks({
      period,
      groupBy,
      threshold,
      includeResolved,
      teamId: finalTeamId,
      courseType,
      limit
    });

    logger.info('Bottleneck analysis completed', {
      period,
      groupBy,
      threshold,
      userId: req.user.id,
      bottlenecksFound: analysis.bottlenecks.length
    });

    res.json({
      success: true,
      data: analysis
    });
  });

  /**
   * GET /analytics/workload - Get resource heatmap data
   */
  getWorkload = asyncHandler(async (req, res) => {
    // Validate query parameters
    const { error, value } = workloadAnalysisSchema.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid workload parameters', error.details);
    }

    const { period, startDate, endDate, teamId, userIds, includeWeekends, capacityType } = value;

    // Convert period to date range if provided
    let finalStartDate = startDate;
    let finalEndDate = endDate;
    
    if (period) {
      const periodMap = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '6m': 180,
        '1y': 365
      };
      const daysAgo = periodMap[period] || 30;
      finalEndDate = new Date();
      finalStartDate = new Date();
      finalStartDate.setDate(finalStartDate.getDate() - daysAgo);
    }

    // Role-based filtering
    let finalTeamId = teamId;
    let finalUserIds = userIds;

    if (req.user.role === 'manager' && !teamId) {
      finalTeamId = req.user.team_id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      // Non-managers can only see their own workload
      finalUserIds = [req.user.id];
    }

    const workloadData = await this.resourceHeatmapService.generateHeatmap({
      startDate: finalStartDate,
      endDate: finalEndDate,
      teamId: finalTeamId,
      userIds: finalUserIds,
      includeWeekends,
      capacityType
    });

    logger.info('Workload analysis completed', {
      period,
      startDate: finalStartDate,
      endDate: finalEndDate,
      teamId: finalTeamId,
      userId: req.user.id,
      usersAnalyzed: workloadData.heatmap?.length || 0,
      insights: workloadData.insights?.length || 0
    });

    res.json({
      success: true,
      data: workloadData
    });
  });

  /**
   * GET /analytics/performance - Get performance metrics and trends
   */
  getPerformance = asyncHandler(async (req, res) => {
    // Validate query parameters
    const { error, value } = performanceAnalysisSchema.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid performance analysis parameters', error.details);
    }

    const { period, teamId, courseType, groupBy, includeCompleted } = value;

    // Role-based filtering
    let finalTeamId = teamId;
    if (req.user.role === 'manager' && !teamId) {
      // Managers see their team by default
      finalTeamId = req.user.team_id;
    } else if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      // Other roles see only their team
      finalTeamId = req.user.team_id;
    }

    const performanceData = await this.performanceAnalyzer.analyzePerformance({
      period,
      teamId: finalTeamId,
      courseType,
      groupBy,
      includeCompleted
    });

    logger.info('Performance analysis completed', {
      period,
      teamId: finalTeamId,
      courseType,
      groupBy,
      userId: req.user.id,
      totalCourses: performanceData.summary.totalCourses,
      completionRate: performanceData.summary.completionRate
    });

    res.json({
      success: true,
      data: performanceData
    });
  });

  /**
   * GET /analytics/impact/:courseId - Analyze schedule change impact
   */
  getImpactAnalysis = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Validate query parameters
    const { error, value } = impactAnalysisSchema.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid impact analysis parameters', error.details);
    }

    const { newDate, cascade, maxDepth } = value;

    const impactData = await this.analyzeScheduleImpact(courseId, newDate, cascade, maxDepth);

    logger.info('Impact analysis completed', {
      courseId,
      newDate,
      cascade,
      userId: req.user.id,
      affectedCourses: impactData.affectedCourses.length
    });

    res.json({
      success: true,
      data: impactData
    });
  });

  /**
   * GET /analytics/course/:courseId/bottlenecks - Get course-specific bottlenecks
   */
  getCourseBottlenecks = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const bottlenecks = await this.bottleneckAnalyzer.analyzeCourseBottlenecks(courseId);

    res.json({
      success: true,
      data: bottlenecks
    });
  });

  /**
   * POST /analytics/cache/clear - Clear analytics cache
   */
  clearCache = asyncHandler(async (req, res) => {
    // Only admins and managers can clear cache
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      throw new AuthorizationError('Only admins and managers can clear analytics cache');
    }

    const { pattern } = req.body;
    const cleared = await this.bottleneckAnalyzer.clearCache(pattern);

    logger.info('Analytics cache cleared', {
      pattern,
      keysCleared: cleared,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        message: 'Cache cleared successfully',
        keysCleared: cleared
      }
    });
  });


  /**
   * Analyze schedule change impact
   */
  async analyzeScheduleImpact(courseId, newDate, cascade, maxDepth) {
    try {
      const { query } = require('../config/database');

      // Get the course and its current due date
      const courseResult = await query(
        'SELECT id, title, due_date, type, priority FROM courses WHERE id = $1',
        [courseId]
      );

      if (courseResult.rows.length === 0) {
        throw new ValidationError('Course not found');
      }

      const course = courseResult.rows[0];
      const currentDate = new Date(course.due_date);
      const proposedDate = new Date(newDate);
      const daysDifference = Math.ceil((proposedDate - currentDate) / (1000 * 60 * 60 * 24));

      // Find dependent courses if cascade is enabled
      let affectedCourses = [];
      if (cascade) {
        affectedCourses = await this.findDependentCourses(courseId, maxDepth);
      }

      // Calculate resource conflicts
      const resourceConflicts = await this.findResourceConflicts(courseId, proposedDate);

      // Generate recommendations
      const recommendations = this.generateScheduleRecommendations(
        course, 
        daysDifference, 
        affectedCourses, 
        resourceConflicts
      );

      return {
        course: {
          id: course.id,
          title: course.title,
          currentDueDate: course.due_date,
          proposedDueDate: newDate,
          daysDifference,
          changeType: daysDifference > 0 ? 'delay' : daysDifference < 0 ? 'acceleration' : 'no_change'
        },
        affectedCourses,
        resourceConflicts,
        recommendations,
        impact: {
          severity: this.calculateImpactSeverity(daysDifference, affectedCourses.length, resourceConflicts.length),
          coursesAffected: affectedCourses.length,
          resourceConflicts: resourceConflicts.length,
          estimatedEffort: this.estimateChangeEffort(affectedCourses, resourceConflicts)
        }
      };

    } catch (error) {
      logger.logError(error, {
        context: 'AnalyticsController.analyzeScheduleImpact',
        courseId,
        newDate
      });
      throw error;
    }
  }

  /**
   * Find courses dependent on the given course
   */
  async findDependentCourses(courseId, maxDepth, currentDepth = 0, visited = new Set()) {
    if (currentDepth >= maxDepth || visited.has(courseId)) {
      return [];
    }

    visited.add(courseId);

    const { query } = require('../config/database');
    const result = await query(`
      SELECT 
        c.id,
        c.title,
        c.due_date,
        c.type,
        c.priority,
        cd.dependency_type,
        ${currentDepth + 1} as depth
      FROM course_dependencies cd
      JOIN courses c ON cd.course_id = c.id
      WHERE cd.depends_on_course_id = $1
        AND c.status NOT IN ('completed', 'cancelled', 'deleted')
    `, [courseId]);

    const directDependents = result.rows;
    let allDependents = [...directDependents];

    // Recursively find dependents of dependents
    for (const dependent of directDependents) {
      const nestedDependents = await this.findDependentCourses(
        dependent.id, 
        maxDepth, 
        currentDepth + 1, 
        visited
      );
      allDependents = allDependents.concat(nestedDependents);
    }

    return allDependents;
  }

  /**
   * Find resource conflicts for the proposed date
   */
  async findResourceConflicts(courseId, proposedDate) {
    const { query } = require('../config/database');

    // Find users assigned to this course
    const assignedUsersResult = await query(`
      SELECT DISTINCT user_id, role
      FROM course_assignments
      WHERE course_id = $1
    `, [courseId]);

    const conflicts = [];

    for (const assignment of assignedUsersResult.rows) {
      // Check for overlapping courses around the proposed date
      const conflictsResult = await query(`
        SELECT 
          c.id,
          c.title,
          c.start_date,
          c.due_date,
          c.priority,
          ca.role
        FROM course_assignments ca
        JOIN courses c ON ca.course_id = c.id
        WHERE ca.user_id = $1
          AND c.id != $2
          AND c.status NOT IN ('completed', 'cancelled', 'deleted')
          AND (
            (c.start_date <= $3 AND c.due_date >= $3) OR
            (c.start_date <= $3 + INTERVAL '7 days' AND c.due_date >= $3 - INTERVAL '7 days')
          )
      `, [assignment.user_id, courseId, proposedDate]);

      if (conflictsResult.rows.length > 0) {
        conflicts.push({
          userId: assignment.user_id,
          role: assignment.role,
          conflictingCourses: conflictsResult.rows
        });
      }
    }

    return conflicts;
  }


  /**
   * Generate schedule change recommendations
   */
  generateScheduleRecommendations(course, daysDifference, affectedCourses, resourceConflicts) {
    const recommendations = [];

    if (Math.abs(daysDifference) > 14) {
      recommendations.push({
        type: 'schedule_impact',
        priority: 'high',
        message: `Significant schedule change (${Math.abs(daysDifference)} days). Consider stakeholder communication.`
      });
    }

    if (affectedCourses.length > 0) {
      recommendations.push({
        type: 'dependency_impact',
        priority: 'medium',
        message: `${affectedCourses.length} dependent courses will be affected. Review their schedules.`
      });
    }

    if (resourceConflicts.length > 0) {
      recommendations.push({
        type: 'resource_conflict',
        priority: 'high',
        message: `Resource conflicts detected for ${resourceConflicts.length} team members.`
      });
    }

    if (course.priority === 'critical' && daysDifference > 0) {
      recommendations.push({
        type: 'priority_alert',
        priority: 'critical',
        message: 'Delaying a critical priority course. Consider additional resources or scope reduction.'
      });
    }

    return recommendations;
  }

  /**
   * Calculate impact severity
   */
  calculateImpactSeverity(daysDifference, affectedCoursesCount, resourceConflictsCount) {
    let score = 0;

    // Schedule change impact
    if (Math.abs(daysDifference) > 30) score += 3;
    else if (Math.abs(daysDifference) > 14) score += 2;
    else if (Math.abs(daysDifference) > 7) score += 1;

    // Affected courses impact
    if (affectedCoursesCount > 5) score += 3;
    else if (affectedCoursesCount > 2) score += 2;
    else if (affectedCoursesCount > 0) score += 1;

    // Resource conflicts impact
    if (resourceConflictsCount > 3) score += 3;
    else if (resourceConflictsCount > 1) score += 2;
    else if (resourceConflictsCount > 0) score += 1;

    if (score >= 7) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Estimate effort required for the change
   */
  estimateChangeEffort(affectedCourses, resourceConflicts) {
    let effort = 1; // Base effort for the change itself

    // Add effort for affected courses
    effort += affectedCourses.length * 0.5;

    // Add effort for resolving resource conflicts
    effort += resourceConflicts.length * 1;

    if (effort <= 2) return 'low';
    if (effort <= 5) return 'medium';
    return 'high';
  }
}

module.exports = new AnalyticsController();