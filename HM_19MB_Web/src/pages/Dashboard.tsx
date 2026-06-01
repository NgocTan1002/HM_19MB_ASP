import { Alert, Card, Col, Row, Space, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardControls, {
  type ChartDataPoint,
} from '../components/dashboard/DashboardControls';
import HealthIndicator from '../components/dashboard/HealthIndicator';
import ProbeDataTable from '../components/dashboard/ProbeDataTable';
import TemperatureChart from '../components/dashboard/TemperatureChart';
import { useSession } from '../contexts/useSession';
import {
  createHubClient,
  type HubConnectionState,
  type MeasurementHubClient,
} from '../services/signalr';
import type { MeasurementBlock } from '../types/models';

type HumidityMode = 'temp' | 'both' | 'humidity';

const { Text, Title } = Typography;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5135';
const MAX_CHART_POINTS = 720;

function isValidNumber(value: number | undefined): value is number {
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

function getSelectableProbeIndexes(block: MeasurementBlock | null): number[] {
  if (block === null) {
    return Array.from({ length: 10 }, (_, index) => index);
  }

  return Array.from({ length: 10 }, (_, index) => index).filter(index =>
    index < block.probeCount && isValidNumber(block.probeTemperatures[index])
  );
}

export default function Dashboard() {
  const { currentSessionId } = useSession();
  const clientRef = useRef<MeasurementHubClient | null>(null);
  const isRecordingRef = useRef(false);

  const [currentBlock, setCurrentBlock] = useState<MeasurementBlock | null>(null);
  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(null);
  const [connectionState, setConnectionState] =
    useState<HubConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [humidityMode, setHumidityMode] = useState<HumidityMode>('both');
  const [showProbes, setShowProbes] = useState<boolean[]>(
    () => Array.from({ length: 10 }, () => true)
  );
  const [selectedProbeIndex, setSelectedProbeIndex] = useState<number | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [recordStartTime, setRecordStartTime] = useState<Date | null>(null);
  const [chartBuffer, setChartBuffer] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const showHumidity = humidityMode !== 'temp';

  const handleMeasurement = useCallback((block: MeasurementBlock) => {
    setCurrentBlock(block);
    setLastReceivedAt(new Date());
    setConnectionError(null);
    setChartBuffer(points => appendChartPoint(points, block));

    if (isRecordingRef.current) {
      setRecordCount(count => count + 1);
    }
  }, []);

  const stopClient = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;

    if (client === null) {
      setConnectionState('disconnected');
      return;
    }

    client.offMeasurement();
    await client.stop();
  }, []);

  const connectClient = useCallback(async () => {
    if (currentSessionId === null) {
      await stopClient();
      setCurrentBlock(null);
      setLastReceivedAt(null);
      setConnectionError(null);
      setConnectionState('disconnected');
      return;
    }

    await stopClient();
    setConnectionError(null);
    setConnectionState('connecting');

    const client = createHubClient(API_BASE, {
      onStateChange: setConnectionState,
    });

    clientRef.current = client;
    client.onMeasurement(handleMeasurement);

    try {
      await client.start(currentSessionId);
    } catch (err: unknown) {
      client.offMeasurement();
      clientRef.current = null;
      setConnectionState('disconnected');
      setConnectionError(
        err instanceof Error ? err.message : 'SignalR connection failed'
      );
    }
  }, [currentSessionId, handleMeasurement, stopClient]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      await connectClient();
    }

    void start();

    return () => {
      cancelled = true;
      const client = clientRef.current;
      clientRef.current = null;

      if (client !== null) {
        client.offMeasurement();
        void client.stop();
      }

      if (!cancelled) {
        setConnectionState('disconnected');
      }
    };
  }, [connectClient]);

  const handleReconnect = useCallback(() => {
    void connectClient();
  }, [connectClient]);

  const handleToggleProbe = useCallback((index: number) => {
    setShowProbes(current =>
      current.map((shown, probeIndex) => (probeIndex === index ? !shown : shown))
    );
  }, []);

  const handleToggleAllProbes = useCallback(
    (show: boolean) => {
      const selectableIndexes = new Set(getSelectableProbeIndexes(currentBlock));
      setShowProbes(
        Array.from({ length: 10 }, (_, index) =>
          selectableIndexes.has(index) ? show : false
        )
      );
    },
    [currentBlock]
  );

  const handleToggleRecording = useCallback(() => {
    setIsRecording(current => {
      if (current) {
        setRecordStartTime(null);
        return false;
      }

      setRecordCount(0);
      setRecordStartTime(new Date());
      return true;
    });
  }, []);

  const statusDescription = useMemo(() => {
    if (currentSessionId === null) {
      return 'Chọn phiên đo ở header để bắt đầu nhận dữ liệu real-time.';
    }

    if (currentBlock === null) {
      return `Đang chờ dữ liệu từ phiên ${currentSessionId}.`;
    }

    return `Đang theo dõi phiên ${currentSessionId}.`;
  }, [currentBlock, currentSessionId]);

  return (
    <section className="dashboard-page">
      <style>
        {`
          .dashboard-page {
            display: grid;
            gap: 16px;
          }

          .dashboard-page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .dashboard-page-title {
            margin: 0;
          }

          .dashboard-card .ant-card-body {
            padding: 16px;
          }

          @media (max-width: 767px) {
            .dashboard-page-header {
              display: grid;
            }

            .dashboard-card .ant-card-body {
              padding: 12px;
            }
          }
        `}
      </style>

      <div className="dashboard-page-header">
        <Space direction="vertical" size={2}>
          <Title level={1} className="dashboard-page-title">
            Dashboard
          </Title>
          <Text type="secondary">{statusDescription}</Text>
        </Space>

        <HealthIndicator
          connectionState={connectionState}
          lastReceivedAt={lastReceivedAt}
          onReconnect={handleReconnect}
          sessionId={currentSessionId}
        />
      </div>

      {connectionError !== null && (
        <Alert
          closable
          message="Không thể kết nối SignalR"
          onClose={() => setConnectionError(null)}
          showIcon
          type="error"
          description={connectionError}
        />
      )}

      <DashboardControls
        chartBuffer={chartBuffer}
        currentBlock={currentBlock}
        humidityMode={humidityMode}
        isRecording={isRecording}
        onHumidityModeChange={setHumidityMode}
        onToggleAllProbes={handleToggleAllProbes}
        onToggleProbe={handleToggleProbe}
        onToggleRecording={handleToggleRecording}
        recordCount={recordCount}
        recordStartTime={recordStartTime}
        sessionId={currentSessionId}
        showProbes={showProbes}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="dashboard-card" title="Biểu đồ real-time">
            <TemperatureChart
              height={380}
              newBlock={currentBlock}
              onToggleProbe={handleToggleProbe}
              showHumidity={showHumidity}
              showProbes={showProbes}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="dashboard-card" title="Dữ liệu đầu đo">
            <ProbeDataTable
              block={currentBlock}
              highlightProbeIndex={selectedProbeIndex}
              onProbeSelect={setSelectedProbeIndex}
              showHumidity={showHumidity}
              showProbes={showProbes}
            />
          </Card>
        </Col>
      </Row>
    </section>
  );
}
