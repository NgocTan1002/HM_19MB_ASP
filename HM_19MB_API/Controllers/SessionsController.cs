using HM_19MB_Core.Data;
using HM_19MB_API.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.Mvc;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SessionsController : ControllerBase
    {
        private readonly IMemoryCache _cache;

        public SessionsController(IMemoryCache cache)
        {
            _cache = cache;
        }

        [HttpGet]
        public async Task<IActionResult> GetList()
        {
            var sessions = await _cache.GetOrCreateAsync(
                CacheKeys.Sessions,
                async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow =
                        TimeSpan.FromSeconds(30);

                    await DatabaseService.EnsureSchemaAsync();
                    return await DatabaseService.LayDanhSachPhienAsync();
                });

            return Ok(sessions);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SessionMetadata meta)
        {
            await DatabaseService.EnsureSchemaAsync();
            var id = await DatabaseService.TaoPhienMoiAsync(meta);

            _cache.Remove(CacheKeys.Sessions);
            return Ok(new { id });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var meta = await _cache.GetOrCreateAsync(
                CacheKeys.Session(id),
                async entry =>
                {
                    entry.SlidingExpiration = TimeSpan.FromMinutes(2);
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);

                    return await DatabaseService.LayPhienAsync(id);
                });

            return meta is null ? NotFound() : Ok(meta);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] SessionMetadata meta)
        {
            await DatabaseService.CapNhatPhienAsync(id, meta);
            _cache.Remove(CacheKeys.Session(id));
            _cache.Remove(CacheKeys.Sessions);

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var calibrationRows =
                await DatabaseService.LayKetQuaHieuChuanAsync(id);

            await DatabaseService.XoaPhienAsync(id);

            _cache.Remove(CacheKeys.Session(id));
            _cache.Remove(CacheKeys.Measurements(id));
            _cache.Remove(CacheKeys.CalibrationResults(id));
            foreach (var row in calibrationRows)
            {
                _cache.Remove(CacheKeys.CalibrationDetails(row.Id));
            }

            _cache.Remove(CacheKeys.Sessions);

            return NoContent();
        }
    }
}
