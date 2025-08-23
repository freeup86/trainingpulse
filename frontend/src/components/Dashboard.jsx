import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  Target,
  CheckCircle,
  AlertTriangle,
  Plus,
  Settings,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  X,
  Edit,
  Copy,
  Trash2,
  Layout,
  Grid,
  Filter,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Move,
  Zap,
  Activity,
  Award,
  FileText
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { analytics } from '../lib/api';

// Widget Types
const WIDGET_TYPES = {
  STATS_CARD: 'stats_card',
  LINE_CHART: 'line_chart',
  BAR_CHART: 'bar_chart',
  PIE_CHART: 'pie_chart',
  AREA_CHART: 'area_chart',
  PROGRESS_TRACKER: 'progress_tracker',
  ACTIVITY_FEED: 'activity_feed',
  TASK_LIST: 'task_list',
  TEAM_OVERVIEW: 'team_overview',
  TIME_TRACKING: 'time_tracking',
  CALENDAR_VIEW: 'calendar_view',
  CUSTOM_EMBED: 'custom_embed'
};

// Predefined color schemes
const COLOR_SCHEMES = {
  blue: ['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'],
  green: ['#10B981', '#34D399', '#6EE7B7', '#D1FAE5'],
  purple: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#EDE9FE'],
  orange: ['#F59E0B', '#FBBF24', '#FCD34D', '#FEF3C7'],
  red: ['#EF4444', '#F87171', '#FCA5A5', '#FEE2E2'],
  indigo: ['#6366F1', '#818CF8', '#A5B4FC', '#E0E7FF']
};

// Main Dashboard Component
export const Dashboard = ({ 
  dashboardId,
  isEditable = true,
  className = ''
}) => {
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState(null);

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', dashboardId],
    queryFn: () => dashboards.getById(dashboardId),
    enabled: !!dashboardId,
  });

  // Update dashboard layout mutation
  const updateLayoutMutation = useMutation({
    mutationFn: ({ id, layout }) => dashboards.updateLayout(id, layout),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', dashboardId]);
      toast.success('Dashboard layout updated');
    },
  });

  // Add widget mutation
  const addWidgetMutation = useMutation({
    mutationFn: ({ dashboardId, widget }) => dashboards.addWidget(dashboardId, widget),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', dashboardId]);
      setShowWidgetPicker(false);
      toast.success('Widget added successfully');
    },
  });

  // Update widget mutation
  const updateWidgetMutation = useMutation({
    mutationFn: ({ widgetId, data }) => dashboards.updateWidget(widgetId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', dashboardId]);
      toast.success('Widget updated');
    },
  });

  // Delete widget mutation
  const deleteWidgetMutation = useMutation({
    mutationFn: (widgetId) => dashboards.deleteWidget(widgetId),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', dashboardId]);
      toast.success('Widget deleted');
    },
  });

  const dashboard = dashboardData?.data;
  const widgets = dashboard?.widgets || [];

  const handleDragStart = (e, widget) => {
    setDraggedWidget(widget);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetWidget) => {
    e.preventDefault();
    if (draggedWidget && targetWidget && draggedWidget.id !== targetWidget.id) {
      // Implement layout update logic
      const newLayout = widgets.map(widget => {
        if (widget.id === draggedWidget.id) {
          return { ...widget, position: targetWidget.position };
        }
        if (widget.id === targetWidget.id) {
          return { ...widget, position: draggedWidget.position };
        }
        return widget;
      });
      
      updateLayoutMutation.mutate({
        id: dashboardId,
        layout: newLayout
      });
    }
    setDraggedWidget(null);
  };

  if (isLoading) {
    return <DashboardSkeleton className={className} />;
  }

  if (!dashboard) {
    return <DashboardEmptyState onCreateWidget={() => setShowWidgetPicker(true)} className={className} />;
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Dashboard Header */}
      <DashboardHeader
        dashboard={dashboard}
        isEditMode={isEditMode}
        onEditModeChange={setIsEditMode}
        onAddWidget={() => setShowWidgetPicker(true)}
        isEditable={isEditable}
      />

      {/* Dashboard Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {widgets.map((widget) => (
            <DashboardWidget
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
              onEdit={() => setSelectedWidget(widget)}
              onDelete={() => deleteWidgetMutation.mutate(widget.id)}
              onDragStart={(e) => handleDragStart(e, widget)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, widget)}
              draggable={isEditMode}
            />
          ))}
          
          {/* Add Widget Button */}
          {isEditMode && (
            <div
              onClick={() => setShowWidgetPicker(true)}
              className="col-span-1 min-h-[200px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <div className="text-center">
                <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Add Widget</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Widget Picker Modal */}
      {showWidgetPicker && (
        <WidgetPickerModal
          onClose={() => setShowWidgetPicker(false)}
          onAddWidget={(widget) => addWidgetMutation.mutate({ dashboardId, widget })}
        />
      )}

      {/* Widget Editor Modal */}
      {selectedWidget && (
        <WidgetEditorModal
          widget={selectedWidget}
          onClose={() => setSelectedWidget(null)}
          onSave={(data) => {
            updateWidgetMutation.mutate({ widgetId: selectedWidget.id, data });
            setSelectedWidget(null);
          }}
        />
      )}
    </div>
  );
};

// Dashboard Header
const DashboardHeader = ({ 
  dashboard, 
  isEditMode, 
  onEditModeChange, 
  onAddWidget, 
  isEditable 
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {dashboard.name}
            </h1>
            {dashboard.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {dashboard.description}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Dashboard Stats */}
            <div className="hidden md:flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <Grid className="w-4 h-4" />
                <span>{dashboard.widgets?.length || 0} widgets</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Updated {new Date(dashboard.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            {isEditable && (
              <>
                <button
                  onClick={() => onEditModeChange(!isEditMode)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isEditMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {isEditMode ? 'Done Editing' : 'Edit Dashboard'}
                </button>

                {isEditMode && (
                  <button
                    onClick={onAddWidget}
                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Widget</span>
                  </button>
                )}
              </>
            )}

            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {showActions && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[150px]">
                  <DashboardActions 
                    dashboard={dashboard}
                    onClose={() => setShowActions(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Actions Menu
const DashboardActions = ({ dashboard, onClose }) => {
  const actions = [
    { icon: <RefreshCw className="w-4 h-4" />, label: 'Refresh Data', onClick: () => {} },
    { icon: <Download className="w-4 h-4" />, label: 'Export Dashboard', onClick: () => {} },
    { icon: <Copy className="w-4 h-4" />, label: 'Duplicate', onClick: () => {} },
    { icon: <Settings className="w-4 h-4" />, label: 'Settings', onClick: () => {} },
  ];

  return (
    <div className="py-1">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
};

// Individual Dashboard Widget
const DashboardWidget = ({ 
  widget, 
  isEditMode, 
  onEdit, 
  onDelete, 
  onDragStart, 
  onDragOver, 
  onDrop,
  draggable 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const getWidgetSize = () => {
    switch (widget.size) {
      case 'small': return 'col-span-1 row-span-1';
      case 'medium': return 'col-span-2 row-span-1';
      case 'large': return 'col-span-2 row-span-2';
      case 'wide': return 'col-span-3 row-span-1';
      case 'tall': return 'col-span-1 row-span-2';
      default: return 'col-span-1 row-span-1';
    }
  };

  const WidgetComponent = getWidgetComponent(widget.type);

  return (
    <div
      className={`${getWidgetSize()} ${
        isEditMode ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      } bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow group`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {getWidgetIcon(widget.type)}
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {widget.title}
          </h3>
        </div>

        <div className="flex items-center space-x-1">
          {isEditMode ? (
            <>
              <button
                onClick={onEdit}
                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="p-1 text-gray-400 cursor-move">
                <Move className="w-4 h-4" />
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showActions && (
                  <WidgetActionsMenu 
                    widget={widget}
                    onClose={() => setShowActions(false)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="p-4 h-full">
        <WidgetComponent widget={widget} isFullscreen={isFullscreen} />
      </div>
    </div>
  );
};

// Widget Actions Menu
const WidgetActionsMenu = ({ widget, onClose }) => {
  return (
    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
      <div className="py-1">
        <button className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2">
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
        <button className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};

// Widget Picker Modal
const WidgetPickerModal = ({ onClose, onAddWidget }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWidget, setSelectedWidget] = useState(null);

  const widgetCategories = {
    all: 'All Widgets',
    analytics: 'Analytics',
    tracking: 'Tracking',
    team: 'Team',
    custom: 'Custom'
  };

  const availableWidgets = [
    {
      type: WIDGET_TYPES.STATS_CARD,
      title: 'Stats Card',
      description: 'Display key metrics and KPIs',
      category: 'analytics',
      icon: <BarChart3 className="w-6 h-6" />
    },
    {
      type: WIDGET_TYPES.LINE_CHART,
      title: 'Line Chart',
      description: 'Show trends over time',
      category: 'analytics',
      icon: <TrendingUp className="w-6 h-6" />
    },
    {
      type: WIDGET_TYPES.PIE_CHART,
      title: 'Pie Chart',
      description: 'Display data distribution',
      category: 'analytics',
      icon: <PieChart className="w-6 h-6" />
    },
    {
      type: WIDGET_TYPES.PROGRESS_TRACKER,
      title: 'Progress Tracker',
      description: 'Track completion progress',
      category: 'tracking',
      icon: <Target className="w-6 h-6" />
    },
    {
      type: WIDGET_TYPES.TIME_TRACKING,
      title: 'Time Tracking',
      description: 'Monitor time spent on tasks',
      category: 'tracking',
      icon: <Clock className="w-6 h-6" />
    },
    {
      type: WIDGET_TYPES.TEAM_OVERVIEW,
      title: 'Team Overview',
      description: 'See team activity and status',
      category: 'team',
      icon: <Users className="w-6 h-6" />
    },
    {
      type: WIDGET_TYPES.ACTIVITY_FEED,
      title: 'Activity Feed',
      description: 'Recent activity and updates',
      category: 'team',
      icon: <Activity className="w-6 h-6" />
    },
    {
      type: WIDGET_TYPES.TASK_LIST,
      title: 'Task List',
      description: 'Display upcoming tasks',
      category: 'tracking',
      icon: <CheckCircle className="w-6 h-6" />
    }
  ];

  const filteredWidgets = selectedCategory === 'all' 
    ? availableWidgets 
    : availableWidgets.filter(w => w.category === selectedCategory);

  const handleAddWidget = () => {
    if (selectedWidget) {
      onAddWidget({
        type: selectedWidget.type,
        title: selectedWidget.title,
        size: 'medium',
        settings: {},
        position: { x: 0, y: 0 }
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Add Widget
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex space-x-6 h-full">
          {/* Categories */}
          <div className="w-48">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Categories</h3>
            <div className="space-y-1">
              {Object.entries(widgetCategories).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === key
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Widget Grid */}
          <div className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredWidgets.map((widget) => (
                <div
                  key={widget.type}
                  onClick={() => setSelectedWidget(widget)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedWidget?.type === widget.type
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                      {React.cloneElement(widget.icon, { 
                        className: "w-6 h-6 text-gray-600 dark:text-gray-400" 
                      })}
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                      {widget.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {widget.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleAddWidget}
            disabled={!selectedWidget}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Add Widget
          </button>
        </div>
      </div>
    </div>
  );
};

// Widget Editor Modal
const WidgetEditorModal = ({ widget, onClose, onSave }) => {
  const [settings, setSettings] = useState(widget.settings || {});
  const [title, setTitle] = useState(widget.title);
  const [size, setSize] = useState(widget.size || 'medium');

  const sizeOptions = [
    { value: 'small', label: 'Small (1x1)' },
    { value: 'medium', label: 'Medium (2x1)' },
    { value: 'large', label: 'Large (2x2)' },
    { value: 'wide', label: 'Wide (3x1)' },
    { value: 'tall', label: 'Tall (1x2)' }
  ];

  const handleSave = () => {
    onSave({
      title,
      size,
      settings
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Widget
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Widget Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Widget Size
            </label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {sizeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Widget-specific settings */}
          <WidgetSettings
            type={widget.type}
            settings={settings}
            onChange={setSettings}
          />
        </div>

        <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Widget Settings Component
const WidgetSettings = ({ type, settings, onChange }) => {
  switch (type) {
    case WIDGET_TYPES.STATS_CARD:
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Metric
            </label>
            <select
              value={settings.metric || ''}
              onChange={(e) => onChange({ ...settings, metric: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select metric</option>
              <option value="total_tasks">Total Tasks</option>
              <option value="completed_tasks">Completed Tasks</option>
              <option value="active_users">Active Users</option>
              <option value="total_time">Total Time Tracked</option>
            </select>
          </div>
        </div>
      );

    case WIDGET_TYPES.LINE_CHART:
    case WIDGET_TYPES.BAR_CHART:
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data Source
            </label>
            <select
              value={settings.dataSource || ''}
              onChange={(e) => onChange({ ...settings, dataSource: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select data source</option>
              <option value="task_completion">Task Completion</option>
              <option value="time_tracking">Time Tracking</option>
              <option value="user_activity">User Activity</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Period
            </label>
            <select
              value={settings.timePeriod || '30d'}
              onChange={(e) => onChange({ ...settings, timePeriod: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          No additional settings for this widget type.
        </div>
      );
  }
};

// Dashboard Skeleton
const DashboardSkeleton = ({ className }) => {
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
              <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Dashboard Empty State
const DashboardEmptyState = ({ onCreateWidget, className }) => {
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center ${className}`}>
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
          <Layout className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No dashboard configured
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Create your first widget to get started with your dashboard
        </p>
        <button
          onClick={onCreateWidget}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add First Widget
        </button>
      </div>
    </div>
  );
};

// Helper functions
const getWidgetIcon = (type) => {
  const iconMap = {
    [WIDGET_TYPES.STATS_CARD]: <BarChart3 className="w-5 h-5 text-blue-600" />,
    [WIDGET_TYPES.LINE_CHART]: <TrendingUp className="w-5 h-5 text-green-600" />,
    [WIDGET_TYPES.BAR_CHART]: <BarChart3 className="w-5 h-5 text-purple-600" />,
    [WIDGET_TYPES.PIE_CHART]: <PieChart className="w-5 h-5 text-orange-600" />,
    [WIDGET_TYPES.PROGRESS_TRACKER]: <Target className="w-5 h-5 text-red-600" />,
    [WIDGET_TYPES.TIME_TRACKING]: <Clock className="w-5 h-5 text-blue-600" />,
    [WIDGET_TYPES.TEAM_OVERVIEW]: <Users className="w-5 h-5 text-green-600" />,
    [WIDGET_TYPES.ACTIVITY_FEED]: <Activity className="w-5 h-5 text-purple-600" />,
    [WIDGET_TYPES.TASK_LIST]: <CheckCircle className="w-5 h-5 text-orange-600" />
  };
  
  return iconMap[type] || <Grid className="w-5 h-5 text-gray-600" />;
};

const getWidgetComponent = (type) => {
  const componentMap = {
    [WIDGET_TYPES.STATS_CARD]: StatsCardWidget,
    [WIDGET_TYPES.LINE_CHART]: LineChartWidget,
    [WIDGET_TYPES.BAR_CHART]: BarChartWidget,
    [WIDGET_TYPES.PIE_CHART]: PieChartWidget,
    [WIDGET_TYPES.PROGRESS_TRACKER]: ProgressTrackerWidget,
    [WIDGET_TYPES.TIME_TRACKING]: TimeTrackingWidget,
    [WIDGET_TYPES.TEAM_OVERVIEW]: TeamOverviewWidget,
    [WIDGET_TYPES.ACTIVITY_FEED]: ActivityFeedWidget,
    [WIDGET_TYPES.TASK_LIST]: TaskListWidget
  };
  
  return componentMap[type] || PlaceholderWidget;
};

// Widget Components
const StatsCardWidget = ({ widget }) => {
  const { data } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => analytics.getMetric(widget.settings.metric),
  });

  const value = data?.value || 0;
  const change = data?.change || 0;
  const isPositive = change >= 0;

  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {value.toLocaleString()}
      </div>
      <div className={`flex items-center justify-center space-x-1 text-sm ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span>{Math.abs(change)}%</span>
      </div>
    </div>
  );
};

const LineChartWidget = ({ widget }) => {
  const { data } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => analytics.getChartData(widget.settings.dataSource, widget.settings.timePeriod),
  });

  const chartData = data?.data || [];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#3B82F6" 
          strokeWidth={2}
          dot={{ fill: '#3B82F6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const BarChartWidget = ({ widget }) => {
  const { data } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => analytics.getChartData(widget.settings.dataSource, widget.settings.timePeriod),
  });

  const chartData = data?.data || [];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#8B5CF6" />
      </BarChart>
    </ResponsiveContainer>
  );
};

const PieChartWidget = ({ widget }) => {
  const { data } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => analytics.getPieData(widget.settings.dataSource),
  });

  const chartData = data?.data || [];
  const colors = COLOR_SCHEMES.blue;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RechartsPieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

const ProgressTrackerWidget = ({ widget }) => {
  const { data } = useQuery({
    queryKey: ['widget-data', widget.id],
    queryFn: () => analytics.getProgress(widget.settings.target),
  });

  const progress = data?.progress || 0;
  const total = data?.total || 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {progress}/{total}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
        <div 
          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
          style={{ width: `${(progress / total) * 100}%` }}
        />
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {Math.round((progress / total) * 100)}%
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">Complete</div>
      </div>
    </div>
  );
};

const TimeTrackingWidget = ({ widget }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">Today</span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">6h 42m</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">This Week</span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">34h 15m</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">This Month</span>
        <span className="text-lg font-bold text-gray-900 dark:text-white">142h 30m</span>
      </div>
    </div>
  );
};

const TeamOverviewWidget = ({ widget }) => {
  const teamMembers = [
    { name: 'Alice Johnson', status: 'online', tasks: 5 },
    { name: 'Bob Smith', status: 'away', tasks: 3 },
    { name: 'Carol Davis', status: 'offline', tasks: 8 },
  ];

  return (
    <div className="space-y-3">
      {teamMembers.map((member, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              member.status === 'online' ? 'bg-green-500' :
              member.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
            }`} />
            <span className="text-sm text-gray-900 dark:text-white">{member.name}</span>
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">{member.tasks} tasks</span>
        </div>
      ))}
    </div>
  );
};

const ActivityFeedWidget = ({ widget }) => {
  const activities = [
    { user: 'John', action: 'completed task', item: 'Design Review', time: '2m ago' },
    { user: 'Sarah', action: 'created course', item: 'React Fundamentals', time: '5m ago' },
    { user: 'Mike', action: 'commented on', item: 'Project Planning', time: '10m ago' },
  ];

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => (
        <div key={index} className="text-xs">
          <span className="font-medium text-gray-900 dark:text-white">{activity.user}</span>
          <span className="text-gray-600 dark:text-gray-400"> {activity.action} </span>
          <span className="font-medium text-gray-900 dark:text-white">{activity.item}</span>
          <div className="text-gray-500 dark:text-gray-500 mt-1">{activity.time}</div>
        </div>
      ))}
    </div>
  );
};

const TaskListWidget = ({ widget }) => {
  const tasks = [
    { title: 'Review design mockups', priority: 'high', due: 'Today' },
    { title: 'Update documentation', priority: 'medium', due: 'Tomorrow' },
    { title: 'Plan team meeting', priority: 'low', due: 'Friday' },
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  return (
    <div className="space-y-3">
      {tasks.map((task, index) => (
        <div key={index} className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-gray-400" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {task.title}
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className={getPriorityColor(task.priority)}>{task.priority}</span>
              <span className="text-gray-500 dark:text-gray-500">•</span>
              <span className="text-gray-500 dark:text-gray-500">{task.due}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PlaceholderWidget = ({ widget }) => {
  return (
    <div className="flex items-center justify-center h-32 text-gray-400">
      <div className="text-center">
        <Grid className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Widget not implemented</p>
      </div>
    </div>
  );
};

export default Dashboard;