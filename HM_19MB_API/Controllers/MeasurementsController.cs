using HM_19MB_API.Services;
using HM_19MB_Core;
using HM_19MB_Core.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/sessions/{sessionId}/[controller]")]
    public class MeasurementsController : Controller
    {
        private readonly MeasurementIngestionService _ingestion;
        private readonly MeasurementRunState _runState;
        private readonly IMemoryCache _cache;

        public MeasurementsController(
            MeasurementIngestionService ingestion,
            MeasurementRunState runState,
            IMemoryCache cache)
        {
            _ingestion = ingestion;
            _runState = runState;
            _cache = cache;
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
            var result = await _ingestion.IngestAsync(sessionId, block);

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

        [HttpGet]
        public async Task<IActionResult> Get(int sessionId)
        {
            var data = await _cache.GetOrCreateAsync(
                CacheKeys.Measurements(sessionId),
                async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow =
                        TimeSpan.FromSeconds(10);

                    return await DatabaseService
                        .LayKetQuaTheoPhienAsync(sessionId);
                });

            return Ok(data);
        }
    }
}
