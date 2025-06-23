import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  Save
} from 'lucide-react';
import { courses } from '../lib/api';

const TASK_STATUSES = [
  { value: 'alpha_review', label: 'Alpha Review', icon: PlayCircle, color: 'text-blue-500' },
  { value: 'beta_review', label: 'Beta Review', icon: AlertTriangle, color: 'text-yellow-500' },
  { value: 'final', label: 'Final (Gold)', icon: CheckCircle, color: 'text-green-500' }
];

const TaskManager = forwardRef(({ courseId, initialTasks = [], isEditing = false, showTitle = true }, ref) => {
  const queryClient = useQueryClient();
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

  // Update tasks when initialTasks changes (for when course data loads)
  useEffect(() => {
    if (initialTasks && initialTasks.length > 0) {
      setTasks(initialTasks.map(task => ({
        id: task.id,
        title: task.title || '',
        status: task.status || 'pending',
        isBlocking: task.is_blocking || false,
        weight: task.weight || 1,
        orderIndex: task.order_index || 0,
        isNew: false
      })));
    }
  }, [initialTasks]);

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: (subtaskData) => courses.createSubtask(courseId, subtaskData),
    onSuccess: () => {
      toast.success('Task created successfully');
      if (courseId) {
        queryClient.invalidateQueries(['course', courseId]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create task');
    }
  });

  // Update subtask mutation
  const updateSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, updateData }) => 
      courses.updateSubtask(courseId, subtaskId, updateData),
    onSuccess: () => {
      toast.success('Task updated successfully');
      if (courseId) {
        queryClient.invalidateQueries(['course', courseId]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update task');
    }
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: (subtaskId) => courses.deleteSubtask(courseId, subtaskId),
    onSuccess: () => {
      toast.success('Task deleted successfully');
      if (courseId) {
        queryClient.invalidateQueries(['course', courseId]);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete task');
    }
  });

  const addTask = () => {
    const newTask = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      status: 'alpha_review',
      isBlocking: false,
      weight: 1,
      orderIndex: tasks.length,
      isNew: true
    };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (index, field, value) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setTasks(updatedTasks);
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
      toast.error('Task title is required');
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
    switch (status) {
      case 'final':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'beta_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
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
            <p className="text-gray-500 dark:text-gray-400">No tasks yet</p>
            <button
              onClick={addTask}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add First Task
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
                        placeholder="Enter task title..."
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
                        {task.status === 'final' ? 'Final (Gold)' : task.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                        title="Save task"
                      >
                        <Save className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => removeTask(index)}
                      disabled={deleteSubtaskMutation.isPending}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-red-600 bg-red-100 hover:bg-red-200 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30 disabled:opacity-50"
                      title="Delete task"
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