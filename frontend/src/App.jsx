import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ThemeProvider } from './contexts/ThemeContext';
import { CompactModeProvider } from './contexts/CompactModeContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import TeamsPage from './pages/TeamsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import WorkflowsPage from './pages/WorkflowsPage';
import DataManagementPage from './pages/DataManagementPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import AssignmentsPage from './pages/AssignmentsPage';
import CreateCoursePage from './pages/CreateCoursePage';
import EditCoursePage from './pages/EditCoursePage';
import CreateTeamPage from './pages/CreateTeamPage';
import EditTeamPage from './pages/EditTeamPage';
import WorkflowCreatePage from './pages/WorkflowCreatePage';
import WorkflowCreatePageSimple from './pages/WorkflowCreatePageSimple';
import WorkflowCreatePageDebug from './pages/WorkflowCreatePageDebug';
import TestWorkflowPage from './pages/TestWorkflowPage';
import TestPage from './pages/TestPage';
import MinimalPage from './pages/MinimalPage';
import AdminPage from './pages/AdminPage';
import ProgramsPage from './pages/ProgramsPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import ProgramSettingsPage from './pages/ProgramSettingsPage';
// import ResourceManagementPage from './pages/ResourceManagementPage';
// import ChatPage from './pages/ChatPage';
// import CustomDashboardPage from './pages/CustomDashboardPage';
// import AIInsightsPage from './pages/AIInsightsPage';
import CoursesPageNew from './pages/CoursesPageNew';
// import FeaturesShowcasePage from './pages/FeaturesShowcasePage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Public Route Component (redirect if authenticated)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <ThemeProvider>
            <CompactModeProvider>
              <div className="App">
                <Routes>
                  {/* Public routes */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <LoginPage />
                      </PublicRoute>
                    }
                  />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="courses" element={<CoursesPageNew />} />
                    <Route path="courses/create" element={<CreateCoursePage />} />
                    <Route path="courses/:id" element={<CourseDetailPage />} />
                    <Route path="courses/:id/edit" element={<EditCoursePage />} />
                    <Route path="lists/:listId/courses" element={<CoursesPage />} />
                    <Route path="lists/:listId/courses/create" element={<CreateCoursePage />} />
                    <Route path="programs" element={<ProgramsPage />} />
                    <Route path="programs/:id" element={<ProgramDetailPage />} />
                    <Route path="programs/:id/settings" element={<ProgramSettingsPage />} />
                    <Route path="assignments" element={<AssignmentsPage />} />
                    <Route path="teams" element={<TeamsPage />} />
                    <Route path="teams/create" element={<CreateTeamPage />} />
                    <Route path="teams/:id/edit" element={<EditTeamPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="workflows" element={<WorkflowsPage />} />
                    <Route path="workflows/create" element={<WorkflowCreatePage />} />
                    <Route path="workflows/:id/edit" element={<WorkflowCreatePage />} />
                    <Route path="workflows/test" element={<TestWorkflowPage />} />
                    <Route path="bulk" element={<DataManagementPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    {/* <Route path="resources" element={<ResourceManagementPage />} /> */}
                    {/* <Route path="chat" element={<ChatPage />} /> */}
                    {/* <Route path="custom-dashboard" element={<CustomDashboardPage />} /> */}
                    {/* <Route path="ai-insights" element={<AIInsightsPage />} /> */}
                    {/* <Route path="features" element={<FeaturesShowcasePage />} /> */}
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="test" element={<TestPage />} />
                    <Route path="minimal" element={<MinimalPage />} />
                  </Route>

                  {/* Catch all route */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>

                {/* Toast notifications */}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#363636',
                      color: '#fff',
                    },
                    success: {
                      duration: 3000,
                      iconTheme: {
                        primary: '#10b981',
                        secondary: '#fff',
                      },
                    },
                    error: {
                      duration: 5000,
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                      },
                    },
                  }}
                />
              </div>
            </CompactModeProvider>
          </ThemeProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
