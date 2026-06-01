import { createContext } from 'react';

export interface SessionContextValue {
  currentSessionId: number | null;
  setCurrentSessionId: (sessionId: number | null) => void;
}

export const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);
