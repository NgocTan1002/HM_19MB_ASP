import { InputNumber, Table, type TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { formatNumber } from '../../utils/calibration';

interface CalibrationChannelTableProps {
  channelCount: number;
  method: 'U' | 'Delta';
  corrections: number[];
  uValues: number[];
  deltaValues: number[];
  channelMeans?: number[];
  channelStdDevs?: number[];
  onCorrectionChange: (index: number, value: number | null) => void;
  onUValueChange: (index: number, value: number | null) => void;
  onDeltaValueChange: (index: number, value: number | null) => void;
}

interface ChannelParamRow {
  key: number;
  index: number;
}

export default function CalibrationChannelTable({
  channelCount,
  method,
  corrections,
  uValues,
  deltaValues,
  channelMeans = [],
  channelStdDevs = [],
  onCorrectionChange,
  onUValueChange,
  onDeltaValueChange,
}: CalibrationChannelTableProps) {
  const channelRows = useMemo<ChannelParamRow[]>(
    () =>
      Array.from({ length: channelCount }, (_item, index) => ({
        key: index,
        index,
      })),
    [channelCount]
  );

  const channelColumns = useMemo<TableColumnsType<ChannelParamRow>>(
    () => [
      {
        title: 'Kênh',
        key: 'channel',
        width: 72,
        render: (_value, row) => row.index + 1,
      },
      {
        title: 't̄_j',
        key: 'mean',
        className: 'calibration-computed-cell',
        width: 120,
        render: (_value, row) => (
          <span className="calibration-mono">
            {formatNumber(channelMeans[row.index])}
          </span>
        ),
      },
      {
        title: 'S_j',
        key: 'std',
        className: 'calibration-computed-cell',
        width: 120,
        render: (_value, row) => (
          <span className="calibration-mono">
            {formatNumber(channelStdDevs[row.index])}
          </span>
        ),
      },
      {
        title: 'δt_j',
        key: 'correction',
        render: (_value, row) => (
          <InputNumber<number>
            controls={false}
            value={corrections[row.index]}
            onChange={(value) => onCorrectionChange(row.index, value)}
            style={{ width: '100%' }}
          />
        ),
      },
      ...(method === 'U'
        ? [
            {
              title: 'U_j',
              key: 'u',
              render: (_value: unknown, row: ChannelParamRow) => (
                <InputNumber<number>
                  controls={false}
                  value={uValues[row.index]}
                  onChange={(value) => onUValueChange(row.index, value)}
                  style={{ width: '100%' }}
                />
              ),
            },
          ]
        : [
            {
              title: 'Δ_j',
              key: 'delta',
              render: (_value: unknown, row: ChannelParamRow) => (
                <InputNumber<number>
                  controls={false}
                  value={deltaValues[row.index]}
                  onChange={(value) => onDeltaValueChange(row.index, value)}
                  style={{ width: '100%' }}
                />
              ),
            },
          ]),
    ],
    [
      channelMeans,
      channelStdDevs,
      corrections,
      deltaValues,
      method,
      onCorrectionChange,
      onDeltaValueChange,
      onUValueChange,
      uValues,
    ]
  );

  return (
    <Table<ChannelParamRow>
      className="calibration-channel-table"
      columns={channelColumns}
      dataSource={channelRows}
      pagination={false}
      rowKey="key"
      size="small"
    />
  );
}
