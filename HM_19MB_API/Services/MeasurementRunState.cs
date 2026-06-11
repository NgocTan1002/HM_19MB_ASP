using System.Collections.Concurrent;

namespace HM_19MB_API.Services;

public sealed class MeasurementRunState
{
    private readonly ConcurrentDictionary<int, bool> _activeSessions = new();
    private readonly ConcurrentDictionary<string, int> _activeDeviceSessions = new();
    private readonly object _pendingLock = new();
    private int? _pendingAutoSessionId;

    public bool IsActive(int sessionId)
        => _activeSessions.TryGetValue(sessionId, out var active) && active;

    public void Start(int sessionId)
        => _activeSessions[sessionId] = true;

    public void Stop(int sessionId)
    {
        _activeSessions[sessionId] = false;

        lock (_pendingLock)
        {
            if (_pendingAutoSessionId == sessionId)
            {
                _pendingAutoSessionId = null;
            }
        }
    }

    public void StartAutoSession(int sessionId)
    {
        lock (_pendingLock)
        {
            _pendingAutoSessionId = sessionId;
        }

        Start(sessionId);
    }

    public void StartDeviceSession(string deviceId, int sessionId)
    {
        var normalizedDeviceId = NormalizeDeviceId(deviceId);
        if (_activeDeviceSessions.TryGetValue(normalizedDeviceId, out var previousSessionId))
        {
            Stop(previousSessionId);
        }

        _activeDeviceSessions[normalizedDeviceId] = sessionId;
        lock (_pendingLock)
        {
            if (_pendingAutoSessionId == sessionId)
            {
                _pendingAutoSessionId = null;
            }
        }

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

    public bool TryAssignPendingDeviceSession(string deviceId, out int sessionId)
    {
        var normalizedDeviceId = NormalizeDeviceId(deviceId);
        if (string.IsNullOrWhiteSpace(normalizedDeviceId))
        {
            sessionId = 0;
            return false;
        }

        lock (_pendingLock)
        {
            if (_pendingAutoSessionId is not { } pendingSessionId ||
                !IsActive(pendingSessionId))
            {
                sessionId = 0;
                return false;
            }

            _activeDeviceSessions[normalizedDeviceId] = pendingSessionId;
            _pendingAutoSessionId = null;
            sessionId = pendingSessionId;
            return true;
        }
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
