import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  History
} from 'lucide-react';
import { courses } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/utils';

const COURSE_STATUS_LABELS = {
  'pre_development': 'Pre-Development',
  'outlines': 'Outlines', 
  'storyboard': 'Storyboard',
  'development': 'Development',
  'completed': 'Completed'
};

const PHASE_STATUS_COLORS = {
  'alpha_draft': 'text-blue-600 bg-blue-100',
  'alpha_review': 'text-purple-600 bg-purple-100',
  'beta_revision': 'text-orange-600 bg-orange-100',
  'beta_review': 'text-yellow-600 bg-yellow-100',
  'final_revision': 'text-green-600 bg-green-100',
  'final_signoff_sent': 'text-teal-600 bg-teal-100',
  'final_signoff_received': 'text-emerald-600 bg-emerald-100'
};

function PhaseHistoryModal({ courseId, courseName, onClose }) {
  const { data: historyData, isLoading, error } = useQuery({
    queryKey: ['coursePhaseHistory', courseId],
    queryFn: async () => {
      const response = await courses.getPhaseHistory(courseId);
      return response.data.data;
    },
    enabled: Boolean(courseId)
  });

  const formatPhaseStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-6 border w-full max-w-6xl shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <History className="h-6 w-6 mr-3 text-blue-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Phase History
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
              Failed to load phase history
            </p>
          </div>
        ) : !historyData?.phaseHistory || Object.keys(historyData.phaseHistory).length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No phase history available yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Phase history will be created when the course progresses through different statuses
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {Object.entries(historyData.phaseHistory).map(([courseStatus, phases]) => (
              <div key={courseStatus} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    {COURSE_STATUS_LABELS[courseStatus] || courseStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    ({phases.length} phase{phases.length !== 1 ? 's' : ''})
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {phases.map((phase, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="mb-3">
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {phase.subtaskTitle}
                        </h5>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        {phase.startDate && (
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>Started: {formatDate(phase.startDate)}</span>
                          </div>
                        )}
                        
                        {phase.finishDate && (
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>Finished: {formatDate(phase.finishDate)}</span>
                          </div>
                        )}
                        
                        {phase.completedAt && (
                          <div className="flex items-center text-gray-600 dark:text-gray-400">
                            <Clock className="h-4 w-4 mr-2" />
                            <span>Completed: {formatDate(phase.completedAt)}</span>
                          </div>
                        )}
                        
                        {phase.archivedAt && (
                          <div className="flex items-center text-gray-500 dark:text-gray-500 text-xs">
                            <History className="h-3 w-3 mr-1" />
                            <span>Archived: {formatDateTime(phase.archivedAt)}</span>
                            {phase.archivedByName && (
                              <span className="ml-1">by {phase.archivedByName}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Phase History Details */}
                      {phase.phaseHistory && phase.phaseHistory.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <h6 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Phase Timeline:</h6>
                          <div className="space-y-1">
                            {phase.phaseHistory.map((historyEntry, historyIndex) => (
                              <div key={historyIndex} className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{formatPhaseStatus(historyEntry.status)}</span>
                                {historyEntry.started_at && (
                                  <span className="ml-2">
                                    {formatDate(historyEntry.started_at)}
                                    {historyEntry.finished_at && ` - ${formatDate(historyEntry.finished_at)}`}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default PhaseHistoryModal;