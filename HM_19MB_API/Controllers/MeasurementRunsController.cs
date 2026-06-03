using HM_19MB_API.Services;
using HM_19MB_Core.Data;
using Microsoft.AspNetCore.Mvc;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/measurement-runs")]
    public class MeasurementRunsController : ControllerBase
    {
        private readonly MeasurementRunState _runState;

        public MeasurementRunsController(MeasurementRunState runState)
        {
            _runState = runState;
        }

        [HttpPost("start")]
        public async Task<IActionResult> Start([FromBody] StartMeasurementRunRequest request)
        {
            var deviceId = request.DeviceId.Trim();
            if (string.IsNullOrWhiteSpace(deviceId))
            {
                return BadRequest(new { error = "DeviceId is required" });
            }

            await DatabaseService.EnsureSchemaAsync();
            var sessionId = await DatabaseService.TaoPhienMoiAsync(request.Metadata);
            _runState.StartDeviceSession(deviceId, sessionId);

            return Ok(new
            {
                sessionId,
                deviceId,
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
    }

    public sealed class StartMeasurementRunRequest
    {
        public string DeviceId { get; set; } = "";
        public SessionMetadata Metadata { get; set; } = new();
    }
}
