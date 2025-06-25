import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { 
  ArrowLeft,
  Edit3,
  Edit,
  Calendar,
  Clock,
  Users,
  FileText,
  Tag,
  AlertTriangle,
  CheckCircle,
  Circle,
  Pause,
  ListTodo,
  PlayCircle,
  Trash2,
  Plus,
  X,
  Package
} from 'lucide-react';
import { courses, statuses, phaseStatuses, users } from '../lib/api';
import { formatDate, formatRelativeTime, getStatusColor, getPriorityColor } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import TaskManager from '../components/TaskManager';
import WorkflowMapModal from '../components/WorkflowMapModal';

// Independent status definitions (separate from workflow)
const COURSE_STATUSES = {
  'active': { icon: CheckCircle, label: 'Active', color: 'text-green-500 dark:text-green-400' },
  'inactive': { icon: Circle, label: 'Inactive', color: 'text-gray-500 dark:text-gray-400' },
  'on_hold': { icon: Pause, label: 'On Hold', color: 'text-yellow-500 dark:text-yellow-400' },
  'cancelled': { icon: Tag, label: 'Cancelled', color: 'text-red-500 dark:text-red-400' },
  'completed': { icon: CheckCircle, label: 'Completed', color: 'text-blue-500 dark:text-blue-400' }
};

// Mapping function to derive status from workflow state
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

const WORKFLOW_STATES = {
  'draft': { icon: Circle, label: 'Draft', color: 'text-gray-500' },
  'planning': { icon: Circle, label: 'Planning', color: 'text-gray-500' },
  'content_development': { icon: Clock, label: 'Development', color: 'text-blue-500' },
  'development': { icon: Clock, label: 'Development', color: 'text-blue-500' },
  'review': { icon: AlertTriangle, label: 'Review', color: 'text-yellow-500' },
  'sme_review': { icon: AlertTriangle, label: 'SME Review', color: 'text-yellow-500' },
  'instructional_review': { icon: AlertTriangle, label: 'Instructional Review', color: 'text-yellow-500' },
  'legal_review': { icon: AlertTriangle, label: 'Legal Review', color: 'text-orange-500' },
  'compliance_review': { icon: AlertTriangle, label: 'Compliance Review', color: 'text-orange-500' },
  'final_approval': { icon: Pause, label: 'Final Approval', color: 'text-orange-500' },
  'approval': { icon: Pause, label: 'Approval', color: 'text-orange-500' },
  'published': { icon: CheckCircle, label: 'Published', color: 'text-green-500' },
  'on_hold': { icon: Pause, label: 'On Hold', color: 'text-red-500' },
  'archived': { icon: Circle, label: 'Archived', color: 'text-gray-400' }
};

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

export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingTasks, setIsEditingTasks] = useState(false);
  const [showWorkflowMap, setShowWorkflowMap] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState(null);
  const [tempPhaseStatus, setTempPhaseStatus] = useState({});
  const [isEditingCourseStatus, setIsEditingCourseStatus] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [tempAssignment, setTempAssignment] = useState({});

  const { data: courseData, isLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: () => courses.getById(id),
    enabled: !!id
  });

  // Fetch statuses
  const { data: statusesData } = useQuery({
    queryKey: ['statuses'],
    queryFn: async () => {
      const response = await statuses.getAll();
      return response.data;
    }
  });

  // Fetch phase statuses
  const { data: phaseStatusesData } = useQuery({
    queryKey: ['phase-statuses'],
    queryFn: async () => {
      const response = await phaseStatuses.getAll();
      return response.data.data; // Extract the actual array from {success: true, data: [...]}
    }
  });

  // Fetch users for assignment
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await users.getAll();
      return response.data.data.users; // Extract users array
    }
  });

  // Delete course mutation
  const deleteMutation = useMutation({
    mutationFn: () => courses.delete(id),
    onSuccess: () => {
      toast.success('Course deleted successfully');
      queryClient.invalidateQueries(['courses']);
      navigate('/courses');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete course');
    }
  });

  // Workflow transition mutation
  const workflowTransitionMutation = useMutation({
    mutationFn: ({ courseId, newState, notes }) => 
      courses.transitionWorkflow(courseId, newState, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(['course', id]);
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

  // Update subtask mutation for phase status changes
  const updateSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, updateData }) => 
      courses.updateSubtask(id, subtaskId, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries(['course', id]);
      queryClient.invalidateQueries(['courses']);
      toast.success('Phase status updated successfully');
      setEditingPhaseId(null);
      setTempPhaseStatus({});
    },
    onError: (error) => {
      console.error('Subtask update error:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to update phase status');
      setEditingPhaseId(null);
      setTempPhaseStatus({});
    }
  });

  // Update course status mutation
  const updateCourseStatusMutation = useMutation({
    mutationFn: (newStatus) => courses.update(id, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries(['course', id]);
      queryClient.invalidateQueries(['courses']);
      toast.success('Course status updated successfully');
      setIsEditingCourseStatus(false);
    },
    onError: (error) => {
      console.error('Course status update error:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to update course status');
      setIsEditingCourseStatus(false);
    }
  });

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
  };

  const handleWorkflowTransition = (newState) => {
    workflowTransitionMutation.mutate({
      courseId: id,
      newState,
      notes: `Transitioned to ${WORKFLOW_STATES[newState]?.label || newState}`
    });
  };

  const handleCourseStatusUpdate = (newStatus) => {
    updateCourseStatusMutation.mutate(newStatus);
  };

  const handleStatusUpdate = (subtaskId, newStatus) => {
    // Find the subtask to get all its current data
    const subtask = course.subtasks?.find(s => s.id === subtaskId);
    if (!subtask) {
      toast.error('Subtask not found');
      return;
    }
    
    updateSubtaskMutation.mutate({
      subtaskId,
      updateData: { 
        title: subtask.title,
        status: newStatus,
        isBlocking: subtask.is_blocking || subtask.isBlocking || false,
        weight: subtask.weight || 1,
        orderIndex: subtask.order_index || subtask.orderIndex || 0
      }
    });
  };

  const handleStatusClick = (subtaskId, currentStatus) => {
    setEditingPhaseId(subtaskId);
    setTempPhaseStatus({ [subtaskId]: currentStatus });
  };

  const handleStatusChange = (subtaskId, newStatus) => {
    setTempPhaseStatus({ [subtaskId]: newStatus });
  };

  const handleStatusConfirm = (subtaskId) => {
    const newStatus = tempPhaseStatus[subtaskId];
    if (newStatus) {
      handleStatusUpdate(subtaskId, newStatus);
    }
  };

  const handleStatusCancel = () => {
    setEditingPhaseId(null);
    setTempPhaseStatus({});
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
      data: { assignedUserIds: newAssignedUserIds.map(id => parseInt(id)) }
    });
    setEditingAssignmentId(null);
    setTempAssignment({});
  };

  const handleAssignmentCancel = () => {
    setEditingAssignmentId(null);
    setTempAssignment({});
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
                Error loading course
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error.message || 'Failed to load course details. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const course = courseData?.data?.data || courseData?.data || {};
  
  if (!course.id) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Course not found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">The course you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/courses')}>
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  // Use the course's actual status field from the database
  const courseStatus = course.status || 'inactive';
  
  // Get status info from fetched statuses or fallback to hardcoded
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/courses')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {course.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Course Details
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate(`/courses/${course.id}/edit`)}
          className="flex items-center space-x-2"
        >
          <Edit3 className="h-4 w-4" />
          <span>Edit Course</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Course Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Course Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {course.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Description</h4>
                    <p className="text-gray-700 dark:text-gray-300">{course.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Modality</h4>
                    <Badge variant="outline" className="capitalize">
                      {course.modality}
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Priority</h4>
                    <Badge className={getPriorityColor(course.priority)}>
                      {course.priority}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Owner</h4>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {course.owner ? course.owner.name : 'Not assigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {course.estimatedHours && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Estimated Hours</h4>
                    <p className="text-gray-700 dark:text-gray-300">{course.estimatedHours} hours</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Course Deliverables */}
          {course?.deliverables && course.deliverables.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <CardTitle>Course Deliverables</CardTitle>
                </div>
                <CardDescription>
                  Deliverables associated with this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {course.deliverables.map((deliverable, index) => (
                    <div 
                      key={deliverable.id || index}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <div className="flex-shrink-0">
                        <Package className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {deliverable.name}
                        </h4>
                        {deliverable.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {deliverable.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Course Content */}
          {course.content && (
            <Card>
              <CardHeader>
                <CardTitle>Course Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300">{course.content}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Learning Objectives */}
          {course.learningObjectives && course.learningObjectives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Learning Objectives</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {course.learningObjectives.map((objective, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{objective}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Tasks Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ListTodo className="h-5 w-5" />
                  <CardTitle>Phases of Development</CardTitle>
                </div>
                <Button
                  onClick={() => setIsEditingTasks(!isEditingTasks)}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isEditingTasks ? 'Done' : 'Manage Phases'}</span>
                </Button>
              </div>
              <CardDescription>
                Track progress on individual development phases
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditingTasks ? (
                <TaskManager 
                  courseId={id} 
                  initialTasks={course.subtasks || []} 
                  showTitle={false}
                />
              ) : (
                <>
                  {course.subtasks && course.subtasks.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {course.subtasks
                          .sort((a, b) => a.order_index - b.order_index)
                          .map((subtask, index) => {
                            const getStatusIcon = (status) => {
                              const statusConfig = phaseStatusesData?.find(s => s.value === status);
                              if (statusConfig) {
                                return <PlayCircle className={`h-4 w-4 ${statusConfig.color}`} />;
                              }
                              
                              // Fallback for hardcoded statuses
                              switch (status) {
                                case 'final':
                                  return <PlayCircle className="h-4 w-4 text-yellow-600" />;
                                case 'beta_review':
                                  return <PlayCircle className="h-4 w-4 text-orange-500" />;
                                case 'alpha_review':
                                  return <PlayCircle className="h-4 w-4 text-blue-500" />;
                                default:
                                  return <PlayCircle className="h-4 w-4 text-blue-500" />;
                              }
                            };

                            const getStatusColor = (status) => {
                              const statusConfig = phaseStatusesData?.find(s => s.value === status);
                              if (statusConfig && statusConfig.color) {
                                // Convert text color to background color for badges
                                let baseColor = statusConfig.color;
                                
                                // Handle different color formats
                                if (baseColor.includes('text-')) {
                                  baseColor = baseColor.replace('text-', '').replace('-500', '').replace('-600', '').replace('-400', '');
                                }
                                
                                // Special handling for yellow/gold colors
                                if (baseColor.includes('yellow')) {
                                  return 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200';
                                }
                                
                                return `bg-${baseColor}-100 text-${baseColor}-800 dark:bg-${baseColor}-900/20 dark:text-${baseColor}-300`;
                              }
                              
                              // Fallback for hardcoded statuses
                              switch (status) {
                                case 'final':
                                  return 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200';
                                case 'beta_review':
                                  return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
                                case 'alpha_review':
                                  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
                                default:
                                  return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
                              }
                            };

                            const getCompletionPercentage = (status) => {
                              const statusConfig = phaseStatusesData?.find(s => s.value === status);
                              if (statusConfig && statusConfig.completionPercentage !== undefined) {
                                return statusConfig.completionPercentage;
                              }
                              
                              // Fallback for hardcoded statuses
                              switch (status) {
                                case 'final':
                                  return 10;
                                case 'beta_review':
                                  return 30;
                                case 'alpha_review':
                                  return 60;
                                case 'completed':
                                  return 100;
                                case 'in_progress':
                                  return 50;
                                case 'pending':
                                  return 0;
                                default:
                                  return 0;
                              }
                            };

                            return (
                              <div 
                                key={subtask.id} 
                                className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  {getStatusIcon(subtask.status)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                          {subtask.title}
                                        </h4>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          ({getCompletionPercentage(subtask.status)}% complete)
                                        </span>
                                      </div>
                                      {(subtask.start_date || subtask.finish_date || subtask.assignedUser) && (
                                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                          {subtask.start_date && (
                                            <div className="flex items-center space-x-1">
                                              <Calendar className="h-3 w-3" />
                                              <span>Started: {new Date(subtask.start_date).toLocaleDateString()}</span>
                                            </div>
                                          )}
                                          {subtask.finish_date && (
                                            <div className="flex items-center space-x-1">
                                              <CheckCircle className="h-3 w-3" />
                                              <span>Finished: {new Date(subtask.finish_date).toLocaleDateString()}</span>
                                            </div>
                                          )}
                                          {subtask.assignedUsers && subtask.assignedUsers.length > 0 && (
                                            <div className="flex items-center space-x-1">
                                              <Users className="h-3 w-3" />
                                              <span>
                                                Assigned to: {subtask.assignedUsers.map(user => user.name).join(', ')}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <div className="flex items-center space-x-4 mt-1">
                                        {editingPhaseId === subtask.id ? (
                                          <div className="flex items-center space-x-2">
                                            <select
                                              value={tempPhaseStatus[subtask.id] || subtask.status}
                                              onChange={(e) => handleStatusChange(subtask.id, e.target.value)}
                                              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                            >
                                              {phaseStatusesData ? 
                                                phaseStatusesData
                                                  .filter(status => status.isActive)
                                                  .sort((a, b) => a.sortOrder - b.sortOrder)
                                                  .map(status => (
                                                    <option key={status.value} value={status.value}>
                                                      {status.label}
                                                    </option>
                                                  ))
                                                :
                                                // Fallback options
                                                <>
                                                  <option value="alpha_review">Alpha Review</option>
                                                  <option value="beta_review">Beta Review</option>
                                                  <option value="final">Final (Gold)</option>
                                                </>
                                              }
                                            </select>
                                            <button
                                              onClick={() => handleStatusConfirm(subtask.id)}
                                              disabled={updateSubtaskMutation.isPending}
                                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-green-600 bg-green-100 hover:bg-green-200 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/30 disabled:opacity-50"
                                            >
                                              <CheckCircle className="h-3 w-3" />
                                            </button>
                                            <button
                                              onClick={handleStatusCancel}
                                              disabled={updateSubtaskMutation.isPending}
                                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:hover:bg-gray-900/30 disabled:opacity-50"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => handleStatusClick(subtask.id, subtask.status)}
                                            className={`text-xs px-2.5 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity ${getStatusColor(subtask.status)}`}
                                          >
                                            {(() => {
                                              const foundStatus = phaseStatusesData?.find(s => s.value === subtask.status);
                                              
                                              return foundStatus?.label || 
                                                     (subtask.status === 'final' ? 'Final (Gold)' : subtask.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
                                            })()}
                                          </button>
                                        )}
                                        {/* Assignment Section */}
                                        {editingAssignmentId === subtask.id ? (
                                          <div className="flex items-center space-x-2">
                                            <div className="relative">
                                              <div className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-2 max-h-32 overflow-y-auto min-w-48">
                                                {(usersData || []).map(user => {
                                                  const isSelected = (tempAssignment[subtask.id] || []).includes(user.id);
                                                  return (
                                                    <label key={user.id} className="flex items-center space-x-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded cursor-pointer">
                                                      <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleAssignmentToggle(subtask.id, user.id)}
                                                        className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                      />
                                                      <span className="text-gray-900 dark:text-white">{user.name}</span>
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => handleAssignmentConfirm(subtask.id)}
                                              disabled={updateSubtaskMutation.isPending}
                                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-green-600 bg-green-100 hover:bg-green-200 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/30 disabled:opacity-50"
                                            >
                                              <CheckCircle className="h-3 w-3" />
                                            </button>
                                            <button
                                              onClick={handleAssignmentCancel}
                                              disabled={updateSubtaskMutation.isPending}
                                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:hover:bg-gray-900/30 disabled:opacity-50"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => handleAssignmentClick(subtask.id, (subtask.assignedUsers || []).map(u => u.id))}
                                            className="text-xs px-2.5 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                            title={subtask.assignedUsers && subtask.assignedUsers.length > 0 ? `Assigned to ${subtask.assignedUsers.map(u => u.name).join(', ')}` : 'Click to assign'}
                                          >
                                            <Users className="h-3 w-3 inline mr-1" />
                                            {subtask.assignedUsers && subtask.assignedUsers.length > 0 
                                              ? subtask.assignedUsers.length === 1 
                                                ? subtask.assignedUsers[0].name 
                                                : `${subtask.assignedUsers.length} users`
                                              : 'Assign'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      
                    </>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                      <ListTodo className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">No phases yet</p>
                      <Button
                        onClick={() => setIsEditingTasks(true)}
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add First Task</span>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Information */}
          <Card>
            <CardHeader>
              <CardTitle>Status Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Status</span>
                </div>
                {isEditingCourseStatus ? (
                  <div className="flex items-center space-x-2">
                    <select
                      value={courseStatus}
                      onChange={(e) => handleCourseStatusUpdate(e.target.value)}
                      className="text-sm px-2 py-1 border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={updateCourseStatusMutation.isPending}
                      autoFocus
                    >
                      {(statusesData?.data || statusesData || []).map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setIsEditingCourseStatus(false)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      disabled={updateCourseStatusMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {updateCourseStatusMutation.isPending && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors group"
                    onClick={() => setIsEditingCourseStatus(true)}
                    title="Click to change status"
                  >
                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                    <Edit className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Important Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(course.dueDate || course.due_date) && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Due Date</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(course.dueDate || course.due_date)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Last Updated</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatRelativeTime(course.updatedAt || course.updated_at)}
                  </p>
                </div>
              </div>

              {(course.createdAt || course.created_at) && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Created</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(course.createdAt || course.created_at)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignments */}
          {course.assignments && course.assignments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Assignments</CardTitle>
                <CardDescription>
                  People assigned to this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-3">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {course.assignments.length} assigned
                  </span>
                </div>
                <div className="space-y-2">
                  {course.assignments.slice(0, 5).map((assignment, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {assignment.user?.name?.charAt(0) || assignment.userName?.charAt(0) || assignment.name?.charAt(0) || assignment.assignedTo?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {assignment.user?.name || assignment.userName || assignment.name || assignment.assignedTo || `User ${assignment.userId || assignment.id || 'Unknown'}`}
                      </span>
                    </div>
                  ))}
                  {course.assignments.length > 5 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      +{course.assignments.length - 5} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Information */}
          {course.team && (
            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <Link 
                    to={`/teams/${course.team.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {course.team.name}
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={handleDeleteCancel}
          />
          
          {/* Dialog */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Delete Course
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete "<strong>{course.title}</strong>"? This will permanently remove the course and all its associated data.
            </p>
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="ghost"
                onClick={handleDeleteCancel}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="flex items-center space-x-2"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Course</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Map Modal */}
      {showWorkflowMap && (
        <WorkflowMapModal
          courseId={id}
          courseName={course.title}
          currentWorkflowState={course.workflowState || course.workflow_state}
          onClose={() => setShowWorkflowMap(false)}
        />
      )}
    </div>
  );
}