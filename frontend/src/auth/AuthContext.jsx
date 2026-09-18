/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { classifyAuthFailure, retryDelay, EXPIRED } from './sessionRecovery';
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
  // The server is not answering, but the session is probably fine. Kept apart
  // from "not signed in" so the app can wait instead of throwing someone out.
  const [isReconnecting, setIsReconnecting] = useState(false);
  // The server said this token is no good. Only a 401 sets this.
  const [sessionExpired, setSessionExpired] = useState(false);

  // One session check at a time. The waiting screen polls while it is up and
  // there is a button on it too, so without this a second loop starts on top
  // of the first and they race each other's state.
  const inFlightRef = useRef(false);

  const loadUser = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) { setIsLoading(false); return; }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {

    // Every failure used to delete the token, so a cold start on a suspended
    // host — a timeout, a 502 while it boots — signed people out and threw
    // away the token, which meant reloading did not help either.
    for (let attempt = 0; ; attempt += 1) {
      try {
        const data = await getCurrentUser();
        setUser(data?.user || null);
        setIsReconnecting(false);
        setSessionExpired(false);
        setIsLoading(false);
        return;
      } catch (err) {
        if (classifyAuthFailure(err) === EXPIRED) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          setUser(null);
          setSessionExpired(true);
          setIsReconnecting(false);
          setIsLoading(false);
          return;
        }

        const wait = retryDelay(attempt);
        if (wait === null) {
          // Out of attempts, but still not the server's word — keep the token
          // so a reload, or the host finally waking, picks the session back up.
          setUser(null);
          setIsReconnecting(true);
          setIsLoading(false);
          return;
        }

        setIsReconnecting(true);
        setIsLoading(false);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated:  Boolean(user),
      isReconnecting,
      sessionExpired,
      /** Try the session check again — the "try now" on the waiting screen. */
      retryConnection: loadUser,
      acknowledgeExpiry: () => setSessionExpired(false),
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
    [user, isLoading, isReconnecting, sessionExpired, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
