import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { 
  Search, 
  Filter, 
  Plus, 
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Circle,
  Pause,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Edit
} from 'lucide-react';
import toast from 'react-hot-toast';
import { courses } from '../lib/api';
import { formatDate, getStatusColor, getPriorityColor } from '../lib/utils';

const WORKFLOW_STATES = {
  'draft': { icon: Circle, label: 'Draft', color: 'text-gray-500 dark:text-gray-400' },
  'planning': { icon: Circle, label: 'Planning', color: 'text-gray-500 dark:text-gray-400' },
  'content_development': { icon: Clock, label: 'Development', color: 'text-blue-500 dark:text-blue-400' },
  'review': { icon: AlertTriangle, label: 'Review', color: 'text-yellow-500 dark:text-yellow-400' },
  'sme_review': { icon: AlertTriangle, label: 'SME Review', color: 'text-yellow-500 dark:text-yellow-400' },
  'instructional_review': { icon: AlertTriangle, label: 'Instructional Review', color: 'text-yellow-500 dark:text-yellow-400' },
  'legal_review': { icon: AlertTriangle, label: 'Legal Review', color: 'text-orange-500 dark:text-orange-400' },
  'compliance_review': { icon: AlertTriangle, label: 'Compliance Review', color: 'text-orange-500 dark:text-orange-400' },
  'final_approval': { icon: Pause, label: 'Final Approval', color: 'text-orange-500 dark:text-orange-400' },
  'published': { icon: CheckCircle, label: 'Published', color: 'text-green-500 dark:text-green-400' },
  'on_hold': { icon: Pause, label: 'On Hold', color: 'text-red-500 dark:text-red-400' },
  'archived': { icon: Circle, label: 'Archived', color: 'text-gray-400 dark:text-gray-500' }
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TYPES = ['instructor_led', 'elearning', 'blended', 'microlearning', 'certification'];

function CoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCourses, setExpandedCourses] = useState(new Set());
  const [filters, setFilters] = useState({
    priority: '',
    type: '',
    status: '',
    workflowState: ''
  });

  // Read URL parameters on component mount
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlPriority = searchParams.get('priority') || '';
    const urlType = searchParams.get('type') || '';
    const urlStatus = searchParams.get('status') || '';
    const urlWorkflowState = searchParams.get('workflowState') || '';
    const urlFilter = searchParams.get('filter') || '';

    // Handle special filter parameters
    let computedFilters = {
      priority: urlPriority,
      type: urlType,
      status: urlStatus,
      workflowState: urlWorkflowState
    };

    if (urlFilter === 'active') {
      // Active courses: in_progress, content_development, review, legal_review
      // Handle this with frontend filtering instead of API parameter
      computedFilters.active = 'true';
    } else if (urlFilter === 'overdue') {
      // For overdue, we'll use a special marker and filter on the frontend
      computedFilters.overdue = 'true';
    }

    setSearchTerm(urlSearch);
    setFilters(computedFilters);
  }, [searchParams]);

  const { data: coursesData, isLoading, error } = useQuery({
    queryKey: ['courses', user?.role === 'admin' ? 'all' : 'user', user?.id, { search: searchTerm, ...filters }],
    queryFn: () => {
      const params = {
        search: searchTerm || undefined,
        priority: filters.priority || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        workflowState: filters.workflowState || undefined,
        includeSubtasks: true, // Request subtasks for progress calculation
        limit: 50
      };
      
      // Admin users get all courses, other users get only their assigned courses
      return user?.role === 'admin' 
        ? courses.getAll(params)
        : courses.getByUser(user.id, params);
    },
    enabled: !!user?.id
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      priority: '',
      type: '',
      status: '',
      workflowState: '',
      overdue: '',
      active: ''
    });
    setSearchTerm('');
    // Clear URL parameters as well
    setSearchParams({});
  };

  const toggleCourseExpansion = (courseId) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error loading courses
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error.message || 'Failed to load courses. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle different data structures from getAll() vs getByUser()
  let coursesList = coursesData?.data?.data?.courses || coursesData?.data?.courses || [];
  
  // Apply frontend filtering for special cases
  if (filters.overdue === 'true') {
    coursesList = coursesList.filter(course => {
      return new Date(course.due_date) < new Date() && 
             !['completed', 'cancelled'].includes(course.status);
    });
  }
  
  if (filters.active === 'true') {
    coursesList = coursesList.filter(course => {
      return ['in_progress', 'content_development', 'review', 'legal_review'].includes(course.status);
    });
  }
  
  const hasActiveFilters = Object.values(filters).some(v => v) || searchTerm;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Courses</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage training courses and track their progress through the workflow
            </p>
          </div>
          <button 
            onClick={() => navigate('/courses/create')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Course
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map(priority => (
                <option key={priority} value={priority}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              {TYPES.map(type => (
                <option key={type} value={type}>
                  {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Workflow State Filter */}
          <div>
            <select
              value={filters.workflowState}
              onChange={(e) => handleFilterChange('workflowState', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All States</option>
              {Object.entries(WORKFLOW_STATES).map(([state, { label }]) => (
                <option key={state} value={state}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Filters Indicator */}
      {(filters.overdue === 'true' || filters.active === 'true') && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {filters.overdue === 'true' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                Overdue Courses
                <button
                  onClick={() => setFilters(prev => ({ ...prev, overdue: '' }))}
                  className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                >
                  ×
                </button>
              </span>
            )}
            {filters.active === 'true' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                Active Courses
                <button
                  onClick={() => setFilters(prev => ({ ...prev, active: '' }))}
                  className="ml-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {coursesList.length === 0 
            ? 'No courses found' 
            : `Showing ${coursesList.length} course${coursesList.length !== 1 ? 's' : ''}`
          }
        </p>
      </div>

      {/* Courses List */}
      {coursesList.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No courses found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {hasActiveFilters 
                ? 'Try adjusting your search criteria or filters.'
                : 'Get started by creating your first course.'
              }
            </p>
            {!hasActiveFilters && (
              <button 
                onClick={() => navigate('/courses/create')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Course
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {coursesList.map((course) => {
              const workflowInfo = WORKFLOW_STATES[course.workflowState || course.workflow_state] || WORKFLOW_STATES['draft'];
              const WorkflowIcon = workflowInfo.icon;
              
              const isExpanded = expandedCourses.has(course.id);
              
              return (
                <li key={course.id}>
                  <div 
                    className="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => toggleCourseExpansion(course.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <div className="flex items-center">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 mr-2 text-gray-400 dark:text-gray-500" />
                            ) : (
                              <ChevronDown className="h-5 w-5 mr-2 text-gray-400 dark:text-gray-500" />
                            )}
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                              {course.title}
                            </h3>
                          </div>
                          
                        </div>
                        
                        {course.description && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                            {course.description}
                          </p>
                        )}

                        {/* Progress Bar */}
                        {(() => {
                          const progressPercentage = course.completion_percentage || 0;
                          
                          
                          return (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <span>Progress</span>
                                <span>{progressPercentage}% Complete</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    progressPercentage === 100 ? 'bg-green-500' :
                                    progressPercentage >= 75 ? 'bg-blue-500' :
                                    progressPercentage >= 50 ? 'bg-yellow-500' :
                                    progressPercentage >= 25 ? 'bg-orange-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${progressPercentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                          {/* Workflow State */}
                          <div className="flex items-center">
                            <WorkflowIcon className={`h-4 w-4 mr-1 ${workflowInfo.color}`} />
                            <span>{workflowInfo.label}</span>
                          </div>

                          {/* Due Date */}
                          {(course.dueDate || course.due_date) && (
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>Due {formatDate(course.dueDate || course.due_date)}</span>
                            </div>
                          )}

                          {/* Assignments */}
                          {course.assignments && course.assignments.length > 0 && (
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              <span>{course.assignments.length} assigned</span>
                            </div>
                          )}

                          {/* Last Updated */}
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>Updated {formatDate(course.updatedAt || course.updated_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/courses/${course.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          View Details
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/courses/${course.id}/edit`);
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                  {isExpanded && <CourseSubtasks courseId={course.id} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// Subtasks component
function CourseSubtasks({ courseId }) {
  const queryClient = useQueryClient();
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [tempStatus, setTempStatus] = useState({});

  // Close editing when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEditingTaskId(null);
        setTempStatus({});
      }
    };

    const handleClickOutside = (e) => {
      if (editingTaskId && !e.target.closest('.subtask-status-select')) {
        setEditingTaskId(null);
        setTempStatus({});
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [editingTaskId]);
  
  const { data: courseData, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => courses.getById(courseId),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, updateData }) => 
      courses.updateSubtask(courseId, subtaskId, updateData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['course', courseId]);
      queryClient.invalidateQueries(['courses']);
      setEditingTaskId(null);
      setTempStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[variables.subtaskId];
        return newStatus;
      });
      toast.success('Subtask status updated successfully');
    },
    onError: (error, variables) => {
      // Revert temp status on error
      setTempStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[variables.subtaskId];
        return newStatus;
      });
      toast.error(error.response?.data?.message || 'Failed to update subtask status');
    }
  });

  const handleStatusUpdate = (subtaskId, newStatus) => {
    // Don't update if it's a temporary ID (subtask without real ID)
    if (subtaskId.startsWith('temp-')) {
      toast.error('Cannot update subtask status: subtask not properly saved');
      setEditingTaskId(null);
      return;
    }

    // Don't close editing until the update is complete
    updateSubtaskMutation.mutate({
      subtaskId,
      updateData: { status: newStatus }
    });
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const subtasks = courseData?.data?.data?.subtasks || [];

  if (subtasks.length === 0) {
    return (
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <ListTodo className="h-4 w-4 mr-2" />
          <span>No subtasks defined</span>
        </div>
      </div>
    );
  }

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'text-gray-500 dark:text-gray-400' },
    { value: 'in_progress', label: 'In Progress', color: 'text-blue-500 dark:text-blue-400' },
    { value: 'completed', label: 'Completed', color: 'text-green-500 dark:text-green-400' },
    { value: 'on_hold', label: 'On Hold', color: 'text-yellow-500 dark:text-yellow-400' }
  ];

  return (
    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div className="space-y-2">
        <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <ListTodo className="h-4 w-4 mr-2" />
          <span>Subtasks ({subtasks.length})</span>
        </div>
        {subtasks.map((task, index) => {
          // Check for different possible ID field names
          const taskId = task.id || task.subtask_id || task.subtaskId || `temp-${index}`;
          const currentTaskStatus = tempStatus[taskId] || task.status;
          const currentStatus = statusOptions.find(opt => opt.value === currentTaskStatus) || statusOptions[0];
          const StatusIcon = {
            'pending': Circle,
            'in_progress': Clock,
            'completed': CheckCircle,
            'on_hold': Pause
          }[currentTaskStatus] || Circle;

          const isEditing = editingTaskId === taskId;
          const isUpdating = updateSubtaskMutation.isLoading && updateSubtaskMutation.variables?.subtaskId === taskId;
          const canEdit = !!(task.id || task.subtask_id || task.subtaskId); // Only allow editing if subtask has a real ID

          return (
            <div key={task.id || index} className="group flex items-start space-x-3 ml-6 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
              {isUpdating ? (
                <div className="animate-spin rounded-full h-4 w-4 mt-0.5 border-b-2 border-blue-600"></div>
              ) : (
                <StatusIcon className={`h-4 w-4 mt-0.5 ${currentStatus.color}`} />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-900 dark:text-white">{task.title}</span>
                    {isEditing ? (
                      <select
                        value={currentTaskStatus}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newStatus = e.target.value;
                          // Update temp status immediately
                          setTempStatus(prev => ({
                            ...prev,
                            [taskId]: newStatus
                          }));
                          // Then trigger the API update
                          handleStatusUpdate(taskId, newStatus);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="subtask-status-select text-xs px-2 py-1 border border-solid border-blue-500 dark:border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        disabled={updateSubtaskMutation.isLoading}
                        autoFocus
                      >
                        {statusOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : canEdit ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTaskId(taskId);
                          // Initialize temp status with current status when starting edit
                          setTempStatus(prev => ({
                            ...prev,
                            [taskId]: currentTaskStatus
                          }));
                        }}
                        className={`text-xs px-2 py-1 rounded border border-dashed border-gray-300 dark:border-gray-600 hover:border-solid hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 transition-all cursor-pointer ${currentStatus.color} font-medium group inline-flex`}
                        title="Click to change status"
                      >
                        <span className="flex items-center space-x-1">
                          <span>{currentStatus.label}</span>
                          <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </button>
                    ) : (
                      <span className={`text-xs px-2 py-1 ${currentStatus.color}`}>
                        {currentStatus.label}
                      </span>
                    )}
                  </div>
                </div>
                {task.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {task.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CoursesPage;