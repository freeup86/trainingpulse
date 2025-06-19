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
    isLoading: workloadLoading 
  } = useQuery({
    queryKey: ['analytics', 'workload', period],
    queryFn: () => analytics.getWorkload({ period })
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
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">
              Monitor workflow performance, identify bottlenecks, and track team productivity
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => refetchBottlenecks()}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {TIME_PERIODS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="block w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
            period={period}
          />
        )}
        {selectedTab === 'performance' && (
          <PerformanceMetrics period={period} />
        )}
        {selectedTab === 'insights' && (
          <Insights period={period} />
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
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error loading bottleneck analysis
            </h3>
            <div className="mt-2 text-sm text-red-700">
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
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Bottlenecks</p>
              <p className="text-2xl font-semibold text-gray-900">{summary.totalBottlenecks || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Critical Issues</p>
              <p className="text-2xl font-semibold text-gray-900">{summary.criticalBottlenecks || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Avg Delay</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatDuration(summary.averageDelay) || '0h'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Improvement Potential</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatDuration(summary.improvementPotential) || '0h'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottlenecks List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Identified Bottlenecks ({groupBy.replace('_', ' ')})
          </h3>
        </div>
        
        {bottlenecks.length === 0 ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bottlenecks found</h3>
            <p className="text-gray-500">
              Great! No significant bottlenecks detected for the selected period and grouping.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {bottlenecks.map((bottleneck, index) => (
              <div key={index} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-sm font-medium text-gray-900">
                        {bottleneck.entity}
                      </h4>
                      <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        bottleneck.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        bottleneck.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        bottleneck.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
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
                              bottleneck.trend.direction === 'increasing' ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {Math.abs(bottleneck.trend.changePercent)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
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
                      <div className="mt-2 text-sm text-blue-600">
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
function WorkloadAnalysis({ data, loading, period }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Mock workload data
  const workloadStats = {
    totalCapacity: 320,
    utilizedCapacity: 256,
    overloadedUsers: 3,
    underutilizedUsers: 2
  };

  return (
    <div className="space-y-6">
      {/* Workload Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Capacity</p>
              <p className="text-2xl font-semibold text-gray-900">{workloadStats.totalCapacity}h</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Utilized</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatPercentage((workloadStats.utilizedCapacity / workloadStats.totalCapacity) * 100)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Overloaded</p>
              <p className="text-2xl font-semibold text-gray-900">{workloadStats.overloadedUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Under-utilized</p>
              <p className="text-2xl font-semibold text-gray-900">{workloadStats.underutilizedUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Workload Chart Placeholder */}
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Workload Analysis</h3>
        <p className="text-gray-500">
          Detailed workload charts and resource allocation analysis will be available soon.
        </p>
      </div>
    </div>
  );
}

// Performance Metrics Component
function PerformanceMetrics({ period }) {
  const metrics = {
    completionRate: 87,
    avgCycleTime: 14.5,
    qualityScore: 4.2,
    teamEfficiency: 92
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Completion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatPercentage(metrics.completionRate)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Avg Cycle Time</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics.avgCycleTime} days</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Quality Score</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics.qualityScore}/5</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Team Efficiency</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatPercentage(metrics.teamEfficiency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-8 text-center">
        <TrendingUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Performance Trends</h3>
        <p className="text-gray-500">
          Historical performance trends and predictive analytics will be available soon.
        </p>
      </div>
    </div>
  );
}

// Insights Component
function Insights({ period }) {
  const insights = [
    {
      id: 1,
      type: 'warning',
      title: 'Review Bottleneck Detected',
      description: 'The review stage is taking 40% longer than average this period.',
      impact: 'high',
      action: 'Consider adding additional reviewers or streamlining the review process.'
    },
    {
      id: 2,
      type: 'success',
      title: 'Improved Completion Rate',
      description: 'Course completion rate has increased by 15% compared to last period.',
      impact: 'medium',
      action: 'Document and share best practices that led to this improvement.'
    },
    {
      id: 3,
      type: 'info',
      title: 'Team Capacity Optimization',
      description: 'Design team has 20% unused capacity that could be allocated to high-priority courses.',
      impact: 'medium',
      action: 'Review workload distribution and consider reassigning resources.'
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">AI-Powered Insights</h3>
      
      {insights.map((insight) => (
        <div key={insight.id} className="bg-white shadow rounded-lg p-6">
          <div className="flex items-start">
            <div className={`flex-shrink-0 ${
              insight.type === 'warning' ? 'text-yellow-500' :
              insight.type === 'success' ? 'text-green-500' :
              'text-blue-500'
            }`}>
              {insight.type === 'warning' ? (
                <AlertTriangle className="h-6 w-6" />
              ) : insight.type === 'success' ? (
                <TrendingUp className="h-6 w-6" />
              ) : (
                <Activity className="h-6 w-6" />
              )}
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center">
                <h4 className="text-sm font-medium text-gray-900">
                  {insight.title}
                </h4>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                  insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {insight.impact} impact
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {insight.description}
              </p>
              <div className="mt-2 text-sm text-blue-600">
                <strong>Recommended Action:</strong> {insight.action}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AnalyticsPage;