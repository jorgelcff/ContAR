import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import ViewerPage from './pages/ViewerPage';
import LoginPage from './pages/LoginPage';
import StoriesPage from './pages/StoriesPage';
import StoryViewerPage from './pages/StoryViewerPage';
import ARPage from './pages/ARPage';
import { useAuth } from './auth/AuthContext';
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

function HomeRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-gray-950 text-gray-300 flex items-center justify-center">Loading...</div>;
  }

  return <Navigate to={isAuthenticated ? '/stories' : '/login'} replace />;
}

export default function App() {
  return (
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
        <Route path="/ar" element={<ARPage />} />
      </Routes>
    </BrowserRouter>
  );
}
