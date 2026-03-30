import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { api, fetchMe, login, register, type AuthTokenResponse } from '../api/client';

type Me = {
  id: string;
  email: string;
  role: 'teacher' | 'student';
  profile?: { displayName?: string };
};

type AuthState = {
  user: Me | null;
  loading: boolean;
  setTokens: (t: AuthTokenResponse) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    role: 'teacher' | 'student',
  ) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const setTokens = useCallback((t: AuthTokenResponse) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me as Me);
    } catch {
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const t = await login(email, password);
      setTokens(t);
      await refreshUser();
    },
    [refreshUser, setTokens],
  );

  const signUp = useCallback(
    async (email: string, password: string, role: 'teacher' | 'student') => {
      const t = await register(email, password, role);
      setTokens(t);
      await refreshUser();
    },
    [refreshUser, setTokens],
  );

  const signOut = useCallback(() => {
    const rt = localStorage.getItem('refreshToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    void api.post('/auth/logout', { refreshToken: rt }).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setTokens,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [user, loading, setTokens, signIn, signUp, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
