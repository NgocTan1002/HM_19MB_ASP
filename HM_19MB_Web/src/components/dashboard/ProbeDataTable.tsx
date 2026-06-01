import {
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleFilled,
  WarningFilled,
} from '@ant-design/icons';
import { Skeleton, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { memo, useMemo } from 'react';
import type { MeasurementBlock } from '../../types/models';

interface ProbeDataTableProps {
  block: MeasurementBlock | null;
  showHumidity: boolean;
  showProbes?: boolean[];
  highlightProbeIndex?: number;
  onProbeSelect?: (index: number) => void;
}

type ProbeRowKind = 'probe' | 'average' | 'uniformity' | 'stability';
type DeltaStatus = 'ok' | 'warning' | 'danger' | 'none';

interface ProbeRow {
  key: string;
  stt: string;
  name: string;
  kind: ProbeRowKind;
  probeIndex: number | null;
  temperature: number | null;
  humidity: number | null;
  deltaTemperature: number | null;
  status: DeltaStatus;
  isMaxDelta: boolean;
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

function formatDelta(value: number | null): string {
  if (value === null) {
    return '---';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function getDeltaStatus(deltaTemperature: number | null): DeltaStatus {
  if (deltaTemperature === null) {
    return 'none';
  }

  const absDelta = Math.abs(deltaTemperature);

  if (absDelta <= 0.5) {
    return 'ok';
  }

  if (absDelta <= 1.0) {
    return 'warning';
  }

  return 'danger';
}

function renderStatus(status: DeltaStatus) {
  if (status === 'ok') {
    return (
      <Tag
        aria-label="Trạng thái ổn định"
        className="probe-status-tag"
        color="success"
        icon={<CheckCircleFilled />}
      >
        Xanh
      </Tag>
    );
  }

  if (status === 'warning') {
    return (
      <Tag
        aria-label="Trạng thái cảnh báo"
        className="probe-status-tag"
        color="warning"
        icon={<WarningFilled />}
      >
        Vàng
      </Tag>
    );
  }

  if (status === 'danger') {
    return (
      <Tag
        aria-label="Trạng thái vượt ngưỡng"
        className="probe-status-tag"
        color="error"
        icon={<CloseCircleFilled />}
      >
        Đỏ
      </Tag>
    );
  }

  return (
    <Tag
      aria-label="Không có trạng thái"
      className="probe-status-tag"
      icon={<MinusCircleFilled />}
    >
      ---
    </Tag>
  );
}

function buildRows(block: MeasurementBlock): ProbeRow[] {
  const probeCount = Math.max(0, Math.min(block.probeCount, 10));
  const avgTemperature = toNullableNumber(block.avgTemperature);
  const avgHumidity = toNullableNumber(block.avgHumidity);
  const uniformityTemp = toNullableNumber(block.uniformityTemp);
  const uniformityHumidity = toNullableNumber(block.uniformityHumidity);

  const probeRows = Array.from({ length: 10 }, (_, index): ProbeRow => {
    const isActiveProbe = index < probeCount;
    const temperature = isActiveProbe
      ? toNullableNumber(block.probeTemperatures[index])
      : null;
    const humidity = isActiveProbe
      ? toNullableNumber(block.probeHumidities[index])
      : null;
    const deltaTemperature =
      temperature !== null && avgTemperature !== null
        ? temperature - avgTemperature
        : null;

    return {
      key: `probe-${index + 1}`,
      stt: String(index + 1),
      name: `Đầu đo ${index + 1}`,
      kind: 'probe',
      probeIndex: index,
      temperature,
      humidity,
      deltaTemperature,
      status: getDeltaStatus(deltaTemperature),
      isMaxDelta: false,
    };
  });

  const maxDelta = probeRows.reduce<number | null>((currentMax, row) => {
    if (row.deltaTemperature === null) {
      return currentMax;
    }

    const absDelta = Math.abs(row.deltaTemperature);
    return currentMax === null || absDelta > currentMax ? absDelta : currentMax;
  }, null);

  const rowsWithMaxDelta = probeRows.map(row => ({
    ...row,
    isMaxDelta:
      maxDelta !== null &&
      row.deltaTemperature !== null &&
      Math.abs(row.deltaTemperature) === maxDelta,
  }));

  return [
    ...rowsWithMaxDelta,
    {
      key: 'average',
      stt: '11',
      name: 'Trung bình',
      kind: 'average',
      probeIndex: null,
      temperature: avgTemperature,
      humidity: avgHumidity,
      deltaTemperature: null,
      status: 'none',
      isMaxDelta: false,
    },
    {
      key: 'uniformity',
      stt: '12',
      name: 'Độ đồng đều',
      kind: 'uniformity',
      probeIndex: null,
      temperature: uniformityTemp,
      humidity: uniformityHumidity,
      deltaTemperature: null,
      status: 'none',
      isMaxDelta: false,
    },
    {
      key: 'stability',
      stt: '13',
      name: 'Độ ổn định',
      kind: 'stability',
      probeIndex: null,
      temperature: null,
      humidity: null,
      deltaTemperature: null,
      status: 'none',
      isMaxDelta: false,
    },
  ];
}

function ProbeDataTable({
  block,
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

  const hasHumidity = useMemo(
    () => rows.some(row => row.humidity !== null),
    [rows]
  );

  const columns = useMemo<ColumnsType<ProbeRow>>(() => {
    const tableColumns: ColumnsType<ProbeRow> = [
      {
        title: 'STT',
        dataIndex: 'stt',
        key: 'stt',
        width: 72,
        render: (value: ProbeRow['stt']) => (
          <Text aria-label={`STT ${value}`}>{value}</Text>
        ),
      },
      {
        title: 'Tên',
        dataIndex: 'name',
        key: 'name',
        width: 180,
        render: (value: ProbeRow['name'], row) => (
          <Text
            aria-label={`Tên dòng ${value}`}
            strong={row.kind !== 'probe'}
          >
            {value}
          </Text>
        ),
      },
      {
        title: 'Nhiệt độ (°C)',
        dataIndex: 'temperature',
        key: 'temperature',
        align: 'right',
        width: 150,
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
      },
    ];

    if (showHumidity && hasHumidity) {
      tableColumns.push({
        title: 'Độ ẩm (%)',
        dataIndex: 'humidity',
        key: 'humidity',
        align: 'right',
        width: 140,
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

    tableColumns.push(
      {
        title: 'Delta T (°C)',
        dataIndex: 'deltaTemperature',
        key: 'deltaTemperature',
        align: 'right',
        width: 140,
        render: (value: ProbeRow['deltaTemperature'], row) => (
          <span
            aria-label={`${row.name} delta T ${formatDelta(value)}`}
            className={`probe-value-cell probe-delta-${row.status}`}
          >
            {row.kind === 'probe' ? formatDelta(value) : '---'}
          </span>
        ),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        render: (value: ProbeRow['status'], row) =>
          row.kind === 'probe' ? renderStatus(value) : renderStatus('none'),
      }
    );

    return tableColumns;
  }, [block, hasHumidity, showHumidity]);

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
            transition: color 0.3s ease, background-color 0.3s ease;
          }

          .probe-data-table .probe-delta-ok {
            color: #389e0d;
          }

          .probe-data-table .probe-delta-warning {
            color: #d48806;
          }

          .probe-data-table .probe-delta-danger {
            color: #cf1322;
          }

          .probe-data-table .probe-row-max-delta > td {
            background: #fff7e6;
          }

          .probe-data-table .probe-row-selected > td {
            background: #e6f4ff;
          }

          .probe-data-table .probe-row-clickable {
            cursor: pointer;
          }

          .probe-data-table .probe-status-tag {
            min-width: 72px;
            justify-content: center;
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

          if (row.isMaxDelta) {
            classNames.push('probe-row-max-delta');
          }

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
        size="middle"
        virtual
      />
    </div>
  );
}

export default memo(ProbeDataTable);
