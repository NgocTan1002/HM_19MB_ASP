import {
  DisconnectOutlined,
  ReloadOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { Badge, Button, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

interface HealthIndicatorProps {
  lastReceivedAt: Date | null;
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  sessionId: number | null;
  onReconnect: () => void;
}

type HealthStatus = 'online' | 'warning' | 'offline' | 'connecting' | 'idle';

const { Text } = Typography;

function getElapsedSeconds(lastReceivedAt: Date | null, now: Date): number | null {
  if (lastReceivedAt === null) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - lastReceivedAt.getTime()) / 1000));
}

function getHealthStatus(
  elapsedSeconds: number | null,
  connectionState: HealthIndicatorProps['connectionState'],
  sessionId: number | null
): HealthStatus {
  if (sessionId === null) {
    return 'idle';
  }

  if (connectionState === 'connecting') {
    return 'connecting';
  }

  if (connectionState === 'reconnecting') {
    return 'warning';
  }

  if (connectionState === 'disconnected') {
    return 'offline';
  }

  if (elapsedSeconds === null) {
    return 'connecting';
  }

  if (elapsedSeconds <= 10) {
    return 'online';
  }

  if (elapsedSeconds <= 30) {
    return 'warning';
  }

  return 'offline';
}

function getStatusText(status: HealthStatus, elapsedSeconds: number | null): string {
  if (status === 'idle') {
    return 'Chưa chọn phiên';
  }

  if (status === 'connecting') {
    return 'Đang kết nối...';
  }

  if (status === 'online') {
    return 'Đang nhận dữ liệu';
  }

  if (status === 'warning') {
    return elapsedSeconds === null
      ? 'Đang kết nối lại...'
      : `Mất kết nối ${elapsedSeconds}s`;
  }

  return elapsedSeconds === null
    ? 'Mất kết nối'
    : `Mất kết nối ${elapsedSeconds}s`;
}

function getCompactText(status: HealthStatus): string {
  if (status === 'online') {
    return 'Online';
  }

  if (status === 'warning') {
    return 'Chậm';
  }

  if (status === 'offline') {
    return 'Offline';
  }

  if (status === 'connecting') {
    return 'Đang nối';
  }

  return 'Chưa chọn';
}

function getUpdatedText(elapsedSeconds: number | null): string {
  if (elapsedSeconds === null) {
    return 'chưa có dữ liệu';
  }

  return `cập nhật ${elapsedSeconds}s trước`;
}

function getBadgeStatus(status: HealthStatus): 'success' | 'warning' | 'error' | 'default' | 'processing' {
  if (status === 'online') {
    return 'success';
  }

  if (status === 'warning') {
    return 'warning';
  }

  if (status === 'offline') {
    return 'error';
  }

  if (status === 'connecting') {
    return 'processing';
  }

  return 'default';
}

export default function HealthIndicator({
  lastReceivedAt,
  connectionState,
  sessionId,
  onReconnect,
}: HealthIndicatorProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const elapsedSeconds = useMemo(
    () => getElapsedSeconds(lastReceivedAt, now),
    [lastReceivedAt, now]
  );

  const status = useMemo(
    () => getHealthStatus(elapsedSeconds, connectionState, sessionId),
    [connectionState, elapsedSeconds, sessionId]
  );

  const statusText = getStatusText(status, elapsedSeconds);
  const compactText = getCompactText(status);
  const updatedText = getUpdatedText(elapsedSeconds);
  const badgeStatus = getBadgeStatus(status);
  const showReconnect = status === 'offline';

  return (
    <section
      aria-label="Trạng thái kết nối dữ liệu real-time"
      className={`health-indicator health-indicator-${status}`}
    >
      <style>
        {`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.7; }
          }

          .health-indicator {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            width: 100%;
            min-height: 48px;
          }

          .health-indicator-main {
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 12px;
          }

          .health-indicator-dot {
            width: 24px;
            height: 24px;
            flex: 0 0 24px;
            border-radius: 999px;
            transition:
              background-color 0.5s ease,
              box-shadow 0.5s ease,
              opacity 0.5s ease;
          }

          .health-indicator-online .health-indicator-dot {
            background: #52c41a;
            box-shadow: 0 0 0 6px rgba(82, 196, 26, 0.14);
            animation: pulse 1.5s infinite;
          }

          .health-indicator-warning .health-indicator-dot {
            background: #faad14;
            box-shadow: 0 0 0 6px rgba(250, 173, 20, 0.14);
          }

          .health-indicator-offline .health-indicator-dot {
            background: #ff4d4f;
            box-shadow: 0 0 0 6px rgba(255, 77, 79, 0.12);
          }

          .health-indicator-connecting .health-indicator-dot,
          .health-indicator-idle .health-indicator-dot {
            display: grid;
            place-items: center;
            background: #d9d9d9;
            box-shadow: 0 0 0 6px rgba(0, 0, 0, 0.04);
          }

          .health-indicator-text {
            display: grid;
            min-width: 0;
            gap: 2px;
          }

          .health-indicator-title {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }

          .health-indicator-title-text,
          .health-indicator-updated {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .health-indicator-compact-text {
            display: none;
          }

          .health-indicator-actions {
            flex: 0 0 auto;
          }

          @media (max-width: 400px) {
            .health-indicator {
              min-height: 40px;
            }

            .health-indicator-main {
              gap: 10px;
            }

            .health-indicator-dot {
              width: 20px;
              height: 20px;
              flex-basis: 20px;
            }

            .health-indicator-title-text,
            .health-indicator-updated,
            .health-indicator-actions,
            .health-indicator-session {
              display: none;
            }

            .health-indicator-compact-text {
              display: inline;
            }
          }
        `}
      </style>

      <div className="health-indicator-main">
        <Tooltip title={statusText}>
          <span className="health-indicator-dot" aria-hidden="true">
            {status === 'connecting' && <Spin size="small" />}
          </span>
        </Tooltip>

        <div className="health-indicator-text">
          <div className="health-indicator-title">
            <Badge status={badgeStatus} />
            <Text strong className="health-indicator-title-text">
              {statusText}
            </Text>
            <Text strong className="health-indicator-compact-text">
              {compactText}
            </Text>
          </div>
          <Text type="secondary" className="health-indicator-updated">
            {updatedText}
          </Text>
        </div>
      </div>

      <Space className="health-indicator-actions">
        {sessionId !== null && (
          <Tag className="health-indicator-session" icon={<WifiOutlined />}>
            Session {sessionId}
          </Tag>
        )}

        {showReconnect && (
          <Tooltip title="Thử kết nối lại SignalR">
            <Button
              icon={connectionState === 'disconnected' ? <ReloadOutlined /> : <DisconnectOutlined />}
              onClick={onReconnect}
              size="small"
            >
              Kết nối lại
            </Button>
          </Tooltip>
        )}
      </Space>
    </section>
  );
}
