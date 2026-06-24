import { ClearOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { Button, Segmented, Space, Switch, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
import './TemperatureChart.css';

interface TemperatureChartProps {
  newBlock: MeasurementBlock | null;
  historicalData?: HistoricalChartPoint[];
  showTemperature: boolean;
  showHumidity: boolean;
  height?: number;
}

interface HistoricalChartPoint {
  timestamp: string;
  temps: (number | null)[];
  hums: (number | null)[];
  avgTemp: number;
  avgHum: number | null;
}

interface ChartPoint {
  timestamp: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
  probeTemperatures: Array<number | null>;
  probeHumidities: Array<number | null>;
}

interface FlatChartPoint {
  timestamp: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
  [key: `probeTemp${number}`]: number | null;
  [key: `probeHum${number}`]: number | null;
}

type ChartTooltipProps = TooltipContentProps;
type TimeWindowValue = '60000' | '300000' | '900000' | 'all' | 'custom';

interface BrushRange {
  startIndex: number;
  endIndex: number;
}

const { Text } = Typography;

const MAX_CHART_POINTS = 720;
const RENDER_THROTTLE_MS = 500;
const DEFAULT_TIME_WINDOW: TimeWindowValue = 'all';

const BASE_TIME_WINDOW_OPTIONS: Array<{
  label: string;
  value: TimeWindowValue;
}> = [
  { label: '1 phút', value: '60000' },
  { label: '5 phút', value: '300000' },
  { label: '15 phút', value: '900000' },
  { label: 'Toàn bộ', value: 'all' },
];

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

function isValidNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toNullableNumber(value: number | null | undefined): number | null {
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
    probeHumidities: Array.from({ length: 10 }, (_, index) =>
      index < block.probeCount
        ? toNullableNumber(block.probeHumidities[index])
        : null
    ),
  };
}

function createChartPointFromHistory(point: HistoricalChartPoint): ChartPoint {
  return {
    timestamp: parseTimestamp(point.timestamp),
    avgTemperature: toNullableNumber(point.avgTemp),
    avgHumidity: toNullableNumber(point.avgHum),
    probeTemperatures: Array.from({ length: 10 }, (_, index) =>
      toNullableNumber(point.temps[index] ?? undefined)
    ),
    probeHumidities: Array.from({ length: 10 }, (_, index) =>
      toNullableNumber(point.hums[index] ?? undefined)
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
    flatPoint[`probeHum${index}`] = point.probeHumidities[index];
  }

  return flatPoint;
}

function dedupeChartPoints(points: FlatChartPoint[]): FlatChartPoint[] {
  const byTimestamp = new Map<number, FlatChartPoint>();

  points.forEach(point => {
    byTimestamp.set(point.timestamp, point);
  });

  return Array.from(byTimestamp.values()).sort(
    (left, right) => left.timestamp - right.timestamp
  );
}

function clampIndex(index: number, dataLength: number): number {
  return Math.min(Math.max(index, 0), Math.max(dataLength - 1, 0));
}

function getFullBrushRange(dataLength: number): BrushRange | null {
  return dataLength === 0 ? null : { startIndex: 0, endIndex: dataLength - 1 };
}

function areBrushRangesEqual(
  left: BrushRange | null,
  right: BrushRange | null
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.startIndex === right.startIndex && left.endIndex === right.endIndex;
}

function getPresetBrushRange(
  data: FlatChartPoint[],
  timeWindowValue: TimeWindowValue,
  anchorIndex?: number | null
): BrushRange | null {
  if (data.length === 0) {
    return null;
  }

  if (timeWindowValue === 'all' || timeWindowValue === 'custom') {
    return getFullBrushRange(data.length);
  }

  const endIndex = clampIndex(anchorIndex ?? data.length - 1, data.length);
  const endTimestamp = data[endIndex].timestamp;
  const startTimestamp = endTimestamp - Number(timeWindowValue);
  const foundIndex = data.findIndex(point => point.timestamp >= startTimestamp);

  return {
    startIndex: foundIndex === -1 ? 0 : foundIndex,
    endIndex,
  };
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
          const isHumidity = key.includes('Humidity') || key.startsWith('probeHum');
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
  height = 350,
}: TemperatureChartProps) {
  const bufferRef = useRef<ChartPoint[]>([]);
  const lastRenderAtRef = useRef(0);
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dataSnapshot, setDataSnapshot] = useState<ChartPoint[]>([]);
  const [brushRange, setBrushRange] = useState<BrushRange | null>(null);
  const [timeWindowValue, setTimeWindowValue] =
    useState<TimeWindowValue>(DEFAULT_TIME_WINDOW);
  const [followRealtime, setFollowRealtime] = useState(true);

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

      if (history.length === 0) {
        setBrushRange(null);
        setTimeWindowValue(DEFAULT_TIME_WINDOW);
        setFollowRealtime(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [historicalData]);

  const fullChartData = useMemo(
    () => dedupeChartPoints(dataSnapshot.map(flattenChartPoint)),
    [dataSnapshot]
  );

  const effectiveBrushRange = useMemo(() => {
    if (fullChartData.length === 0) {
      return null;
    }

    if (!followRealtime) {
      if (brushRange === null) {
        return getFullBrushRange(fullChartData.length);
      }

      const startIndex = clampIndex(brushRange.startIndex, fullChartData.length);
      const endIndex = clampIndex(brushRange.endIndex, fullChartData.length);

      return {
        startIndex: Math.min(startIndex, endIndex),
        endIndex: Math.max(startIndex, endIndex),
      };
    }

    return getPresetBrushRange(
      fullChartData,
      timeWindowValue,
      fullChartData.length - 1
    );
  }, [brushRange, followRealtime, fullChartData, timeWindowValue]);

  const visibleChartData = useMemo(() => {
    if (effectiveBrushRange === null) {
      return fullChartData;
    }

    return fullChartData.slice(
      effectiveBrushRange.startIndex,
      effectiveBrushRange.endIndex + 1
    );
  }, [effectiveBrushRange, fullChartData]);

  const temperatureDomain = useMemo(
    () => getTemperatureDomain(visibleChartData),
    [visibleChartData]
  );
  const visibleTemperatureProbeIndexes = useMemo(
    () =>
      Array.from({ length: 10 }, (_item, index) => index).filter(index =>
        visibleChartData.some(point => typeof point[`probeTemp${index}`] === 'number')
      ),
    [visibleChartData]
  );
  const visibleHumidityProbeIndexes = useMemo(
    () =>
      Array.from({ length: 10 }, (_item, index) => index).filter(index =>
        visibleChartData.some(point => typeof point[`probeHum${index}`] === 'number')
      ),
    [visibleChartData]
  );
  const showPointDots = visibleChartData.length > 0 && visibleChartData.length <= 20;

  const averageLineColor = '#6b7280';
  const timeWindowOptions = useMemo(
    () =>
      timeWindowValue === 'custom'
        ? [...BASE_TIME_WINDOW_OPTIONS, { label: 'Tùy chọn', value: 'custom' as const }]
        : BASE_TIME_WINDOW_OPTIONS,
    [timeWindowValue]
  );

  const handleClear = useCallback(() => {
    bufferRef.current = [];
    setDataSnapshot([]);
    setBrushRange(null);
    setTimeWindowValue(DEFAULT_TIME_WINDOW);
    setFollowRealtime(true);
  }, []);

  const handleResetZoom = useCallback(() => {
    setBrushRange(getFullBrushRange(fullChartData.length));
    setTimeWindowValue(DEFAULT_TIME_WINDOW);
    setFollowRealtime(true);
  }, [fullChartData.length]);

  const handleTimeWindowChange = useCallback(
    (value: TimeWindowValue) => {
      if (value === 'custom') {
        return;
      }

      setTimeWindowValue(value);
      setBrushRange(
        value === 'all'
          ? getFullBrushRange(fullChartData.length)
          : getPresetBrushRange(fullChartData, value, fullChartData.length - 1)
      );
      setFollowRealtime(true);
    },
    [fullChartData]
  );

  const handleFollowRealtimeChange = useCallback((checked: boolean) => {
    setFollowRealtime(checked);
  }, []);

  const handleBrushChange = useCallback(
    (range: { startIndex?: number; endIndex?: number }) => {
      if (
        typeof range.startIndex !== 'number' ||
        typeof range.endIndex !== 'number' ||
        fullChartData.length === 0
      ) {
        return;
      }

      const startIndex = clampIndex(range.startIndex, fullChartData.length);
      const endIndex = clampIndex(range.endIndex, fullChartData.length);
      const nextRange = {
        startIndex: Math.min(startIndex, endIndex),
        endIndex: Math.max(startIndex, endIndex),
      };

      if (areBrushRangesEqual(effectiveBrushRange, nextRange)) {
        return;
      }

      setBrushRange(nextRange);
      setTimeWindowValue('custom');
      setFollowRealtime(false);
    },
    [effectiveBrushRange, fullChartData.length]
  );

  const renderLegend = useCallback((props: LegendContentProps) => {
    const payload = props.payload ?? [];

    return (
      <div className="temperature-chart-legend">
        {payload.map((entry: LegendPayload) => (
          <button
            className="temperature-chart-legend-item"
            key={String(getLegendDataKey(entry) ?? entry.value)}
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
  }, []);

  const isBrushZoomed =
    effectiveBrushRange !== null &&
    fullChartData.length > 0 &&
    (effectiveBrushRange.startIndex > 0 ||
      effectiveBrushRange.endIndex < fullChartData.length - 1 ||
      timeWindowValue !== 'all');

  return (
    <section className="temperature-chart" aria-label="Biểu đồ nhiệt độ - độ ẩm">
      <div className="temperature-chart-toolbar">
        <Space className="temperature-chart-toolbar-controls" wrap>
          <Segmented<TimeWindowValue>
            options={timeWindowOptions}
            onChange={handleTimeWindowChange}
            size="small"
            value={timeWindowValue}
          />
          <Switch
            checked={followRealtime}
            checkedChildren="Theo dõi"
            onChange={handleFollowRealtimeChange}
            size="small"
            unCheckedChildren="Tạm dừng"
          />
          {isBrushZoomed && (
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
          data={fullChartData}
          margin={{ top: 16, right: showHumidity ? 28 : 16, bottom: 44, left: 8 }}
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

          {showTemperature &&
            visibleTemperatureProbeIndexes.map(index => {
              return (
                <Line
                  connectNulls
                  dataKey={`probeTemp${index}`}
                  dot={showPointDots ? { r: 2.5 } : false}
                  isAnimationActive={false}
                  key={`probe-temp-${index}`}
                  name={`Đầu đo ${index + 1}`}
                  stroke={PROBE_COLORS[index]}
                  strokeWidth={3}
                  type="monotone"
                  yAxisId="temperature"
                />
              );
            })}

          {showHumidity && (
            <Line
              activeDot={false}
              connectNulls
              dataKey="avgHumidity"
              dot={false}
              isAnimationActive={false}
              legendType="none"
              name="Trung bình độ ẩm"
              stroke={averageLineColor}
              strokeDasharray="8 5"
              strokeOpacity={0.9}
              strokeWidth={2.5}
              type="monotone"
              yAxisId="humidity"
            />
          )}

          {showHumidity && (
            <>
              {visibleHumidityProbeIndexes.map(index => (
                <Line
                  activeDot={false}
                  connectNulls
                  dataKey={`probeHum${index}`}
                  dot={false}
                  isAnimationActive={false}
                  key={`probe-hum-${index}`}
                  legendType="none"
                  name={`Độ ẩm ${index + 1}`}
                  stroke={PROBE_COLORS[index]}
                  strokeDasharray="6 5"
                  strokeOpacity={0.9}
                  strokeWidth={2.2}
                  type="monotone"
                  yAxisId="humidity"
                />
              ))}
            </>
          )}

          {effectiveBrushRange !== null && (
            <Brush
              dataKey="timestamp"
              endIndex={effectiveBrushRange.endIndex}
              height={28}
              onChange={handleBrushChange}
              startIndex={effectiveBrushRange.startIndex}
              stroke="#1677ff"
              tickFormatter={value => formatTime(Number(value))}
              travellerWidth={10}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}
