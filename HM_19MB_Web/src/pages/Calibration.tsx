import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  message,
  Row,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AutoCaptureControl from '../components/calibration/AutoCaptureControl';
import CalibrationForm, {
  type CalibrationFormHandle,
} from '../components/calibration/CalibrationForm';
import CalibrationResultsTable from '../components/calibration/CalibrationResultsTable';
import { ExportButtons } from '../components/calibration/ExportButtons';
import UncertaintyBudgetTable from '../components/calibration/UncertaintyBudgetTable';
import { useSession } from '../contexts/useSession';
import { calibrationApi } from '../services/api';
import type { CalibrationResultRow, UncertaintyResult } from '../types/models';

const { Title } = Typography;

interface ActiveEditor {
  mode: 'add' | 'edit';
  stt: number;
  giaTriDat: number;
  initialRow: CalibrationResultRow | null;
}

function parseSessionId(
  paramId: string | undefined,
  fallbackId: number | null
): number | null {
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
      setRows([]);
      setActiveEditor(null);
      setLoadingEditor(false);
      setSaving(false);
      setLatestResult(null);
      setActiveTargetTemp(0);
      setActiveJ(3);

      if (sessionId === null) {
        setLoading(false);
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

  const maxChannels = useMemo(() => {
    const max = getMaxChannels(rows);
    return max > 0 ? max : 3;
  }, [rows]);

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
        const details = await calibrationApi.getChiTiet(sessionId, row.id);
        setLatestResult(null);
        setActiveTargetTemp(row.giaTriDat);
        setActiveJ(row.soKenh || 3);
        setActiveEditor({
          mode: 'edit',
          stt: row.stt,
          giaTriDat: row.giaTriDat,
          initialRow: {
            ...row,
            chiTietLanDos: details.data,
          },
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
        if (activeEditor?.stt === stt) {
          setActiveEditor(null);
          setLatestResult(null);
        }
        await loadResults();
        message.success('Đã xóa');
      } catch (error) {
        console.error('[Calibration] Delete failed:', error);
        message.error('Không xóa được kết quả hiệu chuẩn');
      }
    },
    [activeEditor, loadResults, sessionId]
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

  const handleGoToSessions = useCallback(() => {
    navigate('/sessions');
  }, [navigate]);

  if (sessionId === null) {
    return (
      <Empty description="Chọn phiên đo trước">
        <Button type="primary" onClick={handleGoToSessions}>
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
              <Space wrap>
                <ExportButtons sessionId={sessionId} kenhCount={maxChannels} />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                >
                  Thêm điểm đo mới
                </Button>
              </Space>
            }
          >
            <CalibrationResultsTable
              sessionId={sessionId}
              rows={rows}
              loading={loading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRefresh={loadResults}
              editingStt={activeEditor?.stt}
            />
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
