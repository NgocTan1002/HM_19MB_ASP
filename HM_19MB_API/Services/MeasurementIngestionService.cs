using HM_19MB_API.Hubs;
using HM_19MB_Core;
using HM_19MB_Core.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;

namespace HM_19MB_API.Services;

public sealed class MeasurementIngestionService
{
    private readonly IHubContext<MeasurementHub> _hub;
    private readonly MeasurementRunState _runState;
    private readonly IMemoryCache _cache;

    public MeasurementIngestionService(
        IHubContext<MeasurementHub> hub,
        MeasurementRunState runState,
        IMemoryCache cache)
    {
        _hub = hub;
        _runState = runState;
        _cache = cache;
    }

    public async Task<MeasurementIngestionResult> IngestAsync(
        int sessionId,
        MeasurementBlock block)
    {
        if (!_runState.IsActive(sessionId))
        {
            return new MeasurementIngestionResult(
                Id: null,
                Ignored: true,
                Reason: "Measurement session is not active");
        }

        await DatabaseService.EnsureSchemaAsync();

        var id = await DatabaseService.LuuKetQuaDoAsync(
            sessionId,
            block,
            includeHumidity: block.HasHumidity);

        _cache.Remove(CacheKeys.Measurements(sessionId));
        _cache.Remove(CacheKeys.Sessions);

        await _hub.Clients
            .Group($"Session_{sessionId}")
            .SendAsync("MeasurementReceived", block);

        return new MeasurementIngestionResult(
            Id: id,
            Ignored: false,
            Reason: null);
    }

    public Task<MeasurementIngestionResult> IngestFromDeviceAsync(
        string deviceId,
        MeasurementBlock block)
    {
        if (!_runState.TryGetActiveSessionId(deviceId, out var sessionId) &&
            !_runState.TryAssignPendingDeviceSession(deviceId, out sessionId))
        {
            return Task.FromResult(new MeasurementIngestionResult(
                Id: null,
                Ignored: true,
                Reason: "Device does not have an active measurement session"));
        }

        return IngestAsync(sessionId, block);
    }
}

public sealed record MeasurementIngestionResult(
    int? Id,
    bool Ignored,
    string? Reason);
