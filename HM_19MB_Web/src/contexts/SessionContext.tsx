import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { sessionApi } from '../services/api';
import type { PhienDoSummary } from '../types/models';
import { SessionContext, type SessionContextValue } from './session-context';

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [currentSessionId, setCurrentSessionIdState] = useState<number | null>(null);
  const [sessions, setSessions] = useState<PhienDoSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const setCurrentSessionId = useCallback((sessionId: number | null) => {
    setCurrentSessionIdState(sessionId);
  }, []);

  const loadSessions = useCallback(
    async (shouldApply: () => boolean = () => true) => {
      await Promise.resolve();

      if (!shouldApply()) {
        return;
      }

      setLoadingSessions(true);

      try {
        const response = await sessionApi.getList();

        if (shouldApply()) {
          setSessions(response.data);
        }
      } catch (error) {
        console.error('[SessionContext] Load sessions failed:', error);
      } finally {
        if (shouldApply()) {
          setLoadingSessions(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const timerId = window.setTimeout(() => {
      void loadSessions(() => !cancelled);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [loadSessions]);

  const refreshSessions = useCallback(async () => {
    await loadSessions();
  }, [loadSessions]);

  const value = useMemo<SessionContextValue>(
    () => ({
      currentSessionId,
      setCurrentSessionId,
      sessions,
      loadingSessions,
      refreshSessions,
    }),
    [
      currentSessionId,
      loadingSessions,
      refreshSessions,
      sessions,
      setCurrentSessionId,
    ]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}
