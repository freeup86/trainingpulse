import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../hooks/useAuth.jsx';
import { cn } from '../../lib/utils';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const [sidebarVisible, setSidebarVisible] = useState(true); // Desktop sidebar visibility
  const { user } = useAuth();

  if (!user) {
    return null; // This will be handled by route protection
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar with adjacent toggle button */}
      <div className="relative flex">
        <Sidebar 
          isOpen={sidebarOpen}
          isVisible={sidebarVisible}
          onClose={() => setSidebarOpen(false)}
        />
        
        {/* Desktop sidebar toggle button - positioned right next to sidebar */}
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className={cn(
            "hidden md:flex items-center justify-center w-6 h-12 bg-white dark:bg-gray-800 border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
            "absolute top-20 z-30",
            sidebarVisible ? "left-64" : "left-0"
          )}
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
        >
          <div className={cn(
            "transition-transform duration-200",
            !sidebarVisible && "rotate-180"
          )}>
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </button>
      </div>

      {/* Main content */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-200 ease-in-out",
        !sidebarVisible && "md:ml-0"
      )}>
        {/* Header */}
        <Header 
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}