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
            await ReportGenerator.ExportToExcelAsync(sessionId, tempFile, kenhCount);
            var bytes = await System.IO.File.ReadAllBytesAsync(tempFile);
            System.IO.File.Delete(tempFile);
            return File(bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"BaoCao_{sessionId}.xlsx");
        }

        [HttpGet("word")]
        public async Task<IActionResult> Word(int sessionId)
        {
            var tempFile = Path.GetTempFileName() + ".docx";
            await ReportGenerator.ExportToWordAsync(sessionId, tempFile);
            var bytes = await System.IO.File.ReadAllBytesAsync(tempFile);
            System.IO.File.Delete(tempFile);
            return File(bytes,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                $"BaoCao_{sessionId}.docx");
        }
    }
}
