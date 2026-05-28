using HM_19MB_Core;
using HM_19MB_Core.Data;
using HM_19MB_API.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/sessions/{sessionId}/[controller]")]
    public class MeasurementsController : Controller
    {
        private readonly IHubContext<MeasurementHub> _hub;

        public MeasurementsController(IHubContext<MeasurementHub> hub)
            => _hub = hub;

        [HttpPost]
        public async Task<IActionResult> Post(int sessionId,
              [FromBody] MeasurementBlock block)
        {
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