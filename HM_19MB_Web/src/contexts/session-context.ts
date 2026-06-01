import { createContext } from 'react';
import type { PhienDoSummary } from '../types/models';

export interface SessionContextValue {
  currentSessionId: number | null;
  setCurrentSessionId: (sessionId: number | null) => void;
  sessions: PhienDoSummary[];
  loadingSessions: boolean;
  refreshSessions: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);
