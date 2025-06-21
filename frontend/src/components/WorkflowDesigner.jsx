import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Target
} from 'lucide-react';
import { workflows } from '../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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

const CONDITION_TYPES = {
  'manual': { label: 'Manual Trigger', description: 'Requires manual action to proceed' },
  'automatic': { label: 'Automatic', description: 'Automatically proceeds when conditions are met' },
  'timer': { label: 'Timer Based', description: 'Proceeds after specified time delay' },
  'approval': { label: 'Approval Required', description: 'Requires approval from specified roles' },
  'conditional': { label: 'Conditional', description: 'Proceeds based on custom conditions' }
};

const ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'designer', label: 'Designer' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'approver', label: 'Approver' },
  { value: 'sme', label: 'Subject Matter Expert' }
];

function WorkflowDesigner({ templateId = null, initialTemplate = null, showHeader = true }) {
  console.log('WorkflowDesigner rendered with:', { templateId, initialTemplate, showHeader });
  
  const [template, setTemplate] = useState(initialTemplate || {
    name: '',
    description: '',
    is_active: true,
    stages: [],
    transitions: []
  });
  
  const [stages, setStages] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  
  console.log('Current stages state:', stages);
  console.log('Current transitions state:', transitions);
  const [selectedTransition, setSelectedTransition] = useState(null);
  const [draggedStage, setDraggedStage] = useState(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [mode, setMode] = useState('design'); // 'design' | 'preview' | 'settings'
  
  const canvasRef = useRef(null);
  const queryClient = useQueryClient();

  // Initialize with template data if provided
  useEffect(() => {
    console.log('WorkflowDesigner useEffect triggered with initialTemplate:', initialTemplate);
    
    if (initialTemplate) {
      // Auto-position stages if they don't have position data
      const positionedStages = (initialTemplate.states || []).map((stage, index) => {
        let updatedStage = { ...stage };
        
        // Auto-position if no position data
        if (stage.position_x === undefined || stage.position_x === null) {
          // Arrange stages in a horizontal line with spacing
          const spacing = 250;
          const startX = 100;
          const startY = 200;
          
          updatedStage.position_x = startX + (index * spacing);
          updatedStage.position_y = startY;
          
          console.log(`Auto-positioned stage ${index}:`, {
            name: stage.state_name,
            x: updatedStage.position_x,
            y: updatedStage.position_y
          });
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
          
          console.log(`Inferred stage_type for ${stage.state_name}:`, updatedStage.stage_type);
        }
        
        return updatedStage;
      });
      
      console.log('Setting positioned stages:', positionedStages);
      setStages(positionedStages);
      setTransitions(initialTemplate.transitions || []);
    }
  }, [initialTemplate]);

  // Mutations for API calls
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

  const addStageMutation = useMutation({
    mutationFn: ({ templateId, stage }) => workflows.addStage(templateId, stage),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-template', templateId]);
    }
  });

  const deleteTransitionMutation = useMutation({
    mutationFn: ({ templateId, transitionId }) => workflows.deleteTransition(templateId, transitionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-template', templateId]);
    }
  });

  // Canvas event handlers
  const handleCanvasClick = useCallback((e) => {
    if (e.target === canvasRef.current) {
      setSelectedStage(null);
      setSelectedTransition(null);
    }
  }, []);

  const handleStageClick = useCallback((stage, e) => {
    e.stopPropagation();
    setSelectedStage(stage);
    setSelectedTransition(null);
  }, []);

  const handleStageDragStart = useCallback((stage, e) => {
    setDraggedStage(stage);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleStageDragEnd = useCallback(() => {
    setDraggedStage(null);
  }, []);

  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    if (!draggedStage) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStages(prev => prev.map(stage => 
      stage.id === draggedStage.id 
        ? { ...stage, position_x: x, position_y: y }
        : stage
    ));
  }, [draggedStage]);

  const handleCanvasDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Stage management
  const addStage = useCallback((stageType, position = { x: 100, y: 100 }) => {
    const newStage = {
      id: Date.now(), // Temporary ID
      state_name: `${stageType}_${Date.now()}`,
      display_name: STAGE_TYPES[stageType]?.label || 'New Stage',
      stage_type: stageType,
      is_initial: stages.length === 0,
      is_final: false,
      position_x: position.x,
      position_y: position.y,
      state_config: {
        color: STAGE_TYPES[stageType]?.color || 'bg-gray-500',
        icon: STAGE_TYPES[stageType]?.icon?.name || 'Clock',
        required_roles: [],
        notifications: {
          on_enter: false,
          on_exit: false,
          assignees: []
        },
        auto_advance: false,
        estimated_duration: null
      }
    };

    setStages(prev => [...prev, newStage]);
    setSelectedStage(newStage);
  }, [stages.length]);

  const updateStage = useCallback((stageId, updates) => {
    setStages(prev => prev.map(stage => 
      stage.id === stageId ? { ...stage, ...updates } : stage
    ));
    
    if (selectedStage?.id === stageId) {
      setSelectedStage(prev => ({ ...prev, ...updates }));
    }
  }, [selectedStage]);

  const deleteStage = useCallback((stageId) => {
    setStages(prev => prev.filter(stage => stage.id !== stageId));
    setTransitions(prev => prev.filter(t => t.from_stage_id !== stageId && t.to_stage_id !== stageId));
    
    if (selectedStage?.id === stageId) {
      setSelectedStage(null);
    }
  }, [selectedStage]);

  // Transition management
  const addTransition = useCallback((fromStageId, toStageId) => {
    const newTransition = {
      id: Date.now(),
      from_stage_id: fromStageId,
      to_stage_id: toStageId,
      condition_type: 'manual',
      condition_config: {
        required_roles: [],
        approval_required: false,
        auto_trigger: false
      }
    };

    setTransitions(prev => [...prev, newTransition]);
  }, []);

  const deleteTransition = useCallback((transitionId) => {
    setTransitions(prev => prev.filter(t => t.id !== transitionId));
    if (selectedTransition?.id === transitionId) {
      setSelectedTransition(null);
    }
  }, [selectedTransition]);

  // Save template
  const saveTemplate = useCallback(async () => {
    const templateData = {
      ...template,
      states: stages.map(stage => ({
        ...stage,
        state_config: JSON.stringify(stage.state_config)
      })),
      transitions
    };

    try {
      if (templateId) {
        await updateTemplateMutation.mutateAsync({ id: templateId, data: templateData });
      } else {
        const result = await createTemplateMutation.mutateAsync(templateData);
        // Navigate to edit mode after creation
        if (result?.data?.data?.id) {
          window.location.href = `/workflows/${result.data.data.id}/edit`;
        }
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  }, [template, stages, transitions, templateId, updateTemplateMutation, createTemplateMutation]);

  console.log('About to render WorkflowDesigner, stages count:', stages.length);
  
  return (
    <div className="h-full flex flex-col">
      {/* Debug info */}
      <div className="p-4 bg-yellow-50 border-b">
        <div className="text-sm">
          <div>Template ID: {templateId}</div>
          <div>Stages Count: {stages.length}</div>
          <div>Mode: {mode}</div>
          <div>Show Header: {showHeader ? 'Yes' : 'No'}</div>
        </div>
      </div>
        
        {/* Header */}
        {showHeader && (
          <div className="border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <GitBranch className="h-6 w-6 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {templateId ? 'Edit Workflow Template' : 'Create Workflow Template'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Design your workflow with drag-and-drop stages and conditional transitions
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setMode('design')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      mode === 'design'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Design
                  </button>
                  <button
                    onClick={() => setMode('preview')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      mode === 'preview'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setMode('settings')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      mode === 'settings'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Settings
                  </button>
                </div>
                
                <button
                  onClick={saveTemplate}
                  disabled={createTemplateMutation.isLoading || updateTemplateMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createTemplateMutation.isLoading || updateTemplateMutation.isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

      <div className="flex-1 flex">
        {/* Sidebar */}
        {mode === 'design' && (
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <div className="space-y-6">
              {/* Stage Types */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Stage Types
                </h3>
                <div className="space-y-2">
                  {Object.entries(STAGE_TYPES).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => addStage(type)}
                        className="w-full flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 transition-colors group"
                      >
                        <div className={`w-8 h-8 rounded-lg ${config.color} flex items-center justify-center mr-3`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {config.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {config.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Actions
                </h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg">
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate Template
                  </button>
                  <button className="w-full flex items-center p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg">
                    <Download className="h-4 w-4 mr-2" />
                    Export Template
                  </button>
                  <button className="w-full flex items-center p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative">
          {/* Fixed Overlay Controls - Always visible in viewport */}
          {mode === 'design' && (
            <>
              {/* Connection Mode Banner - Fixed to viewport */}
              {connectionMode && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Connection Mode: {connectionStart ? 'Click target stage' : 'Click source stage'}
                    </span>
                    <button
                      onClick={() => {
                        setConnectionMode(false);
                        setConnectionStart(null);
                      }}
                      className="ml-2 text-blue-200 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Fixed Toolbar - Always visible in viewport */}
              <div className="fixed top-20 right-6 z-50 flex flex-col space-y-2">
                <button
                  onClick={() => setConnectionMode(!connectionMode)}
                  className={`p-3 rounded-lg shadow-lg ${
                    connectionMode 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  } hover:bg-blue-600 hover:text-white transition-colors`}
                  title="Connection Mode"
                >
                  <Zap className="h-5 w-5" />
                </button>
                
                {/* Scroll to origin button */}
                <button
                  onClick={() => {
                    const canvas = canvasRef.current?.parentElement;
                    if (canvas) {
                      canvas.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                    }
                  }}
                  className="p-3 rounded-lg shadow-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Scroll to Start"
                >
                  <Target className="h-5 w-5" />
                </button>
              </div>
            </>
          )}

          {mode === 'design' && (
            <DesignCanvas
              ref={canvasRef}
              stages={stages}
              transitions={transitions}
              selectedStage={selectedStage}
              selectedTransition={selectedTransition}
              onCanvasClick={handleCanvasClick}
              onStageClick={handleStageClick}
              onStageDragStart={handleStageDragStart}
              onStageDragEnd={handleStageDragEnd}
              onCanvasDrop={handleCanvasDrop}
              onCanvasDragOver={handleCanvasDragOver}
              onAddTransition={addTransition}
              onDeleteTransition={deleteTransition}
              onUpdateStage={updateStage}
              onDeleteStage={deleteStage}
            />
          )}
          
          {mode === 'preview' && (
            <PreviewMode template={template} stages={stages} transitions={transitions} />
          )}
          
          {mode === 'settings' && (
            <SettingsMode 
              template={template} 
              onUpdateTemplate={setTemplate}
              stages={stages}
              onUpdateStages={setStages}
            />
          )}
        </div>

        {/* Properties Panel */}
        {mode === 'design' && (selectedStage || selectedTransition) && (
          <PropertiesPanel
            selectedStage={selectedStage}
            selectedTransition={selectedTransition}
            onUpdateStage={updateStage}
            onUpdateTransition={(id, updates) => {
              setTransitions(prev => prev.map(t => 
                t.id === id ? { ...t, ...updates } : t
              ));
            }}
            onDeleteStage={deleteStage}
            onDeleteTransition={deleteTransition}
          />
        )}
      </div>
    </div>
  );
}

// Design Canvas Component
const DesignCanvas = React.forwardRef((props, ref) => {
  const {
    stages,
    transitions,
    selectedStage,
    selectedTransition,
    onCanvasClick,
    onStageClick,
    onStageDragStart,
    onStageDragEnd,
    onCanvasDrop,
    onCanvasDragOver,
    onAddTransition,
    onDeleteTransition,
    onUpdateStage,
    onDeleteStage
  } = props;

  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);

  const handleStageConnectionClick = (stage, e) => {
    e.stopPropagation();
    
    if (connectionMode) {
      if (connectionStart && connectionStart.id !== stage.id) {
        // Complete connection
        onAddTransition(connectionStart.id, stage.id);
        setConnectionMode(false);
        setConnectionStart(null);
      } else {
        // Start connection
        setConnectionStart(stage);
      }
    } else {
      onStageClick(stage, e);
    }
  };

  const renderTransition = (transition) => {
    const fromStage = stages.find(s => s.id === transition.from_stage_id);
    const toStage = stages.find(s => s.id === transition.to_stage_id);
    
    if (!fromStage || !toStage) return null;

    const fromX = fromStage.position_x + 100; // Stage width / 2
    const fromY = fromStage.position_y + 30;  // Stage height / 2
    const toX = toStage.position_x + 100;
    const toY = toStage.position_y + 30;

    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;

    return (
      <g key={transition.id}>
        <defs>
          <marker
            id={`arrowhead-${transition.id}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={selectedTransition?.id === transition.id ? '#3B82F6' : '#6B7280'}
            />
          </marker>
        </defs>
        <line
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke={selectedTransition?.id === transition.id ? '#3B82F6' : '#6B7280'}
          strokeWidth="2"
          markerEnd={`url(#arrowhead-${transition.id})`}
          className="cursor-pointer hover:stroke-blue-500"
          onClick={(e) => {
            e.stopPropagation();
            // onTransitionClick(transition);
          }}
        />
        <circle
          cx={midX}
          cy={midY}
          r="8"
          fill="white"
          stroke={selectedTransition?.id === transition.id ? '#3B82F6' : '#6B7280'}
          strokeWidth="2"
          className="cursor-pointer hover:fill-blue-50"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteTransition(transition.id);
          }}
        >
          <title>Click to delete transition</title>
        </circle>
        <text
          x={midX}
          y={midY + 1}
          textAnchor="middle"
          className="text-xs fill-gray-600 pointer-events-none select-none"
        >
          ×
        </text>
      </g>
    );
  };

  return (
    <div className="flex-1 relative overflow-auto bg-gray-100 dark:bg-gray-900">
      {/* Canvas */}
      <div
        ref={ref}
        className="relative cursor-crosshair bg-gray-100 dark:bg-gray-900"
        style={{
          width: Math.max(2000, ...(stages.length > 0 ? stages.map(s => (s.position_x || 0) + 300) : [2000])),
          height: Math.max(1400, ...(stages.length > 0 ? stages.map(s => (s.position_y || 0) + 400) : [1400]))
        }}
        onClick={onCanvasClick}
        onDrop={onCanvasDrop}
        onDragOver={onCanvasDragOver}
      >
        {/* Grid Background */}
        <svg 
          className="absolute inset-0 pointer-events-none"
          style={{
            width: Math.max(2000, ...(stages.length > 0 ? stages.map(s => (s.position_x || 0) + 300) : [2000])),
            height: Math.max(1400, ...(stages.length > 0 ? stages.map(s => (s.position_y || 0) + 400) : [1400]))
          }}
        >
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-gray-300 dark:text-gray-600"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Transitions */}
        <svg 
          className="absolute inset-0 pointer-events-none"
          style={{
            width: Math.max(2000, ...(stages.length > 0 ? stages.map(s => (s.position_x || 0) + 300) : [2000])),
            height: Math.max(1400, ...(stages.length > 0 ? stages.map(s => (s.position_y || 0) + 400) : [1400]))
          }}
        >
          {transitions.map(renderTransition)}
        </svg>

        {/* Stages */}
        {stages.map((stage) => (
          <StageNode
            key={stage.id}
            stage={stage}
            isSelected={selectedStage?.id === stage.id}
            isConnectionStart={connectionStart?.id === stage.id}
            connectionMode={connectionMode}
            onClick={(e) => handleStageConnectionClick(stage, e)}
            onDragStart={(e) => onStageDragStart(stage, e)}
            onDragEnd={onStageDragEnd}
          />
        ))}

        {/* Empty State */}
        {stages.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <GitBranch className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Start Building Your Workflow
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Add stages from the sidebar to begin designing your workflow
              </p>
              <div className="text-sm text-gray-400 dark:text-gray-500">
                Drag stages to position them • Use connection mode to link stages
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Stage Node Component
function StageNode({ 
  stage, 
  isSelected, 
  isConnectionStart, 
  connectionMode, 
  onClick, 
  onDragStart, 
  onDragEnd 
}) {
  const stageType = STAGE_TYPES[stage.stage_type] || STAGE_TYPES.planning;
  const Icon = stageType.icon;

  return (
    <div
      className={`absolute w-48 h-16 rounded-lg border-2 cursor-pointer transition-all transform hover:scale-105 ${
        isSelected 
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-500 ring-opacity-50' 
          : isConnectionStart
          ? 'border-yellow-500 shadow-lg ring-2 ring-yellow-500 ring-opacity-50'
          : connectionMode
          ? 'border-green-400 hover:border-green-500'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
      } bg-white dark:bg-gray-800 shadow-md`}
      style={{
        left: stage.position_x,
        top: stage.position_y,
      }}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center h-full p-3">
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
        {stage.is_initial && (
          <div className="w-2 h-2 bg-green-500 rounded-full" title="Initial Stage" />
        )}
        {stage.is_final && (
          <div className="w-2 h-2 bg-red-500 rounded-full ml-1" title="Final Stage" />
        )}
      </div>
    </div>
  );
}

// Properties Panel Component
function PropertiesPanel({ 
  selectedStage, 
  selectedTransition, 
  onUpdateStage, 
  onUpdateTransition,
  onDeleteStage,
  onDeleteTransition 
}) {
  if (selectedStage) {
    return <StageProperties stage={selectedStage} onUpdate={onUpdateStage} onDelete={onDeleteStage} />;
  }
  
  if (selectedTransition) {
    return <TransitionProperties transition={selectedTransition} onUpdate={onUpdateTransition} onDelete={onDeleteTransition} />;
  }
  
  return null;
}

// Stage Properties Component
function StageProperties({ stage, onUpdate, onDelete }) {
  const [config, setConfig] = useState(stage.state_config || {});

  const handleConfigUpdate = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(stage.id, { state_config: newConfig });
  };

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Stage Properties</h3>
        <button
          onClick={() => onDelete(stage.id)}
          className="p-1 text-red-500 hover:text-red-700 transition-colors"
          title="Delete Stage"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={stage.display_name}
            onChange={(e) => onUpdate(stage.id, { display_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            State Name (Technical)
          </label>
          <input
            type="text"
            value={stage.state_name}
            onChange={(e) => onUpdate(stage.id, { state_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Stage Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Stage Type
          </label>
          <select
            value={stage.stage_type}
            onChange={(e) => onUpdate(stage.id, { stage_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            {Object.entries(STAGE_TYPES).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* Flags */}
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={stage.is_initial}
              onChange={(e) => onUpdate(stage.id, { is_initial: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Initial Stage</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={stage.is_final}
              onChange={(e) => onUpdate(stage.id, { is_final: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Final Stage</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.auto_advance}
              onChange={(e) => handleConfigUpdate('auto_advance', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Auto Advance</span>
          </label>
        </div>

        {/* Required Roles */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Required Roles
          </label>
          <div className="space-y-2">
            {ROLES.map((role) => (
              <label key={role.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.required_roles?.includes(role.value) || false}
                  onChange={(e) => {
                    const currentRoles = config.required_roles || [];
                    const newRoles = e.target.checked
                      ? [...currentRoles, role.value]
                      : currentRoles.filter(r => r !== role.value);
                    handleConfigUpdate('required_roles', newRoles);
                  }}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{role.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notifications
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.notifications?.on_enter || false}
                onChange={(e) => handleConfigUpdate('notifications', {
                  ...config.notifications,
                  on_enter: e.target.checked
                })}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">On Enter</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.notifications?.on_exit || false}
                onChange={(e) => handleConfigUpdate('notifications', {
                  ...config.notifications,
                  on_exit: e.target.checked
                })}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">On Exit</span>
            </label>
          </div>
        </div>

        {/* Estimated Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Estimated Duration (days)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={config.estimated_duration || ''}
            onChange={(e) => handleConfigUpdate('estimated_duration', parseFloat(e.target.value) || null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter duration"
          />
        </div>
      </div>
    </div>
  );
}

// Transition Properties Component
function TransitionProperties({ transition, onUpdate, onDelete }) {
  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transition Properties</h3>
        <button
          onClick={() => onDelete(transition.id)}
          className="p-1 text-red-500 hover:text-red-700 transition-colors"
          title="Delete Transition"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Condition Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Condition Type
          </label>
          <select
            value={transition.condition_type}
            onChange={(e) => onUpdate(transition.id, { condition_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            {Object.entries(CONDITION_TYPES).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {CONDITION_TYPES[transition.condition_type]?.description}
        </div>

        {/* Conditional fields based on condition type */}
        {transition.condition_type === 'timer' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Delay (hours)
            </label>
            <input
              type="number"
              min="1"
              value={transition.condition_config?.delay_hours || ''}
              onChange={(e) => onUpdate(transition.id, {
                condition_config: {
                  ...transition.condition_config,
                  delay_hours: parseInt(e.target.value) || 1
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        )}

        {transition.condition_type === 'approval' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Required Approver Roles
            </label>
            <div className="space-y-2">
              {ROLES.map((role) => (
                <label key={role.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={transition.condition_config?.required_roles?.includes(role.value) || false}
                    onChange={(e) => {
                      const currentRoles = transition.condition_config?.required_roles || [];
                      const newRoles = e.target.checked
                        ? [...currentRoles, role.value]
                        : currentRoles.filter(r => r !== role.value);
                      onUpdate(transition.id, {
                        condition_config: {
                          ...transition.condition_config,
                          required_roles: newRoles
                        }
                      });
                    }}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{role.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Preview Mode Component
function PreviewMode({ template, stages, transitions }) {
  return (
    <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Workflow Preview: {template.name || 'Untitled Workflow'}
          </h3>
          
          {stages.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No stages defined yet. Switch to Design mode to add stages.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Workflow Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stages.length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Stages</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {transitions.length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Transitions</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stages.reduce((sum, stage) => sum + (stage.state_config?.estimated_duration || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Est. Days</div>
                </div>
              </div>

              {/* Stage Flow */}
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                  Stage Flow
                </h4>
                <div className="space-y-3">
                  {stages
                    .sort((a, b) => {
                      if (a.is_initial) return -1;
                      if (b.is_initial) return 1;
                      return 0;
                    })
                    .map((stage, index) => {
                      const stageType = STAGE_TYPES[stage.stage_type] || STAGE_TYPES.planning;
                      const Icon = stageType.icon;
                      const connectedTransitions = transitions.filter(t => t.from_stage_id === stage.id);

                      return (
                        <div key={stage.id} className="flex items-center">
                          <div className="flex items-center">
                            <div className={`w-10 h-10 rounded-lg ${stageType.color} flex items-center justify-center mr-3`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {stage.display_name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {stage.state_config?.estimated_duration ? 
                                  `~${stage.state_config.estimated_duration} days` : 
                                  'Duration not set'
                                }
                              </div>
                            </div>
                          </div>
                          
                          {stage.is_initial && (
                            <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full">
                              Start
                            </span>
                          )}
                          
                          {stage.is_final && (
                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full">
                              End
                            </span>
                          )}

                          {connectedTransitions.length > 0 && !stage.is_final && (
                            <div className="ml-auto flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <ArrowRight className="h-4 w-4 mr-1" />
                              {connectedTransitions.length} transition{connectedTransitions.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Settings Mode Component
function SettingsMode({ template, onUpdateTemplate, stages, onUpdateStages }) {
  return (
    <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
            Workflow Settings
          </h3>
          
          <div className="space-y-6">
            {/* Basic Settings */}
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                Basic Information
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={template.name}
                    onChange={(e) => onUpdateTemplate({ ...template, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter template name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={template.description}
                    onChange={(e) => onUpdateTemplate({ ...template, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Describe the purpose and usage of this workflow template"
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={template.is_active}
                      onChange={(e) => onUpdateTemplate({ ...template, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Active (available for new workflows)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Workflow Validation */}
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                Validation
              </h4>
              <div className="space-y-2">
                <ValidationItem
                  isValid={stages.length > 0}
                  message="Workflow has at least one stage"
                />
                <ValidationItem
                  isValid={stages.some(s => s.is_initial)}
                  message="Workflow has an initial stage"
                />
                <ValidationItem
                  isValid={stages.some(s => s.is_final)}
                  message="Workflow has a final stage"
                />
                <ValidationItem
                  isValid={template.name && template.name.trim().length > 0}
                  message="Template has a name"
                />
              </div>
            </div>

            {/* Export/Import */}
            <div>
              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                Import/Export
              </h4>
              <div className="flex space-x-2">
                <button className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </button>
                <button className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Upload className="h-4 w-4 mr-2" />
                  Import JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Validation Item Component
function ValidationItem({ isValid, message }) {
  return (
    <div className="flex items-center">
      {isValid ? (
        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
      )}
      <span className={`text-sm ${isValid ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
        {message}
      </span>
    </div>
  );
}

export default WorkflowDesigner;