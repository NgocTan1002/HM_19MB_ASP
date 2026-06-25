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

export interface MqttSettingsResponse {
    enabled: boolean;
    host: string;
    port: number;
    clientId: string;
    topic: string;
    username: string;
    hasPassword: boolean;
    useTls: boolean;
}

export interface MqttSettingsUpdateRequest {
    enabled: boolean;
    host: string;
    port: number;
    clientId: string;
    topic: string;
    username: string;
    password: string | null;
    useTls: boolean;
}

export interface MqttTestConnectionResponse {
    success: boolean;
    message: string;
}

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5135';

const client = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
});

export class ApiError extends Error {
    status?: number;
    url?: string;
    data?: unknown;

    constructor(message: string, options: { status?: number; url?: string; data?: unknown } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = options.status;
        this.url = options.url;
        this.data = options.data;
    }
}

function readApiMessage(data: unknown): string | null {
    if (typeof data === 'string' && data.trim().length > 0) {
        return data.trim();
    }

    if (data === null || typeof data !== 'object') {
        return null;
    }

    const record = data as Record<string, unknown>;
    const candidates = [record.message, record.error, record.title, record.detail];
    const message = candidates.find(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
    );

    return message?.trim() ?? null;
}

export function getErrorMessage(error: unknown, fallback = 'Loi he thong'): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return fallback;
}

client.interceptors.response.use(
    res => res,
    err => {
        if (!axios.isAxiosError(err)) {
            return Promise.reject(err);
        }

        const message =
            readApiMessage(err.response?.data) ||
            err.message ||
            'Khong the ket noi den API';

        console.error('[API Error]', err.response?.status, err.config?.url, message);

        return Promise.reject(
            new ApiError(message, {
                status: err.response?.status,
                url: err.config?.url,
                data: err.response?.data,
            })
        );
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
    start: (metadata: SessionMetadata) =>
        client.post<{ sessionId: number; deviceId: string | null; active: boolean }>(
            '/api/measurement-runs/start',
            { metadata }
        ),

    startExisting: (sessionId: number) =>
        client.post<{ sessionId: number; deviceId: string | null; active: boolean }>(
            `/api/measurement-runs/sessions/${sessionId}/start`
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

export const mqttSettingsApi = {
    get: () =>
        client.get<MqttSettingsResponse>('/api/settings/mqtt'),

    update: (settings: MqttSettingsUpdateRequest) =>
        client.put<MqttSettingsResponse>('/api/settings/mqtt', settings),

    testConnection: (settings?: MqttSettingsUpdateRequest) =>
        client.post<MqttTestConnectionResponse>(
            '/api/settings/mqtt/test-connection',
            settings
        ),
};

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
