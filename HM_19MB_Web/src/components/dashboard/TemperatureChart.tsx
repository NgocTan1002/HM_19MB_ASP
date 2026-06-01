import { ClearOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type MouseHandlerDataParam,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type {
  LegendPayload,
  Props as LegendContentProps,
} from 'recharts/types/component/DefaultLegendContent';
import type { MeasurementBlock } from '../../types/models';

interface TemperatureChartProps {
  newBlock: MeasurementBlock | null;
  historicalData?: HistoricalChartPoint[];
  showTemperature: boolean;
  showHumidity: boolean;
  showProbes: boolean[];
  onToggleProbe: (index: number) => void;
  height?: number;
}

interface HistoricalChartPoint {
  timestamp: string;
  temps: (number | null)[];
  avgTemp: number;
  avgHum: number | null;
}

interface ChartPoint {
  timestamp: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
  probeTemperatures: Array<number | null>;
}

interface FlatChartPoint {
  timestamp: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
  [key: `probeTemp${number}`]: number | null;
}

type ChartTooltipProps = TooltipContentProps;

const { Text } = Typography;

const MAX_CHART_POINTS = 720;
const RENDER_THROTTLE_MS = 500;

const PROBE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
];

function isValidNumber(value: number | undefined): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function toNullableNumber(value: number | undefined): number | null {
  return isValidNumber(value) ? value : null;
}

function parseTimestamp(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function createChartPoint(block: MeasurementBlock): ChartPoint {
  return {
    timestamp: parseTimestamp(block.timestamp),
    avgTemperature: toNullableNumber(block.avgTemperature),
    avgHumidity: toNullableNumber(block.avgHumidity),
    probeTemperatures: Array.from({ length: 10 }, (_, index) =>
      index < block.probeCount
        ? toNullableNumber(block.probeTemperatures[index])
        : null
    ),
  };
}

function createChartPointFromHistory(point: HistoricalChartPoint): ChartPoint {
  return {
    timestamp: parseTimestamp(point.timestamp),
    avgTemperature: toNullableNumber(point.avgTemp),
    avgHumidity: point.avgHum,
    probeTemperatures: Array.from({ length: 10 }, (_, index) =>
      point.temps[index] ?? null
    ),
  };
}

function flattenChartPoint(point: ChartPoint): FlatChartPoint {
  const flatPoint: FlatChartPoint = {
    timestamp: point.timestamp,
    avgTemperature: point.avgTemperature,
    avgHumidity: point.avgHumidity,
  };

  for (let index = 0; index < 10; index += 1) {
    flatPoint[`probeTemp${index}`] = point.probeTemperatures[index];
  }

  return flatPoint;
}

function formatTemperature(value: unknown): string {
  return typeof value === 'number' ? `${value.toFixed(2)} °C` : '---';
}

function formatHumidity(value: unknown): string {
  return typeof value === 'number' ? `${value.toFixed(1)} %` : '---';
}

function getTemperatureDomain(data: FlatChartPoint[]): [number, number] | ['auto', 'auto'] {
  const values = data.flatMap(point => {
    const temperatures: number[] = [];

    if (typeof point.avgTemperature === 'number') {
      temperatures.push(point.avgTemperature);
    }

    for (let index = 0; index < 10; index += 1) {
      const value = point[`probeTemp${index}`];
      if (typeof value === 'number') {
        temperatures.push(value);
      }
    }

    return temperatures;
  });

  if (values.length === 0) {
    return ['auto', 'auto'];
  }

  return [Math.floor(Math.min(...values) - 1), Math.ceil(Math.max(...values) + 1)];
}

function getLegendDataKey(entry: LegendPayload): string | number | undefined {
  if (typeof entry.dataKey === 'string' || typeof entry.dataKey === 'number') {
    return entry.dataKey;
  }

  return undefined;
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || payload === undefined || payload.length === 0) {
    return null;
  }

  return (
    <div className="temperature-chart-tooltip">
      <Text strong>{typeof label === 'number' ? formatTime(label) : label}</Text>
      <div className="temperature-chart-tooltip-list">
        {payload.map(entry => {
          const key = `${entry.dataKey ?? entry.name}`;
          const isHumidity = key.includes('Humidity');
          const displayValue = isHumidity
            ? formatHumidity(entry.value)
            : formatTemperature(entry.value);

          return (
            <div className="temperature-chart-tooltip-row" key={key}>
              <span
                className="temperature-chart-tooltip-dot"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}</span>
              <Text strong>{displayValue}</Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TemperatureChart({
  newBlock,
  historicalData = [],
  showTemperature,
  showHumidity,
  showProbes,
  onToggleProbe,
  height = 350,
}: TemperatureChartProps) {
  const bufferRef = useRef<ChartPoint[]>([]);
  const lastRenderAtRef = useRef(0);
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dataSnapshot, setDataSnapshot] = useState<ChartPoint[]>([]);
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  const commitBufferSnapshot = useCallback(() => {
    setDataSnapshot([...bufferRef.current]);
  }, []);

  const scheduleRender = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastRenderAtRef.current;

    if (elapsed >= RENDER_THROTTLE_MS) {
      lastRenderAtRef.current = now;
      commitBufferSnapshot();
      return;
    }

    if (renderTimerRef.current !== null) {
      return;
    }

    renderTimerRef.current = setTimeout(() => {
      renderTimerRef.current = null;
      lastRenderAtRef.current = Date.now();
      commitBufferSnapshot();
    }, RENDER_THROTTLE_MS - elapsed);
  }, [commitBufferSnapshot]);

  useEffect(() => {
    return () => {
      if (renderTimerRef.current !== null) {
        clearTimeout(renderTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (newBlock === null) {
      return;
    }

    bufferRef.current.push(createChartPoint(newBlock));

    if (bufferRef.current.length > MAX_CHART_POINTS) {
      bufferRef.current.splice(0, bufferRef.current.length - MAX_CHART_POINTS);
    }

    scheduleRender();
  }, [newBlock, scheduleRender]);

  useEffect(() => {
    let cancelled = false;
    const history = historicalData
      .slice(-MAX_CHART_POINTS)
      .map(createChartPointFromHistory);

    bufferRef.current = history;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      setDataSnapshot(history);
      setZoomStart(null);
      setZoomEnd(null);
      setZoomDomain(null);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [historicalData]);

  const chartData = useMemo(() => {
    const data = dataSnapshot.map(flattenChartPoint);

    if (zoomDomain === null) {
      return data;
    }

    const [start, end] = zoomDomain;
    return data.filter(point => point.timestamp >= start && point.timestamp <= end);
  }, [dataSnapshot, zoomDomain]);

  const temperatureDomain = useMemo(
    () => getTemperatureDomain(chartData),
    [chartData]
  );
  const showPointDots = chartData.length > 0 && chartData.length <= 20;

  const averageLineColor = useMemo(() => {
    if (typeof window === 'undefined') {
      return '#111827';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? '#ffffff'
      : '#111827';
  }, []);

  const handleClear = useCallback(() => {
    bufferRef.current = [];
    setDataSnapshot([]);
    setZoomStart(null);
    setZoomEnd(null);
    setZoomDomain(null);
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomStart(null);
    setZoomEnd(null);
    setZoomDomain(null);
  }, []);

  const handleMouseDown = useCallback((state: MouseHandlerDataParam) => {
    const activeTimestamp =
      typeof state.activeLabel === 'number' ? state.activeLabel : null;
    const point = chartData.find(item => item.timestamp === activeTimestamp);

    if (point !== undefined) {
      setZoomStart(point.timestamp);
      setZoomEnd(null);
    }
  }, [chartData]);

  const handleMouseMove = useCallback((state: MouseHandlerDataParam) => {
    if (zoomStart === null) {
      return;
    }

    const activeTimestamp =
      typeof state.activeLabel === 'number' ? state.activeLabel : null;
    const point = chartData.find(item => item.timestamp === activeTimestamp);

    if (point !== undefined) {
      setZoomEnd(point.timestamp);
    }
  }, [chartData, zoomStart]);

  const handleMouseUp = useCallback(() => {
    if (zoomStart === null || zoomEnd === null || zoomStart === zoomEnd) {
      setZoomStart(null);
      setZoomEnd(null);
      return;
    }

    setZoomDomain([
      Math.min(zoomStart, zoomEnd),
      Math.max(zoomStart, zoomEnd),
    ]);
    setZoomStart(null);
    setZoomEnd(null);
  }, [zoomEnd, zoomStart]);

  const handleLegendClick = useCallback((entry: { dataKey?: string | number }) => {
    const dataKey = String(entry.dataKey ?? '');
    const match = /^probeTemp(\d+)$/.exec(dataKey);

    if (match !== null) {
      onToggleProbe(Number(match[1]));
    }
  }, [onToggleProbe]);

  const renderLegend = useCallback((props: LegendContentProps) => {
    const payload = props.payload ?? [];

    return (
      <div className="temperature-chart-legend">
        {payload.map((entry: LegendPayload) => (
          <button
            className="temperature-chart-legend-item"
            key={String(getLegendDataKey(entry) ?? entry.value)}
            onClick={() => handleLegendClick({ dataKey: getLegendDataKey(entry) })}
            type="button"
          >
            <span
              className="temperature-chart-legend-dot"
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.value}</span>
          </button>
        ))}
      </div>
    );
  }, [handleLegendClick]);

  const referenceArea =
    zoomStart !== null && zoomEnd !== null ? (
      <ReferenceArea
        x1={Math.min(zoomStart, zoomEnd)}
        x2={Math.max(zoomStart, zoomEnd)}
        strokeOpacity={0.3}
      />
    ) : null;

  return (
    <section className="temperature-chart" aria-label="Biểu đồ nhiệt độ - độ ẩm">
      <style>
        {`
          .temperature-chart {
            width: 100%;
          }

          .temperature-chart-toolbar {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 12px;
          }

          .temperature-chart-tooltip {
            min-width: 240px;
            max-height: 360px;
            overflow: auto;
            padding: 10px 12px;
            border: 1px solid #d9d9d9;
            background: #ffffff;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
          }

          .temperature-chart-tooltip-list {
            display: grid;
            gap: 6px;
            margin-top: 8px;
          }

          .temperature-chart-tooltip-row {
            display: grid;
            grid-template-columns: 10px 1fr auto;
            align-items: center;
            gap: 8px;
            font-size: 12px;
          }

          .temperature-chart-tooltip-dot,
          .temperature-chart-legend-dot {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
          }

          .temperature-chart-legend {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px 12px;
            padding-top: 8px;
          }

          .temperature-chart-legend-item {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 0;
            background: transparent;
            color: #374151;
            cursor: pointer;
            font: inherit;
            font-size: 12px;
            padding: 2px 4px;
          }
        `}
      </style>

      <div className="temperature-chart-toolbar">
        <Space>
          {zoomDomain !== null && (
            <Button icon={<ZoomOutOutlined />} onClick={handleResetZoom}>
              Reset Zoom
            </Button>
          )}
          <Button danger icon={<ClearOutlined />} onClick={handleClear}>
            Xóa dữ liệu
          </Button>
        </Space>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 16, right: showHumidity ? 28 : 16, bottom: 12, left: 8 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            allowDataOverflow
            dataKey="timestamp"
            domain={['dataMin', 'dataMax']}
            minTickGap={24}
            tickFormatter={value => formatTime(Number(value))}
            tickLine={false}
            type="number"
          />
          {showTemperature && (
            <YAxis
              allowDataOverflow
              domain={temperatureDomain}
              tickFormatter={value => `${Number(value).toFixed(0)}°`}
              tickLine={false}
              yAxisId="temperature"
            />
          )}
          {showHumidity && (
            <YAxis
              domain={[0, 100]}
              orientation={showTemperature ? 'right' : 'left'}
              tickFormatter={value => `${Number(value).toFixed(0)}%`}
              tickLine={false}
              yAxisId="humidity"
            />
          )}
          <Tooltip content={(props: ChartTooltipProps) => <CustomTooltip {...props} />} />
          <Legend content={renderLegend} />

          {showTemperature &&
            Array.from({ length: 10 }, (_, index) => {
              if (showProbes[index] === false) {
                return null;
              }

              return (
                <Line
                  connectNulls
                  dataKey={`probeTemp${index}`}
                  dot={showPointDots ? { r: 2 } : false}
                  isAnimationActive={false}
                  key={`probe-temp-${index}`}
                  name={`Đầu đo ${index + 1}`}
                  stroke={PROBE_COLORS[index]}
                  strokeWidth={1.5}
                  type="monotone"
                  yAxisId="temperature"
                />
              );
            })}

          {showTemperature && (
            <Line
              connectNulls
              dataKey="avgTemperature"
              dot={showPointDots ? { r: 2.5 } : false}
              isAnimationActive={false}
              name="Trung bình nhiệt"
              stroke={averageLineColor}
              strokeWidth={2.5}
              type="monotone"
              yAxisId="temperature"
            />
          )}

          {showHumidity && (
            <Line
              connectNulls
              dataKey="avgHumidity"
              dot={showPointDots ? { r: 2.5 } : false}
              isAnimationActive={false}
              name="Trung bình độ ẩm"
              stroke="#1677ff"
              strokeDasharray="6 4"
              strokeWidth={2}
              type="monotone"
              yAxisId="humidity"
            />
          )}

          {referenceArea}
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}
