import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  X, 
  Plus, 
  Search,
  User,
  Crown,
  UserPlus,
  Mail,
  ChevronDown,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { users, courses } from '../lib/api';

// Main Multiple Assignees Component
export const MultipleAssignees = ({ 
  entityType = 'task',
  entityId, 
  currentAssignees = [], 
  onAssigneesChange,
  isReadOnly = false,
  showRoles = true,
  maxAssignees = 10,
  className = '' 
}) => {
  const queryClient = useQueryClient();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Fetch all users
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await users.getAll();
      // Handle different possible response structures
      return response.data?.data?.users || response.data?.users || response.data?.data || response.data || [];
    }
  });

  const usersList = Array.isArray(usersData) ? usersData : [];
  const assignedUserIds = currentAssignees.map(a => a.user_id || a.id);

  // Update assignees mutation
  const updateAssigneesMutation = useMutation({
    mutationFn: (assignees) => {
      if (entityType === 'course') {
        return courses.updateAssignees(entityId, assignees);
      }
      if (entityType === 'task') {
        return courses.updateAssignees(entityId, assignees);
      }
      // Add other entity types as needed
      throw new Error('Unsupported entity type');
    },
    onSuccess: () => {
      queryClient.invalidateQueries([entityType + 's', entityId]);
      toast.success('Assignees updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update assignees');
    },
  });

  // Filter available users
  const availableUsers = usersList.filter(user => 
    !assignedUserIds.includes(user.id) &&
    (user.name || user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle clicking outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddAssignee = (user) => {
    if (currentAssignees.length >= maxAssignees) {
      toast.error(`Maximum ${maxAssignees} assignees allowed`);
      return;
    }

    const newAssignee = {
      user_id: user.id,
      user_name: user.full_name,
      user_email: user.email,
      role: 'assignee',
      assigned_at: new Date().toISOString()
    };

    const updatedAssignees = [...currentAssignees, newAssignee];
    
    if (onAssigneesChange) {
      onAssigneesChange(updatedAssignees);
    }

    if (entityId) {
      updateAssigneesMutation.mutate(updatedAssignees.map(a => ({
        user_id: a.user_id,
        role: a.role
      })));
    }

    setIsDropdownOpen(false);
    setSearchTerm('');
  };

  const handleRemoveAssignee = (userId) => {
    const updatedAssignees = currentAssignees.filter(a => (a.user_id || a.id) !== userId);
    
    if (onAssigneesChange) {
      onAssigneesChange(updatedAssignees);
    }

    if (entityId) {
      updateAssigneesMutation.mutate(updatedAssignees.map(a => ({
        user_id: a.user_id,
        role: a.role
      })));
    }
  };

  const handleRoleChange = (userId, newRole) => {
    const updatedAssignees = currentAssignees.map(assignee => 
      (assignee.user_id || assignee.id) === userId 
        ? { ...assignee, role: newRole }
        : assignee
    );
    
    if (onAssigneesChange) {
      onAssigneesChange(updatedAssignees);
    }

    if (entityId) {
      updateAssigneesMutation.mutate(updatedAssignees.map(a => ({
        user_id: a.user_id,
        role: a.role
      })));
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-3 h-3 text-yellow-600" />;
      case 'reviewer':
        return <Check className="w-3 h-3 text-blue-600" />;
      default:
        return <User className="w-3 h-3 text-gray-600" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reviewer':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Assignees ({currentAssignees.length})
          </h3>
        </div>
        
        {!isReadOnly && currentAssignees.length < maxAssignees && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add</span>
            </button>

            {/* Dropdown */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                {/* Search */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      autoFocus
                    />
                  </div>
                </div>

                {/* User List */}
                <div className="max-h-48 overflow-y-auto">
                  {availableUsers.length === 0 ? (
                    <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                      {searchTerm ? 'No users found' : 'All users are already assigned'}
                    </div>
                  ) : (
                    availableUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleAddAssignee(user)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                      >
                        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.name || user.full_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user.email}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Current Assignees */}
      <div className="space-y-2">
        {currentAssignees.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
            No assignees yet
          </div>
        ) : (
          currentAssignees.map((assignee) => (
            <AssigneeCard
              key={assignee.user_id || assignee.id}
              assignee={assignee}
              onRemove={handleRemoveAssignee}
              onRoleChange={handleRoleChange}
              isReadOnly={isReadOnly}
              showRoles={showRoles}
              getRoleIcon={getRoleIcon}
              getRoleColor={getRoleColor}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Individual Assignee Card
const AssigneeCard = ({ 
  assignee, 
  onRemove, 
  onRoleChange, 
  isReadOnly, 
  showRoles,
  getRoleIcon,
  getRoleColor 
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const roleDropdownRef = useRef(null);

  const roles = [
    { value: 'assignee', label: 'Assignee' },
    { value: 'reviewer', label: 'Reviewer' },
    { value: 'owner', label: 'Owner' }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target)) {
        setShowRoleDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleSelect = (newRole) => {
    onRoleChange(assignee.user_id || assignee.id, newRole);
    setShowRoleDropdown(false);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center space-x-3 flex-1">
        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {assignee.user_name || assignee.name || assignee.full_name}
            </p>
            {showRoles && (
              <div className="relative" ref={roleDropdownRef}>
                <button
                  onClick={() => !isReadOnly && setShowRoleDropdown(!showRoleDropdown)}
                  disabled={isReadOnly}
                  className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(assignee.role)} ${!isReadOnly ? 'hover:opacity-75 cursor-pointer' : 'cursor-default'}`}
                >
                  {getRoleIcon(assignee.role)}
                  <span>{assignee.role || 'assignee'}</span>
                  {!isReadOnly && <ChevronDown className="w-3 h-3" />}
                </button>

                {showRoleDropdown && !isReadOnly && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                    {roles.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => handleRoleSelect(role.value)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 first:rounded-t-lg last:rounded-b-lg ${
                          assignee.role === role.value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {getRoleIcon(role.value)}
                        <span>{role.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {assignee.user_email && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {assignee.user_email}
            </p>
          )}
          {assignee.assigned_at && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Assigned {new Date(assignee.assigned_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {!isReadOnly && (
        <button
          onClick={() => onRemove(assignee.user_id || assignee.id)}
          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Compact Assignees Display (for cards/lists)
export const CompactAssignees = ({ 
  assignees = [], 
  maxVisible = 3, 
  size = 'sm',
  onClick,
  className = '' 
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const visibleAssignees = assignees.slice(0, maxVisible);
  const remainingCount = assignees.length - maxVisible;

  if (assignees.length === 0) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className={`${sizeClasses[size]} bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center`}>
          <Users className={`${iconSizes[size]} text-gray-400`} />
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center space-x-1 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex -space-x-2">
        {visibleAssignees.map((assignee, index) => (
          <div
            key={assignee.user_id || assignee.id || index}
            className={`${sizeClasses[size]} bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900`}
            title={assignee.user_name || assignee.full_name}
          >
            <User className={`${iconSizes[size]} text-gray-600 dark:text-gray-400`} />
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div className={`${sizeClasses[size]} bg-gray-400 dark:bg-gray-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900`}>
            <span className="text-xs font-medium text-white">
              +{remainingCount}
            </span>
          </div>
        )}
      </div>
      
      {assignees.length > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
          {assignees.length} assignee{assignees.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
};

// Assignee Picker Modal (for complex selection)
export const AssigneePickerModal = ({ 
  isOpen, 
  onClose, 
  currentAssignees = [], 
  onSave,
  entityType = 'task',
  title = 'Manage Assignees'
}) => {
  const [selectedAssignees, setSelectedAssignees] = useState(currentAssignees);

  useEffect(() => {
    setSelectedAssignees(currentAssignees);
  }, [currentAssignees, isOpen]);

  const handleSave = () => {
    onSave(selectedAssignees);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <MultipleAssignees
            entityType={entityType}
            currentAssignees={selectedAssignees}
            onAssigneesChange={setSelectedAssignees}
            className="h-full"
          />
        </div>

        <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Assignees
          </button>
        </div>
      </div>
    </div>
  );
};

