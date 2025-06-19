const { query } = require('../config/database');
const { get, set } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Bottleneck Detection Analytics Service
 * Identifies workflow delays and performance bottlenecks in real-time
 */
class BottleneckAnalyzer {
  constructor() {
    this.cachePrefix = 'bottleneck_analysis';
    this.defaultThreshold = 2.0; // 2x average time = bottleneck
  }

  /**
   * Analyze workflow bottlenecks across the system
   */
  async analyzeBottlenecks(options = {}) {
    const {
      period = '30d',
      groupBy = 'stage',
      threshold = this.defaultThreshold,
      includeResolved = false,
      teamId = null,
      courseType = null
    } = options;

    try {
      const cacheKey = `${this.cachePrefix}:${period}:${groupBy}:${threshold}:${teamId}:${courseType}`;
      
      // Check cache first (5 minute cache)
      const cached = await get(cacheKey);
      if (cached && !includeResolved) {
        return cached;
      }

      const analysis = await this.performBottleneckAnalysis(period, groupBy, threshold, teamId, courseType);
      
      // Cache the results
      await set(cacheKey, analysis, 300); // 5 minutes
      
      return analysis;

    } catch (error) {
      logger.logError(error, {
        context: 'BottleneckAnalyzer.analyzeBottlenecks',
        options
      });
      throw error;
    }
  }

  /**
   * Perform the actual bottleneck analysis
   */
  async performBottleneckAnalysis(period, groupBy, threshold, teamId, courseType) {
    const dateFilter = this.getPeriodFilter(period);
    
    let baseQuery = `
      WITH workflow_durations AS (
        SELECT 
          wt.from_state,
          wt.to_state,
          wt.triggered_by,
          u.name as user_name,
          u.email as user_email,
          u.team_id,
          c.type as course_type,
          c.priority as course_priority,
          c.title as course_title,
          EXTRACT(EPOCH FROM (wt.created_at - LAG(wt.created_at) OVER (
            PARTITION BY wt.workflow_instance_id 
            ORDER BY wt.created_at
          ))) / 3600 as duration_hours,
          wt.created_at,
          wi.course_id
        FROM workflow_transitions wt
        JOIN workflow_instances wi ON wt.workflow_instance_id = wi.id
        JOIN courses c ON wi.course_id = c.id
        LEFT JOIN users u ON wt.triggered_by = u.id
        WHERE wt.created_at >= NOW() - INTERVAL '${dateFilter}'
          AND wt.from_state IS NOT NULL
    `;

    const params = [];
    let paramCount = 0;

    if (teamId) {
      baseQuery += ` AND u.team_id = $${++paramCount}`;
      params.push(teamId);
    }

    if (courseType) {
      baseQuery += ` AND c.type = $${++paramCount}`;
      params.push(courseType);
    }

    baseQuery += `
      ),
      stage_stats AS (
        SELECT 
          ${this.getGroupByField(groupBy)} as entity,
          COUNT(*) as total_transitions,
          AVG(duration_hours) as avg_hours,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_hours) as median_hours,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY duration_hours) as p75_hours,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_hours) as p95_hours,
          STDDEV(duration_hours) as stddev_hours,
          MIN(duration_hours) as min_hours,
          MAX(duration_hours) as max_hours,
          COUNT(CASE WHEN duration_hours > (
            SELECT AVG(duration_hours) * ${threshold} 
            FROM workflow_durations wd2 
            WHERE ${this.getGroupByField(groupBy, 'wd2')} = ${this.getGroupByField(groupBy, 'wd')}
          ) THEN 1 END) as bottleneck_count
        FROM workflow_durations wd
        WHERE duration_hours IS NOT NULL 
          AND duration_hours > 0
          AND duration_hours < 720 -- Exclude outliers > 30 days
        GROUP BY ${this.getGroupByField(groupBy)}
        HAVING COUNT(*) >= 3 -- Need at least 3 samples for meaningful analysis
      )
      SELECT 
        entity,
        total_transitions,
        ROUND(avg_hours::numeric, 2) as avg_hours,
        ROUND(median_hours::numeric, 2) as median_hours,
        ROUND(p75_hours::numeric, 2) as p75_hours,
        ROUND(p95_hours::numeric, 2) as p95_hours,
        ROUND(stddev_hours::numeric, 2) as stddev_hours,
        ROUND(min_hours::numeric, 2) as min_hours,
        ROUND(max_hours::numeric, 2) as max_hours,
        bottleneck_count,
        ROUND((bottleneck_count::float / total_transitions * 100)::numeric, 1) as bottleneck_percentage,
        CASE 
          WHEN avg_hours > (SELECT AVG(avg_hours) * ${threshold} FROM stage_stats) THEN 'critical'
          WHEN avg_hours > (SELECT AVG(avg_hours) * ${threshold * 0.8} FROM stage_stats) THEN 'high'
          WHEN avg_hours > (SELECT AVG(avg_hours) * ${threshold * 0.6} FROM stage_stats) THEN 'medium'
          ELSE 'low'
        END as severity
      FROM stage_stats
      ORDER BY avg_hours DESC, bottleneck_percentage DESC
    `;

    const result = await query(baseQuery, params);
    const bottlenecks = result.rows;

    // Calculate overall statistics
    const summary = this.calculateSummaryStats(bottlenecks, threshold);

    // Get detailed examples for critical bottlenecks
    const examples = await this.getBottleneckExamples(period, bottlenecks, teamId, courseType);

    // Generate recommendations
    const recommendations = this.generateRecommendations(bottlenecks, summary);

    // Calculate trends for all bottlenecks
    const bottlenecksWithTrends = await Promise.all(
      bottlenecks.map(async (b) => ({
        ...b,
        trend: await this.calculateTrend(b.entity, groupBy, period),
        recommendation: this.getSpecificRecommendation(b)
      }))
    );

    return {
      bottlenecks: bottlenecksWithTrends,
      summary,
      examples,
      recommendations,
      analysis: {
        period,
        groupBy,
        threshold,
        generatedAt: new Date().toISOString(),
        sampleSize: bottlenecks.reduce((sum, b) => sum + parseInt(b.total_transitions), 0)
      }
    };
  }

  /**
   * Get the appropriate GROUP BY field based on analysis type
   */
  getGroupByField(groupBy, alias = 'wd') {
    switch (groupBy) {
      case 'stage':
        return `${alias}.from_state`;
      case 'reviewer':
        return `${alias}.user_email`;
      case 'course_type':
        return `${alias}.course_type`;
      case 'team':
        return `${alias}.team_id`;
      case 'priority':
        return `${alias}.course_priority`;
      default:
        return `${alias}.from_state`;
    }
  }

  /**
   * Convert period string to SQL interval
   */
  getPeriodFilter(period) {
    const periodMap = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      '6m': '6 months',
      '1y': '1 year'
    };
    return periodMap[period] || '30 days';
  }

  /**
   * Calculate overall summary statistics
   */
  calculateSummaryStats(bottlenecks, threshold) {
    if (bottlenecks.length === 0) {
      return {
        totalBottlenecks: 0,
        criticalBottlenecks: 0,
        averageDelay: 0,
        affectedCourses: 0,
        worstPerformer: null,
        improvementPotential: 0
      };
    }

    const critical = bottlenecks.filter(b => b.severity === 'critical');
    const totalDelay = bottlenecks.reduce((sum, b) => sum + parseFloat(b.avg_hours), 0);
    const averageDelay = totalDelay / bottlenecks.length;
    
    // Estimate affected courses (rough calculation)
    const affectedCourses = bottlenecks.reduce((sum, b) => sum + parseInt(b.total_transitions), 0);
    
    const worstPerformer = bottlenecks[0]; // Already sorted by avg_hours DESC
    
    // Calculate improvement potential (hours that could be saved)
    const improvementPotential = bottlenecks
      .filter(b => b.severity === 'critical' || b.severity === 'high')
      .reduce((sum, b) => sum + (parseFloat(b.avg_hours) * parseInt(b.total_transitions)), 0);

    return {
      totalBottlenecks: bottlenecks.length,
      criticalBottlenecks: critical.length,
      averageDelay: Math.round(averageDelay * 100) / 100,
      affectedCourses,
      worstPerformer: worstPerformer ? {
        entity: worstPerformer.entity,
        avgHours: parseFloat(worstPerformer.avg_hours),
        severity: worstPerformer.severity
      } : null,
      improvementPotential: Math.round(improvementPotential * 100) / 100
    };
  }

  /**
   * Get specific examples of bottleneck incidents
   */
  async getBottleneckExamples(period, bottlenecks, teamId, courseType) {
    const criticalBottlenecks = bottlenecks
      .filter(b => b.severity === 'critical' || b.severity === 'high')
      .slice(0, 3); // Top 3 bottlenecks

    const examples = [];

    for (const bottleneck of criticalBottlenecks) {
      try {
        const dateFilter = this.getPeriodFilter(period);
        
        let exampleQuery = `
          SELECT 
            c.id as course_id,
            c.title as course_title,
            c.type as course_type,
            c.priority,
            wt.from_state,
            wt.to_state,
            wt.created_at,
            EXTRACT(EPOCH FROM (wt.created_at - LAG(wt.created_at) OVER (
              PARTITION BY wt.workflow_instance_id 
              ORDER BY wt.created_at
            ))) / 3600 as duration_hours,
            u.name as reviewer_name,
            u.email as reviewer_email
          FROM workflow_transitions wt
          JOIN workflow_instances wi ON wt.workflow_instance_id = wi.id
          JOIN courses c ON wi.course_id = c.id
          LEFT JOIN users u ON wt.triggered_by = u.id
          WHERE wt.created_at >= NOW() - INTERVAL '${dateFilter}'
            AND wt.from_state = $1
            AND wt.from_state IS NOT NULL
        `;

        const params = [bottleneck.entity];
        let paramCount = 1;

        if (teamId) {
          exampleQuery += ` AND u.team_id = $${++paramCount}`;
          params.push(teamId);
        }

        if (courseType) {
          exampleQuery += ` AND c.type = $${++paramCount}`;
          params.push(courseType);
        }

        exampleQuery += `
          ORDER BY duration_hours DESC
          LIMIT 5
        `;

        const exampleResult = await query(exampleQuery, params);
        
        examples.push({
          bottleneck: bottleneck.entity,
          severity: bottleneck.severity,
          avgHours: parseFloat(bottleneck.avg_hours),
          incidents: exampleResult.rows.map(row => ({
            courseId: row.course_id,
            courseTitle: row.course_title,
            courseType: row.course_type,
            priority: row.priority,
            fromState: row.from_state,
            toState: row.to_state,
            durationHours: Math.round(parseFloat(row.duration_hours) * 100) / 100,
            reviewerName: row.reviewer_name,
            reviewerEmail: row.reviewer_email,
            occurredAt: row.created_at
          }))
        });

      } catch (error) {
        logger.logError(error, {
          context: 'BottleneckAnalyzer.getBottleneckExamples',
          bottleneck: bottleneck.entity
        });
      }
    }

    return examples;
  }

  /**
   * Calculate trend for a specific entity
   */
  async calculateTrend(entity, groupBy, period) {
    try {
      // Compare current period with previous period
      const dateFilter = this.getPeriodFilter(period);
      
      const trendQuery = `
        WITH period_comparison AS (
          SELECT 
            CASE 
              WHEN wt.created_at >= NOW() - INTERVAL '${dateFilter}' THEN 'current'
              ELSE 'previous'
            END as period,
            AVG(EXTRACT(EPOCH FROM (wt.created_at - LAG(wt.created_at) OVER (
              PARTITION BY wt.workflow_instance_id 
              ORDER BY wt.created_at
            ))) / 3600) as avg_hours
          FROM workflow_transitions wt
          JOIN workflow_instances wi ON wt.workflow_instance_id = wi.id
          JOIN courses c ON wi.course_id = c.id
          LEFT JOIN users u ON wt.triggered_by = u.id
          WHERE wt.created_at >= NOW() - INTERVAL '${dateFilter}' * 2
            AND ${this.getGroupByField(groupBy, 'wt')} = $1
            AND wt.from_state IS NOT NULL
          GROUP BY period
        )
        SELECT 
          period,
          ROUND(avg_hours::numeric, 2) as avg_hours
        FROM period_comparison
      `;

      const result = await query(trendQuery, [entity]);
      const periods = result.rows.reduce((acc, row) => {
        acc[row.period] = parseFloat(row.avg_hours);
        return acc;
      }, {});

      if (periods.current && periods.previous) {
        const change = ((periods.current - periods.previous) / periods.previous) * 100;
        return {
          direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
          changePercent: Math.round(change * 100) / 100,
          currentAvg: periods.current,
          previousAvg: periods.previous
        };
      }

      return {
        direction: 'unknown',
        changePercent: 0,
        currentAvg: periods.current || 0,
        previousAvg: periods.previous || 0
      };

    } catch (error) {
      logger.logError(error, {
        context: 'BottleneckAnalyzer.calculateTrend',
        entity,
        groupBy
      });
      return { direction: 'unknown', changePercent: 0 };
    }
  }

  /**
   * Generate overall recommendations
   */
  generateRecommendations(bottlenecks, summary) {
    const recommendations = [];

    if (summary.criticalBottlenecks > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'workflow_optimization',
        title: 'Address Critical Bottlenecks',
        description: `${summary.criticalBottlenecks} critical bottlenecks identified. Focus on optimizing the most time-consuming stages first.`,
        impact: 'high',
        effort: 'medium'
      });
    }

    if (summary.improvementPotential > 40) {
      recommendations.push({
        priority: 'high',
        category: 'process_improvement',
        title: 'Significant Time Savings Opportunity',
        description: `Potential to save ${summary.improvementPotential} hours through bottleneck resolution.`,
        impact: 'high',
        effort: 'medium'
      });
    }

    // Add specific recommendations based on bottleneck patterns
    const reviewStages = bottlenecks.filter(b => 
      b.entity && (b.entity.includes('review') || b.entity.includes('approval'))
    );

    if (reviewStages.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'review_process',
        title: 'Review Process Optimization',
        description: 'Multiple review stages showing delays. Consider parallel reviews or reviewer workload balancing.',
        impact: 'medium',
        effort: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Get specific recommendation for a bottleneck
   */
  getSpecificRecommendation(bottleneck) {
    const { entity, severity, avg_hours, bottleneck_percentage } = bottleneck;

    if (severity === 'critical') {
      if (entity.includes('review')) {
        return 'Consider adding additional reviewers or implementing parallel review processes';
      } else if (entity.includes('approval')) {
        return 'Streamline approval process or delegate approval authority';
      } else if (entity.includes('development')) {
        return 'Review content development resources and provide additional support';
      }
    }

    if (parseFloat(bottleneck_percentage) > 50) {
      return 'High frequency bottleneck - requires immediate process review';
    }

    if (parseFloat(avg_hours) > 72) {
      return 'Extended delays - investigate specific causes and implement escalation procedures';
    }

    return 'Monitor closely and consider process optimization opportunities';
  }

  /**
   * Get bottleneck analysis for a specific course
   */
  async analyzeCourseBottlenecks(courseId) {
    try {
      const result = await query(`
        SELECT 
          wt.from_state,
          wt.to_state,
          wt.created_at,
          EXTRACT(EPOCH FROM (wt.created_at - LAG(wt.created_at) OVER (
            ORDER BY wt.created_at
          ))) / 3600 as duration_hours,
          u.name as triggered_by_name,
          u.email as triggered_by_email
        FROM workflow_transitions wt
        JOIN workflow_instances wi ON wt.workflow_instance_id = wi.id
        LEFT JOIN users u ON wt.triggered_by = u.id
        WHERE wi.course_id = $1
          AND wt.from_state IS NOT NULL
        ORDER BY wt.created_at
      `, [courseId]);

      const transitions = result.rows.map(row => ({
        fromState: row.from_state,
        toState: row.to_state,
        durationHours: parseFloat(row.duration_hours) || 0,
        triggeredBy: row.triggered_by_name,
        triggeredByEmail: row.triggered_by_email,
        occurredAt: row.created_at
      }));

      // Identify the longest delays
      const delays = transitions
        .filter(t => t.durationHours > 0)
        .sort((a, b) => b.durationHours - a.durationHours);

      return {
        courseId: parseInt(courseId),
        transitions,
        longestDelays: delays.slice(0, 5),
        totalDuration: delays.reduce((sum, d) => sum + d.durationHours, 0),
        averageStageTime: delays.length > 0 ? 
          delays.reduce((sum, d) => sum + d.durationHours, 0) / delays.length : 0
      };

    } catch (error) {
      logger.logError(error, {
        context: 'BottleneckAnalyzer.analyzeCourseBottlenecks',
        courseId
      });
      throw error;
    }
  }

  /**
   * Clear analysis cache
   */
  async clearCache(pattern = null) {
    try {
      const { invalidatePattern } = require('../config/redis');
      const cachePattern = pattern || `${this.cachePrefix}:*`;
      const cleared = await invalidatePattern(cachePattern);
      
      logger.info('Bottleneck analysis cache cleared', {
        pattern: cachePattern,
        keysCleared: cleared
      });

      return cleared;

    } catch (error) {
      logger.logError(error, {
        context: 'BottleneckAnalyzer.clearCache',
        pattern
      });
      throw error;
    }
  }
}

module.exports = BottleneckAnalyzer;