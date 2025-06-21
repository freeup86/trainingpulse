import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import WorkflowDesignerMinimal from '../components/WorkflowDesignerMinimal';
import { workflows } from '../lib/api';

function WorkflowCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams(); // For edit routes like /workflows/:id/edit
  const duplicateFromId = searchParams.get('duplicateFrom');
  const editId = id; // Use the id from params for edit mode
  
  const [initialTemplate, setInitialTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch template data if duplicating or editing
  const { data: templateData, isLoading: templateLoading, error: templateError } = useQuery({
    queryKey: ['workflow-template', duplicateFromId || editId],
    queryFn: () => workflows.getById(duplicateFromId || editId),
    enabled: Boolean(duplicateFromId || editId),
    staleTime: 0
  });

  useEffect(() => {
    if (duplicateFromId || editId) {
      if (templateError) {
        setLoading(false);
        return;
      }

      if (templateData?.data?.data) {
        const template = templateData.data.data;
        
        if (duplicateFromId) {
          // For duplication, create a new template with "Copy of" prefix and reset IDs
          setInitialTemplate({
            name: `Copy of ${template.name}`,
            description: template.description,
            is_active: true,
            states: template.states?.map(state => ({
              ...state,
              id: Date.now() + Math.random(), // Generate temporary ID for frontend
              state_name: `${state.state_name}_copy_${Date.now()}` // Make state names unique
            })) || [],
            transitions: [] // Reset transitions for duplicated template
          });
        } else {
          // For editing, use existing template data
          setInitialTemplate({
            id: template.id,
            name: template.name,
            description: template.description,
            is_active: template.is_active,
            states: template.states || [],
            transitions: template.transitions || []
          });
        }
        setLoading(false);
      } else if (!templateLoading) {
        // If not loading but no data, something went wrong
        console.warn('No template data received');
        setLoading(false);
      }
    } else {
      // Creating new template
      console.log('Creating new template');
      setInitialTemplate({
        name: '',
        description: '',
        is_active: true,
        states: [],
        transitions: []
      });
      setLoading(false);
    }
  }, [templateData, duplicateFromId, editId, templateError, templateLoading]);

  if (loading || templateLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (templateError) {
    return (
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/workflows')}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Error Loading Template
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {templateError.message || 'Failed to load workflow template'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Unable to load the workflow template. Please try again or go back to the workflows list.
            </p>
            <button
              onClick={() => navigate('/workflows')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Workflows
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/workflows')}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {editId ? 'Edit Workflow Template' : 
               duplicateFromId ? 'Duplicate Workflow Template' : 
               'Create Workflow Template'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {editId ? 'Modify your existing workflow template' :
               duplicateFromId ? 'Create a copy of an existing template' :
               'Design a new workflow template for your courses'}
            </p>
          </div>
        </div>
      </div>

      {/* Designer */}
      <div className="flex-1 overflow-auto">
        <WorkflowDesignerMinimal
          templateId={editId}
          initialTemplate={initialTemplate}
          showHeader={false}
        />
      </div>
    </div>
  );
}

export default WorkflowCreatePage;