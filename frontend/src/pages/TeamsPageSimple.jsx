import { useState } from 'react';
import { 
  Users, 
  Plus, 
  Search,
  UserCheck,
  UserX,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle,
  Edit,
  MoreHorizontal
} from 'lucide-react';

function TeamsPageSimple() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(1);

  // Mock data
  const teams = [
    { 
      id: 1, 
      name: 'Design Team', 
      description: 'UI/UX design and visual content creation',
      memberCount: 5,
      activeProjects: 3
    },
    { 
      id: 2, 
      name: 'Development Team', 
      description: 'Technical development and implementation',
      memberCount: 8,
      activeProjects: 5
    },
    { 
      id: 3, 
      name: 'Content Team', 
      description: 'Content creation and editorial review',
      memberCount: 4,
      activeProjects: 2
    }
  ];

  const users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'designer',
      teamId: 1,
      active: true,
      dailyCapacityHours: 8,
      lastLogin: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'manager',
      teamId: 1,
      active: true,
      dailyCapacityHours: 8,
      lastLogin: '2024-01-15T09:30:00Z'
    }
  ];

  const filteredTeams = teams.filter(team => 
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
              {filteredTeams.map((team) => (
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
                      <p className="text-sm text-gray-500 truncate">
                        {team.description}
                      </p>
                      <div className="mt-1 flex items-center text-xs text-gray-400">
                        <Users className="h-3 w-3 mr-1" />
                        <span>{team.memberCount} members</span>
                        <span className="mx-2">•</span>
                        <span>{team.activeProjects} active projects</span>
                      </div>
                    </div>
                    <div className="ml-2">
                      <MoreHorizontal className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Details */}
        <div className="lg:col-span-2">
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
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Teams Page Working!</h3>
                <p className="text-gray-500">
                  This is a simplified version of the Teams page to test functionality.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeamsPageSimple;