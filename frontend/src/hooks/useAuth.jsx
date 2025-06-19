import { createContext, useContext, useEffect, useState } from 'react';
import { 
  isAuthenticated, 
  getUser, 
  login as loginAuth, 
  logout as logoutAuth,
  getCurrentUser,
  clearAuth
} from '../lib/auth';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (isAuthenticated()) {
          const storedUser = getUser();
          if (storedUser) {
            setUser(storedUser);
            // Verify and refresh user data
            try {
              const currentUser = await getCurrentUser();
              setUser(currentUser);
            } catch (err) {
              console.warn('Failed to refresh user data:', err);
              // Keep stored user data if refresh fails
            }
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await loginAuth(email, password);
      setUser(result.user);
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await logoutAuth();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setUser(null);
      setError(null);
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      throw err;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    canManage: user && ['admin', 'manager'].includes(user.role),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}