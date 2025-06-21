import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Save, Users, UserCheck, Building, Trash2 } from 'lucide-react';
import { teams, users } from '../lib/api';

export default function TeamForm({ teamId = null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(teamId);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    managerId: '',
    active: true
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch team data if editing
  const { data: teamData } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teams.getById(teamId),
    enabled: isEditing
  });

  // Fetch users for manager selection
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => users.getAll({ limit: 100 })
  });

  // Populate form when editing
  useEffect(() => {
    if (teamData?.data?.data) {
      const team = teamData.data.data;
      setFormData({
        name: team.name || '',
        description: team.description || '',
        managerId: team.manager_id || '',
        active: team.active !== false
      });
    }
  }, [teamData]);

  // Create team mutation
  const createMutation = useMutation({
    mutationFn: (teamData) => teams.create(teamData),
    onSuccess: () => {
      toast.success('Team created successfully!');
      queryClient.invalidateQueries(['teams']);
      navigate('/teams');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create team');
    }
  });

  // Update team mutation
  const updateMutation = useMutation({
    mutationFn: (teamData) => teams.update(teamId, teamData),
    onSuccess: () => {
      toast.success('Team updated successfully!');
      queryClient.invalidateQueries(['teams']);
      queryClient.invalidateQueries(['team', teamId]);
      navigate('/teams');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update team');
    }
  });

  // Delete team mutation
  const deleteMutation = useMutation({
    mutationFn: () => teams.delete(teamId),
    onSuccess: () => {
      toast.success('Team deleted successfully!');
      queryClient.invalidateQueries(['teams']);
      navigate('/teams');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete team');
    }
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    const submitData = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      managerId: formData.managerId || null,
      active: formData.active
    };

    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteConfirm(false);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // Filter managers and admins for manager selection
  const managementUsers = usersData?.data?.data?.users?.filter(user => 
    ['admin', 'manager'].includes(user.role) && user.active
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => navigate('/teams')}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Teams
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Team' : 'Create New Team'}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {isEditing ? 'Update team details and settings' : 'Create a new team and assign a manager'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Team Information</h2>
            
            <div className="space-y-6">
              {/* Team Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Building className="inline h-4 w-4 mr-1" />
                  Team Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter team name..."
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Describe the team's purpose and responsibilities..."
                />
              </div>

              {/* Manager Selection */}
              <div>
                <label htmlFor="managerId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <UserCheck className="inline h-4 w-4 mr-1" />
                  Team Manager
                </label>
                <select
                  id="managerId"
                  value={formData.managerId}
                  onChange={(e) => handleInputChange('managerId', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a manager (optional)</option>
                  {managementUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email}) - {user.role}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Only users with admin or manager roles can be selected as team managers
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900 dark:text-white">
                  Team is active
                </label>
                <p className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  Inactive teams won't appear in assignments and workflows
                </p>
              </div>
            </div>
          </div>

          {/* Team Preview */}
          {formData.name && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Preview</h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">{formData.name}</h4>
                      {formData.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formData.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!formData.active && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        Inactive
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      {managementUsers.find(u => u.id == formData.managerId)?.name || 'No Manager'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Team
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => navigate('/teams')}
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
                {isEditing ? 'Update Team' : 'Create Team'}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setShowDeleteConfirm(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Delete Team
                </h3>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">
                      Are you sure you want to delete this team?
                    </h4>
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  This action cannot be undone. The team "{formData.name}" and all its associated data will be permanently deleted.
                </p>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                  <div className="flex">
                    <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        Make sure all team members are reassigned before deleting this team.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Team'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}