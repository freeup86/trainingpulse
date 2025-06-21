const { query } = require('../config/database');
const { get, setex } = require('../config/redis');
const logger = require('../utils/logger');

class PerformanceAnalyzer {
  constructor() {
    this.cachePrefix = 'performance_analysis:';
    this.cacheTTL = 300; // 5 minutes
  }

  /**
   * Analyze performance metrics for teams, users, and courses
   */
  async analyzePerformance(params = {}) {
    const {
      period = '30d',
      teamId,
      courseType,
      groupBy = 'team',
      includeCompleted = true
    } = params;

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(params);
      
      // Try to get from cache first
      const cachedResult = await this.getCachedResult(cacheKey);
      if (cachedResult) {
        logger.info('Performance analysis retrieved from cache', { params });
        return cachedResult;
      }

      logger.info('Generating fresh performance analysis', { params });

      // Calculate date range
      const { startDate, endDate } = this.calculateDateRange(period);

      // Get performance data
      const [completionMetrics, workloadMetrics, efficiencyMetrics, trendData] = await Promise.all([
        this.getCompletionMetrics(startDate, endDate, { teamId, courseType, includeCompleted }),
        this.getWorkloadMetrics(startDate, endDate, { teamId, courseType }),
        this.getEfficiencyMetrics(startDate, endDate, { teamId, courseType }),
        this.getTrendData(startDate, endDate, { teamId, courseType, groupBy })
      ]);

      // Generate insights
      const insights = this.generateInsights(completionMetrics, workloadMetrics, efficiencyMetrics);

      const result = {
        summary: {
          completionRate: completionMetrics.overallCompletionRate,
          averageCompletionTime: completionMetrics.averageCompletionTime,
          productivityScore: this.calculateProductivityScore(completionMetrics, efficiencyMetrics),
          totalCourses: completionMetrics.totalCourses,
          completedCourses: completionMetrics.completedCourses,
          onTimeCompletions: completionMetrics.onTimeCompletions,
          averageDelayDays: completionMetrics.averageDelayDays
        },
        completion: {
          byPriority: completionMetrics.byPriority,
          byType: completionMetrics.byType,
          byTeam: completionMetrics.byTeam
        },
        workload: {
          teamUtilization: workloadMetrics.teamUtilization,
          userDistribution: workloadMetrics.userDistribution,
          capacityAnalysis: workloadMetrics.capacityAnalysis
        },
        efficiency: {
          averageTimePerStage: efficiencyMetrics.averageTimePerStage,
          bottleneckStages: efficiencyMetrics.bottleneckStages,
          fastestCompletions: efficiencyMetrics.fastestCompletions
        },
        trends: {
          completionTrend: trendData.completionTrend,
          workloadTrend: trendData.workloadTrend,
          efficiencyTrend: trendData.efficiencyTrend
        },
        insights,
        metadata: {
          period,
          startDate,
          endDate,
          groupBy,
          generatedAt: new Date().toISOString(),
          filters: { teamId, courseType, includeCompleted }
        }
      };

      // Cache the result
      await this.cacheResult(cacheKey, result);

      logger.info('Performance analysis completed successfully', {
        totalCourses: result.summary.totalCourses,
        completionRate: result.summary.completionRate
      });

      return result;

    } catch (error) {
      logger.error('Error in performance analysis', {
        error: error.message,
        stack: error.stack,
        params
      });
      throw error;
    }
  }

  /**
   * Get completion metrics
   */
  async getCompletionMetrics(startDate, endDate, filters = {}) {
    const { teamId, courseType, includeCompleted } = filters;
    
    let whereClause = 'WHERE c.created_at >= $1 AND c.created_at <= $2';
    let params = [startDate, endDate];
    let paramIndex = 3;

    if (teamId) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM course_assignments ca 
        JOIN users u ON ca.user_id = u.id 
        WHERE ca.course_id = c.id AND u.team_id = $${paramIndex}
      )`;
      params.push(teamId);
      paramIndex++;
    }

    if (courseType) {
      whereClause += ` AND c.type = $${paramIndex}`;
      params.push(courseType);
      paramIndex++;
    }

    if (!includeCompleted) {
      whereClause += ` AND c.status != $${paramIndex}`;
      params.push('completed');
      paramIndex++;
    }

    // Overall completion metrics
    const overallStatsResult = await query(`
      SELECT 
        COUNT(*) as total_courses,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_courses,
        COUNT(CASE WHEN c.status = 'completed' AND c.completed_at <= c.due_date THEN 1 END) as on_time_completions,
        AVG(CASE 
          WHEN c.status = 'completed' 
          THEN EXTRACT(EPOCH FROM (c.completed_at - c.created_at))/86400
        END) as avg_completion_days,
        AVG(CASE 
          WHEN c.status = 'completed' AND c.completed_at > c.due_date 
          THEN EXTRACT(EPOCH FROM (c.completed_at - c.due_date))/86400
        END) as avg_delay_days
      FROM courses c
      ${whereClause}
    `, params);

    const overallStats = overallStatsResult.rows[0];

    // Completion by priority
    const completionByPriorityResult = await query(`
      SELECT 
        c.priority,
        COUNT(*) as total,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed,
        ROUND(COUNT(CASE WHEN c.status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate
      FROM courses c
      ${whereClause}
      GROUP BY c.priority
      ORDER BY 
        CASE c.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END
    `, params);

    const completionByPriority = completionByPriorityResult.rows;

    // Completion by type
    const completionByTypeResult = await query(`
      SELECT 
        c.type,
        COUNT(*) as total,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed,
        ROUND(COUNT(CASE WHEN c.status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate
      FROM courses c
      ${whereClause}
      GROUP BY c.type
      ORDER BY completion_rate DESC
    `, params);

    const completionByType = completionByTypeResult.rows;

    // Completion by team
    const completionByTeamResult = await query(`
      SELECT 
        t.name as team_name,
        t.id as team_id,
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed,
        ROUND(COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) * 100.0 / COUNT(DISTINCT c.id), 2) as completion_rate
      FROM courses c
      JOIN course_assignments ca ON c.id = ca.course_id
      JOIN users u ON ca.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id
      ${whereClause}
      GROUP BY t.id, t.name
      ORDER BY completion_rate DESC
    `, params);

    const completionByTeam = completionByTeamResult.rows;

    const stats = overallStats || {};
    const completionRate = stats.total_courses > 0 
      ? (stats.completed_courses / stats.total_courses) * 100 
      : 0;

    return {
      totalCourses: stats.total_courses || 0,
      completedCourses: stats.completed_courses || 0,
      onTimeCompletions: stats.on_time_completions || 0,
      overallCompletionRate: Math.round(completionRate * 100) / 100,
      averageCompletionTime: Math.round((stats.avg_completion_days || 0) * 100) / 100,
      averageDelayDays: Math.round((stats.avg_delay_days || 0) * 100) / 100,
      byPriority: completionByPriority.map(row => ({
        priority: row.priority,
        total: row.total,
        completed: row.completed,
        completionRate: parseFloat(row.completion_rate) || 0
      })),
      byType: completionByType.map(row => ({
        type: row.type,
        total: row.total,
        completed: row.completed,
        completionRate: parseFloat(row.completion_rate) || 0
      })),
      byTeam: completionByTeam.map(row => ({
        teamId: row.team_id,
        teamName: row.team_name || 'Unassigned',
        total: row.total,
        completed: row.completed,
        completionRate: parseFloat(row.completion_rate) || 0
      }))
    };
  }

  /**
   * Get workload metrics
   */
  async getWorkloadMetrics(startDate, endDate, filters = {}) {
    const { teamId, courseType } = filters;
    
    let whereClause = 'WHERE c.created_at >= $1 AND c.created_at <= $2';
    let params = [startDate, endDate];
    let paramIndex = 3;

    if (teamId) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM course_assignments ca 
        JOIN users u ON ca.user_id = u.id 
        WHERE ca.course_id = c.id AND u.team_id = $${paramIndex}
      )`;
      params.push(teamId);
      paramIndex++;
    }

    if (courseType) {
      whereClause += ` AND c.type = $${paramIndex}`;
      params.push(courseType);
      paramIndex++;
    }

    // Team utilization
    const teamUtilizationResult = await query(`
      SELECT 
        t.name as team_name,
        t.id as team_id,
        COUNT(DISTINCT c.id) as total_courses,
        COUNT(DISTINCT ca.user_id) as team_members,
        SUM(c.estimated_hours) as total_estimated_hours,
        AVG(u.daily_capacity_hours) as avg_daily_capacity
      FROM courses c
      JOIN course_assignments ca ON c.id = ca.course_id
      JOIN users u ON ca.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id
      ${whereClause}
      GROUP BY t.id, t.name
      ORDER BY total_courses DESC
    `, params);

    const teamUtilization = teamUtilizationResult.rows;

    // User distribution
    const userDistributionResult = await query(`
      SELECT 
        u.name as user_name,
        u.id as user_id,
        u.role,
        t.name as team_name,
        COUNT(DISTINCT c.id) as assigned_courses,
        SUM(c.estimated_hours) as total_hours,
        u.daily_capacity_hours,
        ROUND(SUM(c.estimated_hours) / NULLIF(u.daily_capacity_hours * 30, 0) * 100, 2) as utilization_percentage
      FROM users u
      LEFT JOIN course_assignments ca ON u.id = ca.user_id
      LEFT JOIN courses c ON ca.course_id = c.id AND c.created_at >= $1 AND c.created_at <= $2
      LEFT JOIN teams t ON u.team_id = t.id
      GROUP BY u.id, u.name, u.role, u.daily_capacity_hours, t.name
      HAVING COUNT(DISTINCT c.id) > 0
      ORDER BY utilization_percentage DESC
    `, [startDate, endDate]);

    const userDistribution = userDistributionResult.rows;

    // Capacity analysis - simplified for now
    const capacityStatsResult = await query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        AVG(u.daily_capacity_hours) as avg_daily_capacity,
        SUM(u.daily_capacity_hours) as total_daily_capacity,
        0 as overutilized_users,
        0 as underutilized_users
      FROM users u
      WHERE u.active = true
    `);

    const capacityStats = capacityStatsResult.rows[0];

    return {
      teamUtilization: teamUtilization.map(row => ({
        teamId: row.team_id,
        teamName: row.team_name || 'Unassigned',
        totalCourses: row.total_courses || 0,
        teamMembers: row.team_members || 0,
        totalEstimatedHours: row.total_estimated_hours || 0,
        avgDailyCapacity: row.avg_daily_capacity || 0,
        utilizationRate: row.avg_daily_capacity > 0 
          ? Math.round((row.total_estimated_hours / (row.avg_daily_capacity * 30)) * 100) 
          : 0
      })),
      userDistribution: userDistribution.map(row => ({
        userId: row.user_id,
        userName: row.user_name,
        role: row.role,
        teamName: row.team_name,
        assignedCourses: row.assigned_courses || 0,
        totalHours: row.total_hours || 0,
        dailyCapacity: row.daily_capacity_hours || 0,
        utilizationPercentage: parseFloat(row.utilization_percentage) || 0
      })),
      capacityAnalysis: {
        totalUsers: capacityStats.total_users || 0,
        avgDailyCapacity: capacityStats.avg_daily_capacity || 0,
        totalDailyCapacity: capacityStats.total_daily_capacity || 0,
        overutilizedUsers: capacityStats.overutilized_users || 0,
        underutilizedUsers: capacityStats.underutilized_users || 0
      }
    };
  }

  /**
   * Get efficiency metrics
   */
  async getEfficiencyMetrics(startDate, endDate, filters = {}) {
    const { teamId, courseType } = filters;
    
    let whereClause = 'WHERE c.created_at >= $1 AND c.created_at <= $2';
    let params = [startDate, endDate];
    let paramIndex = 3;

    if (teamId) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM course_assignments ca 
        JOIN users u ON ca.user_id = u.id 
        WHERE ca.course_id = c.id AND u.team_id = $${paramIndex}
      )`;
      params.push(teamId);
      paramIndex++;
    }

    if (courseType) {
      whereClause += ` AND c.type = $${paramIndex}`;
      params.push(courseType);
      paramIndex++;
    }

    // Average time per workflow stage
    const averageTimePerStageResult = await query(`
      SELECT 
        wt.to_state as stage,
        AVG(EXTRACT(EPOCH FROM (wt.created_at - wi.state_entered_at))/86400) as avg_days_in_stage,
        COUNT(*) as transition_count
      FROM workflow_transitions wt
      JOIN workflow_instances wi ON wt.workflow_instance_id = wi.id
      JOIN courses c ON wi.course_id = c.id
      ${whereClause}
      GROUP BY wt.to_state
      ORDER BY avg_days_in_stage DESC
    `, params);

    const averageTimePerStage = averageTimePerStageResult.rows;

    // Bottleneck stages (stages taking longest on average)
    const bottleneckStagesResult = await query(`
      SELECT 
        wt.to_state as stage,
        AVG(EXTRACT(EPOCH FROM (wt.created_at - wi.state_entered_at))/86400) as avg_days,
        COUNT(*) as affected_courses,
        MAX(EXTRACT(EPOCH FROM (wt.created_at - wi.state_entered_at))/86400) as max_days
      FROM workflow_transitions wt
      JOIN workflow_instances wi ON wt.workflow_instance_id = wi.id
      JOIN courses c ON wi.course_id = c.id
      ${whereClause}
      GROUP BY wt.to_state
      HAVING AVG(EXTRACT(EPOCH FROM (wt.created_at - wi.state_entered_at))/86400) > 5
      ORDER BY avg_days DESC
      LIMIT 5
    `, params);

    const bottleneckStages = bottleneckStagesResult.rows;

    // Fastest completions (for benchmarking)
    const fastestCompletionsResult = await query(`
      SELECT 
        c.title,
        c.type,
        c.priority,
        EXTRACT(EPOCH FROM (c.completed_at - c.created_at))/86400 as completion_days,
        t.name as team_name
      FROM courses c
      LEFT JOIN course_assignments ca ON c.id = ca.course_id
      LEFT JOIN users u ON ca.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id
      ${whereClause} AND c.status = 'completed'
      ORDER BY completion_days ASC
      LIMIT 10
    `, params);

    const fastestCompletions = fastestCompletionsResult.rows;

    return {
      averageTimePerStage: averageTimePerStage.map(row => ({
        stage: row.stage,
        averageDays: Math.round((row.avg_days_in_stage || 0) * 100) / 100,
        transitionCount: row.transition_count || 0
      })),
      bottleneckStages: bottleneckStages.map(row => ({
        stage: row.stage,
        averageDays: Math.round((row.avg_days || 0) * 100) / 100,
        affectedCourses: row.affected_courses || 0,
        maxDays: row.max_days || 0
      })),
      fastestCompletions: fastestCompletions.map(row => ({
        title: row.title,
        type: row.type,
        priority: row.priority,
        completionDays: row.completion_days || 0,
        teamName: row.team_name
      }))
    };
  }

  /**
   * Get trend data over time
   */
  async getTrendData(startDate, endDate, filters = {}) {
    const { teamId, courseType, groupBy } = filters;
    
    let whereClause = 'WHERE c.created_at >= $1 AND c.created_at <= $2';
    let params = [startDate, endDate];
    let paramIndex = 3;

    if (teamId) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM course_assignments ca 
        JOIN users u ON ca.user_id = u.id 
        WHERE ca.course_id = c.id AND u.team_id = $${paramIndex}
      )`;
      params.push(teamId);
      paramIndex++;
    }

    if (courseType) {
      whereClause += ` AND c.type = $${paramIndex}`;
      params.push(courseType);
      paramIndex++;
    }

    // Completion trend by week
    const completionTrendResult = await query(`
      SELECT 
        EXTRACT(YEAR FROM c.created_at) * 100 + EXTRACT(WEEK FROM c.created_at) as week,
        DATE_TRUNC('week', c.created_at)::date as week_start,
        COUNT(*) as courses_created,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as courses_completed,
        AVG(CASE WHEN c.status = 'completed' THEN EXTRACT(EPOCH FROM (c.completed_at - c.created_at))/86400 END) as avg_completion_time
      FROM courses c
      ${whereClause}
      GROUP BY week, week_start
      ORDER BY week_start
    `, params);

    const completionTrend = completionTrendResult.rows;

    // Workload trend
    const workloadTrendResult = await query(`
      SELECT 
        EXTRACT(YEAR FROM c.created_at) * 100 + EXTRACT(WEEK FROM c.created_at) as week,
        DATE_TRUNC('week', c.created_at)::date as week_start,
        COUNT(DISTINCT ca.user_id) as active_users,
        SUM(c.estimated_hours) as total_hours,
        COUNT(*) as total_courses
      FROM courses c
      LEFT JOIN course_assignments ca ON c.id = ca.course_id
      ${whereClause}
      GROUP BY week, week_start
      ORDER BY week_start
    `, params);

    const workloadTrend = workloadTrendResult.rows;

    return {
      completionTrend: completionTrend.map(row => ({
        week: row.week_start,
        coursesCreated: row.courses_created || 0,
        coursesCompleted: row.courses_completed || 0,
        completionRate: row.courses_created > 0 
          ? Math.round((row.courses_completed / row.courses_created) * 100) 
          : 0,
        avgCompletionTime: Math.round((row.avg_completion_time || 0) * 100) / 100
      })),
      workloadTrend: workloadTrend.map(row => ({
        week: row.week_start,
        activeUsers: row.active_users || 0,
        totalHours: row.total_hours || 0,
        totalCourses: row.total_courses || 0,
        avgHoursPerUser: row.active_users > 0 
          ? Math.round((row.total_hours / row.active_users) * 100) / 100 
          : 0
      })),
      efficiencyTrend: [] // Placeholder for future implementation
    };
  }

  /**
   * Generate actionable insights
   */
  generateInsights(completionMetrics, workloadMetrics, efficiencyMetrics) {
    const insights = [];

    // Completion rate insights
    if (completionMetrics.overallCompletionRate < 70) {
      insights.push({
        type: 'warning',
        category: 'completion',
        title: 'Low Completion Rate',
        message: `Overall completion rate is ${completionMetrics.overallCompletionRate}%, which is below the recommended 70%`,
        recommendation: 'Review course assignments and deadlines to identify bottlenecks'
      });
    }

    // Workload insights
    const overutilized = workloadMetrics.capacityAnalysis.overutilizedUsers;
    if (overutilized > 0) {
      insights.push({
        type: 'alert',
        category: 'workload',
        title: 'Resource Overutilization',
        message: `${overutilized} team members are over 100% utilized`,
        recommendation: 'Consider redistributing workload or extending deadlines'
      });
    }

    // Efficiency insights
    const bottlenecks = efficiencyMetrics.bottleneckStages.length;
    if (bottlenecks > 0) {
      const topBottleneck = efficiencyMetrics.bottleneckStages[0];
      insights.push({
        type: 'info',
        category: 'efficiency',
        title: 'Workflow Bottleneck Detected',
        message: `${topBottleneck.stage} stage is taking ${topBottleneck.averageDays} days on average`,
        recommendation: 'Focus on optimizing this workflow stage'
      });
    }

    // Positive insights
    if (completionMetrics.overallCompletionRate >= 85) {
      insights.push({
        type: 'success',
        category: 'completion',
        title: 'Excellent Performance',
        message: `Team is maintaining ${completionMetrics.overallCompletionRate}% completion rate`,
        recommendation: 'Continue current practices and consider sharing best practices'
      });
    }

    return insights;
  }

  /**
   * Calculate productivity score
   */
  calculateProductivityScore(completionMetrics, efficiencyMetrics) {
    const completionWeight = 0.4;
    const timelinessWeight = 0.3;
    const efficiencyWeight = 0.3;

    const completionScore = completionMetrics.overallCompletionRate;
    const timelinessScore = completionMetrics.totalCourses > 0 
      ? (completionMetrics.onTimeCompletions / completionMetrics.totalCourses) * 100 
      : 0;
    const efficiencyScore = Math.max(0, 100 - (completionMetrics.averageCompletionTime * 2));

    const productivityScore = (
      (completionScore * completionWeight) +
      (timelinessScore * timelinessWeight) +
      (efficiencyScore * efficiencyWeight)
    );

    return Math.round(productivityScore * 100) / 100;
  }

  /**
   * Calculate date range based on period
   */
  calculateDateRange(period) {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * Generate cache key
   */
  generateCacheKey(params) {
    const keyParts = [
      this.cachePrefix,
      params.period || '30d',
      params.teamId || 'all',
      params.courseType || 'all',
      params.groupBy || 'team',
      params.includeCompleted ? 'with_completed' : 'active_only'
    ];
    return keyParts.join(':');
  }

  /**
   * Get cached result
   */
  async getCachedResult(cacheKey) {
    try {
      const cached = await get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Failed to retrieve cached performance analysis', { 
        error: error.message, 
        cacheKey 
      });
      return null;
    }
  }

  /**
   * Cache result
   */
  async cacheResult(cacheKey, result) {
    try {
      await setex(cacheKey, this.cacheTTL, JSON.stringify(result));
    } catch (error) {
      logger.warn('Failed to cache performance analysis', { 
        error: error.message, 
        cacheKey 
      });
    }
  }
}

module.exports = PerformanceAnalyzer;