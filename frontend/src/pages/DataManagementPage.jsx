import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckSquare, 
  Square,
  Plus, 
  Search,
  Filter,
  Users,
  Calendar,
  Tag,
  ArrowRight,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Settings,
  Play,
  Trash2,
  FileDown,
  FileUp,
  Building,
  Folder,
  List,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { courses, users, bulk, programs, folders, lists, statuses } from '../lib/api';
import { formatDate, getStatusColor, getPriorityColor } from '../lib/utils';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const BULK_OPERATIONS = [
  {
    id: 'assign_users',
    name: 'Assign Users',
    description: 'Assign selected courses to specific users or teams',
    icon: Users,
    color: 'text-blue-600'
  },
  {
    id: 'update_due_dates',
    name: 'Update Due Dates',
    description: 'Set or modify due dates for multiple courses',
    icon: Calendar,
    color: 'text-green-600'
  },
  {
    id: 'change_priority',
    name: 'Change Priority',
    description: 'Update priority levels for selected courses',
    icon: Tag,
    color: 'text-orange-600'
  },
  {
    id: 'workflow_transition',
    name: 'Workflow Transition',
    description: 'Move courses to the next workflow stage',
    icon: ArrowRight,
    color: 'text-purple-600'
  },
  {
    id: 'archive_courses',
    name: 'Archive Courses',
    description: 'Archive completed or obsolete courses',
    icon: Trash2,
    color: 'text-red-600'
  }
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS = ['draft', 'in_progress', 'review', 'completed', 'cancelled'];

const MODALITIES = [
  { value: 'WBT', label: 'WBT (Web-Based Training)' },
  { value: 'ILT/VLT', label: 'ILT/VLT (Instructor-Led/Virtual-Led Training)' },
  { value: 'Micro Learning', label: 'Micro Learning' },
  { value: 'SIMS', label: 'SIMS (Simulations)' },
  { value: 'DAP', label: 'DAP (Digital Adoption Platform)' }
];

function DataManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('export'); // 'export', 'import', 'operations'
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [operationParams, setOperationParams] = useState({});
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Export state
  const [exportType, setExportType] = useState('all'); // 'all', 'selected'
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [selectedFolders, setSelectedFolders] = useState([]);
  const [selectedLists, setSelectedLists] = useState([]);
  const [expandedPrograms, setExpandedPrograms] = useState(new Set());
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Fetch courses data
  const { data: coursesData, isLoading: coursesLoading, error: coursesError } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courses.getAll()
  });
  
  // Fetch users data
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => users.getAll()
  });
  
  // Fetch statuses data
  const { data: statusesData } = useQuery({
    queryKey: ['statuses'],
    queryFn: async () => {
      const response = await statuses.getAll();
      return response.data?.data || response.data || [];
    }
  });
  
  // Fetch programs data
  const { data: programsData } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => {
      const response = await programs.getAll();
      return response.data?.data || response.data || [];
    }
  });
  
  // Fetch folders data
  const { data: foldersData } = useQuery({
    queryKey: ['folders', 'all'],
    queryFn: async () => {
      if (!programsData || programsData.length === 0) return [];
      
      const allFolders = [];
      for (const program of programsData) {
        try {
          const response = await folders.getAll({ programId: program.id });
          const programFolders = response.data?.data || response.data || [];
          allFolders.push(...programFolders.map(f => ({ ...f, program_id: program.id })));
        } catch (error) {
          console.error(`Failed to fetch folders for program ${program.id}:`, error);
        }
      }
      return allFolders;
    },
    enabled: !!programsData && programsData.length > 0
  });
  
  // Fetch lists data
  const { data: listsData } = useQuery({
    queryKey: ['lists', 'all'],
    queryFn: async () => {
      if (!foldersData || foldersData.length === 0) return [];
      
      const allLists = [];
      for (const folder of foldersData) {
        try {
          const response = await lists.getAll({ folderId: folder.id });
          const folderLists = response.data?.data || response.data || [];
          allLists.push(...folderLists.map(l => ({ ...l, folder_id: folder.id })));
        } catch (error) {
          if (error.response?.status !== 404) {
            console.error(`Failed to fetch lists for folder ${folder.id}:`, error);
          }
        }
      }
      return allLists;
    },
    enabled: !!foldersData && foldersData.length > 0
  });
  
  // Fetch operation history
  const { data: operationHistoryData, isLoading: historyLoading } = useQuery({
    queryKey: ['bulk-operations-history'],
    queryFn: () => bulk.getHistory()
  });
  
  const isLoading = coursesLoading || usersLoading || historyLoading;
  const error = coursesError;

  // Execute bulk operation mutation
  const executeBulkOperation = useMutation({
    mutationFn: (params) => bulk.execute(params),
    onSuccess: (data) => {
      toast.success('Bulk operation completed successfully');
      setSelectedCourses(new Set());
      setShowOperationModal(false);
      setSelectedOperation(null);
      queryClient.invalidateQueries(['courses']);
      queryClient.invalidateQueries(['bulk-operations-history']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to execute bulk operation');
    }
  });

  // Import courses mutation
  const importCoursesMutation = useMutation({
    mutationFn: async (coursesToImport) => {
      const results = [];
      for (const course of coursesToImport) {
        try {
          const result = await courses.create(course);
          results.push(result);
        } catch (error) {
          console.error('Failed to create course:', course.title, error);
          throw error;
        }
      }
      return results;
    },
    onSuccess: (data) => {
      toast.success(`Successfully imported ${data.length} courses`);
      queryClient.invalidateQueries(['courses']);
    },
    onError: (error) => {
      toast.error('Failed to import some courses. Please check the data and try again.');
    }
  });

  const handleCourseSelection = (courseId) => {
    const newSelection = new Set(selectedCourses);
    if (newSelection.has(courseId)) {
      newSelection.delete(courseId);
    } else {
      newSelection.add(courseId);
    }
    setSelectedCourses(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedCourses.size === filteredCourses.length) {
      setSelectedCourses(new Set());
    } else {
      setSelectedCourses(new Set(filteredCourses.map(c => c.id)));
    }
  };

  const handleOperationSelect = (operation) => {
    if (selectedCourses.size === 0) {
      toast.error('Please select at least one course');
      return;
    }
    setSelectedOperation(operation);
    setOperationParams({});
    setShowOperationModal(true);
  };

  const handleExecuteOperation = () => {
    if (!selectedOperation || selectedCourses.size === 0) return;

    const params = {
      operation: selectedOperation.id,
      courseIds: Array.from(selectedCourses),
      ...operationParams
    };

    executeBulkOperation.mutate(params);
  };

  const handleExportToExcel = () => {
    let coursesToExport = [];
    const coursesList = coursesData?.data?.data?.courses || coursesData?.data?.courses || [];
    
    if (exportType === 'all') {
      coursesToExport = coursesList;
    } else if (exportType === 'selected') {
      // Filter courses based on selected programs, folders, and lists
      coursesToExport = coursesList.filter(course => {
        // If course's program is selected
        if (selectedPrograms.includes(course.program_id)) {
          return true;
        }
        // If course's folder is selected
        if (course.folder_id && selectedFolders.includes(course.folder_id)) {
          return true;
        }
        // If course's list is selected
        if (course.list_id && selectedLists.includes(course.list_id)) {
          return true;
        }
        return false;
      });
    }

    if (coursesToExport.length === 0) {
      toast.error('No courses to export');
      return;
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Prepare data for single sheet
    const exportData = [];
    
    coursesToExport.forEach(course => {
      // Find related hierarchy data
      let program = programsData?.find(p => p.id === course.program_id);
      let folder = foldersData?.find(f => f.id === course.folder_id);
      let list = listsData?.find(l => l.id === course.list_id);
      
      // If folder is missing but we have list, find folder through list
      if (!folder && list && list.folder_id) {
        folder = foldersData?.find(f => f.id === list.folder_id);
      }
      
      // If program is missing but we have folder, find program through folder
      if (!program && folder && folder.program_id) {
        program = programsData?.find(p => p.id === folder.program_id);
      }
      
      const programName = program?.name || 'Unassigned';
      const folderName = folder?.name || 'Unassigned';
      const listName = list?.name || 'Unassigned';
      
      // Find status label
      const statusInfo = statusesData?.find(s => s.value === course.status);
      const statusLabel = statusInfo?.label || course.status || '';
      
      // Capitalize first letter of priority
      const priorityCapitalized = course.priority ? 
        course.priority.charAt(0).toUpperCase() + course.priority.slice(1).toLowerCase() : 
        '';
      
      exportData.push({
        'Program': programName,
        'Folder': folderName,
        'List': listName,
        'Course ID': course.id,
        'Title': course.title,
        'Description': course.description || '',
        'Modality': course.modality || '',
        'Priority': priorityCapitalized,
        'Status': statusLabel,
        'Start Date': course.start_date || '',
        'Due Date': course.due_date || '',
        'Completion %': course.completion_percentage || 0,
        'Owner': course.owner_name || '',
        'Lead': course.lead_name || '',
        'Created At': course.created_at || ''
      });
    });
    
    // Sort by program, then folder, then list
    exportData.sort((a, b) => {
      if (a.Program !== b.Program) return a.Program.localeCompare(b.Program);
      if (a.Folder !== b.Folder) return a.Folder.localeCompare(b.Folder);
      return a.List.localeCompare(b.List);
    });
    
    // Add single sheet with all courses
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Courses');
    
    // Export workbook
    XLSX.writeFile(wb, `courses_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${coursesToExport.length} courses to Excel`);
  };

  const downloadImportTemplate = () => {
    // Create a mapping of status labels to values for the instructions
    const statusMapping = statusesData?.map(s => `${s.label}`).join(', ') || 'PREDEVELOPMENT, PRODUCTION, INACTIVE, etc.';
    
    const template = [
      {
        'Program *': 'Lockheed Martin',
        'Folder *': 'Course Development',
        'List *': 'Development',
        'Title *': 'Example Course 1',
        'Description': 'Course description goes here',
        'Modality': 'WBT',
        'Priority': 'Medium',
        'Status': 'PREDEVELOPMENT',
        'Start Date': '2024-01-01',
        'Due Date': '2024-03-01',
        'Owner Email': 'owner@example.com',
        'Lead Email': 'lead@example.com'
      },
      {
        'Program *': 'Lockheed Martin',
        'Folder *': 'Course Development',
        'List *': 'Review',
        'Title *': 'Example Course 2',
        'Description': 'Another course description',
        'Modality': 'ILT/VLT',
        'Priority': 'High',
        'Status': 'PRODUCTION',
        'Start Date': '2024-02-01',
        'Due Date': '2024-04-01',
        'Owner Email': 'owner2@example.com',
        'Lead Email': 'lead2@example.com'
      }
    ];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(template);
    
    // Add instructions sheet
    const instructions = [
      ['INSTRUCTIONS FOR IMPORTING COURSES'],
      [''],
      ['REQUIRED FIELDS (marked with * in template):'],
      ['   - Program: Name of the program/client'],
      ['   - Folder: Name of the folder within the program'],
      ['   - List: Name of the list within the folder'],
      ['   - Title: Name of the course'],
      [''],
      ['OPTIONAL FIELDS:'],
      ['   - Description: Course description'],
      ['   - Modality: WBT, ILT/VLT, Micro Learning, SIMS, or DAP'],
      ['   - Priority: Low, Medium, High, or Critical (case-insensitive)'],
      [`   - Status: ${statusMapping}`],
      ['   - Start Date: Format YYYY-MM-DD'],
      ['   - Due Date: Format YYYY-MM-DD'],
      ['   - Owner Email: Email of the course owner'],
      ['   - Lead Email: Email of the course lead'],
      [''],
      ['NOTES:'],
      ['1. The system will create new programs, folders, or lists if they don\'t exist'],
      ['2. Save the file as .xlsx format'],
      ['3. Upload the file in the import section']
    ];
    
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
    XLSX.utils.book_append_sheet(wb, ws, 'Courses Template');
    
    XLSX.writeFile(wb, 'course_import_template.xlsx');
    toast.success('Template downloaded successfully');
  };

  const handleFileImport = async (file) => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet (skip Instructions if present)
        const sheetName = workbook.SheetNames.find(name => name !== 'Instructions') || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          toast.error('No data found in the file');
          return;
        }

        // Process each row to find/create hierarchy and prepare course data
        const coursesToImport = [];
        
        for (const row of jsonData) {
          // Required fields check
          if (!row['Title *'] && !row['Title']) {
            continue; // Skip rows without title
          }
          
          const title = row['Title *'] || row['Title'] || '';
          const programName = row['Program *'] || row['Program'] || '';
          const folderName = row['Folder *'] || row['Folder'] || '';
          const listName = row['List *'] || row['List'] || '';
          
          if (!title || !programName || !folderName || !listName) {
            toast.error(`Missing required fields for course: ${title || 'Unknown'}`);
            continue;
          }
          
          // Find or note that we need to create hierarchy
          let program = programsData?.find(p => p.name.toLowerCase() === programName.toLowerCase());
          let folder = foldersData?.find(f => 
            f.name.toLowerCase() === folderName.toLowerCase() && 
            f.program_id === program?.id
          );
          let list = listsData?.find(l => 
            l.name.toLowerCase() === listName.toLowerCase() && 
            l.folder_id === folder?.id
          );
          
          // Convert status label to value
          let statusValue = row['Status'] || 'inactive';
          if (statusValue && statusesData) {
            const statusInfo = statusesData.find(s => 
              s.label.toLowerCase() === statusValue.toLowerCase()
            );
            if (statusInfo) {
              statusValue = statusInfo.value;
            }
          }
          
          // Note: In a real implementation, you'd need to create missing hierarchy items first
          // For now, we'll just use the IDs if they exist
          // Convert priority label to lowercase value (accepts any case)
          let priorityValue = row['Priority'] || 'medium';
          if (priorityValue) {
            priorityValue = priorityValue.toLowerCase();
          }
          
          coursesToImport.push({
            title: title,
            description: row['Description'] || '',
            modality: row['Modality'] || '',
            priority: priorityValue,
            status: statusValue,
            start_date: row['Start Date'] || null,
            due_date: row['Due Date'] || null,
            list_id: list?.id || null,
            folder_id: folder?.id || null,
            program_id: program?.id || null,
            // Store hierarchy names for potential creation
            _hierarchyNames: {
              program: programName,
              folder: folderName,
              list: listName
            }
          });
        }

        if (coursesToImport.length === 0) {
          toast.error('No valid courses found in the file');
          return;
        }

        // Import courses
        await importCoursesMutation.mutateAsync(coursesToImport);
        
      } catch (error) {
        console.error('Import error:', error);
        toast.error('Error processing file. Please check the format and try again.');
      }
    };

    reader.readAsArrayBuffer(file);
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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error loading courses
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error.message || 'Failed to load courses. Please try again.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle different data structures from API responses
  const coursesList = coursesData?.data?.data?.courses || coursesData?.data?.courses || [];
  const usersList = usersData?.data?.data?.users || usersData?.data?.users || [];
  const operationHistory = operationHistoryData?.data?.operations || [];
  
  const filteredCourses = coursesList.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Management</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Export, import, and perform batch operations on courses
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('export')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'export'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Course Export
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'import'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Course Import
            </button>
            <button
              onClick={() => setActiveTab('operations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'operations'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Bulk Operations
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'export' && (
        <CourseExportTab
          exportType={exportType}
          setExportType={setExportType}
          programsData={programsData}
          foldersData={foldersData}
          listsData={listsData}
          selectedPrograms={selectedPrograms}
          setSelectedPrograms={setSelectedPrograms}
          selectedFolders={selectedFolders}
          setSelectedFolders={setSelectedFolders}
          selectedLists={selectedLists}
          setSelectedLists={setSelectedLists}
          expandedPrograms={expandedPrograms}
          setExpandedPrograms={setExpandedPrograms}
          expandedFolders={expandedFolders}
          setExpandedFolders={setExpandedFolders}
          handleExportToExcel={handleExportToExcel}
        />
      )}

      {activeTab === 'import' && (
        <CourseImportTab
          downloadImportTemplate={downloadImportTemplate}
          handleFileImport={handleFileImport}
        />
      )}

      {activeTab === 'operations' && (
        <BulkOperationsTab
          coursesList={coursesList}
          usersList={usersList}
          operationHistory={operationHistory}
          selectedCourses={selectedCourses}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          handleCourseSelection={handleCourseSelection}
          handleSelectAll={handleSelectAll}
          handleOperationSelect={handleOperationSelect}
          filteredCourses={filteredCourses}
          showOperationModal={showOperationModal}
          selectedOperation={selectedOperation}
          operationParams={operationParams}
          setOperationParams={setOperationParams}
          handleExecuteOperation={handleExecuteOperation}
          setShowOperationModal={setShowOperationModal}
          setSelectedOperation={setSelectedOperation}
          executeBulkOperation={executeBulkOperation}
        />
      )}
    </div>
  );
}

// Bulk Operations Tab Component
function BulkOperationsTab({
  coursesList,
  usersList,
  operationHistory,
  selectedCourses,
  searchTerm,
  setSearchTerm,
  handleCourseSelection,
  handleSelectAll,
  handleOperationSelect,
  filteredCourses,
  showOperationModal,
  selectedOperation,
  operationParams,
  setOperationParams,
  handleExecuteOperation,
  setShowOperationModal,
  setSelectedOperation,
  executeBulkOperation
}) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Bulk Operations Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Operations</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedCourses.size} course{selectedCourses.size !== 1 ? 's' : ''} selected
              </p>
            </div>
            
            <div className="p-4 space-y-2">
              {BULK_OPERATIONS.map((operation) => {
                const Icon = operation.icon;
                return (
                  <button
                    key={operation.id}
                    onClick={() => handleOperationSelect(operation)}
                    disabled={selectedCourses.size === 0}
                    className="w-full flex items-start p-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Icon className={`h-5 w-5 mt-0.5 mr-3 ${operation.color}`} />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {operation.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {operation.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Operations */}
          <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Operations</h3>
            </div>
            
            <div className="p-4">
              {operationHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No recent operations
                </p>
              ) : (
                <div className="space-y-3">
                  {operationHistory.slice(0, 5).map((operation) => (
                    <div key={operation.id} className="flex items-center text-sm">
                      <div className={`h-2 w-2 rounded-full mr-3 ${
                        operation.status === 'completed' ? 'bg-green-500' :
                        operation.status === 'failed' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}></div>
                      <div className="flex-1">
                        <p className="text-gray-900 dark:text-white">{operation.operationType}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">
                          {formatDate(operation.createdAt)} • {operation.itemCount} items
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Courses List */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            {/* Search and Controls */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    {selectedCourses.size === filteredCourses.length && filteredCourses.length > 0 ? (
                      <CheckSquare className="h-4 w-4 mr-2 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    {selectedCourses.size === filteredCourses.length && filteredCourses.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Courses Table */}
            <div className="overflow-hidden">
              {filteredCourses.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No courses found</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'Try adjusting your search terms.' : 'No courses available for bulk operations.'}
                  </p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                          <Square className="h-4 w-4" />
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Course
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Priority
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Due Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Assigned
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredCourses.map((course) => (
                        <tr
                          key={course.id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedCourses.has(course.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleCourseSelection(course.id)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            >
                              {selectedCourses.has(course.id) ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                {course.title}
                              </div>
                              {course.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                  {course.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(course.priority, 'badge')}`}>
                              {course.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(course.status, 'badge')}`}>
                              {course.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {(course.due_date || course.dueDate) ? formatDate(course.due_date || course.dueDate) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {course.assignments?.length || course.assignmentCount || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Operation Modal */}
      {showOperationModal && selectedOperation && (
        <BulkOperationModal
          operation={selectedOperation}
          courseCount={selectedCourses.size}
          users={usersList}
          params={operationParams}
          onParamsChange={setOperationParams}
          onExecute={handleExecuteOperation}
          onCancel={() => {
            setShowOperationModal(false);
            setSelectedOperation(null);
          }}
          isExecuting={executeBulkOperation.isPending}
        />
      )}
    </>
  );
}

// Custom checkbox component for indeterminate state
function IndeterminateCheckbox({ checked, indeterminate, onChange, className = "" }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={className}
    />
  );
}

// Course Export Tab Component
function CourseExportTab({
  exportType,
  setExportType,
  programsData,
  foldersData,
  listsData,
  selectedPrograms,
  setSelectedPrograms,
  selectedFolders,
  setSelectedFolders,
  selectedLists,
  setSelectedLists,
  expandedPrograms,
  setExpandedPrograms,
  expandedFolders,
  setExpandedFolders,
  handleExportToExcel
}) {
  // Helper functions to determine checkbox states
  const getProgramCheckState = (programId) => {
    const programFolders = foldersData?.filter(f => f.program_id === programId) || [];
    const folderIds = programFolders.map(f => f.id);
    const programLists = listsData?.filter(l => folderIds.includes(l.folder_id)) || [];
    
    const selectedFolderCount = folderIds.filter(id => selectedFolders.includes(id)).length;
    const selectedListCount = programLists.filter(l => selectedLists.includes(l.id)).length;
    
    const totalChildren = folderIds.length + programLists.length;
    const selectedChildren = selectedFolderCount + selectedListCount;
    
    if (selectedChildren === 0) {
      return { checked: false, indeterminate: false };
    } else if (selectedChildren === totalChildren) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  };
  
  const getFolderCheckState = (folderId) => {
    const folderLists = listsData?.filter(l => l.folder_id === folderId) || [];
    const selectedListCount = folderLists.filter(l => selectedLists.includes(l.id)).length;
    
    if (selectedListCount === 0) {
      return { checked: false, indeterminate: false };
    } else if (selectedListCount === folderLists.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  };
  
  const toggleProgram = (programId) => {
    if (selectedPrograms.includes(programId)) {
      // Uncheck program and all its children
      setSelectedPrograms(selectedPrograms.filter(id => id !== programId));
      
      // Also deselect all folders under this program
      const programFolders = foldersData?.filter(f => f.program_id === programId) || [];
      const folderIds = programFolders.map(f => f.id);
      setSelectedFolders(selectedFolders.filter(id => !folderIds.includes(id)));
      
      // Also deselect all lists under these folders
      const programLists = listsData?.filter(l => folderIds.includes(l.folder_id)) || [];
      const listIds = programLists.map(l => l.id);
      setSelectedLists(selectedLists.filter(id => !listIds.includes(id)));
    } else {
      // Check program and all its children (folders and lists)
      setSelectedPrograms([...selectedPrograms, programId]);
      
      // Auto-select all folders under this program
      const programFolders = foldersData?.filter(f => f.program_id === programId) || [];
      const folderIds = programFolders.map(f => f.id);
      setSelectedFolders([...new Set([...selectedFolders, ...folderIds])]);
      
      // Auto-select all lists under these folders
      const programLists = listsData?.filter(l => folderIds.includes(l.folder_id)) || [];
      const listIds = programLists.map(l => l.id);
      setSelectedLists([...new Set([...selectedLists, ...listIds])]);
    }
  };

  const toggleFolder = (folderId) => {
    if (selectedFolders.includes(folderId)) {
      // Uncheck folder and all its children
      setSelectedFolders(selectedFolders.filter(id => id !== folderId));
      
      // Also deselect all lists under this folder
      const folderLists = listsData?.filter(l => l.folder_id === folderId) || [];
      const listIds = folderLists.map(l => l.id);
      setSelectedLists(selectedLists.filter(id => !listIds.includes(id)));
    } else {
      // Check folder and all its children (lists)
      setSelectedFolders([...selectedFolders, folderId]);
      
      // Auto-select all lists under this folder
      const folderLists = listsData?.filter(l => l.folder_id === folderId) || [];
      const listIds = folderLists.map(l => l.id);
      setSelectedLists([...new Set([...selectedLists, ...listIds])]);
    }
  };

  const toggleList = (listId) => {
    if (selectedLists.includes(listId)) {
      setSelectedLists(selectedLists.filter(id => id !== listId));
    } else {
      setSelectedLists([...selectedLists, listId]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Export Options */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Export Options</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Export Type</label>
              <div className="mt-2 space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="all"
                    checked={exportType === 'all'}
                    onChange={(e) => setExportType(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">Export all courses (grouped by hierarchy)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="selected"
                    checked={exportType === 'selected'}
                    onChange={(e) => setExportType(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">Export selected</span>
                </label>
              </div>
            </div>

            {/* Hierarchy Selection */}
            {exportType === 'selected' && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Items to Export</h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-96 overflow-y-auto">
                  {programsData?.map(program => (
                    <div key={program.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                      {/* Program */}
                      <div className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <IndeterminateCheckbox
                          checked={getProgramCheckState(program.id).checked || selectedPrograms.includes(program.id)}
                          indeterminate={getProgramCheckState(program.id).indeterminate}
                          onChange={() => toggleProgram(program.id)}
                          className="mr-3"
                        />
                        <button
                          onClick={() => setExpandedPrograms(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(program.id)) {
                              newSet.delete(program.id);
                            } else {
                              newSet.add(program.id);
                            }
                            return newSet;
                          })}
                          className="flex items-center flex-1 text-left"
                        >
                          {expandedPrograms.has(program.id) ? (
                            <ChevronDown className="h-4 w-4 mr-2" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-2" />
                          )}
                          <Building className="h-4 w-4 mr-2" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{program.name}</span>
                        </button>
                      </div>

                      {/* Folders */}
                      {expandedPrograms.has(program.id) && (
                        <div className="pl-6">
                          {foldersData?.filter(f => f.program_id === program.id).map(folder => (
                            <div key={folder.id}>
                              <div className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <IndeterminateCheckbox
                                  checked={getFolderCheckState(folder.id).checked || selectedFolders.includes(folder.id)}
                                  indeterminate={getFolderCheckState(folder.id).indeterminate}
                                  onChange={() => toggleFolder(folder.id)}
                                  className="mr-3"
                                />
                                <button
                                  onClick={() => setExpandedFolders(prev => {
                                    const newSet = new Set(prev);
                                    if (newSet.has(folder.id)) {
                                      newSet.delete(folder.id);
                                    } else {
                                      newSet.add(folder.id);
                                    }
                                    return newSet;
                                  })}
                                  className="flex items-center flex-1 text-left"
                                >
                                  {expandedFolders.has(folder.id) ? (
                                    <ChevronDown className="h-3 w-3 mr-2" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 mr-2" />
                                  )}
                                  <Folder className="h-4 w-4 mr-2" />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{folder.name}</span>
                                </button>
                              </div>

                              {/* Lists */}
                              {expandedFolders.has(folder.id) && (
                                <div className="pl-6">
                                  {listsData?.filter(l => l.folder_id === folder.id).map(list => (
                                    <div key={list.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={selectedLists.includes(list.id)}
                                        onChange={() => toggleList(list.id)}
                                        className="mr-3"
                                      />
                                      <List className="h-4 w-4 mr-2" />
                                      <span className="text-sm text-gray-600 dark:text-gray-400">{list.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export to Excel
            </button>
          </div>
        </div>
      </div>

      {/* Export Info */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Export Information</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What will be exported?</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Course details (title, description)</li>
                <li>• Modality and priority</li>
                <li>• Status (displayed as label)</li>
                <li>• Start and due dates</li>
                <li>• Owner and lead information</li>
                <li>• Hierarchy information</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">File Format</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Courses will be exported as an Excel file (.xlsx) with all courses in a single sheet including hierarchy columns.
              </p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Tip:</strong> Use the hierarchy selection to export specific programs, folders, or lists.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Course Import Tab Component
function CourseImportTab({
  downloadImportTemplate,
  handleFileImport
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Import Options */}
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Import Courses</h3>
          
          <div className="space-y-6">
            {/* Download Template */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Step 1: Download Template</h4>
              <button
                onClick={downloadImportTemplate}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Import Template
              </button>
            </div>

            {/* Upload File */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Step 2: Upload File</h4>
              <div
                className={`relative border-2 border-dashed rounded-lg p-6 text-center ${
                  dragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-600'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {selectedFile ? (
                  <div>
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Ready to import</p>
                  </div>
                ) : (
                  <div>
                    <FileUp className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Drop your Excel file here</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">or click to browse</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => handleFileImport(selectedFile)}
                disabled={!selectedFile}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Courses
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Info */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Import Instructions</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Required Fields</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• <span className="text-red-500">*</span> Program</li>
                <li>• <span className="text-red-500">*</span> Folder</li>
                <li>• <span className="text-red-500">*</span> List</li>
                <li>• <span className="text-red-500">*</span> Title</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Optional Fields</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Description</li>
                <li>• Modality (WBT, ILT/VLT, etc.)</li>
                <li>• Priority (low, medium, high, critical)</li>
                <li>• Status (use labels like PREDEVELOPMENT)</li>
                <li>• Start Date (YYYY-MM-DD)</li>
                <li>• Due Date (YYYY-MM-DD)</li>
                <li>• Owner Email</li>
                <li>• Lead Email</li>
              </ul>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>Note:</strong> The import will automatically place courses in the specified program, folder, and list hierarchy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bulk Operation Modal Component
function BulkOperationModal({ operation, courseCount, users, params, onParamsChange, onExecute, onCancel, isExecuting }) {
  const Icon = operation.icon;

  const renderOperationFields = () => {
    switch (operation.id) {
      case 'assign_users':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Users
              </label>
              <select
                multiple
                value={params.userIds || []}
                onChange={(e) => onParamsChange({
                  ...params,
                  userIds: Array.from(e.target.selectedOptions, option => option.value)
                })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                size="5"
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'update_due_dates':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={params.dueDate || ''}
                onChange={(e) => onParamsChange({ ...params, dueDate: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        );

      case 'change_priority':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority Level
              </label>
              <select
                value={params.priority || ''}
                onChange={(e) => onParamsChange({ ...params, priority: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select priority...</option>
                {PRIORITIES.map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'workflow_transition':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Status
              </label>
              <select
                value={params.status || ''}
                onChange={(e) => onParamsChange({ ...params, status: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select status...</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Icon className={`h-6 w-6 mr-3 ${operation.color}`} />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {operation.name}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {operation.description}
        </p>

        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            This operation will affect <strong>{courseCount}</strong> course{courseCount !== 1 ? 's' : ''}.
          </p>
        </div>

        {renderOperationFields()}

        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={onExecute}
            disabled={isExecuting}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Operation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataManagementPage;