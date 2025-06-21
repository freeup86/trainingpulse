import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Edit,
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Award,
  Activity,
  Settings,
  LogOut,
  Download,
  Upload,
  Save,
  X
} from 'lucide-react';
import { users, courses } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatRelativeTime, getStatusColor, getPriorityColor } from '../lib/utils';
import toast from 'react-hot-toast';

const ACTIVITY_TYPES = {
  'course_created': { icon: CheckCircle, color: 'text-green-600', label: 'Course Created' },
  'course_updated': { icon: Edit, color: 'text-blue-600', label: 'Course Updated' },
  'workflow_transition': { icon: Activity, color: 'text-purple-600', label: 'Workflow Transition' },
  'assignment_completed': { icon: Award, color: 'text-yellow-600', label: 'Assignment Completed' },
  'review_submitted': { icon: CheckCircle, color: 'text-green-600', label: 'Review Submitted' },
  'comment_added': { icon: Edit, color: 'text-gray-600', label: 'Comment Added' }
};

function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: () => users.getStats(user.id),
    enabled: Boolean(user?.id)
  });

  // Fetch user activity
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['user-activity', user?.id],
    queryFn: () => users.getActivity(user.id, { limit: 20 }),
    enabled: Boolean(user?.id)
  });

  // Fetch user assignments (courses assigned to user)
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-courses', user?.id],
    queryFn: () => courses.getByUser(user.id),
    enabled: Boolean(user?.id)
  });

  const isLoading = statsLoading || activityLoading || assignmentsLoading;
  const error = null;

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: (updates) => users.updateCurrent(updates),
    onSuccess: () => {
      toast.success('Profile updated successfully');
      setIsEditing(false);
      queryClient.invalidateQueries(['user-stats']);
      queryClient.invalidateQueries(['auth']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update profile');
    }
  });

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
                Error loading profile
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error.message || 'Failed to load profile. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const profile = user;
  const stats = statsData?.data || {};
  const activities = activityData?.data?.activities || [];
  const assignments = assignmentsData?.data?.courses || [];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'assignments', label: 'Assignments', icon: CheckCircle },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {/* Profile Picture */}
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.name}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8 text-gray-600 dark:text-gray-300" />
                    )}
                  </div>
                  <button className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center">
                    <Camera className="h-3 w-3 text-white" />
                  </button>
                </div>

                {/* User Info */}
                <div className="ml-4">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{profile.email}</p>
                  <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300`}>
                      {profile.role}
                    </span>
                    {profile.team && (
                      <>
                        <span className="mx-2">•</span>
                        <span>{profile.team}</span>
                      </>
                    )}
                    {profile.lastLogin && (
                      <>
                        <span className="mx-2">•</span>
                        <span>Last login: {formatRelativeTime(profile.lastLogin)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
                <button
                  onClick={logout}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Courses Completed
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {stats.coursesCompleted || 0}
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
                    Active Assignments
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {stats.activeAssignments || 0}
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
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Completion Rate
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {stats.completionRate || 0}%
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
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Reviews Given
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {stats.reviewsGiven || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {selectedTab === 'overview' && (
          <ProfileOverview profile={profile} isEditing={isEditing} onSave={updateProfile.mutate} />
        )}
        {selectedTab === 'assignments' && (
          <ProfileAssignments assignments={assignments} />
        )}
        {selectedTab === 'activity' && (
          <ProfileActivity activities={activities} />
        )}
        {selectedTab === 'settings' && (
          <ProfileSettings profile={profile} />
        )}
      </div>
    </div>
  );
}

// Profile Overview Component
function ProfileOverview({ profile, isEditing, onSave }) {
  const [formData, setFormData] = useState({
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    bio: profile.bio || '',
    website: profile.website || '',
    linkedIn: profile.linkedIn || '',
    timezone: profile.timezone || 'UTC'
  });

  const handleSave = () => {
    onSave(formData);
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={handleSave}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Profile Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Information</h4>
          <div className="mt-2 space-y-2">
            <div className="flex items-center text-sm text-gray-900 dark:text-white">
              <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
              <span>{profile.email}</span>
            </div>
            {profile.phone && (
              <div className="flex items-center text-sm text-gray-900 dark:text-white">
                <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                <span>{profile.phone}</span>
              </div>
            )}
            {profile.location && (
              <div className="flex items-center text-sm text-gray-900 dark:text-white">
                <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                <span>{profile.location}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Details</h4>
          <div className="mt-2 space-y-2">
            <div className="flex items-center text-sm text-gray-900 dark:text-white">
              <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
              <span>Joined {formatDate(profile.createdAt)}</span>
            </div>
            <div className="flex items-center text-sm text-gray-900 dark:text-white">
              <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
              <span>Capacity: {profile.dailyCapacityHours || 8}h/day</span>
            </div>
          </div>
        </div>
      </div>

      {profile.bio && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Bio</h4>
          <p className="mt-2 text-sm text-gray-900 dark:text-white">{profile.bio}</p>
        </div>
      )}
    </div>
  );
}

// Profile Assignments Component
function ProfileAssignments({ assignments }) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">My Assignments</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {assignments.length} active assignment{assignments.length !== 1 ? 's' : ''}
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Assignments</h3>
          <p className="text-gray-500 dark:text-gray-400">You don't have any active assignments at the moment.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {assignment.title}
                  </h4>
                  {assignment.description && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {assignment.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status, 'badge')}`}>
                      {assignment.status?.replace('_', ' ')}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(assignment.priority, 'badge')}`}>
                      {assignment.priority}
                    </span>
                    {assignment.dueDate && (
                      <span>Due: {formatDate(assignment.dueDate)}</span>
                    )}
                  </div>
                </div>
                <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Profile Activity Component
function ProfileActivity({ activities }) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Your recent actions and updates</p>
      </div>

      {activities.length === 0 ? (
        <div className="p-8 text-center">
          <Activity className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Activity</h3>
          <p className="text-gray-500 dark:text-gray-400">Your recent activity will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
          {activities.map((activity) => {
            const activityType = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES['course_updated'];
            const Icon = activityType.icon;
            
            return (
              <div key={activity.id} className="p-6">
                <div className="flex items-start">
                  <Icon className={`h-5 w-5 mt-0.5 ${activityType.color}`} />
                  <div className="ml-3 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">
                      <span className="font-medium">{activityType.label}</span>
                      {activity.description && (
                        <span className="text-gray-600 dark:text-gray-400"> • {activity.description}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatRelativeTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Profile Settings Component
function ProfileSettings({ profile }) {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Profile Settings</h3>
      
      <div className="space-y-6">
        {/* Export Data */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Export Profile Data</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Download a copy of your profile information</p>
          </div>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>

        {/* Import Data */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Import Profile Data</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Upload profile information from a file</p>
          </div>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </button>
        </div>

        {/* Delete Account */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200">Delete Account</h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button className="mt-3 inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 shadow-sm text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-white dark:bg-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/40">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;