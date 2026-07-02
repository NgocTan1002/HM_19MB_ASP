import { memo, useCallback, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Popconfirm,
  Space,
  Spin,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { calibrationApi } from '../../services/api';
import type { CalibrationResultRow, ChiTietLanDo } from '../../types/models';
import './CalibrationResultsTable.css';

const { Text } = Typography;

interface CalibrationResultsTableProps {
  sessionId: number;
  rows: CalibrationResultRow[];
  loading: boolean;
  onEdit: (row: CalibrationResultRow) => void;
  onDelete: (row: CalibrationResultRow) => Promise<void>;
  onRefresh: () => Promise<void>;
  editingStt?: number | null;
  editingDaiLuong?: string | null;
}

interface DetailRow {
  key: number;
  lanDo: number;
  values: (number | null)[];
  chiThiUut: number | null;
}

function formatNumber(value: number | null | undefined, digits = 4): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(digits)
    : '---';
}

function getDeltaColor(value: number): string {
  const absolute = Math.abs(value);

  if (absolute <= 0.5) {
    return '#389e0d';
  }

  if (absolute <= 1.0) {
    return '#d48806';
  }

  return '#cf1322';
}

function normalizeChannelCount(rows: CalibrationResultRow[]): number {
  return Math.max(
    1,
    rows.reduce((max, row) => Math.max(max, row.soKenh || 0), 0)
  );
}

function getRowUnit(row: CalibrationResultRow): string {
  return row.unit ?? (row.daiLuong === 'DoAm' ? '%RH' : '\u00B0C');
}

function getQuantityLabel(row: CalibrationResultRow): string {
  return row.tenDaiLuong ?? (row.daiLuong === 'DoAm' ? 'Do am' : 'Nhiet do');
}

function buildDetailRows(details: ChiTietLanDo[], channelCount: number): DetailRow[] {
  const rowsByLanDo = new Map<number, DetailRow>();

  details.forEach((detail) => {
    const existing =
      rowsByLanDo.get(detail.lanDo) ??
      {
        key: detail.lanDo,
        lanDo: detail.lanDo,
        values: Array.from({ length: channelCount }, () => null),
        chiThiUut: detail.chiThiUut ?? null,
      };

    if (detail.kenhValues !== undefined) {
      detail.kenhValues.slice(0, channelCount).forEach((value, index) => {
        existing.values[index] = value;
      });
    } else if (detail.kenh >= 1 && detail.kenh <= channelCount) {
      existing.values[detail.kenh - 1] = detail.giaTri;
    }

    if (detail.chiThiUut !== undefined) {
      existing.chiThiUut = detail.chiThiUut;
    }

    rowsByLanDo.set(detail.lanDo, existing);
  });

  return Array.from(rowsByLanDo.values()).sort((a, b) => a.lanDo - b.lanDo);
}

function CalibrationResultsTable({
  sessionId,
  rows,
  loading,
  onEdit,
  onDelete,
  onRefresh,
  editingStt,
  editingDaiLuong,
}: CalibrationResultsTableProps) {
  const [detailCache, setDetailCache] = useState<Map<number, ChiTietLanDo[]>>(
    () => new Map()
  );
  const [loadingDetailIds, setLoadingDetailIds] = useState<Set<number>>(
    () => new Set()
  );

  const maxChannels = useMemo(() => normalizeChannelCount(rows), [rows]);
  const hasRows = rows.length > 0;
  const resultUnit = useMemo(() => {
    const units = Array.from(new Set(rows.map(getRowUnit)));
    return units.length === 1 ? units[0] : 'mixed';
  }, [rows]);

  const handleEdit = useCallback(
    (row: CalibrationResultRow) => {
      onEdit(row);
    },
    [onEdit]
  );

  const handleDelete = useCallback(
    async (row: CalibrationResultRow) => {
      await onDelete(row);
      await onRefresh();
    },
    [onDelete, onRefresh]
  );

  const handleExpand = useCallback(
    async (expanded: boolean, row: CalibrationResultRow) => {
      if (!expanded || row.id === undefined || detailCache.has(row.id)) {
        return;
      }

      setLoadingDetailIds((current) => {
        const next = new Set(current);
        next.add(row.id as number);
        return next;
      });

      try {
        const response = await calibrationApi.getChiTiet(sessionId, row.id);
        setDetailCache((current) => {
          const next = new Map(current);
          next.set(row.id as number, response.data);
          return next;
        });
      } finally {
        setLoadingDetailIds((current) => {
          const next = new Set(current);
          next.delete(row.id as number);
          return next;
        });
      }
    },
    [detailCache, sessionId]
  );

  const renderDetailTable = useCallback(
    (row: CalibrationResultRow) => {
      if (row.id === undefined || loadingDetailIds.has(row.id)) {
        return (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <Spin />
          </div>
        );
      }

      const details = detailCache.get(row.id) ?? [];
      const detailRows = buildDetailRows(details, row.soKenh || maxChannels);
      const channelCount = Math.max(1, row.soKenh || maxChannels);

      const detailColumns: TableColumnsType<DetailRow> = [
        {
          title: 'Lần đo',
          dataIndex: 'lanDo',
          key: 'lanDo',
          width: 90,
        },
        ...Array.from({ length: channelCount }, (_item, index) => ({
          title: `Kênh ${index + 1}`,
          key: `detail-channel-${index + 1}`,
          width: 100,
          align: 'right' as const,
          render: (_value: unknown, detailRow: DetailRow) =>
            formatNumber(detailRow.values[index], 4),
        })),
        {
          title: 't_tn TB',
          key: 'chiThiUut',
          width: 110,
          align: 'right',
          render: (_value, detailRow) => formatNumber(detailRow.chiThiUut, 3),
        },
      ];

      return (
        <Table<DetailRow>
          columns={detailColumns}
          dataSource={detailRows}
          pagination={false}
          rowKey="key"
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có chi tiết lần đo"
              />
            ),
          }}
        />
      );
    },
    [detailCache, loadingDetailIds, maxChannels]
  );

  const columns = useMemo<TableColumnsType<CalibrationResultRow>>(() => {
    const channelColumns: TableColumnsType<CalibrationResultRow> = Array.from(
      { length: maxChannels },
      (_item, index) => ({
        title: `Kênh ${index + 1}`,
        key: `channel-${index + 1}`,
        width: 90,
        align: 'right',
        render: (_value, row) => formatNumber(row.kenh[index], 4),
      })
    );

    return [
      {
        title: 'STT',
        dataIndex: 'stt',
        key: 'stt',
        width: 60,
        fixed: hasRows ? 'left' : undefined,
      },
      {
        title: `Dai luong (${resultUnit})`,
        key: 'daiLuong',
        width: 95,
        fixed: hasRows ? 'left' : undefined,
        render: (_value, row) => getQuantityLabel(row),
      },
      {
        title: 'Giá trị đặt',
        dataIndex: 'giaTriDat',
        key: 'giaTriDat',
        width: 110,
        fixed: hasRows ? 'left' : undefined,
        align: 'right',
        render: (value: number) => formatNumber(value, 4),
      },
      {
        title: 'Chỉ thị TB',
        dataIndex: 'giaTriChiThi',
        key: 'giaTriChiThi',
        width: 110,
        fixed: hasRows ? 'left' : undefined,
        align: 'right',
        render: (value: number) => formatNumber(value, 4),
      },
      ...channelColumns,
      {
          title: 'Trung bình (°C)',
        dataIndex: 'giaTriTrungBinh',
        key: 'giaTriTrungBinh',
        width: 100,
        align: 'right',
        render: (value: number) => formatNumber(value, 4),
      },
      {
        title: 'Số hiệu chính (°C)',
        dataIndex: 'soHieuChinh',
        key: 'soHieuChinh',
        width: 90,
        align: 'right',
        render: (value: number) => (
          <Text style={{ color: getDeltaColor(value) }}>
            {formatNumber(value, 4)}
          </Text>
        ),
      },
      {
        title: 'Độ ổn định (°C)',
        dataIndex: 'doOnDinh',
        key: 'doOnDinh',
        width: 90,
        align: 'right',
        render: (value: number) => formatNumber(value, 4),
      },
      {
        title: 'Độ đồng đều (°C)',
        dataIndex: 'doDongDeu',
        key: 'doDongDeu',
        width: 90,
        align: 'right',
        render: (value: number) => formatNumber(value, 4),
      },
      {
        title: 'ĐKĐB mở rộng (°C)',
        dataIndex: 'doKhongDamBao',
        key: 'doKhongDamBao',
        width: 90,
        align: 'right',
        render: (value: number) => formatNumber(value, 4),
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 140,
        fixed: hasRows ? 'right' : undefined,
        render: (_value, row) => (
          <Space size={4}>
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEdit(row)}
              size="small"
              type="text"
            />
            <Popconfirm
              title="Xóa điểm kiểm tra này?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleDelete(row)}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                type="text"
              />
            </Popconfirm>
          </Space>
        ),
      },
    ];
  }, [handleDelete, handleEdit, hasRows, maxChannels, resultUnit]);

  const tableScroll = useMemo(
    () => (hasRows ? { x: 995 + maxChannels * 90 } : undefined),
    [hasRows, maxChannels]
  );

  return (
    <>
      <Table<CalibrationResultRow>
        columns={columns}
        dataSource={rows}
        expandable={{
          expandedRowRender: renderDetailTable,
          onExpand: (expanded, row) => {
            void handleExpand(expanded, row);
          },
          rowExpandable: (row) => row.id !== undefined,
        }}
        loading={loading}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có điểm kiểm tra nào"
            />
          ),
        }}
        pagination={false}
        rowClassName={(row) =>
          row.stt === editingStt &&
          (editingDaiLuong === null ||
            editingDaiLuong === undefined ||
            row.daiLuong === editingDaiLuong)
            ? 'calibration-results-editing-row'
            : ''
        }
        rowKey={(row) => row.id ?? `stt-${row.stt}`}
        rootClassName={!hasRows ? 'calibration-results-empty' : undefined}
        scroll={tableScroll}
        size="small"
      />
    </>
  );
}

export default memo(CalibrationResultsTable);
