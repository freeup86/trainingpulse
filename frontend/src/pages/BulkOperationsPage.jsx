import { useState } from 'react';
import { 
  CheckSquare, 
  Square,
  Plus, 
  Search,
  Filter,
  Users,
  Calendar,
  Tag,
  ArrowRight,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Settings,
  Play,
  Trash2
} from 'lucide-react';
// import { courses, users, bulkOperations } from '../lib/api';
import { formatDate, getStatusColor, getPriorityColor } from '../lib/utils';
import toast from 'react-hot-toast';

const BULK_OPERATIONS = [
  {
    id: 'assign_users',
    name: 'Assign Users',
    description: 'Assign selected courses to specific users or teams',
    icon: Users,
    color: 'text-blue-600'
  },
  {
    id: 'update_due_dates',
    name: 'Update Due Dates',
    description: 'Set or modify due dates for multiple courses',
    icon: Calendar,
    color: 'text-green-600'
  },
  {
    id: 'change_priority',
    name: 'Change Priority',
    description: 'Update priority levels for selected courses',
    icon: Tag,
    color: 'text-orange-600'
  },
  {
    id: 'workflow_transition',
    name: 'Workflow Transition',
    description: 'Move courses to the next workflow stage',
    icon: ArrowRight,
    color: 'text-purple-600'
  },
  {
    id: 'archive_courses',
    name: 'Archive Courses',
    description: 'Archive completed or obsolete courses',
    icon: Trash2,
    color: 'text-red-600'
  }
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const WORKFLOW_STATES = ['draft', 'content_development', 'review', 'approval', 'published'];

function BulkOperationsPage() {
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [operationParams, setOperationParams] = useState({});
  const [showOperationModal, setShowOperationModal] = useState(false);

  // Mock data instead of API calls for now
  const coursesData = {
    data: {
      courses: [
        {
          id: 1,
          title: 'JavaScript Fundamentals',
          description: 'Learn the basics of JavaScript programming',
          priority: 'high',
          workflowState: 'review',
          dueDate: '2024-02-15',
          assignments: [{ id: 1 }, { id: 2 }]
        },
        {
          id: 2,
          title: 'React Advanced Concepts',
          description: 'Advanced React patterns and best practices',
          priority: 'medium',
          workflowState: 'content_development',
          dueDate: '2024-02-28',
          assignments: [{ id: 3 }]
        }
      ]
    }
  };
  
  const usersData = {
    data: {
      users: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
      ]
    }
  };
  
  const operationHistoryData = {
    data: {
      operations: [
        {
          id: 1,
          operationType: 'Assign Users',
          status: 'completed',
          itemCount: 5,
          createdAt: '2024-01-15T10:00:00Z'
        }
      ]
    }
  };
  
  const isLoading = false;
  const error = null;

  const executeBulkOperation = {
    mutate: (params) => {
      // Mock execution
      setTimeout(() => {
        toast.success('Bulk operation completed successfully');
        setSelectedCourses(new Set());
        setShowOperationModal(false);
        setSelectedOperation(null);
      }, 1000);
    },
    isPending: false
  };

  const handleCourseSelection = (courseId) => {
    const newSelection = new Set(selectedCourses);
    if (newSelection.has(courseId)) {
      newSelection.delete(courseId);
    } else {
      newSelection.add(courseId);
    }
    setSelectedCourses(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedCourses.size === filteredCourses.length) {
      setSelectedCourses(new Set());
    } else {
      setSelectedCourses(new Set(filteredCourses.map(c => c.id)));
    }
  };

  const handleOperationSelect = (operation) => {
    if (selectedCourses.size === 0) {
      toast.error('Please select at least one course');
      return;
    }
    setSelectedOperation(operation);
    setOperationParams({});
    setShowOperationModal(true);
  };

  const handleExecuteOperation = () => {
    if (!selectedOperation || selectedCourses.size === 0) return;

    const params = {
      operation: selectedOperation.id,
      courseIds: Array.from(selectedCourses),
      ...operationParams
    };

    executeBulkOperation.mutate(params);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading courses
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error.message || 'Failed to load courses. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const coursesList = coursesData?.data?.courses || [];
  const usersList = usersData?.data?.users || [];
  const operationHistory = operationHistoryData?.data?.operations || [];
  
  const filteredCourses = coursesList.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulk Operations</h1>
            <p className="mt-1 text-sm text-gray-500">
              Perform batch operations on multiple courses simultaneously
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </button>
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Bulk Operations Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Operations</h3>
              <p className="text-sm text-gray-500">
                {selectedCourses.size} course{selectedCourses.size !== 1 ? 's' : ''} selected
              </p>
            </div>
            
            <div className="p-4 space-y-2">
              {BULK_OPERATIONS.map((operation) => {
                const Icon = operation.icon;
                return (
                  <button
                    key={operation.id}
                    onClick={() => handleOperationSelect(operation)}
                    disabled={selectedCourses.size === 0}
                    className="w-full flex items-start p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon className={`h-5 w-5 mt-0.5 mr-3 ${operation.color}`} />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {operation.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {operation.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Operations */}
          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Operations</h3>
            </div>
            
            <div className="p-4">
              {operationHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recent operations
                </p>
              ) : (
                <div className="space-y-3">
                  {operationHistory.slice(0, 5).map((operation) => (
                    <div key={operation.id} className="flex items-center text-sm">
                      <div className={`h-2 w-2 rounded-full mr-3 ${
                        operation.status === 'completed' ? 'bg-green-500' :
                        operation.status === 'failed' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}></div>
                      <div className="flex-1">
                        <p className="text-gray-900">{operation.operationType}</p>
                        <p className="text-gray-500 text-xs">
                          {formatDate(operation.createdAt)} • {operation.itemCount} items
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Courses List */}
        <div className="lg:col-span-3">
          <div className="bg-white shadow rounded-lg">
            {/* Search and Controls */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    {selectedCourses.size === filteredCourses.length && filteredCourses.length > 0 ? (
                      <CheckSquare className="h-4 w-4 mr-2 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    {selectedCourses.size === filteredCourses.length && filteredCourses.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-gray-500">
                    {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Courses Table */}
            <div className="overflow-hidden">
              {filteredCourses.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
                  <p className="text-gray-500">
                    {searchTerm ? 'Try adjusting your search terms.' : 'No courses available for bulk operations.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          <Square className="h-4 w-4" />
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Course
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Priority
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Due Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCourses.map((course) => (
                        <tr
                          key={course.id}
                          className={`hover:bg-gray-50 ${selectedCourses.has(course.id) ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleCourseSelection(course.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              {selectedCourses.has(course.id) ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                {course.title}
                              </div>
                              {course.description && (
                                <div className="text-sm text-gray-500 truncate max-w-xs">
                                  {course.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(course.priority, 'badge')}`}>
                              {course.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(course.workflowState, 'badge')}`}>
                              {course.workflowState?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {course.dueDate ? formatDate(course.dueDate) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {course.assignments?.length || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Operation Modal */}
      {showOperationModal && selectedOperation && (
        <BulkOperationModal
          operation={selectedOperation}
          courseCount={selectedCourses.size}
          users={usersList}
          params={operationParams}
          onParamsChange={setOperationParams}
          onExecute={handleExecuteOperation}
          onCancel={() => {
            setShowOperationModal(false);
            setSelectedOperation(null);
          }}
          isExecuting={executeBulkOperation.isPending}
        />
      )}
    </div>
  );
}

// Bulk Operation Modal Component
function BulkOperationModal({ operation, courseCount, users, params, onParamsChange, onExecute, onCancel, isExecuting }) {
  const Icon = operation.icon;

  const renderOperationFields = () => {
    switch (operation.id) {
      case 'assign_users':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Users
              </label>
              <select
                multiple
                value={params.userIds || []}
                onChange={(e) => onParamsChange({
                  ...params,
                  userIds: Array.from(e.target.selectedOptions, option => option.value)
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                size="5"
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'update_due_dates':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={params.dueDate || ''}
                onChange={(e) => onParamsChange({ ...params, dueDate: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        );

      case 'change_priority':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority Level
              </label>
              <select
                value={params.priority || ''}
                onChange={(e) => onParamsChange({ ...params, priority: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select priority...</option>
                {PRIORITIES.map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'workflow_transition':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Workflow State
              </label>
              <select
                value={params.workflowState || ''}
                onChange={(e) => onParamsChange({ ...params, workflowState: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select state...</option>
                {WORKFLOW_STATES.map(state => (
                  <option key={state} value={state}>
                    {state.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className={`h-6 w-6 mr-3 ${operation.color}`} />
            <h3 className="text-lg font-medium text-gray-900">
              {operation.name}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {operation.description}
        </p>

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            This operation will affect <strong>{courseCount}</strong> course{courseCount !== 1 ? 's' : ''}.
          </p>
        </div>

        {renderOperationFields()}

        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={onExecute}
            disabled={isExecuting}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Operation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkOperationsPage;