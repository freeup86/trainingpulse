import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { 
  ArrowLeft,
  Edit3,
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
  X,
  Package,
  History,
  MessageSquare,
  UserPlus,
  Activity,
  Timer
} from 'lucide-react';
import { courses, statuses, phaseStatuses, programs, folders, lists } from '../lib/api';
import { formatDate, formatRelativeTime, getStatusColor, getPriorityColor } from '../lib/utils';
import { CourseBreadcrumb } from '../components/navigation/Breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import WorkflowMapModal from '../components/WorkflowMapModal';
import PhaseHistoryModal from '../components/PhaseHistoryModal';
import { TimeTrackerWidget } from '../components/TimeTracker';
import { MultipleAssignees } from '../components/MultipleAssignees';
import { Comments } from '../components/Comments';
import { ActivityFeed } from '../components/ActivityFeed';
import { CustomFields } from '../components/CustomFields';

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
  const [showWorkflowMap, setShowWorkflowMap] = useState(false);
  const [showPhaseHistory, setShowPhaseHistory] = useState(false);

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
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false
  });

  // Fetch hierarchy data for breadcrumbs
  const courseForHierarchy = courseData?.data?.data || courseData?.data;
  const listId = courseForHierarchy?.list_id;

  const { data: listData } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => lists.getById(listId),
    enabled: !!listId
  });

  const list = listData?.data?.data || listData?.data;
  const folderId = list?.folder_id;

  const { data: folderData } = useQuery({
    queryKey: ['folder', folderId],
    queryFn: () => folders.getById(folderId),
    enabled: !!folderId
  });

  const folder = folderData?.data?.data || folderData?.data;
  const programId = folder?.program_id;

  const { data: programData } = useQuery({
    queryKey: ['program', programId],
    queryFn: () => programs.getById(programId),
    enabled: !!programId
  });

  const program = programData?.data?.data || programData?.data;

  // Delete course mutation
  const deleteMutation = useMutation({
    mutationFn: () => courses.delete(id),
    onSuccess: () => {
      toast.success('Course deleted successfully');
      queryClient.invalidateQueries(['courses']);
      // Navigate back to the list if we have a list_id, otherwise to programs
      if (course?.list_id) {
        navigate(`/lists/${course.list_id}/courses`);
      } else {
        navigate('/programs');
      }
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
          <Button onClick={() => navigate('/programs')}>
            Back to Programs
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
      {/* Breadcrumb */}
      <CourseBreadcrumb course={course} program={program} folder={folder} list={list} clickable={false} />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // Navigate back to the list if we have a list_id, otherwise to programs
              if (course?.list_id) {
                navigate(`/lists/${course.list_id}/courses`);
              } else {
                navigate('/programs');
              }
            }}
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
                      {course.priority || 'medium'}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Lead</h4>
                    <div className="flex items-center space-x-2 px-2 py-1 rounded bg-gray-50 dark:bg-gray-800">
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
                  <Package className="h-5 w-5 text-gray-600 dark:text-gray-300" />
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
              <div className="flex items-center space-x-2">
                <ListTodo className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <CardTitle>Phases of Development</CardTitle>
              </div>
              <CardDescription>
                Current development phases and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                                case 'final_revision':
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
                                case 'final_revision':
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
                                case 'final_revision':
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
                                      {(() => {
                                        // Only show assignees, hide all date information
                                        const hasAssignees = subtask.assignedUsers && subtask.assignedUsers.length > 0;
                                        
                                        return hasAssignees && (
                                          <div className="flex flex-col space-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            {/* Assigned users */}
                                            <div className="flex items-center space-x-1">
                                              <Users className="h-3 w-3" />
                                              <span>
                                                Assigned to: {subtask.assignedUsers.map(user => user.name).join(', ')}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      <div className="flex items-center space-x-4 mt-1">
                                        {/* Read-only status display */}
                                        <div className={`text-xs px-2.5 py-0.5 rounded font-medium ${getStatusColor(subtask.status)}`}>
                                          {(() => {
                                            const foundStatus = phaseStatusesData?.find(s => s.value === subtask.status);
                                            
                                            return foundStatus?.label || 
                                                   (subtask.status === 'final_revision' ? 'Final (Gold)' : 
                                                    subtask.status === '' ? 'No Status' : 
                                                    subtask.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
                                          })()}
                                        </div>
                                        {/* Read-only assignment display */}
                                        <div className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                                          <Users className="h-3 w-3 inline mr-1" />
                                          {subtask.assignedUsers && subtask.assignedUsers.length > 0 
                                            ? subtask.assignedUsers.length === 1 
                                              ? subtask.assignedUsers[0].name 
                                              : `${subtask.assignedUsers.length} users`
                                            : 'Not assigned'}
                                        </div>
                                        
                                        {/* Phase Dates Display */}
                                        {(() => {
                                          const phaseData = [
                                            { label: 'Alpha Draft', start: subtask.alpha_draft_start_date, end: subtask.alpha_draft_end_date },
                                            { label: 'Alpha Review', start: subtask.alpha_review_start_date, end: subtask.alpha_review_end_date },
                                            { label: 'Beta Revision', start: subtask.beta_revision_start_date, end: subtask.beta_revision_end_date },
                                            { label: 'Beta Review', start: subtask.beta_review_start_date, end: subtask.beta_review_end_date },
                                            { label: 'Final Revision', start: subtask.final_revision_start_date, end: subtask.final_revision_end_date },
                                            { label: 'Final Signoff Sent', start: subtask.final_signoff_sent_start_date, end: subtask.final_signoff_sent_end_date },
                                            { label: 'Final Signoff Received', start: subtask.final_signoff_received_start_date, end: null }
                                          ].filter(phase => phase.start || phase.end);

                                          return phaseData.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Phase Timeline</h4>
                                              <div className="space-y-1">
                                                {phaseData.map((phase, idx) => (
                                                  <div key={idx} className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium">{phase.label}:</span>
                                                    <div className="flex space-x-2">
                                                      {phase.start && (
                                                        <span className="text-green-600 dark:text-green-400">
                                                          Started: {formatDate(phase.start)}
                                                        </span>
                                                      )}
                                                      {phase.end && (
                                                        <span className="text-blue-600 dark:text-blue-400">
                                                          Ended: {formatDate(phase.end)}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })()}
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
                      <p className="text-xs text-gray-400">No phases have been added to this course</p>
                    </div>
                  )}
            </CardContent>
          </Card>

          {/* Multiple Assignees Section - Hidden */}
          {/* <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <UserPlus className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <CardTitle>Team Members</CardTitle>
              </div>
              <CardDescription>
                Manage course assignees and their roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MultipleAssignees
                entityType="course"
                entityId={parseInt(id)}
                currentAssignees={course.assignees || []}
                onAssigneesChange={(newAssignees) => {
                  // Handle assignee changes
                  console.log('Assignees updated:', newAssignees);
                }}
                showRoles={true}
              />
            </CardContent>
          </Card> */}

          {/* Time Tracking Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Timer className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <CardTitle>Time Tracking</CardTitle>
              </div>
              <CardDescription>
                Track time spent on this course
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeTrackerWidget
                taskId={null}
                courseId={parseInt(id)}
              />
            </CardContent>
          </Card>

          {/* Custom Fields Section - Hidden */}
          {/* <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                Additional course information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomFields
                entityType="course"
                entityId={parseInt(id)}
                values={course.customFields || {}}
                onValuesChange={(newValues) => {
                  console.log('Custom fields updated:', newValues);
                }}
                showAddButton={true}
              />
            </CardContent>
          </Card> */}

          {/* Comments Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <CardTitle>Comments & Discussion</CardTitle>
              </div>
              <CardDescription>
                Collaborate and discuss course details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Comments
                entityType="course"
                entityId={parseInt(id)}
              />
            </CardContent>
          </Card>

          {/* Activity Feed Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                <CardTitle>Activity History</CardTitle>
              </div>
              <CardDescription>
                Recent changes and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                entityType="course"
                entityId={parseInt(id)}
                showFilters={false}
                compact={true}
              />
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
                <Badge className={statusInfo.color}>
                  {statusInfo.label}
                </Badge>
              </div>

            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Important Dates</CardTitle>
                <button
                  onClick={() => setShowPhaseHistory(true)}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                >
                  <History className="h-3 w-3 mr-1" />
                  View History
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Start Date</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(course.startDate || course.start_date) ? formatDate(course.startDate || course.start_date) : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Due Date</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(course.dueDate || course.due_date) ? formatDate(course.dueDate || course.due_date) : 'Not set'}
                  </p>
                </div>
              </div>

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

      {/* Phase History Modal */}
      {showPhaseHistory && (
        <PhaseHistoryModal
          courseId={id}
          courseName={course.title}
          onClose={() => setShowPhaseHistory(false)}
        />
      )}
    </div>
  );
}