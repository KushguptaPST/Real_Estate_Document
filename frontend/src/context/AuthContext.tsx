import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '@/services/api';
import { getToken, onUnauthorized, setToken } from '@/services/session';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  /** True while an existing session token is being validated on first load. */
  loading: boolean;
  signInWithGoogle: (credential: string, inviteToken?: string) => Promise<void>;
  signInAsDemoAgent: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => getToken() !== null);

  useEffect(() => {
    if (!getToken()) return;
    authApi
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const signInWithGoogle = useCallback(async (credential: string, inviteToken?: string) => {
    const session = await authApi.signInWithGoogle(credential, inviteToken);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const signInAsDemoAgent = useCallback(async () => {
    const session = await authApi.signInAsDemoAgent();
    setToken(session.token);
    setUser(session.user);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    window.google?.accounts.id.disableAutoSelect();
  }, []);

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signInAsDemoAgent, signOut }),
    [user, loading, signInWithGoogle, signInAsDemoAgent, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
