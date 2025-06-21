import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Clock,
  Filter,
  Check
} from 'lucide-react';
import { notifications } from '../lib/api';
import { formatDate, formatRelativeTime } from '../lib/utils';

const NOTIFICATION_ICONS = {
  'course_assignment': Info,
  'workflow_transition': CheckCircle,
  'deadline_approaching': Clock,
  'review_required': AlertTriangle,
  'approval_required': AlertTriangle,
  'course_published': CheckCircle,
  'system': Bell
};

const NOTIFICATION_COLORS = {
  'course_assignment': 'text-blue-500 dark:text-blue-400',
  'workflow_transition': 'text-green-500 dark:text-green-400',
  'deadline_approaching': 'text-yellow-500 dark:text-yellow-400',
  'review_required': 'text-orange-500 dark:text-orange-400',
  'approval_required': 'text-red-500 dark:text-red-400',
  'course_published': 'text-green-500 dark:text-green-400',
  'system': 'text-gray-500 dark:text-gray-400'
};

function NotificationsPage() {
  const [filter, setFilter] = useState('all'); // all, unread, read

  const { data: notificationsData, isLoading, error } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => notifications.getAll({
      read: filter === 'read' ? true : filter === 'unread' ? false : undefined,
      limit: 100
    })
  });

  const { data: digestData } = useQuery({
    queryKey: ['notifications', 'digest'],
    queryFn: () => notifications.getDigest()
  });

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notifications.markAsRead(notificationId);
      // The query will automatically refetch due to cache invalidation
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notificationsList.filter(n => !n.readAt);
      await Promise.all(
        unreadNotifications.map(n => notifications.markAsRead(n.id))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

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
                Error loading notifications
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error.message || 'Failed to load notifications. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const notificationsList = notificationsData?.data?.notifications || [];
  const unreadCount = notificationsList.filter(n => !n.readAt).length;
  const digest = digestData?.data || {};

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Stay updated on course progress, deadlines, and system updates
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark All as Read
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {digest && Object.keys(digest).length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Bell className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Total Notifications
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {digest.totalNotifications || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Unread
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {unreadCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      Urgent Actions
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-white">
                      {digest.urgentCount || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          {[
            { key: 'all', label: 'All', count: notificationsList.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'read', label: 'Read', count: notificationsList.length - unreadCount }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`${
                filter === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`${
                  filter === tab.key
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300'
                } ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Notifications List */}
      {notificationsList.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Bell className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No notifications</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === 'all' 
                ? "You're all caught up! No notifications to show."
                : filter === 'unread'
                ? "No unread notifications."
                : "No read notifications."
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {notificationsList.map((notification) => {
              const IconComponent = NOTIFICATION_ICONS[notification.type] || Bell;
              const iconColor = NOTIFICATION_COLORS[notification.type] || 'text-gray-500';
              const isUnread = !notification.readAt;
              
              return (
                <li 
                  key={notification.id} 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isUnread ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`flex-shrink-0 ${iconColor}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <h3 className={`text-sm font-medium ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {notification.title}
                            </h3>
                            {isUnread && (
                              <span className="ml-2 h-2 w-2 bg-blue-500 rounded-full"></span>
                            )}
                          </div>
                          
                          <p className={`mt-1 text-sm ${isUnread ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                            {notification.message}
                          </p>
                          
                          <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4">
                            <span>{formatRelativeTime(notification.createdAt)}</span>
                            {notification.fromUserName && (
                              <span>From: {notification.fromUserName}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isUnread && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-xs font-medium"
                          >
                            Mark as read
                          </button>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;