# Phase 1 Manual Checklist

Use this checklist after backend, frontend, and PostgreSQL are running locally.

- [ ] Backend starts without errors at `http://localhost:5135`.
- [ ] Swagger UI opens at `http://localhost:5135/swagger`.
- [ ] Swagger lists `GET /api/sessions`.
- [ ] Swagger lists `DELETE /api/sessions/{id}`.
- [ ] Swagger lists `DELETE /api/sessions/{sessionId}/calibration/results/{stt}`.
- [ ] CORS allows requests from `http://localhost:5173`.
- [ ] SignalR handshake succeeds in DevTools `Network` tab. Filter by `WS` and confirm `/hubs/measurement` connects.
- [ ] `SessionSelector` loads the session list without console errors.
- [ ] Route `/` renders the Dashboard placeholder.
- [ ] Route `/sessions` renders the Sessions placeholder.
- [ ] Route `/sessions/:id/calibration` renders the Calibration placeholder.
- [ ] Sidebar navigation changes routes without React Router errors.
- [ ] SignalR group name is consistent everywhere: `Session_` with uppercase `S`.
- [ ] Backend `MeasurementHub.JoinSession` uses `Session_{sessionId}`.
- [ ] Backend `MeasurementsController` sends `MeasurementReceived` to `Session_{sessionId}`.
- [ ] Frontend `signalr.ts` invokes `JoinSession`, not `JoinSesion`.
