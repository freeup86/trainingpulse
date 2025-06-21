import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Search,
  Filter,
  UserCheck,
  UserX,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import { teams, users } from '../lib/api';
import { formatDate, getRoleColor, getUtilizationColor, formatPercentage } from '../lib/utils';

function TeamsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Read search parameter from URL on mount
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    setSearchTerm(urlSearch);
  }, [searchParams]);

  const { data: teamsData, isLoading: teamsLoading, error: teamsError } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teams.getAll()
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => users.getAll()
  });

  const { data: selectedTeamData } = useQuery({
    queryKey: ['team', selectedTeamId],
    queryFn: () => teams.getById(selectedTeamId),
    enabled: !!selectedTeamId
  });

  if (teamsLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (teamsError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error loading teams
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {teamsError.message || 'Failed to load teams. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const teamsList = teamsData?.data?.data?.teams || [];
  const usersList = usersData?.data?.data?.users || [];
  const filteredTeams = teamsList.filter(team => 
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'members', label: 'Team Members', icon: Users },
    { id: 'performance', label: 'Performance', icon: CheckCircle }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage teams, assign members, and track performance across training projects
            </p>
          </div>
          <button 
            onClick={() => navigate('/teams/create')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {filteredTeams.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                  <p>No teams found</p>
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedTeamId === team.id ? 'bg-blue-50 dark:bg-blue-900/30 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {team.name}
                        </h3>
                        {team.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {team.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center text-xs text-gray-400 dark:text-gray-500">
                          <Users className="h-3 w-3 mr-1" />
                          <span>{team.memberCount || 0} members</span>
                          {team.activeProjects && (
                            <>
                              <span className="mx-2">•</span>
                              <span>{team.activeProjects} active projects</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="ml-2">
                        <MoreHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Team Details */}
        <div className="lg:col-span-2">
          {selectedTeamId ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
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
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {selectedTab === 'overview' && (
                  <TeamOverview 
                    team={selectedTeamData?.data?.data} 
                    users={usersList}
                    navigate={navigate}
                  />
                )}
                {selectedTab === 'members' && (
                  <TeamMembers 
                    team={selectedTeamData?.data?.data} 
                    users={usersList}
                    setShowAddMemberModal={setShowAddMemberModal}
                  />
                )}
                {selectedTab === 'performance' && (
                  <TeamPerformance 
                    team={selectedTeamData?.data?.data}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Team</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Choose a team from the list to view details, manage members, and track performance.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal
          team={filteredTeams.find(t => t.id === selectedTeamId)}
          users={usersList}
          onClose={() => setShowAddMemberModal(false)}
          onSuccess={() => {
            setShowAddMemberModal(false);
            // Refetch team data
          }}
        />
      )}
    </div>
  );
}

// Team Overview Component
function TeamOverview({ team, users, navigate }) {
  if (!team) return <div>Loading team details...</div>;

  const teamMembers = users.filter(user => user.teamId === team.id);
  const activeMembers = teamMembers.filter(user => user.active);

  return (
    <div className="space-y-6">
      {/* Team Info */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{team.name}</h3>
          <button 
            onClick={() => navigate(`/teams/${team.id}/edit`)}
            className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </button>
        </div>
        
        {team.description && (
          <p className="text-gray-600 dark:text-gray-300 mb-4">{team.description}</p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Members</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{teamMembers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Members</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{activeMembers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Capacity</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {teamMembers.length > 0 
                    ? Math.round(teamMembers.reduce((sum, m) => sum + (m.dailyCapacityHours || 8), 0) / teamMembers.length)
                    : 0}h
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Recent Activity</h4>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Activity tracking will be available soon
          </p>
        </div>
      </div>
    </div>
  );
}

// Team Members Component
function TeamMembers({ team, users, setShowAddMemberModal }) {
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  if (!team) return <div>Loading team members...</div>;

  const teamMembers = users.filter(user => user.teamId === team.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Team Members</h3>
        <button 
          onClick={() => setShowAddMemberModal(true)}
          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Member
        </button>
      </div>

      {teamMembers.length === 0 ? (
        <div className="text-center py-8">
          <UserX className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No team members</h3>
          <p className="text-gray-500 dark:text-gray-400">Add members to get started with team collaboration.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
          {teamMembers.map((member) => (
            <div key={member.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</h4>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                      {!member.active && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                    <div className="mt-1 flex items-center text-xs text-gray-400 dark:text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{member.dailyCapacityHours || 8}h daily capacity</span>
                      {member.lastLogin && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Last login: {formatDate(member.lastLogin)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => {
                      setEditingUser(member);
                      setShowEditModal(true);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button 
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <EditUserModal
          user={editingUser}
          team={team}
          teams={users.map(u => u.teamId).filter((v, i, a) => a.indexOf(v) === i).map(id => ({ id, name: `Team ${id}` }))} // Mock teams list
          onClose={() => {
            setShowEditModal(false);
            setEditingUser(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingUser(null);
            // Refresh data would happen here
          }}
        />
      )}
    </div>
  );
}

// Team Performance Component
function TeamPerformance({ team }) {
  if (!team) return <div>Loading performance data...</div>;

  // Mock performance data
  const performanceData = {
    completionRate: 85,
    avgDeliveryTime: 12,
    activeProjects: 5,
    completedProjects: 23
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Performance Metrics</h3>
      
      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completion Rate</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatPercentage(performanceData.completionRate)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Delivery Time</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {performanceData.avgDeliveryTime} days
              </p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Projects</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {performanceData.activeProjects}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed Projects</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {performanceData.completedProjects}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Performance Charts</h4>
        <p className="text-gray-500 dark:text-gray-400">
          Detailed performance charts and analytics will be available soon.
        </p>
      </div>
    </div>
  );
}

// Add Member Modal Component
function AddMemberModal({ team, users, onClose, onSuccess }) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out users who are already team members
  const availableUsers = users.filter(user => user.teamId !== team?.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !team) return;

    setIsSubmitting(true);
    try {
      // Add API call to add member to team
      // await teams.addMember(team.id, { userId: selectedUserId, role: selectedRole });
      console.log('Adding member:', { teamId: team.id, userId: selectedUserId, role: selectedRole });
      onSuccess();
    } catch (error) {
      console.error('Failed to add team member:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!team) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Add Member to {team.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* User Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select User
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Choose a user...</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
              {availableUsers.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  All users are already members of this team.
                </p>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="member">Member</option>
                <option value="lead">Team Lead</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedUserId || isSubmitting || availableUsers.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit User Modal Component
function EditUserModal({ user, team, teams, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'member',
    teamId: user?.teamId || '',
    dailyCapacityHours: user?.dailyCapacityHours || 8,
    active: user?.active !== false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // In a real app, this would call an API to update the user
      // await users.update(user.id, formData);
      console.log('Updating user:', { userId: user.id, ...formData });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onSuccess();
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Edit Team Member
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="member">Member</option>
                <option value="designer">Designer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Team Assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Team Assignment
              </label>
              <select
                value={formData.teamId}
                onChange={(e) => handleChange('teamId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">No team assigned</option>
                <option value={team.id}>{team.name} (Current)</option>
                {/* In a real app, this would list all available teams */}
              </select>
            </div>

            {/* Daily Capacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Daily Capacity (hours)
              </label>
              <input
                type="number"
                min="1"
                max="16"
                step="0.5"
                value={formData.dailyCapacityHours}
                onChange={(e) => handleChange('dailyCapacityHours', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => handleChange('active', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="active" className="ml-2 block text-sm text-gray-900 dark:text-white">
                User is active
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeamsPage;