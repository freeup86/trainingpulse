import { auth } from './api';

export const TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';
export const USER_KEY = 'user';

// Auth utilities
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
export const getUser = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const setUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = () => {
  const token = getToken();
  const user = getUser();
  return !!(token && user);
};

export const hasRole = (requiredRoles) => {
  const user = getUser();
  if (!user || !requiredRoles) return false;
  
  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(user.role);
  }
  
  return user.role === requiredRoles;
};

export const canManage = () => {
  const user = getUser();
  return user && ['admin', 'manager'].includes(user.role);
};

export const isAdmin = () => {
  const user = getUser();
  return user && user.role === 'admin';
};

// Auth actions
export const login = async (email, password) => {
  try {
    const response = await auth.login(email, password);
    const { accessToken, refreshToken, user } = response.data.data;
    
    setTokens(accessToken, refreshToken);
    setUser(user);
    
    return { success: true, user };
  } catch (error) {
    throw new Error(error.response?.data?.error?.message || 'Login failed');
  }
};

export const logout = async () => {
  try {
    await auth.logout();
  } catch (error) {
    // Continue with logout even if API call fails
    console.warn('Logout API call failed:', error);
  } finally {
    clearAuth();
  }
};

export const refreshToken = async () => {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await auth.refresh(refreshToken);
    const { accessToken } = response.data.data;
    
    setTokens(accessToken);
    return accessToken;
  } catch (error) {
    clearAuth();
    throw new Error('Token refresh failed');
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await auth.me();
    const user = response.data.data;
    setUser(user);
    return user;
  } catch (error) {
    throw new Error('Failed to get current user');
  }
};

// Role-based permissions
export const permissions = {
  canCreateCourse: () => canManage(),
  canEditCourse: (course) => {
    const user = getUser();
    if (!user) return false;
    if (isAdmin()) return true;
    if (user.role === 'manager') return true;
    // Check if user is assigned to the course
    return course?.assignments?.some(a => a.userId === user.id);
  },
  canDeleteCourse: () => canManage(),
  canManageTeam: (team) => {
    const user = getUser();
    if (!user) return false;
    if (isAdmin()) return true;
    return user.role === 'manager' && user.teamId === team?.id;
  },
  canViewAnalytics: () => {
    const user = getUser();
    return user && ['admin', 'manager', 'reviewer'].includes(user.role);
  },
  canBulkUpdate: () => canManage(),
  canManageWorkflow: () => canManage(),
  canApproveWorkflow: (stage) => {
    const user = getUser();
    if (!user) return false;
    if (canManage()) return true;
    return user.role === 'reviewer' && stage?.requiredRole === 'reviewer';
  }
};