import React, { useState } from 'react';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/Tabs';
import { MultipleAssignees, CompactAssignees } from '../components/MultipleAssignees';
import { CustomFields } from '../components/CustomFields';
import { Comments } from '../components/Comments';
import { ActivityFeed, CompactActivityFeed } from '../components/ActivityFeed';
import { TimeTrackerWidget, TimeEntriesList } from '../components/TimeTracker';
import { FileUpload } from '../components/FileUpload';
import { DataTable } from '../components/ui/DataTable';

const sampleAssignees = [
  {
    user_id: 1,
    user_name: 'John Doe',
    user_email: 'john@example.com',
    role: 'owner',
    assigned_at: new Date().toISOString()
  },
  {
    user_id: 2,
    user_name: 'Jane Smith',
    user_email: 'jane@example.com',
    role: 'assignee',
    assigned_at: new Date().toISOString()
  }
];

const sampleCustomFieldValues = {
  1: 'High Priority',
  2: new Date().toISOString().split('T')[0],
  3: ['Option 1', 'Option 3']
};

const sampleTableData = [
  {
    id: 1,
    name: 'Sample Course 1',
    status: 'active',
    priority: 'high',
    completion_percentage: 75,
    due_date: '2024-12-31',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Sample Course 2',
    status: 'draft',
    priority: 'medium',
    completion_percentage: 30,
    due_date: '2024-11-30',
    created_at: new Date().toISOString()
  }
];

export default function FeaturesShowcasePage() {
  const [assignees, setAssignees] = useState(sampleAssignees);
  const [customFieldValues, setCustomFieldValues] = useState(sampleCustomFieldValues);
  const [tableData, setTableData] = useState(sampleTableData);

  const tableColumns = [
    {
      key: 'name',
      label: 'Course Name',
      sortable: true,
      editable: true
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      editable: true,
      type: 'select',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' }
      ],
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'active' ? 'bg-green-100 text-green-800' :
          value === 'draft' ? 'bg-gray-100 text-gray-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'priority',
      label: 'Priority',
      editable: true,
      type: 'select',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]
    },
    {
      key: 'completion_percentage',
      label: 'Progress',
      render: (value) => (
        <div className="flex items-center space-x-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 min-w-[3rem]">{value}%</span>
        </div>
      )
    },
    {
      key: 'due_date',
      label: 'Due Date',
      editable: true,
      type: 'date'
    }
  ];

  const handleCellEdit = (rowId, columnKey, value) => {
    setTableData(prev => prev.map(row => 
      row.id === rowId ? { ...row, [columnKey]: value } : row
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          New Features Showcase
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Explore all the new ClickUp-like features integrated into TrainingPulse
        </p>
      </div>

      <Tabs defaultValue="assignees" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="assignees">Assignees</TabsTrigger>
          <TabsTrigger value="fields">Custom Fields</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="time">Time Tracking</TabsTrigger>
          <TabsTrigger value="files">File Upload</TabsTrigger>
          <TabsTrigger value="table">Data Table</TabsTrigger>
        </TabsList>

        <TabsContent value="assignees" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Multiple Assignees
              </h3>
              <MultipleAssignees
                entityType="course"
                entityId={1}
                currentAssignees={assignees}
                onAssigneesChange={setAssignees}
                showRoles={true}
              />
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Compact Display
              </h3>
              <CompactAssignees 
                assignees={assignees}
                maxVisible={3}
                size="md"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fields" className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <CustomFields
              entityType="course"
              entityId={1}
              values={customFieldValues}
              onValuesChange={setCustomFieldValues}
              showAddButton={true}
            />
          </div>
        </TabsContent>

        <TabsContent value="comments" className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <Comments
              entityType="course"
              entityId={1}
            />
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <ActivityFeed
                entityType="course"
                entityId={1}
                showFilters={true}
                compact={false}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Compact Activity Feed
              </h3>
              <CompactActivityFeed
                programId={1}
                limit={5}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="time" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeTrackerWidget
              taskId={1}
              courseId={1}
            />

            <TimeEntriesList
              courseId={1}
            />
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <FileUpload
              entityType="course"
              entityId={1}
              multiple={true}
              maxFiles={5}
              maxFileSize={10 * 1024 * 1024} // 10MB
              acceptedTypes={['.pdf', '.doc', '.docx', 'image/*']}
            />
          </div>
        </TabsContent>

        <TabsContent value="table" className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <DataTable
              data={tableData}
              columns={tableColumns}
              isLoading={false}
              onCellEdit={handleCellEdit}
              showActions={true}
              selectedRows={[]}
              onRowSelect={() => {}}
              onSelectAll={() => {}}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}