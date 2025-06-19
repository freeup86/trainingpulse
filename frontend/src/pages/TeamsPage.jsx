import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(null);

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
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading teams
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {teamsError.message || 'Failed to load teams. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const teamsList = teamsData?.data?.teams || [];
  const usersList = usersData?.data?.users || [];
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
            <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage teams, assign members, and track performance across training projects
            </p>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams List */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredTeams.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No teams found</p>
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedTeamId === team.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {team.name}
                        </h3>
                        {team.description && (
                          <p className="text-sm text-gray-500 truncate">
                            {team.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center text-xs text-gray-400">
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
                        <MoreHorizontal className="h-4 w-4 text-gray-400" />
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
            <div className="bg-white shadow rounded-lg">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedTab(tab.id)}
                        className={`${
                          selectedTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                    team={selectedTeamData?.data} 
                    users={usersList}
                  />
                )}
                {selectedTab === 'members' && (
                  <TeamMembers 
                    team={selectedTeamData?.data} 
                    users={usersList}
                  />
                )}
                {selectedTab === 'performance' && (
                  <TeamPerformance 
                    team={selectedTeamData?.data}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Team</h3>
              <p className="text-gray-500">
                Choose a team from the list to view details, manage members, and track performance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Team Overview Component
function TeamOverview({ team, users }) {
  if (!team) return <div>Loading team details...</div>;

  const teamMembers = users.filter(user => user.teamId === team.id);
  const activeMembers = teamMembers.filter(user => user.active);

  return (
    <div className="space-y-6">
      {/* Team Info */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{team.name}</h3>
          <button className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </button>
        </div>
        
        {team.description && (
          <p className="text-gray-600 mb-4">{team.description}</p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Members</p>
                <p className="text-2xl font-semibold text-gray-900">{teamMembers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Active Members</p>
                <p className="text-2xl font-semibold text-gray-900">{activeMembers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Avg Capacity</p>
                <p className="text-2xl font-semibold text-gray-900">
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
        <h4 className="text-md font-medium text-gray-900 mb-3">Recent Activity</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 text-center">
            Activity tracking will be available soon
          </p>
        </div>
      </div>
    </div>
  );
}

// Team Members Component
function TeamMembers({ team, users }) {
  if (!team) return <div>Loading team members...</div>;

  const teamMembers = users.filter(user => user.teamId === team.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
        <button className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          <Plus className="h-4 w-4 mr-1" />
          Add Member
        </button>
      </div>

      {teamMembers.length === 0 ? (
        <div className="text-center py-8">
          <UserX className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No team members</h3>
          <p className="text-gray-500">Add members to get started with team collaboration.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {teamMembers.map((member) => (
            <div key={member.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <h4 className="text-sm font-medium text-gray-900">{member.name}</h4>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                      {!member.active && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    <div className="mt-1 flex items-center text-xs text-gray-400">
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
                  <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                    Edit
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
      <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
      
      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Completion Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatPercentage(performanceData.completionRate)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Avg Delivery Time</p>
              <p className="text-2xl font-semibold text-gray-900">
                {performanceData.avgDeliveryTime} days
              </p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active Projects</p>
              <p className="text-2xl font-semibold text-gray-900">
                {performanceData.activeProjects}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Completed Projects</p>
              <p className="text-2xl font-semibold text-gray-900">
                {performanceData.completedProjects}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">Performance Charts</h4>
        <p className="text-gray-500">
          Detailed performance charts and analytics will be available soon.
        </p>
      </div>
    </div>
  );
}

export default TeamsPage;