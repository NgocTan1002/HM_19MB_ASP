import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button, InputNumber, Space, Table, type TableColumnsType } from 'antd';

export interface MeasurementGridProps {
  j: number;
  n: number;
  value: number[][];
  ttn1: number[];
  ttn2: number[];
  onChange: (data: number[][], ttn1: number[], ttn2: number[]) => void;
  disabled?: boolean;
}

interface MeasurementRow {
  key: number;
  rowIndex: number;
}

type EditableColumnKind = 'measurement' | 'ttn1' | 'ttn2';

interface FocusTarget {
  rowIndex: number;
  columnIndex: number;
}

const MIN_ROWS = 2;

function normalizeDimension(count: number, min: number, max?: number): number {
  const safeCount = Number.isFinite(count) ? Math.floor(count) : min;
  const boundedMin = Math.max(min, safeCount);
  return max === undefined ? boundedMin : Math.min(max, boundedMin);
}

function isEmptyNumber(value: number | null | undefined): boolean {
  return value === null || value === undefined || Number.isNaN(value);
}

function formatReadonly(value: number): string {
  return Number.isNaN(value) ? '' : value.toFixed(3);
}

function cloneMatrix(source: number[][], rowCount: number, columnCount: number): number[][] {
  return Array.from({ length: rowCount }, (_row, rowIndex) =>
    Array.from({ length: columnCount }, (_column, columnIndex) => {
      const cellValue = source[rowIndex]?.[columnIndex];
      return isEmptyNumber(cellValue) ? Number.NaN : cellValue;
    })
  );
}

function cloneVector(source: number[], rowCount: number): number[] {
  return Array.from({ length: rowCount }, (_row, rowIndex) => {
    const cellValue = source[rowIndex];
    return isEmptyNumber(cellValue) ? Number.NaN : cellValue;
  });
}

function getColumnKey(kind: EditableColumnKind, index: number): string {
  if (kind === 'measurement') {
    return `measurement-${index}`;
  }

  return kind;
}

function focusInput(target: FocusTarget): void {
  window.setTimeout(() => {
    const selector = `[data-grid-row="${target.rowIndex}"][data-grid-col="${target.columnIndex}"] input`;
    const input = document.querySelector<HTMLInputElement>(selector);
    input?.focus();
    input?.select();
  }, 0);
}

function MeasurementGrid({
  j,
  n,
  value,
  ttn1,
  ttn2,
  onChange,
  disabled = false,
}: MeasurementGridProps) {
  const channelCount = normalizeDimension(j, 1, 10);
  const rowCount = normalizeDimension(n, MIN_ROWS);
  const dataRef = useRef(value);
  const ttn1Ref = useRef(ttn1);
  const ttn2Ref = useRef(ttn2);

  useEffect(() => {
    dataRef.current = value;
    ttn1Ref.current = ttn1;
    ttn2Ref.current = ttn2;
  }, [ttn1, ttn2, value]);

  const normalizedData = useMemo(
    () => cloneMatrix(value, rowCount, channelCount),
    [channelCount, rowCount, value]
  );

  const normalizedTtn1 = useMemo(
    () => cloneVector(ttn1, rowCount),
    [rowCount, ttn1]
  );

  const normalizedTtn2 = useMemo(
    () => cloneVector(ttn2, rowCount),
    [rowCount, ttn2]
  );

  const rows = useMemo<MeasurementRow[]>(
    () =>
      Array.from({ length: rowCount }, (_row, rowIndex) => ({
        key: rowIndex,
        rowIndex,
      })),
    [rowCount]
  );

  const emitChange = useCallback(
    (nextData: number[][], nextTtn1: number[], nextTtn2: number[]) => {
      onChange(nextData, nextTtn1, nextTtn2);
    },
    [onChange]
  );

  const updateMeasurement = useCallback(
    (rowIndex: number, columnIndex: number, nextValue: number | null) => {
      const nextData = cloneMatrix(dataRef.current, rowCount, channelCount);
      const nextTtn1 = cloneVector(ttn1Ref.current, rowCount);
      const nextTtn2 = cloneVector(ttn2Ref.current, rowCount);

      nextData[rowIndex][columnIndex] = nextValue ?? Number.NaN;
      emitChange(nextData, nextTtn1, nextTtn2);
    },
    [channelCount, emitChange, rowCount]
  );

  const updateTtn = useCallback(
    (kind: 'ttn1' | 'ttn2', rowIndex: number, nextValue: number | null) => {
      const nextData = cloneMatrix(dataRef.current, rowCount, channelCount);
      const nextTtn1 = cloneVector(ttn1Ref.current, rowCount);
      const nextTtn2 = cloneVector(ttn2Ref.current, rowCount);

      if (kind === 'ttn1') {
        nextTtn1[rowIndex] = nextValue ?? Number.NaN;
      } else {
        nextTtn2[rowIndex] = nextValue ?? Number.NaN;
      }

      emitChange(nextData, nextTtn1, nextTtn2);
    },
    [channelCount, emitChange, rowCount]
  );

  const handleKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLInputElement>,
      rowIndex: number,
      columnIndex: number
    ) => {
      if (event.key === 'Tab') {
        event.preventDefault();

        const direction = event.shiftKey ? -1 : 1;
        const totalColumns = channelCount + 2;
        const flatIndex = rowIndex * totalColumns + columnIndex + direction;
        const maxIndex = rowCount * totalColumns - 1;
        const boundedIndex = Math.min(Math.max(flatIndex, 0), maxIndex);

        focusInput({
          rowIndex: Math.floor(boundedIndex / totalColumns),
          columnIndex: boundedIndex % totalColumns,
        });
      }

      if (event.key === 'Enter') {
        event.preventDefault();

        focusInput({
          rowIndex: Math.min(rowIndex + 1, rowCount - 1),
          columnIndex,
        });
      }
    },
    [channelCount, rowCount]
  );

  const renderInput = useCallback(
    (
      currentValue: number,
      rowIndex: number,
      columnIndex: number,
      onValueChange: (nextValue: number | null) => void
    ) => (
      <InputNumber<number>
        data-grid-row={rowIndex}
        data-grid-col={columnIndex}
        value={Number.isNaN(currentValue) ? null : currentValue}
        precision={3}
        step={0.001}
        controls={false}
        disabled={disabled}
        onChange={onValueChange}
        onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
        style={{ width: '100%' }}
        variant="borderless"
      />
    ),
    [disabled, handleKeyDown]
  );

  const columns = useMemo<TableColumnsType<MeasurementRow>>(() => {
    const measurementColumns: TableColumnsType<MeasurementRow> = Array.from(
      { length: channelCount },
      (_column, columnIndex) => ({
        title: `kênh ${columnIndex + 1}`,
        key: getColumnKey('measurement', columnIndex),
        width: 120,
        render: (_cellValue, row) =>
          renderInput(
            normalizedData[row.rowIndex]?.[columnIndex] ?? Number.NaN,
            row.rowIndex,
            columnIndex,
            (nextValue) => updateMeasurement(row.rowIndex, columnIndex, nextValue)
          ),
      })
    );

    return [
      {
        title: 'Lần đo',
        key: 'measurement-index',
        width: 90,
        render: (_cellValue, row) => row.rowIndex + 1,
      },
      ...measurementColumns,
      {
        title: 't_tn1',
        key: getColumnKey('ttn1', 0),
        width: 120,
        render: (_cellValue, row) =>
          renderInput(
            normalizedTtn1[row.rowIndex] ?? Number.NaN,
            row.rowIndex,
            channelCount,
            (nextValue) => updateTtn('ttn1', row.rowIndex, nextValue)
          ),
      },
      {
        title: 't_tn2',
        key: getColumnKey('ttn2', 0),
        width: 120,
        render: (_cellValue, row) =>
          renderInput(
            normalizedTtn2[row.rowIndex] ?? Number.NaN,
            row.rowIndex,
            channelCount + 1,
            (nextValue) => updateTtn('ttn2', row.rowIndex, nextValue)
          ),
      },
      {
        title: 't_tn TB',
        key: 'ttn-average',
        width: 120,
        render: (_cellValue, row) => {
          const first = normalizedTtn1[row.rowIndex] ?? Number.NaN;
          const second = normalizedTtn2[row.rowIndex] ?? Number.NaN;

          if (Number.isNaN(first) || Number.isNaN(second)) {
            return '';
          }

          return formatReadonly((first + second) / 2);
        },
      },
    ];
  }, [
    channelCount,
    normalizedData,
    normalizedTtn1,
    normalizedTtn2,
    renderInput,
    updateMeasurement,
    updateTtn,
  ]);

  const handleAddRow = useCallback(() => {
    const nextData = cloneMatrix(dataRef.current, rowCount + 1, channelCount);
    const nextTtn1 = cloneVector(ttn1Ref.current, rowCount + 1);
    const nextTtn2 = cloneVector(ttn2Ref.current, rowCount + 1);

    emitChange(nextData, nextTtn1, nextTtn2);
  }, [channelCount, emitChange, rowCount]);

  const handleRemoveLastRow = useCallback(() => {
    if (rowCount <= MIN_ROWS) {
      return;
    }

    const nextRowCount = rowCount - 1;
    const nextData = cloneMatrix(dataRef.current, nextRowCount, channelCount);
    const nextTtn1 = cloneVector(ttn1Ref.current, nextRowCount);
    const nextTtn2 = cloneVector(ttn2Ref.current, nextRowCount);

    emitChange(nextData, nextTtn1, nextTtn2);
  }, [channelCount, emitChange, rowCount]);

  return (
    <div>
      <Table<MeasurementRow>
        bordered
        columns={columns}
        dataSource={rows}
        pagination={false}
        rowKey="key"
        scroll={{ x: 90 + channelCount * 120 + 360 }}
        size="small"
      />

      <Space style={{ marginTop: 12 }}>
        <Button onClick={handleAddRow} disabled={disabled}>
          Add row
        </Button>
        <Button
          onClick={handleRemoveLastRow}
          disabled={disabled || rowCount <= MIN_ROWS}
        >
          Remove last row
        </Button>
      </Space>
    </div>
  );
}

export default memo(MeasurementGrid);
