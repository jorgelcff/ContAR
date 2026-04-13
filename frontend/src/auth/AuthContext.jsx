import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AUTH_TOKEN_KEY,
  getCurrentUser,
  getStoredAuthToken,
  loginUser,
  logoutUser,
  registerUser,
} from '../api/sceneApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    getCurrentUser()
      .then((data) => setUser(data?.user || null))
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      async login(email, password) {
        const data = await loginUser(email, password);
        setUser(data?.user || null);
        return data;
      },
      async register(name, email, password) {
        const data = await registerUser(name, email, password);
        setUser(data?.user || null);
        return data;
      },
      logout() {
        logoutUser();
        setUser(null);
      },
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
