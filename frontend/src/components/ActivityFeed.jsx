import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity,
  User,
  MessageCircle,
  Edit,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  FileText,
  Users,
  Building,
  Calendar,
  Settings,
  Upload,
  Download,
  Copy,
  Eye,
  ChevronDown,
  Filter
} from 'lucide-react';
import { activities } from '../lib/api';
import { formatDate, formatRelativeTime } from '../lib/utils';

// Activity type icons mapping
const ACTIVITY_ICONS = {
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  commented: MessageCircle,
  replied: MessageCircle,
  status_changed: CheckCircle,
  assigned: Users,
  unassigned: Users,
  uploaded: Upload,
  downloaded: Download,
  duplicated: Copy,
  viewed: Eye,
  completed: CheckCircle,
  started: Clock,
  paused: Clock,
  resumed: Clock,
  archived: FileText,
  restored: FileText,
  invited: Users,
  joined: Users,
  left: Users,
  settings_changed: Settings
};

// Activity type colors
const ACTIVITY_COLORS = {
  created: 'text-green-600 bg-green-100',
  updated: 'text-blue-600 bg-blue-100',
  deleted: 'text-red-600 bg-red-100',
  commented: 'text-purple-600 bg-purple-100',
  replied: 'text-purple-600 bg-purple-100',
  status_changed: 'text-yellow-600 bg-yellow-100',
  assigned: 'text-indigo-600 bg-indigo-100',
  unassigned: 'text-gray-600 bg-gray-100',
  uploaded: 'text-emerald-600 bg-emerald-100',
  downloaded: 'text-teal-600 bg-teal-100',
  duplicated: 'text-cyan-600 bg-cyan-100',
  viewed: 'text-slate-600 bg-slate-100',
  completed: 'text-green-600 bg-green-100',
  started: 'text-blue-600 bg-blue-100',
  paused: 'text-orange-600 bg-orange-100',
  resumed: 'text-green-600 bg-green-100',
  archived: 'text-gray-600 bg-gray-100',
  restored: 'text-blue-600 bg-blue-100',
  invited: 'text-purple-600 bg-purple-100',
  joined: 'text-green-600 bg-green-100',
  left: 'text-red-600 bg-red-100',
  settings_changed: 'text-amber-600 bg-amber-100'
};

// Entity type labels
const ENTITY_LABELS = {
  course: 'Course',
  task: 'Task',
  program: 'Program',
  team: 'Team',
  user: 'User',
  comment: 'Comment',
  attachment: 'File'
};

// Main Activity Feed Component
export const ActivityFeed = ({ 
  programId, 
  entityType, 
  entityId, 
  limit = 20, 
  className = '',
  showFilters = true,
  compact = false
}) => {
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    user_id: ''
  });
  const [showAllFilters, setShowAllFilters] = useState(false);

  // Fetch activities
  const { data: activitiesData, isLoading, error } = useQuery({
    queryKey: ['activities', { programId, entityType, entityId, ...filters }],
    queryFn: () => {
      if (entityType && entityId) {
        return activities.getByEntity(entityType, entityId, { limit, ...filters });
      } else if (programId) {
        return activities.getByProgram(programId, { limit, ...filters });
      } else {
        return activities.getAll({ limit, ...filters });
      }
    },
  });

  const activitiesList = Array.isArray(activitiesData?.data?.data) ? activitiesData.data.data : 
                        Array.isArray(activitiesData?.data) ? activitiesData.data : 
                        Array.isArray(activitiesData) ? activitiesData : [];

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ action: '', entity_type: '', user_id: '' });
  };

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="text-center text-red-600 dark:text-red-400">
          Failed to load activity feed
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
          </div>
          
          {showFilters && (
            <button
              onClick={() => setShowAllFilters(!showAllFilters)}
              className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              <ChevronDown className={`w-4 h-4 transform transition-transform ${showAllFilters ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && showAllFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Actions</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="deleted">Deleted</option>
                <option value="commented">Commented</option>
                <option value="status_changed">Status Changed</option>
                <option value="assigned">Assigned</option>
                <option value="completed">Completed</option>
              </select>

              <select
                value={filters.entity_type}
                onChange={(e) => handleFilterChange('entity_type', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="course">Courses</option>
                <option value="task">Tasks</option>
                <option value="program">Programs</option>
                <option value="team">Teams</option>
                <option value="comment">Comments</option>
              </select>

              <div className="flex space-x-2">
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {isLoading ? (
          <ActivitySkeleton compact={compact} />
        ) : activitiesList.length === 0 ? (
          <div className="p-6 text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No activity yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Activity will appear here as team members work on projects
            </p>
          </div>
        ) : (
          activitiesList.map((activity, index) => (
            <ActivityItem
              key={activity.id || index}
              activity={activity}
              compact={compact}
            />
          ))
        )}
      </div>

      {/* Load More */}
      {activitiesList.length >= limit && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            Load more activity
          </button>
        </div>
      )}
    </div>
  );
};

// Individual Activity Item Component
const ActivityItem = ({ activity, compact = false }) => {
  const IconComponent = ACTIVITY_ICONS[activity.action] || Activity;
  const colorClasses = ACTIVITY_COLORS[activity.action] || 'text-gray-600 bg-gray-100';
  const entityLabel = ENTITY_LABELS[activity.entity_type] || activity.entity_type;

  const formatActivityMessage = (activity) => {
    const { action, entity_type, changes, metadata } = activity;
    const entityLabel = ENTITY_LABELS[entity_type] || entity_type;
    
    let message = '';
    
    switch (action) {
      case 'created':
        message = `created a new ${entityLabel.toLowerCase()}`;
        break;
      case 'updated':
        message = `updated ${entityLabel.toLowerCase()}`;
        if (changes && Object.keys(changes).length > 0) {
          const changedFields = Object.keys(changes).join(', ');
          message += ` (${changedFields})`;
        }
        break;
      case 'deleted':
        message = `deleted ${entityLabel.toLowerCase()}`;
        break;
      case 'commented':
        message = `commented on ${entityLabel.toLowerCase()}`;
        if (metadata?.content) {
          message += `: "${metadata.content.substring(0, 50)}${metadata.content.length > 50 ? '...' : ''}"`;
        }
        break;
      case 'replied':
        message = `replied to a comment on ${entityLabel.toLowerCase()}`;
        break;
      case 'status_changed':
        message = `changed ${entityLabel.toLowerCase()} status`;
        if (changes?.status) {
          message += ` to ${changes.status}`;
        }
        break;
      case 'assigned':
        message = `assigned ${entityLabel.toLowerCase()}`;
        break;
      case 'unassigned':
        message = `unassigned ${entityLabel.toLowerCase()}`;
        break;
      case 'completed':
        message = `completed ${entityLabel.toLowerCase()}`;
        break;
      case 'duplicated':
        message = `duplicated ${entityLabel.toLowerCase()}`;
        break;
      case 'uploaded':
        message = `uploaded a file to ${entityLabel.toLowerCase()}`;
        break;
      case 'started':
        message = `started working on ${entityLabel.toLowerCase()}`;
        break;
      case 'paused':
        message = `paused work on ${entityLabel.toLowerCase()}`;
        break;
      case 'resumed':
        message = `resumed work on ${entityLabel.toLowerCase()}`;
        break;
      default:
        message = `performed ${action} on ${entityLabel.toLowerCase()}`;
    }
    
    return message;
  };

  if (compact) {
    return (
      <div className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <div className="flex items-center space-x-3">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${colorClasses}`}>
            <IconComponent className="w-3 h-3" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 dark:text-white truncate">
              <span className="font-medium">{activity.user_name || 'Someone'}</span>
              {' '}
              {formatActivityMessage(activity)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(activity.created_at)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="flex space-x-3">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClasses}`}>
          <IconComponent className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-900 dark:text-white">
                <span className="font-medium">{activity.user_name || 'Someone'}</span>
                {' '}
                {formatActivityMessage(activity)}
              </p>
              
              {/* Additional Details */}
              {activity.changes && Object.keys(activity.changes).length > 0 && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <details className="group">
                    <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                      View changes
                    </summary>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                      {Object.entries(activity.changes).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                          <span className="text-gray-900 dark:text-white ml-2">{JSON.stringify(value)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
            
            <time className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              {formatRelativeTime(activity.created_at)}
            </time>
          </div>
        </div>
      </div>
    </div>
  );
};

// Activity Feed Skeleton
const ActivitySkeleton = ({ compact = false }) => {
  const height = compact ? 'h-12' : 'h-16';
  
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`p-4 animate-pulse ${height}`}>
          <div className="flex space-x-3">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              {!compact && <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Compact Activity Feed for sidebars/widgets
export const CompactActivityFeed = ({ programId, limit = 5, className = '' }) => {
  return (
    <ActivityFeed
      programId={programId}
      limit={limit}
      className={className}
      showFilters={false}
      compact={true}
    />
  );
};

