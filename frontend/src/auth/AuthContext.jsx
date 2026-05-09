import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AUTH_TOKEN_KEY,
  getCurrentUser,
  getStoredAuthToken,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
} from '../api/sceneApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) { setIsLoading(false); return; }
    try {
      const data = await getCurrentUser();
      setUser(data?.user || null);
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated:  Boolean(user),
      emailVerified:    Boolean(user?.emailVerified),

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
      // Re-fetch user from API — used after email verification to refresh emailVerified flag
      async refreshUser() {
        try {
          const data = await getCurrentUser();
          setUser(data?.user || null);
        } catch { /* silently ignore */ }
      },
      async resendVerificationEmail() {
        return resendVerification();
      },
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
