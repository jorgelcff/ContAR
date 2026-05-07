import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import ViewerPage from './pages/ViewerPage';
import LoginPage from './pages/LoginPage';
import StoriesPage from './pages/StoriesPage';
import StoryViewerPage from './pages/StoryViewerPage';
import ARPage from './pages/ARPage';
import WelcomePage from './pages/WelcomePage';
import { useAuth } from './auth/AuthContext';
import { ToastProvider } from './context/ToastContext';
import './i18n';

const ONBOARDING_KEY = 'avaturn:onboarding:done';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-gray-950 text-gray-300 flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function HomeRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-gray-950 text-gray-300 flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // First-time users see the welcome screen; returning users go straight to stories.
  const isNew = !localStorage.getItem(ONBOARDING_KEY);
  return <Navigate to={isNew ? '/welcome' : '/stories'} replace />;
}

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/stories"
          element={(
            <ProtectedRoute>
              <StoriesPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/editor"
          element={(
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          )}
        />
        <Route path="/scene/:id" element={<ViewerPage />} />
        <Route path="/story/:id" element={<StoryViewerPage />} />
        <Route path="/story" element={<Navigate to="/" replace />} />
        <Route path="/scene" element={<Navigate to="/" replace />} />
        <Route path="/ar" element={<ARPage />} />
        <Route
          path="/welcome"
          element={(
            <ProtectedRoute>
              <WelcomePage />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
