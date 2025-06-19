const { query, transaction } = require('../config/database');
const { get, set } = require('../config/redis');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

/**
 * Dependency Management and Impact Analysis Service
 * Handles course dependencies and calculates cascade effects of changes
 */
class DependencyManager {
  constructor() {
    this.cachePrefix = 'dependency_analysis';
    this.maxDepth = 10; // Prevent infinite loops
  }

  /**
   * Create a dependency relationship between courses
   */
  async createDependency(courseId, dependsOnCourseId, dependencyType = 'blocks', userId) {
    try {
      // Validate courses exist
      const coursesResult = await query(`
        SELECT id, title FROM courses 
        WHERE id IN ($1, $2) AND status != 'deleted'
      `, [courseId, dependsOnCourseId]);

      if (coursesResult.rows.length !== 2) {
        throw new ValidationError('One or both courses not found');
      }

      // Check for circular dependencies
      const wouldCreateCircle = await this.wouldCreateCircularDependency(courseId, dependsOnCourseId);
      if (wouldCreateCircle) {
        throw new ValidationError('Cannot create dependency - would create circular reference');
      }

      // Check if dependency already exists
      const existingResult = await query(`
        SELECT id FROM course_dependencies 
        WHERE course_id = $1 AND depends_on_course_id = $2
      `, [courseId, dependsOnCourseId]);

      if (existingResult.rows.length > 0) {
        throw new ValidationError('Dependency already exists');
      }

      const dependency = await transaction(async (client) => {
        // Create dependency
        const result = await client.query(`
          INSERT INTO course_dependencies (course_id, depends_on_course_id, dependency_type, created_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          RETURNING *
        `, [courseId, dependsOnCourseId, dependencyType]);

        // Log the creation
        await client.query(`
          INSERT INTO audit_logs (
            user_id, entity_type, entity_id, action, changes, created_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
          userId,
          'dependency',
          result.rows[0].id,
          'created',
          JSON.stringify({
            courseId,
            dependsOnCourseId,
            dependencyType
          })
        ]);

        return result.rows[0];
      });

      // Clear relevant caches
      await this.clearDependencyCache(courseId);
      await this.clearDependencyCache(dependsOnCourseId);

      logger.info('Course dependency created', {
        dependencyId: dependency.id,
        courseId,
        dependsOnCourseId,
        dependencyType,
        userId
      });

      return dependency;

    } catch (error) {
      logger.logError(error, {
        context: 'DependencyManager.createDependency',
        courseId,
        dependsOnCourseId,
        userId
      });
      throw error;
    }
  }

  /**
   * Remove a dependency relationship
   */
  async removeDependency(dependencyId, userId) {
    try {
      const dependencyResult = await query(
        'SELECT * FROM course_dependencies WHERE id = $1',
        [dependencyId]
      );

      if (dependencyResult.rows.length === 0) {
        throw new NotFoundError('Dependency not found');
      }

      const dependency = dependencyResult.rows[0];

      await transaction(async (client) => {
        // Delete dependency
        await client.query('DELETE FROM course_dependencies WHERE id = $1', [dependencyId]);

        // Log the deletion
        await client.query(`
          INSERT INTO audit_logs (
            user_id, entity_type, entity_id, action, changes, created_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [
          userId,
          'dependency',
          dependencyId,
          'deleted',
          JSON.stringify(dependency)
        ]);
      });

      // Clear relevant caches
      await this.clearDependencyCache(dependency.course_id);
      await this.clearDependencyCache(dependency.depends_on_course_id);

      logger.info('Course dependency removed', {
        dependencyId,
        courseId: dependency.course_id,
        dependsOnCourseId: dependency.depends_on_course_id,
        userId
      });

      return { success: true, message: 'Dependency removed successfully' };

    } catch (error) {
      logger.logError(error, {
        context: 'DependencyManager.removeDependency',
        dependencyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get dependency graph for a course
   */
  async getDependencyGraph(courseId, options = {}) {
    const { 
      includeUpstream = true, 
      includeDownstream = true, 
      maxDepth = this.maxDepth,
      includeMetadata = true 
    } = options;

    try {
      const cacheKey = `${this.cachePrefix}:graph:${courseId}:${includeUpstream}:${includeDownstream}:${maxDepth}`;
      
      // Check cache
      const cached = await get(cacheKey);
      if (cached) {
        return cached;
      }

      const graph = {
        courseId: parseInt(courseId),
        upstream: includeUpstream ? await this.getUpstreamDependencies(courseId, maxDepth) : [],
        downstream: includeDownstream ? await this.getDownstreamDependencies(courseId, maxDepth) : [],
        metadata: includeMetadata ? await this.getDependencyMetadata(courseId) : null
      };

      // Cache for 10 minutes
      await set(cacheKey, graph, 600);

      return graph;

    } catch (error) {
      logger.logError(error, {
        context: 'DependencyManager.getDependencyGraph',
        courseId,
        options
      });
      throw error;
    }
  }

  /**
   * Analyze impact of changing a course's schedule
   */
  async analyzeScheduleImpact(courseId, newDueDate, options = {}) {
    const {
      includeResourceImpact = true,
      maxDepth = this.maxDepth,
      propagationType = 'push' // 'push' or 'compress'
    } = options;

    try {
      // Get current course info
      const courseResult = await query(
        'SELECT id, title, due_date, start_date, estimated_hours FROM courses WHERE id = $1',
        [courseId]
      );

      if (courseResult.rows.length === 0) {
        throw new NotFoundError('Course not found');
      }

      const course = courseResult.rows[0];
      const currentDueDate = new Date(course.due_date);
      const proposedDueDate = new Date(newDueDate);
      const daysDifference = Math.ceil((proposedDueDate - currentDueDate) / (1000 * 60 * 60 * 24));

      // Get dependency graph
      const dependencyGraph = await this.getDependencyGraph(courseId, { maxDepth });

      // Calculate impact on downstream courses
      const impactedCourses = await this.calculateDownstreamImpact(
        courseId, 
        daysDifference, 
        dependencyGraph.downstream,
        propagationType
      );

      // Analyze resource impact if requested
      let resourceImpact = null;
      if (includeResourceImpact) {
        resourceImpact = await this.analyzeResourceImpact(courseId, newDueDate, impactedCourses);
      }

      // Calculate overall impact severity
      const severity = this.calculateImpactSeverity(daysDifference, impactedCourses, resourceImpact);

      // Generate recommendations
      const recommendations = this.generateImpactRecommendations(
        course,
        daysDifference,
        impactedCourses,
        resourceImpact,
        severity
      );

      const analysis = {
        originalCourse: {
          id: course.id,
          title: course.title,
          currentDueDate: course.due_date,
          proposedDueDate: newDueDate,
          daysDifference,
          changeType: daysDifference > 0 ? 'delay' : daysDifference < 0 ? 'acceleration' : 'no_change'
        },
        impactedCourses,
        resourceImpact,
        severity,
        recommendations,
        summary: {
          totalCoursesAffected: impactedCourses.length,
          criticalImpacts: impactedCourses.filter(c => c.impactSeverity === 'critical').length,
          resourceConflicts: resourceImpact?.conflicts?.length || 0,
          estimatedEffort: this.estimateImplementationEffort(impactedCourses, resourceImpact)
        },
        options: {
          propagationType,
          maxDepth,
          analyzedAt: new Date().toISOString()
        }
      };

      return analysis;

    } catch (error) {
      logger.logError(error, {
        context: 'DependencyManager.analyzeScheduleImpact',
        courseId,
        newDueDate,
        options
      });
      throw error;
    }
  }

  /**
   * Get upstream dependencies (courses this course depends on)
   */
  async getUpstreamDependencies(courseId, maxDepth, currentDepth = 0, visited = new Set()) {
    if (currentDepth >= maxDepth || visited.has(courseId)) {
      return [];
    }

    visited.add(courseId);

    const result = await query(`
      SELECT 
        c.id,
        c.title,
        c.due_date,
        c.start_date,
        c.status,
        c.calculated_status,
        c.completion_percentage,
        c.type,
        c.priority,
        cd.dependency_type,
        ${currentDepth + 1} as depth
      FROM course_dependencies cd
      JOIN courses c ON cd.depends_on_course_id = c.id
      WHERE cd.course_id = $1
        AND c.status NOT IN ('deleted', 'cancelled')
      ORDER BY c.due_date ASC
    `, [courseId]);

    const directUpstream = result.rows;
    let allUpstream = [...directUpstream];

    // Recursively get upstream dependencies
    for (const upstream of directUpstream) {
      const nestedUpstream = await this.getUpstreamDependencies(
        upstream.id,
        maxDepth,
        currentDepth + 1,
        new Set(visited)
      );
      allUpstream = allUpstream.concat(nestedUpstream);
    }

    return allUpstream;
  }

  /**
   * Get downstream dependencies (courses that depend on this course)
   */
  async getDownstreamDependencies(courseId, maxDepth, currentDepth = 0, visited = new Set()) {
    if (currentDepth >= maxDepth || visited.has(courseId)) {
      return [];
    }

    visited.add(courseId);

    const result = await query(`
      SELECT 
        c.id,
        c.title,
        c.due_date,
        c.start_date,
        c.status,
        c.calculated_status,
        c.completion_percentage,
        c.type,
        c.priority,
        cd.dependency_type,
        ${currentDepth + 1} as depth
      FROM course_dependencies cd
      JOIN courses c ON cd.course_id = c.id
      WHERE cd.depends_on_course_id = $1
        AND c.status NOT IN ('deleted', 'cancelled')
      ORDER BY c.due_date ASC
    `, [courseId]);

    const directDownstream = result.rows;
    let allDownstream = [...directDownstream];

    // Recursively get downstream dependencies
    for (const downstream of directDownstream) {
      const nestedDownstream = await this.getDownstreamDependencies(
        downstream.id,
        maxDepth,
        currentDepth + 1,
        new Set(visited)
      );
      allDownstream = allDownstream.concat(nestedDownstream);
    }

    return allDownstream;
  }

  /**
   * Calculate impact on downstream courses
   */
  async calculateDownstreamImpact(courseId, daysDifference, downstreamCourses, propagationType) {
    const impactedCourses = [];

    for (const course of downstreamCourses) {
      let proposedDueDate;
      let impactSeverity = 'low';
      let recommendations = [];

      if (propagationType === 'push') {
        // Push all downstream courses by the same amount
        const currentDue = new Date(course.due_date);
        proposedDueDate = new Date(currentDue.getTime() + (daysDifference * 24 * 60 * 60 * 1000));
        
        if (Math.abs(daysDifference) > 7) {
          impactSeverity = Math.abs(daysDifference) > 21 ? 'critical' : 'high';
        } else if (Math.abs(daysDifference) > 3) {
          impactSeverity = 'medium';
        }
      } else {
        // Compress: try to maintain original dates if possible
        proposedDueDate = new Date(course.due_date);
        
        if (daysDifference > 0) {
          // If parent is delayed, downstream might need compression
          impactSeverity = 'medium';
          recommendations.push('Consider accelerating development or reducing scope');
        }
      }

      // Calculate additional impact factors
      const timeUntilDue = Math.ceil((new Date(course.due_date) - new Date()) / (1000 * 60 * 60 * 24));
      
      if (timeUntilDue < 14 && daysDifference > 0) {
        impactSeverity = 'critical';
        recommendations.push('Course due within 2 weeks - critical timing conflict');
      }

      if (course.priority === 'critical' && daysDifference > 0) {
        impactSeverity = 'critical';
        recommendations.push('Critical priority course affected');
      }

      impactedCourses.push({
        id: course.id,
        title: course.title,
        currentDueDate: course.due_date,
        proposedDueDate: proposedDueDate.toISOString(),
        daysDifference,
        impactSeverity,
        depth: course.depth,
        dependencyType: course.dependency_type,
        currentStatus: course.calculated_status || course.status,
        completionPercentage: course.completion_percentage,
        priority: course.priority,
        timeUntilDue,
        recommendations
      });
    }

    return impactedCourses;
  }

  /**
   * Analyze resource impact of schedule changes
   */
  async analyzeResourceImpact(courseId, newDueDate, impactedCourses) {
    try {
      // Get all users involved in the affected courses
      const affectedCourseIds = [courseId, ...impactedCourses.map(c => c.id)];
      
      const resourceResult = await query(`
        SELECT DISTINCT
          u.id as user_id,
          u.name,
          u.email,
          u.daily_capacity_hours,
          ca.course_id,
          ca.role,
          c.title as course_title,
          c.due_date as current_due_date
        FROM course_assignments ca
        JOIN users u ON ca.user_id = u.id
        JOIN courses c ON ca.course_id = c.id
        WHERE ca.course_id = ANY($1)
          AND u.active = true
        ORDER BY u.name, c.due_date
      `, [affectedCourseIds]);

      const resources = resourceResult.rows;

      // Group by user to analyze conflicts
      const userConflicts = {};
      resources.forEach(resource => {
        if (!userConflicts[resource.user_id]) {
          userConflicts[resource.user_id] = {
            userId: resource.user_id,
            name: resource.name,
            email: resource.email,
            dailyCapacity: resource.daily_capacity_hours,
            affectedCourses: [],
            conflictSeverity: 'low'
          };
        }

        userConflicts[resource.user_id].affectedCourses.push({
          courseId: resource.course_id,
          title: resource.course_title,
          role: resource.role,
          currentDueDate: resource.current_due_date,
          proposedDueDate: resource.course_id === courseId ? newDueDate : 
            impactedCourses.find(ic => ic.id === resource.course_id)?.proposedDueDate
        });
      });

      // Determine conflict severity for each user
      Object.values(userConflicts).forEach(user => {
        const courseCount = user.affectedCourses.length;
        const hasOverlappingDeadlines = this.checkForOverlappingDeadlines(user.affectedCourses);
        
        if (courseCount > 3 || hasOverlappingDeadlines) {
          user.conflictSeverity = 'high';
        } else if (courseCount > 1) {
          user.conflictSeverity = 'medium';
        }
      });

      return {
        affectedUsers: Object.values(userConflicts),
        conflicts: Object.values(userConflicts).filter(u => u.conflictSeverity !== 'low'),
        summary: {
          totalUsersAffected: Object.keys(userConflicts).length,
          highConflictUsers: Object.values(userConflicts).filter(u => u.conflictSeverity === 'high').length,
          mediumConflictUsers: Object.values(userConflicts).filter(u => u.conflictSeverity === 'medium').length
        }
      };

    } catch (error) {
      logger.logError(error, {
        context: 'DependencyManager.analyzeResourceImpact',
        courseId,
        newDueDate
      });
      return null;
    }
  }

  /**
   * Check if a dependency would create a circular reference
   */
  async wouldCreateCircularDependency(courseId, dependsOnCourseId) {
    try {
      // Check if dependsOnCourseId already depends on courseId (directly or indirectly)
      const downstreamCourses = await this.getDownstreamDependencies(dependsOnCourseId);
      return downstreamCourses.some(course => course.id === courseId);
    } catch (error) {
      logger.logError(error, {
        context: 'DependencyManager.wouldCreateCircularDependency',
        courseId,
        dependsOnCourseId
      });
      return false; // Err on the side of caution
    }
  }

  /**
   * Get dependency metadata for a course
   */
  async getDependencyMetadata(courseId) {
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM course_dependencies WHERE course_id = $1) as depends_on_count,
          (SELECT COUNT(*) FROM course_dependencies WHERE depends_on_course_id = $1) as dependents_count,
          (SELECT COUNT(*) FROM course_dependencies cd1 
           WHERE EXISTS (
             SELECT 1 FROM course_dependencies cd2 
             WHERE cd2.course_id = cd1.depends_on_course_id 
             AND cd2.depends_on_course_id = $1
           )) as indirect_dependencies
      `, [courseId]);

      return result.rows[0] || {
        depends_on_count: 0,
        dependents_count: 0,
        indirect_dependencies: 0
      };

    } catch (error) {
      logger.logError(error, {
        context: 'DependencyManager.getDependencyMetadata',
        courseId
      });
      return null;
    }
  }

  /**
   * Calculate overall impact severity
   */
  calculateImpactSeverity(daysDifference, impactedCourses, resourceImpact) {
    let score = 0;

    // Schedule change magnitude
    const absDays = Math.abs(daysDifference);
    if (absDays > 30) score += 4;
    else if (absDays > 14) score += 3;
    else if (absDays > 7) score += 2;
    else if (absDays > 0) score += 1;

    // Number of impacted courses
    const impactedCount = impactedCourses.length;
    if (impactedCount > 5) score += 3;
    else if (impactedCount > 2) score += 2;
    else if (impactedCount > 0) score += 1;

    // Critical courses affected
    const criticalCount = impactedCourses.filter(c => c.impactSeverity === 'critical').length;
    score += criticalCount * 2;

    // Resource conflicts
    if (resourceImpact?.conflicts) {
      const highConflicts = resourceImpact.conflicts.filter(c => c.conflictSeverity === 'high').length;
      score += highConflicts * 2;
      score += resourceImpact.conflicts.length;
    }

    // Determine severity
    if (score >= 10) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Generate impact recommendations
   */
  generateImpactRecommendations(course, daysDifference, impactedCourses, resourceImpact, severity) {
    const recommendations = [];

    if (severity === 'critical') {
      recommendations.push({
        type: 'critical_alert',
        priority: 'critical',
        title: 'Critical Impact Detected',
        description: 'This schedule change has critical impact across multiple courses and resources.'
      });
    }

    if (Math.abs(daysDifference) > 14) {
      recommendations.push({
        type: 'stakeholder_communication',
        priority: 'high',
        title: 'Stakeholder Communication Required',
        description: `Significant schedule change (${Math.abs(daysDifference)} days) requires stakeholder notification.`
      });
    }

    if (impactedCourses.length > 0) {
      recommendations.push({
        type: 'dependency_review',
        priority: 'medium',
        title: 'Review Dependent Courses',
        description: `${impactedCourses.length} dependent courses need schedule review and possible adjustment.`
      });
    }

    if (resourceImpact?.conflicts?.length > 0) {
      recommendations.push({
        type: 'resource_reallocation',
        priority: 'high',
        title: 'Resource Conflicts Detected',
        description: `${resourceImpact.conflicts.length} team members have scheduling conflicts that need resolution.`
      });
    }

    const criticalCourses = impactedCourses.filter(c => c.priority === 'critical');
    if (criticalCourses.length > 0) {
      recommendations.push({
        type: 'priority_escalation',
        priority: 'critical',
        title: 'Critical Priority Courses Affected',
        description: `${criticalCourses.length} critical priority courses are impacted.`
      });
    }

    return recommendations;
  }

  /**
   * Check for overlapping deadlines
   */
  checkForOverlappingDeadlines(courses) {
    const sortedCourses = courses.sort((a, b) => 
      new Date(a.proposedDueDate || a.currentDueDate) - new Date(b.proposedDueDate || b.currentDueDate)
    );

    for (let i = 0; i < sortedCourses.length - 1; i++) {
      const current = new Date(sortedCourses[i].proposedDueDate || sortedCourses[i].currentDueDate);
      const next = new Date(sortedCourses[i + 1].proposedDueDate || sortedCourses[i + 1].currentDueDate);
      
      // If courses are due within 7 days of each other, consider it overlapping
      if (Math.abs(next - current) < 7 * 24 * 60 * 60 * 1000) {
        return true;
      }
    }

    return false;
  }

  /**
   * Estimate implementation effort
   */
  estimateImplementationEffort(impactedCourses, resourceImpact) {
    let effort = 1; // Base effort

    // Add effort for each impacted course
    effort += impactedCourses.length * 0.5;

    // Add more effort for critical impacts
    effort += impactedCourses.filter(c => c.impactSeverity === 'critical').length;

    // Add effort for resource conflicts
    if (resourceImpact?.conflicts) {
      effort += resourceImpact.conflicts.length * 0.5;
    }

    if (effort <= 2) return 'low';
    if (effort <= 5) return 'medium';
    return 'high';
  }

  /**
   * Clear dependency cache for a course
   */
  async clearDependencyCache(courseId) {
    try {
      const { invalidatePattern } = require('../config/redis');
      await invalidatePattern(`${this.cachePrefix}:*:${courseId}:*`);
      await invalidatePattern(`${this.cachePrefix}:graph:${courseId}:*`);
    } catch (error) {
      logger.logError(error, {
        context: 'DependencyManager.clearDependencyCache',
        courseId
      });
    }
  }
}

module.exports = DependencyManager;