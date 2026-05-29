# Phase 1 Common Issues

## CORS Error

Symptom: browser console shows blocked requests from `http://localhost:5173`.

Check `HM_19MB_API/Program.cs`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5173"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

app.UseCors("AllowFrontend");
```

Make sure `app.UseCors("AllowFrontend")` is before `app.MapControllers()` and `app.MapHub<MeasurementHub>()`.

## SignalR 404

Symptom: `/hubs/measurement/negotiate` or WebSocket connection returns `404`.

Check backend route:

```csharp
app.MapHub<MeasurementHub>("/hubs/measurement");
```

Check frontend hub URL:

```ts
const hubUrl = baseUrl.replace(/\/$/, '') + '/hubs/measurement';
```

The base URL should be `http://localhost:5135`, not the frontend URL.

## Group Mismatch

Symptom: SignalR connects successfully but no live measurement event arrives.

Verify group name casing is identical:

```csharp
await Groups.AddToGroupAsync(Context.ConnectionId, $"Session_{sessionId}");
```

```csharp
await _hub.Clients
    .Group($"Session_{sessionId}")
    .SendAsync("MeasurementReceived", block);
```

Add temporary logs in `JoinSession` and `MeasurementsController.Post` to print the exact group name.

## DB Connection Fail

Symptom: API returns `500`, backend logs mention `POSTGRES_CONN`, connection refused, authentication failed, or database not found.

Check the environment variable used by the backend:

```powershell
$env:POSTGRES_CONN
```

It should point to the local PostgreSQL database, for example:

```text
Host=localhost;Port=5432;Database=hm_19mb;Username=postgres;Password=your_password
```

Restart the backend after changing `POSTGRES_CONN`; ASP.NET Core will not automatically pick up environment changes in an already running process.
