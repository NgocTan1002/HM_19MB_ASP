import {
  DownloadOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Collapse,
  Grid,
  Row,
  Col,
  Segmented,
  Space,
  Statistic,
  Typography,
} from 'antd';
import type { CheckboxOptionType } from 'antd/es/checkbox/Group';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadBlob, reportApi } from '../../services/api';
import type { MeasurementBlock } from '../../types/models';

export interface ChartDataPoint {
  timestamp: string;
  temps: (number | null)[];
  hums: (number | null)[];
  avgTemp: number;
  avgHum: number | null;
}

interface DashboardControlsProps {
  currentBlock: MeasurementBlock | null;
  humidityMode: 'temp' | 'both' | 'humidity';
  onHumidityModeChange: (mode: 'temp' | 'both' | 'humidity') => void;
  showProbes: boolean[];
  onToggleProbe: (index: number) => void;
  onToggleAllProbes: (show: boolean) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  recordCount: number;
  recordStartTime: Date | null;
  sessionId: number | null;
  chartBuffer: ChartDataPoint[];
}

interface TemperatureStats {
  maxTemp: number | null;
  minTemp: number | null;
  range: number | null;
  sampleCount: number;
}

const { Text } = Typography;

function isValidNumber(value: number | undefined | null): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function hasHumidityData(block: MeasurementBlock | null): boolean {
  if (block === null) {
    return false;
  }

  return block.probeHumidities.some((value, index) =>
    index < block.probeCount && isValidNumber(value)
  );
}

function formatTemperature(value: number | null | undefined): string {
  return isValidNumber(value) ? `${value.toFixed(1)}°C` : '---';
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function createReportFilename(sessionId: number): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '');

  return `BaoCao_${sessionId}_${timestamp}.xlsx`;
}

function calculateTemperatureStats(chartBuffer: ChartDataPoint[]): TemperatureStats {
  const temps = chartBuffer.flatMap(point =>
    point.temps.filter((value): value is number => isValidNumber(value))
  );

  if (temps.length === 0) {
    return {
      maxTemp: null,
      minTemp: null,
      range: null,
      sampleCount: chartBuffer.length,
    };
  }

  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);

  return {
    maxTemp,
    minTemp,
    range: maxTemp - minTemp,
    sampleCount: chartBuffer.length,
  };
}

export default function DashboardControls({
  currentBlock,
  humidityMode,
  onHumidityModeChange,
  showProbes,
  onToggleProbe,
  onToggleAllProbes,
  isRecording,
  onToggleRecording,
  recordCount,
  recordStartTime,
  sessionId,
  chartBuffer,
}: DashboardControlsProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [exporting, setExporting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const chartBufferRef = useRef(chartBuffer);
  const [stats, setStats] = useState<TemperatureStats>(() =>
    calculateTemperatureStats(chartBuffer)
  );

  const humidityAvailable = useMemo(
    () => hasHumidityData(currentBlock),
    [currentBlock]
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    chartBufferRef.current = chartBuffer;
  }, [chartBuffer]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStats(calculateTemperatureStats(chartBufferRef.current));
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!humidityAvailable && humidityMode !== 'temp') {
      onHumidityModeChange('temp');
    }
  }, [humidityAvailable, humidityMode, onHumidityModeChange]);

  const recordingSeconds = useMemo(() => {
    if (!isRecording || recordStartTime === null) {
      return 0;
    }

    return Math.max(0, Math.floor((now.getTime() - recordStartTime.getTime()) / 1000));
  }, [isRecording, now, recordStartTime]);

  const selectedProbeValues = useMemo(
    () =>
      showProbes
        .map((selected, index) => (selected ? index : null))
        .filter((index): index is number => index !== null),
    [showProbes]
  );

  const probeOptions = useMemo<CheckboxOptionType<number>[]>(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const temperature =
          currentBlock !== null && index < currentBlock.probeCount
            ? currentBlock.probeTemperatures[index]
            : null;
        const hasTemperature = isValidNumber(temperature);

        return {
          label: `Đầu đo ${index + 1} (${formatTemperature(temperature)})`,
          value: index,
          disabled: !hasTemperature,
        };
      }),
    [currentBlock]
  );

  const handleProbeGroupChange = useCallback(
    (checkedValues: number[]) => {
      for (let index = 0; index < 10; index += 1) {
        const shouldShow = checkedValues.includes(index);
        const currentlyShown = showProbes[index] === true;

        if (shouldShow !== currentlyShown) {
          onToggleProbe(index);
        }
      }
    },
    [onToggleProbe, showProbes]
  );

  const handleExportExcel = useCallback(async () => {
    if (sessionId === null) {
      return;
    }

    setExporting(true);

    try {
      const response = await reportApi.exportExcel(sessionId);
      const data: unknown = response.data;

      if (!(data instanceof Blob)) {
        throw new Error('Export Excel response is not a Blob');
      }

      downloadBlob(data, createReportFilename(sessionId));
    } finally {
      setExporting(false);
    }
  }, [sessionId]);

  const humidityControls = (
    <Space direction="vertical" size={8} className="dashboard-controls-section">
      <Text strong>Hiển thị dữ liệu</Text>
      <Segmented<'temp' | 'both' | 'humidity'>
        block
        options={[
          {
            label: 'Chỉ nhiệt độ',
            value: 'temp',
          },
          {
            label: 'Nhiệt + Ẩm',
            value: 'both',
            disabled: !humidityAvailable,
          },
          {
            label: 'Chỉ độ ẩm',
            value: 'humidity',
            disabled: !humidityAvailable,
          },
        ]}
        onChange={onHumidityModeChange}
        value={humidityMode}
      />
    </Space>
  );

  const probeControls = (
    <Space direction="vertical" size={8} className="dashboard-controls-section">
      <div className="dashboard-controls-row">
        <Text strong>Đầu đo</Text>
        <Space size={6}>
          <Button size="small" onClick={() => onToggleAllProbes(true)}>
            Chọn tất cả
          </Button>
          <Button size="small" onClick={() => onToggleAllProbes(false)}>
            Bỏ chọn tất cả
          </Button>
        </Space>
      </div>
      <Checkbox.Group<number>
        className="dashboard-probe-grid"
        options={probeOptions}
        onChange={handleProbeGroupChange}
        value={selectedProbeValues}
      />
    </Space>
  );

  const recordingControls = (
    <Space direction="vertical" size={8} className="dashboard-controls-section">
      <Text strong>Ghi dữ liệu</Text>
      <Space wrap>
        <Button
          danger={isRecording}
          icon={isRecording ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={onToggleRecording}
          type={isRecording ? 'default' : 'primary'}
        >
          {isRecording ? 'Dừng ghi' : 'Bắt đầu ghi'}
        </Button>
        <Button
          disabled={sessionId === null}
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={handleExportExcel}
        >
          Xuất Excel
        </Button>
      </Space>
      {isRecording && (
        <Text type="secondary">
          {recordCount} lần đo · {formatDuration(recordingSeconds)}
        </Text>
      )}
    </Space>
  );

  const statisticsPanel = (
    <Space direction="vertical" size={8} className="dashboard-controls-section">
      <Text strong>Thống kê nhanh</Text>
      <Row gutter={[8, 8]}>
        <Col span={12}>
          <Statistic
            title="Max temp"
            value={stats.maxTemp ?? '--'}
            precision={stats.maxTemp === null ? undefined : 2}
            suffix={stats.maxTemp === null ? undefined : '°C'}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="Min temp"
            value={stats.minTemp ?? '--'}
            precision={stats.minTemp === null ? undefined : 2}
            suffix={stats.minTemp === null ? undefined : '°C'}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="Range"
            value={stats.range ?? '--'}
            precision={stats.range === null ? undefined : 2}
            suffix={stats.range === null ? undefined : '°C'}
          />
        </Col>
        <Col span={12}>
          <Statistic title="Số lần đo" value={stats.sampleCount} />
        </Col>
      </Row>
    </Space>
  );

  const content = (
    <div className="dashboard-controls-grid">
      {humidityControls}
      {probeControls}
      {recordingControls}
      {statisticsPanel}
    </div>
  );

  return (
    <Card className="dashboard-controls" size="small">
      <style>
        {`
          .dashboard-controls {
            width: 100%;
          }

          .dashboard-controls .ant-card-body {
            padding: 12px;
          }

          .dashboard-controls-grid {
            display: grid;
            grid-template-columns: minmax(220px, 1fr) minmax(320px, 1.4fr) minmax(220px, 1fr) minmax(260px, 1fr);
            gap: 12px;
            align-items: start;
          }

          .dashboard-controls-section {
            width: 100%;
          }

          .dashboard-controls-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }

          .dashboard-probe-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px 10px;
          }

          .dashboard-probe-grid .ant-checkbox-wrapper {
            margin-inline-start: 0;
            min-width: 0;
          }

          .dashboard-probe-grid .ant-checkbox-wrapper span:last-child {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          @media (max-width: 1200px) {
            .dashboard-controls-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 767px) {
            .dashboard-controls .ant-card-body {
              padding: 8px;
            }

            .dashboard-controls-grid {
              grid-template-columns: 1fr;
            }

            .dashboard-probe-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

      {isMobile ? (
        <Collapse
          ghost
          items={[
            {
              key: 'dashboard-controls',
              label: 'Điều khiển Dashboard',
              children: content,
            },
          ]}
        />
      ) : (
        content
      )}
    </Card>
  );
}
