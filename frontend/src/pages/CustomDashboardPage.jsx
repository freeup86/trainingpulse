import React from 'react';
import { Dashboard } from '../components/Dashboard';

export default function CustomDashboardPage() {
  // You can get dashboardId from URL params or default to a specific dashboard
  const dashboardId = 1; // Default dashboard ID
  
  return <Dashboard dashboardId={dashboardId} />;
}