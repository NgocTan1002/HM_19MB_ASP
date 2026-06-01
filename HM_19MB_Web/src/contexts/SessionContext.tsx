import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SessionContext, type SessionContextValue } from './session-context';

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [currentSessionId, setCurrentSessionIdState] = useState<number | null>(null);

  const setCurrentSessionId = useCallback((sessionId: number | null) => {
    setCurrentSessionIdState(sessionId);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      currentSessionId,
      setCurrentSessionId,
    }),
    [currentSessionId, setCurrentSessionId]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}
