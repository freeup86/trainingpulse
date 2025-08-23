import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Grid,
  List,
  Download,
  Upload,
  MoreHorizontal,
  Copy,
  Edit,
  Trash2,
  Eye,
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  Pause,
  PlayCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { courses, programs } from '../lib/api';
import { formatDate } from '../lib/utils';
import { DataTable } from '../components/ui/DataTable';

const VIEW_MODES = {
  LIST: 'list',
  TABLE: 'table'
};

const COURSE_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' }
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];

export default function CoursesPageEnhanced() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [viewMode, setViewMode] = useState(VIEW_MODES.LIST);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedRows, setSelectedRows] = useState([]);

  // Fetch courses
  const { data: coursesData, isLoading, error } = useQuery({
    queryKey: ['courses', { 
      search, 
      status: statusFilter, 
      program_id: programFilter,
      sort: sortBy,
      order: sortOrder
    }],
    queryFn: () => courses.getAll({ 
      search, 
      status: statusFilter || undefined,
      program_id: programFilter || undefined,
      sort: sortBy,
      order: sortOrder
    }),
  });

  // Fetch programs for filter
  const { data: programsData } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programs.getAll(),
  });

  // Update course mutation
  const updateCourseMutation = useMutation({
    mutationFn: ({ id, data }) => courses.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['courses']);
      toast.success('Course updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update course');
    },
  });

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: courses.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['courses']);
      toast.success('Course deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete course');
    },
  });

  // Duplicate course mutation
  const duplicateCourseMutation = useMutation({
    mutationFn: ({ courseId, programId }) => programs.duplicateCourse(courseId, { program_id: programId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['courses']);
      toast.success('Course duplicated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to duplicate course');
    },
  });

  const coursesList = coursesData?.data || [];
  const programsList = programsData?.data || [];

  // Table columns configuration
  const tableColumns = [
    {
      key: 'name',
      label: 'Course Name',
      sortable: true,
      editable: true,
      render: (value, row) => (
        <div className="flex items-center space-x-3">
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{value}</div>
            {row.description && (
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                {row.description}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      editable: true,
      type: 'select',
      options: COURSE_STATUSES,
      render: (value) => {
        const status = COURSE_STATUSES.find(s => s.value === value) || COURSE_STATUSES[0];
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        );
      }
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      editable: true,
      type: 'select',
      options: PRIORITIES,
      render: (value) => {
        const priority = PRIORITIES.find(p => p.value === value) || { label: 'Medium' };
        const colors = {
          low: 'text-green-600',
          medium: 'text-yellow-600',
          high: 'text-orange-600',
          critical: 'text-red-600'
        };
        return (
          <span className={`font-medium ${colors[value] || colors.medium}`}>
            {priority.label}
          </span>
        );
      }
    },
    {
      key: 'completion_percentage',
      label: 'Progress',
      sortable: true,
      render: (value) => (
        <div className="flex items-center space-x-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${value || 0}%` }}
            ></div>
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem]">
            {value || 0}%
          </span>
        </div>
      )
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      editable: true,
      type: 'date',
      render: (value) => value ? formatDate(value) : '-'
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value) => formatDate(value)
    }
  ];

  // Row actions
  const rowActions = [
    { key: 'view', label: 'View Details', icon: <Eye className="w-4 h-4" /> },
    { key: 'edit', label: 'Edit', icon: <Edit className="w-4 h-4" /> },
    { key: 'duplicate', label: 'Duplicate', icon: <Copy className="w-4 h-4" /> },
    { key: 'delete', label: 'Delete', icon: <Trash2 className="w-4 h-4" /> }
  ];

  // Handle table operations
  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleCellEdit = (rowId, columnKey, value) => {
    updateCourseMutation.mutate({
      id: rowId,
      data: { [columnKey]: value }
    });
  };

  const handleRowAction = (action, row) => {
    switch (action) {
      case 'view':
        navigate(`/courses/${row.id}`);
        break;
      case 'edit':
        navigate(`/courses/${row.id}/edit`);
        break;
      case 'duplicate':
        duplicateCourseMutation.mutate({ courseId: row.id, programId: row.program_id });
        break;
      case 'delete':
        if (window.confirm('Are you sure you want to delete this course?')) {
          deleteCourseMutation.mutate(row.id);
        }
        break;
    }
  };

  const handleRowSelect = (rowId) => {
    setSelectedRows(prev => 
      prev.includes(rowId) 
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    );
  };

  const handleSelectAll = () => {
    setSelectedRows(selectedRows.length === coursesList.length ? [] : coursesList.map(c => c.id));
  };

  const handleBulkAction = (action) => {
    if (selectedRows.length === 0) {
      toast.error('Please select courses first');
      return;
    }

    switch (action) {
      case 'delete':
        if (window.confirm(`Delete ${selectedRows.length} selected courses?`)) {
          selectedRows.forEach(id => deleteCourseMutation.mutate(id));
          setSelectedRows([]);
        }
        break;
      case 'export':
        // TODO: Implement export functionality
        toast.info('Export functionality coming soon');
        break;
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">
            Failed to load courses: {error.response?.data?.message || error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Courses</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your training courses and content
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/courses/create')}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Course</span>
          </button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Filters */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            {COURSE_STATUSES.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Programs</option>
            {programsList.map(program => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedRows.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedRows.length} selected
            </span>
            <button
              onClick={() => handleBulkAction('delete')}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => handleBulkAction('export')}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Export
            </button>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode(VIEW_MODES.LIST)}
            className={`p-2 rounded ${
              viewMode === VIEW_MODES.LIST
                ? 'bg-white dark:bg-gray-700 shadow'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode(VIEW_MODES.TABLE)}
            className={`p-2 rounded ${
              viewMode === VIEW_MODES.TABLE
                ? 'bg-white dark:bg-gray-700 shadow'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === VIEW_MODES.TABLE ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <DataTable
            data={coursesList}
            columns={tableColumns}
            isLoading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onCellEdit={handleCellEdit}
            onRowAction={handleRowAction}
            selectedRows={selectedRows}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            rowActions={rowActions}
          />
        </div>
      ) : (
        <CoursesListView 
          courses={coursesList} 
          isLoading={isLoading}
          onAction={handleRowAction}
        />
      )}
    </div>
  );
}

// List View Component
function CoursesListView({ courses, isLoading, onAction }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-4">
          <PlayCircle className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No courses found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Get started by creating your first course
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} onAction={onAction} />
      ))}
    </div>
  );
}

// Course Card Component
function CourseCard({ course, onAction }) {
  const status = COURSE_STATUSES.find(s => s.value === course.status) || COURSE_STATUSES[0];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer"
              onClick={() => onAction('view', course)}>
            {course.name}
          </h3>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.color} mt-1`}>
            {status.label}
          </span>
        </div>
        
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Handle dropdown menu
            }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {course.description && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
          {course.description}
        </p>
      )}

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>Progress</span>
          <span>{course.completion_percentage || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${course.completion_percentage || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Meta Info */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-4">
          {course.due_date && (
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(course.due_date)}</span>
            </div>
          )}
          {course.priority && (
            <span className={`font-medium ${
              course.priority === 'critical' ? 'text-red-600' :
              course.priority === 'high' ? 'text-orange-600' :
              course.priority === 'medium' ? 'text-yellow-600' :
              'text-green-600'
            }`}>
              {course.priority}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>{formatDate(course.created_at)}</span>
        </div>
      </div>
    </div>
  );
}