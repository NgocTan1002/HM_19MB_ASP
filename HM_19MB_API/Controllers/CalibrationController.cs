using HM_19MB_Core.Data;
using HM_19MB_Core.Models;
using HM_19MB_Core.Services;
using Microsoft.AspNetCore.Mvc;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/sessions/{sessionId}/calibration")]
    public class CalibrationController : Controller
    {
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
            return Ok(new { id });
        }

        [HttpGet("results")]
        public async Task<IActionResult> GetResults(int sessionId)
        {
            var rows = await DatabaseService.LayKetQuaHieuChuanAsync(sessionId);
            return Ok(rows);
        }

        [HttpDelete("results/{stt}")]
        public async Task<IActionResult> DeleteResult(int sessionId, int stt)
        {
            await DatabaseService.XoaKetQuaHieuChuanAsync(sessionId, stt);
            return NoContent();
        }

        [HttpGet("results/{id}/details")]
        public async Task<IActionResult> GetDetails(int sessionId, int id)
        {
            _ = sessionId;
            var details = await DatabaseService.LayChiTietLanDoAsync(id);
            return Ok(details);
        }
    }
}
