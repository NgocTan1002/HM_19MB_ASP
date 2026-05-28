using HM_19MB_Core.Data;
using Microsoft.AspNetCore.Mvc;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/sessions/{sessionId}/reports")]
    public class ReportsController : Controller
    {
        [HttpGet("excel")]
        public async Task<IActionResult> Excel(int sessionId, [FromQuery] int kenhCount = 3)
        {
            var tempFile = Path.GetTempFileName() + ".xlsx";
            await ReportGenerator.ExportToExcelAsync(sessionId, tempFile);
            var bytes = await System.IO.File.ReadAllBytesAsync(tempFile);
            System.IO.File.Delete(tempFile);
            return File(bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"BaoCao_{sessionId}.xlsx");
        }
    }
}
