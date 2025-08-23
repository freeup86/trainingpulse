import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  Calendar,
  Timer,
  Plus,
  Edit,
  Trash2,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { timeTracking } from '../lib/api';
import { formatDate } from '../lib/utils';

// Time Tracker Widget Component
export const TimeTrackerWidget = ({ taskId, courseId, className = '' }) => {
  const queryClient = useQueryClient();
  const [isTracking, setIsTracking] = useState(false);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [description, setDescription] = useState('');

  // Get active time entry
  const { data: activeEntries } = useQuery({
    queryKey: ['time-entries', 'active'],
    queryFn: () => timeTracking.getEntries({ end_time: null }),
    refetchInterval: 5000,
  });

  // Start tracking mutation
  const startTrackingMutation = useMutation({
    mutationFn: timeTracking.start,
    onSuccess: (data) => {
      setCurrentEntry(data.data);
      setIsTracking(true);
      queryClient.invalidateQueries(['time-entries']);
      toast.success('Time tracking started');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to start tracking');
    },
  });

  // Stop tracking mutation
  const stopTrackingMutation = useMutation({
    mutationFn: timeTracking.stop,
    onSuccess: () => {
      setCurrentEntry(null);
      setIsTracking(false);
      setElapsedTime(0);
      setDescription('');
      queryClient.invalidateQueries(['time-entries']);
      toast.success('Time tracking stopped');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to stop tracking');
    },
  });

  // Update timer display
  useEffect(() => {
    let interval;
    if (isTracking && currentEntry) {
      interval = setInterval(() => {
        const start = new Date(currentEntry.start_time);
        const now = new Date();
        const elapsed = Math.floor((now - start) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, currentEntry]);

  // Check for active entries on mount
  useEffect(() => {
    if (activeEntries?.data && Array.isArray(activeEntries.data)) {
      const active = activeEntries.data.find(entry => !entry.end_time);
      if (active) {
        setCurrentEntry(active);
        setIsTracking(true);
        const start = new Date(active.start_time);
        const now = new Date();
        setElapsedTime(Math.floor((now - start) / 1000));
      }
    }
  }, [activeEntries]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    startTrackingMutation.mutate({
      task_id: taskId,
      course_id: courseId,
      description
    });
  };

  const handleStop = () => {
    if (currentEntry) {
      stopTrackingMutation.mutate(currentEntry.id);
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Timer className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium text-gray-900 dark:text-white">Time Tracker</h3>
        </div>
        {isTracking && (
          <div className="flex items-center space-x-1 text-red-600">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Recording</span>
          </div>
        )}
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
          {formatTime(elapsedTime)}
        </div>
        {currentEntry && currentEntry.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {currentEntry.description}
          </p>
        )}
      </div>

      {/* Description Input */}
      {!isTracking && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center space-x-2">
        {!isTracking ? (
          <button
            onClick={handleStart}
            disabled={startTrackingMutation.isPending}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>{startTrackingMutation.isPending ? 'Starting...' : 'Start'}</span>
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={stopTrackingMutation.isPending}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Square className="w-4 h-4" />
            <span>{stopTrackingMutation.isPending ? 'Stopping...' : 'Stop'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

// Time Entries List Component
export const TimeEntriesList = ({ userId, taskId, courseId, className = '' }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch time entries
  const { data: entriesData, isLoading } = useQuery({
    queryKey: ['time-entries', { userId, taskId, courseId }],
    queryFn: () => {
      if (userId) return timeTracking.getByUser(userId);
      if (taskId) return timeTracking.getByTask(taskId);
      return timeTracking.getEntries({ course_id: courseId });
    },
  });

  const entries = entriesData?.data || [];

  const getTotalTime = () => {
    return entries.reduce((total, entry) => total + (entry.duration || 0), 0);
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Time Entries</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total: {formatDuration(getTotalTime())}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {entries.length === 0 ? (
          <div className="p-6 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No time entries yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start tracking time to see entries here
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <TimeEntryRow key={entry.id} entry={entry} />
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateTimeEntryModal
          onClose={() => setShowCreateModal(false)}
          taskId={taskId}
          courseId={courseId}
        />
      )}
    </div>
  );
};

// Time Entry Row Component
const TimeEntryRow = ({ entry }) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => timeTracking.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['time-entries']);
      setIsEditing(false);
      toast.success('Time entry updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: timeTracking.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['time-entries']);
      toast.success('Time entry deleted');
    },
  });

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleDelete = () => {
    if (window.confirm('Delete this time entry?')) {
      deleteMutation.mutate(entry.id);
    }
  };

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatDate(entry.start_time)}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDuration(entry.duration || 0)}
              </span>
            </div>
            {entry.is_billable && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Billable
              </span>
            )}
          </div>
          {entry.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {entry.description}
            </p>
          )}
          {entry.task_name && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Task: {entry.task_name}
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Create Time Entry Modal
const CreateTimeEntryModal = ({ onClose, taskId, courseId }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    start_time: '',
    end_time: '',
    description: '',
    is_billable: false,
    tags: []
  });

  const createMutation = useMutation({
    mutationFn: timeTracking.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['time-entries']);
      onClose();
      toast.success('Time entry created');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create time entry');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      task_id: taskId,
      course_id: courseId
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Add Time Entry
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Time
            </label>
            <input
              type="datetime-local"
              required
              value={formData.start_time}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Time
            </label>
            <input
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="billable"
              checked={formData.is_billable}
              onChange={(e) => setFormData(prev => ({ ...prev, is_billable: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="billable" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Billable time
            </label>
          </div>
          
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

