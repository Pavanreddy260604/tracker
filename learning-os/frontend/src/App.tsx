import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { DSATracking } from './pages/DSATracking';
import { DSAProblemDetail } from './pages/DSAProblemDetail';
import { BackendTopics } from './pages/BackendTopics';
import { BackendTopicDetail } from './pages/BackendTopicDetail';
import { Projects } from './pages/Projects';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Roadmap } from './pages/Roadmap/Roadmap';
import { InterviewHistory } from './pages/Interview/InterviewHistory';
import { InterviewSetup } from './pages/Interview/InterviewSetup';
import { InterviewRoom } from './pages/Interview/InterviewRoom';
import { ScriptWriterPage } from './pages/ScriptWriter';
import ChatPage from './pages/ChatPage';
import { useAuthStore } from './stores/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { ToastContainer } from './components/ui/Toast';
import { AIProvider } from './contexts/AIContext';
import { GlobalAIWidget } from './components/GlobalAIWidget';

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
  const { isAuthenticated, isLoading, checkAuth, token } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
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
  }, [token]);

  if (isChecking || isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!useLayout) {
    return <>{children}</>;
  }

  return <Layout>{children}</Layout>;
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
  return (
    <ErrorBoundary>
      <AIProvider>
        <ToastContainer />
        <BrowserRouter>
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

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dsa"
              element={
                <ProtectedRoute>
                  <DSATracking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/backend"
              element={
                <ProtectedRoute>
                  <BackendTopics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/roadmap"
              element={
                <ProtectedRoute>
                  <Roadmap />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Projects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dsa/:id"
              element={
                <ProtectedRoute>
                  <DSAProblemDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/backend/:id"
              element={
                <ProtectedRoute>
                  <BackendTopicDetail />
                </ProtectedRoute>
              }
            />

            {/* Interview Simulator Routes */}
            <Route
              path="/interview"
              element={
                <ProtectedRoute>
                  <InterviewHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/setup"
              element={
                <ProtectedRoute>
                  <InterviewSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/:id"
              element={
                <ProtectedRoute>
                  <InterviewRoom />
                </ProtectedRoute>
              }
            />

            {/* Script Writer Layout-less Route (Opens in new window style) */}
            <Route
              path="/script-writer"
              element={
                <ProtectedRoute useLayout={false}>
                  <ScriptWriterPage />
                </ProtectedRoute>
              }
            />

            {/* AI Chat Layout-less Route */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute useLayout={false}>
                  <ChatPage />
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
