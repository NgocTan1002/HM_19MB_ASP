# Phase 1 Smoke Test

## Prerequisites

- PostgreSQL is running locally.
- `POSTGRES_CONN` is set for the backend process.
- Backend is running at `http://localhost:5135`.
- Frontend dependencies are installed in `HM_19MB_Web`.

## Install Test Runner

Run this once from `HM_19MB_Web`:

```bash
npm install -D tsx
```

## Run

From `HM_19MB_Web`:

```bash
npm run test:phase1
```

## What It Tests

- `GET /api/sessions` returns HTTP `200` and an array response.
- `POST /api/sessions` creates a sample session and returns `{ id: number }`.
- SignalR connects to `/hubs/measurement`.
- SignalR invokes `JoinSession`.
- A sample measurement is posted to `/api/sessions/{id}/measurements`.
- The SignalR client receives `MeasurementReceived` for the joined session.
- `DELETE /api/sessions/{id}` returns HTTP `204`.

Each step has a 5 second timeout and logs pass/fail to the console.
