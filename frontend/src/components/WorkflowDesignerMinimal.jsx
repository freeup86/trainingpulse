import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflows } from '../lib/api';
import { 
  Plus, 
  Save, 
  Trash2, 
  Settings, 
  ArrowRight, 
  Play, 
  Pause, 
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Bell,
  Edit,
  Copy,
  Download,
  Upload,
  Zap,
  GitBranch,
  Target,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';

const STAGE_TYPES = {
  'planning': { 
    icon: Clock, 
    color: 'bg-blue-500', 
    label: 'Planning',
    description: 'Initial planning and setup stage'
  },
  'content_development': { 
    icon: Edit, 
    color: 'bg-purple-500', 
    label: 'Content Development',
    description: 'Content creation and development'
  },
  'review': { 
    icon: AlertTriangle, 
    color: 'bg-yellow-500', 
    label: 'Review',
    description: 'Content review and feedback'
  },
  'approval': { 
    icon: CheckCircle, 
    color: 'bg-green-500', 
    label: 'Approval',
    description: 'Final approval stage'
  },
  'legal_review': { 
    icon: Users, 
    color: 'bg-red-500', 
    label: 'Legal Review',
    description: 'Legal compliance review'
  },
  'published': { 
    icon: Play, 
    color: 'bg-emerald-500', 
    label: 'Published',
    description: 'Content is live and published'
  },
  'archived': { 
    icon: Pause, 
    color: 'bg-gray-500', 
    label: 'Archived',
    description: 'Archived or retired content'
  }
};

function WorkflowDesignerMinimal({ templateId = null, initialTemplate = null, showHeader = true }) {
  
  const [template] = useState(initialTemplate || {
    name: '',
    description: '',
    is_active: true,
    stages: [],
    transitions: []
  });
  
  const [stages, setStages] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [draggedStage, setDraggedStage] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedStageType, setSelectedStageType] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Generate connections between sequential stages
  const generateConnections = (stageList) => {
    const connections = [];
    for (let i = 0; i < stageList.length - 1; i++) {
      connections.push({
        from: stageList[i],
        to: stageList[i + 1]
      });
    }
    return connections;
  };
  
  const queryClient = useQueryClient();

  // Test the mutations from original
  const createTemplateMutation = useMutation({
    mutationFn: workflows.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-templates']);
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => workflows.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-templates']);
      queryClient.invalidateQueries(['workflow-template', templateId]);
    }
  });
  
  // Test the useEffect logic from original
  useEffect(() => {
    
    if (initialTemplate) {
      // Set workflow name and description
      setWorkflowName(initialTemplate.name || '');
      setWorkflowDescription(initialTemplate.description || '');
      
      // Auto-position stages if they don't have position data
      const positionedStages = (initialTemplate.states || []).map((stage, index) => {
        let updatedStage = { ...stage };
        
        // Auto-position if no position data
        if (stage.position_x === undefined || stage.position_x === null) {
          // Arrange stages in a horizontal line with spacing
          const spacing = 300;
          const startX = 50;
          const startY = 150;
          
          updatedStage.position_x = startX + (index * spacing);
          updatedStage.position_y = startY;
          
        }
        
        // Ensure stage_type is set (infer from state_name if missing)
        if (!updatedStage.stage_type) {
          // Try to infer stage type from state_name
          const stateNameLower = (updatedStage.state_name || '').toLowerCase();
          if (stateNameLower.includes('planning')) {
            updatedStage.stage_type = 'planning';
          } else if (stateNameLower.includes('content') || stateNameLower.includes('development')) {
            updatedStage.stage_type = 'content_development';
          } else if (stateNameLower.includes('review')) {
            updatedStage.stage_type = 'review';
          } else if (stateNameLower.includes('approval')) {
            updatedStage.stage_type = 'approval';
          } else if (stateNameLower.includes('legal')) {
            updatedStage.stage_type = 'legal_review';
          } else if (stateNameLower.includes('published')) {
            updatedStage.stage_type = 'published';
          } else if (stateNameLower.includes('archived')) {
            updatedStage.stage_type = 'archived';
          } else {
            updatedStage.stage_type = 'planning'; // Default
          }
          
        }
        
        return updatedStage;
      });
      
      setStages(positionedStages);
      setTransitions(initialTemplate.transitions || []);
    }
  }, [initialTemplate]);

  // Drag handlers
  const handleMouseDown = (stage, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDraggedStage(stage.id);
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    event.preventDefault();
  };

  const handleMouseMove = (event) => {
    if (!draggedStage) return;
    
    const canvas = event.currentTarget.closest('.canvas-area');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const newX = event.clientX - canvasRect.left - dragOffset.x;
    const newY = event.clientY - canvasRect.top - dragOffset.y;
    
    // Update stage position
    setStages(prevStages => 
      prevStages.map(stage => 
        stage.id === draggedStage 
          ? { ...stage, position_x: Math.max(0, newX), position_y: Math.max(0, newY) }
          : stage
      )
    );
  };

  const handleMouseUp = () => {
    setDraggedStage(null);
    setDragOffset({ x: 0, y: 0 });
  };

  // Add new stage function
  const addNewStage = (stageType) => {
    const newStage = {
      id: Date.now() + Math.random(),
      state_name: `${stageType}_${Date.now()}`,
      display_name: STAGE_TYPES[stageType].label,
      stage_type: stageType,
      position_x: 50 + (stages.length * 300),
      position_y: 150,
      is_initial: stages.length === 0,
      is_final: false
    };

    setStages(prev => [...prev, newStage]);
    setHasUnsavedChanges(true);
  };

  // Delete stage function
  const deleteStage = (stageId) => {
    setStages(prev => prev.filter(stage => stage.id !== stageId));
    setHasUnsavedChanges(true);
  };

  // Move stage up in order
  const moveStageUp = (index) => {
    if (index > 0) {
      const newStages = [...stages];
      [newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];
      setStages(newStages);
      setHasUnsavedChanges(true);
    }
  };

  // Move stage down in order
  const moveStageDown = (index) => {
    if (index < stages.length - 1) {
      const newStages = [...stages];
      [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
      setStages(newStages);
      setHasUnsavedChanges(true);
    }
  };

  // Save workflow function
  const handleSave = async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    if (stages.length === 0) {
      alert('Please add at least one stage to the workflow');
      return;
    }

    setIsSaving(true);
    try {
      const workflowData = {
        name: workflowName,
        description: workflowDescription,
        is_active: true,
        states: stages.map((stage, index) => ({
          ...stage,
          order: index,
          is_initial: index === 0,
          is_final: index === stages.length - 1
        })),
        transitions: generateConnections(stages).map((conn, index) => ({
          from_state: conn.from.state_name,
          to_state: conn.to.state_name,
          condition: 'auto',
          order: index
        }))
      };

      if (templateId) {
        // Update existing template
        await updateTemplateMutation.mutateAsync({ id: templateId, data: workflowData });
      } else {
        // Create new template
        await createTemplateMutation.mutateAsync(workflowData);
      }

      setHasUnsavedChanges(false);
      alert('Workflow saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save workflow. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel function
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        // Reset to original state
        if (initialTemplate) {
          setWorkflowName(initialTemplate.name || '');
          setWorkflowDescription(initialTemplate.description || '');
          const positionedStages = (initialTemplate.states || []).map((stage, index) => {
            let updatedStage = { ...stage };
            if (stage.position_x === undefined || stage.position_x === null) {
              updatedStage.position_x = 50 + (index * 300);
              updatedStage.position_y = 150;
            }
            if (!updatedStage.stage_type) {
              updatedStage.stage_type = 'planning';
            }
            return updatedStage;
          });
          setStages(positionedStages);
        } else {
          setWorkflowName('');
          setWorkflowDescription('');
          setStages([]);
        }
        setHasUnsavedChanges(false);
      }
    }
  };

  // Render connection arrow between two stages
  const renderConnection = (fromStage, toStage, index) => {
    const fromX = fromStage.position_x + 192; // Stage width is 192px (w-48)
    const fromY = fromStage.position_y + 32; // Half of stage height (64px)
    const toX = toStage.position_x;
    const toY = toStage.position_y + 32;

    const midX = (fromX + toX) / 2;
    
    return (
      <g key={`connection-${index}`}>
        {/* Main line */}
        <line
          x1={fromX}
          y1={fromY}
          x2={toX - 10}
          y2={toY}
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
          className="dark:stroke-blue-400"
        />
        {/* Arrow head */}
        <polygon
          points={`${toX - 10},${toY - 5} ${toX},${toY} ${toX - 10},${toY + 5}`}
          fill="rgb(59, 130, 246)"
          className="dark:fill-blue-400"
        />
        {/* Step number badge */}
        <circle
          cx={midX}
          cy={fromY - 15}
          r="12"
          fill="rgb(59, 130, 246)"
          className="dark:fill-blue-400"
        />
        <text
          x={midX}
          y={fromY - 10}
          textAnchor="middle"
          fontSize="10"
          fill="white"
          fontWeight="bold"
        >
          {index + 1}
        </text>
      </g>
    );
  };
  
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      
      {/* Workflow Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => {
                    setWorkflowName(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Enter workflow name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={workflowDescription}
                  onChange={(e) => {
                    setWorkflowDescription(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Enter description..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 ml-6">
            {hasUnsavedChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !workflowName.trim() || stages.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        
        {/* Test the main structure from original */}
        <div className="h-full flex flex-col">
          <div className="flex-1 flex">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Add Stage Types</h3>
                  <div className="space-y-2">
                    {Object.entries(STAGE_TYPES).map(([type, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => addNewStage(type)}
                          className="w-full flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 transition-colors group"
                        >
                          <div className={`w-8 h-8 rounded-lg ${config.color} flex items-center justify-center mr-3`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {config.label}
                            </div>
                          </div>
                          <Plus className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current workflow stages */}
                {stages.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Current Stages</h3>
                    <div className="space-y-2">
                      {stages.map((stage, index) => {
                        const stageType = STAGE_TYPES[stage.stage_type] || STAGE_TYPES.planning;
                        const Icon = stageType.icon;
                        return (
                          <div
                            key={stage.id}
                            className="flex items-center p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-500 dark:bg-blue-400 flex items-center justify-center mr-2 flex-shrink-0">
                              <span className="text-xs font-bold text-white">{index + 1}</span>
                            </div>
                            <div className={`w-6 h-6 rounded ${stageType.color} flex items-center justify-center mr-2 flex-shrink-0`}>
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                {stage.display_name}
                              </div>
                            </div>
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={() => moveStageUp(index)}
                                disabled={index === 0}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => moveStageDown(index)}
                                disabled={index === stages.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => deleteStage(stage.id)}
                              className="p-1 ml-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative">
              <div className="flex-1 relative overflow-auto bg-gray-100 dark:bg-gray-900">
                <div className="p-4">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Canvas Area</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Drag stages to reposition them. Click stages to select and edit properties.
                  </p>
                  
                  {/* Render positioned stages */}
                  <div 
                    className="canvas-area relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded overflow-auto" 
                    style={{ height: '800px', width: '100%', minWidth: '2000px' }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {/* SVG overlay for connections */}
                    <svg 
                      className="absolute inset-0 pointer-events-none" 
                      style={{ width: '100%', height: '100%' }}
                    >
                      {generateConnections(stages).map((connection, index) => 
                        renderConnection(connection.from, connection.to, index)
                      )}
                    </svg>

                    {/* Stage cards */}
                    {stages.map((stage, index) => {
                      const stageType = STAGE_TYPES[stage.stage_type] || STAGE_TYPES.planning;
                      const Icon = stageType.icon;
                      
                      return (
                        <div
                          key={stage.id}
                          className="absolute w-48 h-16 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-md cursor-move hover:shadow-lg transition-shadow"
                          style={{
                            left: Math.min(stage.position_x || 0, 1800), // Limit to visible area
                            top: Math.min(stage.position_y || 0, 700), // Limit to visible area
                          }}
                          onMouseDown={(e) => handleMouseDown(stage, e)}
                        >
                          <div className="flex items-center h-full p-3">
                            {/* Step number badge */}
                            <div className="w-6 h-6 rounded-full bg-blue-500 dark:bg-blue-400 flex items-center justify-center mr-2 flex-shrink-0">
                              <span className="text-xs font-bold text-white">{index + 1}</span>
                            </div>
                            <div className={`w-10 h-10 rounded-lg ${stageType.color} flex items-center justify-center mr-3 flex-shrink-0`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {stage.display_name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {stage.state_name}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowDesignerMinimal;