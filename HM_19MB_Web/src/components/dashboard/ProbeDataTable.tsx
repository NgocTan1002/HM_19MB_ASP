import { Skeleton, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { memo, useMemo } from 'react';
import type { MeasurementBlock } from '../../types/models';

interface ProbeDataTableProps {
  block: MeasurementBlock | null;
  showTemperature: boolean;
  showHumidity: boolean;
  showProbes?: boolean[];
  highlightProbeIndex?: number;
  onProbeSelect?: (index: number) => void;
}

type ProbeRowKind = 'probe' | 'average' | 'uniformity' | 'stability';

interface ProbeRow {
  key: string;
  stt: string;
  name: string;
  kind: ProbeRowKind;
  probeIndex: number | null;
  temperature: number | null;
  humidity: number | null;
  timestamp: string;
}

const { Text } = Typography;

function isValidNumber(value: number | undefined): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
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

function formatTime(timestamp: string): string {
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

function buildRows(block: MeasurementBlock): ProbeRow[] {
  const probeCount = Math.max(0, Math.min(block.probeCount, 10));
  const avgTemperature = toNullableNumber(block.avgTemperature);
  const avgHumidity = toNullableNumber(block.avgHumidity);
  const uniformityTemp = toNullableNumber(block.uniformityTemp);
  const uniformityHumidity = toNullableNumber(block.uniformityHumidity);

  const probeRows = Array.from({ length: 10 }, (_, index): ProbeRow => {
    const isActiveProbe = index < probeCount;

    return {
      key: `probe-${index + 1}`,
      stt: String(index + 1),
      name: `Đầu đo ${index + 1}`,
      kind: 'probe',
      probeIndex: index,
      temperature: isActiveProbe
        ? toNullableNumber(block.probeTemperatures[index])
        : null,
      humidity: isActiveProbe ? toNullableNumber(block.probeHumidities[index]) : null,
      timestamp: block.timestamp,
    };
  });

  return [
    ...probeRows,
    {
      key: 'average',
      stt: '11',
      name: 'Trung bình',
      kind: 'average',
      probeIndex: null,
      temperature: avgTemperature,
      humidity: avgHumidity,
      timestamp: block.timestamp,
    },
    {
      key: 'uniformity',
      stt: '12',
      name: 'Độ đồng đều',
      kind: 'uniformity',
      probeIndex: null,
      temperature: uniformityTemp,
      humidity: uniformityHumidity,
      timestamp: block.timestamp,
    },
    {
      key: 'stability',
      stt: '13',
      name: 'Độ ổn định',
      kind: 'stability',
      probeIndex: null,
      temperature: null,
      humidity: null,
      timestamp: block.timestamp,
    },
  ];
}

function ProbeDataTable({
  block,
  showTemperature,
  showHumidity,
  showProbes,
  highlightProbeIndex,
  onProbeSelect,
}: ProbeDataTableProps) {
  const rows = useMemo(() => {
    if (block === null) {
      return [];
    }

    const nextRows = buildRows(block);

    if (showProbes === undefined) {
      return nextRows;
    }

    return nextRows.filter(row => {
      if (row.kind !== 'probe' || row.probeIndex === null) {
        return true;
      }

      return showProbes[row.probeIndex] !== false;
    });
  }, [block, showProbes]);

  const hasHumidity = useMemo(() => {
    if (block === null) {
      return false;
    }

    return (
      rows.some(row => row.humidity !== null) ||
      block.stabilityHumidity.trim() !== '---'
    );
  }, [block, rows]);

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

    if (showHumidity && hasHumidity) {
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
  }, [block, hasHumidity, showHumidity, showTemperature]);

  if (block === null) {
    return (
      <Skeleton
        active
        aria-label="Đang tải dữ liệu đầu đo"
        paragraph={{ rows: 10 }}
        title={false}
      />
    );
  }

  return (
    <div className="probe-data-table" aria-label="Bảng dữ liệu đầu đo real-time">
      <style>
        {`
          .probe-data-table .probe-value-cell {
            display: inline-block;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            transition: color 0.3s ease, background-color 0.3s ease;
          }

          .probe-data-table .ant-table {
            overflow-x: hidden;
          }

          .probe-data-table .ant-table-cell {
            padding: 8px 6px !important;
            white-space: nowrap;
          }

          .probe-data-table .ant-table-thead > tr > th {
            font-size: 12px;
            line-height: 1.25;
          }

          .probe-data-table .ant-table-tbody > tr > td {
            font-size: 12px;
            line-height: 1.35;
          }

          .probe-data-table .probe-row-selected > td {
            background: #e6f4ff;
          }

          .probe-data-table .probe-row-clickable {
            cursor: pointer;
          }
        `}
      </style>

      <Table<ProbeRow>
        columns={columns}
        dataSource={rows}
        onRow={row => ({
          onClick: () => {
            if (row.kind === 'probe' && row.probeIndex !== null) {
              onProbeSelect?.(row.probeIndex);
            }
          },
          'aria-label': `${row.name} row`,
        })}
        pagination={false}
        rowClassName={row => {
          const classNames: string[] = [];

          if (
            row.probeIndex !== null &&
            highlightProbeIndex === row.probeIndex
          ) {
            classNames.push('probe-row-selected');
          }

          if (row.kind === 'probe' && onProbeSelect !== undefined) {
            classNames.push('probe-row-clickable');
          }

          return classNames.join(' ');
        }}
        rowKey="key"
        scroll={{ y: 400 }}
        size="small"
        tableLayout="fixed"
        virtual
      />
    </div>
  );
}

export default memo(ProbeDataTable);
