import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  InputNumber,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import { createHubClient, type MeasurementHubClient } from '../../services/signalr';
import type { MeasurementBlock } from '../../types/models';

const { Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5135';
const MS_PER_MINUTE = 60_000;

export interface AutoCaptureControlProps {
  sessionId: number;
  j: number;
  targetTemp: number;
  tolerance: number;
  onCapture: (channelValues: number[], chiThiUut: number) => void;
  disabled?: boolean;
  maxCaptures?: number;
}

type CaptureStatus = 'idle' | 'waiting' | 'stabilizing' | 'ready' | 'captured' | 'error';

interface CaptureTiming {
  stableElapsedMs: number;
  nextCaptureInMs: number | null;
}

function getStatusColor(status: CaptureStatus): string {
  switch (status) {
    case 'waiting':
    case 'stabilizing':
      return 'processing';
    case 'ready':
      return 'warning';
    case 'captured':
      return 'success';
    case 'error':
      return 'error';
    case 'idle':
    default:
      return 'default';
  }
}

function formatMinutes(ms: number): string {
  const minutes = Math.max(0, ms / MS_PER_MINUTE);
  return minutes >= 1 ? `${minutes.toFixed(1)} phút` : `${Math.ceil(ms / 1000)} giây`;
}

function getStatusText(
  status: CaptureStatus,
  capturedCount: number,
  currentTemperature: number | null,
  timing: CaptureTiming,
  stableMinutes: number,
  errorMessage: string | null
): string {
  if (status === 'error') {
    return errorMessage ?? 'Lỗi kết nối';
  }

  if (status === 'waiting') {
    return currentTemperature === null
      ? 'Đang chờ dữ liệu...'
      : `Chờ vào vùng ổn định, hiện tại ${currentTemperature.toFixed(2)}°C`;
  }

  if (status === 'stabilizing') {
    const remainingMs = Math.max(
      0,
      stableMinutes * MS_PER_MINUTE - timing.stableElapsedMs
    );
    return `Đang chờ ổn định thêm ${formatMinutes(remainingMs)}`;
  }

  if (status === 'ready') {
    return timing.nextCaptureInMs === null
      ? 'Đã ổn định, sẵn sàng thu'
      : `Lần thu tiếp theo sau ${formatMinutes(timing.nextCaptureInMs)}`;
  }

  if (status === 'captured') {
    return `Đã thu ${capturedCount} lần`;
  }

  return 'Chưa chạy';
}

function getChannelValues(block: MeasurementBlock, expectedChannels: number): number[] {
  const availableChannels = Math.min(
    Math.max(0, block.probeCount),
    block.probeTemperatures.length,
    10
  );
  const captureChannels = Math.min(Math.max(0, expectedChannels), availableChannels);

  return Array.from({ length: captureChannels }, (_item, index) => {
    const value = block.probeTemperatures[index];
    return Number.isFinite(value) ? value : Number.NaN;
  });
}

function getNowFromBlock(block: MeasurementBlock): number {
  const parsed = Date.parse(block.timestamp);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function AutoCaptureControl({
  sessionId,
  j,
  targetTemp,
  tolerance,
  onCapture,
  disabled = false,
  maxCaptures = 5,
}: AutoCaptureControlProps) {
  const [running, setRunning] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [stableMinutes, setStableMinutes] = useState(3);
  const [toleranceValue, setToleranceValue] = useState(tolerance || 0.5);
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [capturedCount, setCapturedCount] = useState(0);
  const [currentTemperature, setCurrentTemperature] = useState<number | null>(null);
  const [timing, setTiming] = useState<CaptureTiming>({
    stableElapsedMs: 0,
    nextCaptureInMs: null,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientRef = useRef<MeasurementHubClient | null>(null);
  const capturedCountRef = useRef(0);
  const stableSinceRef = useRef<number | null>(null);
  const lastCaptureAtRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const onCaptureRef = useRef(onCapture);
  const jRef = useRef(j);
  const targetTempRef = useRef(targetTemp);
  const toleranceRef = useRef(toleranceValue);
  const maxCapturesRef = useRef(maxCaptures);
  const intervalMinutesRef = useRef(intervalMinutes);
  const stableMinutesRef = useRef(stableMinutes);
  const autoEnabledRef = useRef(autoEnabled);

  useEffect(() => {
    onCaptureRef.current = onCapture;
    jRef.current = j;
    targetTempRef.current = targetTemp;
    toleranceRef.current = toleranceValue;
    maxCapturesRef.current = maxCaptures;
    intervalMinutesRef.current = intervalMinutes;
    stableMinutesRef.current = stableMinutes;
    autoEnabledRef.current = autoEnabled;
  }, [
    autoEnabled,
    intervalMinutes,
    j,
    maxCaptures,
    onCapture,
    stableMinutes,
    targetTemp,
    toleranceValue,
  ]);

  const resetTiming = useCallback(() => {
    stableSinceRef.current = null;
    lastCaptureAtRef.current = null;
    setTiming({ stableElapsedMs: 0, nextCaptureInMs: null });
  }, []);

  const stopCapture = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;

    if (client !== null) {
      client.offMeasurement();
      try {
        await client.stop();
      } catch (error) {
        console.warn('[AutoCaptureControl] Stop SignalR failed:', error);
      }
    }

    resetTiming();

    if (mountedRef.current) {
      setRunning(false);
      setStatus(capturedCountRef.current > 0 ? 'captured' : 'idle');
    }
  }, [resetTiming]);

  const captureBlock = useCallback(
    (block: MeasurementBlock, now: number) => {
      const channelValues = getChannelValues(block, jRef.current);

      onCaptureRef.current(channelValues, block.avgTemperature);
      capturedCountRef.current += 1;
      lastCaptureAtRef.current = now;

      if (mountedRef.current) {
        setCapturedCount(capturedCountRef.current);
        setStatus('captured');
        setTiming({
          stableElapsedMs:
            stableSinceRef.current === null ? 0 : now - stableSinceRef.current,
          nextCaptureInMs: intervalMinutesRef.current * MS_PER_MINUTE,
        });
      }

      if (capturedCountRef.current >= maxCapturesRef.current) {
        void stopCapture();
      }
    },
    [stopCapture]
  );

  const handleBlock = useCallback(
    (block: MeasurementBlock) => {
      const avgTemperature = block.avgTemperature;

      if (!Number.isFinite(avgTemperature)) {
        return;
      }

      const now = getNowFromBlock(block);

      if (mountedRef.current) {
        setCurrentTemperature(avgTemperature);
      }

      if (!autoEnabledRef.current) {
        return;
      }

      const inRange =
        Math.abs(avgTemperature - targetTempRef.current) <= toleranceRef.current;

      if (!inRange) {
        stableSinceRef.current = null;
        if (mountedRef.current) {
          setStatus('waiting');
          setTiming({ stableElapsedMs: 0, nextCaptureInMs: null });
        }
        return;
      }

      if (stableSinceRef.current === null) {
        stableSinceRef.current = now;
      }

      const stableElapsedMs = now - stableSinceRef.current;
      const stableRequiredMs = stableMinutesRef.current * MS_PER_MINUTE;

      if (stableElapsedMs < stableRequiredMs) {
        if (mountedRef.current) {
          setStatus('stabilizing');
          setTiming({ stableElapsedMs, nextCaptureInMs: null });
        }
        return;
      }

      const intervalMs = intervalMinutesRef.current * MS_PER_MINUTE;
      const lastCaptureAt = lastCaptureAtRef.current;
      const nextCaptureInMs =
        lastCaptureAt === null ? 0 : Math.max(0, intervalMs - (now - lastCaptureAt));

      if (nextCaptureInMs > 0) {
        if (mountedRef.current) {
          setStatus('ready');
          setTiming({ stableElapsedMs, nextCaptureInMs });
        }
        return;
      }

      captureBlock(block, now);
    },
    [captureBlock]
  );

  const startCapture = useCallback(async () => {
    if (disabled || running || !autoEnabled) {
      return;
    }

    capturedCountRef.current = 0;
    resetTiming();
    setCapturedCount(0);
    setCurrentTemperature(null);
    setErrorMessage(null);
    setStatus('waiting');
    setRunning(true);

    const client = createHubClient(API_BASE);
    clientRef.current = client;
    client.onMeasurement(handleBlock);

    try {
      await client.start(sessionId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Không kết nối được SignalR';

      client.offMeasurement();
      try {
        await client.stop();
      } catch (stopError) {
        console.warn('[AutoCaptureControl] Cleanup after start failed:', stopError);
      }

      if (clientRef.current === client) {
        clientRef.current = null;
      }

      if (mountedRef.current) {
        setErrorMessage(message);
        setStatus('error');
        setRunning(false);
      }
    }
  }, [autoEnabled, disabled, handleBlock, resetTiming, running, sessionId]);

  const handleToggle = useCallback(() => {
    if (running) {
      void stopCapture();
      return;
    }

    void startCapture();
  }, [running, startCapture, stopCapture]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const client = clientRef.current;
      clientRef.current = null;

      if (client !== null) {
        client.offMeasurement();
        void client.stop();
      }
    };
  }, []);

  useEffect(() => {
    if ((disabled || !autoEnabled) && running) {
      const timerId = window.setTimeout(() => {
        void stopCapture();
      }, 0);

      return () => {
        window.clearTimeout(timerId);
      };
    }

    return undefined;
  }, [autoEnabled, disabled, running, stopCapture]);

  const statusText = getStatusText(
    status,
    capturedCount,
    currentTemperature,
    timing,
    stableMinutes,
    errorMessage
  );

  return (
    <Card size="small">
      <Space wrap align="center">
        <Checkbox
          checked={autoEnabled}
          disabled={running || disabled}
          onChange={(event) => setAutoEnabled(event.target.checked)}
        >
          Tự động
        </Checkbox>

        <Text>Mỗi</Text>
        <InputNumber<number>
          min={0.1}
          step={0.5}
          value={intervalMinutes}
          disabled={running || disabled || !autoEnabled}
          onChange={(value) => setIntervalMinutes(value ?? 5)}
          addonAfter="phút"
          style={{ width: 140 }}
        />

        <Text>±</Text>
        <InputNumber<number>
          min={0.1}
          step={0.1}
          value={toleranceValue}
          disabled={running || disabled || !autoEnabled}
          onChange={(value) => setToleranceValue(value ?? 0.5)}
          addonAfter="°C"
          style={{ width: 120 }}
        />

        <Text>ổn định trong</Text>
        <InputNumber<number>
          min={0}
          step={0.5}
          value={stableMinutes}
          disabled={running || disabled || !autoEnabled}
          onChange={(value) => setStableMinutes(value ?? 3)}
          addonAfter="phút"
          style={{ width: 140 }}
        />

        <Button
          type={running ? 'default' : 'primary'}
          danger={running}
          onClick={handleToggle}
          disabled={disabled || !autoEnabled}
        >
          {running ? 'Dừng' : 'Bắt đầu'}
        </Button>

        <Tag color={getStatusColor(status)}>{statusText}</Tag>

        <Text type="secondary">
          {capturedCount}/{maxCaptures}
        </Text>

        <Progress
          percent={Math.min(100, Math.round((capturedCount / maxCaptures) * 100))}
          size="small"
          showInfo={false}
          style={{ width: 120 }}
        />
      </Space>
    </Card>
  );
}

export default memo(AutoCaptureControl);
