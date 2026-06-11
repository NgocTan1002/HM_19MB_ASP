import type { CalibrationResultRow, UncertaintyResult } from '../types/models';
import type { CalibrationFormValues } from '../components/calibration/CalibrationConfigForm';

export interface CalibrationFormDraftState {
  values: CalibrationFormValues;
  corrections: number[];
  measurementData: number[][];
  ttn1: number[];
  ttn2: number[];
  result: UncertaintyResult | null;
}

export interface MinimizedCalibrationDraft {
  sessionId: number;
  mode: 'add' | 'edit';
  stt: number;
  giaTriDat: number;
  initialRow: CalibrationResultRow | null;
  activeTargetTemp: number;
  activeJ: number;
  activeN: number;
  formState: CalibrationFormDraftState;
  savedAt: string;
}

const STORAGE_KEY = 'hm19mb.calibration.minimizedDraft';
export const CALIBRATION_DRAFT_CHANGED_EVENT = 'hm19mb-calibration-draft-changed';

function notifyDraftChanged(): void {
  window.dispatchEvent(new Event(CALIBRATION_DRAFT_CHANGED_EVENT));
}

export function getMinimizedCalibrationDraft(): MinimizedCalibrationDraft | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MinimizedCalibrationDraft;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveMinimizedCalibrationDraft(
  draft: Omit<MinimizedCalibrationDraft, 'savedAt'>
): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...draft,
      savedAt: new Date().toISOString(),
    })
  );
  notifyDraftChanged();
}

export function clearMinimizedCalibrationDraft(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  notifyDraftChanged();
}
