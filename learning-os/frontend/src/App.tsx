import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { activityTracker } from './services/activity.tracker';

// Component to track route changes
function NavigationTracker() {
  const location = useLocation();

  useEffect(() => {
    activityTracker.logNavigation(location.pathname);
  }, [location]);

  return null;
}

// ─── Route-level code splitting (bundle-dynamic-imports) ───
// Auth pages loaded eagerly (small, needed immediately)
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

// Heavy pages loaded lazily — each becomes its own chunk
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const DSATracking = lazy(() => import('./pages/DSATracking').then(m => ({ default: m.DSATracking })));
const DSAProblemDetail = lazy(() => import('./pages/DSAProblemDetail').then(m => ({ default: m.DSAProblemDetail })));
const BackendTopics = lazy(() => import('./pages/BackendTopics').then(m => ({ default: m.BackendTopics })));
const Projects = lazy(() => import('./pages/Projects').then(m => ({ default: m.Projects })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Roadmap = lazy(() => import('./pages/Roadmap/Roadmap').then(m => ({ default: m.Roadmap })));
const InterviewHistory = lazy(() => import('./pages/Interview/InterviewHistory').then(m => ({ default: m.InterviewHistory })));
const MockTestHistory = lazy(() => import('./pages/Interview/MockTestHistory').then(m => ({ default: m.MockTestHistory })));
const InterviewSetup = lazy(() => import('./pages/Interview/InterviewSetup').then(m => ({ default: m.InterviewSetup })));
const InterviewSystemCheck = lazy(() => import('./pages/Interview/components/InterviewSystemCheck').then(m => ({ default: m.InterviewSystemCheck })));
const InterviewRoom = lazy(() => import('./pages/Interview/InterviewRoom').then(m => ({ default: m.InterviewRoom })));
const ScriptWriterDashboard = lazy(() => import('./pages/ScriptWriter/ScriptWriterDashboard').then(m => ({ default: m.ScriptWriterDashboard })));
const ScriptWriterInfinite = lazy(() => import('./pages/ScriptWriter/ScriptWriterInfinite').then(m => ({ default: m.ScriptWriterInfinite })));
const MasterScriptReaderPage = lazy(() => import('./pages/ScriptWriter/MasterScriptReaderPage').then(m => ({ default: m.MasterScriptReaderPage })));
const ProjectStudyDetail = lazy(() => import('./pages/ProjectStudyDetail').then(m => ({ default: m.ProjectStudyDetail })));
const BackendTopicDetail = lazy(() => import('./pages/BackendTopicDetail').then(m => ({ default: m.BackendTopicDetail })));
const ChatPage = lazy(() => import('./pages/ChatPage'));


import { useAuthStore } from './stores/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { ToastContainer } from './components/ui/Toast';
import { VerificationBanner } from './components/ui/VerificationBanner';
import { AIProvider } from './contexts/AIContext';
import { GlobalAIWidget } from './components/GlobalAIWidget';
import { useThemeStore } from './stores/themeStore';
// Removed ThemeProvider in favor of useThemeStore (Zustand)

// Loading Screen
function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--console-bg)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full border-3 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent-primary-dark)', borderTopColor: 'transparent' }}
        />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children, useLayout = true }: { children: React.ReactNode; useLayout?: boolean }) {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(!isAuthenticated);
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      setIsChecking(false);
      return;
    }

    let mounted = true;

    const verify = async () => {
      await checkAuth();
      if (mounted) {
        setIsChecking(false);
      }
    };

    verify();

    return () => {
      mounted = false;
    };
  }, [checkAuth]);

  if (isChecking) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!useLayout) {
    return (
      <>
        <VerificationBanner />
        {children}
      </>
    );
  }

  return (
    <Layout banner={<VerificationBanner />}>
      {children}
    </Layout>
  );
}

// Public Route wrapper
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { theme } = useThemeStore();

  // Ensure theme class is on root (redundant but safe since store does it on applyTheme)
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <AIProvider>
        <ToastContainer />
        <BrowserRouter>
          <NavigationTracker />
          <Routes>
            {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              }
            />

            {/* Protected routes - lazy loaded with Suspense */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Dashboard />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dsa"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <DSATracking />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backend"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <BackendTopics />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roadmap"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Roadmap />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Projects />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Analytics />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <Settings />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dsa/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <DSAProblemDetail />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backend/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <BackendTopicDetail />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <ProjectStudyDetail />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Interview Simulator Routes - lazy loaded */}
            <Route
              path="/interview"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <InterviewHistory />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/history"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <MockTestHistory />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/setup"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <InterviewSetup />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/:id"
              element={
                <ProtectedRoute useLayout={false}>
                  <Suspense fallback={<LoadingScreen />}>
                    <InterviewSystemCheck />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/:id/room"
              element={
                <ProtectedRoute useLayout={false}>
                  <Suspense fallback={<LoadingScreen />}>
                    <InterviewRoom />
                  </Suspense>
                </ProtectedRoute>
              }
            />


            {/* Script Writer Routes - lazy loaded, no layout */}
            <Route
              path="/script-writer"
              element={
                <ProtectedRoute useLayout={false}>
                  <Suspense fallback={<LoadingScreen />}>
                    <ScriptWriterDashboard />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/script-writer/master-script/:scriptId"
              element={
                <ProtectedRoute useLayout={false}>
                  <Suspense fallback={<LoadingScreen />}>
                    <MasterScriptReaderPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/script-writer/:projectId/:sceneId?"
              element={
                <ProtectedRoute useLayout={false}>
                  <Suspense fallback={<LoadingScreen />}>
                    <ScriptWriterInfinite />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* AI Chat Route - lazy loaded, no layout */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute useLayout={false}>
                  <Suspense fallback={<LoadingScreen />}>
                    <ChatPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <GlobalAIWidget />
        </BrowserRouter>
      </AIProvider>
    </ErrorBoundary>
  );
}

export default App;
