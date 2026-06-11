import {
  Alert,
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
type ConnectionPanelMode = 'create' | 'connect';

export default function Dashboard() {
  const { currentSessionId } = useSession();
  const [connectionPanelMode, setConnectionPanelMode] =
    useState<ConnectionPanelMode | null>(null);
  const {
    chartBuffer,
    connectionError,
    connectionState,
    currentBlock,
    handleDisconnect,
    handleReconnect,
    handleStartRun,
    isRunActive,
    isStartingRun,
    lastReceivedAt,
    setConnectionError,
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
    handleReconnect();
    setConnectionPanelMode(null);
  }, [handleReconnect]);

  const handleStartRunFromPanel = useCallback(
    async (...args: Parameters<typeof handleStartRun>) => {
      await handleStartRun(...args);
      setConnectionPanelMode(null);
    },
    [handleStartRun]
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
              Phien {currentSessionId} da duoc chon. He thong se tu nhan thiet
              bi tu frame dau tien ma Agent hoac MQTT gui len.
            </Text>
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
              height={560}
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
