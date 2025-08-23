import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutDashboard,
  Users,
  BarChart3,
  Workflow,
  Bell,
  Settings,
  FileSpreadsheet,
  Shield,
  ClipboardList,
  Building,
  ChevronDown,
  ChevronRight,
  Folder,
  List as ListIcon,
  BookOpen,
  X,
  Plus,
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { usePermissions } from '../../hooks/usePermissions';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import api, { programs, folders, lists } from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const staticNavigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permissions: []
  }
];

const bottomNavigation = [
  {
    name: 'Assignments',
    href: '/assignments',
    icon: ClipboardList,
    permissions: ['courses.view']
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    permissions: ['analytics.view']
  },
  {
    name: 'Data Management',
    href: '/bulk',
    icon: FileSpreadsheet,
    permissions: ['bulk.execute']
  },
  {
    name: 'Notifications',
    href: '/notifications',
    icon: Bell,
    permissions: ['notifications.view']
  },
  {
    name: 'Admin',
    href: '/admin',
    icon: Shield,
    permissions: ['admin.settings.manage', 'admin.roles.manage', 'admin.permissions.manage', 'users.view']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    permissions: []
  }
];

export function HierarchicalSidebar({ isOpen, isVisible, isCollapsed, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasAnyPermission } = usePermissions();
  
  // State for expanded items
  const [expandedPrograms, setExpandedPrograms] = useState(new Set());
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  
  // State for modals
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  
  // State for dropdown menus
  const [openFolderDropdown, setOpenFolderDropdown] = useState(null);
  const [openListDropdown, setOpenListDropdown] = useState(null);
  

  // Fetch hierarchy data
  const { data: programsData } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const response = await programs.getAll();
      return response.data?.data || response.data || [];
    },
    enabled: !!user?.id
  });

  // Fetch all folders for all programs
  const { data: foldersData } = useQuery({
    queryKey: ['folders', 'all'],
    queryFn: async () => {
      if (!programsData || programsData.length === 0) return [];
      
      const allFolders = [];
      for (const program of programsData) {
        try {
          const response = await folders.getAll({ programId: program.id });
          const programFolders = response.data?.data || response.data || [];
          allFolders.push(...programFolders);
        } catch (error) {
          console.error(`Failed to fetch folders for program ${program.id}:`, error);
        }
      }
      return allFolders;
    },
    enabled: !!user?.id && !!programsData && programsData.length > 0
  });

  // Fetch all lists for all folders
  const { data: listsData } = useQuery({
    queryKey: ['lists', 'all', foldersData?.map(f => f.id).sort()], 
    queryFn: async () => {
      if (!foldersData || foldersData.length === 0) return [];
      
      const allLists = [];
      for (const folder of foldersData) {
        try {
          const response = await lists.getAll({ folderId: folder.id });
          const folderLists = response.data?.data || response.data || [];
          allLists.push(...folderLists);
        } catch (error) {
          // Silently ignore 404 errors for deleted folders
          if (error.response?.status !== 404) {
            console.error(`Failed to fetch lists for folder ${folder.id}:`, error);
          }
        }
      }
      return allLists;
    },
    enabled: !!user?.id && !!foldersData && foldersData.length > 0,
    retry: (failureCount, error) => {
      // Don't retry on 404 errors (folder not found)
      if (error?.response?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 0 // Always consider data stale to respect cache updates
  });

  // Auto-expand based on current route
  useEffect(() => {
    if (location.pathname.startsWith('/lists/')) {
      const listId = location.pathname.split('/')[2];
      const list = listsData?.find(l => l.id === listId);
      if (list) {
        const folder = foldersData?.find(f => f.id === list.folder_id);
        if (folder) {
          setExpandedPrograms(prev => new Set([...prev, folder.program_id]));
          setExpandedFolders(prev => new Set([...prev, folder.id]));
        }
      }
    }
  }, [location.pathname, listsData, foldersData]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setOpenFolderDropdown(null);
        setOpenListDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleProgram = (programId) => {
    setExpandedPrograms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(programId)) {
        newSet.delete(programId);
        // Also collapse all folders in this program
        const programFolders = foldersData?.filter(f => f.program_id === programId) || [];
        programFolders.forEach(folder => {
          setExpandedFolders(prevFolders => {
            const newFolderSet = new Set(prevFolders);
            newFolderSet.delete(folder.id);
            return newFolderSet;
          });
        });
      } else {
        newSet.add(programId);
      }
      return newSet;
    });
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleListClick = (listId) => {
    navigate(`/lists/${listId}/courses`);
    onClose();
  };

  const handleCreateFolder = (programId) => {
    setSelectedProgramId(programId);
    setShowCreateFolderModal(true);
  };

  const handleCreateList = (folderId) => {
    setSelectedFolderId(folderId);
    setShowCreateListModal(true);
  };

  // Delete mutations
  const deleteFolderMutation = useMutation({
    mutationFn: ({ folderId, force = true }) => {
      // Add force parameter as query string
      return api.delete(`/folders/${folderId}`, {
        params: { force }
      });
    },
    onSuccess: () => {
      toast.success('Folder deleted successfully');
      queryClient.invalidateQueries(['folders']);
      queryClient.invalidateQueries(['programs']);
      queryClient.invalidateQueries(['lists']);
      setOpenFolderDropdown(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete folder');
    }
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId) => lists.delete(listId),
    onSuccess: (data, listId) => {
      toast.success('List deleted successfully');
      
      // Remove the deleted list from cache to prevent stale data
      queryClient.setQueryData(['lists', 'all'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter(list => list.id !== listId);
      });
      
      // Then invalidate to refresh from server
      queryClient.invalidateQueries(['lists']);
      queryClient.invalidateQueries(['folders']);
      setOpenListDropdown(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete list');
    }
  });

  const handleDeleteFolder = (folder) => {
    // Simple confirmation - let the backend handle validation
    const message = `Are you sure you want to delete "${folder.name}"? This will also delete any lists and courses within it.`;
    
    if (window.confirm(message)) {
      deleteFolderMutation.mutate({ folderId: folder.id, force: true });
    }
  };

  const handleDeleteList = (list) => {
    if (window.confirm(`Are you sure you want to delete "${list.name}"?`)) {
      deleteListMutation.mutate(list.id);
    }
  };

  // Filter navigation items based on user permissions
  const filteredStaticNav = staticNavigation.filter(item => {
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }
    return hasAnyPermission(item.permissions);
  });

  const filteredBottomNav = bottomNavigation.filter(item => {
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }
    return hasAnyPermission(item.permissions);
  });

  const NavItem = ({ item, level = 0 }) => {
    const isActive = location.pathname.startsWith(item.href);
    const paddingLeft = isCollapsed ? 'px-1' : `pl-${1 + level * 2} pr-1`;
    
    return (
      <Link
        to={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center rounded-lg text-sm font-medium transition-colors group relative',
          isCollapsed ? 'justify-center py-2' : `${paddingLeft} py-1.5`,
          isActive
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
        )}
        title={isCollapsed ? item.name : undefined}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && <span className="ml-2 truncate">{item.name}</span>}
        
        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {item.name}
          </div>
        )}
      </Link>
    );
  };

  const ProgramItem = ({ program }) => {
    const isExpanded = expandedPrograms.has(program.id);
    const programFolders = foldersData?.filter(f => f.program_id === program.id) || [];
    const paddingLeft = isCollapsed ? 'px-1' : 'pl-1 pr-1';

    return (
      <div>
        <div className={cn(
          'flex items-center group',
          isCollapsed ? 'justify-center' : ''
        )}>
          <button
            onClick={() => toggleProgram(program.id)}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors relative',
              isCollapsed ? 'justify-center py-2 w-full' : `${paddingLeft} py-1.5 flex-1`,
              'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
            )}
            title={isCollapsed ? program.name : undefined}
          >
            {!isCollapsed && (
              <ChevronRight className={cn(
                "h-4 w-4 transition-transform mr-1 flex-shrink-0",
                isExpanded && "rotate-90",
                programFolders.length === 0 && "opacity-30"
              )} />
            )}
            <Building className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && (
              <span className="ml-2 flex-1 text-left truncate">{program.name}</span>
            )}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {program.name}
              </div>
            )}
          </button>
          
          {/* Add Folder Button - Only visible on hover */}
          {!isCollapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateFolder(program.id);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors mr-1 opacity-0 group-hover:opacity-100"
              title="Add new folder"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Folders */}
        {!isCollapsed && isExpanded && programFolders.map(folder => (
          <FolderItem key={folder.id} folder={folder} />
        ))}
      </div>
    );
  };

  const FolderItem = ({ folder }) => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderLists = listsData?.filter(l => l.folder_id === folder.id) || [];

    return (
      <div>
        <div className="flex items-center pl-5 pr-1 group relative">
          <button
            onClick={() => toggleFolder(folder.id)}
            className={cn(
              'flex items-center rounded-lg text-sm transition-colors py-1 flex-1',
              'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-750 dark:hover:text-white'
            )}
          >
            <ChevronRight className={cn(
              "h-3 w-3 transition-transform mr-1 flex-shrink-0",
              isExpanded && "rotate-90",
              folderLists.length === 0 && "opacity-30"
            )} />
            <Folder className="h-4 w-4 flex-shrink-0" />
            <span className="ml-2 flex-1 text-left truncate">{folder.name}</span>
          </button>
          
          {/* Three-dot menu - Visible on hover or when dropdown is open */}
          <div className={`relative ${openFolderDropdown === folder.id ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-150`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenFolderDropdown(openFolderDropdown === folder.id ? null : folder.id);
              }}
              className="dropdown-trigger p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              title="Folder options"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
            
            {openFolderDropdown === folder.id && (
              <div className="absolute right-0 mt-0 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder);
                  }}
                  disabled={deleteFolderMutation.isPending}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  {deleteFolderMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            )}
          </div>
          
          {/* Add List Button - Only visible on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCreateList(folder.id);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Add new list"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Lists */}
        {isExpanded && folderLists.map(list => (
          <ListItem key={list.id} list={list} />
        ))}
      </div>
    );
  };

  const ListItem = ({ list }) => {
    const isActive = location.pathname === `/lists/${list.id}/courses`;
    
    return (
      <div className="flex items-center pl-9 pr-1 group relative">
        <button
          onClick={() => handleListClick(list.id)}
          className={cn(
            'flex items-center rounded-lg text-sm transition-colors py-1 flex-1',
            isActive
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-750 dark:hover:text-white'
          )}
        >
          <ListIcon className="h-4 w-4 flex-shrink-0" />
          <span className="ml-2 flex-1 text-left truncate">{list.name}</span>
        </button>
        
        {/* Three-dot menu - Visible on hover or when dropdown is open */}
        <div className={`relative ${openListDropdown === list.id ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-150`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenListDropdown(openListDropdown === list.id ? null : list.id);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            title="List options"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
          
          {openListDropdown === list.id && (
            <div className="absolute right-0 mt-0 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteList(list);
                }}
                disabled={deleteListMutation.isPending}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                {deleteListMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-200 ease-in-out',
          // Width based on collapsed state
          isCollapsed ? 'w-16' : 'w-64',
          // Mobile behavior
          'md:static md:inset-0',
          // Mobile state
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop state
          'md:translate-x-0',
          !isVisible && 'md:-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 md:hidden">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TP</span>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">TrainingPulse</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Desktop Header - Logo for collapsed state */}
          <div className={cn(
            "hidden md:flex items-center justify-center border-b border-gray-200 dark:border-gray-700",
            isCollapsed ? "p-3" : "p-4"
          )}>
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TP</span>
            </div>
            {!isCollapsed && (
              <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">TrainingPulse</span>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {/* Static navigation */}
            {filteredStaticNav.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}

            {/* Hierarchy Section */}
            {!isCollapsed && hasAnyPermission(['courses.view']) && (
              <div className="pt-4">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Course Hierarchy
                </div>
                {programsData?.map(program => (
                  <ProgramItem key={program.id} program={program} />
                ))}
              </div>
            )}

            {/* Collapsed hierarchy */}
            {isCollapsed && hasAnyPermission(['courses.view']) && programsData?.map(program => (
              <ProgramItem key={program.id} program={program} />
            ))}

            {/* Bottom navigation */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              {filteredBottomNav.map((item) => (
                <NavItem key={item.name} item={item} />
              ))}
            </div>
          </nav>

          {/* Footer */}
          <div className={cn(
            "border-t border-gray-200 dark:border-gray-700",
            isCollapsed ? "p-3" : "p-4"
          )}>
            {isCollapsed ? (
              <div className="flex justify-center">
                <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-gray-700 dark:text-gray-300 font-medium text-xs">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p className="font-medium">{user?.name}</p>
                <p>{user?.email}</p>
                <p className="mt-1">Team: {user?.teamName || 'No team'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <CreateFolderModal 
          programId={selectedProgramId}
          onClose={() => {
            setShowCreateFolderModal(false);
            setSelectedProgramId(null);
          }}
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
    </>
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
      queryClient.invalidateQueries(['folders']);
      queryClient.invalidateQueries(['programs']);
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
            <X className="h-5 w-5" />
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
            <X className="h-5 w-5" />
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