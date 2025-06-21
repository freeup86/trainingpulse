import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { courses, users, bulk } from '../lib/api';
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
const STATUS_OPTIONS = ['draft', 'in_progress', 'review', 'completed', 'cancelled'];

function BulkOperationsPage() {
  const queryClient = useQueryClient();
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [operationParams, setOperationParams] = useState({});
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Fetch courses data
  const { data: coursesData, isLoading: coursesLoading, error: coursesError } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courses.getAll()
  });
  
  // Fetch users data
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => users.getAll()
  });
  
  // Fetch operation history
  const { data: operationHistoryData, isLoading: historyLoading } = useQuery({
    queryKey: ['bulk-operations-history'],
    queryFn: () => bulk.getHistory()
  });
  
  const isLoading = coursesLoading || usersLoading || historyLoading;
  const error = coursesError;

  // Execute bulk operation mutation
  const executeBulkOperation = useMutation({
    mutationFn: (params) => bulk.execute(params),
    onSuccess: (data) => {
      toast.success('Bulk operation completed successfully');
      setSelectedCourses(new Set());
      setShowOperationModal(false);
      setSelectedOperation(null);
      queryClient.invalidateQueries(['courses']);
      queryClient.invalidateQueries(['bulk-operations-history']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to execute bulk operation');
    }
  });

  // Import courses mutation
  const importCoursesMutation = useMutation({
    mutationFn: async (coursesToImport) => {
      // Create courses one by one since there might not be a bulk create endpoint
      const results = [];
      for (const course of coursesToImport) {
        try {
          const result = await courses.create(course);
          results.push(result);
        } catch (error) {
          console.error('Failed to create course:', course.title, error);
          throw error;
        }
      }
      return results;
    },
    onSuccess: (data) => {
      toast.success(`Successfully imported ${data.length} courses`);
      setShowImportModal(false);
      queryClient.invalidateQueries(['courses']);
    },
    onError: (error) => {
      toast.error('Failed to import some courses. Please check the data and try again.');
    }
  });

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

  const handleExport = () => {
    const coursesToExport = selectedCourses.size > 0 
      ? filteredCourses.filter(course => selectedCourses.has(course.id))
      : filteredCourses;

    if (coursesToExport.length === 0) {
      toast.error('No courses to export');
      return;
    }

    // Create CSV content
    const headers = ['ID', 'Title', 'Description', 'Priority', 'Status', 'Due Date', 'Assignments'];
    const csvData = [
      headers,
      ...coursesToExport.map(course => [
        course.id,
        `"${course.title}"`,
        `"${course.description || ''}"`,
        course.priority,
        course.status,
        course.due_date || course.dueDate || '',
        course.assignments?.length || course.assignmentCount || 0
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `courses_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${coursesToExport.length} courses`);
  };

  const handleImport = () => {
    setShowImportModal(true);
  };

  const handleFileImport = (file) => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const lines = csv.split('\n');
        const headers = lines[0].split(',');
        
        if (lines.length < 2) {
          toast.error('CSV file appears to be empty');
          return;
        }

        const importedCourses = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const values = line.split(',');
            if (values.length >= 2) {
              importedCourses.push({
                title: values[1]?.replace(/"/g, ''),
                description: values[2]?.replace(/"/g, ''),
                priority: values[3] || 'medium',
                status: values[4] || 'draft',
                dueDate: values[5] || null
              });
            }
          }
        }

        if (importedCourses.length === 0) {
          toast.error('No valid course data found in CSV');
          return;
        }

        // Import courses via API
        importCoursesMutation.mutate(importedCourses);
        
      } catch (error) {
        console.error('Import error:', error);
        toast.error('Error processing CSV file');
      }
    };

    reader.readAsText(file);
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

  // Handle different data structures from API responses
  const coursesList = coursesData?.data?.data?.courses || coursesData?.data?.courses || [];
  const usersList = usersData?.data?.data?.users || usersData?.data?.users || [];
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Operations</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Perform batch operations on multiple courses simultaneously
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleImport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </button>
            <button 
              onClick={handleExport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Bulk Operations Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Operations</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
                    className="w-full flex items-start p-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon className={`h-5 w-5 mt-0.5 mr-3 ${operation.color}`} />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {operation.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {operation.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Operations */}
          <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Operations</h3>
            </div>
            
            <div className="p-4">
              {operationHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
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
                        <p className="text-gray-900 dark:text-white">{operation.operationType}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">
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
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            {/* Search and Controls */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    {selectedCourses.size === filteredCourses.length && filteredCourses.length > 0 ? (
                      <CheckSquare className="h-4 w-4 mr-2 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    {selectedCourses.size === filteredCourses.length && filteredCourses.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

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

            {/* Courses Table */}
            <div className="overflow-hidden">
              {filteredCourses.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No courses found</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'Try adjusting your search terms.' : 'No courses available for bulk operations.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                          <Square className="h-4 w-4" />
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Course
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Priority
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Due Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Assigned
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredCourses.map((course) => (
                        <tr
                          key={course.id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedCourses.has(course.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleCourseSelection(course.id)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
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
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                {course.title}
                              </div>
                              {course.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
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
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(course.status, 'badge')}`}>
                              {course.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {(course.due_date || course.dueDate) ? formatDate(course.due_date || course.dueDate) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {course.assignments?.length || course.assignmentCount || 0}
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

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onImport={handleFileImport}
          onCancel={() => setShowImportModal(false)}
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Users
              </label>
              <select
                multiple
                value={params.userIds || []}
                onChange={(e) => onParamsChange({
                  ...params,
                  userIds: Array.from(e.target.selectedOptions, option => option.value)
                })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={params.dueDate || ''}
                onChange={(e) => onParamsChange({ ...params, dueDate: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        );

      case 'change_priority':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority Level
              </label>
              <select
                value={params.priority || ''}
                onChange={(e) => onParamsChange({ ...params, priority: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Status
              </label>
              <select
                value={params.status || ''}
                onChange={(e) => onParamsChange({ ...params, status: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select status...</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className={`h-6 w-6 mr-3 ${operation.color}`} />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {operation.name}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {operation.description}
        </p>

        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            This operation will affect <strong>{courseCount}</strong> course{courseCount !== 1 ? 's' : ''}.
          </p>
        </div>

        {renderOperationFields()}

        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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

// Import Modal Component
function ImportModal({ onImport, onCancel }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    onImport(selectedFile);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Upload className="h-6 w-6 mr-3 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Import Courses</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Upload a CSV file to import multiple courses. The file should contain columns for Title, Description, Priority, Status, and Due Date.
        </p>

        <div className="mb-4">
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 text-center ${
              dragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-600'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {selectedFile ? (
              <div>
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ready to import</p>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">Drop your CSV file here</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">or click to browse</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">CSV Format Requirements:</h4>
          <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>• First row should contain headers</li>
            <li>• Required columns: Title</li>
            <li>• Optional: Description, Priority, Status, Due Date</li>
            <li>• Use quotes around text containing commas</li>
          </ul>
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Courses
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkOperationsPage;