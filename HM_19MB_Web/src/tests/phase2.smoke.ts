import type { MeasurementBlock } from '../types/models';

interface ChartDataPoint {
  timestamp: string;
  temps: (number | null)[];
  hums: (number | null)[];
  avgTemp: number;
  avgHum: number | null;
}

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
type HealthStatus = 'ONLINE' | 'WARNING' | 'OFFLINE' | 'CONNECTING';

const MAX_CHART_POINTS = 720;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runTest(name: string, testFn: () => void): boolean {
  try {
    testFn();
    console.log(`PASS ${name}`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${name}: ${message}`);
    return false;
  }
}

function createFullBlock(index = 0): MeasurementBlock {
  const timestamp = new Date(Date.UTC(2026, 4, 29, 8, 0, index)).toISOString();
  const probeTemperatures = Array.from({ length: 10 }, (_, probeIndex) =>
    25 + probeIndex * 0.1 + index * 0.01
  );
  const probeHumidities = Array.from({ length: 10 }, (_, probeIndex) =>
    60 + probeIndex * 0.2
  );
  const avgTemperature =
    probeTemperatures.reduce((sum, value) => sum + value, 0) /
    probeTemperatures.length;
  const avgHumidity =
    probeHumidities.reduce((sum, value) => sum + value, 0) /
    probeHumidities.length;

  return {
    deviceId: 'SMOKE',
    timestamp,
    probeCount: 10,
    probeTemperatures,
    probeHumidities,
    avgTemperature,
    avgHumidity,
    uniformityTemp: Math.max(...probeTemperatures) - Math.min(...probeTemperatures),
    uniformityHumidity: Math.max(...probeHumidities) - Math.min(...probeHumidities),
    stabilityTemperature: '0.2',
    stabilityHumidity: '0.4',
    stabilityRaw: 'smoke',
  };
}

function createNoHumidityBlock(): MeasurementBlock {
  const block = createFullBlock();

  return {
    ...block,
    probeHumidities: Array.from({ length: 10 }, () => Number.NaN),
    avgHumidity: Number.NaN,
    uniformityHumidity: Number.NaN,
    stabilityHumidity: '---',
  };
}

function hasHumidityData(block: MeasurementBlock): boolean {
  return block.probeHumidities.some((value, index) =>
    index < block.probeCount && !Number.isNaN(value)
  );
}

function appendToBuffer(
  buffer: ChartDataPoint[],
  block: MeasurementBlock
): ChartDataPoint[] {
  const nextBuffer = [
    ...buffer,
    {
      timestamp: block.timestamp,
      temps: block.probeTemperatures.map(value =>
        Number.isNaN(value) ? null : value
      ),
      hums: block.probeHumidities.map(value =>
        Number.isNaN(value) ? null : value
      ),
      avgTemp: block.avgTemperature,
      avgHum: Number.isNaN(block.avgHumidity) ? null : block.avgHumidity,
    },
  ];

  if (nextBuffer.length <= MAX_CHART_POINTS) {
    return nextBuffer;
  }

  return nextBuffer.slice(nextBuffer.length - MAX_CHART_POINTS);
}

function getHealthStatus(
  lastReceivedAt: Date | null,
  connectionState: ConnectionState,
  now: Date
): HealthStatus {
  if (connectionState === 'connecting') {
    return 'CONNECTING';
  }

  if (connectionState === 'disconnected') {
    return 'OFFLINE';
  }

  if (connectionState === 'reconnecting') {
    return 'WARNING';
  }

  if (lastReceivedAt === null) {
    return 'CONNECTING';
  }

  const elapsedSeconds = Math.floor(
    (now.getTime() - lastReceivedAt.getTime()) / 1000
  );

  if (elapsedSeconds <= 10) {
    return 'ONLINE';
  }

  if (elapsedSeconds <= 30) {
    return 'WARNING';
  }

  return 'OFFLINE';
}

function testMockFullBlock(): void {
  const block = createFullBlock();

  assert(block.probeCount === 10, 'Expected probeCount = 10');
  assert(block.probeTemperatures.length === 10, 'Expected 10 temperature values');
  assert(block.probeHumidities.length === 10, 'Expected 10 humidity values');
  assert(hasHumidityData(block), 'Expected full block to have humidity data');
  assert(!Number.isNaN(block.avgTemperature), 'Expected avgTemperature to be valid');
  assert(!Number.isNaN(block.avgHumidity), 'Expected avgHumidity to be valid');
}

function testMockNoHumidityBlock(): void {
  const block = createNoHumidityBlock();

  assert(!hasHumidityData(block), 'Expected no humidity data');
  assert(
    block.probeHumidities.every(Number.isNaN),
    'Expected all humidity probe values to be NaN'
  );
  assert(Number.isNaN(block.avgHumidity), 'Expected avgHumidity to be NaN');
}

function testBufferLimit(): void {
  let buffer: ChartDataPoint[] = [];

  for (let index = 0; index < 750; index += 1) {
    buffer = appendToBuffer(buffer, createFullBlock(index));
  }

  assert(
    buffer.length === MAX_CHART_POINTS,
    `Expected buffer length ${MAX_CHART_POINTS}, got ${buffer.length}`
  );
  assert(
    buffer[0]?.timestamp === createFullBlock(30).timestamp,
    'Expected FIFO buffer to drop first 30 points'
  );
  assert(
    buffer.at(-1)?.timestamp === createFullBlock(749).timestamp,
    'Expected last buffer item to be the newest block'
  );
}

function testDisconnect35sOffline(): void {
  const now = new Date(Date.UTC(2026, 4, 29, 8, 0, 35));
  const lastReceivedAt = new Date(Date.UTC(2026, 4, 29, 8, 0, 0));

  const status = getHealthStatus(lastReceivedAt, 'connected', now);

  assert(status === 'OFFLINE', `Expected OFFLINE after 35s, got ${status}`);
}

function testReconnectStateWarningThenOnline(): void {
  const lastReceivedAt = new Date(Date.UTC(2026, 4, 29, 8, 0, 0));
  const reconnectingAt = new Date(Date.UTC(2026, 4, 29, 8, 0, 5));
  const reconnectedAt = new Date(Date.UTC(2026, 4, 29, 8, 0, 6));

  const reconnectingStatus = getHealthStatus(
    lastReceivedAt,
    'reconnecting',
    reconnectingAt
  );
  const reconnectedStatus = getHealthStatus(
    reconnectedAt,
    'connected',
    reconnectedAt
  );

  assert(
    reconnectingStatus === 'WARNING',
    `Expected WARNING while reconnecting, got ${reconnectingStatus}`
  );
  assert(
    reconnectedStatus === 'ONLINE',
    `Expected ONLINE after reconnect, got ${reconnectedStatus}`
  );
}

function main(): void {
  const results = [
    runTest('mock MeasurementBlock with full temperature and humidity data', testMockFullBlock),
    runTest('mock MeasurementBlock without humidity data', testMockNoHumidityBlock),
    runTest('simulate 750 blocks and keep only 720 points', testBufferLimit),
    runTest('simulate disconnect/stale data for 35s and resolve OFFLINE', testDisconnect35sOffline),
    runTest('simulate reconnect state transitions', testReconnectStateWarningThenOnline),
  ];

  if (results.some(result => !result)) {
    process.exitCode = 1;
    return;
  }

  console.log('Phase 2 smoke tests completed successfully.');
}

main();
