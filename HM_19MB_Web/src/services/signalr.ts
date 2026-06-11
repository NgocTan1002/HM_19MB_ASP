import * as signalR from '@microsoft/signalr';
import type { MeasurementBlock } from '../types/models';

const RETRY_DELAYS = [0, 2000, 5000, 15000];

export type HubConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface MeasurementHubClientOptions {
  onStateChange?: (state: HubConnectionState) => void;
}

export class MeasurementHubClient {
  private connection: signalR.HubConnection;
  private currentSessionId: number | null = null;
  private measurementHandler: ((block: MeasurementBlock) => void) | null = null;
  private onStateChange: ((state: HubConnectionState) => void) | null = null;

  constructor(baseUrl: string, options: MeasurementHubClientOptions = {}) {
    const hubUrl = baseUrl.replace(/\/$/, '') + '/hubs/measurement';
    this.onStateChange = options.onStateChange ?? null;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect(RETRY_DELAYS)
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.onreconnecting(() => {
      this.emitState('reconnecting');
    });

    this.connection.onreconnected(() => {
      this.emitState('connected');

      if (this.currentSessionId === null) {
        return;
      }

      this.connection
        .invoke('JoinSession', String(this.currentSessionId))
        .catch((err: unknown) => {
          console.error('[SignalR] Re-join group failed:', err);
        });
    });

    this.connection.onclose(() => {
      this.emitState('disconnected');
    });
  }

  get isConnected(): boolean {
    return this.connection.state === signalR.HubConnectionState.Connected;
  }

  setStateChangeHandler(cb: ((state: HubConnectionState) => void) | null): void {
    this.onStateChange = cb;
  }

  async start(sessionId: number): Promise<void> {
    if (this.connection.state !== signalR.HubConnectionState.Disconnected) {
      throw new Error(
        `[SignalR] Cannot start: connection is in state "${this.connection.state}"`
      );
    }

    this.currentSessionId = sessionId;
    this.emitState('connecting');

    try {
      await this.connection.start();
      this.emitState('connected');
    } catch (err: unknown) {
      this.currentSessionId = null;
      this.emitState('disconnected');
      const message =
        err instanceof Error ? err.message : 'Unknown connection error';
      throw new Error(`[SignalR] Connection failed: ${message}`, {
        cause: err,
      });
    }

    try {
      await this.connection.invoke('JoinSession', String(sessionId));
    } catch (err: unknown) {
      await this.connection.stop();
      this.currentSessionId = null;
      this.emitState('disconnected');

      const message = err instanceof Error ? err.message : 'Unknown join error';
      throw new Error(
        `[SignalR] Connected but failed to join session ${sessionId}: ${message}`,
        { cause: err }
      );
    }
  }

  async stop(): Promise<void> {
    if (
      this.currentSessionId !== null &&
      this.connection.state === signalR.HubConnectionState.Connected
    ) {
      try {
        await this.connection.invoke('LeaveSession', String(this.currentSessionId));
      } catch (err: unknown) {
        console.warn('[SignalR] LeaveSession failed (non-fatal):', err);
      }
    }

    this.currentSessionId = null;

    if (this.connection.state !== signalR.HubConnectionState.Disconnected) {
      await this.connection.stop();
    }

    this.emitState('disconnected');
  }

  onMeasurement(cb: (block: MeasurementBlock) => void): void {
    if (this.measurementHandler !== null) {
      this.connection.off('MeasurementReceived', this.measurementHandler);
    }

    this.measurementHandler = cb;
    this.connection.on('MeasurementReceived', this.measurementHandler);
  }

  offMeasurement(): void {
    if (this.measurementHandler !== null) {
      this.connection.off('MeasurementReceived', this.measurementHandler);
      this.measurementHandler = null;
    }
  }

  private emitState(state: HubConnectionState): void {
    this.onStateChange?.(state);
  }
}

export function createHubClient(
  baseUrl: string,
  options?: MeasurementHubClientOptions
): MeasurementHubClient {
  return new MeasurementHubClient(baseUrl, options);
}
