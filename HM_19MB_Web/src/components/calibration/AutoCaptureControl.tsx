import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, InputNumber, Progress, Space, Tag, Typography } from 'antd';
import { createHubClient, type MeasurementHubClient } from '../../services/signalr';
import type { MeasurementBlock } from '../../types/models';

const { Text } = Typography;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5135';

export interface AutoCaptureControlProps {
  sessionId: number;
  j: number;
  targetTemp: number;
  tolerance: number;
  onCapture: (channelValues: number[], chiThiUut: number) => void;
  disabled?: boolean;
  maxCaptures?: number;
}

type CaptureStatus = 'idle' | 'waiting' | 'captured' | 'error';

function getStatusColor(status: CaptureStatus): string {
  switch (status) {
    case 'waiting':
      return 'processing';
    case 'captured':
      return 'success';
    case 'error':
      return 'error';
    case 'idle':
    default:
      return 'default';
  }
}

function getStatusText(
  status: CaptureStatus,
  capturedCount: number,
  currentTemperature: number | null,
  errorMessage: string | null
): string {
  if (status === 'error') {
    return errorMessage ?? 'Lỗi kết nối';
  }

  if (status === 'waiting') {
    return currentTemperature === null
      ? 'Đang chờ dữ liệu...'
      : `Đang chờ ổn định... hiện tại ${currentTemperature.toFixed(1)}°C`;
  }

  if (status === 'captured') {
    return `captured ${capturedCount} rows`;
  }

  return 'idle';
}

function AutoCaptureControl({
  sessionId,
  j,
  targetTemp,
  tolerance,
  onCapture,
  disabled = false,
  maxCaptures = 20,
}: AutoCaptureControlProps) {
  const [running, setRunning] = useState(false);
  const [toleranceValue, setToleranceValue] = useState(tolerance || 0.5);
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [capturedCount, setCapturedCount] = useState(0);
  const [currentTemperature, setCurrentTemperature] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientRef = useRef<MeasurementHubClient | null>(null);
  const capturedCountRef = useRef(0);
  const mountedRef = useRef(false);
  const onCaptureRef = useRef(onCapture);
  const jRef = useRef(j);
  const targetTempRef = useRef(targetTemp);
  const toleranceRef = useRef(toleranceValue);
  const maxCapturesRef = useRef(maxCaptures);

  useEffect(() => {
    onCaptureRef.current = onCapture;
    jRef.current = j;
    targetTempRef.current = targetTemp;
    toleranceRef.current = toleranceValue;
    maxCapturesRef.current = maxCaptures;
  }, [j, maxCaptures, onCapture, targetTemp, toleranceValue]);

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

    if (mountedRef.current) {
      setRunning(false);
      setStatus(capturedCountRef.current > 0 ? 'captured' : 'idle');
    }
  }, []);

  const handleBlock = useCallback(
    (block: MeasurementBlock) => {
      const avgTemperature = block.avgTemperature;

      if (!Number.isFinite(avgTemperature)) {
        return;
      }

      if (mountedRef.current) {
        setCurrentTemperature(avgTemperature);
      }

      const accepted =
        Math.abs(avgTemperature - targetTempRef.current) <= toleranceRef.current;

      if (!accepted) {
        if (mountedRef.current) {
          setStatus('waiting');
        }
        return;
      }

      const channelValues = block.probeTemperatures
        .slice(0, jRef.current)
        .map((value) => (Number.isFinite(value) ? value : Number.NaN));

      onCaptureRef.current(channelValues, avgTemperature);
      capturedCountRef.current += 1;

      if (mountedRef.current) {
        setCapturedCount(capturedCountRef.current);
        setStatus('captured');
      }

      if (capturedCountRef.current >= maxCapturesRef.current) {
        void stopCapture();
      }
    },
    [stopCapture]
  );

  const startCapture = useCallback(async () => {
    if (disabled || running) {
      return;
    }

    capturedCountRef.current = 0;
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
  }, [disabled, handleBlock, running, sessionId]);

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
    if (disabled && running) {
      void stopCapture();
    }
  }, [disabled, running, stopCapture]);

  const statusText = getStatusText(
    status,
    capturedCount,
    currentTemperature,
    errorMessage
  );

  return (
    <Card size="small">
      <Space wrap align="center">
        <Button
          type={running ? 'default' : 'primary'}
          danger={running}
          onClick={handleToggle}
          disabled={disabled}
        >
          {running ? 'Dừng thu' : 'Bắt đầu tự động thu'}
        </Button>

        <InputNumber<number>
          min={0.1}
          step={0.1}
          value={toleranceValue}
          disabled={running || disabled}
          onChange={(value) => setToleranceValue(value ?? 0.5)}
          suffix="°C"
          style={{ width: 120 }}
        />

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
