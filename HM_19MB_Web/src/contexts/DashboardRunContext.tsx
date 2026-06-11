import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ChartDataPoint } from '../components/dashboard/DashboardControls';
import { measurementApi, measurementRunApi } from '../services/api';
import {
  createHubClient,
  type HubConnectionState,
  type MeasurementHubClient,
} from '../services/signalr';
import type {
  MeasurementBlock,
  MeasurementRecord,
  SessionMetadata,
} from '../types/models';
import { useSession } from './useSession';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5135';
const MAX_CHART_POINTS = 720;

interface DashboardRunContextValue {
  currentBlock: MeasurementBlock | null;
  lastReceivedAt: Date | null;
  connectionState: HubConnectionState;
  connectionError: string | null;
  startError: string | null;
  isStartingRun: boolean;
  deviceId: string;
  chartBuffer: ChartDataPoint[];
  showTemperature: boolean;
  showHumidity: boolean;
  isRunActive: boolean;
  setConnectionError: (error: string | null) => void;
  setStartError: (error: string | null) => void;
  setDeviceId: (deviceId: string) => void;
  handleStartRun: (metadata: SessionMetadata) => Promise<void>;
  handleDisconnect: () => void;
  handleReconnect: () => void;
}

interface DashboardRunProviderProps {
  children: ReactNode;
}

const DashboardRunContext = createContext<DashboardRunContextValue | undefined>(
  undefined
);

function isValidNumber(value: number | undefined | null): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function toNullableNumber(value: number | undefined): number | null {
  return isValidNumber(value) ? value : null;
}

function blockToChartDataPoint(block: MeasurementBlock): ChartDataPoint {
  return {
    timestamp: block.timestamp,
    temps: Array.from({ length: 10 }, (_, index) =>
      index < block.probeCount
        ? toNullableNumber(block.probeTemperatures[index])
        : null
    ),
    hums: Array.from({ length: 10 }, (_, index) =>
      index < block.probeCount
        ? toNullableNumber(block.probeHumidities[index])
        : null
    ),
    avgTemp: isValidNumber(block.avgTemperature) ? block.avgTemperature : 0,
    avgHum: toNullableNumber(block.avgHumidity),
  };
}

function appendChartPoint(
  points: ChartDataPoint[],
  block: MeasurementBlock
): ChartDataPoint[] {
  const nextPoints = [...points, blockToChartDataPoint(block)];

  if (nextPoints.length <= MAX_CHART_POINTS) {
    return nextPoints;
  }

  return nextPoints.slice(nextPoints.length - MAX_CHART_POINTS);
}

function recordToChartPoint(record: MeasurementRecord): ChartDataPoint {
  return {
    timestamp: record.thoiGianDo,
    temps: Array.from({ length: 10 }, (_, index) =>
      record.hasNhietDo[index] ? record.nhietDo[index] : null
    ),
    hums: Array.from({ length: 10 }, (_, index) =>
      record.hasDoAm[index] ? record.doAm[index] : null
    ),
    avgTemp: record.nhietDoTb,
    avgHum: record.hasDoAmTb ? record.doAmTb : null,
  };
}

function hasTemperatureData(block: MeasurementBlock | null): boolean {
  if (block === null) {
    return false;
  }

  return block.probeTemperatures.some((value, index) =>
    index < block.probeCount && isValidNumber(value)
  );
}

function hasHumidityData(block: MeasurementBlock | null): boolean {
  if (block === null) {
    return false;
  }

  return block.probeHumidities.some((value, index) =>
    index < block.probeCount && isValidNumber(value)
  );
}

function hasTemperatureHistory(points: ChartDataPoint[]): boolean {
  return points.some(point =>
    point.temps.some(value => value !== null && !Number.isNaN(value))
  );
}

function hasHumidityHistory(points: ChartDataPoint[]): boolean {
  return points.some(point =>
    point.hums.some(value => value !== null && !Number.isNaN(value))
  );
}

export function DashboardRunProvider({ children }: DashboardRunProviderProps) {
  const { currentSessionId, refreshSessions, setCurrentSessionId } = useSession();
  const clientRef = useRef<MeasurementHubClient | null>(null);
  const currentSessionIdRef = useRef<number | null>(currentSessionId);
  const activeRunSessionIdRef = useRef<number | null>(null);
  const activeRunDeviceIdRef = useRef<string | null>(null);

  const [currentBlock, setCurrentBlock] = useState<MeasurementBlock | null>(null);
  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(null);
  const [connectionState, setConnectionState] =
    useState<HubConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [deviceId, setDeviceId] = useState('u01');
  const [chartBuffer, setChartBuffer] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const handleMeasurement = useCallback((block: MeasurementBlock) => {
    setCurrentBlock(block);
    setLastReceivedAt(new Date());
    setConnectionError(null);
    setChartBuffer(points => appendChartPoint(points, block));
  }, []);

  const stopClient = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;

    if (client !== null) {
      client.offMeasurement();
      await client.stop();
    }

    const activeRunSessionId = activeRunSessionIdRef.current;
    const activeRunDeviceId = activeRunDeviceIdRef.current;
    activeRunSessionIdRef.current = null;
    activeRunDeviceIdRef.current = null;

    if (activeRunDeviceId !== null) {
      try {
        await measurementRunApi.stop(activeRunDeviceId);
      } catch (err: unknown) {
        console.warn('[Dashboard] Stop measurement device run failed:', err);
      }
    } else if (activeRunSessionId !== null) {
      try {
        await measurementApi.stop(activeRunSessionId);
      } catch (err: unknown) {
        console.warn('[Dashboard] Stop measurement session failed:', err);
      }
    }

    setConnectionState('disconnected');
  }, []);

  const connectClient = useCallback(
    async (sessionId: number) => {
      const previousClient = clientRef.current;
      clientRef.current = null;

      if (previousClient !== null) {
        previousClient.offMeasurement();
        await previousClient.stop();
      }

      setConnectionError(null);
      setConnectionState('connecting');

      const client = createHubClient(API_BASE, {
        onStateChange: setConnectionState,
      });

      clientRef.current = client;
      client.onMeasurement(handleMeasurement);

      try {
        activeRunSessionIdRef.current = sessionId;
        await client.start(sessionId);
      } catch (err: unknown) {
        client.offMeasurement();
        clientRef.current = null;
        activeRunSessionIdRef.current = null;
        setConnectionState('disconnected');
        setConnectionError(
          err instanceof Error ? err.message : 'SignalR connection failed'
        );
        throw err;
      }
    },
    [handleMeasurement]
  );

  useEffect(() => {
    return () => {
      const client = clientRef.current;
      const activeRunSessionId = activeRunSessionIdRef.current;
      const activeRunDeviceId = activeRunDeviceIdRef.current;
      clientRef.current = null;
      activeRunSessionIdRef.current = null;
      activeRunDeviceIdRef.current = null;

      if (client !== null) {
        client.offMeasurement();
        void client.stop();
      }

      if (activeRunDeviceId !== null) {
        void measurementRunApi.stop(activeRunDeviceId);
      } else if (activeRunSessionId !== null) {
        void measurementApi.stop(activeRunSessionId);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHistoricalData(sessionId: number) {
      const isActiveRunSession = sessionId === activeRunSessionIdRef.current;

      if (!isActiveRunSession) {
        setChartBuffer([]);
        setCurrentBlock(null);
        setLastReceivedAt(null);
      }

      try {
        const response = await measurementApi.getBySession(sessionId);

        if (cancelled) {
          return;
        }

        const points = response.data
          .slice(-MAX_CHART_POINTS)
          .map(recordToChartPoint);

        setChartBuffer(currentPoints => {
          if (!isActiveRunSession || currentPoints.length === 0) {
            return points;
          }

          const merged = new Map<string, ChartDataPoint>();
          points.forEach(point => {
            merged.set(point.timestamp, point);
          });
          currentPoints.forEach(point => {
            merged.set(point.timestamp, point);
          });

          return Array.from(merged.values())
            .sort(
              (left, right) =>
                Date.parse(left.timestamp) - Date.parse(right.timestamp)
            )
            .slice(-MAX_CHART_POINTS);
        });
      } catch (err: unknown) {
        if (cancelled) {
          return;
        }

        setConnectionError(
          err instanceof Error
            ? `[History] ${err.message}`
            : '[History] Failed to load measurement history'
        );
      }
    }

    if (currentSessionId !== null) {
      void loadHistoricalData(currentSessionId);
    } else if (activeRunSessionIdRef.current === null) {
      setChartBuffer([]);
      setCurrentBlock(null);
      setLastReceivedAt(null);
    }

    return () => {
      cancelled = true;
    };
  }, [currentSessionId]);

  const handleReconnect = useCallback(() => {
    async function reconnect() {
      const targetSessionId =
        currentSessionIdRef.current ?? activeRunSessionIdRef.current;
      const normalizedDeviceId = deviceId.trim();

      if (targetSessionId === null) {
        setConnectionError('Chua chon phien do de ket noi lai.');
        return;
      }

      if (normalizedDeviceId.length === 0) {
        setConnectionError('Vui long nhap ma thiet bi de ket noi lai.');
        return;
      }

      setConnectionError(null);
      setStartError(null);

      try {
        if (
          activeRunSessionIdRef.current !== null &&
          activeRunSessionIdRef.current !== targetSessionId
        ) {
          await stopClient();
        }

        await measurementRunApi.startExisting(normalizedDeviceId, targetSessionId);
        activeRunSessionIdRef.current = targetSessionId;
        activeRunDeviceIdRef.current = normalizedDeviceId;
        await connectClient(targetSessionId);
      } catch (err: unknown) {
        activeRunSessionIdRef.current = null;
        setConnectionState('disconnected');
        setConnectionError(
          err instanceof Error ? err.message : 'Khong the ket noi lai phien do'
        );
      }
    }

    void reconnect();
  }, [connectClient, deviceId, stopClient]);

  const handleStartRun = useCallback(
    async (metadata: SessionMetadata) => {
      const normalizedDeviceId = deviceId.trim();
      if (normalizedDeviceId.length === 0) {
        setStartError('Vui long nhap ma thiet bi.');
        return;
      }

      setIsStartingRun(true);
      setStartError(null);
      setConnectionError(null);
      let startedDeviceId: string | null = null;

      try {
        await stopClient();

        const response = await measurementRunApi.start(
          normalizedDeviceId,
          metadata
        );
        startedDeviceId = normalizedDeviceId;
        const newSessionId = response.data.sessionId;

        activeRunSessionIdRef.current = newSessionId;
        activeRunDeviceIdRef.current = normalizedDeviceId;
        setCurrentSessionId(newSessionId);
        setChartBuffer([]);
        setCurrentBlock(null);
        setLastReceivedAt(null);
        await refreshSessions();
        await connectClient(newSessionId);
      } catch (err: unknown) {
        activeRunDeviceIdRef.current = null;
        activeRunSessionIdRef.current = null;

        if (startedDeviceId !== null) {
          void measurementRunApi.stop(startedDeviceId);
        }

        setConnectionState('disconnected');
        setStartError(
          err instanceof Error ? err.message : 'Khong the bat dau phien do moi'
        );
      } finally {
        setIsStartingRun(false);
      }
    },
    [
      connectClient,
      deviceId,
      refreshSessions,
      setCurrentSessionId,
      stopClient,
    ]
  );

  const handleDisconnect = useCallback(() => {
    void stopClient();
    setConnectionError(null);
    setStartError(null);
    setCurrentBlock(null);
    setLastReceivedAt(null);
  }, [stopClient]);

  const showTemperature =
    hasTemperatureData(currentBlock) || hasTemperatureHistory(chartBuffer);
  const showHumidity =
    hasHumidityData(currentBlock) || hasHumidityHistory(chartBuffer);
  const isRunActive = connectionState !== 'disconnected';

  const value = useMemo<DashboardRunContextValue>(
    () => ({
      currentBlock,
      lastReceivedAt,
      connectionState,
      connectionError,
      startError,
      isStartingRun,
      deviceId,
      chartBuffer,
      showTemperature,
      showHumidity,
      isRunActive,
      setConnectionError,
      setStartError,
      setDeviceId,
      handleStartRun,
      handleDisconnect,
      handleReconnect,
    }),
    [
      chartBuffer,
      connectionError,
      connectionState,
      currentBlock,
      deviceId,
      handleDisconnect,
      handleReconnect,
      handleStartRun,
      isRunActive,
      isStartingRun,
      lastReceivedAt,
      showHumidity,
      showTemperature,
      startError,
    ]
  );

  return (
    <DashboardRunContext.Provider value={value}>
      {children}
    </DashboardRunContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboardRun() {
  const context = useContext(DashboardRunContext);

  if (context === undefined) {
    throw new Error('useDashboardRun must be used within DashboardRunProvider');
  }

  return context;
}
