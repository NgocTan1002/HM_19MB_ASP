import { describe, expect, it } from 'vitest';
import type { CalibrationResultRow } from '../types/models';
import {
  buildChiTietLanDos,
  buildInitialGrid,
  buildInitialTtn,
  createMatrix,
  createVector,
  getResultValue,
  getStandardU,
  getUch,
  normalizeDimensions,
  normalizeResult,
  parseStoredParams,
} from './calibration';

function createRow(details: CalibrationResultRow['chiTietLanDos']): CalibrationResultRow {
  return {
    id: 1,
    stt: 1,
    giaTriDat: 10,
    giaTriChiThi: 10,
    kenh: [],
    giaTriTrungBinh: 0,
    soHieuChinh: 0,
    doOnDinh: 0,
    doDongDeu: 0,
    doKhongDamBao: 0,
    uch: null,
    ubk: null,
    soKenh: 3,
    soLanDo: 2,
    phuongPhapB: 'U',
    doPhanGiai: null,
    heSoPhanGiai: null,
    thongSoChuanJson: '',
    chiTietLanDos: details,
  };
}

describe('calibration matrix helpers', () => {
  it('normalizes vectors with fallback values', () => {
    expect(createVector(4, [1, null, Number.NaN, 4], 0)).toEqual([1, 0, 0, 4]);
  });

  it('normalizes matrices and pads missing cells with NaN', () => {
    const matrix = createMatrix(2, 3, [[1, Number.NaN], [3, 4, 5]]);

    expect(matrix[0][0]).toBe(1);
    expect(Number.isNaN(matrix[0][1])).toBe(true);
    expect(Number.isNaN(matrix[0][2])).toBe(true);
    expect(matrix[1]).toEqual([3, 4, 5]);
  });

  it('clamps channel count to 1-10 and measurement count to 2-20', () => {
    expect(normalizeDimensions(4, 1)).toEqual({ channels: 4, measurements: 2 });
    expect(normalizeDimensions(0, 6)).toEqual({ channels: 3, measurements: 6 });
    expect(normalizeDimensions(9, 25)).toEqual({ channels: 9, measurements: 20 });
    expect(normalizeDimensions(12, 6)).toEqual({ channels: 10, measurements: 6 });
  });

  it('builds an initial grid from compact channel detail rows', () => {
    const row = createRow([
      { lanDo: 1, kenh: 1, giaTri: 10, kenhValues: [10, 11, null] },
      { lanDo: 2, kenh: 2, giaTri: 22 },
    ]);

    const grid = buildInitialGrid(row, 3, 2);

    expect(grid[0][0]).toBe(10);
    expect(grid[0][1]).toBe(11);
    expect(Number.isNaN(grid[0][2])).toBe(true);
    expect(Number.isNaN(grid[1][0])).toBe(true);
    expect(grid[1][1]).toBe(22);
  });

  it('builds initial ttn values once per measurement row', () => {
    const row = createRow([
      { lanDo: 1, kenh: 1, giaTri: 10, chiThiUut: 9.8 },
      { lanDo: 1, kenh: 2, giaTri: 11, chiThiUut: 9.9 },
      { lanDo: 2, kenh: 1, giaTri: 12, chiThiUut: 10.1 },
    ]);

    expect(buildInitialTtn(row, 2)).toEqual([9.8, 10.1]);
  });

  it('builds measurement details with averaged ttn and null invalid channels', () => {
    const details = buildChiTietLanDos(
      [
        [10, 11, Number.NaN],
        [12, 13, 14],
      ],
      [9.8, Number.NaN],
      [10.2, 10.4],
      3,
      2
    );

    expect(details[0]).toMatchObject({
      lanDo: 1,
      kenh: 1,
      giaTri: 10,
      chiThiUut: 10,
      kenhValues: [10, 11, null, null, null, null, null, null, null, null],
    });
    expect(details[1].chiThiUut).toBeNull();
    expect(details[1].kenhValues?.slice(0, 3)).toEqual([12, 13, 14]);
  });
});

describe('calibration uncertainty result helpers', () => {
  it('parses stored standard parameters defensively', () => {
    expect(parseStoredParams('{"uValues":[1,2],"deltaValues":[3]}')).toEqual({
      uValues: [1, 2],
      deltaValues: [3],
    });
    expect(parseStoredParams('{bad json')).toEqual({});
  });

  it('normalizes nested standard result payloads', () => {
    const result = normalizeResult({
      standardResult: {
        numberOfChannels: 3,
        numberOfMeasurements: 2,
        measurementData: [[1, 2, 3]],
        uValues: [0.1, 0.2, 0.3],
        deltaValues: [1, 2, 3],
        channelMeans: [1, 2, 3],
        channelStdDevs: [0, 0, 0],
        channelTypeAUncertainties: [0, 0, 0],
        uch1: 0.1,
        uMax: 0.3,
        deltaMax: 3,
        uch2FromU: 0.2,
        uch2FromDelta: 0.3,
        uch2: 0.2,
        uc: 0.5,
        u: 1,
        calculationMethod: 'U',
        calculatedAt: 'now',
      },
      tch: 25,
      ttn: 24,
      deltaT: 1,
    } as never);

    expect(result.numberOfChannels).toBe(3);
    expect(result.u).toBe(1);
    expect(result.tch).toBe(25);
  });

  it('reads frontend values before falling back to standard result values', () => {
    const result = normalizeResult({
      standardResult: {
        uc: 0.5,
        u: 1,
      },
      uc: 0.7,
      u: 1.4,
      ubk: 0.2,
    } as never);

    expect(getUch(result)).toBe(0.5);
    expect(getStandardU(result)).toBe(1);
    expect(getResultValue(result, 'ubk')).toBe(0.2);
    expect(Number.isNaN(getResultValue(result, 'deltaT'))).toBe(true);
  });
});
