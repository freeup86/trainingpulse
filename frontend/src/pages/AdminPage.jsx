import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  X,
  Shield,
  Settings,
  Tag,
  CheckCircle,
  Circle,
  Pause,
  AlertTriangle,
  Users,
  User,
  Mail,
  Eye,
  EyeOff,
  Lock,
  UserCheck,
  ListTodo
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { statuses, users, roles, permissions, phaseStatuses } from '../lib/api';

// Status icons mapping
const STATUS_ICONS = {
  'active': CheckCircle,
  'inactive': Circle,
  'on_hold': Pause,
  'cancelled': X,
  'completed': CheckCircle
};

// Status colors mapping  
const STATUS_COLORS = {
  'active': 'text-green-500 dark:text-green-400',
  'inactive': 'text-gray-500 dark:text-gray-400', 
  'on_hold': 'text-yellow-500 dark:text-yellow-400',
  'cancelled': 'text-red-500 dark:text-red-400',
  'completed': 'text-blue-500 dark:text-blue-400'
};


export default function AdminPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  
  // Tab management - use a simple default initially
  const [activeTab, setActiveTab] = useState('statuses');
  
  // Update active tab when permissions load
  useEffect(() => {
    if (can.manageSettings) {
      setActiveTab('statuses');
    } else if (can.viewUsers) {
      setActiveTab('users');
    } else if (can.manageRoles || can.managePermissions) {
      setActiveTab('roles');
    }
  }, [can.manageSettings, can.viewUsers, can.manageRoles, can.managePermissions]);
  
  // Status management state
  const [editingStatus, setEditingStatus] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    value: '',
    label: '',
    icon: 'Circle',
    color: 'text-gray-500 dark:text-gray-400'
  });
  
  // User management state
  const [editingUser, setEditingUser] = useState(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: 'designer',
    password: '',
    isActive: true
  });
  const [showPassword, setShowPassword] = useState(false);

  // Phase status management state
  const [editingPhaseStatus, setEditingPhaseStatus] = useState(null);
  const [isCreatingPhaseStatus, setIsCreatingPhaseStatus] = useState(false);
  const [phaseStatusFormData, setPhaseStatusFormData] = useState({
    value: '',
    label: '',
    description: '',
    color: 'text-blue-500',
    darkColor: 'dark:text-blue-400',
    icon: 'PlayCircle',
    sortOrder: 1,
    isActive: true,
    isDefault: false,
    completionPercentage: 0
  });

  // Fetch statuses (always call hooks before any returns)
  const { data: statusesData, isLoading, error } = useQuery({
    queryKey: ['admin-statuses'],
    queryFn: async () => {
      const response = await statuses.getAll();
      return response.data;
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (statusData) => {
      const response = await statuses.create(statusData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-statuses']);
      toast.success('Status created successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create status: ' + (error.response?.data?.message || error.message));
    }
  });

  // Update mutation  
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await statuses.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-statuses']);
      toast.success('Status updated successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + (error.response?.data?.message || error.message));
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await statuses.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-statuses']);
      toast.success('Status deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete status: ' + (error.response?.data?.message || error.message));
    }
  });

  // Phase Status queries and mutations
  const { data: phaseStatusesData, isLoading: phaseStatusesLoading, error: phaseStatusesError } = useQuery({
    queryKey: ['admin-phase-statuses'],
    queryFn: async () => {
      const response = await phaseStatuses.getAll({ includeInactive: 'true' });
      return response.data.data; // Extract the actual array from {success: true, data: [...]}
    }
  });

  const createPhaseStatusMutation = useMutation({
    mutationFn: async (statusData) => {
      const response = await phaseStatuses.create(statusData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-phase-statuses']);
      toast.success('Phase status created successfully');
      resetPhaseStatusForm();
    },
    onError: (error) => {
      toast.error('Failed to create phase status: ' + (error.response?.data?.message || error.message));
    }
  });

  const updatePhaseStatusMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await phaseStatuses.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-phase-statuses']);
      toast.success('Phase status updated successfully');
      resetPhaseStatusForm();
    },
    onError: (error) => {
      toast.error('Failed to update phase status: ' + (error.response?.data?.message || error.message));
    }
  });

  const deletePhaseStatusMutation = useMutation({
    mutationFn: async (id) => {
      const response = await phaseStatuses.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-phase-statuses']);
      toast.success('Phase status deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete phase status: ' + (error.response?.data?.message || error.message));
    }
  });

  const resetForm = () => {
    setFormData({
      value: '',
      label: '',
      icon: 'Circle',
      color: 'text-gray-500 dark:text-gray-400'
    });
    setEditingStatus(null);
    setIsCreating(false);
  };

  const resetPhaseStatusForm = () => {
    setPhaseStatusFormData({
      value: '',
      label: '',
      description: '',
      color: 'text-blue-500',
      darkColor: 'dark:text-blue-400',
      icon: 'PlayCircle',
      sortOrder: 1,
      isActive: true,
      isDefault: false,
      completionPercentage: 0
    });
    setEditingPhaseStatus(null);
    setIsCreatingPhaseStatus(false);
  };

  // Fetch users
  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await users.getAll();
      return response.data;
    }
  });

  // User mutations
  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await users.create(userData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('User created successfully');
      resetUserForm();
    },
    onError: (error) => {
      console.error('Create user error:', error.response?.data);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.response?.data?.errors?.join(', ') ||
                          error.message;
      toast.error('Failed to create user: ' + errorMessage);
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const response = await users.update(id, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('User updated successfully');
      resetUserForm();
    },
    onError: (error) => {
      toast.error('Failed to update user: ' + (error.response?.data?.message || error.message));
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id) => {
      const response = await users.deactivate(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('User deactivated successfully');
    },
    onError: (error) => {
      toast.error('Failed to deactivate user: ' + (error.response?.data?.message || error.message));
    }
  });

  const resetUserForm = () => {
    setUserFormData({
      name: '',
      email: '',
      role: 'designer',
      password: '',
      isActive: true
    });
    setEditingUser(null);
    setIsCreatingUser(false);
    setShowPassword(false);
  };

  const handleEditUser = (userData) => {
    setEditingUser(userData.id);
    setUserFormData({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      password: '', // Don't populate password for security
      isActive: userData.isActive !== false
    });
    setIsCreatingUser(false);
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('[data-user-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      role: 'designer',
      password: '',
      isActive: true
    });
    setIsCreatingUser(true);
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('[data-user-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleUserSubmit = (e) => {
    e.preventDefault();
    
    if (!userFormData.name || !userFormData.email) {
      toast.error('Name and email are required');
      return;
    }

    if (isCreatingUser && !userFormData.password) {
      toast.error('Password is required for new users');
      return;
    }

    const submitData = { ...userFormData };
    
    // Remove password if it's empty (for updates)
    if (!submitData.password) {
      delete submitData.password;
    }

    console.log('Submitting user data:', submitData);

    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser, updates: submitData });
    } else {
      createUserMutation.mutate(submitData);
    }
  };

  const handleEdit = (status) => {
    setEditingStatus(status.id);
    setFormData({
      value: status.value,
      label: status.label,
      icon: status.icon,
      color: status.color
    });
    setIsCreating(false);
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('[data-status-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCreate = () => {
    setEditingStatus(null);
    setFormData({
      value: '',
      label: '',
      icon: 'Circle',
      color: 'text-gray-500 dark:text-gray-400'
    });
    setIsCreating(true);
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('[data-status-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.value || !formData.label) {
      toast.error('Value and Label are required');
      return;
    }

    if (editingStatus) {
      updateMutation.mutate({ id: editingStatus, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (status) => {
    if (window.confirm(`Are you sure you want to delete the "${status.label}" status? This action cannot be undone.`)) {
      deleteMutation.mutate(status.id);
    }
  };

  // Phase Status Handler Functions
  const handleEditPhaseStatus = (phaseStatus) => {
    setPhaseStatusFormData({
      value: phaseStatus.value,
      label: phaseStatus.label,
      description: phaseStatus.description || '',
      color: phaseStatus.color,
      darkColor: phaseStatus.darkColor || '',
      icon: phaseStatus.icon,
      sortOrder: phaseStatus.sortOrder,
      isActive: phaseStatus.isActive,
      isDefault: phaseStatus.isDefault,
      completionPercentage: phaseStatus.completionPercentage || 0
    });
    setEditingPhaseStatus(phaseStatus);
    setIsCreatingPhaseStatus(false);
    // Scroll to form
    setTimeout(() => {
      document.getElementById('phase-status-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleCreatePhaseStatus = () => {
    resetPhaseStatusForm();
    setIsCreatingPhaseStatus(true);
    // Scroll to form
    setTimeout(() => {
      document.getElementById('phase-status-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handlePhaseStatusSubmit = (e) => {
    e.preventDefault();
    
    if (!phaseStatusFormData.value.trim() || !phaseStatusFormData.label.trim()) {
      toast.error('Value and label are required');
      return;
    }

    if (editingPhaseStatus) {
      updatePhaseStatusMutation.mutate({ id: editingPhaseStatus.id, data: phaseStatusFormData });
    } else {
      createPhaseStatusMutation.mutate(phaseStatusFormData);
    }
  };

  const handleDeletePhaseStatus = (phaseStatus) => {
    if (window.confirm(`Are you sure you want to delete the "${phaseStatus.label}" phase status?`)) {
      deletePhaseStatusMutation.mutate(phaseStatus.id);
    }
  };

  const isLoading_mutations = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending ||
    createPhaseStatusMutation.isPending || updatePhaseStatusMutation.isPending || deletePhaseStatusMutation.isPending;

  // Check if user has admin access (after all hooks)
  const hasAdminAccess = can.manageSettings || can.manageRoles || can.managePermissions || can.viewUsers;
  
  if (!user || !hasAdminAccess) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <Shield className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Access Denied
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                You don't have permission to access admin settings.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                Error loading admin data
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error.message || 'Failed to load admin settings. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusesList = statusesData?.data || statusesData || [];
  const usersList = usersData?.data?.users || usersData?.users || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Settings className="h-8 w-8 mr-3" />
            Admin Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage application settings and configuration
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {can.manageSettings && (
            <button
              onClick={() => setActiveTab('statuses')}
              className={`${
                activeTab === 'statuses'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Tag className="h-4 w-4 mr-2" />
              Course Statuses
            </button>
          )}
          {can.manageSettings && (
            <button
              onClick={() => setActiveTab('phase-statuses')}
              className={`${
                activeTab === 'phase-statuses'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <ListTodo className="h-4 w-4 mr-2" />
              Phase Statuses
            </button>
          )}
          {can.viewUsers && (
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </button>
          )}
          {(can.manageRoles || can.managePermissions) && (
            <button
              onClick={() => setActiveTab('roles')}
              className={`${
                activeTab === 'roles'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Roles & Permissions
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'statuses' && can.manageSettings && (
        /* Course Status Management */
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Tag className="h-5 w-5 mr-2" />
                Course Status Values
              </CardTitle>
              <CardDescription>
                Manage the available status options for courses
              </CardDescription>
            </div>
            <Button onClick={handleCreate} disabled={isLoading_mutations}>
              <Plus className="h-4 w-4 mr-2" />
              Add Status
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create/Edit Form */}
          {(isCreating || editingStatus) && (
            <form onSubmit={handleSubmit} data-status-form className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Value *
                  </label>
                  <input
                    type="text"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., active"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Internal value (lowercase, no spaces)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Label *
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Active"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Display name shown to users</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="CheckCircle">Check Circle</option>
                    <option value="Circle">Circle</option>
                    <option value="Pause">Pause</option>
                    <option value="X">X</option>
                    <option value="AlertTriangle">Alert Triangle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <select
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="text-green-500 dark:text-green-400">Green</option>
                    <option value="text-gray-500 dark:text-gray-400">Gray</option>
                    <option value="text-yellow-500 dark:text-yellow-400">Yellow</option>
                    <option value="text-red-500 dark:text-red-400">Red</option>
                    <option value="text-blue-500 dark:text-blue-400">Blue</option>
                    <option value="text-orange-500 dark:text-orange-400">Orange</option>
                    <option value="text-purple-500 dark:text-purple-400">Purple</option>
                    <option value="text-pink-500 dark:text-pink-400">Pink</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button type="submit" disabled={isLoading_mutations}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingStatus ? 'Update' : 'Create'} Status
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Status List */}
          <div className="space-y-2">
            {statusesList.map((status) => {
              const IconComponent = STATUS_ICONS[status.value] || Circle;
              return (
                <div key={status.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center space-x-3">
                    <IconComponent className={`h-5 w-5 ${status.color}`} />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{status.label}</span>
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({status.value})</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEdit(status)}
                      disabled={isLoading_mutations}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(status)}
                      disabled={isLoading_mutations}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {statusesList.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No status values configured</p>
              <p className="text-sm">Click "Add Status" to create your first status option</p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'users' && can.viewUsers && (
        /* User Management */
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage user accounts and permissions
                </CardDescription>
              </div>
              {can.createUsers && (
                <Button onClick={handleCreateUser} disabled={usersLoading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {/* Loading State */}
            {usersLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* Error State */}
            {usersError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Error loading users
                    </h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      {usersError.message || 'Failed to load users. Please try again.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User Form */}
            {!usersLoading && !usersError && (isCreatingUser || editingUser) && (can.createUsers || can.updateUsers) && (
              <form onSubmit={handleUserSubmit} data-user-form className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={userFormData.name}
                      onChange={(e) => setUserFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email * {!isCreatingUser && <span className="text-xs text-gray-500 dark:text-gray-400">(cannot be changed)</span>}
                    </label>
                    <input
                      type="email"
                      value={userFormData.email}
                      onChange={(e) => {
                        // Only allow email changes when creating a new user
                        if (isCreatingUser) {
                          setUserFormData(prev => ({ ...prev, email: e.target.value }));
                        }
                      }}
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white ${
                        !isCreatingUser ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : 'bg-white dark:bg-gray-700'
                      }`}
                      readOnly={!isCreatingUser}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role
                    </label>
                    <select
                      value={userFormData.role}
                      onChange={(e) => setUserFormData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="designer">Designer</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="sme">Subject Matter Expert</option>
                      <option value="instructor">Instructor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password {isCreatingUser ? '*' : '(leave blank to keep current)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={userFormData.password}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required={isCreatingUser}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={userFormData.isActive}
                      onChange={(e) => setUserFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Active User
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetUserForm}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createUserMutation.isLoading || updateUserMutation.isLoading}
                  >
                    {createUserMutation.isLoading || updateUserMutation.isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isCreatingUser ? 'Create User' : 'Update User'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* Users List */}
            {!usersLoading && !usersError && (
              <div className="space-y-3">
                {Array.isArray(usersList) && usersList.map((userData) => (
                <div key={userData.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <User className="h-10 w-10 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {userData.name}
                      </h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                        <Mail className="h-4 w-4" />
                        <span>{userData.email}</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {userData.role === 'sme' ? 'SME' : userData.role.charAt(0).toUpperCase() + userData.role.slice(1)}
                        </span>
                        {userData.isActive === false && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(userData)}
                      disabled={editingUser === userData.id}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to deactivate this user?')) {
                          deleteUserMutation.mutate(userData.id);
                        }
                      }}
                      disabled={deleteUserMutation.isLoading}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            )}

            {!usersLoading && !usersError && usersList.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users found</p>
                <p className="text-sm">Click "Add User" to create your first user account</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'phase-statuses' && can.manageSettings && (
        /* Phase Status Management */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ListTodo className="h-5 w-5 mr-2" />
              Phase Status Management
            </CardTitle>
            <CardDescription>
              Configure phase statuses for course development phases. These statuses control the workflow progression of individual phases.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phaseStatusesError ? (
              <div className="text-red-500">
                Error loading phase statuses: {phaseStatusesError.message}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Create/Edit Form - Only show when creating or editing */}
                {(isCreatingPhaseStatus || editingPhaseStatus) && (
                  <div id="phase-status-form" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
                    {isCreatingPhaseStatus ? 'Create New' : editingPhaseStatus ? 'Edit' : 'Create'} Phase Status
                  </h3>
                  <form onSubmit={handlePhaseStatusSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Value *
                        </label>
                        <input
                          type="text"
                          value={phaseStatusFormData.value}
                          onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, value: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., alpha_review"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Label *
                        </label>
                        <input
                          type="text"
                          value={phaseStatusFormData.label}
                          onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, label: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., Alpha Review"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={phaseStatusFormData.description}
                        onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Optional description of this phase status"
                        rows="2"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Color *
                        </label>
                        <input
                          type="text"
                          value={phaseStatusFormData.color}
                          onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, color: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., text-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Dark Color
                        </label>
                        <input
                          type="text"
                          value={phaseStatusFormData.darkColor}
                          onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, darkColor: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., dark:text-blue-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Icon
                        </label>
                        <input
                          type="text"
                          value={phaseStatusFormData.icon}
                          onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, icon: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., PlayCircle"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Sort Order
                        </label>
                        <input
                          type="number"
                          value={phaseStatusFormData.sortOrder}
                          onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 1 }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Completion %
                        </label>
                        <input
                          type="number"
                          value={phaseStatusFormData.completionPercentage}
                          onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, completionPercentage: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          min="0"
                          max="100"
                          placeholder="0-100"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={phaseStatusFormData.isActive}
                            onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Active</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={phaseStatusFormData.isDefault}
                            onChange={(e) => setPhaseStatusFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Default</span>
                        </label>
                      </div>

                    <div className="flex space-x-2">
                      <Button
                        type="submit"
                        disabled={createPhaseStatusMutation.isPending || updatePhaseStatusMutation.isPending}
                      >
                        {createPhaseStatusMutation.isPending || updatePhaseStatusMutation.isPending ? 'Saving...' : 
                         editingPhaseStatus ? 'Update Phase Status' : 'Create Phase Status'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetPhaseStatusForm}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                  </div>
                )}

                {/* Phase Status List */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Existing Phase Statuses</h3>
                    <Button onClick={handleCreatePhaseStatus}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Phase Status
                    </Button>
                  </div>

                  {phaseStatusesLoading ? (
                    <div className="text-center py-4 text-gray-600 dark:text-gray-300">Loading phase statuses...</div>
                  ) : phaseStatusesData && phaseStatusesData.length > 0 ? (
                    <div className="space-y-2">
                      {phaseStatusesData
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((phaseStatus) => (
                        <div key={phaseStatus.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className={`h-3 w-3 rounded-full ${phaseStatus.color.replace('text-', 'bg-')}`}></div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900 dark:text-white">{phaseStatus.label}</span>
                                <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">
                                  {phaseStatus.value}
                                </code>
                                {phaseStatus.isDefault && (
                                  <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 px-2 py-1 rounded">
                                    Default
                                  </span>
                                )}
                                {!phaseStatus.isActive && (
                                  <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300 px-2 py-1 rounded">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              {phaseStatus.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {phaseStatus.description}
                                </p>
                              )}
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Order: {phaseStatus.sortOrder} | Icon: {phaseStatus.icon} | Completion: {phaseStatus.completionPercentage || 0}%
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditPhaseStatus(phaseStatus)}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePhaseStatus(phaseStatus)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No phase statuses configured</p>
                      <p className="text-sm">Click "Add Phase Status" to create your first phase status</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'roles' && (can.manageRoles || can.managePermissions) && (
        /* Role & Permissions Management */
        <RolesPermissionsTab />
      )}
    </div>
  );
}

// Roles & Permissions Tab Component
function RolesPermissionsTab() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('roles');
  
  // Role management state
  const [editingRole, setEditingRole] = useState(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: []
  });

  // Permission management state
  const [editingPermission, setEditingPermission] = useState(null);
  const [isCreatingPermission, setIsCreatingPermission] = useState(false);
  const [permissionFormData, setPermissionFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    category: 'general'
  });

  // Fetch roles
  const { data: rolesData, isLoading: rolesLoading, error: rolesError } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const response = await roles.getAll();
      return response.data;
    }
  });

  // Fetch permissions
  const { data: permissionsData, isLoading: permissionsLoading, error: permissionsError } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const response = await permissions.getAll();
      return response.data;
    }
  });

  // Fetch permission categories
  const { data: categoriesData } = useQuery({
    queryKey: ['permission-categories'],
    queryFn: async () => {
      const response = await permissions.getCategories();
      return response.data;
    }
  });

  // Role mutations
  const createRoleMutation = useMutation({
    mutationFn: async (roleData) => {
      const response = await roles.create(roleData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-roles']);
      toast.success('Role created successfully');
      resetRoleForm();
    },
    onError: (error) => {
      toast.error('Failed to create role: ' + (error.response?.data?.error || error.message));
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await roles.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-roles']);
      toast.success('Role updated successfully');
      resetRoleForm();
    },
    onError: (error) => {
      toast.error('Failed to update role: ' + (error.response?.data?.error || error.message));
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id) => {
      const response = await roles.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-roles']);
      toast.success('Role deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete role: ' + (error.response?.data?.error || error.message));
    }
  });

  // Permission mutations
  const createPermissionMutation = useMutation({
    mutationFn: async (permissionData) => {
      const response = await permissions.create(permissionData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-permissions']);
      queryClient.invalidateQueries(['permission-categories']);
      toast.success('Permission created successfully');
      resetPermissionForm();
    },
    onError: (error) => {
      toast.error('Failed to create permission: ' + (error.response?.data?.error || error.message));
    }
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await permissions.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-permissions']);
      queryClient.invalidateQueries(['permission-categories']);
      toast.success('Permission updated successfully');
      resetPermissionForm();
    },
    onError: (error) => {
      toast.error('Failed to update permission: ' + (error.response?.data?.error || error.message));
    }
  });

  const deletePermissionMutation = useMutation({
    mutationFn: async (id) => {
      const response = await permissions.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-permissions']);
      queryClient.invalidateQueries(['permission-categories']);
      toast.success('Permission deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete permission: ' + (error.response?.data?.error || error.message));
    }
  });

  const resetRoleForm = () => {
    setRoleFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: []
    });
    setEditingRole(null);
    setIsCreatingRole(false);
  };

  const resetPermissionForm = () => {
    setPermissionFormData({
      name: '',
      display_name: '',
      description: '',
      category: 'general'
    });
    setEditingPermission(null);
    setIsCreatingPermission(false);
  };

  const handleEditRole = (role) => {
    setEditingRole(role.id);
    setRoleFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions.map(p => p.id)
    });
    setIsCreatingRole(false);
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('[data-role-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: []
    });
    setIsCreatingRole(true);
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('[data-role-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleRoleSubmit = (e) => {
    e.preventDefault();
    
    if (!roleFormData.name || !roleFormData.display_name) {
      toast.error('Name and display name are required');
      return;
    }

    if (editingRole) {
      updateRoleMutation.mutate({ 
        id: editingRole, 
        data: roleFormData 
      });
    } else {
      createRoleMutation.mutate(roleFormData);
    }
  };

  const handleEditPermission = (permission) => {
    setEditingPermission(permission.id);
    setPermissionFormData({
      name: permission.name,
      display_name: permission.display_name,
      description: permission.description || '',
      category: permission.category
    });
    setIsCreatingPermission(false);
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('[data-permission-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCreatePermission = () => {
    setEditingPermission(null);
    setPermissionFormData({
      name: '',
      display_name: '',
      description: '',
      category: 'general'
    });
    setIsCreatingPermission(true);
    
    // Scroll to the form
    setTimeout(() => {
      const formElement = document.querySelector('[data-permission-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handlePermissionSubmit = (e) => {
    e.preventDefault();
    
    if (!permissionFormData.name || !permissionFormData.display_name) {
      toast.error('Name and display name are required');
      return;
    }

    if (editingPermission) {
      updatePermissionMutation.mutate({ 
        id: editingPermission, 
        data: permissionFormData 
      });
    } else {
      createPermissionMutation.mutate(permissionFormData);
    }
  };

  const rolesList = rolesData?.data || rolesData || [];
  const permissionsList = permissionsData?.data || permissionsData || [];
  const categoriesList = categoriesData?.data || categoriesData || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserCheck className="h-5 w-5 mr-2" />
          Roles & Permissions Management
        </CardTitle>
        <CardDescription>
          Manage user roles and their associated permissions
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Sub-tabs - Permissions subtab hidden */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {can.manageRoles && (
              <button
                onClick={() => setActiveSubTab('roles')}
                className={`${
                  activeSubTab === 'roles'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Roles
              </button>
            )}
          </nav>
        </div>

        {/* Roles Tab */}
        {activeSubTab === 'roles' && can.manageRoles && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Roles</h3>
              <Button onClick={handleCreateRole}>
                <Plus className="h-4 w-4 mr-2" />
                Add Role
              </Button>
            </div>

            {/* Role Form */}
            {(isCreatingRole || editingRole) && (
              <form onSubmit={handleRoleSubmit} data-role-form className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={roleFormData.name}
                      onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., content_manager"
                      disabled={!!editingRole}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Internal role name (cannot be changed)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={roleFormData.display_name}
                      onChange={(e) => setRoleFormData(prev => ({ ...prev, display_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Content Manager"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={roleFormData.description}
                      onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Describe this role's responsibilities..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Permissions
                    </label>
                    <div className="max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
                      {/* Group permissions by category */}
                      {categoriesList.map((category) => {
                        const categoryPermissions = permissionsList.filter(p => p.category === category);
                        if (categoryPermissions.length === 0) return null;
                        
                        return (
                          <div key={category} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                            <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm capitalize">
                                {category} Permissions
                              </h4>
                            </div>
                            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {categoryPermissions.map((permission) => (
                                <label key={permission.id} className="flex items-center space-x-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={roleFormData.permissions.includes(permission.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setRoleFormData(prev => ({
                                          ...prev,
                                          permissions: [...prev.permissions, permission.id]
                                        }));
                                      } else {
                                        setRoleFormData(prev => ({
                                          ...prev,
                                          permissions: prev.permissions.filter(id => id !== permission.id)
                                        }));
                                      }
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <span className="text-gray-900 dark:text-white">{permission.display_name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Handle permissions without a category */}
                      {(() => {
                        const uncategorizedPermissions = permissionsList.filter(p => !categoriesList.includes(p.category));
                        if (uncategorizedPermissions.length === 0) return null;
                        
                        return (
                          <div className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                            <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                Other Permissions
                              </h4>
                            </div>
                            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {uncategorizedPermissions.map((permission) => (
                                <label key={permission.id} className="flex items-center space-x-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={roleFormData.permissions.includes(permission.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setRoleFormData(prev => ({
                                          ...prev,
                                          permissions: [...prev.permissions, permission.id]
                                        }));
                                      } else {
                                        setRoleFormData(prev => ({
                                          ...prev,
                                          permissions: prev.permissions.filter(id => id !== permission.id)
                                        }));
                                      }
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <span className="text-gray-900 dark:text-white">{permission.display_name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-4">
                  <Button type="button" variant="outline" onClick={resetRoleForm}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isCreatingRole ? 'Create Role' : 'Update Role'}
                  </Button>
                </div>
              </form>
            )}

            {/* Roles List */}
            {rolesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : rolesError ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <p className="text-red-700 dark:text-red-300">Failed to load roles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rolesList.map((role) => (
                  <div key={role.id} className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{role.display_name}</h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {role.name}
                        </span>
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{role.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((permission) => (
                          <span
                            key={permission.id}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          >
                            {permission.display_name}
                          </span>
                        ))}
                        {role.permissions.length === 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 italic">No permissions assigned</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRole(role)}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete the "${role.display_name}" role?`)) {
                            deleteRoleMutation.mutate(role.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {rolesList.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No roles configured</p>
                    <p className="text-sm">Click "Add Role" to create your first role</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Permissions Tab */}
        {activeSubTab === 'permissions' && can.managePermissions && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Permissions</h3>
              <Button onClick={handleCreatePermission}>
                <Plus className="h-4 w-4 mr-2" />
                Add Permission
              </Button>
            </div>

            {/* Permission Form */}
            {(isCreatingPermission || editingPermission) && (
              <form onSubmit={handlePermissionSubmit} data-permission-form className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={permissionFormData.name}
                      onChange={(e) => setPermissionFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., courses.create"
                      disabled={!!editingPermission}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Internal permission name (cannot be changed)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={permissionFormData.display_name}
                      onChange={(e) => setPermissionFormData(prev => ({ ...prev, display_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Create Courses"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      value={permissionFormData.category}
                      onChange={(e) => setPermissionFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {categoriesList.map((category) => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                      <option value="general">General</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={permissionFormData.description}
                      onChange={(e) => setPermissionFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Describe what this permission allows..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-4">
                  <Button type="button" variant="outline" onClick={resetPermissionForm}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createPermissionMutation.isPending || updatePermissionMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isCreatingPermission ? 'Create Permission' : 'Update Permission'}
                  </Button>
                </div>
              </form>
            )}

            {/* Permissions List */}
            {permissionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : permissionsError ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <p className="text-red-700 dark:text-red-300">Failed to load permissions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Group permissions by category */}
                {categoriesList.map((category) => {
                  const categoryPermissions = permissionsList.filter(p => p.category === category);
                  if (categoryPermissions.length === 0) return null;
                  
                  return (
                    <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                          {category} Permissions
                        </h4>
                      </div>
                      <div className="p-2 space-y-2">
                        {categoryPermissions.map((permission) => (
                          <div key={permission.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className="font-medium text-gray-900 dark:text-white">{permission.display_name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  {permission.name}
                                </span>
                              </div>
                              {permission.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{permission.description}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditPermission(permission)}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete the "${permission.display_name}" permission?`)) {
                                    deletePermissionMutation.mutate(permission.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {permissionsList.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No permissions configured</p>
                    <p className="text-sm">Click "Add Permission" to create your first permission</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}