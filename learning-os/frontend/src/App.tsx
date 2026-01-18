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
import { useAuthStore } from './stores/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { ToastContainer } from './components/ui/Toast';

// Loading Screen
function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0b0f14' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full border-3 border-t-transparent animate-spin"
          style={{ borderColor: '#4285f4', borderTopColor: 'transparent' }}
        />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// Protected Route wrapper - includes Layout
function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

  // Wrap all protected routes with Layout (sidebar, header, nav)
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
