import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  message,
  Popconfirm,
  Row,
  Skeleton,
  Space,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AutoCaptureControl from '../components/calibration/AutoCaptureControl';
import CalibrationForm, {
  type CalibrationFormHandle,
} from '../components/calibration/CalibrationForm';
import UncertaintyBudgetTable from '../components/calibration/UncertaintyBudgetTable';
import { useSession } from '../contexts/useSession';
import { calibrationApi } from '../services/api';
import type { CalibrationResultRow, UncertaintyResult } from '../types/models';

const { Title } = Typography;

type EditorMode = 'add' | 'edit';

interface ActiveEditor {
  mode: EditorMode;
  stt: number;
  giaTriDat: number;
  initialRow: CalibrationResultRow | null;
}

function formatNumber(value: number | undefined, digits = 4): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(digits)
    : '---';
}

function parseSessionId(paramId: string | undefined, fallbackId: number | null): number | null {
  if (paramId !== undefined) {
    const parsed = Number(paramId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return fallbackId;
}

function getMaxStt(rows: CalibrationResultRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.stt), 0);
}

function getMaxChannels(rows: CalibrationResultRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.soKenh || 0), 0);
}

export default function Calibration() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentSessionId } = useSession();
  const sessionId = parseSessionId(id, currentSessionId);
  const formRef = useRef<CalibrationFormHandle | null>(null);

  const [rows, setRows] = useState<CalibrationResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [latestResult, setLatestResult] = useState<UncertaintyResult | null>(null);
  const [activeTargetTemp, setActiveTargetTemp] = useState(0);
  const [activeJ, setActiveJ] = useState(3);
  const activeEditorStt = activeEditor?.stt;

  const loadResults = useCallback(async () => {
    if (sessionId === null) {
      return;
    }

    setLoading(true);
    try {
      const response = await calibrationApi.getBySession(sessionId);
      setRows(response.data);
    } catch (error) {
      console.error('[Calibration] Load results failed:', error);
      message.error('Không tải được bảng kết quả hiệu chuẩn');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (sessionId === null) {
        return;
      }

      setLoading(true);
      try {
        const response = await calibrationApi.getBySession(sessionId);
        if (!cancelled) {
          setRows(response.data);
        }
      } catch (error) {
        console.error('[Calibration] Load results failed:', error);
        if (!cancelled) {
          message.error('Không tải được bảng kết quả hiệu chuẩn');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleAdd = useCallback(() => {
    const nextStt = getMaxStt(rows) + 1;
    const nextGiaTriDat = rows.length > 0 ? rows[rows.length - 1].giaTriDat : 0;

    setLatestResult(null);
    setActiveTargetTemp(nextGiaTriDat);
    setActiveJ(3);
    setActiveEditor({
      mode: 'add',
      stt: nextStt,
      giaTriDat: nextGiaTriDat,
      initialRow: null,
    });
  }, [rows]);

  const handleEdit = useCallback(
    async (row: CalibrationResultRow) => {
      if (sessionId === null) {
        return;
      }

      if (row.id === undefined) {
        message.error('Không tìm thấy ID kết quả để tải chi tiết');
        return;
      }

      setLoadingEditor(true);
      try {
        const response = await calibrationApi.getChiTiet(sessionId, row.id);
        const completeRow: CalibrationResultRow = {
          ...row,
          chiTietLanDos: response.data,
        };

        setLatestResult(null);
        setActiveTargetTemp(row.giaTriDat);
        setActiveJ(row.soKenh || 3);
        setActiveEditor({
          mode: 'edit',
          stt: row.stt,
          giaTriDat: row.giaTriDat,
          initialRow: completeRow,
        });
      } catch (error) {
        console.error('[Calibration] Load result details failed:', error);
        message.error('Không tải được chi tiết lần đo');
      } finally {
        setLoadingEditor(false);
      }
    },
    [sessionId]
  );

  const handleDelete = useCallback(
    async (stt: number) => {
      if (sessionId === null) {
        return;
      }

      try {
        await calibrationApi.delete(sessionId, stt);
        message.success('Đã xóa kết quả hiệu chuẩn');
        if (activeEditorStt === stt) {
          setActiveEditor(null);
          setLatestResult(null);
        }
        await loadResults();
      } catch (error) {
        console.error('[Calibration] Delete failed:', error);
        message.error('Không xóa được kết quả hiệu chuẩn');
      }
    },
    [activeEditorStt, loadResults, sessionId]
  );

  const handleSaved = useCallback(
    async (row: CalibrationResultRow) => {
      if (sessionId === null) {
        return;
      }

      setSaving(true);
      try {
        await calibrationApi.save(sessionId, row);
        await loadResults();
        setActiveEditor(null);
        setLatestResult(null);
        message.success('Đã lưu kết quả hiệu chuẩn');
      } catch (error) {
        console.error('[Calibration] Save failed:', error);
        message.error('Không lưu được kết quả hiệu chuẩn');
      } finally {
        setSaving(false);
      }
    },
    [loadResults, sessionId]
  );

  const handleCancel = useCallback(() => {
    setActiveEditor(null);
    setLatestResult(null);
  }, []);

  const handleAutoCapture = useCallback((vals: number[], chiThi: number) => {
    formRef.current?.appendMeasurement(vals, chiThi);
  }, []);

  const maxChannels = useMemo(() => Math.max(getMaxChannels(rows), 1), [rows]);

  const columns = useMemo<TableColumnsType<CalibrationResultRow>>(() => {
    const channelColumns: TableColumnsType<CalibrationResultRow> = Array.from(
      { length: maxChannels },
      (_item, index) => ({
        title: `Kênh ${index + 1}`,
        key: `kenh-${index + 1}`,
        width: 90,
        align: 'right',
        render: (_value, row) => formatNumber(row.kenh[index]),
      })
    );

    return [
      {
        title: 'STT',
        dataIndex: 'stt',
        key: 'stt',
        width: 70,
        sorter: (a, b) => a.stt - b.stt,
      },
      {
        title: 'Giá trị đặt',
        dataIndex: 'giaTriDat',
        key: 'giaTriDat',
        width: 120,
        align: 'right',
        render: (value: number) => formatNumber(value),
      },
      {
        title: 'Chỉ thị TB',
        dataIndex: 'giaTriChiThi',
        key: 'giaTriChiThi',
        width: 120,
        align: 'right',
        render: (value: number) => formatNumber(value),
      },
      ...channelColumns,
      {
        title: 't̄_ch',
        dataIndex: 'giaTriTrungBinh',
        key: 'giaTriTrungBinh',
        width: 110,
        align: 'right',
        render: (value: number) => formatNumber(value),
      },
      {
        title: 'Δt',
        dataIndex: 'soHieuChinh',
        key: 'soHieuChinh',
        width: 100,
        align: 'right',
        render: (value: number) => formatNumber(value),
      },
      {
        title: 'δt_od',
        dataIndex: 'doOnDinh',
        key: 'doOnDinh',
        width: 100,
        align: 'right',
        render: (value: number) => formatNumber(value),
      },
      {
        title: 'δt_dd',
        dataIndex: 'doDongDeu',
        key: 'doDongDeu',
        width: 100,
        align: 'right',
        render: (value: number) => formatNumber(value),
      },
      {
        title: 'U',
        dataIndex: 'doKhongDamBao',
        key: 'doKhongDamBao',
        width: 100,
        align: 'right',
        render: (value: number) => formatNumber(value),
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 130,
        render: (_value, row) => (
          <Space size={4}>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => void handleEdit(row)}
            >
              Sửa
            </Button>
            <Popconfirm
              title="Xóa kết quả này?"
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleDelete(row.stt)}
            >
              <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];
  }, [handleDelete, handleEdit, maxChannels]);

  if (sessionId === null) {
    return (
      <Empty description="Chọn phiên đo trước">
        <Button type="primary" onClick={() => navigate('/sessions')}>
          Đến trang phiên đo
        </Button>
      </Empty>
    );
  }

  return (
    <section>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title={<Title level={4}>Bảng kết quả hiệu chuẩn</Title>}
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                Thêm điểm đo mới
              </Button>
            }
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <Table<CalibrationResultRow>
                rowKey={(row) => `${row.stt}-${row.id ?? 'new'}`}
                columns={columns}
                dataSource={rows}
                pagination={false}
                size="small"
                scroll={{ x: 870 + maxChannels * 90 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          {activeEditor !== null ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <AutoCaptureControl
                sessionId={sessionId}
                j={activeJ}
                targetTemp={activeTargetTemp}
                tolerance={0.5}
                onCapture={handleAutoCapture}
                disabled={saving || loadingEditor}
              />

              {loadingEditor ? (
                <Skeleton active paragraph={{ rows: 10 }} />
              ) : (
                <CalibrationForm
                  key={`${activeEditor.mode}-${activeEditor.stt}`}
                  ref={formRef}
                  sessionId={sessionId}
                  stt={activeEditor.stt}
                  giaTriDat={activeEditor.giaTriDat}
                  initialRow={activeEditor.initialRow}
                  onSaved={handleSaved}
                  onCancel={handleCancel}
                  onResultChange={setLatestResult}
                  onGiaTriDatChange={setActiveTargetTemp}
                  onJChange={setActiveJ}
                />
              )}

              {latestResult !== null ? (
                <UncertaintyBudgetTable
                  result={latestResult}
                  j={activeJ}
                  useUMethod={latestResult.calculationMethod !== 'Delta'}
                />
              ) : null}
            </Space>
          ) : null}
        </Col>
      </Row>
    </section>
  );
}
