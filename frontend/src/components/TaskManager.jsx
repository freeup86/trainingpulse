import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Circle, 
  CheckCircle, 
  PlayCircle, 
  Pause,
  AlertTriangle,
  Save,
  Edit
} from 'lucide-react';
import { courses, phaseStatuses } from '../lib/api';

const TaskManager = forwardRef(({ courseId, initialTasks = [], isEditing = false, showTitle = true }, ref) => {
  const queryClient = useQueryClient();
  
  // Fetch phase statuses from database
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

  // Convert database statuses to the format expected by the component
  const TASK_STATUSES = phaseStatusesData ? phaseStatusesData
    .filter(status => status.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(status => ({
      value: status.value,
      label: status.label,
      icon: PlayCircle, // For now, keep using PlayCircle for all
      color: status.color
    })) : [
    // Fallback to hardcoded statuses if database is unavailable
    { value: 'alpha_review', label: 'Alpha Review', icon: PlayCircle, color: 'text-blue-500' },
    { value: 'beta_review', label: 'Beta Review', icon: PlayCircle, color: 'text-orange-500' },
    { value: 'final_revision', label: 'Final (Gold)', icon: PlayCircle, color: 'text-yellow-600' },
    { value: 'final_signoff_received', label: 'Final Signoff Received', icon: PlayCircle, color: 'text-green-600' }
  ];
  const [tasks, setTasks] = useState(
    (initialTasks || []).map(task => ({
      id: task.id,
      title: task.title || '',
      status: task.status || 'pending',
      isBlocking: task.is_blocking || false,
      weight: task.weight || 1,
      orderIndex: task.order_index || 0,
      isNew: false
    }))
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [autoSaveTimeouts, setAutoSaveTimeouts] = useState({});
  const [pendingUpdates, setPendingUpdates] = useState({});

  // Update tasks when initialTasks changes (for when course data loads)
  // Respect pending updates to prevent flicker
  useEffect(() => {
    if (initialTasks && initialTasks.length > 0) {
      setTasks(prevTasks => {
        // If we have no tasks yet, initialize from server data
        if (prevTasks.length === 0) {
          return initialTasks.map(task => ({
            id: task.id,
            title: task.title || '',
            status: task.status || 'pending',
            isBlocking: task.is_blocking || false,
            weight: task.weight || 1,
            orderIndex: task.order_index || 0,
            isNew: false
          }));
        }
        
        // Otherwise, merge server data with local changes, respecting pending updates
        return initialTasks.map(serverTask => {
          const existingTask = prevTasks.find(t => t.id === serverTask.id);
          const hasPendingUpdate = pendingUpdates[serverTask.id];
          
          if (existingTask && hasPendingUpdate) {
            // Keep local state for tasks with pending updates
            return existingTask;
          }
          
          // Update from server for tasks without pending updates
          return existingTask ? {
            ...existingTask,
            status: serverTask.status || 'pending',
            title: serverTask.title || existingTask.title,
            isBlocking: serverTask.is_blocking || false,
            weight: serverTask.weight || 1,
            orderIndex: serverTask.order_index || 0,
          } : {
            id: serverTask.id,
            title: serverTask.title || '',
            status: serverTask.status || 'pending',
            isBlocking: serverTask.is_blocking || false,
            weight: serverTask.weight || 1,
            orderIndex: serverTask.order_index || 0,
            isNew: false
          };
        });
      });
    }
  }, [initialTasks, pendingUpdates]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(autoSaveTimeouts).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
    };
  }, [autoSaveTimeouts]);

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: (subtaskData) => courses.createSubtask(courseId, subtaskData),
    onSuccess: () => {
      toast.success('Phase created successfully');
      if (courseId) {
        queryClient.invalidateQueries(['course', courseId]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create phase');
    }
  });

  // Update subtask mutation
  const updateSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, updateData }) => 
      courses.updateSubtask(courseId, subtaskId, updateData),
    onMutate: async ({ subtaskId, updateData }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(['course', courseId]);
      
      // Snapshot the previous value for rollback
      const previousCourse = queryClient.getQueryData(['course', courseId]);
      
      // Optimistically update the cache
      queryClient.setQueryData(['course', courseId], (old) => {
        if (!old || !old.data) return old;
        
        const updatedSubtasks = old.data.subtasks?.map(subtask => 
          subtask.id === subtaskId 
            ? { ...subtask, ...updateData }
            : subtask
        ) || [];
        
        return {
          ...old,
          data: {
            ...old.data,
            subtasks: updatedSubtasks
          }
        };
      });
      
      return { previousCourse };
    },
    onSuccess: (data, variables) => {
      // Show different messages for status vs other updates
      if (variables.updateData.status && Object.keys(variables.updateData).length === 1) {
        toast.success('Phase status updated successfully');
      } else {
        toast.success('Phase updated successfully');
      }
    },
    onError: (error, variables, context) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update phase');
      
      // Revert the optimistic update on error
      if (context?.previousCourse) {
        queryClient.setQueryData(['course', courseId], context.previousCourse);
      }
    },
    onSettled: (data, error, variables) => {
      // Clear pending update for this task
      setPendingUpdates(prev => {
        const newPending = { ...prev };
        delete newPending[variables.subtaskId];
        return newPending;
      });
      
      // Always refetch after mutation to ensure data consistency
      queryClient.invalidateQueries(['course', courseId]);
    }
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: (subtaskId) => courses.deleteSubtask(courseId, subtaskId),
    onSuccess: () => {
      toast.success('Phase deleted successfully');
      if (courseId) {
        queryClient.invalidateQueries(['course', courseId]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete phase');
    }
  });

  const addTask = () => {
    // Find the default status from database, fallback to first available or 'alpha_review'
    const defaultStatus = phaseStatusesData?.find(s => s.isDefault)?.value || 
                         TASK_STATUSES[0]?.value || 
                         'alpha_review';
    
    const newTask = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      status: defaultStatus,
      isBlocking: false,
      weight: 1,
      orderIndex: tasks.length,
      isNew: true
    };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (index, field, value) => {
    const updatedTasks = [...tasks];
    const currentTask = updatedTasks[index];
    
    // Check for warning when changing status to "No Status"
    if (field === 'status' && courseId && !currentTask.isNew) {
      const statusesWithDates = [
        'alpha_draft', 'alpha_review', 
        'beta_revision', 'beta_review', 
        'final_revision', 'final_signoff_sent', 'final_signoff_received'
      ];
      const isChangingToNoStatus = value === '';
      const currentHasDates = statusesWithDates.includes(currentTask.status);
      
      if (isChangingToNoStatus && currentHasDates) {
        const confirmed = window.confirm(
          `Warning: Changing from "${currentTask.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}" to "No Status" will clear ALL phase dates including:\n\n• All start dates (Alpha Draft, Alpha Review, Beta Revision, Beta Review, Final, Final Signoff Sent, Final Signoff Received)\n• All end dates (where applicable)\n• All completion dates\n• Basic task dates (start, finish, completed)\n\nThis action cannot be undone. Do you want to continue?`
        );
        
        if (!confirmed) {
          return; // Don't update if user cancels
        }
      }
    }
    
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setTasks(updatedTasks);
    
    // Auto-save status changes for existing tasks (with debouncing)
    if (field === 'status' && courseId && !updatedTasks[index].isNew) {
      const taskId = updatedTasks[index].id;
      
      // Clear existing timeout for this task
      if (autoSaveTimeouts[taskId]) {
        clearTimeout(autoSaveTimeouts[taskId]);
      }
      
      // Set new timeout for auto-save
      const timeoutId = setTimeout(() => {
        // Track that this task has a pending update
        setPendingUpdates(prev => ({ ...prev, [taskId]: value }));
        autoSaveStatus(updatedTasks[index], value);
        setAutoSaveTimeouts(prev => {
          const newTimeouts = { ...prev };
          delete newTimeouts[taskId];
          return newTimeouts;
        });
      }, 300); // 300ms debounce
      
      setAutoSaveTimeouts(prev => ({
        ...prev,
        [taskId]: timeoutId
      }));
    }
  };

  const autoSaveStatus = async (task, newStatus) => {
    try {
      await updateSubtaskMutation.mutateAsync({
        subtaskId: task.id,
        updateData: { 
          title: task.title,
          status: newStatus,
          isBlocking: task.isBlocking,
          weight: task.weight,
          orderIndex: task.orderIndex
        }
      });
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const removeTask = async (index) => {
    const task = tasks[index];
    
    if (task.isNew || !courseId) {
      // Remove from local state only
      const updatedTasks = tasks.filter((_, i) => i !== index);
      setTasks(updatedTasks);
    } else {
      // Delete from backend
      try {
        await deleteSubtaskMutation.mutateAsync(task.id);
        const updatedTasks = tasks.filter((_, i) => i !== index);
        setTasks(updatedTasks);
      } catch (error) {
        // Error is handled by the mutation
      }
    }
  };

  const saveTask = async (index) => {
    const task = tasks[index];
    
    if (!task.title.trim()) {
      toast.error('Phase title is required');
      return;
    }

    if (!courseId) {
      // For course creation, just update local state
      updateTask(index, 'isNew', false);
      return;
    }

    try {
      if (task.isNew) {
        // Create new task
        const taskData = {
          title: task.title,
          status: task.status,
          isBlocking: task.isBlocking,
          weight: task.weight,
          orderIndex: task.orderIndex
        };
        
        const response = await createSubtaskMutation.mutateAsync(taskData);
        
        // Update local state with the created task
        const updatedTasks = [...tasks];
        updatedTasks[index] = {
          ...task,
          id: response.data?.id || response.id,
          isNew: false
        };
        setTasks(updatedTasks);
      } else {
        // Update existing task
        const updateData = {
          title: task.title,
          status: task.status,
          isBlocking: task.isBlocking,
          weight: task.weight,
          orderIndex: task.orderIndex
        };
        
        await updateSubtaskMutation.mutateAsync({
          subtaskId: task.id,
          updateData
        });
      }
    } catch (error) {
      // Error is handled by the mutations
    }
  };

  const getStatusIcon = (status) => {
    const statusConfig = TASK_STATUSES.find(s => s.value === status);
    if (!statusConfig) return Circle;
    return statusConfig.icon;
  };

  const getStatusColor = (status) => {
    const statusConfig = TASK_STATUSES.find(s => s.value === status);
    return statusConfig?.color || 'text-gray-400';
  };

  const getStatusBadgeColor = (status) => {
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
    
    // Fallback for hardcoded statuses or unknown statuses
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

  // Return tasks data for parent components
  const getTasksData = () => {
    return tasks.filter(task => task.title.trim()).map(task => ({
      id: task.isNew ? undefined : task.id,
      title: task.title,
      status: task.status,
      isBlocking: task.isBlocking,
      weight: task.weight,
      orderIndex: task.orderIndex
    }));
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    getTasksData
  }));

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Phases of Development</h3>
          <button
            onClick={addTask}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Phase
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="flex flex-col items-center space-y-2">
            <Circle className="h-8 w-8 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">No phases yet</p>
            <button
              onClick={addTask}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add First Phase
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, index) => {
            const StatusIcon = getStatusIcon(task.status);
            
            return (
              <div 
                key={`${task.id}-${index}`}
                className="border rounded-lg p-4 space-y-3 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              >
                {/* Task Header */}
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <StatusIcon className={`h-5 w-5 ${getStatusColor(task.status)}`} />
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    {/* Title Input */}
                    <div>
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => updateTask(index, 'title', e.target.value)}
                        placeholder="Enter phase title..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    {/* Task Properties */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Status */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Status
                        </label>
                        <select
                          value={task.status}
                          onChange={(e) => updateTask(index, 'status', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          {TASK_STATUSES.map(status => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </div>


                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(task.status)}`}>
                        {task.status === 'final_revision' ? 'Final (Gold)' : task.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col space-y-2">
                    {courseId && (
                      <button
                        onClick={() => saveTask(index)}
                        disabled={createSubtaskMutation.isPending || updateSubtaskMutation.isPending}
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-600 bg-green-100 hover:bg-green-200 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/30 disabled:opacity-50"
                        title="Save phase"
                      >
                        <Save className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => removeTask(index)}
                      disabled={deleteSubtaskMutation.isPending}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-red-600 bg-red-100 hover:bg-red-200 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 disabled:opacity-50"
                      title="Delete phase"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!showTitle && (
        <div className="flex justify-end">
          <button
            onClick={addTask}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Phase
          </button>
        </div>
      )}
    </div>
  );
});

TaskManager.displayName = 'TaskManager';

export default TaskManager;