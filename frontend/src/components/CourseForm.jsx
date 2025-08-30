import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Save, Calendar, Clock, AlertTriangle, Trash2, Package, CheckCircle } from 'lucide-react';
import { courses, users, teams, programs, folders, lists, priorities, modalities } from '../lib/api';
import { CourseCreateBreadcrumb } from './navigation/Breadcrumb';

// Temporary fallback for modalities (will be replaced by API data)
const MODALITIES = [
  { value: 'WBT', label: 'WBT' },
  { value: 'ILT_VLT', label: 'ILT/VLT' },
  { value: 'Micro_Learning', label: 'Micro Learning' },
  { value: 'SIMS', label: 'SIMS' },
  { value: 'DAP', label: 'DAP' }
];

// Helper function to filter deliverables by modality when API data isn't available
function getDeliverablesForModality(modality, allDeliverables) {
  if (!modality || !allDeliverables) return [];
  
  // Map database values to deliverable names
  const modalityDeliverableMap = {
    'WBT': ['Custom Content', 'Course Wrapper'],
    'ILT_VLT': ['Facilitator Guide', 'Delivery Deck', 'Participation Guide'],
    'ILT/VLT': ['Facilitator Guide', 'Delivery Deck', 'Participation Guide'], // Support both formats
    'Micro_Learning': ['Microlearning'],
    'Micro Learning': ['Microlearning'], // Support both formats
    'SIMS': ['SIMS', 'QRG', 'Demo'],
    'DAP': ['WalkMe']
  };
  
  // Check for exact match first, then try normalized versions
  let allowedNames = modalityDeliverableMap[modality];
  
  if (!allowedNames) {
    // Try replacing underscores with spaces or vice versa
    const normalizedModality = modality.replace(/_/g, ' ');
    allowedNames = modalityDeliverableMap[normalizedModality];
  }
  
  if (!allowedNames) {
    // Try the opposite normalization
    const normalizedModality = modality.replace(/ /g, '_');
    allowedNames = modalityDeliverableMap[normalizedModality];
  }
  
  if (!allowedNames) {
    console.warn(`No deliverables mapping found for modality: ${modality}`);
    return [];
  }
  
  return allDeliverables.filter(d => allowedNames.includes(d.name));
}

// Helper function to format date as ISO string with local timezone to prevent timezone shifts
function formatDateForAPI(dateString) {
  if (!dateString) return null;
  // Create a date in the local timezone at noon to avoid timezone boundary issues
  const date = new Date(dateString + 'T12:00:00');
  return date.toISOString();
}

export default function CourseForm({ courseId = null, defaultListId = null, hierarchyData = null, initialData = null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(courseId);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    modality: '',
    deliverables: [],
    priority: 'medium',
    ownerId: '',
    startDate: '',
    dueDate: '',
    estimatedHours: '',
    estimatedDailyHours: '',
    workflowTemplateId: 1, // Default workflow template
    assignees: [],
    programId: '',
    folderId: '',
    listId: defaultListId || ''
  });

  const [modalityInfo, setModalityInfo] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch course data if editing
  const { data: courseData } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const response = await courses.getById(courseId);
      return response.data.data;
    },
    enabled: isEditing
  });

  // Fetch all deliverables for WBT modality selection
  const { data: deliverablesData } = useQuery({
    queryKey: ['deliverables'],
    queryFn: async () => {
      const response = await courses.getDeliverables();
      return response.data.data;
    }
  });

  // Fetch modality information when modality changes
  const { data: modalityData, error: modalityError } = useQuery({
    queryKey: ['modality-info', formData.modality],
    queryFn: async () => {
      try {
        const response = await courses.getModalityInfo(formData.modality);
        return response.data.data;
      } catch (error) {
        console.log(`Modality info not available for ${formData.modality}, using fallback`);
        return null; // Return null to trigger fallback
      }
    },
    enabled: Boolean(formData.modality),
    onSuccess: (data) => {
      setModalityInfo(data);
    },
    retry: false // Don't retry on failure
  });


  // Fetch users for owner selection
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await users.getAll();
      // Handle different possible response structures
      return response.data?.data?.users || response.data?.users || response.data?.data || response.data || [];
    }
  });

  // Fetch priorities from the API
  const { data: prioritiesData } = useQuery({
    queryKey: ['priorities'],
    queryFn: async () => {
      const response = await priorities.getAll();
      return response.data?.data || response.data || [];
    }
  });

  // Fetch modalities from the API
  const { data: modalitiesData } = useQuery({
    queryKey: ['modalities'],
    queryFn: async () => {
      const response = await modalities.getAll();
      return response.data?.data || response.data || [];
    }
  });

  // Fetch programs
  const { data: programsData } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const response = await programs.getAll();
      return response.data?.data || response.data || [];
    }
  });

  // Get initial list data from hierarchyData when defaultListId is provided
  const initialListData = useMemo(() => {
    if (!defaultListId || !hierarchyData?.lists || isEditing) {
      return null;
    }
    
    const currentList = hierarchyData.lists.find(list => list.id === defaultListId);
    if (!currentList) {
      return null;
    }
    
    // Find the folder for this list
    const currentFolder = hierarchyData.folders?.find(folder => folder.id === currentList.folder_id);
    if (!currentFolder) {
      return null;
    }
    
    // Find the program for this folder
    const currentProgram = hierarchyData.programs?.find(program => program.id === currentFolder.program_id);
    if (!currentProgram) {
      return null;
    }
    
    return {
      ...currentList,
      folder: currentFolder,
      program: currentProgram
    };
  }, [defaultListId, hierarchyData, isEditing]);

  // Use hierarchyData when available, otherwise fetch folders
  const foldersData = useMemo(() => {
    if (hierarchyData?.folders && !isEditing) {
      const programId = formData.programId || initialListData?.program?.id;
      if (!programId) return [];
      return hierarchyData.folders.filter(folder => folder.program_id === programId);
    }
    return null;
  }, [hierarchyData?.folders, formData.programId, initialListData?.program?.id, isEditing]);

  // Fallback folder query for when hierarchyData is not available or in editing mode
  const { data: fetchedFoldersData } = useQuery({
    queryKey: ['folders', formData.programId || courseData?.program_id],
    queryFn: async () => {
      const programId = formData.programId || courseData?.program_id;
      if (!programId) return [];
      const response = await folders.getAll({ programId });
      const foldersList = response.data?.data || response.data || [];
      return foldersList;
    },
    enabled: Boolean((formData.programId || courseData?.program_id) && (foldersData === null || isEditing))
  });

  // Use hierarchyData when available, otherwise fetch lists
  const listsData = useMemo(() => {
    if (hierarchyData?.lists && !isEditing) {
      const folderId = formData.folderId || initialListData?.folder?.id;
      if (!folderId) return [];
      return hierarchyData.lists.filter(list => list.folder_id === folderId);
    }
    return null;
  }, [hierarchyData?.lists, formData.folderId, initialListData?.folder?.id, isEditing]);

  // Fallback lists query for when hierarchyData is not available or in editing mode
  const { data: fetchedListsData } = useQuery({
    queryKey: ['lists', formData.folderId || courseData?.folder_id],
    queryFn: async () => {
      const folderId = formData.folderId || courseData?.folder_id;
      if (!folderId) return [];
      const response = await lists.getAll({ folderId });
      return response.data?.data || response.data || [];
    },
    enabled: Boolean((formData.folderId || courseData?.folder_id) && (listsData === null || isEditing))
  });

  // Populate form when editing
  useEffect(() => {
    if (courseData) {
      const course = courseData;
      
      
      setFormData({
        title: course.title || '',
        description: course.description || '',
        modality: course.modality || '',
        deliverables: course.deliverables?.map(d => d.id) || [],
        priority: course.priority || 'medium',
        ownerId: course.owner?.id || course.owner_id || '',
        startDate: course.start_date ? course.start_date.split('T')[0] : '',
        dueDate: course.due_date ? course.due_date.split('T')[0] : '',
        estimatedHours: course.estimated_hours || '',
        estimatedDailyHours: course.estimated_daily_hours || '',
        workflowTemplateId: course.workflow_template_id || 1,
        assignees: course.assignees || [],
        programId: course.program_id ? String(course.program_id) : '',
        folderId: course.folder_id ? String(course.folder_id) : '',
        listId: course.list_id ? String(course.list_id) : ''
      });
    }
  }, [courseData]);

  // Auto-populate program, folder, and list when defaultListId is provided
  useEffect(() => {
    if (defaultListId && initialListData && !isEditing && !initialData) {
      setFormData(prev => ({
        ...prev,
        programId: initialListData.program.id || '',
        folderId: initialListData.folder.id || '',
        listId: defaultListId
      }));
    }
  }, [defaultListId, initialListData, isEditing, initialData]);

  // Populate form with duplicate data when provided
  useEffect(() => {
    if (initialData && !isEditing) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        modality: initialData.modality || '',
        deliverables: initialData.deliverables?.map(d => d.id) || [],
        priority: initialData.priority || 'medium',
        ownerId: initialData.owner?.id || initialData.owner_id || '',
        startDate: initialData.start_date ? initialData.start_date.split('T')[0] : '',
        dueDate: initialData.due_date ? initialData.due_date.split('T')[0] : '',
        estimatedHours: initialData.estimated_hours || '',
        estimatedDailyHours: initialData.estimated_daily_hours || '',
        workflowTemplateId: initialData.workflow_template_id || 1,
        assignees: initialData.assignees || [],
        programId: initialData.program_id ? String(initialData.program_id) : '',
        folderId: initialData.folder_id ? String(initialData.folder_id) : '',
        listId: initialData.list_id ? String(initialData.list_id) : defaultListId || ''
      });
    }
  }, [initialData, isEditing, defaultListId]);

  // Create course mutation
  const createMutation = useMutation({
    mutationFn: (courseData) => courses.create(courseData),
    onSuccess: (response) => {
      const tasksCreated = response.data.data.tasksCreated || 0;
      toast.success(`Course created successfully with ${tasksCreated} auto-generated phases!`);
      queryClient.invalidateQueries(['courses']);
      
      // Navigate back to the appropriate list if we have a listId
      if (formData.listId) {
        navigate(`/lists/${formData.listId}/courses`);
      } else {
        navigate('/programs');
      }
    },
    onError: (error) => {
      console.error('Course creation error:', error.response?.data);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message || 
                          error.response?.data?.error || 
                          'Failed to create course';
      toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to create course');
    }
  });

  // Update course mutation
  const updateMutation = useMutation({
    mutationFn: (courseData) => courses.update(courseId, courseData),
    onSuccess: () => {
      toast.success('Course updated successfully!');
      queryClient.invalidateQueries(['courses']);
      queryClient.invalidateQueries(['course', courseId]);
      
      // Navigate back to the appropriate list if we have a listId, otherwise go to course detail
      if (formData.listId) {
        navigate(`/lists/${formData.listId}/courses`);
      } else {
        navigate(`/courses/${courseId}`);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update course');
    }
  });

  // Delete course mutation
  const deleteMutation = useMutation({
    mutationFn: () => courses.delete(courseId),
    onSuccess: () => {
      toast.success('Course deleted successfully');
      queryClient.invalidateQueries(['courses']);
      queryClient.invalidateQueries(['user-courses']);
      queryClient.invalidateQueries(['user-phase-assignments']);
      queryClient.invalidateQueries(['user-stats']);
      
      // Navigate back to the appropriate list if we have a listId
      if (formData.listId) {
        navigate(`/lists/${formData.listId}/courses`);
      } else {
        navigate('/programs');
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete course');
    }
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Reset child selections when parent changes
      if (field === 'programId') {
        newData.folderId = '';
        newData.listId = '';
      } else if (field === 'folderId') {
        newData.listId = '';
      }
      
      return newData;
    });
  };

  const handleModalityChange = (modality) => {
    setFormData(prev => ({
      ...prev,
      modality,
      deliverables: [] // Reset deliverables when modality changes
    }));
    setModalityInfo(null);
  };

  const handleDeliverableToggle = (deliverableId) => {
    setFormData(prev => {
      const isCurrentlySelected = prev.deliverables.includes(deliverableId);
      
      // Special handling for WBT modality - Course Wrapper and Custom Content are mutually exclusive
      if (formData.modality === 'WBT') {
        const deliverable = availableDeliverables.find(d => d.id === deliverableId);
        const deliverableName = deliverable?.name;
        
        if (deliverableName === 'Course Wrapper' || deliverableName === 'Custom Content') {
          if (isCurrentlySelected) {
            // Unchecking - just remove it
            return {
              ...prev,
              deliverables: prev.deliverables.filter(id => id !== deliverableId)
            };
          } else {
            // Checking - remove the other WBT option and add this one
            const otherWBTOptions = availableDeliverables
              .filter(d => (d.name === 'Course Wrapper' || d.name === 'Custom Content') && d.id !== deliverableId)
              .map(d => d.id);
            
            return {
              ...prev,
              deliverables: prev.deliverables.filter(id => !otherWBTOptions.includes(id)).concat([deliverableId])
            };
          }
        }
      }
      
      // Default behavior for non-WBT modalities or other deliverables
      return {
        ...prev,
        deliverables: isCurrentlySelected
          ? prev.deliverables.filter(id => id !== deliverableId)
          : [...prev.deliverables, deliverableId]
      };
    });
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Course title is required');
      return;
    }
    
    if (!formData.description.trim()) {
      toast.error('Course description is required');
      return;
    }

    if (!formData.modality) {
      toast.error('Course modality is required');
      return;
    }

    if (!formData.listId) {
      toast.error('Please select a list for the course');
      return;
    }

    // All courses must have at least one deliverable selected
    if (formData.deliverables.length === 0) {
      toast.error('Please select at least one deliverable');
      return;
    }


    if (formData.dueDate && formData.startDate && new Date(formData.dueDate) < new Date(formData.startDate)) {
      toast.error('Due date cannot be earlier than start date');
      return;
    }

    const submitData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      modality: formData.modality,
      priority: formData.priority,
      listId: formData.listId
    };
    
    // Only include workflowTemplateId when creating a new course
    if (!isEditing) {
      submitData.workflowTemplateId = formData.workflowTemplateId;
    }


    // Add ownerId if provided
    if (formData.ownerId) {
      submitData.ownerId = parseInt(formData.ownerId);
    }

    // Add deliverables for all modalities
    submitData.deliverables = formData.deliverables;

    // Only add optional fields if they have values
    if (formData.startDate) {
      submitData.startDate = formatDateForAPI(formData.startDate);
    }
    if (formData.dueDate) {
      submitData.dueDate = formatDateForAPI(formData.dueDate);
    }
    if (formData.estimatedHours) {
      submitData.estimatedHours = parseInt(formData.estimatedHours);
    }
    if (formData.estimatedDailyHours) {
      submitData.estimatedDailyHours = parseFloat(formData.estimatedDailyHours);
    }

    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Get deliverable options for the selected modality (memoized to prevent infinite loops)
  const availableDeliverables = useMemo(() => {
    const fromApi = modalityData?.deliverables;
    const fromFallback = getDeliverablesForModality(formData.modality, deliverablesData);
    
    // Use API data if available and not empty, otherwise use fallback
    const result = (fromApi && fromApi.length > 0) ? fromApi : fromFallback;
    
    // Debug logging
    if (formData.modality) {
      console.log('Modality:', formData.modality);
      console.log('Deliverables from API:', fromApi);
      console.log('Deliverables from fallback:', fromFallback);
      console.log('Using:', result);
    }
    
    return result;
  }, [modalityData?.deliverables, formData.modality, deliverablesData]);

  // Auto-select all deliverables by default but allow user to uncheck (except for WBT)
  useEffect(() => {
    if (!isEditing && formData.modality && availableDeliverables.length > 0 && formData.deliverables.length === 0) {
      // Don't auto-populate for WBT modality - leave checkboxes unchecked
      if (formData.modality === 'WBT') {
        return;
      }
      
      const allDeliverableIds = availableDeliverables.map(d => d.id);
      setFormData(prev => ({
        ...prev,
        deliverables: allDeliverableIds
      }));
    }
  }, [availableDeliverables, formData.modality, formData.deliverables.length, isEditing]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <CourseCreateBreadcrumb 
          selectedProgram={programsData?.find(p => p.id === formData.programId)}
          selectedFolder={(foldersData || fetchedFoldersData)?.find(f => f.id === formData.folderId)}
          selectedList={(listsData || fetchedListsData)?.find(l => l.id === formData.listId)}
          isEditing={isEditing}
          courseTitle={isEditing ? (courseData?.title || formData.title) : null}
        />
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => {
                if (formData.listId) {
                  navigate(`/lists/${formData.listId}/courses`);
                } else {
                  navigate('/programs');
                }
              }}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to {formData.listId ? 'List' : 'Programs'}
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Course' : 'Create New Course'}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {isEditing ? 'Update course details and settings' : 'Create a new training course with auto-generated phases and deliverables'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 gap-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Course Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter course title..."
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description *
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Describe the course content and objectives..."
                  required
                />
              </div>

              {/* Priority */}
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Priority
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {prioritiesData && prioritiesData.length > 0 ? (
                    prioritiesData.map(priority => (
                      <option key={priority.id} value={priority.value}>
                        {priority.label}
                      </option>
                    ))
                  ) : (
                    // Fallback to basic priorities if API is not available
                    <>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </>
                  )}
                </select>
              </div>


              {/* Lead Selection */}
              <div>
                <label htmlFor="ownerId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Course Lead
                </label>
                <select
                  id="ownerId"
                  value={formData.ownerId}
                  onChange={(e) => handleInputChange('ownerId', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a lead...</option>
                  {Array.isArray(usersData) ? usersData.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  )) : null}
                </select>
              </div>

              {/* Program Selection - Hidden when auto-populated from list context */}
              {!defaultListId && (
                <div>
                  <label htmlFor="programId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Program *
                  </label>
                  <select
                    id="programId"
                    value={formData.programId}
                    onChange={(e) => handleInputChange('programId', e.target.value)}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                    disabled={isEditing}
                  >
                    <option value="">Select a program...</option>
                    {Array.isArray(programsData) ? programsData.map(program => (
                      <option key={program.id} value={String(program.id)}>
                        {program.name} ({program.code})
                      </option>
                    )) : null}
                  </select>
                </div>
              )}

              {/* Folder Selection - Hidden when auto-populated from list context */}
              {!defaultListId && formData.programId && (
                <div>
                  <label htmlFor="folderId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Folder *
                  </label>
                  <select
                    id="folderId"
                    value={formData.folderId || ''}
                    onChange={(e) => handleInputChange('folderId', e.target.value)}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select a folder...</option>
                    {Array.isArray(foldersData || fetchedFoldersData) ? (foldersData || fetchedFoldersData).map(folder => (
                      <option key={folder.id} value={String(folder.id)}>
                        {folder.name}
                      </option>
                    )) : null}
                  </select>
                </div>
              )}

              {/* List Selection - Hidden when auto-populated from list context */}
              {!defaultListId && formData.folderId && (
                <div>
                  <label htmlFor="listId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    List *
                  </label>
                  <select
                    id="listId"
                    value={formData.listId}
                    onChange={(e) => handleInputChange('listId', e.target.value)}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Select a list...</option>
                    {Array.isArray(listsData || fetchedListsData) ? (listsData || fetchedListsData).map(list => (
                      <option key={list.id} value={String(list.id)}>
                        {list.name}
                      </option>
                    )) : null}
                  </select>
                </div>
              )}

              {/* Modality Selection */}
              <div>
                <label htmlFor="modality" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Course Modality *
                </label>
                <select
                  id="modality"
                  value={formData.modality}
                  onChange={(e) => handleModalityChange(e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                  disabled={isEditing}
                >
                  <option value="">Select a modality...</option>
                  {(modalitiesData || MODALITIES).map(modality => (
                    <option key={modality.value} value={modality.value}>
                      {modality.name || modality.label}
                    </option>
                  ))}
                </select>
                {isEditing && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Modality cannot be changed when editing an existing course
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Deliverables Section - All Modalities */}
          {formData.modality && !isEditing && availableDeliverables.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Deliverables Selection
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select the deliverables you want to include in your course:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableDeliverables.map(deliverable => (
                  <div 
                    key={deliverable.id}
                    className={`relative border rounded-lg p-4 cursor-pointer transition-colors ${
                      formData.deliverables.includes(deliverable.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}
                    onClick={() => handleDeliverableToggle(deliverable.id)}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.deliverables.includes(deliverable.id)}
                        readOnly
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 pointer-events-none"
                      />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {deliverable.name}
                        </h3>
                        {deliverable.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {deliverable.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-Generated Content Preview */}
          {modalityInfo && formData.modality && formData.modality !== 'WBT' && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                Auto-Generated Content
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Auto-Assigned Deliverables */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Available Deliverables
                  </h3>
                  <div className="space-y-2">
                    {modalityInfo.deliverables.map(deliverable => (
                      <div key={deliverable.id} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        {deliverable.name}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto-Created Tasks */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Phases (Auto-Created)
                  </h3>
                  <div className="space-y-2">
                    {modalityInfo.tasks.map((task, index) => (
                      <div key={task.task_type} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full mr-2 text-xs font-medium">
                          {index + 1}
                        </div>
                        {task.task_type}
                        {index > 0 && (
                          <span className="ml-2 text-xs text-orange-500">(Blocking)</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Only your selected deliverables and the phases will be created when you save the course. 
                  Phases must be completed in order.
                </p>
              </div>
            </div>
          )}

          {/* Timeline and Resources */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Timeline & Resources</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Due Date */}
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Due Date
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Estimated Hours */}
              <div>
                <label htmlFor="estimatedHours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Estimated Hours
                </label>
                <input
                  type="number"
                  id="estimatedHours"
                  min="0"
                  step="0.5"
                  value={formData.estimatedHours}
                  onChange={(e) => handleInputChange('estimatedHours', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. 40"
                />
              </div>

              {/* Estimated Daily Hours */}
              <div>
                <label htmlFor="estimatedDailyHours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Daily Hours
                </label>
                <input
                  type="number"
                  id="estimatedDailyHours"
                  min="0"
                  step="0.25"
                  value={formData.estimatedDailyHours}
                  onChange={(e) => handleInputChange('estimatedDailyHours', e.target.value)}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g. 2"
                />
              </div>
            </div>
          </div>



          {/* Actions */}
          <div className="flex justify-between">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Course'}
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  if (formData.listId) {
                    navigate(`/lists/${formData.listId}/courses`);
                  } else {
                    navigate('/programs');
                  }
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isEditing ? 'Update Course' : 'Create Course'}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={handleDeleteCancel}
            />
            
            {/* Dialog */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Delete Course
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete "<strong>{formData.title}</strong>"? This will permanently remove the course and all its associated data.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span>Delete Course</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}