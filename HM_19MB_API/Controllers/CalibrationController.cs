using HM_19MB_Core.Data;
using HM_19MB_API.Services;
using HM_19MB_Core.Models;
using HM_19MB_Core.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/sessions/{sessionId}/calibration")]
    public class CalibrationController : Controller
    {
        private readonly IMemoryCache _cache;

        public CalibrationController(IMemoryCache cache)
        {
            _cache = cache;
        }

        [HttpPost("calculate")]
        public IActionResult Calculate([FromBody] UncertaintyInput input)
        {
            var (isValid, error) = input.Validate();
            if (!isValid) return BadRequest(new { error });

            var result = UncertaintyService.Calculate(input);
            return Ok(result);
        }

        [HttpPost("results")]
        public async Task<IActionResult> SaveResult(int sessionId,
            [FromBody] CalibrationResultRow row)
        {
            await DatabaseService.EnsureSchemaAsync();
            var id = await DatabaseService.LuuKetQuaHieuChuanAsync(sessionId, row);
            if (id > 0 && row.ChiTietLanDos?.Count > 0)
                await DatabaseService.LuuChiTietLanDoAsync(id, row.ChiTietLanDos);

            _cache.Remove(CacheKeys.CalibrationResults(sessionId));
            _cache.Remove(CacheKeys.Sessions);
            if (id > 0)
            {
                _cache.Remove(CacheKeys.CalibrationDetails(id));
            }

            return Ok(new { id });
        }

        [HttpGet("results")]
        public async Task<IActionResult> GetResults(int sessionId)
        {
            var rows = await _cache.GetOrCreateAsync(
                CacheKeys.CalibrationResults(sessionId),
                async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow =
                        TimeSpan.FromMinutes(1);

                    return await DatabaseService
                        .LayKetQuaHieuChuanAsync(sessionId);
                }) ?? [];

            var response = rows.Select(row => new
            {
                id = row.Id,
                stt = row.STT,
                giaTriDat = ToJsonNumber(row.GiaTriDat),
                giaTriChiThi = ToJsonNumber(row.GiaTriChiThi),
                kenh = row.Kenh.Select(ToJsonNumber).ToArray(),
                giaTriTrungBinh = ToJsonNumber(row.GiaTriTrungBinh),
                soHieuChinh = ToJsonNumber(row.SoHieuChinh),
                doOnDinh = ToJsonNumber(row.DoOnDinh),
                doDongDeu = ToJsonNumber(row.DoDongDeu),
                doKhongDamBao = ToJsonNumber(row.DoKhongDamBao),
                uch = ToJsonNumber(row.Uch),
                ubk = ToJsonNumber(row.Ubk),
                soKenh = row.SoKenh,
                soLanDo = row.SoLanDo,
                phuongPhapB = row.PhuongPhapB,
                doPhanGiai = ToJsonNumber(row.DoPhanGiai),
                heSoPhanGiai = ToJsonNumber(row.HeSoPhanGiai),
                thongSoChuanJson = row.ThongSoChuanJson,
                soKenhHopLe = row.SoKenhHopLe
            });

            return Ok(response);
        }

        [HttpDelete("results/{stt}")]
        public async Task<IActionResult> DeleteResult(int sessionId, int stt)
        {
            var rows = await DatabaseService.LayKetQuaHieuChuanAsync(sessionId);
            var resultId = rows
                .FirstOrDefault(row => row.STT == stt)
                ?.Id;

            await DatabaseService.XoaKetQuaHieuChuanAsync(sessionId, stt);

            _cache.Remove(CacheKeys.CalibrationResults(sessionId));
            _cache.Remove(CacheKeys.Sessions);
            if (resultId is > 0)
            {
                _cache.Remove(CacheKeys.CalibrationDetails(resultId.Value));
            }

            return NoContent();
        }

        [HttpGet("results/{id}/details")]
        public async Task<IActionResult> GetDetails(int sessionId, int id)
        {
            _ = sessionId;
            var details = await _cache.GetOrCreateAsync(
                CacheKeys.CalibrationDetails(id),
                async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow =
                        TimeSpan.FromMinutes(2);

                    return await DatabaseService.LayChiTietLanDoAsync(id);
                }) ?? [];

            var response = details.Select(detail => new
            {
                lanDo = detail.LanDo,
                kenh = detail.Kenh,
                giaTri = ToJsonNumber(detail.GiaTri),
                chiThiUut = ToJsonNumber(detail.ChiThiUut),
                kenhValues = detail.KenhValues?.Select(ToJsonNumber).ToArray()
            });

            return Ok(response);
        }

        private static double? ToJsonNumber(double value)
            => double.IsFinite(value) ? value : null;

        private static double? ToJsonNumber(double? value)
            => value.HasValue && double.IsFinite(value.Value) ? value.Value : null;
    }
}
