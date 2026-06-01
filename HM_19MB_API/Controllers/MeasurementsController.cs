using HM_19MB_API.Hubs;
using HM_19MB_API.Services;
using HM_19MB_Core;
using HM_19MB_Core.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/sessions/{sessionId}/[controller]")]
    public class MeasurementsController : Controller
    {
        private readonly IHubContext<MeasurementHub> _hub;
        private readonly MeasurementRunState _runState;

        public MeasurementsController(
            IHubContext<MeasurementHub> hub,
            MeasurementRunState runState)
        {
            _hub = hub;
            _runState = runState;
        }

        [HttpPost("start")]
        public IActionResult Start(int sessionId)
        {
            _runState.Start(sessionId);
            return Ok(new { sessionId, active = true });
        }

        [HttpPost("stop")]
        public IActionResult Stop(int sessionId)
        {
            _runState.Stop(sessionId);
            return Ok(new { sessionId, active = false });
        }

        [HttpGet("status")]
        public IActionResult Status(int sessionId)
        {
            return Ok(new { sessionId, active = _runState.IsActive(sessionId) });
        }

        [HttpPost]
        public async Task<IActionResult> Post(
            int sessionId,
            [FromBody] MeasurementBlock block)
        {
            if (!_runState.IsActive(sessionId))
            {
                return Ok(new
                {
                    id = (int?)null,
                    ignored = true,
                    reason = "Measurement session is not active"
                });
            }

            await DatabaseService.EnsureSchemaAsync();
            var id = await DatabaseService.LuuKetQuaDoAsync(
                sessionId, block, includeHumidity: true);

            await _hub.Clients
                .Group($"Session_{sessionId}")
                .SendAsync("MeasurementReceived", block);

            return Ok(new { id });
        }

        [HttpGet]
        public async Task<IActionResult> Get(int sessionId)
        {
            var data = await DatabaseService.LayKetQuaTheoPhienAsync(sessionId);
            return Ok(data);
        }
    }
}
