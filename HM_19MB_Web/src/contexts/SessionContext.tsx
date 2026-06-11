import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessionApi } from '../services/api';
import { SessionContext, type SessionContextValue } from './session-context';

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [currentSessionId, setCurrentSessionIdState] = useState<number | null>(null);
  const {
    data: sessions = [],
    isFetching: loadingSessions,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const response = await sessionApi.getList();
      return response.data;
    },
  });

  const setCurrentSessionId = useCallback((sessionId: number | null) => {
    setCurrentSessionIdState(sessionId);
  }, []);

  const refreshSessions = useCallback(async () => {
    await refetchSessions();
  }, [refetchSessions]);

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
