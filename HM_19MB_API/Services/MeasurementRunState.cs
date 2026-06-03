using System.Collections.Concurrent;

namespace HM_19MB_API.Services;

public sealed class MeasurementRunState
{
    private readonly ConcurrentDictionary<int, bool> _activeSessions = new();
    private readonly ConcurrentDictionary<string, int> _activeDeviceSessions = new();

    public bool IsActive(int sessionId)
        => _activeSessions.TryGetValue(sessionId, out var active) && active;

    public void Start(int sessionId)
        => _activeSessions[sessionId] = true;

    public void Stop(int sessionId)
        => _activeSessions[sessionId] = false;

    public void StartDeviceSession(string deviceId, int sessionId)
    {
        var normalizedDeviceId = NormalizeDeviceId(deviceId);
        if (_activeDeviceSessions.TryGetValue(normalizedDeviceId, out var previousSessionId))
        {
            Stop(previousSessionId);
        }

        _activeDeviceSessions[normalizedDeviceId] = sessionId;
        Start(sessionId);
    }

    public bool TryGetActiveSessionId(string deviceId, out int sessionId)
    {
        if (_activeDeviceSessions.TryGetValue(NormalizeDeviceId(deviceId), out sessionId))
        {
            return IsActive(sessionId);
        }

        sessionId = 0;
        return false;
    }

    public bool StopDeviceSession(string deviceId, out int sessionId)
    {
        if (_activeDeviceSessions.TryRemove(NormalizeDeviceId(deviceId), out sessionId))
        {
            Stop(sessionId);
            return true;
        }

        sessionId = 0;
        return false;
    }

    private static string NormalizeDeviceId(string deviceId)
        => deviceId.Trim().ToUpperInvariant();
}
