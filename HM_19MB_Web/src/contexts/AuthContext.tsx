import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, type AuthUser } from '../services/api';
import { AuthContext, type AuthContextValue } from './auth-context';

const TOKEN_KEY = 'hm19mb.auth.token';
const USER_KEY = 'hm19mb.auth.user';

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const persistAuth = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.me();
        if (!cancelled) {
          localStorage.setItem(USER_KEY, JSON.stringify(response.data));
          setUser(response.data);
        }
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void refreshUser();

    return () => {
      cancelled = true;
    };
  }, [clearAuth, token]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login({ email, password });
      persistAuth(response.data.token, response.data.user);
    },
    [persistAuth]
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const response = await authApi.register({ fullName, email, password });
      persistAuth(response.data.token, response.data.user);
    },
    [persistAuth]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: token !== null && user !== null,
      login,
      register,
      logout,
    }),
    [loading, login, logout, register, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
