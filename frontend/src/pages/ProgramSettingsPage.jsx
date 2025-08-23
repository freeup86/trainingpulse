import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  Folder,
  List,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Move,
  Archive,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { programs, folders, lists, courses } from '../lib/api';
import { ProgramSettingsBreadcrumb } from '../components/navigation/Breadcrumb';

export default function ProgramSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('structure');
  const [expandedFolders, setExpandedFolders] = useState({});

  // Fetch program details
  const { data: programData, isLoading, error } = useQuery({
    queryKey: ['programs', id],
    queryFn: () => programs.getById(id),
  });

  // Fetch folders for this program
  const { data: foldersData } = useQuery({
    queryKey: ['folders', id],
    queryFn: async () => {
      const response = await folders.getAll({ programId: id });
      return response.data?.data || response.data || [];
    },
    enabled: !!id
  });

  // Fetch lists for all folders
  const folderIds = foldersData?.map(f => f.id) || [];
  const { data: listsData } = useQuery({
    queryKey: ['lists', folderIds],
    queryFn: async () => {
      if (folderIds.length === 0) return [];
      const promises = folderIds.map(folderId => 
        lists.getAll({ folderId }).then(response => response.data?.data || response.data || [])
      );
      const results = await Promise.all(promises);
      return results.flat();
    },
    enabled: folderIds.length > 0
  });

  // Fetch courses for this program
  const { data: coursesData } = useQuery({
    queryKey: ['courses', { program_id: id }],
    queryFn: () => courses.getAll({ program_id: id }),
  });

  const program = programData?.data?.data || programData?.data;
  const programFolders = Array.isArray(foldersData) ? foldersData : [];
  const programLists = Array.isArray(listsData) ? listsData : [];
  const programCourses = Array.isArray(coursesData?.data?.data || coursesData?.data) ? coursesData?.data?.data || coursesData?.data : [];

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const getListsForFolder = (folderId) => {
    return programLists.filter(list => list.folder_id === folderId);
  };

  const getCoursesForList = (listId) => {
    return programCourses.filter(course => course.list_id === listId);
  };

  const getTotalCourses = () => {
    return programCourses.length;
  };

  const getStructureStats = () => {
    const totalFolders = programFolders.length;
    const totalLists = programLists.length;
    const totalCourses = programCourses.length;
    
    const folderStats = programFolders.map(folder => {
      const folderLists = getListsForFolder(folder.id);
      const folderCourses = folderLists.reduce((total, list) => {
        return total + getCoursesForList(list.id).length;
      }, 0);
      
      return {
        folder,
        lists: folderLists.length,
        courses: folderCourses
      };
    });

    return {
      totalFolders,
      totalLists,
      totalCourses,
      folderStats
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Program Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The program you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => navigate('/programs')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Programs
          </button>
        </div>
      </div>
    );
  }

  const stats = getStructureStats();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/programs/${id}`)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {program.name} Settings
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage structure, permissions, and configuration
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Settings className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <ProgramSettingsBreadcrumb program={program} />
        
        <div className="flex space-x-8">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('structure')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'structure'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <Folder className="w-4 h-4 mr-3" />
                  Structure Management
                </div>
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'members'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-3" />
                  Members & Permissions
                </div>
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'bulk'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <Move className="w-4 h-4 mr-3" />
                  Bulk Operations
                </div>
              </button>
              <button
                onClick={() => setActiveTab('archive')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'archive'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <Archive className="w-4 h-4 mr-3" />
                  Archive & Cleanup
                </div>
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'structure' && (
              <StructureManagementTab 
                program={program}
                stats={stats}
                programFolders={programFolders}
                programLists={programLists}
                programCourses={programCourses}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                getListsForFolder={getListsForFolder}
                getCoursesForList={getCoursesForList}
              />
            )}
            {activeTab === 'members' && (
              <MembersPermissionsTab program={program} />
            )}
            {activeTab === 'bulk' && (
              <BulkOperationsTab 
                program={program}
                programFolders={programFolders}
                programLists={programLists}
                programCourses={programCourses}
              />
            )}
            {activeTab === 'archive' && (
              <ArchiveCleanupTab program={program} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Structure Management Tab Component
function StructureManagementTab({ 
  program, 
  stats, 
  programFolders, 
  programLists, 
  programCourses,
  expandedFolders,
  toggleFolder,
  getListsForFolder,
  getCoursesForList
}) {
  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Structure Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalFolders}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Folders
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.totalLists}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Lists
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.totalCourses}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Courses
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.totalCourses > 0 ? Math.round(stats.totalCourses / Math.max(stats.totalLists, 1)) : 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Avg Courses/List
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Structure View */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Folder Structure
          </h3>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Folder
          </button>
        </div>

        {programFolders.length === 0 ? (
          <div className="text-center py-8">
            <Folder className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No folders created yet. Create folders to organize your lists and courses.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {programFolders.map((folder) => {
              const folderLists = getListsForFolder(folder.id);
              const isExpanded = expandedFolders[folder.id];
              const folderCourses = folderLists.reduce((total, list) => {
                return total + getCoursesForList(list.id).length;
              }, 0);
              
              return (
                <div key={folder.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  {/* Folder Header */}
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => toggleFolder(folder.id)}
                  >
                    <div className="flex items-center space-x-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <Folder className="w-5 h-5 text-yellow-500" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {folder.name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {folderLists.length} lists • {folderCourses} courses
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Folder Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                      {folderLists.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          No lists in this folder
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {folderLists.map((list) => {
                            const listCourses = getCoursesForList(list.id);
                            return (
                              <div key={list.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
                                <div className="flex items-center space-x-3">
                                  <List className="w-4 h-4 text-blue-500" />
                                  <span className="text-gray-900 dark:text-white">
                                    {list.name}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {listCourses.length} courses
                                  </span>
                                </div>
                                <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Members & Permissions Tab Component
function MembersPermissionsTab({ program }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Members & Permissions
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        Member management functionality will be implemented here.
      </p>
    </div>
  );
}

// Bulk Operations Tab Component
function BulkOperationsTab({ program, programFolders, programLists, programCourses }) {
  const queryClient = useQueryClient();
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [targetListId, setTargetListId] = useState('');
  const [bulkAction, setBulkAction] = useState('move'); // 'move', 'status', 'delete'
  const [bulkStatus, setBulkStatus] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Bulk move courses mutation
  const bulkMoveMutation = useMutation({
    mutationFn: async ({ courseIds, targetListId }) => {
      const promises = courseIds.map(courseId =>
        courses.update(courseId, { list_id: targetListId })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success(`${selectedCourses.length} courses moved successfully`);
      queryClient.invalidateQueries(['courses']);
      setSelectedCourses([]);
      setShowConfirmDialog(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to move courses');
    }
  });

  // Bulk status update mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ courseIds, status }) => {
      const promises = courseIds.map(courseId =>
        courses.update(courseId, { status })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success(`${selectedCourses.length} courses updated successfully`);
      queryClient.invalidateQueries(['courses']);
      setSelectedCourses([]);
      setShowConfirmDialog(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update courses');
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async ({ courseIds }) => {
      const promises = courseIds.map(courseId => courses.delete(courseId));
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success(`${selectedCourses.length} courses deleted successfully`);
      queryClient.invalidateQueries(['courses']);
      setSelectedCourses([]);
      setShowConfirmDialog(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete courses');
    }
  });

  const handleCourseToggle = (courseId) => {
    setSelectedCourses(prev => 
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCourses.length === programCourses.length) {
      setSelectedCourses([]);
    } else {
      setSelectedCourses(programCourses.map(course => course.id));
    }
  };

  const getListsForCourse = (course) => {
    const list = programLists.find(l => l.id === course.list_id);
    if (!list) return 'Unknown List';
    
    const folder = programFolders.find(f => f.id === list.folder_id);
    return `${folder?.name || 'Unknown'} → ${list.name}`;
  };

  const handleBulkAction = () => {
    if (selectedCourses.length === 0) {
      toast.error('Please select at least one course');
      return;
    }

    if (bulkAction === 'move' && !targetListId) {
      toast.error('Please select a target list');
      return;
    }

    if (bulkAction === 'status' && !bulkStatus) {
      toast.error('Please select a status');
      return;
    }

    setShowConfirmDialog(true);
  };

  const executeBulkAction = () => {
    switch (bulkAction) {
      case 'move':
        bulkMoveMutation.mutate({ courseIds: selectedCourses, targetListId });
        break;
      case 'status':
        bulkStatusMutation.mutate({ courseIds: selectedCourses, status: bulkStatus });
        break;
      case 'delete':
        bulkDeleteMutation.mutate({ courseIds: selectedCourses });
        break;
    }
  };

  const getTargetList = () => {
    const list = programLists.find(l => l.id === targetListId);
    if (!list) return null;
    const folder = programFolders.find(f => f.id === list.folder_id);
    return `${folder?.name || 'Unknown'} → ${list.name}`;
  };

  return (
    <div className="space-y-6">
      {/* Bulk Action Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Bulk Operations
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Action Type
            </label>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="move">Move to List</option>
              <option value="status">Update Status</option>
              <option value="delete">Delete Courses</option>
            </select>
          </div>

          {/* Target List (for move action) */}
          {bulkAction === 'move' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target List
              </label>
              <select
                value={targetListId}
                onChange={(e) => setTargetListId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select a list...</option>
                {programLists.map(list => {
                  const folder = programFolders.find(f => f.id === list.folder_id);
                  return (
                    <option key={list.id} value={list.id}>
                      {folder?.name} → {list.name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Status (for status update action) */}
          {bulkAction === 'status' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Status
              </label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select status...</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Execute Button */}
          <div className="flex items-end">
            <button
              onClick={handleBulkAction}
              disabled={selectedCourses.length === 0 || bulkMoveMutation.isPending || bulkStatusMutation.isPending || bulkDeleteMutation.isPending}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bulkMoveMutation.isPending || bulkStatusMutation.isPending || bulkDeleteMutation.isPending
                ? 'Processing...'
                : `Execute (${selectedCourses.length})`}
            </button>
          </div>
        </div>

        {selectedCourses.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {selectedCourses.length} course{selectedCourses.length > 1 ? 's' : ''} selected
            </p>
          </div>
        )}
      </div>

      {/* Course Selection Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">
              Select Courses ({programCourses.length} total)
            </h4>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {selectedCourses.length === programCourses.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {programCourses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No courses found in this program
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {programCourses.map((course) => (
                <div
                  key={course.id}
                  className={`flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedCourses.includes(course.id) 
                      ? 'bg-blue-50 dark:bg-blue-900/20' 
                      : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(course.id)}
                    onChange={() => handleCourseToggle(course.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                          {course.title || course.name}
                        </h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {getListsForCourse(course)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          course.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          course.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          course.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {course.status}
                        </span>
                        {course.modality && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded text-xs">
                            {course.modality}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confirm Bulk Action
              </h3>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 dark:text-gray-400">
                You are about to {bulkAction} {selectedCourses.length} course{selectedCourses.length > 1 ? 's' : ''}:
              </p>
              
              {bulkAction === 'move' && (
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  Target: {getTargetList()}
                </p>
              )}
              
              {bulkAction === 'status' && (
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  New Status: {bulkStatus}
                </p>
              )}
              
              {bulkAction === 'delete' && (
                <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                  This action cannot be undone.
                </p>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkAction}
                disabled={bulkMoveMutation.isPending || bulkStatusMutation.isPending || bulkDeleteMutation.isPending}
                className={`px-4 py-2 text-white rounded-md transition-colors ${
                  bulkAction === 'delete' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {bulkMoveMutation.isPending || bulkStatusMutation.isPending || bulkDeleteMutation.isPending
                  ? 'Processing...'
                  : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Archive & Cleanup Tab Component
function ArchiveCleanupTab({ program }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Archive & Cleanup
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        Archive and cleanup functionality will be implemented here.
      </p>
    </div>
  );
}