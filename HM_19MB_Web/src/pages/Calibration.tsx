import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Empty,
  message,
  Modal,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { CloseOutlined, CompressOutlined, PlusOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AutoCaptureControl from '../components/calibration/AutoCaptureControl';
import CalibrationForm, {
  type CalibrationFormHandle,
} from '../components/calibration/CalibrationForm';
import CalibrationResultsTable from '../components/calibration/CalibrationResultsTable';
import { ExportButtons } from '../components/calibration/ExportButtons';
import UncertaintyBudgetTable from '../components/calibration/UncertaintyBudgetTable';
import { useSession } from '../contexts/useSession';
import { calibrationApi, getErrorMessage } from '../services/api';
import type { CalibrationResultRow, UncertaintyResult } from '../types/models';
import {
  clearMinimizedCalibrationDraft,
  getMinimizedCalibrationDraft,
  saveMinimizedCalibrationDraft,
  type CalibrationFormDraftState,
} from '../utils/calibrationDraft';
import './Calibration.css';

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
  const location = useLocation();
  const { id } = useParams();
  const { currentSessionId } = useSession();
  const sessionId = parseSessionId(id, currentSessionId);
  const queryClient = useQueryClient();
  const formRef = useRef<CalibrationFormHandle | null>(null);

  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [latestResult, setLatestResult] = useState<UncertaintyResult | null>(null);
  const [activeTargetTemp, setActiveTargetTemp] = useState(0);
  const [activeJ, setActiveJ] = useState(3);
  const [activeN, setActiveN] = useState(5);
  const [activeDraftState, setActiveDraftState] =
    useState<CalibrationFormDraftState | null>(null);

  const resultsQueryKey = useMemo(
    () => ['calibration-results', sessionId] as const,
    [sessionId]
  );

  const {
    data: rows = [],
    error: resultsError,
    isFetching: loading,
    refetch: refetchResults,
  } = useQuery({
    queryKey: resultsQueryKey,
    enabled: sessionId !== null,
    queryFn: async () => {
      if (sessionId === null) {
        return [];
      }
      const response = await calibrationApi.getBySession(sessionId);
      return response.data;
    },
  });

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setActiveEditor(null);
      setLoadingEditor(false);
      setLatestResult(null);
      setActiveDraftState(null);
      setActiveTargetTemp(0);
      setActiveJ(3);
      setActiveN(5);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (resultsError !== null) {
      console.error('[Calibration] Load results failed:', resultsError);
      message.error(
        getErrorMessage(resultsError, 'Không tải được bảng kết quả hiệu chuẩn')
      );
    }
  }, [resultsError]);

  const invalidateResults = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: resultsQueryKey });
  }, [queryClient, resultsQueryKey]);

  const deleteMutation = useMutation({
    mutationFn: async (stt: number) => {
      if (sessionId === null) {
        return;
      }

      await calibrationApi.delete(sessionId, stt);
    },
    onSuccess: async (_data, stt) => {
      if (activeEditor?.stt === stt) {
        setActiveEditor(null);
        setLatestResult(null);
      }

      await invalidateResults();
      message.success('Đã xóa');
    },
    onError: (error) => {
      console.error('[Calibration] Delete failed:', error);
      message.error(getErrorMessage(error, 'Không xóa được kết quả hiệu chuẩn'));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (row: CalibrationResultRow) => {
      if (sessionId === null) {
        return;
      }

      await calibrationApi.save(sessionId, row);
    },
    onSuccess: async () => {
      await invalidateResults();
      clearMinimizedCalibrationDraft();
      setActiveEditor(null);
      setLatestResult(null);
      setActiveDraftState(null);
      message.success('Đã lưu kết quả hiệu chuẩn');
    },
    onError: (error) => {
      console.error('[Calibration] Save failed:', error);
      message.error(getErrorMessage(error, 'Không lưu được kết quả hiệu chuẩn'));
    },
  });

  const maxChannels = useMemo(() => {
    const max = getMaxChannels(rows);
    return max > 0 ? max : 3;
  }, [rows]);

  const handleCancel = useCallback(() => {
    clearMinimizedCalibrationDraft();
    setActiveEditor(null);
    setLatestResult(null);
    setActiveDraftState(null);
  }, []);

  const editorTitle = useMemo(() => {
    if (activeEditor === null || sessionId === null) {
      return null;
    }

    const titleText = activeEditor.mode === 'add'
      ? `Thêm điểm đo mới - STT ${activeEditor.stt}`
      : `Sửa điểm đo - STT ${activeEditor.stt}`;

    return (
      <div className="calibration-editor-title">
        <span>{titleText}</span>
        <div className="calibration-editor-window-actions">
          <Button
            aria-label="Thu nhỏ form"
            disabled={saveMutation.isPending || loadingEditor}
            icon={<CompressOutlined />}
            onClick={() => {
              const formState = formRef.current?.getDraft();

              if (formState === undefined) {
                return;
              }

              saveMinimizedCalibrationDraft({
                sessionId,
                mode: activeEditor.mode,
                stt: activeEditor.stt,
                giaTriDat: activeEditor.giaTriDat,
                initialRow: activeEditor.initialRow,
                activeTargetTemp,
                activeJ,
                activeN,
                formState,
              });
              setActiveEditor(null);
              setLatestResult(null);
              setActiveDraftState(null);
              message.info('Đã ẩn form hiệu chuẩn tạm thời');
            }}
            type="text"
          />
          <Button
            aria-label="Đóng form"
            disabled={saveMutation.isPending || loadingEditor}
            icon={<CloseOutlined />}
            onClick={handleCancel}
            type="text"
          />
        </div>
      </div>
    );
  }, [
    activeEditor,
    activeJ,
    activeN,
    activeTargetTemp,
    handleCancel,
    loadingEditor,
    saveMutation.isPending,
    sessionId,
  ]);

  const handleAdd = useCallback(() => {
    const nextStt = getMaxStt(rows) + 1;
    const nextGiaTriDat = rows.length > 0 ? rows[rows.length - 1].giaTriDat : 0;

    setLatestResult(null);
    setActiveDraftState(null);
    clearMinimizedCalibrationDraft();
    setActiveTargetTemp(nextGiaTriDat);
    setActiveJ(3);
    setActiveN(5);
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
        setActiveDraftState(null);
        clearMinimizedCalibrationDraft();
        setActiveTargetTemp(row.giaTriDat);
        setActiveJ(row.soKenh || 3);
        setActiveN(row.soLanDo || 5);
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
        message.error(getErrorMessage(error, 'Không tải được chi tiết lần đo'));
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
        await deleteMutation.mutateAsync(stt);
      } catch {
        // Mutation handles user feedback.
      }
    },
    [deleteMutation, sessionId]
  );

  const handleSaved = useCallback(
    async (row: CalibrationResultRow) => {
      if (sessionId === null) {
        return;
      }

      try {
        await saveMutation.mutateAsync(row);
      } catch {
        // Mutation handles user feedback.
      }
    },
    [saveMutation, sessionId]
  );

  useEffect(() => {
    const state = location.state as { resumeCalibrationDraft?: number } | null;

    if (state?.resumeCalibrationDraft === undefined) {
      return;
    }

    const draft = getMinimizedCalibrationDraft();

    if (draft === null || draft.sessionId !== sessionId) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setLatestResult(draft.formState.result);
      setActiveTargetTemp(draft.activeTargetTemp);
      setActiveJ(draft.activeJ);
      setActiveN(draft.activeN);
      setActiveDraftState(draft.formState);
      setActiveEditor({
        mode: draft.mode,
        stt: draft.stt,
        giaTriDat: draft.giaTriDat,
        initialRow: draft.initialRow,
      });
      clearMinimizedCalibrationDraft();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [location.state, sessionId]);

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
    <section className="calibration-page">
      <Modal
        centered={false}
        className="calibration-editor-modal"
        closable={false}
        destroyOnHidden
        footer={null}
        keyboard={!saveMutation.isPending && !loadingEditor}
        maskClosable={!saveMutation.isPending && !loadingEditor}
        onCancel={handleCancel}
        open={activeEditor !== null}
        style={{ maxWidth: 'none', top: 16 }}
        styles={{
          body: {
            height: 'calc(100vh - 118px)',
            overflowX: 'hidden',
            overflowY: 'auto',
          },
        }}
        title={editorTitle}
        width="calc(100vw - 32px)"
        okButtonProps={{ disabled: true }}
        cancelButtonProps={{ disabled: saveMutation.isPending || loadingEditor }}
      >
        {activeEditor !== null ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <AutoCaptureControl
              sessionId={sessionId}
              j={activeJ}
              targetTemp={activeTargetTemp}
              tolerance={0.5}
              maxCaptures={activeN}
              onCapture={handleAutoCapture}
              disabled={saveMutation.isPending || loadingEditor}
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
                onNChange={setActiveN}
                draftState={activeDraftState}
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
      </Modal>

      <Card
        className="calibration-results-card"
        title={<Title level={4}>Tính hiệu chuẩn</Title>}
        extra={
          <Space wrap className="calibration-results-actions">
            <ExportButtons sessionId={sessionId} kenhCount={maxChannels} />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
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
          onRefresh={async () => {
            await refetchResults();
          }}
          editingStt={activeEditor?.stt}
        />
      </Card>
    </section>
  );
}

