import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  BookOpen, 
  Plus, 
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  Activity,
  Building,
  User,
  Mail,
  Phone,
  UserMinus,
  Folder,
  List,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { programs, courses, users, folders, lists } from '../lib/api';
import { formatDate } from '../lib/utils';
import { ProgramBreadcrumb } from '../components/navigation/Breadcrumb';

const PROGRAM_TYPES = {
  program: { icon: Building, label: 'Program', color: 'bg-blue-500' },
  client: { icon: User, label: 'Client', color: 'bg-green-500' },
  department: { icon: Users, label: 'Department', color: 'bg-purple-500' }
};

export default function ProgramDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('courses');

  // Fetch program details
  const { data: programData, isLoading, error } = useQuery({
    queryKey: ['programs', id],
    queryFn: () => programs.getById(id),
  });

  // Fetch program courses
  const { data: coursesData } = useQuery({
    queryKey: ['courses', { program_id: id }],
    queryFn: () => courses.getAll({ program_id: id }),
    enabled: !!id,
  });

  const program = programData?.data?.data || programData?.data;
  const programCourses = Array.isArray(coursesData?.data?.data) ? coursesData.data.data : 
                        Array.isArray(coursesData?.data) ? coursesData.data : [];
  
  const TypeIcon = program ? PROGRAM_TYPES[program.type]?.icon || Building : Building;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded mb-6"></div>
          <div className="h-64 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">
            Failed to load program: {error.response?.data?.message || error.message}
          </p>
          <button
            onClick={() => navigate('/programs')}
            className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Back to Programs
          </button>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Program not found</p>
          <button
            onClick={() => navigate('/programs')}
            className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Back to Programs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <ProgramBreadcrumb program={program} />
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <button
            onClick={() => navigate('/programs')}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-4">
            <div 
              className={`w-12 h-12 ${PROGRAM_TYPES[program.type]?.color || 'bg-gray-500'} rounded-lg flex items-center justify-center`}
            >
              <TypeIcon className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {program.name}
                </h1>
                {program.code && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded">
                    {program.code}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {PROGRAM_TYPES[program.type]?.label || 'Program'}
                </span>
                {program.owner_name && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Owner: {program.owner_name}
                    </span>
                  </>
                )}
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Created {formatDate(program.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Description */}
      {program.description && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-gray-700 dark:text-gray-300">{program.description}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {program.member_count || 0}
              </p>
              <p className="text-gray-600 dark:text-gray-400">Members</p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {program.course_count || 0}
              </p>
              <p className="text-gray-600 dark:text-gray-400">Courses</p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {programCourses.filter(c => c.status === 'active').length}
              </p>
              <p className="text-gray-600 dark:text-gray-400">Active</p>
            </div>
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {programCourses.filter(c => c.status === 'completed').length}
              </p>
              <p className="text-gray-600 dark:text-gray-400">Completed</p>
            </div>
            <Calendar className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Contact Info for Clients */}
      {program.type === 'client' && (program.contact_name || program.contact_email || program.contact_phone) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {program.contact_name && (
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                  <p className="text-gray-900 dark:text-white">{program.contact_name}</p>
                </div>
              </div>
            )}
            {program.contact_email && (
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                  <a 
                    href={`mailto:${program.contact_email}`}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {program.contact_email}
                  </a>
                </div>
              </div>
            )}
            {program.contact_phone && (
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                  <a 
                    href={`tel:${program.contact_phone}`}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {program.contact_phone}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('courses')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'courses'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              } transition-colors`}
            >
              Project Structure ({programCourses.length})
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              } transition-colors`}
            >
              Members ({program.member_count || 0})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'activity'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              } transition-colors`}
            >
              Activity
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'courses' && (
            <CoursesTab programId={id} courses={programCourses} />
          )}
          {activeTab === 'members' && (
            <MembersTab programId={id} program={program} />
          )}
          {activeTab === 'activity' && (
            <ActivityTab programId={id} />
          )}
        </div>
      </div>
    </div>
  );
}

// Courses Tab Component with Hierarchical Display
function CoursesTab({ programId, courses }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedFolders, setExpandedFolders] = useState({});
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [openFolderDropdown, setOpenFolderDropdown] = useState(null);
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState(null);
  const [openListDropdown, setOpenListDropdown] = useState(null);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [listToEdit, setListToEdit] = useState(null);
  
  // Drag & Drop state

  // Fetch folders for this program
  const { data: foldersData } = useQuery({
    queryKey: ['folders', programId],
    queryFn: async () => {
      const response = await folders.getAll({ programId });
      return response.data?.data || response.data || [];
    },
    enabled: !!programId
  });

  // Fetch lists for all folders
  const folderIds = foldersData?.map(f => f.id) || [];
  const { data: listsData } = useQuery({
    queryKey: ['lists', folderIds],
    queryFn: async () => {
      if (folderIds.length === 0) return [];
      const promises = folderIds.map(folderId => 
        lists.getAll({ folderId }).then(response => {
          const listsInFolder = response.data?.data || response.data || [];
          // Ensure each list has the folder_id set
          return listsInFolder.map(list => ({ ...list, folder_id: list.folder_id || folderId }));
        })
      );
      const results = await Promise.all(promises);
      return results.flat();
    },
    enabled: folderIds.length > 0
  });

  // Fetch courses for this program
  const { data: coursesData } = useQuery({
    queryKey: ['courses', { program_id: programId }],
    queryFn: () => courses.getAll({ program_id: programId }),
    enabled: !!programId,
  });

  const programFolders = Array.isArray(foldersData) ? foldersData : [];
  const programLists = Array.isArray(listsData) ? listsData : [];
  // Handle the nested data structure from the API response
  const programCourses = Array.isArray(coursesData?.data?.data?.courses) ? coursesData.data.data.courses :
                        Array.isArray(coursesData?.data?.courses) ? coursesData.data.courses :
                        Array.isArray(coursesData?.data?.data) ? coursesData.data.data : 
                        Array.isArray(coursesData?.data) ? coursesData.data : [];


  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside of any dropdown
      if (!event.target.closest('.dropdown-menu') && !event.target.closest('.dropdown-trigger')) {
        setOpenFolderDropdown(null);
        setOpenListDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getListsForFolder = (folderId) => {
    return programLists.filter(list => list.folder_id === folderId);
  };

  const getCoursesForList = (listId) => {
    return programCourses.filter(course => {
      // Check both list_id and listId for compatibility
      return course.list_id === listId || course.listId === listId;
    });
  };

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: (folderId) => folders.delete(folderId),
    onSuccess: () => {
      toast.success('Folder deleted successfully');
      queryClient.invalidateQueries(['folders', programId]);
      queryClient.invalidateQueries(['programs', programId]);
      setOpenFolderDropdown(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete folder');
    }
  });

  const handleDeleteFolder = (folder) => {
    const folderLists = getListsForFolder(folder.id);
    const totalCourses = folderLists.reduce((total, list) => {
      return total + getCoursesForList(list.id).length;
    }, 0);
    
    const message = totalCourses > 0 
      ? `Are you sure you want to delete "${folder.name}"? This will also delete ${folderLists.length} lists and ${totalCourses} courses.`
      : `Are you sure you want to delete "${folder.name}"?`;
    
    if (window.confirm(message)) {
      deleteFolderMutation.mutate(folder.id);
    }
  };

  const handleEditFolder = (folder) => {
    setFolderToEdit(folder);
    setShowEditFolderModal(true);
    setOpenFolderDropdown(null);
  };

  // Delete list mutation
  const deleteListMutation = useMutation({
    mutationFn: (listId) => lists.delete(listId),
    onSuccess: () => {
      toast.success('List deleted successfully');
      queryClient.invalidateQueries(['lists']);
      queryClient.invalidateQueries(['folders']);
      setOpenListDropdown(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete list');
    }
  });

  const handleDeleteList = (list) => {
    const listCourses = getCoursesForList(list.id);
    
    const message = listCourses.length > 0 
      ? `Are you sure you want to delete "${list.name}"? This will also delete ${listCourses.length} courses.`
      : `Are you sure you want to delete "${list.name}"?`;
    
    if (window.confirm(message)) {
      deleteListMutation.mutate(list.id);
    }
  };

  const handleEditList = (list) => {
    setListToEdit(list);
    setShowEditListModal(true);
    setOpenListDropdown(null);
  };

  // Reorder mutations
  const reorderFoldersMutation = useMutation({
    mutationFn: (data) => folders.reorder(data),
    onSuccess: () => {
      toast.success('Folders reordered successfully');
      queryClient.invalidateQueries(['folders', programId]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to reorder folders');
    }
  });

  const reorderListsMutation = useMutation({
    mutationFn: (data) => lists.reorder(data),
    onSuccess: () => {
      toast.success('Lists reordered successfully');
      queryClient.invalidateQueries(['lists']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to reorder lists');
    }
  });

  // Move folder up or down
  const moveFolderPosition = (folder, direction) => {
    const folderIds = programFolders.map(f => f.id);
    const currentIndex = folderIds.indexOf(folder.id);
    
    if ((direction === 'up' && currentIndex === 0) || 
        (direction === 'down' && currentIndex === folderIds.length - 1)) {
      return; // Can't move further
    }
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newFolderIds = [...folderIds];
    
    // Swap positions
    [newFolderIds[currentIndex], newFolderIds[newIndex]] = 
    [newFolderIds[newIndex], newFolderIds[currentIndex]];
    
    const folderOrders = newFolderIds.map((id, index) => ({ id, position: index }));
    
    reorderFoldersMutation.mutate({
      programId: programId,
      folder_orders: folderOrders
    });
  };

  // Move list up or down within folder
  const moveListPosition = (list, direction) => {
    const folderLists = getListsForFolder(list.folder_id);
    const listIds = folderLists.map(l => l.id);
    const currentIndex = listIds.indexOf(list.id);
    
    if ((direction === 'up' && currentIndex === 0) || 
        (direction === 'down' && currentIndex === listIds.length - 1)) {
      return; // Can't move further
    }
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newListIds = [...listIds];
    
    // Swap positions
    [newListIds[currentIndex], newListIds[newIndex]] = 
    [newListIds[newIndex], newListIds[currentIndex]];
    
    const listOrders = newListIds.map((id, index) => ({ id, position: index }));
    
    reorderListsMutation.mutate({
      folderId: list.folder_id,
      list_orders: listOrders
    });
  };

  const moveCourseMutation = useMutation({
    mutationFn: (data) => courses.update(data.courseId, { list_id: data.newListId }),
    onSuccess: () => {
      toast.success('Course moved successfully');
      queryClient.invalidateQueries(['courses', { program_id: programId }]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to move course');
    }
  });

  const moveListMutation = useMutation({
    mutationFn: ({ listId, newFolderId }) => 
      lists.update(listId, { folder_id: newFolderId }),
    onSuccess: () => {
      toast.success('List moved to different folder');
      queryClient.invalidateQueries(['program', programId]);
      queryClient.invalidateQueries(['folders', programId]);
      queryClient.invalidateQueries(['lists']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to move list');
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Project Structure</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Folder</span>
          </button>
        </div>
      </div>

      {programFolders.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No folders yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create folders to organize your lists and courses
          </p>
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="inline-flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Folder</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {programFolders.map((folder, index) => {
            const folderLists = getListsForFolder(folder.id);
            const isExpanded = expandedFolders[folder.id];
            
            return (
              <div 
                key={folder.id} 
                className="border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                {/* Folder Header */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => toggleFolder(folder.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex flex-col">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFolderPosition(folder, 'up');
                        }}
                        disabled={index === 0}
                        className={`p-0.5 ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Move up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFolderPosition(folder, 'down');
                        }}
                        disabled={index === programFolders.length - 1}
                        className={`p-0.5 ${index === programFolders.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Move down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
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
                      ({folderLists.length} lists)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFolderId(folder.id);
                        setShowCreateListModal(true);
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      + List
                    </button>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFolderDropdown(openFolderDropdown === folder.id ? null : folder.id);
                        }}
                        className="dropdown-trigger p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      
                      {openFolderDropdown === folder.id && (
                        <div className="dropdown-menu absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                          <div className="py-1">
                            <button
                              onClick={() => handleEditFolder(folder)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit folder
                            </button>
                            <button
                              onClick={() => handleDeleteFolder(folder)}
                              disabled={deleteFolderMutation.isPending}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {deleteFolderMutation.isPending ? 'Deleting...' : 'Delete folder'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Folder Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {folderLists.length === 0 ? (
                      <div className="p-8 text-center">
                        <List className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          No lists in this folder
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {folderLists.map((list, listIndex) => {
                          const listCourses = getCoursesForList(list.id);
                          
                          return (
                            <div 
                              key={list.id}
                              className=""
                            >
                              {/* List Header */}
                              <div 
                                className="flex items-center justify-between p-3 pl-8 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="flex flex-col">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveListPosition(list, 'up');
                                      }}
                                      disabled={listIndex === 0}
                                      className={`p-0.5 ${listIndex === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                                      title="Move up"
                                    >
                                      <ArrowUp className="w-2 h-2" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveListPosition(list, 'down');
                                      }}
                                      disabled={listIndex === folderLists.length - 1}
                                      className={`p-0.5 ${listIndex === folderLists.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                                      title="Move down"
                                    >
                                      <ArrowDown className="w-2 h-2" />
                                    </button>
                                  </div>
                                  <List className="w-4 h-4 text-blue-500" />
                                  <span className="text-gray-900 dark:text-white">
                                    {list.name}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ({listCourses.length} courses)
                                  </span>
                                </div>
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenListDropdown(openListDropdown === list.id ? null : list.id);
                                    }}
                                    className="dropdown-trigger p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  >
                                    <MoreHorizontal className="w-3 h-3" />
                                  </button>
                                  
                                  {openListDropdown === list.id && (
                                    <div className="dropdown-menu absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                                      <div className="py-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditList(list);
                                          }}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                                        >
                                          <Edit className="w-3 h-3 mr-2" />
                                          Edit list
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteList(list);
                                          }}
                                          disabled={deleteListMutation.isPending}
                                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                                        >
                                          <Trash2 className="w-3 h-3 mr-2" />
                                          {deleteListMutation.isPending ? 'Deleting...' : 'Delete list'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

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

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <CreateFolderModal 
          programId={programId}
          onClose={() => setShowCreateFolderModal(false)}
        />
      )}

      {/* Create List Modal */}
      {showCreateListModal && (
        <CreateListModal 
          folderId={selectedFolderId}
          onClose={() => {
            setShowCreateListModal(false);
            setSelectedFolderId(null);
          }}
        />
      )}

      {/* Edit Folder Modal */}
      {showEditFolderModal && (
        <EditFolderModal 
          folder={folderToEdit}
          onClose={() => {
            setShowEditFolderModal(false);
            setFolderToEdit(null);
          }}
        />
      )}

      {/* Edit List Modal */}
      {showEditListModal && (
        <EditListModal 
          list={listToEdit}
          onClose={() => {
            setShowEditListModal(false);
            setListToEdit(null);
          }}
        />
      )}
    </div>
  );
}

// Members Tab Component
function MembersTab({ programId, program }) {
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const queryClient = useQueryClient();
  
  // Handle members data - might be JSON string or array
  let members = [];
  if (program?.members) {
    if (Array.isArray(program.members)) {
      members = program.members;
    } else if (typeof program.members === 'string') {
      try {
        members = JSON.parse(program.members);
      } catch (e) {
        console.error('Failed to parse members JSON:', e);
        members = [];
      }
    }
  }

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId) => programs.removeMember(programId, userId),
    onSuccess: () => {
      toast.success('Member removed successfully');
      queryClient.invalidateQueries(['programs', programId]);
      queryClient.invalidateQueries(['programs']);
      setOpenDropdownId(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    }
  });

  const handleRemoveMember = (userId, memberName) => {
    if (window.confirm(`Are you sure you want to remove ${memberName} from this program?`)) {
      removeMemberMutation.mutate(userId);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest('.relative')) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Members</h3>
        <button 
          onClick={() => setShowAddMemberModal(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Member</span>
        </button>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No members yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Add team members to collaborate on this program
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.full_name || member.name || 'No name'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {member.role}
                    </p>
                  </div>
                </div>
                
                {/* Dropdown Menu */}
                <div className="relative">
                  <button 
                    onClick={() => setOpenDropdownId(openDropdownId === member.id ? null : member.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  
                  {openDropdownId === member.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                      <div className="py-1">
                        <button
                          onClick={() => handleRemoveMember(member.id, member.full_name || member.name)}
                          disabled={removeMemberMutation.isPending}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                        >
                          <UserMinus className="w-4 h-4 mr-2" />
                          {removeMemberMutation.isPending ? 'Removing...' : 'Remove from program'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal 
          programId={programId}
          onClose={() => setShowAddMemberModal(false)}
        />
      )}
    </div>
  );
}

// Add Member Modal Component
function AddMemberModal({ programId, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState('member');

  // Fetch users for selection
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await users.getAll();
      return response.data?.data?.users || response.data?.users || response.data?.data || response.data || [];
    }
  });

  const usersList = Array.isArray(usersData) ? usersData : [];
  const filteredUsers = usersList.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserToggle = (user) => {
    setSelectedUsers(prev => 
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // TODO: Implement add members API call
    console.log('Adding members:', selectedUsers, 'with role:', selectedRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Members</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search Users */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Users
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* User List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Users ({selectedUsers.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No users found</div>
              ) : (
                filteredUsers.map(user => (
                  <label
                    key={user.id}
                    className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.some(u => u.id === user.id)}
                      onChange={() => handleUserToggle(user)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedUsers.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add {selectedUsers.length} Member{selectedUsers.length !== 1 ? 's' : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Activity Tab Component
function ActivityTab({ programId }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
      
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No activity yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Activity will appear here as team members work on courses
        </p>
      </div>
    </div>
  );
}

// Create Folder Modal Component
function CreateFolderModal({ programId, onClose }) {
  const [folderName, setFolderName] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const createFolderMutation = useMutation({
    mutationFn: (folderData) => folders.create(folderData),
    onSuccess: () => {
      toast.success('Folder created successfully');
      queryClient.invalidateQueries(['folders', programId]);
      queryClient.invalidateQueries(['programs', programId]);
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create folder');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    createFolderMutation.mutate({
      name: folderName.trim(),
      description: description.trim() || null,
      programId: programId
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Folder</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Folder Name *
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g., Course Development"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this folder's purpose..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createFolderMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createFolderMutation.isPending ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Folder Modal Component
function EditFolderModal({ folder, onClose }) {
  const [folderName, setFolderName] = useState(folder?.name || '');
  const [description, setDescription] = useState(folder?.description || '');
  const queryClient = useQueryClient();

  const updateFolderMutation = useMutation({
    mutationFn: (folderData) => folders.update(folder.id, folderData),
    onSuccess: () => {
      toast.success('Folder updated successfully');
      queryClient.invalidateQueries(['folders']);
      queryClient.invalidateQueries(['programs']);
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update folder');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    updateFolderMutation.mutate({
      name: folderName.trim(),
      description: description.trim() || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Folder</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Folder Name *
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g., Course Development"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this folder's purpose..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateFolderMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateFolderMutation.isPending ? 'Updating...' : 'Update Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create List Modal Component
function CreateListModal({ folderId, onClose }) {
  const [listName, setListName] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const createListMutation = useMutation({
    mutationFn: (listData) => lists.create(listData),
    onSuccess: () => {
      toast.success('List created successfully');
      queryClient.invalidateQueries(['lists']);
      queryClient.invalidateQueries(['folders']);
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create list');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!listName.trim()) {
      toast.error('List name is required');
      return;
    }

    createListMutation.mutate({
      name: listName.trim(),
      description: description.trim() || null,
      folderId: folderId
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New List</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              List Name *
            </label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g., Development, Review, Testing"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this list's purpose..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createListMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createListMutation.isPending ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit List Modal Component
function EditListModal({ list, onClose }) {
  const [listName, setListName] = useState(list?.name || '');
  const [description, setDescription] = useState(list?.description || '');
  const queryClient = useQueryClient();

  const updateListMutation = useMutation({
    mutationFn: (listData) => lists.update(list.id, listData),
    onSuccess: () => {
      toast.success('List updated successfully');
      queryClient.invalidateQueries(['lists']);
      queryClient.invalidateQueries(['folders']);
      onClose();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update list');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!listName.trim()) {
      toast.error('List name is required');
      return;
    }

    updateListMutation.mutate({
      name: listName.trim(),
      description: description.trim() || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit List</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              List Name *
            </label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g., Development, Review, Testing"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this list's purpose..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateListMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateListMutation.isPending ? 'Updating...' : 'Update List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}