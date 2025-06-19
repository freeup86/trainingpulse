import { useState } from 'react';
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
  Trash2
} from 'lucide-react';
// import { workflows, courses } from '../lib/api';
import { formatDate, formatRelativeTime, getStatusColor } from '../lib/utils';

const WORKFLOW_STATES = {
  'draft': { icon: Clock, label: 'Draft', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  'content_development': { icon: Clock, label: 'Development', color: 'text-blue-500', bgColor: 'bg-blue-100' },
  'review': { icon: AlertTriangle, label: 'Review', color: 'text-yellow-500', bgColor: 'bg-yellow-100' },
  'approval': { icon: Pause, label: 'Approval', color: 'text-orange-500', bgColor: 'bg-orange-100' },
  'published': { icon: CheckCircle, label: 'Published', color: 'text-green-500', bgColor: 'bg-green-100' },
  'archived': { icon: Clock, label: 'Archived', color: 'text-gray-400', bgColor: 'bg-gray-100' }
};

function WorkflowsPage() {
  const [selectedTab, setSelectedTab] = useState('templates');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  // Mock data instead of API calls for now
  const templatesData = {
    data: {
      templates: [
        {
          id: 1,
          name: 'Standard Course Workflow',
          description: 'Default workflow for most training courses',
          stageCount: 5,
          usageCount: 45,
          completionRate: 87
        },
        {
          id: 2,
          name: 'Fast Track Workflow',
          description: 'Accelerated workflow for urgent courses',
          stageCount: 3,
          usageCount: 12,
          completionRate: 92
        }
      ]
    }
  };
  
  const instancesData = {
    data: {
      instances: [
        {
          id: 1,
          courseName: 'Advanced JavaScript Training',
          templateName: 'Standard Course Workflow',
          currentState: 'review',
          currentStage: 3,
          totalStages: 5,
          startedAt: '2024-01-10T10:00:00Z',
          assignedTo: 'John Doe'
        }
      ]
    }
  };
  
  const selectedWorkflowData = selectedWorkflowId ? {
    data: templatesData.data.templates.find(t => t.id === selectedWorkflowId)
  } : null;
  
  const templatesLoading = false;
  const templatesError = null;
  const instancesLoading = false;

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
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading workflows
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {templatesError.message || 'Failed to load workflows. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const templates = templatesData?.data?.templates || [];
  const instances = instancesData?.data?.instances || [];
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
            <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage workflow templates, track active instances, and design custom workflows
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Copy className="h-4 w-4 mr-2" />
              Duplicate Template
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
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
        {selectedTab === 'templates' && (
          <WorkflowTemplates
            templates={filteredTemplates}
            onSelectTemplate={setSelectedWorkflowId}
            selectedTemplate={selectedWorkflowData?.data}
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
    </div>
  );
}

// Workflow Templates Component
function WorkflowTemplates({ templates, onSelectTemplate, selectedTemplate }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Templates List */}
      <div className="lg:col-span-1">
        <div className="bg-white shadow rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Templates</h3>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {templates.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <GitBranch className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No templates found</p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => onSelectTemplate(template.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedTemplate?.id === template.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {template.name}
                      </h4>
                      {template.description && (
                        <p className="text-sm text-gray-500 truncate">
                          {template.description}
                        </p>
                      )}
                      <div className="mt-1 flex items-center text-xs text-gray-400">
                        <span>{template.stageCount || 0} stages</span>
                        <span className="mx-2">•</span>
                        <span>{template.usageCount || 0} courses</span>
                      </div>
                    </div>
                    <MoreHorizontal className="h-4 w-4 text-gray-400" />
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
          <WorkflowTemplateDetail template={selectedTemplate} />
        ) : (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Template</h3>
            <p className="text-gray-500">
              Choose a workflow template from the list to view its details and stages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Workflow Template Detail Component
function WorkflowTemplateDetail({ template }) {
  const stages = template.stages || [
    { id: 1, name: 'Draft', description: 'Initial course creation', order: 1 },
    { id: 2, name: 'Content Development', description: 'Course content creation and development', order: 2 },
    { id: 3, name: 'Review', description: 'Content review and quality assurance', order: 3 },
    { id: 4, name: 'Approval', description: 'Final approval for publication', order: 4 },
    { id: 5, name: 'Published', description: 'Course is live and available', order: 5 }
  ];

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
            {template.description && (
              <p className="mt-1 text-sm text-gray-500">{template.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </button>
            <button className="text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Template Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{stages.length}</p>
            <p className="text-sm text-gray-500">Stages</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{template.usageCount || 0}</p>
            <p className="text-sm text-gray-500">Active Courses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{template.completionRate || 0}%</p>
            <p className="text-sm text-gray-500">Completion Rate</p>
          </div>
        </div>

        {/* Workflow Stages */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">Workflow Stages</h4>
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">{stage.order}</span>
                </div>
                <div className="ml-4 flex-1">
                  <h5 className="text-sm font-medium text-gray-900">{stage.name}</h5>
                  {stage.description && (
                    <p className="text-sm text-gray-500">{stage.description}</p>
                  )}
                </div>
                {index < stages.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-400 ml-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-3">Recent Activity</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 text-center">
              Activity tracking will be available soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Workflow Instances Component
function WorkflowInstances({ instances, loading }) {
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
        <h3 className="text-lg font-medium text-gray-900">Active Workflow Instances</h3>
        <p className="text-sm text-gray-500">
          {instances.length} active workflow{instances.length !== 1 ? 's' : ''}
        </p>
      </div>

      {instances.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <Play className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Workflows</h3>
          <p className="text-gray-500">
            Workflow instances will appear here when courses are in progress.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {instances.map((instance) => {
              const stateInfo = WORKFLOW_STATES[instance.currentState] || WORKFLOW_STATES['draft'];
              const StateIcon = stateInfo.icon;
              
              return (
                <li key={instance.id} className="hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {instance.courseName || 'Untitled Course'}
                          </h4>
                          <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stateInfo.bgColor} ${stateInfo.color}`}>
                            <StateIcon className="h-3 w-3 mr-1" />
                            {stateInfo.label}
                          </span>
                        </div>
                        
                        <div className="mt-1 flex items-center text-sm text-gray-500 space-x-4">
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
                        <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                          View Progress
                        </button>
                        <button className="text-gray-400 hover:text-gray-600">
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

// Workflow Designer Component
function WorkflowDesigner() {
  return (
    <div className="bg-white shadow rounded-lg p-8 text-center">
      <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Workflow Designer</h3>
      <p className="text-gray-500 mb-4">
        Visual workflow designer with drag-and-drop stage creation will be available soon.
      </p>
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-md font-medium text-gray-900 mb-2">Coming Features:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Visual workflow builder</li>
          <li>• Custom stage creation</li>
          <li>• Conditional transitions</li>
          <li>• Role-based assignments</li>
          <li>• Automated notifications</li>
        </ul>
      </div>
    </div>
  );
}

export default WorkflowsPage;