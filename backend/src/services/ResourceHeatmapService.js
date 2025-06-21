const { query } = require('../config/database');
const { get, set } = require('../config/redis');
const logger = require('../utils/logger');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Resource Heatmap Service
 * Generates detailed workload visualizations and capacity planning data
 */
class ResourceHeatmapService {
  constructor() {
    this.cachePrefix = 'resource_heatmap';
    this.defaultCapacityHours = 8.0;
  }

  /**
   * Generate resource heatmap data for visualization
   */
  async generateHeatmap(options = {}) {
    const {
      startDate,
      endDate,
      teamId = null,
      userIds = null,
      includeWeekends = false,
      includeHolidays = false,
      capacityType = 'hours', // 'hours', 'courses', 'workload'
      granularity = 'daily' // 'daily', 'weekly'
    } = options;

    try {
      // Validate date range
      if (!startDate || !endDate) {
        throw new ValidationError('Start date and end date are required');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        throw new ValidationError('End date must be after start date');
      }

      // Check cache
      const cacheKey = `${this.cachePrefix}:${startDate}:${endDate}:${teamId}:${capacityType}:${granularity}`;
      const cached = await get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get users to analyze
      const users = await this.getUsers(teamId, userIds);
      
      // Generate date range
      const dateRange = this.generateDateRange(start, end, includeWeekends, granularity);
      
      // Get holidays if needed
      const holidays = includeHolidays ? await this.getHolidays(start, end) : [];
      
      // Calculate workload data
      const heatmapData = await this.calculateWorkloadData(users, dateRange, holidays, capacityType);
      
      // Generate summary statistics
      const summary = this.calculateSummaryStats(heatmapData, dateRange);
      
      // Generate insights and recommendations
      const insights = this.generateInsights(heatmapData, summary);

      const result = {
        heatmap: heatmapData,
        summary,
        insights,
        dateRange: {
          startDate,
          endDate,
          totalPeriods: dateRange.length,
          workingPeriods: dateRange.filter(d => !this.isWeekend(d.date) && !this.isHoliday(d.date, holidays)).length
        },
        options: {
          capacityType,
          granularity,
          includeWeekends,
          includeHolidays,
          generatedAt: new Date().toISOString()
        }
      };

      // Cache for 10 minutes
      await set(cacheKey, result, 600);
      
      return result;

    } catch (error) {
      logger.logError(error, {
        context: 'ResourceHeatmapService.generateHeatmap',
        options
      });
      throw error;
    }
  }

  /**
   * Get team capacity analysis
   */
  async getTeamCapacityAnalysis(teamId, startDate, endDate) {
    try {
      const heatmapData = await this.generateHeatmap({
        startDate,
        endDate,
        teamId,
        capacityType: 'hours'
      });

      // Group by team members
      const teamMembers = {};
      heatmapData.heatmap.forEach(entry => {
        if (!teamMembers[entry.userId]) {
          teamMembers[entry.userId] = {
            userId: entry.userId,
            userName: entry.userName,
            userEmail: entry.userEmail,
            capacity: entry.capacity,
            totalAllocated: 0,
            totalAvailable: 0,
            overloadedDays: 0,
            underutilizedDays: 0,
            peakUtilization: 0,
            avgUtilization: 0,
            workingDays: 0
          };
        }

        const member = teamMembers[entry.userId];
        if (!entry.isWeekend && !entry.isHoliday) {
          member.totalAllocated += entry.allocatedHours;
          member.totalAvailable += entry.capacity;
          member.workingDays++;
          
          if (entry.utilization >= 100) member.overloadedDays++;
          if (entry.utilization < 50) member.underutilizedDays++;
          if (entry.utilization > member.peakUtilization) {
            member.peakUtilization = entry.utilization;
          }
        }
      });

      // Calculate averages
      Object.values(teamMembers).forEach(member => {
        if (member.workingDays > 0) {
          member.avgUtilization = (member.totalAllocated / member.totalAvailable) * 100;
        }
      });

      // Team-level statistics
      const teamStats = {
        totalMembers: Object.keys(teamMembers).length,
        avgTeamUtilization: Object.values(teamMembers).reduce((sum, m) => sum + m.avgUtilization, 0) / Object.keys(teamMembers).length,
        overloadedMembers: Object.values(teamMembers).filter(m => m.avgUtilization >= 90).length,
        underutilizedMembers: Object.values(teamMembers).filter(m => m.avgUtilization < 60).length,
        balancedMembers: Object.values(teamMembers).filter(m => m.avgUtilization >= 60 && m.avgUtilization < 90).length
      };

      return {
        teamMembers: Object.values(teamMembers),
        teamStats,
        recommendations: this.generateTeamRecommendations(teamMembers, teamStats)
      };

    } catch (error) {
      logger.logError(error, {
        context: 'ResourceHeatmapService.getTeamCapacityAnalysis',
        teamId,
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Get resource availability for scheduling
   */
  async getResourceAvailability(startDate, endDate, requiredHours, skills = []) {
    try {
      const heatmapData = await this.generateHeatmap({
        startDate,
        endDate,
        capacityType: 'hours'
      });

      // Filter users by skills if provided
      let availableUsers = await this.getUsersWithSkills(skills);
      
      // Calculate availability for each user
      const availability = availableUsers.map(user => {
        const userEntries = heatmapData.heatmap.filter(entry => entry.userId === user.id);
        
        const availableDays = userEntries.filter(entry => 
          !entry.isWeekend && 
          !entry.isHoliday && 
          entry.capacity - entry.allocatedHours >= requiredHours
        );

        const totalAvailableHours = userEntries.reduce((sum, entry) => {
          if (!entry.isWeekend && !entry.isHoliday) {
            return sum + Math.max(0, entry.capacity - entry.allocatedHours);
          }
          return sum;
        }, 0);

        return {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          skills: user.skills,
          dailyCapacity: user.daily_capacity_hours,
          availableDays: availableDays.length,
          totalAvailableHours,
          avgDailyAvailability: availableDays.length > 0 ? totalAvailableHours / userEntries.filter(e => !e.isWeekend).length : 0,
          canAccommodateProject: totalAvailableHours >= requiredHours,
          utilizationImpact: totalAvailableHours > 0 ? (requiredHours / totalAvailableHours) * 100 : 0
        };
      });

      // Sort by availability (most available first)
      availability.sort((a, b) => b.totalAvailableHours - a.totalAvailableHours);

      return {
        availability,
        summary: {
          totalCandidates: availability.length,
          fullyAvailable: availability.filter(a => a.canAccommodateProject).length,
          bestMatch: availability[0] || null,
          requiredHours,
          skills
        }
      };

    } catch (error) {
      logger.logError(error, {
        context: 'ResourceHeatmapService.getResourceAvailability',
        startDate,
        endDate,
        requiredHours,
        skills
      });
      throw error;
    }
  }

  /**
   * Generate workload forecast
   */
  async generateWorkloadForecast(userId, weeks = 4) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + (weeks * 7));

      // Get historical data for trend analysis
      const historicalStart = new Date();
      historicalStart.setDate(startDate.getDate() - (weeks * 7));

      const [currentData, historicalData] = await Promise.all([
        this.generateHeatmap({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          userIds: [userId],
          capacityType: 'hours',
          granularity: 'weekly'
        }),
        this.generateHeatmap({
          startDate: historicalStart.toISOString(),
          endDate: startDate.toISOString(),
          userIds: [userId],
          capacityType: 'hours',
          granularity: 'weekly'
        })
      ]);

      // Calculate trends
      const historicalAvg = historicalData.summary.avgUtilization;
      const projectedUtilization = currentData.heatmap.map(week => {
        // Simple trend projection based on historical average
        const baseUtilization = week.utilization;
        const trendAdjustment = (historicalAvg - baseUtilization) * 0.1; // 10% trend influence
        return Math.max(0, Math.min(150, baseUtilization + trendAdjustment));
      });

      return {
        userId,
        forecastPeriod: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          weeks
        },
        historical: {
          avgUtilization: historicalAvg,
          trend: historicalAvg > 80 ? 'increasing' : historicalAvg < 60 ? 'decreasing' : 'stable'
        },
        forecast: currentData.heatmap.map((week, index) => ({
          weekStarting: week.date,
          currentUtilization: week.utilization,
          projectedUtilization: projectedUtilization[index],
          confidence: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
          risks: this.identifyWorkloadRisks(week, projectedUtilization[index])
        })),
        recommendations: this.generateForecastRecommendations(projectedUtilization, historicalAvg)
      };

    } catch (error) {
      logger.logError(error, {
        context: 'ResourceHeatmapService.generateWorkloadForecast',
        userId,
        weeks
      });
      throw error;
    }
  }

  /**
   * Get users based on filters
   */
  async getUsers(teamId, userIds) {
    let userQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.daily_capacity_hours,
        u.skills,
        u.team_id,
        t.name as team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.active = true
    `;

    const params = [];
    let paramCount = 0;

    if (teamId) {
      userQuery += ` AND u.team_id = $${++paramCount}`;
      params.push(teamId);
    }

    if (userIds && userIds.length > 0) {
      const placeholders = userIds.map(() => `$${++paramCount}`).join(',');
      userQuery += ` AND u.id IN (${placeholders})`;
      params.push(...userIds);
    }

    userQuery += ` ORDER BY u.name`;

    const result = await query(userQuery, params);
    return result.rows;
  }

  /**
   * Get users with specific skills
   */
  async getUsersWithSkills(skills) {
    if (!skills || skills.length === 0) {
      return await this.getUsers();
    }

    const result = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.daily_capacity_hours,
        u.skills,
        u.team_id,
        t.name as team_name
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      WHERE u.active = true
        AND u.skills && $1
      ORDER BY u.name
    `, [skills]);

    return result.rows;
  }

  /**
   * Generate date range for analysis
   */
  generateDateRange(startDate, endDate, includeWeekends, granularity) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    if (granularity === 'weekly') {
      // Align to week start (Monday)
      const dayOfWeek = current.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      current.setDate(current.getDate() - daysToMonday);

      while (current <= end) {
        dates.push({
          date: new Date(current),
          type: 'week',
          weekStarting: new Date(current),
          weekEnding: new Date(current.getTime() + 6 * 24 * 60 * 60 * 1000)
        });
        current.setDate(current.getDate() + 7);
      }
    } else {
      // Daily granularity
      while (current <= end) {
        if (includeWeekends || !this.isWeekend(current)) {
          dates.push({
            date: new Date(current),
            type: 'day'
          });
        }
        current.setDate(current.getDate() + 1);
      }
    }

    return dates;
  }

  /**
   * Calculate workload data for users and dates
   */
  async calculateWorkloadData(users, dateRange, holidays, capacityType) {
    const workloadData = [];

    for (const user of users) {
      for (const period of dateRange) {
        const isWeekend = this.isWeekend(period.date);
        const isHoliday = this.isHoliday(period.date, holidays);

        // Get course assignments for this period
        const assignments = await this.getAssignmentsForPeriod(user.id, period);
        
        let allocatedHours = 0;
        let courseCount = assignments.length;
        let workloadScore = 0;

        if (capacityType === 'hours') {
          allocatedHours = assignments.reduce((sum, a) => sum + (parseFloat(a.daily_allocation) || 0), 0);
        } else if (capacityType === 'courses') {
          allocatedHours = courseCount * 2; // Assume 2 hours per course
        } else if (capacityType === 'workload') {
          // Complex workload calculation considering priority and role
          workloadScore = assignments.reduce((sum, a) => {
            let score = 1;
            if (a.priority === 'critical') score *= 1.5;
            if (a.priority === 'high') score *= 1.2;
            if (a.role === 'owner') score *= 1.3;
            if (a.role === 'designer') score *= 1.1;
            return sum + score;
          }, 0);
          allocatedHours = workloadScore * 1.5; // Convert to hours equivalent
        }

        const capacity = isWeekend || isHoliday ? 0 : (user.daily_capacity_hours || this.defaultCapacityHours);
        const utilization = capacity > 0 ? (allocatedHours / capacity) * 100 : 0;

        let intensity = 'low';
        if (utilization >= 100) intensity = 'critical';
        else if (utilization >= 85) intensity = 'high';
        else if (utilization >= 70) intensity = 'medium';

        workloadData.push({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          teamName: user.team_name,
          date: period.date.toISOString().split('T')[0],
          isWeekend,
          isHoliday,
          intensity,
          utilization: Math.round(utilization * 100) / 100,
          allocatedHours: Math.round(allocatedHours * 100) / 100,
          capacity,
          courseCount,
          workloadScore: Math.round(workloadScore * 100) / 100,
          available: !isWeekend && !isHoliday && utilization < 85,
          courses: assignments.map(a => ({
            id: a.course_id,
            title: a.title,
            priority: a.priority,
            role: a.role,
            hours: Math.round((parseFloat(a.daily_allocation) || 0) * 100) / 100,
            dueDate: a.due_date
          }))
        });
      }
    }

    return workloadData;
  }

  /**
   * Get assignments for a specific period
   */
  async getAssignmentsForPeriod(userId, period) {
    const { date, weekStarting, weekEnding } = period;
    const startDate = weekStarting || date;
    const endDate = weekEnding || date;

    const result = await query(`
      SELECT 
        c.id as course_id,
        c.title,
        c.priority,
        c.due_date,
        c.estimated_daily_hours,
        ca.role,
        CASE 
          WHEN c.start_date <= $2 AND c.due_date >= $2 THEN 
            COALESCE(c.estimated_daily_hours, 
              CASE 
                WHEN c.estimated_hours IS NOT NULL AND c.start_date IS NOT NULL AND c.due_date IS NOT NULL
                THEN c.estimated_hours / GREATEST(1, (c.due_date - c.start_date))
                ELSE 2.0 
              END
            )
          ELSE 0
        END as daily_allocation
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      WHERE ca.user_id = $1
        AND c.status NOT IN ('completed', 'cancelled', 'deleted')
        AND c.start_date <= $3
        AND c.due_date >= $2
    `, [userId, startDate, endDate]);

    return result.rows;
  }

  /**
   * Get holidays for date range
   */
  async getHolidays(startDate, endDate) {
    // This would typically integrate with a holiday API or database
    // For now, return common holidays
    const holidays = [
      { date: '2024-01-01', name: 'New Year\'s Day' },
      { date: '2024-07-04', name: 'Independence Day' },
      { date: '2024-12-25', name: 'Christmas Day' }
    ];

    return holidays.filter(h => {
      const holidayDate = new Date(h.date);
      return holidayDate >= startDate && holidayDate <= endDate;
    });
  }

  /**
   * Calculate summary statistics
   */
  calculateSummaryStats(heatmapData, dateRange) {
    const workingDaysData = heatmapData.filter(w => !w.isWeekend && !w.isHoliday);
    
    if (workingDaysData.length === 0) {
      return {
        totalEntries: 0,
        avgUtilization: 0,
        maxUtilization: 0,
        overloadedEntries: 0,
        underutilizedEntries: 0,
        optimalEntries: 0,
        totalCapacity: 0,
        totalAllocated: 0
      };
    }

    const overloadedEntries = workingDaysData.filter(w => w.utilization >= 100);
    const underutilizedEntries = workingDaysData.filter(w => w.utilization < 50);
    const optimalEntries = workingDaysData.filter(w => w.utilization >= 70 && w.utilization < 100);

    const totalCapacity = workingDaysData.reduce((sum, w) => sum + w.capacity, 0);
    const totalAllocated = workingDaysData.reduce((sum, w) => sum + w.allocatedHours, 0);
    const avgUtilization = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0;
    const maxUtilization = Math.max(...workingDaysData.map(w => w.utilization));

    return {
      totalEntries: workingDaysData.length,
      avgUtilization: Math.round(avgUtilization * 100) / 100,
      maxUtilization: Math.round(maxUtilization * 100) / 100,
      overloadedEntries: overloadedEntries.length,
      underutilizedEntries: underutilizedEntries.length,
      optimalEntries: optimalEntries.length,
      totalCapacity: Math.round(totalCapacity * 100) / 100,
      totalAllocated: Math.round(totalAllocated * 100) / 100,
      efficiencyScore: Math.round(((optimalEntries.length / workingDaysData.length) * 100) * 100) / 100
    };
  }

  /**
   * Generate insights and recommendations
   */
  generateInsights(heatmapData, summary) {
    const insights = [];

    if (summary.avgUtilization > 90) {
      insights.push({
        type: 'overutilization',
        severity: 'high',
        title: 'Team Overutilization Detected',
        description: `Average utilization of ${summary.avgUtilization}% indicates team is overloaded.`,
        recommendation: 'Consider hiring additional resources or redistributing workload.'
      });
    }

    if (summary.avgUtilization < 60) {
      insights.push({
        type: 'underutilization',
        severity: 'medium',
        title: 'Team Underutilization',
        description: `Average utilization of ${summary.avgUtilization}% suggests available capacity.`,
        recommendation: 'Team has capacity for additional projects or faster delivery.'
      });
    }

    if (summary.overloadedEntries > summary.totalEntries * 0.2) {
      insights.push({
        type: 'frequent_overload',
        severity: 'high',
        title: 'Frequent Overload Periods',
        description: `${summary.overloadedEntries} overloaded periods detected.`,
        recommendation: 'Review project scheduling and consider workload balancing.'
      });
    }

    if (summary.efficiencyScore > 80) {
      insights.push({
        type: 'high_efficiency',
        severity: 'positive',
        title: 'Excellent Resource Efficiency',
        description: `${summary.efficiencyScore}% of periods are optimally utilized.`,
        recommendation: 'Current resource allocation is highly effective.'
      });
    }

    return insights;
  }

  /**
   * Generate team recommendations
   */
  generateTeamRecommendations(teamMembers, teamStats) {
    const recommendations = [];

    if (teamStats.overloadedMembers > 0) {
      recommendations.push({
        type: 'workload_redistribution',
        priority: 'high',
        description: `${teamStats.overloadedMembers} team members are overloaded. Consider redistributing work.`
      });
    }

    if (teamStats.underutilizedMembers > teamStats.balancedMembers) {
      recommendations.push({
        type: 'capacity_utilization',
        priority: 'medium',
        description: 'Significant unused capacity available. Consider accelerating projects or taking on additional work.'
      });
    }

    if (teamStats.avgTeamUtilization > 85) {
      recommendations.push({
        type: 'team_expansion',
        priority: 'high',
        description: 'Team operating at high capacity. Consider adding resources for sustainability.'
      });
    }

    return recommendations;
  }

  /**
   * Generate forecast recommendations
   */
  generateForecastRecommendations(projectedUtilization, historicalAvg) {
    const recommendations = [];
    const avgProjected = projectedUtilization.reduce((sum, u) => sum + u, 0) / projectedUtilization.length;

    if (avgProjected > 100) {
      recommendations.push({
        type: 'capacity_warning',
        priority: 'critical',
        description: 'Projected overutilization. Immediate action required.'
      });
    }

    if (avgProjected - historicalAvg > 20) {
      recommendations.push({
        type: 'workload_increase',
        priority: 'medium',
        description: 'Significant workload increase projected compared to historical average.'
      });
    }

    return recommendations;
  }

  /**
   * Identify workload risks
   */
  identifyWorkloadRisks(week, projectedUtilization) {
    const risks = [];

    if (projectedUtilization > 120) {
      risks.push('Critical overload - burnout risk');
    } else if (projectedUtilization > 100) {
      risks.push('Overutilization - quality risk');
    }

    if (week.courseCount > 5) {
      risks.push('High context switching');
    }

    const criticalCourses = week.courses.filter(c => c.priority === 'critical');
    if (criticalCourses.length > 1) {
      risks.push('Multiple critical priorities');
    }

    return risks;
  }

  /**
   * Helper methods
   */
  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  isHoliday(date, holidays) {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.some(h => h.date === dateStr);
  }
}

module.exports = ResourceHeatmapService;