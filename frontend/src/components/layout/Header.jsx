import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Menu, 
  Bell, 
  Search, 
  User, 
  Settings, 
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon 
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useTheme } from '../../contexts/ThemeContext';
import { notifications } from '../../lib/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getRoleColor, formatRelativeTime } from '../../lib/utils';

export function Header({ onMenuClick, user }) {
  const { logout } = useAuth();
  const { theme, isDark, changeTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleTheme = () => {
    // Toggle between light and dark (skip system option for simplicity)
    changeTheme(isDark ? 'light' : 'dark');
  };

  // Fetch recent notifications for the header dropdown
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => notifications.getAll({ limit: 5, unreadOnly: true }),
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const recentNotifications = notificationsData?.data?.notifications || [];
  const unreadCount = recentNotifications.length;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNotificationClick = async (notificationId) => {
    try {
      await notifications.markAsRead(notificationId);
      // Invalidate notification queries to refresh the count
      queryClient.invalidateQueries(['notifications']);
      // Close the dropdown and navigate to notifications page
      setShowNotifications(false);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Determine where to search based on the search term
      const lowerSearch = searchTerm.toLowerCase();
      
      if (lowerSearch.includes('course') || lowerSearch.includes('training')) {
        navigate(`/courses?search=${encodeURIComponent(searchTerm)}`);
      } else if (lowerSearch.includes('team')) {
        navigate(`/teams?search=${encodeURIComponent(searchTerm)}`);
      } else if (lowerSearch.includes('workflow')) {
        navigate(`/workflows?search=${encodeURIComponent(searchTerm)}`);
      } else if (lowerSearch.includes('user') || lowerSearch.includes('member')) {
        // Users are searched within teams since there's no dedicated users page
        navigate(`/teams?search=${encodeURIComponent(searchTerm)}`);
      } else {
        // Default to courses search, but could be improved with a global search page
        navigate(`/courses?search=${encodeURIComponent(searchTerm)}`);
      }
      setSearchTerm('');
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>


          {/* Logo and title */}
          <Link to="/dashboard" className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TP</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">TrainingPulse</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Training Workflow Management</p>
            </div>
          </Link>
        </div>

        {/* Center search (hidden on mobile) - Hidden for now */}
        {/* <div className="hidden md:flex flex-1 max-w-lg mx-8">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search courses, teams, users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </form>
        </div> */}

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-yellow-500" />
            ) : (
              <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
          </Button>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative"
            >
              <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              {/* Notification badge */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Notifications</h3>
                    <Link to="/notifications" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                      View all
                    </Link>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    recentNotifications.map((notification, index) => (
                      <div 
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification.id)}
                        className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${index < recentNotifications.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
                      >
                        <p className="text-sm text-gray-900 dark:text-white line-clamp-2">{notification.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatRelativeTime(notification.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 px-3"
            >
              <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                <div className="flex items-center space-x-1">
                  <Badge className={getRoleColor(user.role)}>
                    {user.role}
                  </Badge>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </Button>

            {/* Profile dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="py-1">
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar - Hidden for now */}
      {/* <div className="md:hidden mt-4">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </form>
      </div> */}

      {/* Click outside to close dropdowns */}
      {(showProfileMenu || showNotifications) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowProfileMenu(false);
            setShowNotifications(false);
          }}
        />
      )}
    </header>
  );
}