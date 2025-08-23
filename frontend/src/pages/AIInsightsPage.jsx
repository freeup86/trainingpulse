import React from 'react';
import { AITaskSuggestions } from '../components/AITaskSuggestions';

export default function AIInsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Insights</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Get AI-powered suggestions to optimize your workflow and productivity
        </p>
      </div>
      
      <AITaskSuggestions 
        entityType="course"
        entityId={null} // Global suggestions
        autoRefresh={true}
      />
    </div>
  );
}