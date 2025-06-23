import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { userPermissions } from '../lib/api';

/**
 * Hook to manage user permissions based on their role
 * Fetches permissions from the database and provides utility functions
 */
export function usePermissions() {
  const { user } = useAuth();
  
  // Fetch user's role permissions from the database
  const { data: roleData, isLoading, error } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Get current user's role with permissions
      const response = await userPermissions.getCurrentRole();
      return response.data?.data || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1
  });

  // Extract permissions array from role data
  const permissions = useMemo(() => {
    if (!roleData?.permissions) return [];
    return roleData.permissions.map(p => p.name);
  }, [roleData]);

  /**
   * Check if user has a specific permission
   * @param {string|string[]} requiredPermissions - Permission(s) to check
   * @returns {boolean} Whether user has the permission(s)
   */
  const hasPermission = useCallback((requiredPermissions) => {
    if (!user || !permissions.length) return false;
    
    const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    return required.every(permission => permissions.includes(permission));
  }, [user, permissions]);

  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissionList - List of permissions to check
   * @returns {boolean} Whether user has at least one of the permissions
   */
  const hasAnyPermission = useCallback((permissionList) => {
    if (!user || !permissions.length) return false;
    return permissionList.some(permission => permissions.includes(permission));
  }, [user, permissions]);

  /**
   * Check if user has all of the specified permissions
   * @param {string[]} permissionList - List of permissions to check
   * @returns {boolean} Whether user has all of the permissions
   */
  const hasAllPermissions = useCallback((permissionList) => {
    if (!user || !permissions.length) return false;
    return permissionList.every(permission => permissions.includes(permission));
  }, [user, permissions]);

  // Convenience permission checks for common operations
  const can = useMemo(() => ({
    // Admin permissions
    manageRoles: hasPermission('admin.roles.manage'),
    managePermissions: hasPermission('admin.permissions.manage'),
    manageSettings: hasPermission('admin.settings.manage'),
    viewAnalytics: hasPermission('analytics.view'),
    
    // User permissions
    viewUsers: hasPermission('users.view'),
    createUsers: hasPermission('users.create'),
    updateUsers: hasPermission('users.update'),
    deleteUsers: hasPermission('users.delete'),
    
    // Course permissions
    viewCourses: hasPermission('courses.view'),
    createCourses: hasPermission('courses.create'),
    updateCourses: hasPermission('courses.update'),
    deleteCourses: hasPermission('courses.delete'),
    manageCourses: hasPermission('courses.manage'),
    
    // Workflow permissions
    viewWorkflows: hasPermission('workflows.view'),
    createWorkflows: hasPermission('workflows.create'),
    updateWorkflows: hasPermission('workflows.update'),
    deleteWorkflows: hasPermission('workflows.delete'),
    manageWorkflows: hasPermission('workflows.manage'),
    
    // Team permissions
    viewTeams: hasPermission('teams.view'),
    createTeams: hasPermission('teams.create'),
    updateTeams: hasPermission('teams.update'),
    deleteTeams: hasPermission('teams.delete'),
    
    // Notification permissions
    viewNotifications: hasPermission('notifications.view'),
    manageNotifications: hasPermission('notifications.manage'),
    
    // Bulk operations
    performBulkOperations: hasPermission('bulk.execute')
  }), [hasPermission]);

  // Legacy role-based checks for backward compatibility
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canManage = user && ['admin', 'manager'].includes(user.role);

  return {
    // Permission data
    permissions,
    roleData,
    isLoading,
    error,
    
    // Permission checking functions
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // Convenience permission checks
    can,
    
    // Legacy role checks (for backward compatibility)
    isAdmin,
    isManager,
    canManage,
    
    // User info
    user
  };
}

/**
 * Hook to check if user has specific permission(s)
 * Simpler version for basic permission checking
 */
export function useHasPermission(requiredPermissions) {
  const { hasPermission } = usePermissions();
  return hasPermission(requiredPermissions);
}

/**
 * Hook for permission-based conditional rendering
 * Returns children only if user has required permission(s)
 */
export function usePermissionGuard(requiredPermissions, children) {
  const hasPermission = useHasPermission(requiredPermissions);
  return hasPermission ? children : null;
}