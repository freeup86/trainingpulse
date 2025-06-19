import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Pause
} from 'lucide-react';
import { courses } from '../lib/api';
import { formatDate, getStatusColor, getPriorityColor } from '../lib/utils';

const WORKFLOW_STATES = {
  'draft': { icon: Circle, label: 'Draft', color: 'text-gray-500' },
  'content_development': { icon: Clock, label: 'Development', color: 'text-blue-500' },
  'review': { icon: AlertTriangle, label: 'Review', color: 'text-yellow-500' },
  'approval': { icon: Pause, label: 'Approval', color: 'text-orange-500' },
  'published': { icon: CheckCircle, label: 'Published', color: 'text-green-500' },
  'archived': { icon: Circle, label: 'Archived', color: 'text-gray-400' }
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TYPES = ['instructor_led', 'elearning', 'blended', 'microlearning', 'certification'];

function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    priority: '',
    type: '',
    status: '',
    workflowState: ''
  });

  const { data: coursesData, isLoading, error } = useQuery({
    queryKey: ['courses', { search: searchTerm, ...filters }],
    queryFn: () => courses.getAll({
      search: searchTerm || undefined,
      priority: filters.priority || undefined,
      type: filters.type || undefined,
      status: filters.status || undefined,
      workflowState: filters.workflowState || undefined,
      limit: 50
    })
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
      workflowState: ''
    });
    setSearchTerm('');
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
  const hasActiveFilters = Object.values(filters).some(v => v) || searchTerm;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage training courses and track their progress through the workflow
            </p>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <Plus className="h-4 w-4 mr-2" />
            Create Course
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
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

          {/* Priority Filter */}
          <div>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-700">
          {coursesList.length === 0 
            ? 'No courses found' 
            : `Showing ${coursesList.length} course${coursesList.length !== 1 ? 's' : ''}`
          }
        </p>
      </div>

      {/* Courses List */}
      {coursesList.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
            <p className="text-gray-500 mb-4">
              {hasActiveFilters 
                ? 'Try adjusting your search criteria or filters.'
                : 'Get started by creating your first course.'
              }
            </p>
            {!hasActiveFilters && (
              <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Course
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {coursesList.map((course) => {
              const workflowInfo = WORKFLOW_STATES[course.workflowState] || WORKFLOW_STATES['draft'];
              const WorkflowIcon = workflowInfo.icon;
              
              return (
                <li key={course.id} className="hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {course.title}
                          </h3>
                          
                          {/* Priority Badge */}
                          <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(course.priority, 'badge')}`}>
                            {course.priority}
                          </span>

                          {/* Type Badge */}
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {course.type?.replace('_', ' ')}
                          </span>
                        </div>
                        
                        {course.description && (
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                            {course.description}
                          </p>
                        )}

                        <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                          {/* Workflow State */}
                          <div className="flex items-center">
                            <WorkflowIcon className={`h-4 w-4 mr-1 ${workflowInfo.color}`} />
                            <span>{workflowInfo.label}</span>
                          </div>

                          {/* Due Date */}
                          {course.dueDate && (
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>Due {formatDate(course.dueDate)}</span>
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
                            <span>Updated {formatDate(course.updatedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                          View Details
                        </button>
                        <button className="text-gray-400 hover:text-gray-600 text-sm font-medium">
                          Edit
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

export default CoursesPage;