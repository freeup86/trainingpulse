import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { users } from '../lib/api';
import { formatDate, formatRelativeTime, getStatusColor, getPriorityColor } from '../lib/utils';

function AssignmentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [expandedUsers, setExpandedUsers] = useState(new Set());

  // Fetch all users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await users.getAll();
      return response.data.data.users;
    }
  });

  // Fetch assignments for all users
  const { data: assignmentsData, isLoading: assignmentsLoading, refetch } = useQuery({
    queryKey: ['all-user-assignments'],
    queryFn: async () => {
      if (!usersData) return {};
      
      const assignmentPromises = usersData.map(async (user) => {
        try {
          const response = await users.getSubtaskAssignments(user.id);
          return {
            userId: user.id,
            assignments: response.data.data.assignments || []
          };
        } catch (error) {
          console.error(`Failed to fetch assignments for user ${user.id}:`, error);
          return {
            userId: user.id,
            assignments: []
          };
        }
      });

      const results = await Promise.all(assignmentPromises);
      
      // Convert to object with userId as key
      const assignmentsByUser = {};
      results.forEach(result => {
        assignmentsByUser[result.userId] = result.assignments;
      });
      
      return assignmentsByUser;
    },
    enabled: Boolean(usersData && usersData.length > 0)
  });

  const isLoading = usersLoading || assignmentsLoading;

  // Filter and process data
  const filteredUsers = usersData?.filter(user => {
    const assignments = assignmentsData?.[user.id] || [];
    
    // Filter by search term
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignments.some(assignment => 
                           assignment.course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           assignment.subtask.title.toLowerCase().includes(searchTerm.toLowerCase())
                         );

    if (!matchesSearch) return false;

    // Filter by status and priority
    if (statusFilter !== 'all' || priorityFilter !== 'all') {
      const hasMatchingAssignment = assignments.some(assignment => {
        const statusMatch = statusFilter === 'all' || assignment.subtask.status === statusFilter;
        const priorityMatch = priorityFilter === 'all' || assignment.course.priority === priorityFilter;
        return statusMatch && priorityMatch;
      });
      
      if (!hasMatchingAssignment && assignments.length > 0) return false;
    }

    return true;
  }) || [];

  // Calculate summary stats
  const totalAssignments = Object.values(assignmentsData || {}).reduce((sum, assignments) => sum + assignments.length, 0);
  const completedAssignments = Object.values(assignmentsData || {}).reduce((sum, assignments) => 
    sum + assignments.filter(a => a.subtask.status === 'completed').length, 0);
  const activeAssignments = Object.values(assignmentsData || {}).reduce((sum, assignments) => 
    sum + assignments.filter(a => !['completed', 'cancelled'].includes(a.subtask.status)).length, 0);

  const toggleUserExpansion = (userId) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const handleRefresh = () => {
    refetch();
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Users className="h-8 w-8 mr-3 text-blue-600" />
              Assignments Overview
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              View and manage phase assignments across all users
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Assignments
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {totalAssignments}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Active Assignments
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {activeAssignments}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Completed
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {completedAssignments}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Users with Assignments
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {Object.values(assignmentsData || {}).filter(assignments => assignments.length > 0).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users, courses, or phases..."
                className="pl-10 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="alpha_review">Alpha Review</option>
              <option value="beta_review">Beta Review</option>
              <option value="final_review">Final Review</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Users and Assignments List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Users and Assignments ({filteredUsers.length})
          </h3>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Users Found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                ? 'No users match your current filters.'
                : 'No users with assignments found.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.map((user) => {
              const userAssignments = assignmentsData?.[user.id] || [];
              const filteredAssignments = userAssignments.filter(assignment => {
                const statusMatch = statusFilter === 'all' || assignment.subtask.status === statusFilter;
                const priorityMatch = priorityFilter === 'all' || assignment.course.priority === priorityFilter;
                return statusMatch && priorityMatch;
              });
              
              const isExpanded = expandedUsers.has(user.id);

              return (
                <div key={user.id} className="p-6">
                  {/* User Header */}
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleUserExpansion(user.id)}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {user.email} • {user.role}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* User Assignments */}
                  {isExpanded && (
                    <div className="mt-4 ml-14">
                      {filteredAssignments.length === 0 ? (
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No assignments match the current filters.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredAssignments.map((assignment, index) => (
                            <div 
                              key={`${assignment.subtask.id}-${index}`} 
                              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900 dark:text-white">
                                    {assignment.course.title} - {assignment.subtask.title}
                                  </h5>
                                  {assignment.course.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                      {assignment.course.description}
                                    </p>
                                  )}
                                  <div className="flex items-center space-x-4 mt-2 text-sm">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.subtask.status, 'badge')}`}>
                                      {assignment.subtask.status?.replace('_', ' ')}
                                    </span>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(assignment.course.priority, 'badge')}`}>
                                      {assignment.course.priority}
                                    </span>
                                    {assignment.course.dueDate && (
                                      <span className="text-gray-500 dark:text-gray-400">
                                        <Calendar className="inline h-3 w-3 mr-1" />
                                        Due: {formatDate(assignment.course.dueDate)}
                                      </span>
                                    )}
                                    {assignment.assignment.assignedAt && (
                                      <span className="text-gray-500 dark:text-gray-400">
                                        Assigned: {formatRelativeTime(assignment.assignment.assignedAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssignmentsPage;