import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart3,
  Workflow,
  Bell,
  Settings,
  FileSpreadsheet,
  Shield,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { usePermissions } from '../../hooks/usePermissions';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permissions: [] // Everyone can access dashboard
  },
  {
    name: 'Courses',
    href: '/courses',
    icon: BookOpen,
    permissions: ['courses.view']
  },
  {
    name: 'Teams',
    href: '/teams',
    icon: Users,
    permissions: ['teams.view']
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    permissions: ['analytics.view']
  },
  {
    name: 'Bulk Operations',
    href: '/bulk',
    icon: FileSpreadsheet,
    permissions: ['bulk.execute']
  },
  {
    name: 'Notifications',
    href: '/notifications',
    icon: Bell,
    permissions: ['notifications.view']
  },
  {
    name: 'Admin',
    href: '/admin',
    icon: Shield,
    permissions: ['admin.settings.manage', 'admin.roles.manage', 'admin.permissions.manage', 'users.view']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    permissions: [] // Everyone can access settings
  }
];

export function Sidebar({ isOpen, isVisible, isCollapsed, onClose }) {
  const location = useLocation();
  const { user } = useAuth();
  const { hasAnyPermission } = usePermissions();

  // Filter navigation items based on user permissions
  const filteredNavigation = navigation.filter(item => {
    // If no permissions required, show to everyone
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }
    // Check if user has any of the required permissions
    return hasAnyPermission(item.permissions);
  });

  const NavItem = ({ item }) => {
    const isActive = location.pathname.startsWith(item.href);
    
    return (
      <Link
        to={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center rounded-lg text-sm font-medium transition-colors group relative',
          isCollapsed ? 'justify-center px-3 py-3' : 'space-x-3 px-3 py-2',
          isActive
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
        )}
        title={isCollapsed ? item.name : undefined}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && <span>{item.name}</span>}
        
        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {item.name}
          </div>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-200 ease-in-out',
          // Width based on collapsed state
          isCollapsed ? 'w-16' : 'w-64',
          // Mobile behavior
          'md:static md:inset-0',
          // Mobile state
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop state
          'md:translate-x-0',
          !isVisible && 'md:-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 md:hidden">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TP</span>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">TrainingPulse</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Desktop Header - Logo for collapsed state */}
          <div className={cn(
            "hidden md:flex items-center justify-center border-b border-gray-200 dark:border-gray-700",
            isCollapsed ? "p-3" : "p-4"
          )}>
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TP</span>
            </div>
            {!isCollapsed && (
              <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">TrainingPulse</span>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {filteredNavigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </nav>

          {/* Footer */}
          <div className={cn(
            "border-t border-gray-200 dark:border-gray-700",
            isCollapsed ? "p-3" : "p-4"
          )}>
            {isCollapsed ? (
              <div className="flex justify-center">
                <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-gray-700 dark:text-gray-300 font-medium text-xs">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p className="font-medium">{user?.name}</p>
                <p>{user?.email}</p>
                <p className="mt-1">Team: {user?.teamName || 'No team'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}