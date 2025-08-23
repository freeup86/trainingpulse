import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Brain,
  Lightbulb,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Target,
  Users,
  Calendar,
  Zap,
  Plus,
  X,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Settings,
  Sparkles,
  FileText,
  BarChart3,
  ArrowRight,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { courses } from '../lib/api';

// Suggestion Types
const SUGGESTION_TYPES = {
  TASK_BREAKDOWN: 'task_breakdown',
  DEADLINE_OPTIMIZATION: 'deadline_optimization', 
  RESOURCE_ALLOCATION: 'resource_allocation',
  WORKFLOW_IMPROVEMENT: 'workflow_improvement',
  PRIORITY_ADJUSTMENT: 'priority_adjustment',
  COLLABORATION_ENHANCEMENT: 'collaboration_enhancement',
  AUTOMATION_OPPORTUNITY: 'automation_opportunity',
  SKILL_DEVELOPMENT: 'skill_development'
};

// Suggestion Priority Levels
const PRIORITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// Main AI Task Suggestions Component
export const AITaskSuggestions = ({ 
  entityType = 'course',
  entityId,
  className = '',
  compact = false,
  autoRefresh = true
}) => {
  const queryClient = useQueryClient();
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Fetch AI suggestions
  const { data: suggestionsData, isLoading, refetch } = useQuery({
    queryKey: ['ai-suggestions', entityType, entityId],
    queryFn: () => aiSuggestions.getForEntity(entityType, entityId),
    enabled: !!entityId,
    refetchInterval: autoRefresh ? 300000 : false, // 5 minutes
  });

  // Generate new suggestions mutation
  const generateSuggestionsMutation = useMutation({
    mutationFn: () => aiSuggestions.generate(entityType, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries(['ai-suggestions', entityType, entityId]);
      toast.success('New suggestions generated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to generate suggestions');
    },
  });

  // Accept suggestion mutation
  const acceptSuggestionMutation = useMutation({
    mutationFn: aiSuggestions.accept,
    onSuccess: () => {
      queryClient.invalidateQueries(['ai-suggestions']);
      queryClient.invalidateQueries(['tasks']);
      queryClient.invalidateQueries(['courses']);
      toast.success('Suggestion applied successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to apply suggestion');
    },
  });

  // Rate suggestion mutation
  const rateSuggestionMutation = useMutation({
    mutationFn: ({ id, rating, feedback }) => aiSuggestions.rate(id, { rating, feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries(['ai-suggestions']);
      toast.success('Feedback submitted');
    },
  });

  const suggestions = suggestionsData?.data || [];
  const groupedSuggestions = groupSuggestionsByType(suggestions);

  if (compact) {
    return (
      <CompactAISuggestions
        suggestions={suggestions}
        isLoading={isLoading}
        onRefresh={() => generateSuggestionsMutation.mutate()}
        onAccept={(suggestion) => acceptSuggestionMutation.mutate(suggestion.id)}
        className={className}
      />
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                AI Suggestions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Smart recommendations to optimize your workflow
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => generateSuggestionsMutation.mutate()}
              disabled={generateSuggestionsMutation.isPending}
              className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${generateSuggestionsMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {suggestions.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {suggestions.filter(s => s.priority === PRIORITY_LEVELS.HIGH).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">High Priority</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {suggestions.filter(s => s.status === 'accepted').length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Applied</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(suggestions.reduce((acc, s) => acc + (s.confidence_score || 0), 0) / suggestions.length) || 0}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg Confidence</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <SuggestionsLoader />
        ) : suggestions.length === 0 ? (
          <EmptyState onGenerate={() => generateSuggestionsMutation.mutate()} />
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSuggestions).map(([type, typeSuggestions]) => (
              <SuggestionTypeSection
                key={type}
                type={type}
                suggestions={typeSuggestions}
                onAccept={(suggestion) => acceptSuggestionMutation.mutate(suggestion.id)}
                onRate={(suggestion, rating, feedback) => 
                  rateSuggestionMutation.mutate({ id: suggestion.id, rating, feedback })
                }
                onViewDetails={setSelectedSuggestion}
              />
            ))}
          </div>
        )}
      </div>

      {/* Suggestion Details Modal */}
      {selectedSuggestion && (
        <SuggestionDetailsModal
          suggestion={selectedSuggestion}
          onClose={() => setSelectedSuggestion(null)}
          onAccept={(suggestion) => acceptSuggestionMutation.mutate(suggestion.id)}
          onRate={(rating, feedback) => 
            rateSuggestionMutation.mutate({ 
              id: selectedSuggestion.id, 
              rating, 
              feedback 
            })
          }
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <AISettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};

// Group suggestions by type
const groupSuggestionsByType = (suggestions) => {
  return suggestions.reduce((groups, suggestion) => {
    const type = suggestion.type || 'general';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(suggestion);
    return groups;
  }, {});
};

// Suggestion Type Section
const SuggestionTypeSection = ({ 
  type, 
  suggestions, 
  onAccept, 
  onRate, 
  onViewDetails 
}) => {
  const typeConfig = getSuggestionTypeConfig(type);
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
            {React.cloneElement(typeConfig.icon, { 
              className: `w-5 h-5 ${typeConfig.iconColor}` 
            })}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {typeConfig.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <ArrowRight className={`w-5 h-5 text-gray-400 transform transition-transform ${
          isExpanded ? 'rotate-90' : ''
        }`} />
      </button>
      
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={onAccept}
              onRate={onRate}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Individual Suggestion Card
const SuggestionCard = ({ suggestion, onAccept, onRate, onViewDetails }) => {
  const [showRating, setShowRating] = useState(false);
  const typeConfig = getSuggestionTypeConfig(suggestion.type);
  
  const getPriorityColor = (priority) => {
    switch (priority) {
      case PRIORITY_LEVELS.HIGH:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case PRIORITY_LEVELS.MEDIUM:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
  };

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              getPriorityColor(suggestion.priority)
            }`}>
              {suggestion.priority?.toUpperCase() || 'MEDIUM'}
            </span>
            
            {suggestion.confidence_score && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {Math.round(suggestion.confidence_score)}% confidence
              </span>
            )}
            
            {suggestion.estimated_impact && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                <TrendingUp className="w-3 h-3 mr-1" />
                {suggestion.estimated_impact}
              </span>
            )}
          </div>
          
          <h4 className="font-medium text-gray-900 dark:text-white mb-1">
            {suggestion.title}
          </h4>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {suggestion.description}
          </p>
          
          {suggestion.action_items && suggestion.action_items.length > 0 && (
            <div className="mb-3">
              <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Recommended Actions:
              </h5>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {suggestion.action_items.slice(0, 3).map((item, index) => (
                  <li key={index} className="flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
                {suggestion.action_items.length > 3 && (
                  <li className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                      onClick={() => onViewDetails(suggestion)}>
                    +{suggestion.action_items.length - 3} more actions...
                  </li>
                )}
              </ul>
            </div>
          )}
          
          {suggestion.estimated_time_savings && (
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Saves ~{suggestion.estimated_time_savings}</span>
              </div>
              {suggestion.affects_tasks_count && (
                <div className="flex items-center space-x-1">
                  <Target className="w-3 h-3" />
                  <span>Affects {suggestion.affects_tasks_count} tasks</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          {suggestion.status !== 'accepted' && (
            <button
              onClick={() => onAccept(suggestion)}
              className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
            >
              <Plus className="w-3 h-3" />
              <span>Apply</span>
            </button>
          )}
          
          <button
            onClick={() => onViewDetails(suggestion)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Details
          </button>
          
          <button
            onClick={() => setShowRating(!showRating)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {showRating && (
        <SuggestionRating
          onRate={(rating, feedback) => {
            onRate(suggestion, rating, feedback);
            setShowRating(false);
          }}
          onCancel={() => setShowRating(false)}
        />
      )}
    </div>
  );
};

// Suggestion Rating Component
const SuggestionRating = ({ onRate, onCancel }) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    if (rating > 0) {
      onRate(rating, feedback);
    }
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-sm text-gray-700 dark:text-gray-300">Rate this suggestion:</span>
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => setRating(value)}
              className={`w-6 h-6 rounded-full border-2 ${
                rating >= value
                  ? 'bg-yellow-400 border-yellow-400'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <span className="text-xs">★</span>
            </button>
          ))}
        </div>
      </div>
      
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional feedback..."
        className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        rows={2}
      />
      
      <div className="flex items-center justify-end space-x-2 mt-2">
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

// Compact AI Suggestions
const CompactAISuggestions = ({ 
  suggestions, 
  isLoading, 
  onRefresh, 
  onAccept, 
  className 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const highPrioritySuggestions = suggestions.filter(s => s.priority === PRIORITY_LEVELS.HIGH);

  if (!isExpanded) {
    return (
      <div className={`bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg p-4 text-white ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">AI Suggestions</h3>
              <p className="text-sm opacity-90">
                {highPrioritySuggestions.length} high priority recommendations
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm hover:bg-opacity-30"
          >
            View All
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">AI Suggestions</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="p-4">
            <SuggestionsLoader compact />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No suggestions available
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {suggestions.slice(0, 5).map((suggestion) => (
              <div key={suggestion.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {suggestion.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {suggestion.description}
                    </p>
                  </div>
                  <button
                    onClick={() => onAccept(suggestion)}
                    className="ml-2 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Suggestion Details Modal
const SuggestionDetailsModal = ({ suggestion, onClose, onAccept, onRate }) => {
  const typeConfig = getSuggestionTypeConfig(suggestion.type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
              {React.cloneElement(typeConfig.icon, { 
                className: `w-6 h-6 ${typeConfig.iconColor}` 
              })}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {suggestion.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {typeConfig.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
            <p className="text-gray-600 dark:text-gray-400">{suggestion.description}</p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {Math.round(suggestion.confidence_score)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Confidence</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {suggestion.estimated_time_savings || 'N/A'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Time Savings</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {suggestion.estimated_impact || 'Medium'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Impact</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {suggestion.affects_tasks_count || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Tasks Affected</div>
            </div>
          </div>

          {/* Action Items */}
          {suggestion.action_items && suggestion.action_items.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Recommended Actions
              </h3>
              <div className="space-y-2">
                {suggestion.action_items.map((item, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Context */}
          {suggestion.context && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Context</h3>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">{suggestion.context}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Close
          </button>
          {suggestion.status !== 'accepted' && (
            <button
              onClick={() => {
                onAccept(suggestion);
                onClose();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Apply Suggestion
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// AI Settings Modal
const AISettingsModal = ({ onClose }) => {
  const [settings, setSettings] = useState({
    autoGenerate: true,
    includeTimeTracking: true,
    includeCollaboration: true,
    minConfidenceScore: 70,
    maxSuggestions: 20,
    notificationEnabled: true
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            AI Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Auto Generate */}
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Auto-generate suggestions
            </span>
            <input
              type="checkbox"
              checked={settings.autoGenerate}
              onChange={(e) => setSettings(prev => ({ ...prev, autoGenerate: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          {/* Minimum Confidence */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
              Minimum confidence score: {settings.minConfidenceScore}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.minConfidenceScore}
              onChange={(e) => setSettings(prev => ({ ...prev, minConfidenceScore: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>

          {/* Max Suggestions */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
              Maximum suggestions: {settings.maxSuggestions}
            </label>
            <input
              type="range"
              min="5"
              max="50"
              value={settings.maxSuggestions}
              onChange={(e) => setSettings(prev => ({ ...prev, maxSuggestions: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>

          {/* Include options */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white">Include in analysis:</h4>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Time tracking data</span>
              <input
                type="checkbox"
                checked={settings.includeTimeTracking}
                onChange={(e) => setSettings(prev => ({ ...prev, includeTimeTracking: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Collaboration patterns</span>
              <input
                type="checkbox"
                checked={settings.includeCollaboration}
                onChange={(e) => setSettings(prev => ({ ...prev, includeCollaboration: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// Empty State
const EmptyState = ({ onGenerate }) => {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <Brain className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No suggestions yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Generate AI-powered suggestions to optimize your workflow
      </p>
      <button
        onClick={onGenerate}
        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
      >
        Generate Suggestions
      </button>
    </div>
  );
};

// Suggestions Loader
const SuggestionsLoader = ({ compact = false }) => {
  const items = compact ? 3 : 5;
  
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(items)].map((_, i) => (
        <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="flex space-x-2">
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Get suggestion type configuration
const getSuggestionTypeConfig = (type) => {
  const configs = {
    [SUGGESTION_TYPES.TASK_BREAKDOWN]: {
      title: 'Task Breakdown',
      icon: <Target />,
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    [SUGGESTION_TYPES.DEADLINE_OPTIMIZATION]: {
      title: 'Deadline Optimization',
      icon: <Calendar />,
      bgColor: 'bg-orange-100 dark:bg-orange-900',
      iconColor: 'text-orange-600 dark:text-orange-400'
    },
    [SUGGESTION_TYPES.RESOURCE_ALLOCATION]: {
      title: 'Resource Allocation',
      icon: <Users />,
      bgColor: 'bg-green-100 dark:bg-green-900',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    [SUGGESTION_TYPES.WORKFLOW_IMPROVEMENT]: {
      title: 'Workflow Improvement',
      icon: <TrendingUp />,
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    [SUGGESTION_TYPES.AUTOMATION_OPPORTUNITY]: {
      title: 'Automation Opportunities',
      icon: <Zap />,
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      iconColor: 'text-yellow-600 dark:text-yellow-400'
    },
    default: {
      title: 'General Suggestion',
      icon: <Lightbulb />,
      bgColor: 'bg-gray-100 dark:bg-gray-900',
      iconColor: 'text-gray-600 dark:text-gray-400'
    }
  };

  return configs[type] || configs.default;
};

export default AITaskSuggestions;