export type CalibrationQuantity = 'NhietDo' | 'DoAm';
export type CalibrationMode = CalibrationQuantity | 'Both';

export interface SessionMetadata {
  id?: number;
  tenThietBi: string;
  kyHieu: string;
  soHieu: string;
  soTem: string;
  noiSanXuat: string;
  namSanXuat: string;
  donViSuDung: string;
  phuongPhap: string;
  ngayHieuChuan: string;
  nhietDoMoiTruong: string;
  doAmTuongDoi: string;
  nhietDoLamViec: string;
  dacTinhKyThuat: string;
  thietBiChuan: string;
}

export interface MeasurementBlock {
  deviceId: string;
  timestamp: string;
  probeCount: number;
  probeTemperatures: number[];
  probeHumidities: number[];
  avgTemperature: number;
  avgHumidity: number;
  uniformityTemp: number;
  uniformityHumidity: number;
  stabilityTemperature: string;
  stabilityHumidity: string;
  stabilityRaw: string;
}

export interface MeasurementRecord {
  id: number;
  thoiGianDo: string;
  nhietDo: number[];
  doAm: number[];
  hasNhietDo: boolean[];
  hasDoAm: boolean[];
  nhietDoTb: number;
  doAmTb: number;
  hasDoAmTb: boolean;
  doDongDeuNhiet: number;
  doDongDeuAm: number;
  hasDoDongDeuAm: boolean;
  doOnDinhNhiet: number;
  hasDoOnDinhNhiet: boolean;
  doOnDinhAm: number;
  hasDoOnDinhAm: boolean;
}

export interface ChiTietLanDo {
  lanDo: number;
  kenh: number;
  giaTri: number;
  chiThiUut?: number | null;
  kenhValues?: (number | null)[];
}

export interface CalibrationResultRow {
  id?: number;
  stt: number;
  daiLuong?: CalibrationQuantity | string;
  unit?: string;
  tenDaiLuong?: string;
  giaTriDat: number;
  giaTriChiThi: number;
  kenh: (number | null)[];
  giaTriTrungBinh: number;
  soHieuChinh: number;
  doOnDinh: number;
  doDongDeu: number;
  doKhongDamBao: number;
  uch: number | null;
  ubk: number | null;
  soKenh: number;
  soLanDo: number;
  phuongPhapB: string;
  doPhanGiai: number | null;
  heSoPhanGiai: number | null;
  thongSoChuanJson: string;
  chiTietLanDos?: ChiTietLanDo[] | null;
  soKenhHopLe?: number;
}

export interface UncertaintyInput {
  j: number;
  n: number;
  measurementData: number[][];
  corrections: number[];
  uValues: number[];
  deltaValues: number[];
  ttn1: number[];
  ttn2: number[];
  resolutionA: number;
  resolutionD: number;
  useUMethod: boolean;
  giaTriDat: number;
}

export interface UncertaintyResult {
  numberOfChannels: number;
  numberOfMeasurements: number;
  measurementData: number[][];
  uValues: number[];
  deltaValues: number[];
  channelMeans: number[];
  channelStdDevs: number[];
  channelTypeAUncertainties: number[];
  uch1: number;
  uMax: number;
  deltaMax: number;
  uch2FromU: number;
  uch2FromDelta: number;
  uch2: number;
  uc: number;
  u: number;
  calculationMethod: string;
  calculatedAt: string;
  ubk1?: number;
  ubk2?: number;
  ubk3?: number;
  ubk4?: number;
  ubk?: number;
  uFinal?: number;
  tch?: number;
  ttn?: number;
  deltaT?: number;
  deltaOd?: number;
  deltaDd?: number;
}

export interface PhienDoSummary {
  id: number;
  tenThietBi: string;
  kyHieu: string;
  soHieu: string;
  donViSuDung: string;
  ngayHieuChuan: string;
  soDiemKiemTra: number;
  soLanDoTho: number;
  ngayTao: string;
}
