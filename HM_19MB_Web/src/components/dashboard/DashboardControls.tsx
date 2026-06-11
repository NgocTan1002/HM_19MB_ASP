import {
  Card,
  Collapse,
  Col,
  Grid,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MeasurementBlock } from '../../types/models';
import './DashboardControls.css';

export interface ChartDataPoint {
  timestamp: string;
  temps: (number | null)[];
  hums: (number | null)[];
  avgTemp: number;
  avgHum: number | null;
}

interface DashboardControlsProps {
  currentBlock: MeasurementBlock | null;
  chartBuffer: ChartDataPoint[];
}

interface MeasurementStats {
  max: number | null;
  min: number | null;
  range: number | null;
}

const { Text } = Typography;

function isValidNumber(value: number | undefined | null): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
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

function calculateStats(values: Array<number | null | undefined>): MeasurementStats {
  const validValues = values.filter((value): value is number => isValidNumber(value));

  if (validValues.length === 0) {
    return { max: null, min: null, range: null };
  }

  const max = Math.max(...validValues);
  const min = Math.min(...validValues);

  return {
    max,
    min,
    range: max - min,
  };
}

function calculateTemperatureStats(chartBuffer: ChartDataPoint[]): MeasurementStats {
  return calculateStats(chartBuffer.flatMap(point => point.temps));
}

function calculateHumidityStats(chartBuffer: ChartDataPoint[]): MeasurementStats {
  return calculateStats(chartBuffer.flatMap(point => point.hums));
}

export default function DashboardControls({
  currentBlock,
  chartBuffer,
}: DashboardControlsProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const chartBufferRef = useRef(chartBuffer);
  const [temperatureStats, setTemperatureStats] = useState<MeasurementStats>(() =>
    calculateTemperatureStats(chartBuffer)
  );
  const [humidityStats, setHumidityStats] = useState<MeasurementStats>(() =>
    calculateHumidityStats(chartBuffer)
  );

  const temperatureAvailable = useMemo(
    () => hasTemperatureData(currentBlock) || temperatureStats.max !== null,
    [currentBlock, temperatureStats.max]
  );
  const humidityAvailable = useMemo(
    () => hasHumidityData(currentBlock) || humidityStats.max !== null,
    [currentBlock, humidityStats.max]
  );

  useEffect(() => {
    chartBufferRef.current = chartBuffer;
  }, [chartBuffer]);

  useEffect(() => {
    const updateStats = () => {
      const points = chartBufferRef.current;
      setTemperatureStats(calculateTemperatureStats(points));
      setHumidityStats(calculateHumidityStats(points));
    };

    updateStats();
    const intervalId = window.setInterval(updateStats, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const dataModeLabel = temperatureAvailable && humidityAvailable
    ? 'Nhiệt độ + Độ ẩm'
    : humidityAvailable
      ? 'Chỉ độ ẩm'
      : temperatureAvailable
        ? 'Chỉ nhiệt độ'
        : 'Chưa có dữ liệu';

  const dataProfile = (
    <Space direction="vertical" size={8} className="dashboard-controls-section">
      <Text strong>Kiểu dữ liệu</Text>
      <Space wrap size={6}>
        <Tag color={temperatureAvailable ? 'red' : 'default'}>Nhiệt độ</Tag>
        <Tag color={humidityAvailable ? 'blue' : 'default'}>Độ ẩm</Tag>
      </Space>
      <Text type="secondary">{dataModeLabel}</Text>
    </Space>
  );

  const statisticsPanel = (
    <Space direction="vertical" size={8} className="dashboard-controls-section">
      <Text strong>Thống kê nhanh</Text>
      <Row gutter={[12, 8]}>
        <Col xs={24} sm={12} md={8} xl={humidityAvailable ? 4 : 8}>
          <Statistic
            title="Nhiệt độ lớn nhất"
            value={temperatureStats.max ?? '--'}
            precision={temperatureStats.max === null ? undefined : 2}
            suffix={temperatureStats.max === null ? undefined : '°C'}
          />
        </Col>
        <Col xs={24} sm={12} md={8} xl={humidityAvailable ? 4 : 8}>
          <Statistic
            title="Nhiệt độ nhỏ nhất"
            value={temperatureStats.min ?? '--'}
            precision={temperatureStats.min === null ? undefined : 2}
            suffix={temperatureStats.min === null ? undefined : '°C'}
          />
        </Col>
        <Col xs={24} sm={12} md={8} xl={humidityAvailable ? 4 : 8}>
          <Statistic
            title="Chênh lệch nhiệt"
            value={temperatureStats.range ?? '--'}
            precision={temperatureStats.range === null ? undefined : 2}
            suffix={temperatureStats.range === null ? undefined : '°C'}
          />
        </Col>
        {humidityAvailable && (
          <>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Statistic
                title="Độ ẩm lớn nhất"
                value={humidityStats.max ?? '--'}
                precision={humidityStats.max === null ? undefined : 2}
                suffix={humidityStats.max === null ? undefined : '%'}
              />
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Statistic
                title="Độ ẩm nhỏ nhất"
                value={humidityStats.min ?? '--'}
                precision={humidityStats.min === null ? undefined : 2}
                suffix={humidityStats.min === null ? undefined : '%'}
              />
            </Col>
            <Col xs={24} sm={12} md={8} xl={4}>
              <Statistic
                title="Chênh lệch ẩm"
                value={humidityStats.range ?? '--'}
                precision={humidityStats.range === null ? undefined : 2}
                suffix={humidityStats.range === null ? undefined : '%'}
              />
            </Col>
          </>
        )}
      </Row>
    </Space>
  );

  const content = (
    <div className="dashboard-controls-grid">
      {dataProfile}
      {statisticsPanel}
    </div>
  );

  return (
    <Card className="dashboard-controls" size="small">
      {isMobile ? (
        <Collapse
          ghost
          items={[
            {
              key: 'dashboard-controls',
              label: 'Thông tin theo dõi',
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
