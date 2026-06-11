import { Button, Form, Space } from 'antd';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { calibrationApi, getErrorMessage } from '../../services/api';
import type {
  CalibrationResultRow,
  UncertaintyInput,
  UncertaintyResult,
} from '../../types/models';
import {
  buildChiTietLanDos,
  buildInitialGrid,
  buildInitialTtn,
  createMatrix,
  createVector,
  DEFAULT_J,
  DEFAULT_N,
  findNextCaptureRowIndex,
  finiteOrZero,
  getResultValue,
  getStandardU,
  getUch,
  normalizeDimensions,
  normalizeResult,
  parseStoredParams,
  type FullUncertaintyResult,
} from '../../utils/calibration';
import type { CalibrationFormDraftState } from '../../utils/calibrationDraft';
import CalibrationConfigForm, {
  type CalibrationFormValues,
} from './CalibrationConfigForm';
import CalibrationMatrixTable from './CalibrationMatrixTable';
import CalibrationResultSummary from './CalibrationResultSummary';
import './CalibrationForm.css';

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
  onNChange?: (value: number) => void;
  draftState?: CalibrationFormDraftState | null;
}

export interface CalibrationFormHandle {
  appendMeasurement: (vals: number[], chiThi: number) => void;
  getDraft: () => CalibrationFormDraftState;
  lastResult: UncertaintyResult | null;
}

function getStoredMax(
  explicitValue: number | undefined,
  values: number[] | undefined,
  channelCount: number
): number {
  const value = finiteOrZero(explicitValue);

  if (value > 0) {
    return value;
  }

  return Math.max(...createVector(channelCount, values, 0));
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
    onNChange,
    draftState = null,
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
    createVector(normalizedInitialJ, storedParams.corrections, 0)
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

  const resolutionA = Form.useWatch('resolutionA', form);
  const resolutionD = Form.useWatch('resolutionD', form);
  const watchedUmax = Form.useWatch('ubk', form);
  const watchedDeltaMax = Form.useWatch('allowedError', form);
  const watchedGiaTriDat = Form.useWatch('giaTriDat', form);

  const initialValues = useMemo<CalibrationFormValues>(
    () =>
      draftState?.values ?? {
        giaTriDat: initialRow?.giaTriDat ?? giaTriDat,
        j: normalizedInitialJ,
        n: normalizedInitialN,
        phuongPhapB: initialRow?.phuongPhapB === 'Delta' ? 'Delta' : 'U',
        ubk: getStoredMax(
          storedParams.uMax,
          storedParams.uValues,
          normalizedInitialJ
        ),
        allowedError: getStoredMax(
          storedParams.deltaMax,
          storedParams.deltaValues,
          normalizedInitialJ
        ),
        resolutionA: finiteOrZero(initialRow?.doPhanGiai),
        resolutionD: finiteOrZero(initialRow?.heSoPhanGiai) || 0.5,
      },
    [draftState?.values, giaTriDat, initialRow, normalizedInitialJ, normalizedInitialN, storedParams]
  );

  useEffect(() => {
    form.setFieldsValue(initialValues);
    const nextJ = draftState?.values.j ?? normalizedInitialJ;
    const nextN = draftState?.values.n ?? normalizedInitialN;
    setJ(nextJ);
    setN(nextN);
    setMethod(initialValues.phuongPhapB);
    setCorrections(
      createVector(
        nextJ,
        draftState?.corrections ?? storedParams.corrections,
        0
      )
    );
    setMeasurementData(
      draftState?.measurementData ??
        buildInitialGrid(initialRow, normalizedInitialJ, normalizedInitialN)
    );
    setTtn1(draftState?.ttn1 ?? buildInitialTtn(initialRow, normalizedInitialN));
    setTtn2(draftState?.ttn2 ?? buildInitialTtn(initialRow, normalizedInitialN));
    setResult(draftState?.result ?? null);
    setCalculationError(null);
  }, [
    draftState,
    form,
    initialRow,
    initialValues,
    normalizedInitialJ,
    normalizedInitialN,
    storedParams.corrections,
  ]);

  const resizeState = useCallback((nextJ: number, nextN: number) => {
    setCorrections((current) => createVector(nextJ, current, 0));
    setMeasurementData((current) => createMatrix(nextN, nextJ, current));
    setTtn1((current) => createVector(nextN, current));
    setTtn2((current) => createVector(nextN, current));
  }, []);

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

  const handleCorrectionChange = useCallback(
    (index: number, value: number | null) => {
      setCorrections((current) => {
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
    (vals: number[]) => {
      const nextData = createMatrix(n, j, measurementData);
      const nextTtn1 = createVector(n, ttn1);
      const nextTtn2 = createVector(n, ttn2);
      const channelCount = Math.min(j, vals.length);
      const rowIndex = findNextCaptureRowIndex(nextData, j);

      if (rowIndex < 0) {
        return;
      }

      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        const value = vals[channelIndex];
        nextData[rowIndex][channelIndex] =
          Number.isFinite(value) ? value : Number.NaN;
      }

      for (let channelIndex = channelCount; channelIndex < j; channelIndex += 1) {
        nextData[rowIndex][channelIndex] = Number.NaN;
      }

      setMeasurementData(nextData);
      setTtn1(nextTtn1);
      setTtn2(nextTtn2);
    },
    [j, measurementData, n, ttn1, ttn2]
  );

  useImperativeHandle(
    ref,
    () => ({
      appendMeasurement,
      getDraft: () => ({
        values: form.getFieldsValue(),
        corrections: createVector(j, corrections, 0),
        measurementData: createMatrix(n, j, measurementData),
        ttn1: createVector(n, ttn1),
        ttn2: createVector(n, ttn2),
        result,
      }),
      lastResult: result,
    }),
    [appendMeasurement, corrections, form, j, measurementData, n, result, ttn1, ttn2]
  );

  const buildInput = useCallback((): UncertaintyInput | null => {
    const headerValues = form.getFieldsValue();
    const currentGiaTriDat = headerValues.giaTriDat;
    const currentResolutionA = headerValues.resolutionA;
    const currentResolutionD = headerValues.resolutionD;
    const currentUmax = headerValues.ubk;
    const currentDeltaMax = headerValues.allowedError;

    if (
      !Number.isFinite(currentGiaTriDat) ||
      !Number.isFinite(currentResolutionA) ||
      !Number.isFinite(currentResolutionD) ||
      !Number.isFinite(currentUmax) ||
      !Number.isFinite(currentDeltaMax)
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
      uValues: createVector(j, Array(j).fill(currentUmax), 0),
      deltaValues: createVector(j, Array(j).fill(currentDeltaMax), 0),
      ttn1: normalizedTtn1,
      ttn2: normalizedTtn2,
      resolutionA: currentResolutionA,
      resolutionD: currentResolutionD,
      useUMethod: method === 'U',
      giaTriDat: currentGiaTriDat,
    };
  }, [corrections, form, j, measurementData, method, n, ttn1, ttn2]);

  const handleCalculate = useCallback(async () => {
    const input = buildInput();

    if (input === null) {
      setCalculationError('Nhập đủ dữ liệu hợp lệ để tính toán.');
      return;
    }

    setCalculating(true);
    setCalculationError(null);

    try {
      const response = await calibrationApi.calculate(sessionId, input);
      setResult(normalizeResult(response.data as unknown as FullUncertaintyResult));
    } catch (error) {
      console.error('[CalibrationForm] Calculate failed:', error);
      setCalculationError(
        getErrorMessage(
          error,
          'Không tính được kết quả. Kiểm tra lại dữ liệu đầu vào.'
        )
      );
    } finally {
      setCalculating(false);
    }
  }, [buildInput, sessionId]);

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
            setCalculationError(
              getErrorMessage(
                error,
                'Không tính được kết quả. Kiểm tra lại dữ liệu đầu vào.'
              )
            );
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
    resolutionA,
    resolutionD,
    sessionId,
    watchedDeltaMax,
    watchedGiaTriDat,
    watchedUmax,
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

  useEffect(() => {
    onNChange?.(n);
  }, [n, onNChange]);

  const displayChannelCorrectedMeans = useMemo(() => {
    if (result === null) {
      return undefined;
    }

    const correctedFromResult = createVector(
      j,
      result.channelCorrectedMeans,
      Number.NaN
    );
    const rawMeans = createVector(j, result.channelMeans, Number.NaN);
    const currentCorrections = createVector(j, corrections, 0);

    return correctedFromResult.map((value, index) =>
      Number.isFinite(value) ? value : rawMeans[index] + currentCorrections[index]
    );
  }, [corrections, j, result]);

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
    const channelCorrectedMeans = displayChannelCorrectedMeans ?? [];

    if (channelCorrectedMeans.some((value) => !Number.isFinite(value))) {
      setCalculationError(
        'Không lưu được vì chỉ thị chuẩn chưa có đủ giá trị hợp lệ. Hãy tính toán lại trước khi lưu.'
      );
      return;
    }

    const row: CalibrationResultRow = {
      id: initialRow?.id,
      stt,
      giaTriDat: headerValues.giaTriDat,
      giaTriChiThi: headerValues.giaTriDat,
      kenh: channelCorrectedMeans,
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
        corrections: input.corrections,
        uMax: headerValues.ubk,
        deltaMax: headerValues.allowedError,
        ttn,
        method,
      }),
      chiTietLanDos: buildChiTietLanDos(measurementData, ttn1, ttn2, j, n),
    };

    onSaved(row);
  }, [
    buildInput,
    displayChannelCorrectedMeans,
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
    <div className="calibration-worksheet">
      <section className="calibration-worksheet-section">
        <div className="calibration-worksheet-label">
          A. THIẾT LẬP ĐIỂM HIỆU CHUẨN
        </div>
        <CalibrationConfigForm
          form={form}
          initialValues={initialValues}
          channelCount={j}
          corrections={corrections}
          onValuesChange={handleValuesChange}
          onCorrectionChange={handleCorrectionChange}
        />
      </section>

      <section className="calibration-worksheet-section">
        <div className="calibration-worksheet-label">B. BẢNG DỮ LIỆU THÔ</div>
        <CalibrationMatrixTable
          j={j}
          n={n}
          measurementData={measurementData}
          ttn1={ttn1}
          ttn2={ttn2}
          channelMeans={result?.channelMeans}
          channelCorrectedMeans={displayChannelCorrectedMeans}
          channelStdDevs={result?.channelStdDevs}
          channelTypeAUncertainties={result?.channelTypeAUncertainties}
          onChange={handleGridChange}
        />
      </section>

      <section className="calibration-worksheet-section">
        <div className="calibration-worksheet-label">
          C. KẾT QUẢ THEO CÔNG THỨC CT1-CT19
        </div>
        <CalibrationResultSummary
          calculating={calculating}
          calculationError={calculationError}
          deltaT={getResultValue(result, 'deltaT')}
          deltaOd={getResultValue(result, 'deltaOd')}
          deltaDd={getResultValue(result, 'deltaDd')}
          uch1={result?.uch1 ?? Number.NaN}
          uch2={result?.uch2 ?? Number.NaN}
          uch={getUch(result)}
          ubk={getResultValue(result, 'ubk')}
          uFinal={getResultValue(result, 'uFinal', getStandardU(result))}
        />
      </section>

      <Space className="calibration-actions">
        <Button onClick={handleCalculate} loading={calculating}>
          Tính toán
        </Button>
        <Button type="primary" disabled={result === null} onClick={handleSave}>
          Lưu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </Space>
    </div>
  );
});

export default memo(CalibrationForm);
