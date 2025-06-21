import React from 'react';

function TestWorkflowPage() {
  console.log('TestWorkflowPage rendered');
  
  return (
    <div className="h-screen flex items-center justify-center bg-green-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-green-800">Test Workflow Page</h1>
        <p className="text-green-600 mt-2">This is a simple test page to verify routing works</p>
      </div>
    </div>
  );
}

export default TestWorkflowPage;