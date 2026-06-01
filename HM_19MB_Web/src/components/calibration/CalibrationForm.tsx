import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { calibrationApi } from '../../services/api';
import type {
  CalibrationResultRow,
  ChiTietLanDo,
  UncertaintyInput,
  UncertaintyResult,
} from '../../types/models';
import MeasurementGrid from './MeasurementGrid';

const { Text } = Typography;

interface CalibrationFormProps {
  sessionId: number;
  stt: number;
  giaTriDat: number;
  initialRow?: CalibrationResultRow | null;
  onSaved: (row: CalibrationResultRow) => void;
  onCancel: () => void;
  onResultChange?: (result: UncertaintyResult | null) => void;
  onGiaTriDatChange?: (value: number) => void;
  onJChange?: (value: number) => void;
}

export interface CalibrationFormHandle {
  appendMeasurement: (vals: number[], chiThi: number) => void;
  lastResult: UncertaintyResult | null;
}

interface CalibrationFormValues {
  giaTriDat: number;
  giaTriChiThi: number;
  j: number;
  n: number;
  phuongPhapB: 'U' | 'Delta';
  resolutionA: number;
  resolutionD: number;
}

interface ChannelParamRow {
  key: number;
  index: number;
}

interface StandardResultShape {
  numberOfChannels?: number;
  numberOfMeasurements?: number;
  measurementData?: number[][];
  uValues?: number[];
  deltaValues?: number[];
  channelMeans?: number[];
  channelStdDevs?: number[];
  channelTypeAUncertainties?: number[];
  uch1?: number;
  uMax?: number;
  deltaMax?: number;
  uch2FromU?: number;
  uch2FromDelta?: number;
  uch2?: number;
  uc?: number;
  u?: number;
  calculationMethod?: string;
  calculatedAt?: string;
}

interface FullUncertaintyResult extends UncertaintyResult {
  standardResult?: StandardResultShape;
  tch?: number;
  channelCorrectedMeans?: number[];
  ttn?: number;
  deltaT?: number;
  deltaOd?: number;
  deltaDd?: number;
  ubk?: number;
  uFinal?: number;
  methodUsed?: string;
}

interface StoredStandardParams {
  uValues?: number[];
  deltaValues?: number[];
}

const DEFAULT_J = 3;
const DEFAULT_N = 6;
const CHANNEL_OPTIONS = [3, 5, 9, 10];
const RESOLUTION_D_OPTIONS = [0.5, 0.2, 0.1];

function finiteOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function finiteOrNaN(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(4)
    : '---';
}

function createVector(
  length: number,
  source?: (number | null)[],
  fallback = Number.NaN
): number[] {
  return Array.from({ length }, (_item, index) => {
    const value = source?.[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  });
}

function createMatrix(rows: number, columns: number, source?: number[][]): number[][] {
  return Array.from({ length: rows }, (_row, rowIndex) =>
    Array.from({ length: columns }, (_column, columnIndex) => {
      const value = source?.[rowIndex]?.[columnIndex];
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : Number.NaN;
    })
  );
}

function normalizeDimensions(j: number, n: number) {
  const channels = CHANNEL_OPTIONS.includes(j) ? j : DEFAULT_J;
  const measurements = Math.min(Math.max(Math.floor(n || DEFAULT_N), 2), 20);
  return { channels, measurements };
}

function parseStoredParams(json: string | undefined): StoredStandardParams {
  if (!json) {
    return {};
  }

  try {
    return JSON.parse(json) as StoredStandardParams;
  } catch {
    return {};
  }
}

function getResultValue(
  result: FullUncertaintyResult | null,
  key: keyof FullUncertaintyResult,
  fallback?: number
): number {
  const value = result?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : finiteOrNaN(fallback);
}

function getUch(result: FullUncertaintyResult | null): number {
  const uc = result?.standardResult?.uc;
  if (typeof uc === 'number' && Number.isFinite(uc)) {
    return uc;
  }

  const ucValue = result?.uc;
  return typeof ucValue === 'number' && Number.isFinite(ucValue)
    ? ucValue
    : Number.NaN;
}

function getStandardU(result: FullUncertaintyResult | null): number {
  const standardU = result?.standardResult?.u;
  if (typeof standardU === 'number' && Number.isFinite(standardU)) {
    return standardU;
  }

  const uValue = result?.u;
  return typeof uValue === 'number' && Number.isFinite(uValue)
    ? uValue
    : Number.NaN;
}

function buildChiTietLanDos(
  data: number[][],
  ttn1: number[],
  ttn2: number[],
  j: number,
  n: number
): ChiTietLanDo[] {
  const details: ChiTietLanDo[] = [];

  for (let rowIndex = 0; rowIndex < n; rowIndex++) {
    const first = ttn1[rowIndex];
    const second = ttn2[rowIndex];
    const chiThiUut =
      Number.isFinite(first) && Number.isFinite(second)
        ? (first + second) / 2
        : null;

    const kenhValues: (number | null)[] = Array.from({ length: 10 }, (_, i) => {
      if (i >= j) return null;
      const v = data[rowIndex]?.[i];
      return Number.isFinite(v) ? v : null;
    });

    details.push({
      lanDo: rowIndex + 1,
      kenh: 1,
      giaTri: data[rowIndex]?.[0] ?? Number.NaN,
      chiThiUut,
      kenhValues,
    });
  }

  return details;
}

function buildInitialGrid(
  initialRow: CalibrationResultRow | null | undefined,
  j: number,
  n: number
): number[][] {
  if (!initialRow?.chiTietLanDos?.length) {
    return createMatrix(n, j);
  }

  const matrix = createMatrix(n, j);

  initialRow.chiTietLanDos.forEach((detail) => {
    const rowIndex = detail.lanDo - 1;
    if (rowIndex < 0 || rowIndex >= n) return;

    if (detail.kenhValues) {
      for (let col = 0; col < Math.min(j, detail.kenhValues.length); col++) {
        const v = detail.kenhValues[col];
        if (v !== null && v !== undefined && Number.isFinite(v)) {
          matrix[rowIndex][col] = v;
        }
      }
    } else if (detail.kenh >= 1 && detail.kenh <= j) {
      matrix[rowIndex][detail.kenh - 1] = detail.giaTri;
    }
  });

  return matrix;
}

function buildInitialTtn(
  initialRow: CalibrationResultRow | null | undefined,
  n: number
): number[] {
  if (!initialRow?.chiTietLanDos?.length) {
    return createVector(n);
  }

  const values = createVector(n);
  const seen = new Set<number>();

  initialRow.chiTietLanDos.forEach((detail) => {
    const rowIndex = detail.lanDo - 1;
    if (
      rowIndex >= 0 &&
      rowIndex < n &&
      !seen.has(rowIndex) &&
      detail.chiThiUut !== null &&
      detail.chiThiUut !== undefined &&
      Number.isFinite(detail.chiThiUut)
    ) {
      values[rowIndex] = detail.chiThiUut;
      seen.add(rowIndex);
    }
  });

  return values;
}

function getDeltaColor(value: number): string {
  const absolute = Math.abs(value);
  if (absolute <= 0.5) {
    return '#389e0d';
  }

  if (absolute <= 1.0) {
    return '#d48806';
  }

  return '#cf1322';
}

function normalizeResult(result: FullUncertaintyResult): FullUncertaintyResult {
  if (result.standardResult === undefined) {
    return result;
  }

  return {
    numberOfChannels:
      result.numberOfChannels ?? result.standardResult.numberOfChannels ?? 0,
    numberOfMeasurements:
      result.numberOfMeasurements ?? result.standardResult.numberOfMeasurements ?? 0,
    measurementData:
      result.measurementData ?? result.standardResult.measurementData ?? [],
    uValues: result.uValues ?? result.standardResult.uValues ?? [],
    deltaValues: result.deltaValues ?? result.standardResult.deltaValues ?? [],
    channelMeans:
      result.channelMeans ?? result.standardResult.channelMeans ?? [],
    channelStdDevs:
      result.channelStdDevs ?? result.standardResult.channelStdDevs ?? [],
    channelTypeAUncertainties:
      result.channelTypeAUncertainties ??
      result.standardResult.channelTypeAUncertainties ??
      [],
    uch1: result.uch1 ?? result.standardResult.uch1 ?? Number.NaN,
    uMax: result.uMax ?? result.standardResult.uMax ?? Number.NaN,
    deltaMax: result.deltaMax ?? result.standardResult.deltaMax ?? Number.NaN,
    uch2FromU:
      result.uch2FromU ?? result.standardResult.uch2FromU ?? Number.NaN,
    uch2FromDelta:
      result.uch2FromDelta ??
      result.standardResult.uch2FromDelta ??
      Number.NaN,
    uch2: result.uch2 ?? result.standardResult.uch2 ?? Number.NaN,
    uc: result.uc ?? result.standardResult.uc ?? Number.NaN,
    u: result.u ?? result.standardResult.u ?? Number.NaN,
    calculationMethod:
      result.calculationMethod ?? result.standardResult.calculationMethod ?? '',
    calculatedAt:
      result.calculatedAt ?? result.standardResult.calculatedAt ?? '',
    ubk1: result.ubk1,
    ubk2: result.ubk2,
    ubk3: result.ubk3,
    ubk4: result.ubk4,
    ubk: result.ubk,
    uFinal: result.uFinal,
    tch: result.tch,
    ttn: result.ttn,
    deltaT: result.deltaT,
    deltaOd: result.deltaOd,
    deltaDd: result.deltaDd,
    methodUsed: result.methodUsed,
    standardResult: result.standardResult,
  };
}

const CalibrationForm = forwardRef<CalibrationFormHandle, CalibrationFormProps>(
function CalibrationForm(
  {
    sessionId,
    stt,
    giaTriDat,
    initialRow = null,
    onSaved,
    onCancel,
    onResultChange,
    onGiaTriDatChange,
    onJChange,
  },
  ref
) {
  const storedParams = useMemo(
    () => parseStoredParams(initialRow?.thongSoChuanJson),
    [initialRow?.thongSoChuanJson]
  );
  const initialJ = initialRow?.soKenh ?? DEFAULT_J;
  const initialN = initialRow?.soLanDo ?? DEFAULT_N;
  const { channels: normalizedInitialJ, measurements: normalizedInitialN } =
    normalizeDimensions(initialJ, initialN);

  const [form] = Form.useForm<CalibrationFormValues>();
  const [j, setJ] = useState(normalizedInitialJ);
  const [n, setN] = useState(normalizedInitialN);
  const [method, setMethod] = useState<'U' | 'Delta'>(
    initialRow?.phuongPhapB === 'Delta' ? 'Delta' : 'U'
  );
  const [corrections, setCorrections] = useState<number[]>(
    createVector(normalizedInitialJ, initialRow?.kenh, 0)
  );
  const [uValues, setUValues] = useState<number[]>(
    createVector(normalizedInitialJ, storedParams.uValues, 0)
  );
  const [deltaValues, setDeltaValues] = useState<number[]>(
    createVector(normalizedInitialJ, storedParams.deltaValues, 0)
  );
  const [measurementData, setMeasurementData] = useState<number[][]>(
    buildInitialGrid(initialRow, normalizedInitialJ, normalizedInitialN)
  );
  const [ttn1, setTtn1] = useState<number[]>(
    buildInitialTtn(initialRow, normalizedInitialN)
  );
  const [ttn2, setTtn2] = useState<number[]>(
    buildInitialTtn(initialRow, normalizedInitialN)
  );
  const [result, setResult] = useState<FullUncertaintyResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const giaTriChiThi = Form.useWatch('giaTriChiThi', form);
  const resolutionA = Form.useWatch('resolutionA', form);
  const resolutionD = Form.useWatch('resolutionD', form);
  const watchedGiaTriDat = Form.useWatch('giaTriDat', form);

  const initialValues = useMemo<CalibrationFormValues>(
    () => ({
      giaTriDat: initialRow?.giaTriDat ?? giaTriDat,
      giaTriChiThi: initialRow?.giaTriChiThi ?? giaTriDat,
      j: normalizedInitialJ,
      n: normalizedInitialN,
      phuongPhapB: initialRow?.phuongPhapB === 'Delta' ? 'Delta' : 'U',
      resolutionA: finiteOrZero(initialRow?.doPhanGiai),
      resolutionD: finiteOrZero(initialRow?.heSoPhanGiai) || 0.5,
    }),
    [giaTriDat, initialRow, normalizedInitialJ, normalizedInitialN]
  );

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  const resizeState = useCallback(
    (nextJ: number, nextN: number) => {
      setCorrections((current) => createVector(nextJ, current, 0));
      setUValues((current) => createVector(nextJ, current, 0));
      setDeltaValues((current) => createVector(nextJ, current, 0));
      setMeasurementData((current) => createMatrix(nextN, nextJ, current));
      setTtn1((current) => createVector(nextN, current));
      setTtn2((current) => createVector(nextN, current));
    },
    []
  );

  const handleValuesChange = useCallback(
    (
      changedValues: Partial<CalibrationFormValues>,
      allValues: CalibrationFormValues
    ) => {
      const nextJ = allValues.j ?? j;
      const nextN = allValues.n ?? n;

      if (changedValues.j !== undefined || changedValues.n !== undefined) {
        const { channels, measurements } = normalizeDimensions(nextJ, nextN);
        setJ(channels);
        setN(measurements);
        resizeState(channels, measurements);
      }

      if (changedValues.phuongPhapB !== undefined) {
        setMethod(allValues.phuongPhapB);
      }
    },
    [j, n, resizeState]
  );

  const handleChannelValueChange = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<number[]>>,
      index: number,
      value: number | null
    ) => {
      setter((current) => {
        const next = createVector(j, current, 0);
        next[index] = value ?? 0;
        return next;
      });
    },
    [j]
  );

  const handleGridChange = useCallback(
    (data: number[][], nextTtn1: number[], nextTtn2: number[]) => {
      setMeasurementData(createMatrix(data.length, j, data));
      setTtn1(createVector(data.length, nextTtn1));
      setTtn2(createVector(data.length, nextTtn2));

      if (data.length !== n) {
        setN(data.length);
        form.setFieldValue('n', data.length);
      }
    },
    [form, j, n]
  );

  const appendMeasurement = useCallback(
    (vals: number[], chiThi: number) => {
      const nextRow = createVector(j, vals);

      setMeasurementData((current) => {
        const next = createMatrix(current.length + 1, j, current);
        next[next.length - 1] = nextRow;
        return next;
      });

      setTtn1((current) => [...current, chiThi]);
      setTtn2((current) => [...current, chiThi]);
      setN((current) => {
        const nextN = current + 1;
        form.setFieldValue('n', nextN);
        return nextN;
      });
    },
    [form, j]
  );

  useImperativeHandle(
    ref,
    () => ({
      appendMeasurement,
      lastResult: result,
    }),
    [appendMeasurement, result]
  );

  const channelRows = useMemo<ChannelParamRow[]>(
    () =>
      Array.from({ length: j }, (_item, index) => ({
        key: index,
        index,
      })),
    [j]
  );

  const channelColumns = useMemo<TableColumnsType<ChannelParamRow>>(
    () => [
      {
        title: 'Kênh',
        key: 'channel',
        width: 80,
        render: (_value, row) => row.index + 1,
      },
      {
        title: 'Số hiệu chính ∂t_j',
        key: 'correction',
        render: (_value, row) => (
          <InputNumber<number>
            precision={4}
            controls={false}
            value={corrections[row.index]}
            onChange={(value) =>
              handleChannelValueChange(setCorrections, row.index, value)
            }
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
                  precision={4}
                  controls={false}
                  value={uValues[row.index]}
                  onChange={(value) =>
                    handleChannelValueChange(setUValues, row.index, value)
                  }
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
                  precision={4}
                  controls={false}
                  value={deltaValues[row.index]}
                  onChange={(value) =>
                    handleChannelValueChange(setDeltaValues, row.index, value)
                  }
                  style={{ width: '100%' }}
                />
              ),
            },
          ]),
    ],
    [
      corrections,
      deltaValues,
      handleChannelValueChange,
      method,
      uValues,
    ]
  );

  const buildInput = useCallback((): UncertaintyInput | null => {
    const headerValues = form.getFieldsValue();
    const currentGiaTriDat = headerValues.giaTriDat;
    const currentResolutionA = headerValues.resolutionA;
    const currentResolutionD = headerValues.resolutionD;

    if (
      !Number.isFinite(currentGiaTriDat) ||
      !Number.isFinite(headerValues.giaTriChiThi) ||
      !Number.isFinite(currentResolutionA) ||
      !Number.isFinite(currentResolutionD)
    ) {
      return null;
    }

    const normalizedData = createMatrix(n, j, measurementData);
    const normalizedTtn1 = createVector(n, ttn1);
    const normalizedTtn2 = createVector(n, ttn2);
    const hasInvalidGrid =
      normalizedData.some((row) => row.some((value) => !Number.isFinite(value))) ||
      normalizedTtn1.some((value) => !Number.isFinite(value)) ||
      normalizedTtn2.some((value) => !Number.isFinite(value));

    if (hasInvalidGrid) {
      return null;
    }

    return {
      j,
      n,
      measurementData: normalizedData,
      corrections: createVector(j, corrections, 0),
      uValues: createVector(j, uValues, 0),
      deltaValues: createVector(j, deltaValues, 0),
      ttn1: normalizedTtn1,
      ttn2: normalizedTtn2,
      resolutionA: currentResolutionA,
      resolutionD: currentResolutionD,
      useUMethod: method === 'U',
      giaTriDat: currentGiaTriDat,
    };
  }, [corrections, deltaValues, form, j, measurementData, method, n, ttn1, ttn2, uValues]);

  useEffect(() => {
    let cancelled = false;

    const timerId = window.setTimeout(() => {
      const input = buildInput();

      if (input === null) {
        setCalculationError('Nhập đủ dữ liệu hợp lệ để tính toán.');
        return;
      }

      async function calculate(currentInput: UncertaintyInput) {
        setCalculating(true);
        setCalculationError(null);

        try {
          const response = await calibrationApi.calculate(sessionId, currentInput);

          if (!cancelled) {
            setResult(normalizeResult(response.data as unknown as FullUncertaintyResult));
          }
        } catch (error) {
          console.error('[CalibrationForm] Calculate failed:', error);

          if (!cancelled) {
            setCalculationError('Không tính được kết quả. Kiểm tra lại dữ liệu đầu vào.');
          }
        } finally {
          if (!cancelled) {
            setCalculating(false);
          }
        }
      }

      void calculate(input);
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [
    buildInput,
    giaTriChiThi,
    resolutionA,
    resolutionD,
    sessionId,
    watchedGiaTriDat,
  ]);

  useEffect(() => {
    onResultChange?.(result);
  }, [onResultChange, result]);

  useEffect(() => {
    if (typeof watchedGiaTriDat === 'number' && Number.isFinite(watchedGiaTriDat)) {
      onGiaTriDatChange?.(watchedGiaTriDat);
    }
  }, [onGiaTriDatChange, watchedGiaTriDat]);

  useEffect(() => {
    onJChange?.(j);
  }, [j, onJChange]);

  const resultItems = useMemo(
    () => [
      { label: 't̄_ch (Tch)', value: getResultValue(result, 'tch') },
      { label: 't̄_tn (Ttn)', value: getResultValue(result, 'ttn') },
      {
        label: 'Δt = t̄_ch − t̄_tn',
        value: getResultValue(result, 'deltaT'),
        color: getDeltaColor(getResultValue(result, 'deltaT')),
      },
      { label: 'δt_od', value: getResultValue(result, 'deltaOd') },
      { label: 'δt_dd', value: getResultValue(result, 'deltaDd') },
      { label: 'u_ch', value: getUch(result) },
      { label: 'u_bk', value: getResultValue(result, 'ubk') },
      {
        label: 'U_final',
        value: getResultValue(result, 'uFinal', getStandardU(result)),
        strong: true,
      },
    ],
    [result]
  );

  const handleSave = useCallback(() => {
    const input = buildInput();
    if (input === null || result === null) {
      return;
    }

    const tch = getResultValue(result, 'tch');
    const ttn = getResultValue(result, 'ttn');
    const deltaT = getResultValue(result, 'deltaT');
    const deltaOd = getResultValue(result, 'deltaOd');
    const deltaDd = getResultValue(result, 'deltaDd');
    const ubk = getResultValue(result, 'ubk');
    const uFinal = getResultValue(result, 'uFinal', getStandardU(result));
    const uch = getUch(result);
    const headerValues = form.getFieldsValue();

    const row: CalibrationResultRow = {
      id: initialRow?.id,
      stt,
      giaTriDat: headerValues.giaTriDat,
      giaTriChiThi: headerValues.giaTriChiThi,
      kenh: createVector(j, corrections, 0),
      giaTriTrungBinh: tch,
      soHieuChinh: deltaT,
      doOnDinh: deltaOd,
      doDongDeu: deltaDd,
      doKhongDamBao: uFinal,
      uch,
      ubk,
      soKenh: j,
      soLanDo: n,
      phuongPhapB: method,
      doPhanGiai: input.resolutionA,
      heSoPhanGiai: input.resolutionD,
      thongSoChuanJson: JSON.stringify({
        uValues: input.uValues,
        deltaValues: input.deltaValues,
        ttn,
        method,
      }),
      chiTietLanDos: buildChiTietLanDos(measurementData, ttn1, ttn2, j, n),
    };

    onSaved(row);
  }, [
    buildInput,
    corrections,
    form,
    initialRow?.id,
    j,
    measurementData,
    method,
    n,
    onSaved,
    result,
    stt,
    ttn1,
    ttn2,
  ]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Form<CalibrationFormValues>
        form={form}
        layout="horizontal"
        initialValues={initialValues}
        labelCol={{ span: 10 }}
        wrapperCol={{ span: 14 }}
        onValuesChange={handleValuesChange}
      >
        <Card title={`Điểm hiệu chuẩn ${stt}`} size="small">
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="giaTriDat"
                label="Giá trị đặt"
                rules={[{ required: true, message: 'Nhập giá trị đặt' }]}
              >
                <InputNumber<number>
                  precision={4}
                  controls={false}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} lg={12}>
              <Form.Item
                name="giaTriChiThi"
                label="Giá trị chỉ thị tủ"
                rules={[{ required: true, message: 'Nhập giá trị chỉ thị tủ' }]}
              >
                <InputNumber<number>
                  precision={4}
                  controls={false}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} lg={12}>
              <Form.Item name="j" label="Số kênh j">
                <Select
                  options={CHANNEL_OPTIONS.map((value) => ({
                    value,
                    label: value,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} lg={12}>
              <Form.Item name="n" label="Số lần đo n">
                <InputNumber<number>
                  min={2}
                  max={20}
                  precision={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} lg={12}>
              <Form.Item name="phuongPhapB" label="Phương pháp B">
                <Radio.Group>
                  <Radio.Button value="U">Dùng U</Radio.Button>
                  <Radio.Button value="Delta">Dùng Delta</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Col xs={24} lg={12}>
              <Form.Item name="resolutionA" label="Độ phân giải A">
                <InputNumber<number>
                  precision={4}
                  controls={false}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} lg={12}>
              <Form.Item name="resolutionD" label="Hệ số d">
                <Select
                  options={RESOLUTION_D_OPTIONS.map((value) => ({
                    value,
                    label: value,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>

      <Card title="Thông số từng kênh" size="small">
        <Table<ChannelParamRow>
          columns={channelColumns}
          dataSource={channelRows}
          pagination={false}
          rowKey="key"
          size="small"
        />
      </Card>

      <Card title="Dữ liệu đo" size="small">
        <MeasurementGrid
          j={j}
          n={n}
          value={measurementData}
          ttn1={ttn1}
          ttn2={ttn2}
          onChange={handleGridChange}
        />
      </Card>

      <Card
        title={
          <Space>
            <span>Kết quả tính toán</span>
            {calculating ? <Spin size="small" /> : null}
          </Space>
        }
        size="small"
      >
        {calculationError ? (
          <Text type="danger">{calculationError}</Text>
        ) : null}

        <Row gutter={[16, 12]} style={{ marginTop: calculationError ? 12 : 0 }}>
          {resultItems.map((item) => (
            <Col xs={24} md={12} key={item.label}>
              <Text type="secondary">{item.label}</Text>
              <div
                style={{
                  color: item.color,
                  fontSize: item.strong ? 22 : 16,
                  fontWeight: item.strong ? 700 : 500,
                }}
              >
                {formatNumber(item.value)}
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Space>
        <Button type="primary" disabled={result === null} onClick={handleSave}>
          Lưu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </Space>
    </Space>
  );
});

export default memo(CalibrationForm);
