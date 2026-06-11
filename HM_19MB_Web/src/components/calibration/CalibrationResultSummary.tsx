import { Spin, Typography } from 'antd';
import { formatNumber } from '../../utils/calibration';
import './CalibrationResultSummary.css';

const { Text } = Typography;

interface CalibrationResultSummaryProps {
  calculating: boolean;
  calculationError: string | null;
  deltaT: number;
  deltaOd: number;
  deltaDd: number;
  uch1: number;
  uch2: number;
  uch: number;
  ubk: number;
  uFinal: number;
}

function formatSigned(value: number, prefix = ''): string {
  if (!Number.isFinite(value)) {
    return '---';
  }

  const sign = value >= 0 ? '+' : '';
  return `${prefix}${sign}${formatNumber(value)} °C`;
}

function formatPlain(value: number): string {
  return Number.isFinite(value) ? `${formatNumber(value)} °C` : '---';
}

export default function CalibrationResultSummary({
  calculating,
  calculationError,
  deltaT,
  deltaOd,
  deltaDd,
  uch1,
  uch2,
  uch,
  ubk,
  uFinal,
}: CalibrationResultSummaryProps) {
  return (
    <div className="calibration-result-summary">
      <div className="calibration-result-status">
        {calculating ? <Spin size="small" /> : null}
        {calculationError ? <Text type="danger">{calculationError}</Text> : null}
      </div>

      <div className="calibration-result-panels">
        <fieldset className="calibration-result-panel">
          <legend>Đặc trưng điểm đo</legend>
          <div className="calibration-result-row">
            <span>Số hiệu chỉnh Δt</span>
            <strong>Δt = {formatSigned(deltaT)}</strong>
          </div>
          <div className="calibration-result-row">
            <span>Độ ổn định</span>
            <strong>{formatSigned(Math.abs(deltaOd), '±')}</strong>
          </div>
          <div className="calibration-result-row">
            <span>Độ đồng đều</span>
            <strong>{formatSigned(Math.abs(deltaDd), '±')}</strong>
          </div>
        </fieldset>

        <fieldset className="calibration-result-panel">
          <legend>Thành phần độ không đảm bảo</legend>
          <div className="calibration-result-row">
            <span>
              Tản mát của chuẩn <em>u</em>
              <sub>ch1</sub>
            </span>
            <strong>{formatPlain(uch1)}</strong>
          </div>
          <div className="calibration-result-row">
            <span>
              ĐKĐBĐ chuẩn <em>u</em>
              <sub>ch2</sub>
            </span>
            <strong>{formatPlain(uch2)}</strong>
          </div>
          <div className="calibration-result-row">
            <span>
              Liên hợp chuẩn <em>u</em>
              <sub>ch</sub>
            </span>
            <strong>{formatPlain(uch)}</strong>
          </div>
          <div className="calibration-result-row">
            <span>
              Liên hợp tủ <em>u</em>
              <sub>bk</sub>
            </span>
            <strong>{formatPlain(ubk)}</strong>
          </div>
        </fieldset>

        <fieldset className="calibration-result-panel calibration-result-final">
          <legend>Kết quả</legend>
          <div className="calibration-result-final-content">
            <span>U(k=2, P=95%)</span>
            <strong>{formatSigned(Math.abs(uFinal), '±')}</strong>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
