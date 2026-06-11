import type {
  CalibrationResultRow,
  ChiTietLanDo,
  UncertaintyResult,
} from '../types/models';

export interface StandardResultShape {
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

export interface FullUncertaintyResult extends UncertaintyResult {
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
  corrections?: number[];
  uMax?: number;
  deltaMax?: number;
}

export const DEFAULT_J = 3;
export const DEFAULT_N = 6;
export const RESOLUTION_D_OPTIONS = [0.5, 0.2, 0.1];

export function finiteOrZero(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function finiteOrNaN(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

export function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(4)
    : '---';
}

export function createVector(
  length: number,
  source?: (number | null)[],
  fallback = Number.NaN
): number[] {
  return Array.from({ length }, (_item, index) => {
    const value = source?.[index];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  });
}

export function createMatrix(
  rows: number,
  columns: number,
  source?: number[][]
): number[][] {
  return Array.from({ length: rows }, (_row, rowIndex) =>
    Array.from({ length: columns }, (_column, columnIndex) => {
      const value = source?.[rowIndex]?.[columnIndex];
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : Number.NaN;
    })
  );
}

export function normalizeDimensions(j: number, n: number) {
  const channels = Math.min(Math.max(Math.floor(j || DEFAULT_J), 1), 10);
  const measurements = Math.min(Math.max(Math.floor(n || DEFAULT_N), 2), 20);
  return { channels, measurements };
}

export function parseStoredParams(json: string | undefined): StoredStandardParams {
  if (!json) {
    return {};
  }

  try {
    return JSON.parse(json) as StoredStandardParams;
  } catch {
    return {};
  }
}

export function getResultValue(
  result: FullUncertaintyResult | null,
  key: keyof FullUncertaintyResult,
  fallback?: number
): number {
  const value = result?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : finiteOrNaN(fallback);
}

export function getUch(result: FullUncertaintyResult | null): number {
  const uc = result?.standardResult?.uc;
  if (typeof uc === 'number' && Number.isFinite(uc)) {
    return uc;
  }

  const ucValue = result?.uc;
  return typeof ucValue === 'number' && Number.isFinite(ucValue)
    ? ucValue
    : Number.NaN;
}

export function getStandardU(result: FullUncertaintyResult | null): number {
  const standardU = result?.standardResult?.u;
  if (typeof standardU === 'number' && Number.isFinite(standardU)) {
    return standardU;
  }

  const uValue = result?.u;
  return typeof uValue === 'number' && Number.isFinite(uValue)
    ? uValue
    : Number.NaN;
}

export function buildChiTietLanDos(
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

export function buildInitialGrid(
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

export function buildInitialTtn(
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

export function findNextCaptureRowIndex(data: number[][], j: number): number {
  for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
    const row = data[rowIndex] ?? [];
    const hasEmptyChannel = Array.from({ length: j }, (_item, colIndex) => {
      const value = row[colIndex];
      return !Number.isFinite(value);
    }).some(Boolean);

    if (hasEmptyChannel) {
      return rowIndex;
    }
  }

  return -1;
}

export function getDeltaColor(value: number): string {
  const absolute = Math.abs(value);
  if (absolute <= 0.5) {
    return '#389e0d';
  }

  if (absolute <= 1.0) {
    return '#d48806';
  }

  return '#cf1322';
}

export function normalizeResult(
  result: FullUncertaintyResult
): FullUncertaintyResult {
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
    channelCorrectedMeans: result.channelCorrectedMeans,
    ttn: result.ttn,
    deltaT: result.deltaT,
    deltaOd: result.deltaOd,
    deltaDd: result.deltaDd,
    methodUsed: result.methodUsed,
    standardResult: result.standardResult,
  };
}
