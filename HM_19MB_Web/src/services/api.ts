// src/services/api.ts
import axios from 'axios';
import type{
    SessionMetadata,
    MeasurementRecord,
    CalibrationResultRow,
    ChiTietLanDo,
    PhienDoSummary,
    UncertaintyInput,
    UncertaintyResult,
} from '../types/models';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5135';

const client = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
});

client.interceptors.response.use(
    res => res,
    err => {
        console.error('[API Error]', err.response?.status, err.config?.url);
        return Promise.reject(err);
    }
);

export const sessionApi = {
    getList: () =>
        client.get<PhienDoSummary[]>('/api/sessions'),

    getById: (id: number) =>
        client.get<SessionMetadata>(`/api/sessions/${id}`),

    create: (meta: SessionMetadata) =>
        client.post<{ id: number }>('/api/sessions', meta),

    update: (id: number, meta: SessionMetadata) =>
        client.put(`/api/sessions/${id}`, meta),

    delete: (id: number) =>
        client.delete(`/api/sessions/${id}`),
};

export const measurementApi = {
    getBySession: (sessionId: number) =>
        client.get<MeasurementRecord[]>(
            `/api/sessions/${sessionId}/measurements`
        ),

    start: (sessionId: number) =>
        client.post<{ sessionId: number; active: boolean }>(
            `/api/sessions/${sessionId}/measurements/start`
        ),

    stop: (sessionId: number) =>
        client.post<{ sessionId: number; active: boolean }>(
            `/api/sessions/${sessionId}/measurements/stop`
        ),

    status: (sessionId: number) =>
        client.get<{ sessionId: number; active: boolean }>(
            `/api/sessions/${sessionId}/measurements/status`
        ),
};

export const measurementRunApi = {
    start: (deviceId: string, metadata: SessionMetadata) =>
        client.post<{ sessionId: number; deviceId: string; active: boolean }>(
            '/api/measurement-runs/start',
            { deviceId, metadata }
        ),

    stop: (deviceId: string) =>
        client.post<{ sessionId: number | null; deviceId: string; active: boolean }>(
            `/api/measurement-runs/${encodeURIComponent(deviceId)}/stop`
        ),

    status: (deviceId: string) =>
        client.get<{ sessionId: number | null; deviceId: string; active: boolean }>(
            `/api/measurement-runs/${encodeURIComponent(deviceId)}/status`
        ),
};

export const calibrationApi = {
    calculate: (sessionId: number, input: UncertaintyInput) =>
        client.post<UncertaintyResult>(
            `/api/sessions/${sessionId}/calibration/calculate`,
            input
        ),

    save: (sessionId: number, row: CalibrationResultRow) =>
        client.post<{ id: number }>(
            `/api/sessions/${sessionId}/calibration/results`,
            row
        ),

    getBySession: (sessionId: number) =>
        client.get<CalibrationResultRow[]>(
            `/api/sessions/${sessionId}/calibration/results`
        ),

    delete: (sessionId: number, stt: number) =>
        client.delete(
            `/api/sessions/${sessionId}/calibration/results/${stt}`
        ),

    getChiTiet: (sessionId: number, ketQuaHcId: number) =>
        client.get<ChiTietLanDo[]>(
            `/api/sessions/${sessionId}/calibration/results/${ketQuaHcId}/details`
        ),
};

export const reportApi = {
    exportExcel: (sessionId: number, kenhCount = 3) =>
        client.get(`/api/sessions/${sessionId}/reports/excel`, {
            params: { kenhCount },
            responseType: 'blob',
        }),

    exportWord: (sessionId: number) =>
        client.get(`/api/sessions/${sessionId}/reports/word`, {
            responseType: 'blob',
        }),
};

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
