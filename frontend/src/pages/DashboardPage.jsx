import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

        // Fetch data in parallel
        const [coursesResponse, notificationsResponse, bottlenecksResponse] = await Promise.allSettled([
          courses.getAll({ limit: 10, sortBy: 'updated_at', sortOrder: 'desc' }),
          notifications.getDigest({ maxAge: 24 }),
          analytics.getBottlenecks({ period: '7d', limit: 5 })
        ]);

        const coursesData = coursesResponse.status === 'fulfilled' ? coursesResponse.value.data.data : null;
        const notificationsData = notificationsResponse.status === 'fulfilled' ? notificationsResponse.value.data.data : null;
        const bottlenecksData = bottlenecksResponse.status === 'fulfilled' ? bottlenecksResponse.value.data.data : null;

        // Calculate statistics
        const stats = {
          totalCourses: coursesData?.totalCount || 0,
          activeCourses: coursesData?.courses?.filter(c => ['in_progress', 'review'].includes(c.status)).length || 0,
          completedCourses: coursesData?.courses?.filter(c => c.status === 'completed').length || 0,
          overdueCourses: coursesData?.courses?.filter(c => {
            return new Date(c.dueDate) < new Date() && !['completed', 'cancelled'].includes(c.status);
          }).length || 0
        };

        setDashboardData({
          stats,
          recentCourses: coursesData?.courses || [],
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

  const StatCard = ({ title, value, icon: Icon, color = 'blue', description }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
          </div>
          <div className={`h-12 w-12 rounded-lg bg-${color}-100 flex items-center justify-center`}>
            <Icon className={`h-6 w-6 text-${color}-600`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.name}!
          </h1>
          <p className="text-gray-600 mt-1">
            Here's what's happening with your training projects today.
          </p>
        </div>
        {user.role !== 'viewer' && (
          <Link to="/courses/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Course
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Courses"
          value={dashboardData.stats.totalCourses}
          icon={BookOpen}
          color="blue"
          description="All courses assigned to you"
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
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No recent courses found</p>
                <Button variant="outline" className="mt-2" asChild>
                  <Link to="/courses">View All Courses</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData.recentCourses.slice(0, 5).map((course) => (
                  <div key={course.id} className="flex items-center space-x-4">
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/courses/${course.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {course.title}
                      </Link>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={getStatusColor(course.status)}>
                          {course.status}
                        </Badge>
                        <Badge variant="outline" className={getPriorityColor(course.priority)}>
                          {course.priority}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatRelativeTime(course.updatedAt)}
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/courses">View All Courses</Link>
                  </Button>
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
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-500">All caught up!</p>
                <p className="text-sm text-gray-400">No urgent notifications</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboardData.notifications.slice(0, 5).map((notification) => (
                  <div key={notification.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 bg-red-500 rounded-full mt-2"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/notifications">View All Notifications</Link>
                  </Button>
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
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/analytics">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Analytics
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}