import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
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
  Plus
} from 'lucide-react';
import { courses } from '../lib/api';
import { formatDate, formatRelativeTime, getStatusColor, getPriorityColor } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import TaskManager from '../components/TaskManager';
import WorkflowMapModal from '../components/WorkflowMapModal';

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

export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingTasks, setIsEditingTasks] = useState(false);
  const [showWorkflowMap, setShowWorkflowMap] = useState(false);

  const { data: courseData, isLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: () => courses.getById(id),
    enabled: !!id
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

  const workflowInfo = WORKFLOW_STATES[course.workflowState || course.workflow_state] || WORKFLOW_STATES['draft'];
  const WorkflowIcon = workflowInfo.icon;

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
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Type</h4>
                    <Badge variant="outline" className="capitalize">
                      {course.type?.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Priority</h4>
                    <Badge className={getPriorityColor(course.priority)}>
                      {course.priority}
                    </Badge>
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
                  <CardTitle>Course Tasks</CardTitle>
                </div>
                <Button
                  onClick={() => setIsEditingTasks(!isEditingTasks)}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isEditingTasks ? 'Done' : 'Manage Tasks'}</span>
                </Button>
              </div>
              <CardDescription>
                Track progress on individual course components
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
                              switch (status) {
                                case 'completed':
                                  return <CheckCircle className="h-4 w-4 text-green-500" />;
                                case 'in_progress':
                                  return <PlayCircle className="h-4 w-4 text-blue-500" />;
                                case 'on_hold':
                                  return <Pause className="h-4 w-4 text-yellow-500" />;
                                default:
                                  return <Circle className="h-4 w-4 text-gray-400" />;
                              }
                            };

                            const getStatusColor = (status) => {
                              switch (status) {
                                case 'completed':
                                  return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
                                case 'in_progress':
                                  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
                                case 'on_hold':
                                  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
                                default:
                                  return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
                              }
                            };

                            return (
                              <div 
                                key={subtask.id} 
                                className={`flex items-start space-x-3 p-3 rounded-lg border ${
                                  subtask.is_blocking 
                                    ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10' 
                                    : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
                                }`}
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  {getStatusIcon(subtask.status)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                        {subtask.title}
                                        {subtask.is_blocking && (
                                          <Badge className="ml-2 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                                            Blocking
                                          </Badge>
                                        )}
                                      </h4>
                                      <div className="flex items-center space-x-4 mt-1">
                                        <Badge className={`text-xs ${getStatusColor(subtask.status)}`}>
                                          {subtask.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </Badge>
                                        {subtask.weight && (
                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                            Weight: {subtask.weight}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      
                      {/* Progress Summary */}
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Progress</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {course.subtasks.filter(t => t.status === 'completed').length} of {course.subtasks.length} completed
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(course.subtasks.filter(t => t.status === 'completed').length / course.subtasks.length) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                      <ListTodo className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">No tasks yet</p>
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
                  <WorkflowIcon className={`h-4 w-4 ${workflowInfo.color}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Workflow Step</span>
                </div>
                <button
                  onClick={() => setShowWorkflowMap(true)}
                  className="inline-flex items-center group"
                >
                  <Badge className={`${getStatusColor(course.workflowState)} hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer group-hover:ring-2 group-hover:ring-blue-300 group-hover:ring-offset-1 flex items-center space-x-1`}>
                    <span>{workflowInfo.label}</span>
                    <svg className="w-3 h-3 ml-1 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Badge>
                </button>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                  📍 Click to view workflow map
                </p>
              </div>

              {course.status && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Tag className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Status</span>
                  </div>
                  <Badge className={getStatusColor(course.status)}>
                    {course.status}
                  </Badge>
                </div>
              )}
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