import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  CheckCircle,
  BarChart3,
  Plus
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import { courses, analytics, notifications, users } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatDate, formatRelativeTime, getStatusColor, getPriorityColor } from '../lib/utils';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalCourses: 0,
      activeCourses: 0,
      completedCourses: 0,
      overdueCourses: 0
    },
    assignmentStats: {
      totalAssignments: 0,
      pendingAssignments: 0,
      inProgressAssignments: 0,
      completedAssignments: 0,
      overdueAssignments: 0
    },
    notifications: [],
    bottlenecks: []
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch data in parallel - admin gets all courses, others get user-specific courses
        // Fetch ALL courses without pagination for accurate stats
        const allCoursesPromise = user.role === 'admin' 
          ? courses.getAll({ limit: 1000 }) // Get all courses, not just default 20
          : courses.getByUser(user.id, { limit: 1000 });
        
        const assignmentsPromise = users.getSubtaskAssignments(user.id);
          
        const [allCoursesResponse, assignmentsResponse, notificationsResponse, bottlenecksResponse] = await Promise.allSettled([
          allCoursesPromise,
          assignmentsPromise,
          notifications.getDigest({ maxAge: 24 }),
          analytics.getBottlenecks({ period: '7d', limit: 5 })
        ]);

        const allCoursesData = allCoursesResponse.status === 'fulfilled' ? allCoursesResponse.value.data : null;
        const assignmentsData = assignmentsResponse.status === 'fulfilled' ? assignmentsResponse.value.data : null;
        const notificationsData = notificationsResponse.status === 'fulfilled' ? notificationsResponse.value.data : null;
        const bottlenecksData = bottlenecksResponse.status === 'fulfilled' ? bottlenecksResponse.value.data : null;

        // Calculate statistics from ALL courses
        // Handle different data structures from getAll() vs getByUser()
        const allCoursesList = allCoursesData?.data?.courses || allCoursesData?.courses || [];
        const assignmentsList = assignmentsData?.data?.assignments || assignmentsData?.assignments || [];
        
        const stats = {
          totalCourses: allCoursesList.length,
          activeCourses: allCoursesList.filter(c => {
            const statusLower = c.status?.toLowerCase()?.trim();
            // Check for the actual status values being used
            return ['pre_development', 'outlines', 'storyboard', 'development'].includes(statusLower);
          }).length,
          completedCourses: allCoursesList.filter(c => c.status?.toLowerCase()?.trim() === 'completed').length,
          overdueCourses: allCoursesList.filter(c => {
            return c.due_date && new Date(c.due_date) < new Date() && c.status?.toLowerCase()?.trim() !== 'completed';
          }).length
        };

        // Calculate assignment statistics
        const now = new Date();
        const assignmentStats = {
          totalAssignments: assignmentsList.length,
          pendingAssignments: assignmentsList.filter(a => a.phase_status === 'not_started').length,
          inProgressAssignments: assignmentsList.filter(a => a.phase_status === 'in_progress').length,
          completedAssignments: assignmentsList.filter(a => a.phase_status === 'completed').length,
          overdueAssignments: assignmentsList.filter(a => {
            return a.finish_date && new Date(a.finish_date) < now && a.phase_status !== 'completed';
          }).length
        };

        setDashboardData({
          stats,
          assignmentStats,
          notifications: notificationsData?.data?.urgent || notificationsData?.urgent || [],
          bottlenecks: bottlenecksData?.data?.bottlenecks || bottlenecksData?.bottlenecks || []
        });

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user.id, user.role]);

  const StatCard = ({ title, value, icon: Icon, color = 'blue', description, onClick }) => {
    const cardContent = (
      <CardContent className="pt-6">
        <div className="flex items-center">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            )}
          </div>
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
            color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/20' :
            color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
            color === 'green' ? 'bg-green-100 dark:bg-green-900/20' :
            color === 'red' ? 'bg-red-100 dark:bg-red-900/20' :
            'bg-gray-100 dark:bg-gray-700/50'
          }`}>
            <Icon className={`h-6 w-6 ${
              color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
              color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
              color === 'green' ? 'text-green-600 dark:text-green-400' :
              color === 'red' ? 'text-red-600 dark:text-red-400' :
              'text-gray-600 dark:text-gray-400'
            }`} />
          </div>
        </div>
      </CardContent>
    );

    if (onClick) {
      return (
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={onClick}
        >
          {cardContent}
        </Card>
      );
    }

    return <Card>{cardContent}</Card>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user.name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Here's what's happening with your training projects today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Courses"
          value={dashboardData.stats.totalCourses}
          icon={BookOpen}
          color="blue"
          description="All courses"
        />
        <StatCard
          title="Active Courses"
          value={dashboardData.stats.activeCourses}
          icon={Clock}
          color="yellow"
          description="Currently in progress"
        />
        <StatCard
          title="Completed"
          value={dashboardData.stats.completedCourses}
          icon={CheckCircle}
          color="green"
          description="Successfully finished"
        />
        <StatCard
          title="Overdue"
          value={dashboardData.stats.overdueCourses}
          icon={AlertTriangle}
          color="red"
          description="Past due date"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignments Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>My Assignments</CardTitle>
            <CardDescription>
              Phase assignments across all courses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {dashboardData.assignmentStats.totalAssignments}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Assignments</div>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {dashboardData.assignmentStats.inProgressAssignments}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">In Progress</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Pending</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {dashboardData.assignmentStats.pendingAssignments}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Completed</span>
                  </div>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {dashboardData.assignmentStats.completedAssignments}
                  </span>
                </div>
                
                {dashboardData.assignmentStats.overdueAssignments > 0 && (
                  <div className="flex items-center justify-between py-2 px-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400">Overdue</span>
                    </div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      {dashboardData.assignmentStats.overdueAssignments}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Completion Rate
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${dashboardData.assignmentStats.totalAssignments > 0 
                          ? (dashboardData.assignmentStats.completedAssignments / dashboardData.assignmentStats.totalAssignments * 100) 
                          : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {dashboardData.assignmentStats.totalAssignments > 0 
                      ? Math.round(dashboardData.assignmentStats.completedAssignments / dashboardData.assignmentStats.totalAssignments * 100)
                      : 0}%
                  </span>
                </div>
              </div>
              
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Important Notifications</CardTitle>
            <CardDescription>
              Urgent items requiring your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardData.notifications.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-green-400 dark:text-green-500 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">All caught up!</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">No urgent notifications</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData.notifications.slice(0, 5).map((notification) => (
                  <div key={notification.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 bg-red-500 rounded-full mt-2"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Link to="/notifications" className="block">
                    <Button variant="outline" className="w-full">
                      View All Notifications
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottlenecks (for managers and admins) */}
      {['admin', 'manager', 'reviewer'].includes(user.role) && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Bottlenecks</CardTitle>
            <CardDescription>
              Workflow delays that need attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardData.bottlenecks.length === 0 ? (
              <div className="text-center py-6">
                <TrendingUp className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-500">No bottlenecks detected</p>
                <p className="text-sm text-gray-400">Workflows are running smoothly</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData.bottlenecks.map((bottleneck, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {bottleneck.stage} - {bottleneck.groupValue}
                      </p>
                      <p className="text-sm text-gray-600">
                        {bottleneck.affectedCourses} courses affected
                      </p>
                      <p className="text-xs text-gray-500">
                        Avg delay: {bottleneck.avgDelayDays} days
                      </p>
                    </div>
                    <Badge variant="warning">
                      Severity {bottleneck.severity}
                    </Badge>
                  </div>
                ))}
                <div className="pt-2">
                  <Link to="/analytics" className="block">
                    <Button variant="outline" className="w-full">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Analytics
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}