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
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'designer', 'reviewer', 'viewer']
  },
  {
    name: 'Courses',
    href: '/courses',
    icon: BookOpen,
    roles: ['admin', 'manager', 'designer', 'reviewer', 'viewer']
  },
  {
    name: 'Teams',
    href: '/teams',
    icon: Users,
    roles: ['admin', 'manager']
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['admin', 'manager', 'reviewer']
  },
  {
    name: 'Workflows',
    href: '/workflows',
    icon: Workflow,
    roles: ['admin', 'manager']
  },
  {
    name: 'Bulk Operations',
    href: '/bulk',
    icon: FileSpreadsheet,
    roles: ['admin', 'manager']
  },
  {
    name: 'Notifications',
    href: '/notifications',
    icon: Bell,
    roles: ['admin', 'manager', 'designer', 'reviewer', 'viewer']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin', 'manager', 'designer', 'reviewer', 'viewer']
  }
];

export function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user } = useAuth();

  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user?.role)
  );

  const NavItem = ({ item }) => {
    const isActive = location.pathname.startsWith(item.href);
    
    return (
      <Link
        to={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <item.icon className="h-5 w-5" />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 md:hidden">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TP</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">TrainingPulse</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {filteredNavigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p className="font-medium">{user?.name}</p>
              <p>{user?.email}</p>
              <p className="mt-1">Team: {user?.teamName || 'No team'}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}