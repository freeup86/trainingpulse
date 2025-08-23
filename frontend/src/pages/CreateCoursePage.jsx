import { useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import CourseForm from '../components/CourseForm';
import { programs, folders, lists } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { CourseCreateBreadcrumb } from '../components/navigation/Breadcrumb';

export default function CreateCoursePage() {
  const { listId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  
  // Check if we have duplicate data passed from the courses page
  const duplicateData = location.state?.duplicateData;
  
  // Always fetch programs
  const { data: programsData, isLoading: programsLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const response = await programs.getAll();
      return response.data?.data || response.data || [];
    },
    enabled: !!user?.id
  });

  // Always fetch all folders when we have programs
  const { data: foldersData, isLoading: foldersLoading } = useQuery({
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

  // Always fetch all lists when we have folders
  const { data: listsData, isLoading: listsLoading } = useQuery({
    queryKey: ['lists', 'all'], 
    queryFn: async () => {
      if (!foldersData || foldersData.length === 0) return [];
      
      const allLists = [];
      for (const folder of foldersData) {
        try {
          const response = await lists.getAll({ folderId: folder.id });
          const folderLists = response.data?.data || response.data || [];
          allLists.push(...folderLists);
        } catch (error) {
          console.error(`Failed to fetch lists for folder ${folder.id}:`, error);
        }
      }
      return allLists;
    },
    enabled: !!user?.id && !!foldersData && foldersData.length > 0
  });

  // Show loading state while fetching hierarchy data when there's a listId
  if (listId && (programsLoading || foldersLoading || listsLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <CourseForm 
      defaultListId={listId} 
      hierarchyData={{ 
        programs: programsData || [], 
        folders: foldersData || [], 
        lists: listsData || []
      }}
      initialData={duplicateData}
    />
  );
}