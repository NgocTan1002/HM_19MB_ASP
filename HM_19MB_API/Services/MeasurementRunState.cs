using System.Collections.Concurrent;

namespace HM_19MB_API.Services;

public sealed class MeasurementRunState
{
    private readonly ConcurrentDictionary<int, bool> _activeSessions = new();

    public bool IsActive(int sessionId)
        => _activeSessions.TryGetValue(sessionId, out var active) && active;

    public void Start(int sessionId)
        => _activeSessions[sessionId] = true;

    public void Stop(int sessionId)
        => _activeSessions[sessionId] = false;
}
