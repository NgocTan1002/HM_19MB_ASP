using HM_19MB_API.Services;
using HM_19MB_Core;
using HM_19MB_Core.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/measurement-runs")]
    public class MeasurementRunsController : ControllerBase
    {
        private readonly MeasurementRunState _runState;
        private readonly MeasurementIngestionService _ingestion;
        private readonly IMemoryCache _cache;

        public MeasurementRunsController(
            MeasurementRunState runState,
            MeasurementIngestionService ingestion,
            IMemoryCache cache)
        {
            _runState = runState;
            _ingestion = ingestion;
            _cache = cache;
        }

        [HttpPost("start")]
        public async Task<IActionResult> Start([FromBody] StartMeasurementRunRequest request)
        {
            var deviceId = request.DeviceId.Trim();

            await DatabaseService.EnsureSchemaAsync();
            var sessionId = await DatabaseService.TaoPhienMoiAsync(request.Metadata);
            _cache.Remove(CacheKeys.Sessions);

            if (string.IsNullOrWhiteSpace(deviceId))
            {
                _runState.StartAutoSession(sessionId);
            }
            else
            {
                _runState.StartDeviceSession(deviceId, sessionId);
            }

            return Ok(new
            {
                sessionId,
                deviceId = string.IsNullOrWhiteSpace(deviceId) ? null : deviceId,
                active = true
            });
        }

        [HttpPost("sessions/{sessionId}/start")]
        public async Task<IActionResult> StartExistingSessionAuto(int sessionId)
        {
            await DatabaseService.EnsureSchemaAsync();
            _runState.StartAutoSession(sessionId);

            return Ok(new
            {
                sessionId,
                deviceId = (string?)null,
                active = true
            });
        }

        [HttpPost("{deviceId}/sessions/{sessionId}/start")]
        public async Task<IActionResult> StartExistingSession(string deviceId, int sessionId)
        {
            var normalizedDeviceId = deviceId.Trim();
            if (string.IsNullOrWhiteSpace(normalizedDeviceId))
            {
                return BadRequest(new { error = "DeviceId is required" });
            }

            await DatabaseService.EnsureSchemaAsync();
            _runState.StartDeviceSession(normalizedDeviceId, sessionId);

            return Ok(new
            {
                sessionId,
                deviceId = normalizedDeviceId,
                active = true
            });
        }

        [HttpPost("{deviceId}/stop")]
        public IActionResult Stop(string deviceId)
        {
            var stopped = _runState.StopDeviceSession(deviceId, out var sessionId);

            return Ok(new
            {
                sessionId = stopped ? sessionId : (int?)null,
                deviceId,
                active = false
            });
        }

        [HttpGet("{deviceId}/status")]
        public IActionResult Status(string deviceId)
        {
            var active = _runState.TryGetActiveSessionId(deviceId, out var sessionId);

            return Ok(new
            {
                sessionId = active ? sessionId : (int?)null,
                deviceId,
                active
            });
        }

        [HttpPost("{deviceId}/measurements")]
        public async Task<IActionResult> PostDeviceMeasurement(
            string deviceId,
            [FromBody] MeasurementBlock block)
        {
            var normalizedDeviceId = string.IsNullOrWhiteSpace(block.DeviceId)
                ? deviceId
                : block.DeviceId;
            var result = await _ingestion.IngestFromDeviceAsync(normalizedDeviceId, block);

            if (result.Ignored)
            {
                return Ok(new
                {
                    id = result.Id,
                    ignored = true,
                    reason = result.Reason
                });
            }

            return Ok(new { id = result.Id });
        }
    }

    public sealed class StartMeasurementRunRequest
    {
        public string DeviceId { get; set; } = "";
        public SessionMetadata Metadata { get; set; } = new();
    }
}
