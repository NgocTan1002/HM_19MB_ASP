import { Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { memo, useMemo } from 'react';
import type { MeasurementBlock } from '../../types/models';
import './ProbeDataTable.css';

interface ProbeDataTableProps {
  block: MeasurementBlock | null;
  showTemperature: boolean;
  showHumidity: boolean;
}

type ProbeRowKind = 'probe' | 'average' | 'uniformity' | 'stability';

interface ProbeRow {
  key: string;
  stt: string;
  name: string;
  kind: ProbeRowKind;
  temperature: number | null;
  humidity: number | null;
  timestamp: string | null;
}

const { Text } = Typography;

function isValidNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toNullableNumber(value: number | undefined): number | null {
  return isValidNumber(value) ? value : null;
}

function formatTemperature(value: number | null): string {
  return value === null ? '---' : value.toFixed(2);
}

function formatHumidity(value: number | null): string {
  return value === null ? '---' : value.toFixed(1);
}

function formatTime(timestamp: string | null): string {
  if (timestamp === null) {
    return '---';
  }

  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    return '---';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(parsed));
}

function buildRows(block: MeasurementBlock | null): ProbeRow[] {
  const probeCount = block === null ? 0 : Math.max(0, Math.min(block.probeCount, 10));
  const avgTemperature = block === null ? null : toNullableNumber(block.avgTemperature);
  const avgHumidity = block === null ? null : toNullableNumber(block.avgHumidity);
  const uniformityTemp = block === null ? null : toNullableNumber(block.uniformityTemp);
  const uniformityHumidity =
    block === null ? null : toNullableNumber(block.uniformityHumidity);
  const timestamp = block?.timestamp ?? null;

  const probeRows = Array.from({ length: 10 }, (_, index): ProbeRow => {
    const isActiveProbe = block !== null && index < probeCount;
    const temperature = isActiveProbe
      ? toNullableNumber(block.probeTemperatures[index])
      : null;
    const humidity = isActiveProbe ? toNullableNumber(block.probeHumidities[index]) : null;
    const hasAnyValue = temperature !== null || humidity !== null;

    return {
      key: `probe-${index + 1}`,
      stt: String(index + 1),
      name: `Đầu đo ${index + 1}`,
      kind: 'probe',
      temperature,
      humidity,
      timestamp: hasAnyValue ? timestamp : null,
    };
  });

  return [
    ...probeRows,
    {
      key: 'average',
      stt: '11',
      name: 'Trung bình',
      kind: 'average',
      temperature: avgTemperature,
      humidity: avgHumidity,
      timestamp,
    },
    {
      key: 'uniformity',
      stt: '12',
      name: 'Độ đồng đều',
      kind: 'uniformity',
      temperature: uniformityTemp,
      humidity: uniformityHumidity,
      timestamp,
    },
    {
      key: 'stability',
      stt: '13',
      name: 'Độ ổn định',
      kind: 'stability',
      temperature: null,
      humidity: null,
      timestamp,
    },
  ];
}

function ProbeDataTable({
  block,
  showTemperature,
  showHumidity,
}: ProbeDataTableProps) {
  const rows = useMemo(() => buildRows(block), [block]);

  const hasHumidity = useMemo(
    () =>
      showHumidity ||
      rows.some(row => row.humidity !== null) ||
      (block !== null && block.stabilityHumidity.trim() !== '---'),
    [block, rows, showHumidity]
  );

  const columns = useMemo<ColumnsType<ProbeRow>>(() => {
    const tableColumns: ColumnsType<ProbeRow> = [
      {
        title: 'STT',
        dataIndex: 'stt',
        key: 'stt',
        width: 48,
        render: (value: ProbeRow['stt']) => (
          <Text aria-label={`STT ${value}`}>{value}</Text>
        ),
      },
      {
        title: 'Đầu đo',
        dataIndex: 'name',
        key: 'name',
        width: 116,
        ellipsis: true,
        render: (value: ProbeRow['name'], row) => (
          <Text aria-label={`Dòng ${value}`} strong={row.kind !== 'probe'}>
            {value}
          </Text>
        ),
      },
    ];

    if (showTemperature) {
      tableColumns.push({
        title: 'Nhiệt độ (°C)',
        dataIndex: 'temperature',
        key: 'temperature',
        align: 'right',
        width: 96,
        render: (value: ProbeRow['temperature'], row) => {
          const displayValue =
            row.kind === 'stability' && block !== null
              ? block.stabilityTemperature
              : formatTemperature(value);

          return (
            <span
              aria-label={`${row.name} nhiệt độ ${displayValue}`}
              className="probe-value-cell"
            >
              {displayValue}
            </span>
          );
        },
      });
    }

    if (hasHumidity) {
      tableColumns.push({
        title: 'Độ ẩm (%)',
        dataIndex: 'humidity',
        key: 'humidity',
        align: 'right',
        width: 86,
        render: (value: ProbeRow['humidity'], row) => {
          const displayValue =
            row.kind === 'stability' && block !== null
              ? block.stabilityHumidity
              : formatHumidity(value);

          return (
            <span
              aria-label={`${row.name} độ ẩm ${displayValue}`}
              className="probe-value-cell"
            >
              {displayValue}
            </span>
          );
        },
      });
    }

    tableColumns.push({
      title: 'Thời gian',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 92,
      render: (value: ProbeRow['timestamp'], row) => {
        const displayValue = formatTime(value);

        return (
          <span
            aria-label={`${row.name} thời gian ${displayValue}`}
            className="probe-value-cell"
          >
            {displayValue}
          </span>
        );
      },
    });

    return tableColumns;
  }, [block, hasHumidity, showTemperature]);

  return (
    <div className="probe-data-table" aria-label="Bảng dữ liệu đầu đo real-time">
      <Table<ProbeRow>
        columns={columns}
        dataSource={rows}
        pagination={false}
        rowKey="key"
        scroll={{ y: 580 }}
        size="small"
        tableLayout="fixed"
        virtual
      />
    </div>
  );
}

export default memo(ProbeDataTable);
