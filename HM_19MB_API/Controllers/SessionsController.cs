using HM_19MB_Core.Data;
using Microsoft.AspNetCore.Mvc;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SessionsController : ControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SessionMetadata meta)
        {
            await DatabaseService.EnsureSchemaAsync();
            var id = await DatabaseService.TaoPhienMoiAsync(meta);
            return Ok(new { id });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var meta = await DatabaseService.LayPhienAsync(id);
            if(meta == null) return NotFound();
            return Ok(meta);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] SessionMetadata meta)
        {
            await DatabaseService.CapNhatPhienAsync(id, meta);
            return NoContent();
        }
    }
}
