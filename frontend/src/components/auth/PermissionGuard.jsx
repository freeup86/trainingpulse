import { usePermissions } from '../../hooks/usePermissions';

/**
 * Component that conditionally renders children based on user permissions
 * @param {string|string[]} permissions - Required permission(s)
 * @param {React.ReactNode} children - Content to render if user has permission
 * @param {React.ReactNode} fallback - Content to render if user lacks permission
 * @param {boolean} requireAll - If true, user must have ALL permissions (default: false, user needs ANY)
 */
export function PermissionGuard({ 
  permissions, 
  children, 
  fallback = null, 
  requireAll = false 
}) {
  const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermissions();
  
  if (!permissions || permissions.length === 0) {
    return children;
  }
  
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  
  let hasAccess;
  if (permissionArray.length === 1) {
    hasAccess = hasPermission(permissionArray[0]);
  } else if (requireAll) {
    hasAccess = hasAllPermissions(permissionArray);
  } else {
    hasAccess = hasAnyPermission(permissionArray);
  }
  
  return hasAccess ? children : fallback;
}

/**
 * Higher-order component that wraps a component with permission checking
 * @param {React.Component} Component - Component to wrap
 * @param {string|string[]} permissions - Required permission(s)
 * @param {React.ReactNode} fallback - Content to render if user lacks permission
 */
export function withPermissions(Component, permissions, fallback = null) {
  return function PermissionWrappedComponent(props) {
    return (
      <PermissionGuard permissions={permissions} fallback={fallback}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}

/**
 * Hook that returns a permission guard function for conditional rendering
 */
export function usePermissionGuard() {
  const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermissions();
  
  return (permissions, requireAll = false) => {
    if (!permissions || permissions.length === 0) {
      return true;
    }
    
    const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
    
    if (permissionArray.length === 1) {
      return hasPermission(permissionArray[0]);
    } else if (requireAll) {
      return hasAllPermissions(permissionArray);
    } else {
      return hasAnyPermission(permissionArray);
    }
  };
}