import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  CheckCircle, 
  Circle, 
  Clock, 
  AlertTriangle, 
  Pause,
  ArrowRight,
  Workflow
} from 'lucide-react';
import { workflows } from '../lib/api';

const WORKFLOW_STATES = {
  'draft': { icon: Circle, label: 'Draft', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  'planning': { icon: Circle, label: 'Planning', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  'content_development': { icon: Clock, label: 'Development', color: 'text-blue-500', bgColor: 'bg-blue-100' },
  'development': { icon: Clock, label: 'Development', color: 'text-blue-500', bgColor: 'bg-blue-100' },
  'review': { icon: AlertTriangle, label: 'Review', color: 'text-yellow-500', bgColor: 'bg-yellow-100' },
  'sme_review': { icon: AlertTriangle, label: 'SME Review', color: 'text-yellow-500', bgColor: 'bg-yellow-100' },
  'instructional_review': { icon: AlertTriangle, label: 'Instructional Review', color: 'text-yellow-500', bgColor: 'bg-yellow-100' },
  'legal_review': { icon: AlertTriangle, label: 'Legal Review', color: 'text-orange-500', bgColor: 'bg-orange-100' },
  'compliance_review': { icon: AlertTriangle, label: 'Compliance Review', color: 'text-orange-500', bgColor: 'bg-orange-100' },
  'final_approval': { icon: Pause, label: 'Final Approval', color: 'text-orange-500', bgColor: 'bg-orange-100' },
  'approval': { icon: Pause, label: 'Approval', color: 'text-orange-500', bgColor: 'bg-orange-100' },
  'published': { icon: CheckCircle, label: 'Published', color: 'text-green-500', bgColor: 'bg-green-100' },
  'on_hold': { icon: Pause, label: 'On Hold', color: 'text-red-500', bgColor: 'bg-red-100' },
  'archived': { icon: Circle, label: 'Archived', color: 'text-gray-400', bgColor: 'bg-gray-100' }
};

function WorkflowMapModal({ courseId, courseName, currentWorkflowState, onClose }) {
  // For now, use a predefined workflow since the API endpoint has issues
  // In the future, this can be enhanced to fetch dynamic workflow data
  
  // Create a common workflow progression based on what we see in the database
  const getWorkflowSteps = () => {
    // Common training course workflow steps
    return [
      'planning',
      'content_development', 
      'sme_review',
      'legal_review',
      'final_approval',
      'published'
    ];
  };

  const workflowSteps = getWorkflowSteps();
  const currentStepIndex = workflowSteps.findIndex(step => step === currentWorkflowState);
  
  const isLoading = false;
  const error = null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Workflow className="h-6 w-6 mr-3 text-blue-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Workflow Progress
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {courseName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-400 mb-4" />
            <p className="text-red-600 dark:text-red-400">
              Failed to load workflow data
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Status */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {(() => {
                    const stateInfo = WORKFLOW_STATES[currentWorkflowState] || WORKFLOW_STATES['draft'];
                    const StateIcon = stateInfo.icon;
                    return <StateIcon className={`h-5 w-5 ${stateInfo.color}`} />;
                  })()}
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Current Step
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {WORKFLOW_STATES[currentWorkflowState]?.label || currentWorkflowState}
                  </p>
                </div>
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Workflow Steps
              </h4>
              
              <div className="relative">
                {workflowSteps.map((step, index) => {
                  const stateInfo = WORKFLOW_STATES[step] || WORKFLOW_STATES['draft'];
                  const StateIcon = stateInfo.icon;
                  const isPassed = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const isFuture = index > currentStepIndex;

                  return (
                    <div key={step} className="relative flex items-center pb-8 last:pb-0">
                      {/* Connector Line */}
                      {index < workflowSteps.length - 1 && (
                        <div 
                          className={`absolute left-4 top-8 w-0.5 h-8 ${
                            isPassed ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        />
                      )}
                      
                      {/* Step Icon */}
                      <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
                        isCurrent 
                          ? `${stateInfo.bgColor} ring-4 ring-blue-200 dark:ring-blue-800` 
                          : isPassed 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        {isPassed ? (
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <StateIcon className={`h-4 w-4 ${
                            isCurrent 
                              ? stateInfo.color 
                              : 'text-gray-400 dark:text-gray-500'
                          }`} />
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="ml-4 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className={`text-sm font-medium ${
                              isCurrent 
                                ? 'text-gray-900 dark:text-white' 
                                : isPassed 
                                ? 'text-green-800 dark:text-green-300' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {stateInfo.label}
                            </h5>
                            <p className={`text-xs ${
                              isCurrent 
                                ? 'text-gray-600 dark:text-gray-300' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {isCurrent ? 'Current step' : isPassed ? 'Completed' : 'Upcoming'}
                            </p>
                          </div>
                          
                          {isCurrent && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              Current
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workflow Info */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Workflow:</span> Standard Training Course Workflow
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                <span className="font-medium">Current Step:</span> {WORKFLOW_STATES[currentWorkflowState]?.label || currentWorkflowState}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkflowMapModal;