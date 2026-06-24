/// <reference types="node" />

import * as signalR from '@microsoft/signalr';
import type { MeasurementBlock, SessionMetadata } from '../types/models';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5135';
const TEST_TIMEOUT_MS = 5000;

type TestFn = () => Promise<void>;

interface CreatedSession {
  id: number;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${TEST_TIMEOUT_MS}ms`));
    }, TEST_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });
}

async function runTest(name: string, testFn: TestFn): Promise<boolean> {
  try {
    await withTimeout(testFn(), name);
    console.log(`PASS ${name}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${name}: ${message}`);
    return false;
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

function assertStatus(response: Response, expectedStatus: number, label: string): void {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} expected HTTP ${expectedStatus}, got ${response.status}`);
  }
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} expected object response`);
  }
}

function assertCreatedSession(value: unknown): asserts value is CreatedSession {
  assertObject(value, 'POST /api/sessions');

  if (typeof value.id !== 'number') {
    throw new Error('POST /api/sessions expected { id: number }');
  }
}

function createSessionPayload(): SessionMetadata {
  return {
    tenThietBi: 'Smoke Test HM-19MB',
    kyHieu: 'SMOKE',
    soHieu: `SMOKE-${Date.now()}`,
    soTem: 'SMOKE-TEM',
    noiSanXuat: 'Local',
    namSanXuat: '2026',
    donViSuDung: 'QA',
    phuongPhap: 'Smoke test',
    ngayHieuChuan: new Date().toISOString(),
    nhietDoMoiTruong: '25 C',
    doAmTuongDoi: '60 %RH',
    nhietDoLamViec: '25 C',
    dacTinhKyThuat: 'Smoke test sample',
    thietBiChuan: 'Smoke reference',
  };
}

function createMeasurementPayload(): MeasurementBlock {
  return {
    deviceId: 'SMOKE',
    timestamp: new Date().toISOString(),
    probeCount: 3,
    probeTemperatures: [25.1, 25.2, 25.3],
    probeHumidities: [60.1, 60.2, 60.3],
    avgTemperature: 25.2,
    avgHumidity: 60.2,
    uniformityTemp: 0.2,
    uniformityHumidity: 0.2,
    stabilityTemperature: '0.1',
    stabilityHumidity: '0.1',
    stabilityRaw: 'smoke',
  };
}

async function testGetSessions(): Promise<void> {
  const response = await request('/api/sessions');
  assertStatus(response, 200, 'GET /api/sessions');

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('GET /api/sessions expected array response');
  }
}

async function createSession(): Promise<number> {
  const response = await request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(createSessionPayload()),
  });
  assertStatus(response, 200, 'POST /api/sessions');

  const data: unknown = await response.json();
  assertCreatedSession(data);
  return data.id;
}

async function deleteSession(sessionId: number): Promise<void> {
  const response = await request(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  assertStatus(response, 204, `DELETE /api/sessions/${sessionId}`);
}

async function startSession(sessionId: number): Promise<void> {
  const response = await request(
    `/api/sessions/${sessionId}/measurements/start`,
    {
      method: 'POST',
    }
  );

  assertStatus(
    response,
    200,
    `POST /api/sessions/${sessionId}/measurements/start`
  );

  const data: unknown = await response.json();
  assertObject(data, 'Start measurement session');

  if (data.active !== true) {
    throw new Error('Expected measurement session to be active');
  }
}

async function testSignalR(sessionId: number): Promise<void> {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE}/hubs/measurement`)
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  const received = new Promise<MeasurementBlock>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('MeasurementReceived event was not received'));
    }, TEST_TIMEOUT_MS);

    connection.on('MeasurementReceived', (block: MeasurementBlock) => {
      clearTimeout(timeoutId);
      resolve(block);
    });
  });

  try {
    await connection.start();
    await connection.invoke('JoinSession', String(sessionId));
    await startSession(sessionId);

    const response = await request(`/api/sessions/${sessionId}/measurements`, {
      method: 'POST',
      body: JSON.stringify(createMeasurementPayload()),
    });
    assertStatus(response, 200, `POST /api/sessions/${sessionId}/measurements`);

    const result: unknown = await response.json();
    assertObject(result, 'POST measurement');

    if (result.ignored === true) {
      throw new Error(`Measurement was ignored: ${String(result.reason)}`);
    }

    const block = await received;
    if (block.deviceId !== 'SMOKE') {
      throw new Error(`MeasurementReceived expected deviceId SMOKE, got ${block.deviceId}`);
    }
  } finally {
    await connection.stop();
  }
}

async function main(): Promise<void> {
  let createdSessionId: number | null = null;
  let failed = false;

  failed = !(await runTest('GET /api/sessions returns array', testGetSessions)) || failed;

  failed =
    !(await runTest('POST /api/sessions creates sample session', async () => {
      createdSessionId = await createSession();
    })) || failed;

  if (createdSessionId !== null) {
    const sessionId = createdSessionId;

    failed =
      !(await runTest('SignalR connect, join group, receive measurement ping', async () => {
        await testSignalR(sessionId);
      })) || failed;

    failed =
      !(await runTest('DELETE /api/sessions/{id} returns 204', async () => {
        await deleteSession(sessionId);
        createdSessionId = null;
      })) || failed;
  }

  if (createdSessionId !== null) {
    const sessionId = createdSessionId;

    await runTest('cleanup created smoke session', async () => {
      await deleteSession(sessionId);
    });
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('Phase 1 smoke test completed successfully.');
}

void main();
