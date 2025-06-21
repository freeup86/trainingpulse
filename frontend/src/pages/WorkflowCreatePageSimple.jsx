import React from 'react';
import { useParams } from 'react-router-dom';

function WorkflowCreatePageSimple() {
  console.log('WorkflowCreatePageSimple rendered');
  const { id } = useParams();
  
  return (
    <div className="h-screen flex items-center justify-center bg-blue-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-blue-800">Simple Workflow Create Page</h1>
        <p className="text-blue-600 mt-2">Template ID: {id}</p>
        <p className="text-blue-500 mt-1">This is a minimal version without imports that might cause issues</p>
      </div>
    </div>
  );
}

export default WorkflowCreatePageSimple;