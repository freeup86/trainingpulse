import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  AlertTriangle,
  Users,
  Target,
  Activity,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { analytics } from '../lib/api';
import { formatPercentage, formatDuration, getIntensityColor } from '../lib/utils';

const TIME_PERIODS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' }
];

const GROUP_BY_OPTIONS = [
  { value: 'stage', label: 'Workflow Stage' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'course_type', label: 'Course Type' },
  { value: 'team', label: 'Team' },
  { value: 'priority', label: 'Priority' }
];

function AnalyticsPage() {
  const [selectedTab, setSelectedTab] = useState('bottlenecks');
  const [period, setPeriod] = useState('30d');
  const [groupBy, setGroupBy] = useState('stage');

  // Real API calls
  const { 
    data: bottlenecksData, 
    isLoading: bottlenecksLoading, 
    error: bottlenecksError,
    refetch: refetchBottlenecks
  } = useQuery({
    queryKey: ['analytics', 'bottlenecks', period, groupBy],
    queryFn: () => analytics.getBottlenecks({ period, groupBy })
  });

  const { 
    data: workloadData, 
    isLoading: workloadLoading,
    error: workloadError
  } = useQuery({
    queryKey: ['analytics', 'workload', period],
    queryFn: () => analytics.getWorkload({ period })
  });

  const { 
    data: performanceData, 
    isLoading: performanceLoading,
    error: performanceError
  } = useQuery({
    queryKey: ['analytics', 'performance', period],
    queryFn: () => analytics.getPerformance({ period }),
    retry: false
  });

  const tabs = [
    { id: 'bottlenecks', label: 'Bottleneck Analysis', icon: AlertTriangle },
    { id: 'workload', label: 'Workload Analysis', icon: BarChart3 },
    { id: 'performance', label: 'Performance Metrics', icon: TrendingUp },
    { id: 'insights', label: 'Insights', icon: Activity }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Monitor workflow performance, identify bottlenecks, and track team productivity
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => refetchBottlenecks()}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="block w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {TIME_PERIODS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="block w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {GROUP_BY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {selectedTab === 'bottlenecks' && (
          <BottleneckAnalysis 
            data={bottlenecksData} 
            loading={bottlenecksLoading} 
            error={bottlenecksError} 
            period={period}
            groupBy={groupBy}
          />
        )}
        {selectedTab === 'workload' && (
          <WorkloadAnalysis 
            data={workloadData} 
            loading={workloadLoading} 
            error={workloadError}
            period={period}
          />
        )}
        {selectedTab === 'performance' && (
          <PerformanceMetrics 
            data={performanceData}
            loading={performanceLoading}
            error={performanceError}
            period={period} 
          />
        )}
        {selectedTab === 'insights' && (
          <Insights 
            data={performanceData} 
            loading={performanceLoading} 
            error={performanceError}
            period={period} 
          />
        )}
      </div>
    </div>
  );
}

// Bottleneck Analysis Component
function BottleneckAnalysis({ data, loading, error, period, groupBy }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading bottleneck analysis
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error.message || 'Failed to load analysis data. Please try again.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const analysisData = data?.data;
  const bottlenecks = analysisData?.bottlenecks || [];
  const summary = analysisData?.summary || {};

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Bottlenecks</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalBottlenecks || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Critical Issues</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.criticalBottlenecks || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Delay</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatDuration(summary.averageDelay) || '0h'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Improvement Potential</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatDuration(summary.improvementPotential) || '0h'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottlenecks List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Identified Bottlenecks ({groupBy.replace('_', ' ')})
          </h3>
        </div>
        
        {bottlenecks.length === 0 ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No bottlenecks found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Great! No significant bottlenecks detected for the selected period and grouping.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {bottlenecks.map((bottleneck, index) => (
              <div key={index} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {bottleneck.entity}
                      </h4>
                      <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        bottleneck.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        bottleneck.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                        bottleneck.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {bottleneck.severity}
                      </span>
                      {bottleneck.trend && (
                        <div className="ml-3 flex items-center">
                          {bottleneck.trend.direction === 'increasing' ? (
                            <TrendingUp className="h-4 w-4 text-red-500" />
                          ) : bottleneck.trend.direction === 'decreasing' ? (
                            <TrendingDown className="h-4 w-4 text-green-500" />
                          ) : null}
                          {bottleneck.trend.changePercent && (
                            <span className={`ml-1 text-xs ${
                              bottleneck.trend.direction === 'increasing' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                            }`}>
                              {Math.abs(bottleneck.trend.changePercent)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Avg Time:</span> {formatDuration(bottleneck.avgHours)}
                      </div>
                      <div>
                        <span className="font-medium">Incidents:</span> {bottleneck.totalTransitions}
                      </div>
                      <div>
                        <span className="font-medium">Bottleneck %:</span> {bottleneck.bottleneckPercentage}%
                      </div>
                      <div>
                        <span className="font-medium">Max Time:</span> {formatDuration(bottleneck.maxHours)}
                      </div>
                    </div>

                    {bottleneck.recommendation && (
                      <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                        <strong>Recommendation:</strong> {bottleneck.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Workload Analysis Component  
function WorkloadAnalysis({ data, loading, error, period }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading workload analysis
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error.message || 'Failed to load workload data. Please try again.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const workloadData = data?.data;
  const summary = workloadData?.summary || {};
  const teamWorkloads = workloadData?.teams || [];
  const userWorkloads = workloadData?.users || [];

  return (
    <div className="space-y-6">
      {/* Workload Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Capacity</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatDuration(summary.totalCapacity) || '0h'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Utilization</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatPercentage(summary.utilizationRate) || '0%'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Overloaded</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {summary.overloadedUsers || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Under-utilized</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {summary.underutilizedUsers || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Workloads */}
      {teamWorkloads.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Team Workload Distribution</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {teamWorkloads.map((team) => (
              <div key={team.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">{team.name}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        team.utilizationRate > 100 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        team.utilizationRate > 85 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        team.utilizationRate > 70 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {formatPercentage(team.utilizationRate)}
                      </span>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Capacity:</span> {formatDuration(team.capacity)}
                      </div>
                      <div>
                        <span className="font-medium">Allocated:</span> {formatDuration(team.allocated)}
                      </div>
                      <div>
                        <span className="font-medium">Active Courses:</span> {team.activeCourses}
                      </div>
                      <div>
                        <span className="font-medium">Members:</span> {team.memberCount}
                      </div>
                    </div>

                    {/* Workload bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            team.utilizationRate > 100 ? 'bg-red-600' :
                            team.utilizationRate > 85 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(team.utilizationRate, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Workloads */}
      {userWorkloads.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Individual Workloads</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {userWorkloads.slice(0, 10).map((user) => (
              <div key={user.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {user.name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {formatDuration(user.allocated)} / {formatDuration(user.capacity)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.activeCourses} active courses
                      </p>
                    </div>
                    
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.utilizationRate > 100 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      user.utilizationRate > 85 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      user.utilizationRate > 70 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {formatPercentage(user.utilizationRate)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {userWorkloads.length > 10 && (
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing 10 of {userWorkloads.length} users
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {(!teamWorkloads || teamWorkloads.length === 0) && (!userWorkloads || userWorkloads.length === 0) && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Workload Data Available</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Workload analysis data will appear here once there is sufficient activity data for the selected period.
          </p>
        </div>
      )}
    </div>
  );
}

// Performance Metrics Component
function PerformanceMetrics({ data, loading, error, period }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading performance metrics
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error.message || 'Failed to load performance data. Please try again.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const performanceData = data?.data;
  const metrics = performanceData?.metrics || {};
  const trends = performanceData?.trends || [];
  const predictions = performanceData?.predictions || {};

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completion Rate</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatPercentage(metrics.completionRate) || '0%'}
                </p>
                {metrics.completionTrend && (
                  <span className={`text-sm flex items-center ${
                    metrics.completionTrend > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metrics.completionTrend > 0 ? (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 mr-1" />
                    )}
                    {Math.abs(metrics.completionTrend)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Cycle Time</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatDuration(metrics.avgCycleTime) || '0h'}
                </p>
                {metrics.cycleTimeTrend && (
                  <span className={`text-sm flex items-center ${
                    metrics.cycleTimeTrend < 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metrics.cycleTimeTrend < 0 ? (
                      <TrendingDown className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    )}
                    {Math.abs(metrics.cycleTimeTrend)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Quality Score</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {metrics.qualityScore ? `${metrics.qualityScore}/5` : '0/5'}
                </p>
                {metrics.qualityTrend && (
                  <span className={`text-sm flex items-center ${
                    metrics.qualityTrend > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metrics.qualityTrend > 0 ? (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 mr-1" />
                    )}
                    {Math.abs(metrics.qualityTrend)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Team Efficiency</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatPercentage(metrics.teamEfficiency) || '0%'}
                </p>
                {metrics.efficiencyTrend && (
                  <span className={`text-sm flex items-center ${
                    metrics.efficiencyTrend > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metrics.efficiencyTrend > 0 ? (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 mr-1" />
                    )}
                    {Math.abs(metrics.efficiencyTrend)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Trends */}
      {trends.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Performance Trends</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trends.map((trend, index) => (
                <div key={index} className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">{trend.metric}</h4>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      trend.direction === 'improving' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      trend.direction === 'declining' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {trend.direction}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Current:</span>
                      <span className="text-gray-900 dark:text-white">{trend.current}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Previous:</span>
                      <span className="text-gray-900 dark:text-white">{trend.previous}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Change:</span>
                      <span className={`${
                        trend.change > 0 ? 'text-green-600' : trend.change < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {trend.change > 0 ? '+' : ''}{trend.change}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Simple trend visualization */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          trend.direction === 'improving' ? 'bg-green-500' :
                          trend.direction === 'declining' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}
                        style={{ width: `${Math.min(Math.abs(trend.change) * 2, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Predictive Analytics */}
      {predictions && Object.keys(predictions).length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Predictive Analytics</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {predictions.nextPeriodCompletion && (
                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Next Period Completion Rate
                  </h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatPercentage(predictions.nextPeriodCompletion.predicted)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ±{predictions.nextPeriodCompletion.confidence}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Confidence: {predictions.nextPeriodCompletion.reliability}%
                  </p>
                </div>
              )}

              {predictions.riskFactors && predictions.riskFactors.length > 0 && (
                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Risk Factors
                  </h4>
                  <div className="space-y-2">
                    {predictions.riskFactors.slice(0, 3).map((risk, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{risk.factor}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          risk.severity === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {risk.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!trends || trends.length === 0) && (!predictions || Object.keys(predictions).length === 0) && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <TrendingUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Trend Data Available</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Performance trends and predictive analytics will appear here once there is sufficient historical data for the selected period.
          </p>
        </div>
      )}
    </div>
  );
}

// Insights Component
function Insights({ data, loading, error, period }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading insights
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error.message || 'Failed to load performance insights. Please try again.'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const insights = data?.data?.insights || [];
  
  // Map insight types to appropriate icons and colors
  const getInsightIcon = (type) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return <AlertTriangle className="h-6 w-6" />;
      case 'success':
        return <TrendingUp className="h-6 w-6" />;
      case 'info':
      default:
        return <Activity className="h-6 w-6" />;
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'warning':
      case 'alert':
        return 'text-yellow-500';
      case 'success':
        return 'text-green-500';
      case 'info':
      default:
        return 'text-blue-500';
    }
  };

  const getImpactStyle = (category, type) => {
    // Determine impact level based on category and type
    const isHighImpact = type === 'warning' || type === 'alert' || category === 'completion';
    const isMediumImpact = type === 'info' || category === 'workload' || category === 'efficiency';
    
    if (isHighImpact) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    } else if (isMediumImpact) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    } else {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
  };

  const getImpactLabel = (category, type) => {
    const isHighImpact = type === 'warning' || type === 'alert' || category === 'completion';
    const isMediumImpact = type === 'info' || category === 'workload' || category === 'efficiency';
    
    if (isHighImpact) return 'high impact';
    if (isMediumImpact) return 'medium impact';
    return 'low impact';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Performance Insights</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Based on {period === '7d' ? 'last 7 days' : period === '30d' ? 'last 30 days' : period === '90d' ? 'last 90 days' : period === '6m' ? 'last 6 months' : 'last year'} of data
        </span>
      </div>
      
      {insights.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <Activity className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No insights available</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Performance insights will appear here as data becomes available for the selected period.
          </p>
        </div>
      ) : (
        insights.map((insight, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-start">
              <div className={`flex-shrink-0 ${getInsightColor(insight.type)}`}>
                {getInsightIcon(insight.type)}
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {insight.title}
                  </h4>
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getImpactStyle(insight.category, insight.type)}`}>
                    {getImpactLabel(insight.category, insight.type)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {insight.message}
                </p>
                {insight.recommendation && (
                  <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                    <strong>Recommended Action:</strong> {insight.recommendation}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default AnalyticsPage;