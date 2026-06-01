import { Alert, Card, Space, Table, Typography, type TableColumnsType } from 'antd';
import type { UncertaintyResult } from '../../types/models';

const { Text } = Typography;

interface UncertaintyBudgetTableProps {
  result: UncertaintyResult;
  j: number;
  useUMethod: boolean;
}

interface BudgetRow {
  key: string;
  symbol: string;
  source: string;
  value: number | null;
  unit: string;
  divisor: string;
  uncertainty: number | null;
  secondary?: boolean;
  active?: boolean;
  summary?: boolean;
}

function formatValue(value: number | null | undefined, digits = 5): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(digits)
    : '---';
}

function sqrtLabel(value: number): string {
  return `√${value}`;
}

function getUch(result: UncertaintyResult): number {
  return result.uc;
}

function getUFinal(result: UncertaintyResult): number {
  return typeof result.uFinal === 'number' && Number.isFinite(result.uFinal)
    ? result.uFinal
    : result.u;
}

function renderText(row: BudgetRow, text: string) {
  if (row.summary) {
    return <Text strong>{text}</Text>;
  }

  if (row.secondary && !row.active) {
    return <Text type="secondary">{text}</Text>;
  }

  if (row.active) {
    return <Text strong>{text}</Text>;
  }

  return text;
}

export default function UncertaintyBudgetTable({
  result,
  j,
  useUMethod,
}: UncertaintyBudgetTableProps) {
  const columns: TableColumnsType<BudgetRow> = [
    {
      title: 'Ký hiệu',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      render: (value: string, row) => renderText(row, value),
    },
    {
      title: 'Nguồn',
      dataIndex: 'source',
      key: 'source',
      render: (value: string, row) => renderText(row, value),
    },
    {
      title: 'Giá trị',
      dataIndex: 'value',
      key: 'value',
      align: 'right',
      width: 120,
      render: (value: number | null, row) => renderText(row, formatValue(value)),
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      render: (value: string, row) => renderText(row, value),
    },
    {
      title: 'Hệ số chia',
      dataIndex: 'divisor',
      key: 'divisor',
      width: 110,
      render: (value: string, row) => renderText(row, value),
    },
    {
      title: 'u_i(°C)',
      dataIndex: 'uncertainty',
      key: 'uncertainty',
      align: 'right',
      width: 130,
      render: (value: number | null, row) => renderText(row, formatValue(value)),
    },
  ];

  const channelCount = Math.min(Math.max(Math.floor(j), 1), 10);
  const n = result.numberOfMeasurements;
  const channelRows: BudgetRow[] = Array.from(
    { length: channelCount },
    (_item, index) => ({
      key: `uch1-${index + 1}`,
      symbol: `u_ch1,${index + 1}`,
      source: `Độ lặp lại nguồn chuẩn kênh ${index + 1}`,
      value: result.channelStdDevs[index] ?? null,
      unit: '°C',
      divisor: sqrtLabel(n),
      uncertainty: result.channelTypeAUncertainties[index] ?? null,
    })
  );

  const uchRows: BudgetRow[] = [
    ...channelRows,
    {
      key: 'uch2-u',
      symbol: 'u_ch2(U)',
      source: 'U_max / 2',
      value: result.uMax,
      unit: '°C',
      divisor: '2',
      uncertainty: result.uch2FromU,
      secondary: true,
      active: useUMethod,
    },
    {
      key: 'uch2-delta',
      symbol: 'u_ch2(Δ)',
      source: 'Δ_max / √3',
      value: result.deltaMax,
      unit: '°C',
      divisor: '√3',
      uncertainty: result.uch2FromDelta,
      secondary: true,
      active: !useUMethod,
    },
    {
      key: 'uch',
      symbol: 'u_ch',
      source: '√(u_ch1² + u_ch2²)',
      value: null,
      unit: '°C',
      divisor: '---',
      uncertainty: getUch(result),
      summary: true,
    },
  ];

  const ubkRows: BudgetRow[] = [
    {
      key: 'ubk1',
      symbol: 'u_bk1',
      source: 'Từ độ lặp lại chỉ thị tủ',
      value: null,
      unit: '°C',
      divisor: sqrtLabel(n),
      uncertainty: result.ubk1 ?? null,
    },
    {
      key: 'ubk2',
      symbol: 'u_bk2',
      source: 'δt_od / √3',
      value: result.deltaOd ?? null,
      unit: '°C',
      divisor: '√3',
      uncertainty: result.ubk2 ?? null,
    },
    {
      key: 'ubk3',
      symbol: 'u_bk3',
      source: 'δt_dd / √3',
      value: result.deltaDd ?? null,
      unit: '°C',
      divisor: '√3',
      uncertainty: result.ubk3 ?? null,
    },
    {
      key: 'ubk4',
      symbol: 'u_bk4',
      source: 'A × d / √3',
      value: null,
      unit: '°C',
      divisor: '√3',
      uncertainty: result.ubk4 ?? null,
    },
    {
      key: 'ubk',
      symbol: 'u_bk',
      source: '√(Σu_bki²)',
      value: null,
      unit: '°C',
      divisor: '---',
      uncertainty: result.ubk ?? null,
      summary: true,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="Thành phần u_ch (nguồn chuẩn)" size="small">
        <Table<BudgetRow>
          columns={columns}
          dataSource={uchRows}
          pagination={false}
          rowKey="key"
          size="small"
        />
      </Card>

      <Card title="Thành phần u_bk (chỉ thị tủ)" size="small">
        <Table<BudgetRow>
          columns={columns}
          dataSource={ubkRows}
          pagination={false}
          rowKey="key"
          size="small"
        />
      </Card>

      <Alert
        type="info"
        showIcon
        message={`U = 2√(u_ch² + u_bk²) = ${formatValue(getUFinal(result))} °C (k=2, P=95%)`}
      />
    </Space>
  );
}
