import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  GitBranch, 
  Plus, 
  Search,
  Filter,
  Edit,
  Play,
  Pause,
  CheckCircle,
  Clock,
  AlertTriangle,
  Settings,
  Users,
  ArrowRight,
  MoreHorizontal,
  Copy,
  Trash2,
  Activity,
  UserPlus,
  FileText,
  Workflow
} from 'lucide-react';
import { workflows } from '../lib/api';
import { formatDate, formatRelativeTime, getStatusColor } from '../lib/utils';
import WorkflowDesigner from '../components/WorkflowDesigner';

const WORKFLOW_STATES = {
  'draft': { icon: Clock, label: 'Draft', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700' },
  'content_development': { icon: Clock, label: 'Development', color: 'text-blue-500 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  'review': { icon: AlertTriangle, label: 'Review', color: 'text-yellow-500 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  'approval': { icon: Pause, label: 'Approval', color: 'text-orange-500 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  'published': { icon: CheckCircle, label: 'Published', color: 'text-green-500 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  'archived': { icon: Clock, label: 'Archived', color: 'text-gray-400 dark:text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-700' }
};

function WorkflowsPage() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('templates');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [templateToDuplicate, setTemplateToDuplicate] = useState(null);

  // Fetch workflow templates
  const { data: templatesData, isLoading: templatesLoading, error: templatesError, refetch } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => workflows.getTemplates({ _t: Date.now() }),
    staleTime: 0, // Force fresh data
    cacheTime: 0, // Don't cache
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: false
  });
  
  // Fetch workflow instances  
  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['workflow-instances'],
    queryFn: () => workflows.getInstances({ _t: Date.now() }),
    enabled: selectedTab === 'instances', // Only fetch when instances tab is selected
    staleTime: 0, // Force fresh data
    cacheTime: 0  // Don't cache
  });
  
  // Fetch selected workflow data
  const { data: selectedWorkflowData } = useQuery({
    queryKey: ['workflow-template', selectedWorkflowId],
    queryFn: () => workflows.getById(selectedWorkflowId),
    enabled: Boolean(selectedWorkflowId),
    staleTime: 0, // Force fresh data
    cacheTime: 0  // Don't cache
  });

  // Fetch activity data for selected workflow
  const { data: activityData } = useQuery({
    queryKey: ['workflow-activity', selectedWorkflowId],
    queryFn: () => workflows.getActivity(selectedWorkflowId, { limit: 10 }),
    enabled: Boolean(selectedWorkflowId),
    staleTime: 0,
    cacheTime: 0
  });

  if (templatesLoading && selectedTab === 'templates') {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (templatesError && selectedTab === 'templates') {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error loading workflows
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {templatesError.message || 'Failed to load workflows. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle axios response structure - the API returns { data: { success: true, data: [...] } }
  const templates = Array.isArray(templatesData?.data?.data) 
    ? templatesData.data.data 
    : Array.isArray(templatesData?.data) 
    ? templatesData.data 
    : [];
  const instances = Array.isArray(instancesData?.data?.data?.instances) 
    ? instancesData.data.data.instances 
    : [];
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredInstances = instances.filter(instance =>
    instance.courseName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    instance.templateName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'templates', label: 'Templates', icon: GitBranch },
    { id: 'instances', label: 'Active Workflows', icon: Play },
    { id: 'designer', label: 'Designer', icon: Settings }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workflows</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage workflow templates, track active instances, and design custom workflows
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                setShowDuplicateModal(true);
              }}
              disabled={!templates || templates.length === 0 || templatesLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate Template
            </button>
            <button 
              onClick={() => navigate('/workflows/create')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
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
        {selectedTab === 'templates' && (
          <WorkflowTemplates
            templates={filteredTemplates}
            onSelectTemplate={setSelectedWorkflowId}
            selectedTemplate={selectedWorkflowData?.data?.data}
            activityData={activityData?.data?.data}
          />
        )}
        {selectedTab === 'instances' && (
          <WorkflowInstances
            instances={filteredInstances}
            loading={instancesLoading}
          />
        )}
        {selectedTab === 'designer' && (
          <WorkflowDesigner />
        )}
      </div>

      {/* Duplicate Template Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Select Template to Duplicate
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Choose a workflow template to use as the basis for your new template.
            </p>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {templates && templates.length > 0 ? (
                templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    navigate(`/workflows/create?duplicateFrom=${template.id}`);
                    setShowDuplicateModal(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </h4>
                      {template.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-2 space-x-3">
                        <span>{template.stageCount || template.states?.length || 0} stages</span>
                        <span>Created {formatDate(template.createdAt || template.created_at)}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  </div>
                </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <GitBranch className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                  <p>No templates available to duplicate</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Workflow Templates Component
function WorkflowTemplates({ templates, onSelectTemplate, selectedTemplate, activityData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Templates List */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Templates</h3>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {templates.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <GitBranch className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p>No templates found</p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => onSelectTemplate(template.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    selectedTemplate?.id === template.id ? 'bg-blue-50 dark:bg-blue-900/30 border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {template.name}
                      </h4>
                      {template.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {template.description}
                        </p>
                      )}
                      <div className="mt-1 flex items-center text-xs text-gray-400 dark:text-gray-500">
                        <span>{template.states?.length || 0} stages</span>
                        <span className="mx-2">•</span>
                        <span>{template.usageCount || 0} courses</span>
                      </div>
                    </div>
                    <MoreHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Template Details */}
      <div className="lg:col-span-2">
        {selectedTemplate ? (
          <WorkflowTemplateDetail template={selectedTemplate} activity={activityData} />
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Template</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Choose a workflow template from the list to view its details and stages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Workflow Template Detail Component
function WorkflowTemplateDetail({ template, activity }) {
  const navigate = useNavigate();
  const [showAllActivities, setShowAllActivities] = useState(false);
  const stages = template.states || [];
  const activities = activity?.activities || [];

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{template.name}</h3>
            {template.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{template.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => navigate(`/workflows/${template.id}/edit`)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </button>
            <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Template Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stages.length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Stages</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{template.usageCount || 0}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Courses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{template.completionRate || 0}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Completion Rate</p>
          </div>
        </div>

        {/* Workflow Stages */}
        <div>
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Workflow Stages</h4>
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{index + 1}</span>
                </div>
                <div className="ml-4 flex-1">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">{stage.display_name}</h5>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stage.state_name}</p>
                </div>
                {index < stages.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-400 dark:text-gray-500 ml-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Recent Activity</h4>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            {activities.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                No recent activity
              </p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 5).map((activity, index) => {
                  const getActivityIcon = (type) => {
                    switch (type) {
                      case 'transition':
                        return <Workflow className="h-4 w-4 text-blue-500" />;
                      case 'assignment':
                        return <UserPlus className="h-4 w-4 text-green-500" />;
                      case 'course_created':
                        return <FileText className="h-4 w-4 text-purple-500" />;
                      default:
                        return <Activity className="h-4 w-4 text-gray-500" />;
                    }
                  };

                  const getActivityText = (activity) => {
                    switch (activity.type) {
                      case 'transition':
                        return (
                          <span>
                            <span className="font-medium">{activity.userName}</span> moved{' '}
                            <span className="font-medium">{activity.courseTitle}</span> from{' '}
                            <span className="bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">
                              {activity.fromState || 'start'}
                            </span> to{' '}
                            <span className="bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">
                              {activity.toState}
                            </span>
                          </span>
                        );
                      case 'assignment':
                        return (
                          <span>
                            <span className="font-medium">{activity.userName}</span> assigned{' '}
                            <span className="font-medium">{activity.assignedUserName}</span> as{' '}
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1 rounded text-xs">
                              {activity.assignmentRole}
                            </span> to{' '}
                            <span className="font-medium">{activity.courseTitle}</span>
                          </span>
                        );
                      case 'course_created':
                        return (
                          <span>
                            <span className="font-medium">{activity.userName}</span> created course{' '}
                            <span className="font-medium">{activity.courseTitle}</span>
                          </span>
                        );
                      default:
                        return 'Unknown activity';
                    }
                  };

                  return (
                    <div key={`${activity.type}_${activity.createdAt}_${index}`} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white">
                          {getActivityText(activity)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatRelativeTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {activities.length > 5 && (
                  <div className="text-center pt-2">
                    <button 
                      onClick={() => setShowAllActivities(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      View all {activities.length} activities
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Modal */}
      {showAllActivities && (
        <ActivityModal 
          activities={activities}
          templateName={template.name}
          onClose={() => setShowAllActivities(false)}
        />
      )}
    </div>
  );
}

// Activity Modal Component
function ActivityModal({ activities, templateName, onClose }) {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'transition':
        return <Workflow className="h-4 w-4 text-blue-500" />;
      case 'assignment':
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'course_created':
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityText = (activity) => {
    switch (activity.type) {
      case 'transition':
        return (
          <span>
            <span className="font-medium">{activity.userName}</span> moved{' '}
            <span className="font-medium">{activity.courseTitle}</span> from{' '}
            <span className="bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">
              {activity.fromState || 'start'}
            </span> to{' '}
            <span className="bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">
              {activity.toState}
            </span>
          </span>
        );
      case 'assignment':
        return (
          <span>
            <span className="font-medium">{activity.userName}</span> assigned{' '}
            <span className="font-medium">{activity.assignedUserName}</span> as{' '}
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1 rounded text-xs">
              {activity.assignmentRole}
            </span> to{' '}
            <span className="font-medium">{activity.courseTitle}</span>
          </span>
        );
      case 'course_created':
        return (
          <span>
            <span className="font-medium">{activity.userName}</span> created course{' '}
            <span className="font-medium">{activity.courseTitle}</span>
          </span>
        );
      default:
        return 'Unknown activity';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            All Activity - {templateName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No activities yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div key={`modal_${activity.type}_${activity.createdAt}_${index}`} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex-shrink-0 mt-0.5">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {getActivityText(activity)}
                    </p>
                    {activity.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                        "{activity.notes}"
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatRelativeTime(activity.createdAt)} • {formatDate(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
            <span>Total: {activities.length} activities</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Workflow Instances Component
function WorkflowInstances({ instances, loading }) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active Workflow Instances</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {instances.length} active workflow{instances.length !== 1 ? 's' : ''}
        </p>
      </div>

      {instances.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <Play className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Workflows</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Workflow instances will appear here when courses are in progress.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {instances.map((instance) => {
              const stateInfo = WORKFLOW_STATES[instance.currentState] || WORKFLOW_STATES['draft'];
              const StateIcon = stateInfo.icon;
              
              return (
                <li key={instance.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {instance.courseName || 'Untitled Course'}
                          </h4>
                          <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stateInfo.bgColor} ${stateInfo.color}`}>
                            <StateIcon className="h-3 w-3 mr-1" />
                            {stateInfo.label}
                          </span>
                        </div>
                        
                        <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                          <span>Template: {instance.templateName}</span>
                          <span>Stage: {instance.currentStage || 1}/{instance.totalStages || 5}</span>
                          <span>Started: {formatRelativeTime(instance.startedAt)}</span>
                          {instance.assignedTo && (
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              <span>{instance.assignedTo}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => navigate(`/courses/${instance.course_id}`)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          View Progress
                        </button>
                        <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}


export default WorkflowsPage;