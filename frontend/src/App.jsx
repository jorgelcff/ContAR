import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import ViewerPage from './pages/ViewerPage';
import LoginPage from './pages/LoginPage';
import StoriesPage from './pages/StoriesPage';
import ScenesPage from './pages/ScenesPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import AccountPage from './pages/AccountPage';
import StoryViewerPage from './pages/StoryViewerPage';
import ARPage from './pages/ARPage';
import WelcomePage from './pages/WelcomePage';
import LandingPage from './pages/LandingPage';
import { useAuth } from './auth/AuthContext';
import { ToastProvider } from './context/ToastContext';
import './i18n';

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


export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
          path="/scenes"
          element={(
            <ProtectedRoute>
              <ScenesPage />
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
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email"   element={<VerifyEmailPage />} />
        <Route
          path="/account"
          element={(
            <ProtectedRoute>
              <AccountPage />
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
