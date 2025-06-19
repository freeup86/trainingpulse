import { useState } from 'react';
import { 
  Settings, 
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Database,
  Mail,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  Check,
  X,
  AlertTriangle,
  Save,
  RefreshCw
} from 'lucide-react';
// import { settings, auth } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const SETTING_CATEGORIES = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'system', label: 'System', icon: Database }
];

const NOTIFICATION_TYPES = [
  {
    id: 'course_assignments',
    name: 'Course Assignments',
    description: 'When courses are assigned to you',
    defaultEnabled: true
  },
  {
    id: 'workflow_transitions',
    name: 'Workflow Updates',
    description: 'When courses move through workflow stages',
    defaultEnabled: true
  },
  {
    id: 'due_date_reminders',
    name: 'Due Date Reminders',
    description: 'Reminders for upcoming deadlines',
    defaultEnabled: true
  },
  {
    id: 'review_requests',
    name: 'Review Requests',
    description: 'When your review is required',
    defaultEnabled: true
  },
  {
    id: 'team_updates',
    name: 'Team Updates',
    description: 'Updates about your team and members',
    defaultEnabled: false
  },
  {
    id: 'system_announcements',
    name: 'System Announcements',
    description: 'Important system updates and maintenance',
    defaultEnabled: true
  }
];

const THEMES = [
  { id: 'light', name: 'Light', icon: Sun },
  { id: 'dark', name: 'Dark', icon: Moon },
  { id: 'system', name: 'System', icon: Monitor }
];

function SettingsPage() {
  const [selectedCategory, setSelectedCategory] = useState('account');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { user } = useAuth();

  // Mock data instead of API calls for now
  const settingsData = {
    data: {
      notifications: { course_assignments: true },
      emailDigest: 'daily',
      timezone: 'UTC',
      language: 'en',
      dailyCapacityHours: 8,
      theme: 'system',
      compactMode: false,
      twoFactorEnabled: false,
      sessionTimeout: 480
    }
  };
  
  const isLoading = false;
  const error = null;

  const updateSettings = {
    mutate: (updates) => {
      // Mock update
      setTimeout(() => {
        toast.success('Settings updated successfully');
        setHasUnsavedChanges(false);
      }, 500);
    },
    isPending: false
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
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading settings
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error.message || 'Failed to load settings. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userSettings = settingsData?.data || {};

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your account preferences, notifications, and system configuration
            </p>
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-yellow-600">You have unsaved changes</span>
              <button
                onClick={() => updateSettings.mutate(userSettings)}
                disabled={updateSettings.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {updateSettings.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <nav className="bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Settings</h3>
            </div>
            <div className="p-2">
              {SETTING_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {category.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <div className="bg-white shadow rounded-lg">
            {selectedCategory === 'account' && (
              <AccountSettings user={user} settings={userSettings} onUpdate={setHasUnsavedChanges} />
            )}
            {selectedCategory === 'notifications' && (
              <NotificationSettings settings={userSettings} onUpdate={setHasUnsavedChanges} />
            )}
            {selectedCategory === 'security' && (
              <SecuritySettings settings={userSettings} onUpdate={setHasUnsavedChanges} />
            )}
            {selectedCategory === 'appearance' && (
              <AppearanceSettings settings={userSettings} onUpdate={setHasUnsavedChanges} />
            )}
            {selectedCategory === 'system' && (
              <SystemSettings settings={userSettings} onUpdate={setHasUnsavedChanges} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Account Settings Component
function AccountSettings({ user, settings, onUpdate }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    timezone: settings.timezone || 'UTC',
    language: settings.language || 'en',
    dailyCapacityHours: settings.dailyCapacityHours || 8
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    onUpdate(true);
  };

  return (
    <div className="p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
        <p className="text-sm text-gray-500">Update your personal information and preferences</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => handleChange('timezone', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Daily Capacity (Hours)
            </label>
            <input
              type="number"
              min="1"
              max="24"
              value={formData.dailyCapacityHours}
              onChange={(e) => handleChange('dailyCapacityHours', parseInt(e.target.value))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Notification Settings Component
function NotificationSettings({ settings, onUpdate }) {
  const [notifications, setNotifications] = useState(settings.notifications || {});
  const [emailDigest, setEmailDigest] = useState(settings.emailDigest || 'daily');

  const handleNotificationToggle = (type) => {
    const updated = {
      ...notifications,
      [type]: !notifications[type]
    };
    setNotifications(updated);
    onUpdate(true);
  };

  return (
    <div className="p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
        <p className="text-sm text-gray-500">Choose how you want to be notified about updates</p>
      </div>

      <div className="space-y-6">
        {/* Email Digest */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Digest Frequency
          </label>
          <select
            value={emailDigest}
            onChange={(e) => {
              setEmailDigest(e.target.value);
              onUpdate(true);
            }}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 max-w-xs"
          >
            <option value="immediate">Immediate</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="never">Never</option>
          </select>
        </div>

        {/* Notification Types */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">Notification Types</h4>
          <div className="space-y-4">
            {NOTIFICATION_TYPES.map((type) => (
              <div key={type.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-gray-900">{type.name}</h5>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
                <button
                  onClick={() => handleNotificationToggle(type.id)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    notifications[type.id] !== false ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notifications[type.id] !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Settings Component
function SecuritySettings({ settings, onUpdate }) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(settings.twoFactorEnabled || false);
  const [sessionTimeout, setSessionTimeout] = useState(settings.sessionTimeout || 480);

  return (
    <div className="p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
        <p className="text-sm text-gray-500">Manage your account security and access controls</p>
      </div>

      <div className="space-y-6">
        {/* Two-Factor Authentication */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
            <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
          </div>
          <button
            onClick={() => {
              setTwoFactorEnabled(!twoFactorEnabled);
              onUpdate(true);
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Session Timeout */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Session Timeout (minutes)
          </label>
          <select
            value={sessionTimeout}
            onChange={(e) => {
              setSessionTimeout(parseInt(e.target.value));
              onUpdate(true);
            }}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 max-w-xs"
          >
            <option value={60}>1 hour</option>
            <option value={240}>4 hours</option>
            <option value={480}>8 hours</option>
            <option value={720}>12 hours</option>
            <option value={1440}>24 hours</option>
          </select>
        </div>

        {/* Password Change */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Change Password</h4>
          <p className="text-sm text-gray-500 mb-3">
            Update your password to keep your account secure
          </p>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
}

// Appearance Settings Component
function AppearanceSettings({ settings, onUpdate }) {
  const [theme, setTheme] = useState(settings.theme || 'system');
  const [compactMode, setCompactMode] = useState(settings.compactMode || false);

  return (
    <div className="p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900">Appearance</h3>
        <p className="text-sm text-gray-500">Customize the look and feel of your workspace</p>
      </div>

      <div className="space-y-6">
        {/* Theme Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((themeOption) => {
              const Icon = themeOption.icon;
              return (
                <button
                  key={themeOption.id}
                  onClick={() => {
                    setTheme(themeOption.id);
                    onUpdate(true);
                  }}
                  className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
                    theme === themeOption.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{themeOption.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Mode */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Compact Mode</h4>
            <p className="text-sm text-gray-500">Reduce spacing and padding for a more compact interface</p>
          </div>
          <button
            onClick={() => {
              setCompactMode(!compactMode);
              onUpdate(true);
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              compactMode ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                compactMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// System Settings Component
function SystemSettings({ settings, onUpdate }) {
  return (
    <div className="p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900">System Configuration</h3>
        <p className="text-sm text-gray-500">System-wide settings and preferences</p>
      </div>

      <div className="space-y-6">
        {/* System Information */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">System Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Version:</span>
              <span className="ml-2 font-medium">1.0.0</span>
            </div>
            <div>
              <span className="text-gray-500">Environment:</span>
              <span className="ml-2 font-medium">Production</span>
            </div>
            <div>
              <span className="text-gray-500">Database:</span>
              <span className="ml-2 font-medium">PostgreSQL 15</span>
            </div>
            <div>
              <span className="text-gray-500">Cache:</span>
              <span className="ml-2 font-medium">Redis 7.0</span>
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-yellow-800">Maintenance Mode</h4>
              <p className="text-sm text-yellow-700 mt-1">
                System configuration settings are read-only in this version. Contact your administrator for changes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;