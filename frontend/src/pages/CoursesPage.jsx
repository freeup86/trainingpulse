import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useResizableColumns } from '../hooks/useResizableColumns.jsx';
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
  PlayCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ListTodo,
  Edit,
  ArrowRight,
  Layers,
  X,
  MoreHorizontal,
  Copy,
  RefreshCw,
  ChevronsUpDown,
  User,
  MoreVertical,
  XCircle,
  AlertCircle,
  Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { courses, statuses, phaseStatuses, users, modalityTasks, programs, lists } from '../lib/api';
import { formatDate, getStatusColor, getPriorityColor, getModalityColor } from '../lib/utils';
import Breadcrumb, { useBreadcrumbs } from '../components/navigation/Breadcrumb';

// Independent status definitions (separate from workflow)
const COURSE_STATUSES = {
  'active': { icon: CheckCircle, label: 'Active', color: 'text-green-500 dark:text-green-400' },
  'inactive': { icon: Circle, label: 'Inactive', color: 'text-gray-500 dark:text-gray-400' },
  'on_hold': { icon: Pause, label: 'On Hold', color: 'text-yellow-500 dark:text-yellow-400' },
  'cancelled': { icon: X, label: 'Cancelled', color: 'text-red-500 dark:text-red-400' },
  'completed': { icon: CheckCircle, label: 'Completed', color: 'text-blue-500 dark:text-blue-400' }
};

// Mapping function to derive status from workflow state (temporary until proper status field exists)
const getStatusFromWorkflow = (workflowState) => {
  switch (workflowState) {
    case 'published':
      return 'active';
    case 'archived':
      return 'completed';
    case 'on_hold':
      return 'on_hold';
    case 'draft':
    case 'planning':
      return 'inactive';
    case 'in_progress':
    case 'content_development':
    case 'review':
    case 'sme_review':
    case 'instructional_review':
    case 'legal_review':
    case 'compliance_review':
    case 'final_approval':
      return 'active';
    default:
      return 'inactive';
  }
};

// Function to get course status information
const getCourseStatus = (course, statusesData = null) => {
  const courseStatus = course.status || 'inactive';
  const statusesList = statusesData?.data || statusesData || [];
  const statusInfo = statusesList.find(s => s.value === courseStatus) || 
                    COURSE_STATUSES[courseStatus] || 
                    COURSE_STATUSES['inactive'];
  
  return {
    ...statusInfo,
    icon: statusInfo.icon === 'CheckCircle' ? CheckCircle :
          statusInfo.icon === 'Circle' ? Circle :
          statusInfo.icon === 'Pause' ? Pause :
          statusInfo.icon === 'X' ? X :
          statusInfo.icon === 'AlertTriangle' ? AlertTriangle :
          Circle
  };
};

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
const MODALITIES = [
  { value: 'WBT', label: 'WBT (Web-Based Training)' },
  { value: 'ILT/VLT', label: 'ILT/VLT (Instructor-Led/Virtual-Led Training)' },
  { value: 'Micro Learning', label: 'Micro Learning' },
  { value: 'SIMS', label: 'SIMS (Simulations)' },
  { value: 'DAP', label: 'DAP (Digital Adoption Platform)' }
];

// Define workflow progression paths
const WORKFLOW_PROGRESSION = {
  'draft': ['planning'],
  'planning': ['content_development'],
  'content_development': ['review', 'sme_review'],
  'review': ['instructional_review', 'sme_review'],
  'sme_review': ['instructional_review', 'legal_review'],
  'instructional_review': ['legal_review', 'final_approval'],
  'legal_review': ['compliance_review', 'final_approval'],
  'compliance_review': ['final_approval'],
  'final_approval': ['published'],
  'published': ['archived'],
  'on_hold': ['draft', 'planning', 'content_development', 'review'], // Can return to various states
  'archived': [] // Terminal state
};

// Helper function to calculate progress based on phase completion percentages and modality weights
const calculateProgress = (subtasks, phaseStatuses, modalityTasksData, courseModality) => {
  if (!subtasks || subtasks.length === 0) return 0;
  
  // If we have phase status data, use completion percentages
  if (phaseStatuses && phaseStatuses.length > 0) {
    // Try to use weighted calculation if modality tasks data is available
    
    if (modalityTasksData && courseModality) {
      let modalityTasks = [];
      
      if (Array.isArray(modalityTasksData)) {
        // If it's an array, filter by modality
        modalityTasks = modalityTasksData.filter(mt => mt.modality === courseModality);
      } else if (typeof modalityTasksData === 'object') {
        // If it's an object keyed by modality, access directly
        if (modalityTasksData[courseModality]) {
          modalityTasks = modalityTasksData[courseModality];
        } else {
          // Try other patterns
          modalityTasks = modalityTasksData.data?.[courseModality] ||
                         Object.values(modalityTasksData).flat().filter(mt => mt?.modality === courseModality) ||
                         [];
        }
      }
      
      // Ensure modalityTasks is always an array
      if (!Array.isArray(modalityTasks)) {
        modalityTasks = [];
      }
      
      
      if (modalityTasks.length > 0) {
        let weightedProgress = 0;
        let totalWeight = 0;
        
        subtasks.forEach(task => {
          const statusConfig = phaseStatuses.find(s => s.value === task.status);
          const completionPercentage = statusConfig?.completionPercentage || 0;
          
          // Find matching modality task by task_type
          const modalityTask = modalityTasks.find(mt => 
            mt.task_type?.toLowerCase() === task.title?.toLowerCase() ||
            mt.title?.toLowerCase() === task.title?.toLowerCase() ||
            mt.name?.toLowerCase() === task.title?.toLowerCase()
          );
          
          const weight = modalityTask?.weight_percentage || (100 / subtasks.length); // Equal weight as fallback
          
          
          weightedProgress += (completionPercentage * weight / 100);
          totalWeight += weight;
        });
        
        // Normalize to 100% if total weight isn't exactly 100
        return totalWeight > 0 ? Math.round(weightedProgress * 100 / totalWeight) : 0;
      }
    }
    
    // Fallback to simple average if no modality weights available
    const totalPercentage = subtasks.reduce((sum, task) => {
      const statusConfig = phaseStatuses.find(s => s.value === task.status);
      const completionPercentage = statusConfig?.completionPercentage || 0;
      return sum + completionPercentage;
    }, 0);
    return Math.round(totalPercentage / subtasks.length);
  }
  
  // Fallback to simple completion count
  const completedCount = subtasks.filter(st => st.status === 'completed' || st.status === 'final_revision').length;
  return Math.round((completedCount / subtasks.length) * 100);
};

function CoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { listId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState(new Set());
  const [expandedStatusGroups, setExpandedStatusGroups] = useState(() => {
    // Start with all common status groups expanded
    return new Set(['PREDEVELOPMENT', 'DEVELOPMENT', 'PRODUCTION', 'ARCHIVED', 'ON HOLD']);
  });
  const [groupBy, setGroupBy] = useState(() => {
    // Initialize from localStorage, then check URL params
    const saved = localStorage.getItem('coursesGroupBy');
    return saved || '';
  }); // '' for no grouping, 'status' for grouping by status
  const [filters, setFilters] = useState({});
  const [showDropdown, setShowDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Column filters state - stores selected values for each column
  const [columnFilters, setColumnFilters] = useState({});
  const [showFilterInputs, setShowFilterInputs] = useState({});
  const [filterDropdownPositions, setFilterDropdownPositions] = useState({});
  const [columnCheckStates, setColumnCheckStates] = useState({}); // Track checkbox visual state separately

  // Setup resizable columns with minimum widths to prevent header overflow
  const tableColumns = [
    { name: 'Course', defaultWidth: 500, minWidth: 250 },
    { name: 'Progress', defaultWidth: 170, minWidth: 90 },
    { name: 'Modality', defaultWidth: 160, minWidth: 85 },
    { name: 'Priority', defaultWidth: 150, minWidth: 80 },
    { name: 'Start Date', defaultWidth: 160, minWidth: 100 },
    { name: 'Due Date', defaultWidth: 160, minWidth: 90 },
    { name: 'Lead', defaultWidth: 150, minWidth: 60 },
    { name: 'Actions', defaultWidth: 80, minWidth: 80 }
  ];

  const tableColumnsWithStatus = [
    { name: 'Course', defaultWidth: 500, minWidth: 250 },
    { name: 'Status', defaultWidth: 200, minWidth: 100 },
    { name: 'Progress', defaultWidth: 170, minWidth: 90 },
    { name: 'Modality', defaultWidth: 160, minWidth: 85 },
    { name: 'Priority', defaultWidth: 150, minWidth: 80 },
    { name: 'Start Date', defaultWidth: 160, minWidth: 100 },
    { name: 'Due Date', defaultWidth: 160, minWidth: 90 },
    { name: 'Lead', defaultWidth: 150, minWidth: 60 },
    { name: 'Actions', defaultWidth: 80, minWidth: 80 }
  ];

  // When grouped by status, we don't show status column. Otherwise we do.
  const currentColumns = groupBy === 'status' ? tableColumns : tableColumnsWithStatus;
  
  // Setup resizable columns
  const { columnWidths, createResizeHandle, resetToDefaults } = useResizableColumns(
    currentColumns,
    `courses-table-${listId || 'all'}-${groupBy || 'none'}`
  );
  
  // Calculate total table width
  const totalTableWidth = currentColumns.reduce((sum, col, index) => {
    return sum + (columnWidths[index] || col.defaultWidth || 150);
  }, 0);
  
  // Sorting function
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  // Filter function
  const handleColumnFilter = (columnKey, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  };
  
  // Toggle filter input visibility
  const toggleFilterInput = (columnKey, buttonElement) => {
    const isCurrentlyOpen = showFilterInputs[columnKey];
    
    if (!isCurrentlyOpen && buttonElement) {
      // Calculate position when opening
      const position = calculateFilterDropdownPosition(buttonElement);
      setFilterDropdownPositions(prev => ({
        ...prev,
        [columnKey]: position
      }));
    }
    
    setShowFilterInputs(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };
  
  // Get distinct values for a column
  const getDistinctValues = (columnKey, courses) => {
    const values = new Set();
    courses.forEach(course => {
      let value;
      switch (columnKey) {
        case 'course':
          value = course.title;
          break;
        case 'status':
          value = course.status;
          break;
        case 'progress':
          const subtasks = course.subtasks || [];
          const progress = subtasks.length > 0 && phaseStatusesData 
            ? calculateProgress(subtasks, phaseStatusesData, null, course.modality)
            : 0;
          value = `${Math.round(progress)}%`;
          break;
        case 'modality':
          value = course.modality;
          break;
        case 'priority':
          value = course.priority;
          break;
        case 'start_date':
          value = course.start_date ? formatDate(course.start_date) : 'Not set';
          break;
        case 'due_date':
          value = course.due_date ? formatDate(course.due_date) : 'Not set';
          break;
        case 'lead':
          value = course.owner?.name || 'Unassigned';
          break;
        default:
          value = null;
      }
      if (value !== null && value !== undefined) {
        values.add(value);
      }
    });
    return Array.from(values).sort();
  };
  
  // Handle checkbox filter change
  const handleCheckboxFilter = (columnKey, value, checked, allCourses, filteredCourses) => {
    const distinctValues = getDistinctValues(columnKey, allCourses);
    const checkState = columnCheckStates[columnKey];
    const currentFilter = columnFilters[columnKey];
    
    // Get available values in the filtered context (what's actually shown in the dropdown)
    const availableValues = filteredCourses ? getDistinctValues(columnKey, filteredCourses) : distinctValues;
    
    // Clear the 'none' state when user interacts with individual checkboxes
    if (checkState === 'none') {
      setColumnCheckStates(prev => {
        const { [columnKey]: _, ...rest } = prev;
        return rest;
      });
    }
    
    // Build the new filter based on current state
    let newFilter;
    
    if (!currentFilter && checkState !== 'none') {
      // No filter exists and not in 'none' state - all are shown
      if (checked) {
        return; // Already checked, no change
      } else {
        // Uncheck this one item
        // If we're in a filtered context and unchecking the only available value, 
        // we should clear the filter rather than create one
        if (availableValues.length === 1 && availableValues[0] === value) {
          newFilter = []; // This will trigger the "no values selected" case below
        } else {
          // Show all available values except this one
          newFilter = availableValues.filter(v => v !== value);
        }
      }
    } else if (checkState === 'none') {
      // We're in 'none' state - build filter from scratch
      if (checked) {
        newFilter = [value]; // Start with just this value
      } else {
        return; // Already unchecked, no change
      }
    } else if (currentFilter) {
      // Filter exists - add or remove value
      if (checked) {
        if (!currentFilter.includes(value)) {
          newFilter = [...currentFilter, value];
        } else {
          return; // Already in filter
        }
      } else {
        newFilter = currentFilter.filter(v => v !== value);
      }
    } else {
      // No filter, not in 'none' state
      if (checked) {
        return; // All shown, item already checked
      } else {
        // Uncheck one item
        // Use available values in filtered context
        if (availableValues.length === 1 && availableValues[0] === value) {
          newFilter = []; // This will trigger the "no values selected" case below
        } else {
          newFilter = availableValues.filter(v => v !== value);
        }
      }
    }
    
    // If all values are selected, remove filter (show all)
    if (newFilter && newFilter.length === distinctValues.length) {
      setColumnFilters(prev => {
        const { [columnKey]: _, ...rest } = prev;
        return rest;
      });
      return;
    }
    
    // If no values selected after this change, always show all data with unchecked boxes
    // This handles both unchecking the last value and unchecking the only available value
    if (newFilter && newFilter.length === 0) {
      // Set visual state to 'none' to show unchecked boxes
      setColumnCheckStates(prev => ({
        ...prev,
        [columnKey]: 'none'
      }));
      // Remove filter to show all data
      setColumnFilters(prev => {
        const { [columnKey]: _, ...rest } = prev;
        return rest;
      });
      return;
    }
    
    // Normal case - update filter
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: newFilter
    }));
  };
  
  // Select/deselect all for a column
  const handleSelectAll = (columnKey, distinctValues, selectAll) => {
    setColumnFilters(prev => {
      if (selectAll) {
        // Remove filter to show all
        const { [columnKey]: _, ...rest } = prev;
        return rest;
      } else {
        // Set empty array to show none
        return {
          ...prev,
          [columnKey]: []
        };
      }
    });
  };
  
  // Create sortable/filterable header component
  const TableHeader = ({ columnKey, columnName, columnIndex, showFilter = true, allCourses, filteredCourses }) => {
    const showFilterInput = showFilterInputs[columnKey] || false;
    const selectedValues = columnFilters[columnKey] || [];
    const filterRef = useRef(null);
    const selectAllRef = useRef(null);
    const dropdownPosition = filterDropdownPositions[columnKey] || { top: 0, left: 0 };
    
    // Get distinct values from filtered courses (excluding this column's filter)
    // This shows only values that are available with other filters applied
    const getFilteredDistinctValues = () => {
      // Start with filtered courses or all courses if no filtering done yet
      let coursesToCheck = filteredCourses || allCourses || [];
      
      // If this column has a filter, we need to use all courses to get all possible values for this column
      // But still respect other column filters
      if (columnFilters[columnKey] && columnFilters[columnKey].length > 0) {
        // Re-apply all filters except this column's filter
        coursesToCheck = allCourses || [];
        Object.entries(columnFilters).forEach(([filterKey, filterValues]) => {
          if (filterKey !== columnKey && filterValues && filterValues.length > 0) {
            coursesToCheck = coursesToCheck.filter(course => {
              let value;
              switch (filterKey) {
                case 'course':
                  value = course.title;
                  break;
                case 'status':
                  value = course.status;
                  break;
                case 'modality':
                  value = course.modality;
                  break;
                case 'priority':
                  value = course.priority;
                  break;
                case 'start_date':
                  value = course.start_date ? formatDate(course.start_date) : 'Not set';
                  break;
                case 'due_date':
                  value = course.due_date ? formatDate(course.due_date) : 'Not set';
                  break;
                case 'lead':
                  value = course.owner?.name;
                  break;
                default:
                  value = '';
              }
              return filterValues.includes(value);
            });
          }
        });
      }
      
      return getDistinctValues(columnKey, coursesToCheck);
    };
    
    const distinctValues = getFilteredDistinctValues();
    // Check if column has an active filter
    // A filter is active if:
    // 1. There's a filter set for this column AND
    // 2. It's not selecting all values from the original unfiltered data
    const allDistinctValues = allCourses && allCourses.length > 0 
      ? getDistinctValues(columnKey, allCourses)
      : [];
    const hasActiveFilter = columnFilters[columnKey] && 
                           selectedValues.length > 0 && 
                           selectedValues.length < allDistinctValues.length;
    
    // Calculate checkbox state for Select All
    const getSelectAllState = () => {
      const checkState = columnCheckStates[columnKey];
      
      // If explicitly set to unchecked all
      if (checkState === 'none') {
        return { checked: false, indeterminate: false };
      }
      
      if (!columnFilters[columnKey]) {
        // No filter = all selected by default
        return { checked: true, indeterminate: false };
      }
      
      const checkedCount = selectedValues.length;
      if (checkedCount === 0) {
        return { checked: false, indeterminate: false };
      } else if (checkedCount === distinctValues.length) {
        return { checked: true, indeterminate: false };
      } else {
        return { checked: false, indeterminate: true };
      }
    };
    
    const selectAllState = getSelectAllState();
    
    // Update indeterminate state
    useEffect(() => {
      if (selectAllRef.current) {
        selectAllRef.current.indeterminate = selectAllState.indeterminate;
      }
    }, [selectAllState.indeterminate]);
    
    // Click outside handler
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (filterRef.current && !filterRef.current.contains(event.target)) {
          // Close the filter dropdown
          setShowFilterInputs(prev => ({
            ...prev,
            [columnKey]: false
          }));
        }
      };
      
      if (showFilterInput) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }
    }, [showFilterInput, columnKey]);
    
    return (
      <th scope="col" className={`relative px-6 py-1 text-left text-xs font-medium uppercase tracking-wider overflow-visible ${
        hasActiveFilter 
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 border-b-2 border-blue-500' 
          : 'text-gray-900 dark:text-white'
      }`}>
        <div className="flex items-center gap-1">
          {/* Column name with sort */}
          <button
            onClick={() => handleSort(columnKey)}
            className={`flex items-center gap-1 transition-colors ${
              hasActiveFilter 
                ? 'text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100' 
                : 'hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            title={`Sort by ${columnName}`}
          >
            <span className="truncate">
              {columnName}
              {hasActiveFilter && (
                <span className="ml-1 text-xs font-normal text-blue-600 dark:text-blue-400">
                  ({selectedValues.length})
                </span>
              )}
            </span>
            {sortConfig.key === columnKey ? (
              sortConfig.direction === 'asc' ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )
            ) : (
              <ChevronsUpDown className="h-3 w-3 text-gray-400" />
            )}
          </button>
          
          {/* Filter button */}
          {showFilter && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFilterInput(columnKey, e.currentTarget);
              }}
              className={`p-0.5 rounded transition-all ${
                hasActiveFilter 
                  ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-700 ring-2 ring-blue-400 ring-offset-1' 
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={`Filter ${columnName}${hasActiveFilter ? ` (${selectedValues.length} selected)` : ''}`}
            >
              <Filter className={`${hasActiveFilter ? 'h-4 w-4' : 'h-3 w-3'}`} />
            </button>
          )}
        </div>
        
        {/* Filter dropdown with checkboxes */}
        {showFilter && showFilterInput && (
          <div 
            ref={filterRef}
            className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 min-w-[200px] max-w-[300px]"
            style={{ 
              zIndex: 9999,
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Filter by {columnName}
                  {hasActiveFilter && (
                    <span className="ml-1 text-blue-600 dark:text-blue-400">
                      ({selectedValues.length} of {distinctValues.length})
                    </span>
                  )}
                </span>
                <button
                  onClick={() => toggleFilterInput(columnKey, null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                <div className="relative inline-block">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={selectAllState.checked}
                    onChange={(e) => {
                      if (selectAllState.checked && !selectAllState.indeterminate) {
                        // All are selected -> unselect all visually but keep showing all data
                        setColumnCheckStates(prev => ({
                          ...prev,
                          [columnKey]: 'none'
                        }));
                        // Remove filter to keep showing all
                        setColumnFilters(prev => {
                          const { [columnKey]: _, ...rest } = prev;
                          return rest;
                        });
                      } else {
                        // Some or none are selected -> select all
                        setColumnCheckStates(prev => ({
                          ...prev,
                          [columnKey]: 'all'
                        }));
                        // Remove filter to show all
                        setColumnFilters(prev => {
                          const { [columnKey]: _, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  {selectAllState.indeterminate && (
                    <Minus className="absolute inset-0 h-3 w-3 m-auto pointer-events-none text-blue-600" />
                  )}
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Select All {selectAllState.indeterminate && `(${selectedValues.length} of ${distinctValues.length})`}
                </span>
              </label>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {distinctValues.length > 0 ? (
                distinctValues.map(value => {
                  const checkState = columnCheckStates[columnKey];
                  const isChecked = checkState === 'none' 
                    ? false 
                    : (!columnFilters[columnKey] || selectedValues.includes(value));
                  return (
                    <label
                      key={value}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleCheckboxFilter(columnKey, value, e.target.checked, allCourses, filteredCourses)}
                        className="h-3 w-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-1 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {value}
                      </span>
                    </label>
                  );
                })
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  No values available
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Resize handle */}
        {columnIndex !== undefined && createResizeHandle(columnIndex)}
      </th>
    );
  };

  // Function to calculate dropdown position
  const calculateDropdownPosition = (buttonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const dropdownWidth = 192; // w-48 = 12rem = 192px
    
    return {
      top: rect.top + window.scrollY,
      left: rect.left - dropdownWidth - 8 // 8px spacing
    };
  };
  
  // Function to calculate filter dropdown position
  const calculateFilterDropdownPosition = (buttonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const dropdownWidth = 250; // min-w-[200px] max-w-[300px]
    const windowWidth = window.innerWidth;
    
    // Position below the button
    let top = rect.bottom + window.scrollY + 4; // 4px spacing
    let left = rect.left + window.scrollX;
    
    // Adjust if dropdown would go off the right edge
    if (left + dropdownWidth > windowWidth) {
      left = windowWidth - dropdownWidth - 10;
    }
    
    return { top, left };
  };

  // Handle course duplication - navigate to create page with pre-filled data
  const handleDuplicateCourse = async (courseId) => {
    try {
      // Fetch the course data
      const response = await courses.getById(courseId);
      const courseData = response.data?.data || response.data;
      
      // Prepare the course data for duplication
      const duplicateData = {
        ...courseData,
        title: `${courseData.title} (copy)`,
        id: undefined, // Remove ID so it creates a new course
        created_at: undefined,
        updated_at: undefined,
        completed_at: undefined,
        completion_percentage: 0,
        status: 'draft'
      };
      
      // Navigate to create page with the course data in state
      if (listId) {
        navigate(`/lists/${listId}/courses/create`, { state: { duplicateData } });
      } else {
        navigate('/courses/create', { state: { duplicateData } });
      }
    } catch (error) {
      console.error('Error fetching course for duplication:', error);
      toast.error('Failed to prepare course for duplication');
    }
  };

  // Read URL parameters on component mount
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlPriority = searchParams.get('priority') || '';
    const urlType = searchParams.get('type') || '';
    const urlStatus = searchParams.get('status') || '';
    const urlFilter = searchParams.get('filter') || '';
    const urlGroupBy = searchParams.get('groupBy') || '';

    // Handle special filter parameters
    let computedFilters = {
      priority: urlPriority,
      type: urlType,
      status: urlStatus
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
    
    // Only update groupBy from URL if URL has a value, or if we're explicitly clearing it
    // Don't let empty URL params override localStorage
    if (urlGroupBy && urlGroupBy !== groupBy) {
      // URL has a value and it's different from current state
      setGroupBy(urlGroupBy);
      localStorage.setItem('coursesGroupBy', urlGroupBy);
    } else if (!urlGroupBy && groupBy) {
      // URL is empty but we have a groupBy state - restore URL from localStorage/state
      const params = new URLSearchParams(searchParams);
      params.set('groupBy', groupBy);
      setSearchParams(params, { replace: true });
    }
  }, [searchParams]);

  // Ensure URL reflects localStorage value on mount
  useEffect(() => {
    const savedGroupBy = localStorage.getItem('coursesGroupBy') || '';
    const urlGroupBy = searchParams.get('groupBy') || '';
    
    // If localStorage has a value but URL doesn't, update URL
    if (savedGroupBy && !urlGroupBy) {
      const params = new URLSearchParams(searchParams);
      params.set('groupBy', savedGroupBy);
      setSearchParams(params, { replace: true });
    }
  }, []); // Only run on mount

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.relative')) {
        setShowDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);



  const { data: coursesData, isLoading, error } = useQuery({
    queryKey: ['courses', user?.role === 'admin' ? 'all' : 'user', user?.id, { 
      list_id: listId
    }],
    queryFn: () => {
      const params = {
        list_id: listId || undefined, // Filter by list if in list context
        limit: 1000 // Increased to show all courses
      };
      
      // Admin users get all courses, other users get only their assigned courses
      return user?.role === 'admin' 
        ? courses.getAll(params)
        : courses.getByUser(user.id, params);
    },
    enabled: !!user?.id
  });

  // Fetch statuses for filtering and display
  const { data: statusesData } = useQuery({
    queryKey: ['statuses'],
    queryFn: async () => {
      const response = await statuses.getAll();
      return response.data;
    }
  });

  // Fetch hierarchy data when searching (programs only, for hierarchy lookup)
  const shouldLoadPrograms = Boolean(searchTerm.trim());
  
  const { data: programsData, isLoading: programsLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const response = await programs.getAll();
      return response.data?.data || response.data || [];
    },
    enabled: shouldLoadPrograms
  });

  // Fetch specific list data when we have a listId
  const { data: specificListData, isLoading: specificListLoading } = useQuery({
    queryKey: ['list', listId],
    queryFn: async () => {
      const response = await lists.getById(listId);
      return response.data?.data || response.data || {};
    },
    enabled: !!listId
  });

  // Get current list data from specific fetch (contains hierarchy names already)
  const currentListData = specificListData;

  // Generate breadcrumb items
  const { generateBreadcrumbs } = useBreadcrumbs();
  
  const breadcrumbItems = (() => {
    if (listId) {
      if (specificListLoading) {
        // Data is still loading
        return [{ label: 'Loading...', href: '#' }];
      } 
      
      // Use embedded hierarchy names from specific list data
      if (specificListData && specificListData.program_name && specificListData.folder_name) {
        const programData = { 
          id: specificListData.program_id || 'unknown', 
          name: specificListData.program_name 
        };
        const folderData = { 
          id: specificListData.folder_id || 'unknown', 
          name: specificListData.folder_name 
        };
        const listData = { 
          id: specificListData.id || listId, 
          name: specificListData.name 
        };
        
        const hierarchyItems = generateBreadcrumbs(programData, folderData, listData, null, 'list');
        return [...hierarchyItems, { label: 'Courses', href: `/lists/${listId}/courses` }];
      }
      
      // Final fallback
      return [
        { label: 'Programs', href: '/programs' },
        { label: 'List Courses', href: `/lists/${listId}/courses` }
      ];
    } else {
      // Default courses breadcrumb - this shouldn't happen since we redirect
      return [{ label: 'Programs', href: '/programs' }];
    }
  })();

  // Fetch phase statuses for progress calculation
  const { data: phaseStatusesData } = useQuery({
    queryKey: ['phase-statuses'],
    queryFn: async () => {
      const response = await phaseStatuses.getAll();
      return response.data.data;
    },
    staleTime: 60 * 60 * 1000, // 1 hour - phase statuses change very rarely
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const workflowTransitionMutation = useMutation({
    mutationFn: ({ courseId, newState, notes }) => 
      courses.transitionWorkflow(courseId, newState, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(['courses']);
      toast.success('Workflow state updated successfully');
    },
    onError: (error) => {
      console.error('Workflow transition error:', error);
      console.error('Error response data:', error.response?.data);
      
      // Extract error message safely
      let errorMessage = 'Failed to update workflow state';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (typeof error.response?.data?.error === 'string') {
        errorMessage = error.response.data.error;
      }
      
      toast.error(errorMessage);
    }
  });



  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setColumnFilters({});
    // Clear URL parameters but preserve groupBy
    const params = new URLSearchParams(searchParams);
    const currentGroupBy = params.get('groupBy');
    params.clear();
    if (currentGroupBy) {
      params.set('groupBy', currentGroupBy);
    }
    setSearchParams(params);
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

  const handleWorkflowTransition = (courseId, newState) => {
    workflowTransitionMutation.mutate({
      courseId,
      newState,
      notes: `Transitioned to ${WORKFLOW_STATES[newState]?.label || newState}`
    });
  };

  const openCourseModal = (course) => {
    setSelectedCourse(course);
    setShowCourseModal(true);
  };

  const closeCourseModal = () => {
    setSelectedCourse(null);
    setShowCourseModal(false);
  };

  // Handle different data structures from getAll() vs getByUser()
  const rawCourses = coursesData?.data?.data?.courses || coursesData?.data?.courses || [];
  
  // Save the original unfiltered list for filter dropdowns (before ANY filtering)
  // Use useMemo to ensure this is computed once and preserved
  const allCourses = useMemo(() => {
    return [...rawCourses];
  }, [coursesData]);

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
  
  // Start with a copy for filtering
  let coursesList = [...rawCourses];
  
  // Build hierarchy lookup for search
  const hierarchyLookup = {};
  
  if (listId && specificListData && specificListData.program_name && specificListData.folder_name) {
    // When we're in a list context, build lookup for all courses in this list
    coursesList.forEach(course => {
      if (course.list_id === listId) {
        hierarchyLookup[course.id] = {
          program: specificListData.program_name,
          folder: specificListData.folder_name,
          list: specificListData.name,
          program_id: specificListData.program_id,
          folder_id: specificListData.folder_id,
          list_id: specificListData.id
        };
      }
    });
  }
  
  // Apply client-side search filtering
  if (searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase();
    coursesList = coursesList.filter(course => {
      const matchesCourse = 
        course.title?.toLowerCase().includes(searchLower) ||
        course.course_code?.toLowerCase().includes(searchLower) ||
        course.description?.toLowerCase().includes(searchLower);
      
      // Also search in hierarchy path
      const hierarchy = hierarchyLookup[course.id];
      const matchesHierarchy = hierarchy && (
        hierarchy.program?.toLowerCase().includes(searchLower) ||
        hierarchy.folder?.toLowerCase().includes(searchLower) ||
        hierarchy.list?.toLowerCase().includes(searchLower)
      );
      
      return matchesCourse || matchesHierarchy;
    });
  }
  
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

  
  // Apply column-specific filters
  Object.entries(columnFilters).forEach(([columnKey, selectedValues]) => {
    // If empty array, filter out everything (nothing selected)
    // If undefined/not in columnFilters, show all (no filter applied)
    if (!selectedValues) return;
    if (selectedValues.length === 0) {
      // Empty array means show nothing
      coursesList = [];
      return;
    }
    
    coursesList = coursesList.filter(course => {
      let value;
      switch (columnKey) {
        case 'course':
          value = course.title;
          break;
        case 'status':
          value = course.status;
          break;
        case 'progress':
          const subtasks = course.subtasks || [];
          const progress = subtasks.length > 0 && phaseStatusesData 
            ? calculateProgress(subtasks, phaseStatusesData, null, course.modality)
            : 0;
          value = `${Math.round(progress)}%`;
          break;
        case 'modality':
          value = course.modality;
          break;
        case 'priority':
          value = course.priority;
          break;
        case 'start_date':
          value = course.start_date ? formatDate(course.start_date) : 'Not set';
          break;
        case 'due_date':
          value = course.due_date ? formatDate(course.due_date) : 'Not set';
          break;
        case 'lead':
          value = course.owner?.name || 'Unassigned';
          break;
        default:
          return true;
      }
      return selectedValues.includes(value);
    });
  });
  
  // Apply sorting
  if (sortConfig.key) {
    coursesList = [...coursesList].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortConfig.key) {
        case 'course':
          aValue = a.title || '';
          bValue = b.title || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'progress':
          const aSubtasks = a.subtasks || [];
          const bSubtasks = b.subtasks || [];
          aValue = aSubtasks.length > 0 && phaseStatusesData 
            ? calculateProgress(aSubtasks, phaseStatusesData, null, a.modality)
            : 0;
          bValue = bSubtasks.length > 0 && phaseStatusesData 
            ? calculateProgress(bSubtasks, phaseStatusesData, null, b.modality)
            : 0;
          break;
        case 'modality':
          aValue = a.modality || '';
          bValue = b.modality || '';
          break;
        case 'priority':
          aValue = a.priority || '';
          bValue = b.priority || '';
          break;
        case 'start_date':
          aValue = a.start_date || '';
          bValue = b.start_date || '';
          break;
        case 'due_date':
          aValue = a.due_date || '';
          bValue = b.due_date || '';
          break;
        case 'lead':
          aValue = a.owner?.name || '';
          bValue = b.owner?.name || '';
          break;
        default:
          return 0;
      }
      
      // Handle numeric vs string comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // String comparison
      const comparison = aValue.toString().localeCompare(bValue.toString());
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }
  
  const hasActiveFilters = Object.values(filters).some(v => v) || 
                           searchTerm.trim() || 
                           Object.values(columnFilters).some(v => v && v.length > 0);

  // Group courses by status if groupBy is set
  const groupedCourses = groupBy === 'status' ? (() => {
    const groups = {};
    const statusesList = statusesData?.data || statusesData || [];
    
    coursesList.forEach(course => {
      // Use the course's actual status field from the database
      const courseStatus = course.status || 'inactive';
      
      // Find the status info from the database statuses
      const statusInfo = statusesList.find(s => s.value === courseStatus);
      const statusLabel = statusInfo ? statusInfo.label : courseStatus;
      
      if (!groups[statusLabel]) {
        groups[statusLabel] = [];
      }
      groups[statusLabel].push(course);
    });
    
    // Apply sorting within each group if needed
    if (sortConfig.key) {
      Object.values(groups).forEach(groupCourses => {
        groupCourses.sort((a, b) => {
          let aValue, bValue;
          
          switch (sortConfig.key) {
            case 'course':
              aValue = a.title || '';
              bValue = b.title || '';
              break;
            case 'progress':
              const aSubtasksGrp = a.subtasks || [];
              const bSubtasksGrp = b.subtasks || [];
              aValue = aSubtasksGrp.length > 0 && phaseStatusesData 
                ? calculateProgress(aSubtasksGrp, phaseStatusesData, null, a.modality)
                : 0;
              bValue = bSubtasksGrp.length > 0 && phaseStatusesData 
                ? calculateProgress(bSubtasksGrp, phaseStatusesData, null, b.modality)
                : 0;
              break;
            case 'modality':
              aValue = a.modality || '';
              bValue = b.modality || '';
              break;
            case 'priority':
              aValue = a.priority || '';
              bValue = b.priority || '';
              break;
            case 'start_date':
              aValue = a.start_date || '';
              bValue = b.start_date || '';
              break;
            case 'due_date':
              aValue = a.due_date || '';
              bValue = b.due_date || '';
              break;
            case 'lead':
              aValue = a.owner?.name || '';
              bValue = b.owner?.name || '';
              break;
            default:
              return 0;
          }
          
          // Handle numeric vs string comparison
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
          }
          
          // String comparison
          const comparison = aValue.toString().localeCompare(bValue.toString());
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
      });
    }
    
    // Sort groups by status order_index from database
    const sortedGroups = {};
    statusesList
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      .forEach(status => {
        if (groups[status.label]) {
          sortedGroups[status.label] = groups[status.label];
        }
      });
    
    // Add any remaining groups that might not have been in the statusesList
    Object.keys(groups).forEach(statusLabel => {
      if (!sortedGroups[statusLabel]) {
        sortedGroups[statusLabel] = groups[statusLabel];
      }
    });
    
    return sortedGroups;
  })() : null;


  return (
    <>
    <div className="p-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} clickable={false} />
      
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
            onClick={() => {
              if (listId) {
                navigate(`/lists/${listId}/courses/create`);
              } else {
                navigate('/courses/create');
              }
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Course
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-2">
        <div className="flex gap-2 items-center">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-9 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Clear Search */}
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="inline-flex items-center justify-center px-2 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </button>
          )}

          {/* Group by Status */}
          <div>
            <button
              onClick={() => {
                const newGroupBy = groupBy === 'status' ? '' : 'status';
                setGroupBy(newGroupBy);
                
                // Save to localStorage
                localStorage.setItem('coursesGroupBy', newGroupBy);
                
                // Update URL parameters
                const params = new URLSearchParams(searchParams);
                if (newGroupBy) {
                  params.set('groupBy', newGroupBy);
                } else {
                  params.delete('groupBy');
                }
                setSearchParams(params);
              }}
              className={`w-full inline-flex items-center justify-center px-2 py-1 border shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                groupBy === 'status'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Layers className="h-3 w-3 mr-1" />
              <span className="text-sm">Group by Status</span>
            </button>
          </div>

          {/* Reset Column Widths */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                resetToDefaults();
                toast.success('Column widths reset to defaults');
              }}
              className="inline-flex items-center justify-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 whitespace-nowrap"
              title="Reset column widths to default"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              <span className="text-sm">Reset Columns</span>
            </button>
            <button
              onClick={() => {
                // Clear all column filters
                setColumnFilters({});
                setColumnCheckStates({});
                setShowFilterInputs({});
                toast.success('All filters cleared');
              }}
              className={`inline-flex items-center justify-center px-3 py-1 border shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 whitespace-nowrap ${
                Object.keys(columnFilters).length > 0 
                  ? 'border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:ring-blue-500'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500'
              }`}
              title={`Clear all column filters${Object.keys(columnFilters).length > 0 ? ` (${Object.keys(columnFilters).length} active)` : ''}`}
            >
              <XCircle className="h-3 w-3 mr-1.5" />
              <span className="text-sm whitespace-nowrap">
                Clear Filters
                {Object.keys(columnFilters).length > 0 && (
                  <span className="ml-1">({Object.keys(columnFilters).length})</span>
                )}
              </span>
            </button>
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
                onClick={() => {
                  if (listId) {
                    navigate(`/lists/${listId}/courses/create`);
                  } else {
                    navigate('/courses/create');
                  }
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Course
              </button>
            )}
          </div>
        </div>
      ) : groupBy === 'status' ? (
        // Grouped view
        <div className="space-y-6">
          {Object.entries(groupedCourses).map(([statusLabel, statusCourses]) => {
            const isExpanded = expandedStatusGroups.has(statusLabel);
            
            // Find the status info to get the icon and color
            const statusesList = statusesData?.data || statusesData || [];
            // Find by label since we're grouping by label
            const statusInfo = statusesList.find(s => s.label === statusLabel) || 
                              COURSE_STATUSES[statusLabel.toLowerCase()] || 
                              { icon: 'Circle', color: 'text-gray-500 dark:text-gray-400', label: statusLabel };
            
            const StatusIcon = statusInfo.icon === 'CheckCircle' ? CheckCircle :
                              statusInfo.icon === 'Circle' ? Circle :
                              statusInfo.icon === 'Pause' ? Pause :
                              statusInfo.icon === 'X' ? X :
                              statusInfo.icon === 'AlertTriangle' ? AlertTriangle :
                              Circle;
            
            return (
              <div key={statusLabel} className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
                <button
                  onClick={() => {
                    setExpandedStatusGroups(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(statusLabel)) {
                        newSet.delete(statusLabel);
                      } else {
                        newSet.add(statusLabel);
                      }
                      return newSet;
                    });
                  }}
                  className="w-full bg-gray-100 dark:bg-gray-700 px-1 py-1 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      {statusLabel}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {statusCourses.length}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="relative" style={{ maxHeight: '1200px', overflow: 'auto' }}>
                <table 
                  className="divide-y divide-gray-200 dark:divide-gray-700"
                  style={{ 
                    tableLayout: 'fixed',
                    width: `${totalTableWidth}px`
                  }}>
                  <colgroup>
                    <col style={{ width: `${columnWidths[0] || 500}px` }} />
                    <col style={{ width: `${columnWidths[1] || 170}px` }} />
                    <col style={{ width: `${columnWidths[2] || 160}px` }} />
                    <col style={{ width: `${columnWidths[3] || 120}px` }} />
                    <col style={{ width: `${columnWidths[4] || 160}px` }} />
                    <col style={{ width: `${columnWidths[5] || 160}px` }} />
                    <col style={{ width: `${columnWidths[6] || 150}px` }} />
                    <col style={{ width: `${columnWidths[7] || 80}px` }} />
                  </colgroup>
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                      <TableHeader columnKey="course" columnName="Course" columnIndex={0} allCourses={allCourses} filteredCourses={coursesList} />
                      <TableHeader columnKey="progress" columnName="Progress" columnIndex={1} allCourses={allCourses} filteredCourses={coursesList} />
                      <TableHeader columnKey="modality" columnName="Modality" columnIndex={2} allCourses={allCourses} filteredCourses={coursesList} />
                      <TableHeader columnKey="priority" columnName="Priority" columnIndex={3} allCourses={allCourses} filteredCourses={coursesList} />
                      <TableHeader columnKey="start_date" columnName="Start Date" columnIndex={4} allCourses={allCourses} filteredCourses={coursesList} />
                      <TableHeader columnKey="due_date" columnName="Due Date" columnIndex={5} allCourses={allCourses} filteredCourses={coursesList} />
                      <TableHeader columnKey="lead" columnName="Lead" columnIndex={6} allCourses={allCourses} filteredCourses={coursesList} />
                      <th scope="col" className="relative px-6 py-1">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {statusCourses.map((course) => {
                      // Use the course's actual status field from the database
                      const courseStatus = course.status || 'inactive';
                      const statusesList = statusesData?.data || statusesData || [];
                      const statusInfo = statusesList.find(s => s.value === courseStatus) || 
                                        COURSE_STATUSES[courseStatus] || 
                                        COURSE_STATUSES['inactive'];
                      
                      const StatusIcon = statusInfo.icon === 'CheckCircle' ? CheckCircle :
                                        statusInfo.icon === 'Circle' ? Circle :
                                        statusInfo.icon === 'Pause' ? Pause :
                                        statusInfo.icon === 'X' ? X :
                                        statusInfo.icon === 'AlertTriangle' ? AlertTriangle :
                                        Circle;
                      
                      const isExpanded = expandedCourses.has(course.id);
                      
                      return (
                        <React.Fragment key={course.id}>
                          <tr className="group hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-1 overflow-hidden">
                              <div className="flex items-center min-w-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCourseExpansion(course.id);
                                  }}
                                  className="mr-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-5 w-5" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5" />
                                  )}
                                </button>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCourseModal(course);
                                    }}
                                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left truncate block w-full"
                                  >
                                    {course.course_code && (
                                      <span className="text-gray-500 dark:text-gray-400 mr-2 text-xs">{course.course_code}</span>
                                    )}
                                    {course.title}
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Progress Column */}
                            <td className="px-6 py-1 overflow-hidden">
                              <CourseProgress 
                                courseId={course.id} 
                                fallbackPercentage={course.completion_percentage || 0} 
                              />
                            </td>

                            {/* Modality Column */}
                            <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModalityColor(course.modality)}`}>
                                {course.modality || 'N/A'}
                              </span>
                            </td>

                            {/* Priority Column */}
                            <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(course.priority, 'badge')}`}>
                                {course.priority || 'Low'}
                              </span>
                            </td>

                            {/* Start Date Column */}
                            <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                              {(course.startDate || course.start_date) ? (
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                                  <span className="truncate">{formatDate(course.startDate || course.start_date)}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>

                            {/* Due Date Column */}
                            <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                              {(course.dueDate || course.due_date) ? (
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                                  <span className="truncate">{formatDate(course.dueDate || course.due_date)}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>

                            {/* Lead Column */}
                            <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                              {course.owner ? (
                                <div className="flex items-center">
                                  <Users className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                                  <span className="truncate">{course.owner.name}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="px-6 py-1 overflow-hidden text-right text-sm font-medium">
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (showDropdown === course.id) {
                                      setShowDropdown(null);
                                    } else {
                                      const position = calculateDropdownPosition(e.currentTarget);
                                      setDropdownPosition(position);
                                      setShowDropdown(course.id);
                                    }
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  title="More actions"
                                >
                                  <MoreHorizontal className="h-5 w-5" />
                                </button>
                                
                                {showDropdown === course.id && (
                                  <div 
                                    className="fixed z-50 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700"
                                    style={{
                                      top: `${dropdownPosition.top}px`,
                                      left: `${dropdownPosition.left}px`
                                    }}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/courses/${course.id}`);
                                        setShowDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                                    >
                                      <ArrowRight className="h-4 w-4" />
                                      <span>View Details</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/courses/${course.id}/edit`);
                                        setShowDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                                    >
                                      <Edit className="h-4 w-4" />
                                      <span>Edit Course</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateCourse(course.id);
                                        setShowDropdown(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                                    >
                                      <Copy className="h-4 w-4" />
                                      <span>Duplicate Course</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50 dark:bg-gray-900">
                              <td colSpan="8" className="p-0">
                                <div className="border-t border-gray-200 dark:border-gray-700">
                                  <CoursePhases courseId={course.id} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Regular ungrouped view
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-md">
          <div style={{ maxHeight: '1200px', overflow: 'auto', width: '100%' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: `${totalTableWidth}px` }}>
              <colgroup>
                <col style={{ width: `${columnWidths[0] || 500}px` }} />
                <col style={{ width: `${columnWidths[1] || 200}px` }} />
                <col style={{ width: `${columnWidths[2] || 170}px` }} />
                <col style={{ width: `${columnWidths[3] || 160}px` }} />
                <col style={{ width: `${columnWidths[4] || 120}px` }} />
                <col style={{ width: `${columnWidths[5] || 160}px` }} />
                <col style={{ width: `${columnWidths[6] || 160}px` }} />
                <col style={{ width: `${columnWidths[7] || 150}px` }} />
                <col style={{ width: `${columnWidths[8] || 80}px` }} />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  <TableHeader columnKey="course" columnName="Course" columnIndex={0} allCourses={allCourses} filteredCourses={coursesList} />
                  <TableHeader columnKey="status" columnName="Status" columnIndex={1} allCourses={allCourses} filteredCourses={coursesList} />
                  <TableHeader columnKey="progress" columnName="Progress" columnIndex={2} allCourses={allCourses} filteredCourses={coursesList} />
                  <TableHeader columnKey="modality" columnName="Modality" columnIndex={3} allCourses={allCourses} filteredCourses={coursesList} />
                  <TableHeader columnKey="priority" columnName="Priority" columnIndex={4} allCourses={allCourses} filteredCourses={coursesList} />
                  <TableHeader columnKey="start_date" columnName="Start Date" columnIndex={5} allCourses={allCourses} filteredCourses={coursesList} />
                  <TableHeader columnKey="due_date" columnName="Due Date" columnIndex={6} allCourses={allCourses} filteredCourses={coursesList} />
                  <TableHeader columnKey="lead" columnName="Lead" columnIndex={7} allCourses={allCourses} filteredCourses={coursesList} />
                  <th scope="col" className="relative px-6 py-1">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {coursesList.map((course) => {
                  // Use the course's actual status field from the database
                  const courseStatus = course.status || 'inactive';
                  const statusesList = statusesData?.data || statusesData || [];
                  const statusInfo = statusesList.find(s => s.value === courseStatus) || 
                                    COURSE_STATUSES[courseStatus] || 
                                    COURSE_STATUSES['inactive'];
                  
                  const StatusIcon = statusInfo.icon === 'CheckCircle' ? CheckCircle :
                                    statusInfo.icon === 'Circle' ? Circle :
                                    statusInfo.icon === 'Pause' ? Pause :
                                    statusInfo.icon === 'X' ? X :
                                    statusInfo.icon === 'AlertTriangle' ? AlertTriangle :
                                    Circle;
                  
                  const isExpanded = expandedCourses.has(course.id);
                  
                  return (
                    <React.Fragment key={course.id}>
                      <tr className="group hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-1 overflow-hidden">
                          <div className="flex items-center" style={{ width: '100%' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCourseExpansion(course.id);
                              }}
                              className="mr-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 flex-shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5" />
                              ) : (
                                <ChevronRight className="h-5 w-5" />
                              )}
                            </button>
                            <div className="overflow-hidden" style={{ maxWidth: 'calc(100% - 32px)' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCourseModal(course);
                                }}
                                className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left truncate block w-full"
                                title={`${course.course_code ? course.course_code + ' - ' : ''}${course.title}`}
                              >
                                {course.course_code && (
                                  <span className="text-gray-500 dark:text-gray-400 mr-1 text-xs">{course.course_code}</span>
                                )}
                                {course.title}
                              </button>
                            </div>
                          </div>
                        </td>
                        
                        {/* Status Column */}
                        <td className="px-6 py-1 overflow-hidden">
                          <div className="flex items-center">
                            <StatusIcon className={`h-4 w-4 mr-1 flex-shrink-0 ${statusInfo.color}`} />
                            <span className="text-sm text-gray-900 dark:text-white truncate">{statusInfo.label}</span>
                          </div>
                        </td>

                        {/* Progress Column */}
                        <td className="px-6 py-1 overflow-hidden">
                          <CourseProgress 
                            courseId={course.id} 
                            fallbackPercentage={course.completion_percentage || 0} 
                          />
                        </td>

                        {/* Modality Column */}
                        <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModalityColor(course.modality)}`}>
                            {course.modality || 'N/A'}
                          </span>
                        </td>

                        {/* Priority Column */}
                        <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(course.priority, 'badge')}`}>
                            {course.priority || 'Low'}
                          </span>
                        </td>

                        {/* Start Date Column */}
                        <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                          {(course.startDate || course.start_date) ? (
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{formatDate(course.startDate || course.start_date)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Due Date Column */}
                        <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                          {(course.dueDate || course.due_date) ? (
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{formatDate(course.dueDate || course.due_date)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Lead Column */}
                        <td className="px-6 py-1 overflow-hidden text-sm text-gray-900 dark:text-white">
                          {course.owner ? (
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{course.owner.name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-1 overflow-hidden text-right text-sm font-medium">
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (showDropdown === course.id) {
                                  setShowDropdown(null);
                                } else {
                                  const position = calculateDropdownPosition(e.currentTarget);
                                  setDropdownPosition(position);
                                  setShowDropdown(course.id);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              title="More actions"
                            >
                              <MoreHorizontal className="h-5 w-5" />
                            </button>
                            
                            {showDropdown === course.id && (
                              <div 
                                className="fixed z-50 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700"
                                style={{
                                  top: `${dropdownPosition.top}px`,
                                  left: `${dropdownPosition.left}px`
                                }}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/courses/${course.id}`);
                                    setShowDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                                >
                                  <ArrowRight className="h-4 w-4" />
                                  <span>View Details</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/courses/${course.id}/edit`);
                                    setShowDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span>Edit Course</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateCourse(course.id);
                                    setShowDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                                >
                                  <Copy className="h-4 w-4" />
                                  <span>Duplicate Course</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 dark:bg-gray-900">
                          <td colSpan="7" className="p-0">
                            <div className="border-t border-gray-200 dark:border-gray-700">
                              <CoursePhases courseId={course.id} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Total Count - shown at bottom */}
      {coursesList.length > 0 && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-right">
          Total: {coursesList.length} {coursesList.length === 1 ? 'Course' : 'Courses'}
        </div>
      )}
    </div>

    {/* Course Details Modal */}
    {showCourseModal && selectedCourse && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedCourse.title}
                </h2>
                {selectedCourse.course_code && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Course Code: {selectedCourse.course_code}
                  </p>
                )}
              </div>
              <button
                onClick={closeCourseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedCourse.description || 'No description available'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {getCourseStatus(selectedCourse, statusesData)?.label || 'Unknown'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Priority</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                    {selectedCourse.priority || 'Not set'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Modality</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedCourse.modality || 'Not set'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Lead</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedCourse.owner ? selectedCourse.owner.name : 'Not assigned'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</h3>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedCourse.dueDate || selectedCourse.due_date ? 
                      formatDate(selectedCourse.dueDate || selectedCourse.due_date) : 
                      'Not set'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeCourseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigate(`/courses/${selectedCourse.id}`);
                  closeCourseModal();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                View Full Details
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

// Progress component that fetches course data to calculate accurate progress
function CourseProgress({ courseId, fallbackPercentage = 0 }) {
  const { data: courseData, isLoading: courseLoading, error: courseError } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => courses.getById(courseId),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  const { data: phaseStatusesData, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['phase-statuses'],
    queryFn: async () => {
      const response = await phaseStatuses.getAll();
      return response.data.data;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours  
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  const { data: modalityTasksData, isLoading: modalityLoading } = useQuery({
    queryKey: ['modality-tasks'],
    queryFn: async () => {
      const response = await modalityTasks.getAll();
      // Handle different possible response structures
      return response.data?.data || response.data || [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });
  
  const course = courseData?.data?.data || courseData?.data || {};
  const subtasks = course.subtasks || [];
  
  const progressPercentage = subtasks.length > 0 && phaseStatusesData 
    ? calculateProgress(subtasks, phaseStatusesData, modalityTasksData, course.modality) 
    : fallbackPercentage;
  
  // Show loading state
  if (courseLoading || statusLoading || modalityLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-20 animate-pulse bg-gray-300 dark:bg-gray-600 h-2 rounded-full"></div>
        <span className="text-xs text-gray-400">--</span>
      </div>
    );
  }
  
  // Show error state or use fallback
  if (courseError || statusError) {
    // Use fallback percentage if available instead of showing error
    return (
      <div className="flex items-center space-x-2">
        <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              fallbackPercentage === 100 ? 'bg-green-500' :
              fallbackPercentage >= 75 ? 'bg-blue-500' :
              fallbackPercentage >= 50 ? 'bg-yellow-500' :
              fallbackPercentage >= 25 ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${fallbackPercentage}%` }}
          ></div>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{fallbackPercentage}%</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center space-x-2">
      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
      <span className="text-xs text-gray-500 dark:text-gray-400">{progressPercentage}%</span>
    </div>
  );
}

// Phases component  
function CoursePhases({ courseId }) {
  const queryClient = useQueryClient();
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [tempStatus, setTempStatus] = useState({});
  const [editingDate, setEditingDate] = useState(null); // For tracking which date is being edited
  const [tempDateValue, setTempDateValue] = useState(''); // For storing temporary date input
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [tempAssignment, setTempAssignment] = useState({});


  // Fetch phase statuses from database
  const { data: phaseStatusesData } = useQuery({
    queryKey: ['phase-statuses'],
    queryFn: async () => {
      const response = await phaseStatuses.getAll();
      return response.data.data; // Extract the actual array from {success: true, data: [...]}
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Fetch users for assignment
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await users.getAll();
      return response.data.data.users; // Extract users array
    }
  });

  // Close editing when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEditingTaskId(null);
        setTempStatus({});
        setEditingDate(null);
        setTempDateValue('');
        setEditingAssignmentId(null);
        setTempAssignment({});
      }
    };

    const handleClickOutside = (e) => {
      if (editingTaskId && !e.target.closest('.phase-status-select')) {
        setEditingTaskId(null);
        setTempStatus({});
      }
      // Only close date editing if clicking outside the date editing area
      if (editingDate && 
          !e.target.closest('input[type="date"]') && 
          !e.target.closest('[title="Click to edit date"]') &&
          !e.target.closest('.text-green-600') &&
          !e.target.closest('.text-gray-600')) {
        setEditingDate(null);
        setTempDateValue('');
      }
      // Close assignment editing if clicking outside the assignment area
      if (editingAssignmentId && 
          !e.target.closest('input[type="checkbox"]') &&
          !e.target.closest('label') &&
          !e.target.closest('button') &&
          !e.target.closest('.bg-white.dark\\:bg-gray-700')) {
        setEditingAssignmentId(null);
        setTempAssignment({});
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [editingTaskId, editingDate, editingAssignmentId]);
  
  const { data: courseData, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => courses.getById(courseId),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, updateData }) => 
      courses.updateSubtask(courseId, subtaskId, updateData),
    onSuccess: (data, variables) => {
      // Only close status editing if we're updating status
      if (variables.updateData.status !== undefined) {
        setEditingTaskId(null);
        toast.success('Phase status updated successfully');
      }
      
      // Invalidate queries immediately but don't clear tempStatus yet
      queryClient.invalidateQueries(['course', courseId]);
      queryClient.invalidateQueries(['courses']);
      
      // Assignment updates are handled in the specific callback
    },
    onError: (error, variables) => {
      // Revert temp status on error
      setTempStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[variables.subtaskId];
        return newStatus;
      });
      console.error('Phase update error:', error.response?.data);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to update phase status';
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to update phase status');
    }
  });

  const updatePhaseHistoryMutation = useMutation({
    mutationFn: ({ subtaskId, historyId, dateData }) => 
      courses.updatePhaseStatusHistory(courseId, subtaskId, historyId, dateData),
    onSuccess: () => {
      queryClient.invalidateQueries(['course', courseId]);
      queryClient.invalidateQueries(['courses']);
      setEditingDate(null);
      setTempDateValue('');
      toast.success('Phase date updated successfully');
    },
    onError: (error) => {
      console.error('Phase date update error:', error.response?.data);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to update phase date';
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to update phase date');
      setEditingDate(null);
      setTempDateValue('');
    }
  });

  const handleDateEdit = (dateKey, currentValue) => {
    setEditingDate(dateKey);
    // Format date for input (YYYY-MM-DD)
    if (currentValue) {
      const date = new Date(currentValue);
      setTempDateValue(date.toISOString().split('T')[0]);
    } else {
      setTempDateValue('');
    }
  };

  const handleDateSave = (subtaskId, historyId, dateField) => {
    if (tempDateValue === '') {
      // Clear the date
      const dateData = { [dateField]: null };
      updatePhaseHistoryMutation.mutate({ subtaskId, historyId, dateData });
    } else {
      // Set the new date
      const dateData = { [dateField]: new Date(tempDateValue).toISOString() };
      updatePhaseHistoryMutation.mutate({ subtaskId, historyId, dateData });
    }
  };

  const handleDateCancel = () => {
    setEditingDate(null);
    setTempDateValue('');
  };

  const handleStatusUpdate = (subtaskId, newStatus) => {
    // Convert to string to handle numeric IDs
    const subtaskIdStr = String(subtaskId);
    
    // Don't update if it's a temporary ID (phase without real ID)
    if (subtaskIdStr.startsWith('temp-')) {
      toast.error('Cannot update phase status: phase not properly saved');
      setEditingTaskId(null);
      return;
    }

    // Get the current task data to include required fields
    const currentTask = subtasks.find(t => {
      const taskId = t.id || t.subtask_id || t.subtaskId;
      return String(taskId) === String(subtaskId);
    });
    
    if (!currentTask) {
      toast.error('Could not find phase data');
      return;
    }

    const currentStatus = currentTask.status;
    
    // Check if changing from any status with dates to No Status
    const statusesWithDates = [
      'alpha_draft', 'alpha_review', 
      'beta_revision', 'beta_review', 
      'final_revision', 'final_signoff_sent', 'final_signoff_received'
    ];
    const isChangingToNoStatus = newStatus === '';
    const currentHasDates = statusesWithDates.includes(currentStatus);
    
    if (isChangingToNoStatus && currentHasDates) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        `Warning: Changing from "${currentStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}" to "No Status" will clear ALL phase dates including:\n\n• All start dates (Alpha Draft, Alpha Review, Beta Revision, Beta Review, Final, Final Signoff Sent, Final Signoff Received)\n• All end dates (where applicable)\n• All completion dates\n• Basic task dates (start, finish, completed)\n\nThis action cannot be undone. Do you want to continue?`
      );
      
      if (!confirmed) {
        // Reset the temp status and editing state
        setTempStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[subtaskId];
          return newStatus;
        });
        setEditingTaskId(null);
        return;
      }
    }

    // Proceed with the update
    updateSubtaskMutation.mutate({
      subtaskId: subtaskId, // Use original ID (might be number)
      updateData: { 
        title: currentTask.title, // Include required field
        status: newStatus,
        isBlocking: currentTask.is_blocking || false,
        weight: currentTask.weight || 1,
        orderIndex: currentTask.order_index || currentTask.orderIndex || 0
      }
    });
  };

  // Assignment handling functions
  const handleAssignmentClick = (subtaskId, currentAssignedUserIds) => {
    setEditingAssignmentId(subtaskId);
    setTempAssignment({ [subtaskId]: currentAssignedUserIds || [] });
  };

  const handleAssignmentToggle = (subtaskId, userId) => {
    const currentAssignments = tempAssignment[subtaskId] || [];
    const isAssigned = currentAssignments.includes(userId);
    
    let newAssignments;
    if (isAssigned) {
      newAssignments = currentAssignments.filter(id => id !== userId);
    } else {
      newAssignments = [...currentAssignments, userId];
    }
    
    setTempAssignment({ [subtaskId]: newAssignments });
  };

  const handleAssignmentConfirm = (subtaskId) => {
    const newAssignedUserIds = tempAssignment[subtaskId] || [];
    updateSubtaskMutation.mutate({
      subtaskId,
      updateData: { assignedUserIds: newAssignedUserIds.map(id => parseInt(id)) }
    }, {
      onSuccess: () => {
        setEditingAssignmentId(null);
        setTempAssignment({});
        toast.success('Assignments updated successfully');
      },
      onError: (error) => {
        console.error('Assignment update failed:', error);
        toast.error('Failed to update assignments');
      }
    });
  };

  const handleAssignmentCancel = () => {
    setEditingAssignmentId(null);
    setTempAssignment({});
  };

  const subtasks = courseData?.data?.data?.subtasks || [];

  // Auto-clear tempStatus when server data matches what we expect
  React.useEffect(() => {
    if (Object.keys(tempStatus).length === 0) return;
    
    const updatedTempStatus = { ...tempStatus };
    let hasChanges = false;
    
    subtasks?.forEach(task => {
      const taskId = task.id || task.subtask_id || task.subtaskId;
      if (tempStatus[taskId] && task.status === tempStatus[taskId]) {
        delete updatedTempStatus[taskId];
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setTempStatus(updatedTempStatus);
    }
  }, [subtasks, tempStatus]);

  if (isLoading) {
    return (
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (subtasks.length === 0) {
    return (
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <ListTodo className="h-4 w-4 mr-2" />
          <span>No phases defined</span>
        </div>
      </div>
    );
  }

  const statusOptions = phaseStatusesData ? 
    [
      // Add empty status option first
      { value: '', label: 'No Status', color: 'text-gray-500 dark:text-gray-400' },
      ...phaseStatusesData
        .filter(status => status.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(status => ({
          value: status.value,
          label: status.label,
          color: `${status.color} ${status.darkColor || ''}`
        }))
    ]
    : [
      // Fallback options
      { value: '', label: 'No Status', color: 'text-gray-500 dark:text-gray-400' },
      { value: 'alpha_review', label: 'Alpha Review', color: 'text-blue-500 dark:text-blue-400' },
      { value: 'beta_review', label: 'Beta Review', color: 'text-orange-500 dark:text-orange-400' },
      { value: 'final_revision', label: 'Final (Gold)', color: 'text-yellow-600 dark:text-yellow-500' },
      { value: 'final_signoff_received', label: 'Final Signoff Received', color: 'text-green-600 dark:text-green-400' }
    ];

  return (
    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
      <div className="space-y-2 min-w-full">
        <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
          <span>Phases of Development</span>
        </div>
        
        {/* Column Headers */}
        <div className="mb-2">
          <div className="flex text-xs font-medium text-gray-900 dark:text-white uppercase tracking-wide px-6">
            <div className="w-48">Phase</div>
            <div className="w-28 ml-2">Status</div>
            <div className="w-40 ml-2">Assignees</div>
            <div className="w-32 ml-4">Alpha Start/End</div>
            <div className="w-32 ml-4">Beta Start/End</div>
            <div className="w-32 ml-4">Final Start/End</div>
            <div className="w-32 ml-4">Signoff Date</div>
          </div>
        </div>
        
        {/* Phase rows container */}
        <div>
        {subtasks.map((task, index) => {
          // Check for different possible ID field names
          const taskId = task.id || task.subtask_id || task.subtaskId || `temp-${index}`;
          
          
          const currentTaskStatus = tempStatus[taskId] || task.status;
          const currentStatus = statusOptions.find(opt => opt.value === currentTaskStatus) || statusOptions[0];
          
          // Get icon from database phase status or fallback to PlayCircle
          const statusConfig = phaseStatusesData?.find(s => s.value === currentTaskStatus);
          const StatusIcon = statusConfig?.icon ? (
            statusConfig.icon === 'PlayCircle' ? PlayCircle :
            statusConfig.icon === 'AlertTriangle' ? AlertTriangle :
            statusConfig.icon === 'CheckCircle' ? CheckCircle :
            statusConfig.icon === 'Circle' ? Circle :
            statusConfig.icon === 'Pause' ? Pause :
            statusConfig.icon === 'Edit' ? Edit :
            PlayCircle
          ) : PlayCircle;

          const isEditing = editingTaskId === taskId;
          const isUpdating = updateSubtaskMutation.isLoading && updateSubtaskMutation.variables?.subtaskId === taskId;
          const canEdit = !!(task.id || task.subtask_id || task.subtaskId); // Only allow editing if subtask has a real ID

          return (
            <div key={task.id || index} className="group bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800">
              <div className="flex items-center py-1 px-6">
                {/* Phase Icon and Title Column */}
                <div className="w-48 flex items-center space-x-2">
                  {isUpdating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 flex-shrink-0"></div>
                  ) : (
                    <StatusIcon className={`h-4 w-4 ${currentStatus.color} flex-shrink-0`} />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {task.title} ({statusConfig?.completionPercentage || 0}%)
                    </div>
                  </div>
                </div>
                
                {/* Status Dropdown Column */}
                <div className="w-28 ml-2">
                  {canEdit ? (
                    <div className="relative group">
                      <select
                        value={currentTaskStatus}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newStatus = e.target.value;
                          // Prevent double execution by checking if status is already changing
                          if (currentTaskStatus === newStatus) {
                            return;
                          }
                          
                          // Update temp status immediately
                          setTempStatus(prev => {
                            // Don't update if already set to this value
                            if (prev[taskId] === newStatus) {
                              return prev;
                            }
                            return {
                              ...prev,
                              [taskId]: newStatus
                            };
                          });
                          
                          // Then trigger the API update
                          handleStatusUpdate(taskId, newStatus);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => {
                          setEditingTaskId(taskId);
                          // Initialize temp status with current status when starting edit
                          setTempStatus(prev => ({
                            ...prev,
                            [taskId]: currentTaskStatus
                          }));
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setEditingTaskId(null);
                          }, 200);
                        }}
                        className={`phase-status-select text-xs px-1 py-1 rounded border cursor-pointer font-medium pr-5 w-full ${
                          isEditing 
                            ? 'border-solid border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500' 
                            : `border-dashed border-gray-300 dark:border-gray-600 hover:border-solid hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105 transition-all ${currentStatus.color} bg-white dark:bg-gray-800`
                        }`}
                        disabled={updateSubtaskMutation.isLoading}
                        title="Click to change status"
                      >
                        {statusOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className={`absolute right-0.5 top-1/2 transform -translate-y-1/2 h-3 w-3 pointer-events-none transition-opacity ${
                        isEditing ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'
                      }`} />
                    </div>
                  ) : (
                    <span className={`text-xs px-1 py-1 rounded ${currentStatus.color} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600`}>
                      {currentStatus.label}
                    </span>
                  )}
                </div>
                
                {/* Assignees Column */}
                <div className="w-40 ml-2 text-xs">
                  {editingAssignmentId === taskId ? (
                    <div className="relative">
                      <div className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 shadow-lg z-50">
                        <div className="max-h-32 overflow-y-auto min-w-36 mb-2">
                          {(usersData || []).map(user => {
                            const isSelected = (tempAssignment[taskId] || []).includes(user.id);
                            return (
                              <label key={user.id} className="flex items-center space-x-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleAssignmentToggle(taskId, user.id);
                                  }}
                                  className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-gray-900 dark:text-white truncate">{user.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex justify-end space-x-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAssignmentConfirm(taskId);
                            }}
                            disabled={updateSubtaskMutation.isLoading}
                            className="flex items-center justify-center px-2 py-1 text-xs font-medium rounded text-green-600 bg-green-100 hover:bg-green-200 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/30 disabled:opacity-50 cursor-pointer"
                            title="Save assignments"
                          >
                            <CheckCircle className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAssignmentCancel();
                            }}
                            disabled={updateSubtaskMutation.isLoading}
                            className="flex items-center justify-center px-2 py-1 text-xs font-medium rounded text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:hover:bg-gray-900/30 disabled:opacity-50 cursor-pointer"
                            title="Cancel editing"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssignmentClick(taskId, (task.assignedUsers || []).map(u => u.id));
                      }}
                      className="w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded transition-colors"
                      title="Click to edit assignees"
                    >
                      {task.assignedUsers && task.assignedUsers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {task.assignedUsers.slice(0, 2).map((user, userIndex) => (
                            <div
                              key={user.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                              title={user.name}
                            >
                              <Users className="h-2.5 w-2.5 mr-1" />
                              <span className="truncate max-w-16">{user.name.split(' ')[0]}</span>
                            </div>
                          ))}
                          {task.assignedUsers.length > 2 && (
                            <div
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              title={`${task.assignedUsers.length - 2} more: ${task.assignedUsers.slice(2).map(u => u.name).join(', ')}`}
                            >
                              +{task.assignedUsers.length - 2}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 italic">Unassigned</span>
                      )}
                    </button>
                  )}
                </div>
                
                {/* Alpha Start/End Column */}
                <div className="w-32 ml-4 text-xs text-gray-600 dark:text-gray-400">
                  <div className="space-y-1">
                    {/* Alpha Draft */}
                    {(task.alpha_draft_start_date || task.alpha_draft_end_date) && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Draft: {task.alpha_draft_start_date ? formatDate(task.alpha_draft_start_date) : '—'}</span>
                        </div>
                        {task.alpha_draft_end_date && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>End: {formatDate(task.alpha_draft_end_date)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Alpha Review */}
                    {(task.alpha_review_start_date || task.alpha_review_end_date) && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Review: {task.alpha_review_start_date ? formatDate(task.alpha_review_start_date) : '—'}</span>
                        </div>
                        {task.alpha_review_end_date && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>End: {formatDate(task.alpha_review_end_date)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show dash if no alpha dates */}
                    {!task.alpha_draft_start_date && !task.alpha_draft_end_date && !task.alpha_review_start_date && !task.alpha_review_end_date && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>
                
                {/* Beta Start/End Column */}
                <div className="w-32 ml-4 text-xs text-gray-600 dark:text-gray-400">
                  <div className="space-y-1">
                    {/* Beta Revision */}
                    {(task.beta_revision_start_date || task.beta_revision_end_date) && (
                      <div className="text-xs text-orange-600 dark:text-orange-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Revision: {task.beta_revision_start_date ? formatDate(task.beta_revision_start_date) : '—'}</span>
                        </div>
                        {task.beta_revision_end_date && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>End: {formatDate(task.beta_revision_end_date)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Beta Review */}
                    {(task.beta_review_start_date || task.beta_review_end_date) && (
                      <div className="text-xs text-purple-600 dark:text-purple-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Review: {task.beta_review_start_date ? formatDate(task.beta_review_start_date) : '—'}</span>
                        </div>
                        {task.beta_review_end_date && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>End: {formatDate(task.beta_review_end_date)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show dash if no beta dates */}
                    {!task.beta_revision_start_date && !task.beta_revision_end_date && !task.beta_review_start_date && !task.beta_review_end_date && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>
                
                {/* Final Start/End Column */}
                <div className="w-32 ml-4 text-xs text-gray-600 dark:text-gray-400">
                  <div className="space-y-1">
                    {/* Final Revision */}
                    {(task.final_revision_start_date || task.final_revision_end_date) && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Final: {task.final_revision_start_date ? formatDate(task.final_revision_start_date) : '—'}</span>
                        </div>
                        {task.final_revision_end_date && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>End: {formatDate(task.final_revision_end_date)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show dash if no final dates */}
                    {!task.final_revision_start_date && !task.final_revision_end_date && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>
                
                {/* Signoff Dates Column */}
                <div className="w-32 ml-4 text-xs text-gray-600 dark:text-gray-400">
                  <div className="space-y-1">
                    {/* Final Signoff Sent */}
                    {(task.final_signoff_sent_start_date || task.final_signoff_sent_end_date) && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Sent: {task.final_signoff_sent_start_date ? formatDate(task.final_signoff_sent_start_date) : '—'}</span>
                        </div>
                        {task.final_signoff_sent_end_date && (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>End: {formatDate(task.final_signoff_sent_end_date)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Final Signoff Received */}
                    {task.final_signoff_received_start_date && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="h-3 w-3" />
                          <span>Received: {formatDate(task.final_signoff_received_start_date)}</span>
                        </div>
                      </div>
                    )}
                    {/* Show dash if no signoff dates */}
                    {!task.final_signoff_sent_start_date && !task.final_signoff_sent_end_date && !task.final_signoff_received_start_date && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
      
    </div>
  );
}

export default CoursesPage;
