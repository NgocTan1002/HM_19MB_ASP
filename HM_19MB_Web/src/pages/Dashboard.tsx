import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Row,
  Modal,
  Space,
  Typography,
} from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardControls from '../components/dashboard/DashboardControls';
import HealthIndicator from '../components/dashboard/HealthIndicator';
import ProbeDataTable from '../components/dashboard/ProbeDataTable';
import TemperatureChart from '../components/dashboard/TemperatureChart';
import SessionForm from '../components/sessions/SessionForm';
import { useDashboardRun } from '../contexts/DashboardRunContext';
import { useSession } from '../contexts/useSession';
import './Dashboard.css';

const { Text, Title } = Typography;
const DEVICE_ID_HISTORY_KEY = 'hm19mb.deviceIdHistory';
const DEVICE_ID_HISTORY_LIMIT = 8;
type ConnectionPanelMode = 'create' | 'connect';

function readDeviceIdHistory(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(DEVICE_ID_HISTORY_KEY) ?? '[]'
    );
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function normalizeDeviceId(value: string): string {
  return value.trim();
}

export default function Dashboard() {
  const { currentSessionId } = useSession();
  const [connectionPanelMode, setConnectionPanelMode] =
    useState<ConnectionPanelMode | null>(null);
  const [deviceIdHistory, setDeviceIdHistory] = useState<string[]>(readDeviceIdHistory);
  const {
    chartBuffer,
    connectionError,
    connectionState,
    currentBlock,
    deviceId,
    handleDisconnect,
    handleReconnect,
    handleStartRun,
    isRunActive,
    isStartingRun,
    lastReceivedAt,
    setConnectionError,
    setDeviceId,
    setStartError,
    showHumidity,
    showTemperature,
    startError,
  } = useDashboardRun();

  const statusDescription = useMemo(() => {
    if (currentSessionId === null) {
      return 'Nhập thông tin phiên đo và bấm "Bắt đầu đo" để tạo phiên mới.';
    }

    if (connectionState === 'disconnected') {
      return `Phien ${currentSessionId} da san sang.`;
    }

    if (currentBlock === null) {
      return `Dang cho du lieu tu phien ${currentSessionId}.`;
    }

    return `Dang theo doi phien ${currentSessionId}.`;
  }, [connectionState, currentBlock, currentSessionId]);

  const connectionPanelTitle =
    connectionPanelMode === 'create'
      ? 'Bat dau phien do moi'
      : 'Ket noi phien dang chon';

  const rememberDeviceId = useCallback((value: string) => {
    const normalized = normalizeDeviceId(value);
    if (normalized.length === 0 || typeof window === 'undefined') {
      return normalized;
    }

    const nextHistory = [
      normalized,
      ...deviceIdHistory.filter(item => item !== normalized),
    ].slice(0, DEVICE_ID_HISTORY_LIMIT);

    setDeviceIdHistory(nextHistory);
    window.localStorage.setItem(
      DEVICE_ID_HISTORY_KEY,
      JSON.stringify(nextHistory)
    );

    return normalized;
  }, [deviceIdHistory]);

  const deviceIdOptions = useMemo(
    () => deviceIdHistory.map(value => ({ value })),
    [deviceIdHistory]
  );
  const headerActionsTarget =
    typeof document === 'undefined'
      ? null
      : document.getElementById('app-header-actions');

  const openCreatePanel = useCallback(() => {
    setConnectionPanelMode('create');
  }, []);

  const openConnectPanel = useCallback(() => {
    setConnectionPanelMode('connect');
  }, []);

  const closeConnectionPanel = useCallback(() => {
    if (!isStartingRun) {
      setConnectionPanelMode(null);
    }
  }, [isStartingRun]);

  const handleReconnectFromPanel = useCallback(() => {
    rememberDeviceId(deviceId);
    handleReconnect();
    setConnectionPanelMode(null);
  }, [deviceId, handleReconnect, rememberDeviceId]);

  const handleStartRunFromPanel = useCallback(
    async (...args: Parameters<typeof handleStartRun>) => {
      rememberDeviceId(deviceId);
      await handleStartRun(...args);
      setConnectionPanelMode(null);
    },
    [deviceId, handleStartRun, rememberDeviceId]
  );

  return (
    <section className="dashboard-page">
      {headerActionsTarget !== null
        ? createPortal(
            <Space align="center" wrap size={8}>
              <Button type="primary" onClick={openCreatePanel}>
                    Tạo phiên đo mới
              </Button>
              <Button
                    onClick={openConnectPanel}
                    disabled={currentSessionId === null || isRunActive}>
                    Kết nối phiên đo hiện tại
              </Button>
              <Button
                danger
                onClick={handleDisconnect}
                disabled={connectionState === 'disconnected'}
              >
                Ngắt kết nối
              </Button>
            </Space>,
            headerActionsTarget
          )
        : null}

      <div className="dashboard-page-header">
        <Space direction="vertical" size={2}>
          <Title level={1} className="dashboard-page-title">
            Theo dõi dữ liệu đo
          </Title>
          <Text type="secondary">{statusDescription}</Text>
        </Space>

        <Space align="center" wrap>
          <HealthIndicator
            connectionState={connectionState}
            lastReceivedAt={lastReceivedAt}
            sessionId={currentSessionId}
          />
        </Space>
      </div>

      <Modal
        centered={false}
        className={
          connectionPanelMode === 'create'
            ? 'dashboard-start-run-modal dashboard-start-run-modal-full'
            : 'dashboard-start-run-modal'
        }
        destroyOnHidden
        footer={null}
        maskClosable={!isStartingRun}
        keyboard={!isStartingRun}
        onCancel={closeConnectionPanel}
        open={connectionPanelMode !== null}
        style={{
          maxWidth: 'none',
          top: connectionPanelMode === 'create' ? 16 : 72,
        }}
        styles={{
          body: {
            height:
              connectionPanelMode === 'create'
                ? 'calc(100vh - 118px)'
                : undefined,
            overflowX: 'hidden',
            overflowY: connectionPanelMode === 'create' ? 'auto' : undefined,
          },
        }}
        title={connectionPanelTitle}
        width={connectionPanelMode === 'create' ? 'calc(100vw - 32px)' : 640}
      >
        {connectionPanelMode === 'connect' ? (
          <div className="start-run-panel">
            <Text type="secondary">
              Phien {currentSessionId} da duoc chon. Nhap Device ID dung voi
              Agent dang chay, sau do bam Ket noi lai de ghi du lieu moi vao
              phien nay.
            </Text>
            <AutoComplete
              options={deviceIdOptions}
              onBlur={() => setDeviceId(normalizeDeviceId(deviceId))}
              onChange={setDeviceId}
              placeholder="u01"
              value={deviceId}
              style={{ width: '100%' }}
            />
            {connectionError !== null && (
              <Alert
                closable
                message="Khong the ket noi SignalR"
                onClose={() => setConnectionError(null)}
                showIcon
                type="error"
                description={connectionError}
              />
            )}
            <Button type="primary" onClick={handleReconnectFromPanel}>
              Ket noi phien hien tai
            </Button>
          </div>
        ) : connectionPanelMode === 'create' ? (
          <div className="start-run-panel">
            <AutoComplete
              disabled={isStartingRun}
              options={deviceIdOptions}
              onBlur={() => setDeviceId(normalizeDeviceId(deviceId))}
              onChange={setDeviceId}
              placeholder="u01"
              value={deviceId}
              style={{ width: '100%' }}
            />
            {startError !== null && (
              <Alert
                closable
                message="Khong the bat dau phien do"
                onClose={() => setStartError(null)}
                showIcon
                type="error"
                description={startError}
              />
            )}
            <SessionForm
              loading={isStartingRun}
              onSubmit={handleStartRunFromPanel}
              submitText="Bat dau do"
            />
          </div>
        ) : null}
      </Modal>

      {connectionError !== null && isRunActive && (
        <Alert
          closable
          message="Khong the ket noi SignalR"
          onClose={() => setConnectionError(null)}
          showIcon
          type="error"
          description={connectionError}
        />
      )}

      <DashboardControls
        chartBuffer={chartBuffer}
        currentBlock={currentBlock}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="dashboard-card" title="Bieu do real-time">
            <TemperatureChart
              historicalData={chartBuffer}
              height={380}
              newBlock={null}
              showTemperature={showTemperature}
              showHumidity={showHumidity}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="dashboard-card" title="Du lieu dau do">
            <ProbeDataTable
              block={currentBlock}
              showTemperature
              showHumidity={showHumidity}
            />
          </Card>
        </Col>
      </Row>
    </section>
  );
}
