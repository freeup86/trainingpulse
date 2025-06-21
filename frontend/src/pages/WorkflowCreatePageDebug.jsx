import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import WorkflowDesigner from '../components/WorkflowDesigner';
import WorkflowDesignerMinimal from '../components/WorkflowDesignerMinimal';
import { workflows } from '../lib/api';

function WorkflowCreatePageDebug() {
  console.log('WorkflowCreatePageDebug component mounted');
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const duplicateFromId = searchParams.get('duplicateFrom');
  const editId = id;
  
  console.log('WorkflowCreatePageDebug params:', { id, editId, duplicateFromId });
  
  // Test basic state
  const [initialTemplate, setInitialTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Test useQuery
  const { data: templateData, isLoading: templateLoading, error: templateError } = useQuery({
    queryKey: ['workflow-template', duplicateFromId || editId],
    queryFn: () => workflows.getById(duplicateFromId || editId),
    enabled: Boolean(duplicateFromId || editId),
    staleTime: 0
  });
  
  console.log('Query state:', { templateData, templateLoading, templateError });
  
  // Test useEffect logic (simplified)
  useEffect(() => {
    console.log('useEffect triggered with:', { 
      duplicateFromId, 
      editId, 
      templateData: templateData?.data?.data,
      templateError,
      templateLoading 
    });

    if (duplicateFromId || editId) {
      if (templateError) {
        console.error('Template fetch error:', templateError);
        setLoading(false);
        return;
      }

      if (templateData?.data?.data) {
        const template = templateData.data.data;
        console.log('Processing template:', template);
        
        if (duplicateFromId) {
          setInitialTemplate({
            name: `Copy of ${template.name}`,
            description: template.description,
            is_active: true,
            states: template.states?.map(state => ({
              ...state,
              id: Date.now() + Math.random(),
              state_name: `${state.state_name}_copy_${Date.now()}`
            })) || [],
            transitions: []
          });
        } else {
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
        console.log('Template processing complete');
      } else if (!templateLoading) {
        console.warn('No template data received');
        setLoading(false);
      }
    } else {
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
              Debug Workflow Template Page
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Testing imports and basic functionality
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-medium mb-4">Debug Info</h3>
          <div className="space-y-2 text-sm">
            <div>Template ID: {editId || 'None'}</div>
            <div>Duplicate From: {duplicateFromId || 'None'}</div>
            <div>Basic imports: ✅ Working</div>
            <div>React Router: ✅ Working</div>
            <div>Lucide Icons: ✅ Working</div>
            <div>useQuery import: ✅ Working</div>
            <div>workflows API import: ✅ Working</div>
            <div>WorkflowDesigner import: ✅ Working</div>
            <div>useState: ✅ Working</div>
            <div>useQuery: {templateLoading ? '⏳ Loading' : templateError ? '❌ Error' : templateData ? '✅ Data loaded' : '⏸️ Waiting'}</div>
            <div>Template Data: {templateData?.data?.data ? '✅ Present' : '❌ Missing'}</div>
            <div>useEffect: ✅ Working</div>
            <div>Loading State: {loading ? '⏳ Loading' : '✅ Ready'}</div>
            <div>Initial Template: {initialTemplate ? '✅ Set' : '❌ Not Set'}</div>
          </div>
        </div>
        
        {/* Test WorkflowDesigner rendering */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">WorkflowDesigner Test</h3>
          {loading || templateLoading ? (
            <div className="text-center py-4">
              <div className="text-blue-600">Loading template data...</div>
            </div>
          ) : (
            <div className="bg-white rounded border" style={{ height: '400px' }}>
              <div className="p-2 bg-gray-50 text-sm">
                About to render WorkflowDesigner with:
                <br />• templateId: {editId}
                <br />• initialTemplate states: {initialTemplate?.states?.length || 0}
                <br />• showHeader: false
              </div>
              <WorkflowDesignerMinimal
                templateId={editId}
                initialTemplate={initialTemplate}
                showHeader={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkflowCreatePageDebug;