import React, { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { GuestProvider } from './auth/GuestContext';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Landing and login stay eager: they are the first thing an anonymous visitor
// paints, and they are light. Every other route is split out — between them
// they pull in three.js and its loaders, which anyone opening the landing page
// was downloading before seeing a single 3D scene.
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import { useAuth } from './auth/AuthContext';
import { ToastProvider } from './context/ToastContext';
import './i18n';

const EditorPage        = lazy(() => import('./pages/EditorPage'));
const ViewerPage        = lazy(() => import('./pages/ViewerPage'));
const StoriesPage       = lazy(() => import('./pages/StoriesPage'));
const ScenesPage        = lazy(() => import('./pages/ScenesPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage   = lazy(() => import('./pages/VerifyEmailPage'));
const AccountPage       = lazy(() => import('./pages/AccountPage'));
const StoryViewerPage   = lazy(() => import('./pages/StoryViewerPage'));
const ARPage            = lazy(() => import('./pages/ARPage'));
const WelcomePage       = lazy(() => import('./pages/WelcomePage'));

function RouteFallback() {
  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
    </div>
  );
}

// Derives React Router's basename from Vite's own BASE_URL (set by the
// VITE_BASE_PATH env var / vite.config.js — see there), so the two never
// drift apart. BASE_URL is always trailing-slashed and "/" at the root;
// React Router wants no trailing slash, and undefined (not "") at the root.
const routerBasename = (() => {
  const base = import.meta.env.BASE_URL;
  return base === '/' ? undefined : base.replace(/\/$/, '');
})();

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-dvh bg-gray-950 text-gray-300 flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}


export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename={routerBasename}>
        {/* Inside the router, so the fallback's "back to start" is a real
            navigation and not a full page load. */}
        <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/stories"
            element={
              <ProtectedRoute>
                <StoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scenes"
            element={
              <ProtectedRoute>
                <ScenesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/editor"
            element={
              <ProtectedRoute>
                <GuestProvider>
                  <EditorPage />
                </GuestProvider>
              </ProtectedRoute>
            }
          />
          {/* The same editor with no account behind it. Someone who has just
              watched a story can change the words and hear the character say
              them before being asked for anything. */}
          <Route
            path="/experimentar"
            element={
              <GuestProvider isGuest>
                <EditorPage />
              </GuestProvider>
            }
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route path="/scene/:id" element={<ViewerPage />} />
          <Route path="/story/:id" element={<StoryViewerPage />} />
          <Route path="/story" element={<Navigate to="/" replace />} />
          <Route path="/scene" element={<Navigate to="/" replace />} />
          <Route path="/ar" element={<ARPage />} />
          <Route
            path="/welcome"
            element={
              <ProtectedRoute>
                <WelcomePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ToastProvider>
  );
}
