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
import { courses, analytics, notifications } from '../lib/api';
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
    recentCourses: [],
    notifications: [],
    bottlenecks: []
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch data in parallel - admin gets all courses, others get user-specific courses
        const coursesPromise = user.role === 'admin' 
          ? courses.getAll({ limit: 10, sortBy: 'updated_at', sortOrder: 'desc' })
          : courses.getByUser(user.id, { limit: 10, sortBy: 'updated_at', sortOrder: 'desc' });
          
        const [coursesResponse, notificationsResponse, bottlenecksResponse] = await Promise.allSettled([
          coursesPromise,
          notifications.getDigest({ maxAge: 24 }),
          analytics.getBottlenecks({ period: '7d', limit: 5 })
        ]);

        const coursesData = coursesResponse.status === 'fulfilled' ? coursesResponse.value.data.data : null;
        const notificationsData = notificationsResponse.status === 'fulfilled' ? notificationsResponse.value.data.data : null;
        const bottlenecksData = bottlenecksResponse.status === 'fulfilled' ? bottlenecksResponse.value.data.data : null;

        // Calculate statistics from courses (all courses for admin, user courses for others)
        // Handle different data structures from getAll() vs getByUser()
        const coursesList = coursesData?.courses || coursesData?.data || [];
        const stats = {
          totalCourses: coursesList.length,
          activeCourses: coursesList.filter(c => ['in_progress', 'content_development', 'review', 'legal_review'].includes(c.status)).length,
          completedCourses: coursesList.filter(c => c.status === 'completed').length,
          overdueCourses: coursesList.filter(c => {
            return new Date(c.due_date) < new Date() && !['completed', 'cancelled'].includes(c.status);
          }).length
        };

        setDashboardData({
          stats,
          recentCourses: coursesList,
          notifications: notificationsData?.urgent || [],
          bottlenecks: bottlenecksData?.bottlenecks || []
        });

      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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
          description="All courses assigned to you"
          onClick={() => navigate('/courses')}
        />
        <StatCard
          title="Active Courses"
          value={dashboardData.stats.activeCourses}
          icon={Clock}
          color="yellow"
          description="Currently in progress"
          onClick={() => navigate('/courses?filter=active')}
        />
        <StatCard
          title="Completed"
          value={dashboardData.stats.completedCourses}
          icon={CheckCircle}
          color="green"
          description="Successfully finished"
          onClick={() => navigate('/courses?status=completed')}
        />
        <StatCard
          title="Overdue"
          value={dashboardData.stats.overdueCourses}
          icon={AlertTriangle}
          color="red"
          description="Past due date"
          onClick={() => navigate('/courses?filter=overdue')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Courses */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Courses</CardTitle>
            <CardDescription>
              Your latest course activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardData.recentCourses.length === 0 ? (
              <div className="text-center py-6">
                <BookOpen className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No recent courses found</p>
                <Link to="/courses">
                  <Button variant="outline" className="mt-2">
                    View All Courses
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData.recentCourses.slice(0, 5).map((course) => (
                  <div key={course.id} className="flex items-center space-x-4">
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/courses/${course.id}`}
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {course.title}
                      </Link>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={getStatusColor(course.status)}>
                          {course.status}
                        </Badge>
                        <Badge className={getPriorityColor(course.priority)}>
                          {course.priority}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(course.updated_at)}
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Link to="/courses" className="block">
                    <Button variant="outline" className="w-full">
                      View All Courses
                    </Button>
                  </Link>
                </div>
              </div>
            )}
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