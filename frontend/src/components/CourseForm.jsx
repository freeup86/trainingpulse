import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Save, Calendar, Clock, Users, AlertTriangle, Trash2, ListTodo } from 'lucide-react';
import { courses, users, teams, workflows } from '../lib/api';
import TaskManager from './TaskManager';

const COURSE_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'certification', label: 'Certification' }
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' }
];

export default function CourseForm({ courseId = null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(courseId);
  const taskManagerRef = useRef();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'standard',
    priority: 'medium',
    startDate: '',
    dueDate: '',
    estimatedHours: '',
    estimatedDailyHours: '',
    workflowTemplateId: ''
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);


  // Fetch course data if editing
  const { data: courseData } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const response = await courses.getById(courseId);
      return response.data.data; // Extract the actual course data from the response
    },
    enabled: isEditing
  });

  // Fetch users for assignment
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => users.getAll({ limit: 100 })
  });

  // Fetch teams for context
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teams.getAll()
  });

  // Fetch workflow templates
  const { data: workflowTemplatesData } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const response = await workflows.getTemplates();
      return response.data?.data || response.data || [];
    }
  });

  // Populate form when editing
  useEffect(() => {
    if (courseData) {
      const course = courseData;
      setFormData({
        title: course.title || '',
        description: course.description || '',
        type: course.type || 'standard',
        priority: course.priority || 'medium',
        startDate: course.start_date ? course.start_date.split('T')[0] : '',
        dueDate: course.due_date ? course.due_date.split('T')[0] : '',
        estimatedHours: course.estimated_hours || '',
        estimatedDailyHours: course.estimated_daily_hours || '',
        workflowTemplateId: course.workflow_template_id || ''
      });
    }
  }, [courseData]);

  // Set default workflow template for new courses
  useEffect(() => {
    if (!isEditing && Array.isArray(workflowTemplatesData) && workflowTemplatesData.length > 0 && !formData.workflowTemplateId) {
      // Default to the first active template (usually "Standard Course Development")
      const defaultTemplate = workflowTemplatesData.find(t => t.is_active) || workflowTemplatesData[0];
      if (defaultTemplate) {
        setFormData(prev => ({ ...prev, workflowTemplateId: defaultTemplate.id.toString() }));
      }
    }
  }, [isEditing, workflowTemplatesData, formData.workflowTemplateId]);

  // Create course mutation
  const createMutation = useMutation({
    mutationFn: (courseData) => courses.create(courseData),
    onSuccess: () => {
      toast.success('Course created successfully!');
      queryClient.invalidateQueries(['courses']);
      navigate('/courses');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create course');
    }
  });

  // Update course mutation
  const updateMutation = useMutation({
    mutationFn: (courseData) => courses.update(courseId, courseData),
    onSuccess: () => {
      toast.success('Course updated successfully!');
      queryClient.invalidateQueries(['courses']);
      queryClient.invalidateQueries(['course', courseId]);
      navigate('/courses');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update course');
    }
  });

  // Delete course mutation (only available when editing)
  const deleteMutation = useMutation({
    mutationFn: () => courses.delete(courseId),
    onSuccess: () => {
      toast.success('Course deleted successfully');
      queryClient.invalidateQueries(['courses']);
      navigate('/courses');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete course');
    }
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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


  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Course title is required');
      return;
    }
    
    if (!formData.description.trim()) {
      toast.error('Course description is required');
      return;
    }

    // Due date is required for new courses
    if (!isEditing && !formData.dueDate) {
      toast.error('Due date is required');
      return;
    }

    // Workflow template is required for new courses
    if (!isEditing && !formData.workflowTemplateId) {
      toast.error('Workflow template is required');
      return;
    }

    if (formData.dueDate && formData.startDate && new Date(formData.dueDate) < new Date(formData.startDate)) {
      toast.error('Due date cannot be earlier than start date');
      return;
    }

    const submitData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      type: formData.type,
      priority: formData.priority,
      dueDate: formData.dueDate, // Required for creation
    };

    // Only add optional fields if they have values
    if (formData.startDate) {
      submitData.startDate = formData.startDate;
    }
    if (formData.estimatedHours) {
      submitData.estimatedHours = parseInt(formData.estimatedHours);
    }
    if (formData.estimatedDailyHours) {
      submitData.estimatedDailyHours = parseFloat(formData.estimatedDailyHours);
    }

    if (isEditing) {
      // For editing, dueDate can be null
      const editData = { ...submitData };
      if (!editData.dueDate) {
        editData.dueDate = null;
      }
      updateMutation.mutate(editData);
    } else {
      // For creating, we need a workflow template ID and dueDate is required
      const createData = { ...submitData, workflowTemplateId: parseInt(formData.workflowTemplateId) };
      
      // Get tasks data from TaskManager if available
      if (taskManagerRef.current) {
        const tasksData = taskManagerRef.current.getTasksData();
        if (tasksData.length > 0) {
          createData.tasks = tasksData;
        }
      }
      
      createMutation.mutate(createData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => navigate('/courses')}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Courses
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Course' : 'Create New Course'}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {isEditing ? 'Update course details and settings' : 'Create a new training course and configure its workflow'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 gap-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Course Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter course title..."
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description *
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Describe the course content and objectives..."
                  required
                />
              </div>

              {/* Type and Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Course Type
                  </label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    {COURSE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    {PRIORITIES.map(priority => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Workflow Template */}
              {!isEditing && (
                <div>
                  <label htmlFor="workflowTemplateId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Workflow Template *
                  </label>
                  <select
                    id="workflowTemplateId"
                    value={formData.workflowTemplateId}
                    onChange={(e) => handleInputChange('workflowTemplateId', e.target.value)}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select a workflow template</option>
                    {Array.isArray(workflowTemplatesData) && workflowTemplatesData.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {Array.isArray(workflowTemplatesData) && formData.workflowTemplateId && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {workflowTemplatesData.find(t => t.id.toString() === formData.workflowTemplateId)?.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Timeline and Resources */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Timeline & Resources</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Due Date */}
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Due Date {!isEditing && '*'}
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required={!isEditing}
                />
              </div>

              {/* Estimated Hours */}
              <div>
                <label htmlFor="estimatedHours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Estimated Hours
                </label>
                <input
                  type="number"
                  id="estimatedHours"
                  min="0"
                  step="0.5"
                  value={formData.estimatedHours}
                  onChange={(e) => handleInputChange('estimatedHours', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. 40"
                />
              </div>

              {/* Estimated Daily Hours */}
              <div>
                <label htmlFor="estimatedDailyHours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Daily Hours
                </label>
                <input
                  type="number"
                  id="estimatedDailyHours"
                  min="0"
                  step="0.25"
                  value={formData.estimatedDailyHours}
                  onChange={(e) => handleInputChange('estimatedDailyHours', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. 2"
                />
              </div>
            </div>

          </div>

          {/* Course Tasks Section */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
              <ListTodo className="h-5 w-5 mr-2" />
              Course Tasks
            </h2>
            
            <TaskManager 
              ref={taskManagerRef}
              courseId={isEditing ? courseId : null} 
              initialTasks={courseData?.subtasks || []} 
              isEditing={isEditing}
              showTitle={false}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Course'}
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => navigate('/courses')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isEditing ? 'Update Course' : 'Create Course'}
              </button>
            </div>
          </div>
        </form>

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
                Are you sure you want to delete "<strong>{formData.title}</strong>"? This will permanently remove the course and all its associated data.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span>Delete Course</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}