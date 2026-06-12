import { WifiOutlined } from '@ant-design/icons';
import { Badge, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import './HealthIndicator.css';

interface HealthIndicatorProps {
  lastReceivedAt: Date | null;
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  sessionId: number | null;
}

type HealthStatus = 'online' | 'warning' | 'offline' | 'connecting' | 'idle';

const { Text } = Typography;

function getElapsedSeconds(lastReceivedAt: Date | null, now: Date): number | null {
  if (lastReceivedAt === null) return null;
  return Math.max(0, Math.floor((now.getTime() - lastReceivedAt.getTime()) / 1000));
}

function getHealthStatus(
  connectionState: HealthIndicatorProps['connectionState'],
  sessionId: number | null
): HealthStatus {
  if (sessionId === null) return 'idle';
  if (connectionState === 'connecting') return 'connecting';
  if (connectionState === 'reconnecting') return 'warning';
  if (connectionState === 'disconnected') return 'offline';
  return 'online';
}

function getStatusText(status: HealthStatus): string {
  if (status === 'idle') return 'Chưa chọn phiên';
  if (status === 'connecting') return 'Đang kết nối...';
  if (status === 'online') return 'Đang kết nối';
  if (status === 'warning') return 'Đang kết nối lại...';
  return 'Mất kết nối';
}

function getCompactText(status: HealthStatus): string {
  if (status === 'online') return 'Online';
  if (status === 'warning') return 'Kết nối lại';
  if (status === 'offline') return 'Offline';
  if (status === 'connecting') return 'Đang nối';
  return 'Chưa chọn';
}

function getUpdatedText(elapsedSeconds: number | null): string {
  return elapsedSeconds === null
    ? 'chưa có dữ liệu'
    : `cập nhật ${elapsedSeconds}s trước`;
}

function getBadgeStatus(
  status: HealthStatus
): 'success' | 'warning' | 'error' | 'default' | 'processing' {
  if (status === 'online') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'offline') return 'error';
  if (status === 'connecting') return 'processing';
  return 'default';
}

export default function HealthIndicator({
  lastReceivedAt,
  connectionState,
  sessionId,
}: HealthIndicatorProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const elapsedSeconds = useMemo(
    () => getElapsedSeconds(lastReceivedAt, now),
    [lastReceivedAt, now]
  );

  const status = useMemo(
    () => getHealthStatus(connectionState, sessionId),
    [connectionState, sessionId]
  );

  const statusText = getStatusText(status);
  const compactText = getCompactText(status);
  const updatedText = getUpdatedText(elapsedSeconds);
  const badgeStatus = getBadgeStatus(status);

  return (
    <section
      aria-label="Trạng thái kết nối dữ liệu real-time"
      className={`health-indicator health-indicator-${status}`}
    >
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
      </Space>
    </section>
  );
}
