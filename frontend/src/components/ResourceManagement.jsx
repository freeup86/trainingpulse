import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  User,
  Settings,
  Plus,
  Search,
  Filter,
  Download,
  BarChart3,
  PieChart,
  Target,
  Zap,
  Award,
  MapPin,
  Phone,
  Mail,
  Globe,
  Building,
  DollarSign,
  Briefcase,
  Star,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { analytics, users } from '../lib/api';
import { formatDate, formatRelativeTime } from '../lib/utils';

// Resource Types
const RESOURCE_TYPES = {
  TEAM_MEMBER: 'team_member',
  EQUIPMENT: 'equipment',
  BUDGET: 'budget',
  SKILL: 'skill',
  LOCATION: 'location',
  VENDOR: 'vendor'
};

// Availability Status
const AVAILABILITY_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OVERLOADED: 'overloaded',
  UNAVAILABLE: 'unavailable'
};

// Main Resource Management Component
export const ResourceManagement = ({ 
  className = '',
  view = 'overview' // overview, team, equipment, budget, planning
}) => {
  const [activeView, setActiveView] = useState(view);
  const [selectedDateRange, setSelectedDateRange] = useState('30d');
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: ''
  });

  const views = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
    { key: 'equipment', label: 'Equipment', icon: <Settings className="w-4 h-4" /> },
    { key: 'budget', label: 'Budget', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'planning', label: 'Planning', icon: <Calendar className="w-4 h-4" /> }
  ];

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Resource Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage team members, equipment, and resources efficiently
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>

              <button className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                <span>Add Resource</span>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex space-x-1 mt-4">
            {views.map((viewItem) => (
              <button
                key={viewItem.key}
                onClick={() => setActiveView(viewItem.key)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === viewItem.key
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {viewItem.icon}
                <span>{viewItem.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeView === 'overview' && <ResourceOverview dateRange={selectedDateRange} />}
        {activeView === 'team' && <TeamResourceView filters={filters} onFiltersChange={setFilters} />}
        {activeView === 'equipment' && <EquipmentResourceView filters={filters} onFiltersChange={setFilters} />}
        {activeView === 'budget' && <BudgetResourceView dateRange={selectedDateRange} />}
        {activeView === 'planning' && <ResourcePlanningView />}
      </div>
    </div>
  );
};

// Resource Overview
const ResourceOverview = ({ dateRange }) => {
  const { data: overviewData, isLoading } = useQuery({
    queryKey: ['resource-overview', dateRange],
    queryFn: () => analytics.getResourceOverview(dateRange),
  });

  const overview = overviewData?.data || {};

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Team Members"
          value={overview.totalTeamMembers || 0}
          change={overview.teamMembersChange || 0}
          icon={<Users className="w-6 h-6" />}
          color="blue"
        />
        <MetricCard
          title="Utilization Rate"
          value={`${overview.utilizationRate || 0}%`}
          change={overview.utilizationChange || 0}
          icon={<Target className="w-6 h-6" />}
          color="green"
        />
        <MetricCard
          title="Active Projects"
          value={overview.activeProjects || 0}
          change={overview.projectsChange || 0}
          icon={<Briefcase className="w-6 h-6" />}
          color="purple"
        />
        <MetricCard
          title="Budget Utilized"
          value={`$${(overview.budgetUtilized || 0).toLocaleString()}`}
          change={overview.budgetChange || 0}
          icon={<DollarSign className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResourceUtilizationChart data={overview.utilizationChart} />
        <TeamCapacityChart data={overview.capacityChart} />
      </div>

      {/* Resource Alerts */}
      <ResourceAlerts alerts={overview.alerts || []} />

      {/* Recent Activity */}
      <RecentResourceActivity activities={overview.recentActivity || []} />
    </div>
  );
};

// Team Resource View
const TeamResourceView = ({ filters, onFiltersChange }) => {
  const [selectedMember, setSelectedMember] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team-resources', filters],
    queryFn: () => resources.getTeamMembers(filters),
  });

  const teamMembers = teamData?.data || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search team members..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="overloaded">Overloaded</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>

        <button
          onClick={() => setShowAddMemberModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Member</span>
        </button>
      </div>

      {/* Team Grid */}
      {isLoading ? (
        <TeamMembersSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
              onClick={() => setSelectedMember(member)}
            />
          ))}
        </div>
      )}

      {/* Member Details Modal */}
      {selectedMember && (
        <TeamMemberDetailsModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddTeamMemberModal onClose={() => setShowAddMemberModal(false)} />
      )}
    </div>
  );
};

// Equipment Resource View
const EquipmentResourceView = ({ filters, onFiltersChange }) => {
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);

  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ['equipment-resources', filters],
    queryFn: () => resources.getEquipment(filters),
  });

  const equipment = equipmentData?.data || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search equipment..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={filters.type}
            onChange={(e) => onFiltersChange({ ...filters, type: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            <option value="hardware">Hardware</option>
            <option value="software">Software</option>
            <option value="vehicle">Vehicle</option>
            <option value="facility">Facility</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="in_use">In Use</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
        </div>

        <button
          onClick={() => setShowAddEquipmentModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Equipment</span>
        </button>
      </div>

      {/* Equipment Grid */}
      {isLoading ? (
        <EquipmentSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {equipment.map((item) => (
            <EquipmentCard
              key={item.id}
              equipment={item}
              onClick={() => setSelectedEquipment(item)}
            />
          ))}
        </div>
      )}

      {/* Equipment Details Modal */}
      {selectedEquipment && (
        <EquipmentDetailsModal
          equipment={selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
        />
      )}

      {/* Add Equipment Modal */}
      {showAddEquipmentModal && (
        <AddEquipmentModal onClose={() => setShowAddEquipmentModal(false)} />
      )}
    </div>
  );
};

// Budget Resource View
const BudgetResourceView = ({ dateRange }) => {
  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['budget-resources', dateRange],
    queryFn: () => resources.getBudgetData(dateRange),
  });

  const budget = budgetData?.data || {};

  if (isLoading) {
    return <BudgetSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${(budget.totalBudget || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${(budget.spent || 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {budget.totalBudget ? Math.round((budget.spent / budget.totalBudget) * 100) : 0}% of budget
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${((budget.totalBudget || 0) - (budget.spent || 0)).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {budget.totalBudget ? Math.round(((budget.totalBudget - budget.spent) / budget.totalBudget) * 100) : 0}% available
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Budget Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetBreakdownChart data={budget.breakdown} />
        <BudgetTrendChart data={budget.trends} />
      </div>

      {/* Budget Items */}
      <BudgetItemsList items={budget.items || []} />
    </div>
  );
};

// Resource Planning View
const ResourcePlanningView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // week, month

  const { data: planningData, isLoading } = useQuery({
    queryKey: ['resource-planning', currentDate, viewMode],
    queryFn: () => resources.getPlanningData(currentDate, viewMode),
  });

  const planningInfo = planningData?.data || {};

  return (
    <div className="space-y-6">
      {/* Planning Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              const newDate = new Date(currentDate);
              newDate.setDate(newDate.getDate() - (viewMode === 'week' ? 7 : 30));
              setCurrentDate(newDate);
            }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {viewMode === 'week' 
              ? `Week of ${currentDate.toLocaleDateString()}`
              : currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
            }
          </h2>

          <button
            onClick={() => {
              const newDate = new Date(currentDate);
              newDate.setDate(newDate.getDate() + (viewMode === 'week' ? 7 : 30));
              setCurrentDate(newDate);
            }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Month
            </button>
          </div>

          <button className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <CalendarIcon className="w-4 h-4" />
            <span>Schedule Resource</span>
          </button>
        </div>
      </div>

      {/* Resource Calendar */}
      {isLoading ? (
        <PlanningCalendarSkeleton />
      ) : (
        <ResourcePlanningCalendar
          data={planningInfo}
          viewMode={viewMode}
          currentDate={currentDate}
        />
      )}

      {/* Resource Conflicts */}
      <ResourceConflicts conflicts={planningInfo.conflicts || []} />
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ title, value, change, icon, color }) => {
  const isPositive = change >= 0;
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400'
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center space-x-1 mt-2 text-sm ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {React.cloneElement(icon, { className: "w-6 h-6" })}
        </div>
      </div>
    </div>
  );
};

// Team Member Card
const TeamMemberCard = ({ member, onClick }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case AVAILABILITY_STATUS.AVAILABLE:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case AVAILABILITY_STATUS.BUSY:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case AVAILABILITY_STATUS.OVERLOADED:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
          <User className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{member.role}</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              getStatusColor(member.status)
            }`}>
              {member.status.replace('_', ' ')}
            </span>
            {member.utilizationRate && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {member.utilizationRate}% utilized
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">{member.activeProjects || 0} projects</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">{member.hoursThisWeek || 0}h/week</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Equipment Card
const EquipmentCard = ({ equipment, onClick }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_use':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'retired':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'hardware':
        return <Settings className="w-6 h-6" />;
      case 'software':
        return <Globe className="w-6 h-6" />;
      case 'vehicle':
        return <MapPin className="w-6 h-6" />;
      case 'facility':
        return <Building className="w-6 h-6" />;
      default:
        return <Settings className="w-6 h-6" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-400">
          {getTypeIcon(equipment.type)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">{equipment.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{equipment.model || equipment.description}</p>
          <div className="flex items-center space-x-2 mt-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              getStatusColor(equipment.status)
            }`}>
              {equipment.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600 dark:text-gray-400">
            {equipment.location && (
              <div className="flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>{equipment.location}</span>
              </div>
            )}
          </div>
          {equipment.assignedTo && (
            <div className="text-gray-600 dark:text-gray-400">
              Assigned to {equipment.assignedTo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Resource Alerts
const ResourceAlerts = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Alerts</h3>
      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <div key={index} className={`p-3 rounded-lg border-l-4 ${
            alert.type === 'warning' 
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400'
              : alert.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-400'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-400'
          }`}>
            <div className="flex items-center space-x-2">
              {alert.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              ) : alert.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              )}
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white">{alert.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Skeleton Components
const OverviewSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      ))}
    </div>
  </div>
);

const TeamMembersSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const EquipmentSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const BudgetSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  </div>
);

const PlanningCalendarSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
    <div className="h-96 bg-gray-300 dark:bg-gray-600 rounded"></div>
  </div>
);

// Placeholder chart components
const ResourceUtilizationChart = ({ data }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Utilization</h3>
    <div className="h-64 flex items-center justify-center text-gray-400">
      <BarChart3 className="w-16 h-16" />
    </div>
  </div>
);

const TeamCapacityChart = ({ data }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Capacity</h3>
    <div className="h-64 flex items-center justify-center text-gray-400">
      <PieChart className="w-16 h-16" />
    </div>
  </div>
);

const BudgetBreakdownChart = ({ data }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Budget Breakdown</h3>
    <div className="h-64 flex items-center justify-center text-gray-400">
      <PieChart className="w-16 h-16" />
    </div>
  </div>
);

const BudgetTrendChart = ({ data }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Budget Trends</h3>
    <div className="h-64 flex items-center justify-center text-gray-400">
      <TrendingUp className="w-16 h-16" />
    </div>
  </div>
);

const BudgetItemsList = ({ items }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Budget Items</h3>
    {items.length === 0 ? (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No budget items found
      </div>
    ) : (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">{item.category}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900 dark:text-white">${item.amount.toLocaleString()}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{item.date}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const RecentResourceActivity = ({ activities }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
    {activities.length === 0 ? (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No recent activity
      </div>
    ) : (
      <div className="space-y-3">
        {activities.map((activity, index) => (
          <div key={index} className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-900 dark:text-white">
                <span className="font-medium">{activity.user}</span> {activity.action}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ResourcePlanningCalendar = ({ data, viewMode, currentDate }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
    <div className="text-center py-16 text-gray-500 dark:text-gray-400">
      <CalendarIcon className="w-16 h-16 mx-auto mb-4" />
      <p>Resource Planning Calendar</p>
      <p className="text-sm">Calendar view coming soon</p>
    </div>
  </div>
);

const ResourceConflicts = ({ conflicts }) => {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Conflicts</h3>
      <div className="space-y-3">
        {conflicts.map((conflict, index) => (
          <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 rounded">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{conflict.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{conflict.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Modal placeholders (these would be implemented with full forms)
const TeamMemberDetailsModal = ({ member, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Team Member Details</h2>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">Details for {member.name}</p>
        {/* Full member details would go here */}
      </div>
    </div>
  </div>
);

const AddTeamMemberModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Team Member</h2>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">Add team member form would go here</p>
      </div>
    </div>
  </div>
);

const EquipmentDetailsModal = ({ equipment, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Equipment Details</h2>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">Details for {equipment.name}</p>
        {/* Full equipment details would go here */}
      </div>
    </div>
  </div>
);

const AddEquipmentModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Equipment</h2>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-gray-400">Add equipment form would go here</p>
      </div>
    </div>
  </div>
);

export default ResourceManagement;