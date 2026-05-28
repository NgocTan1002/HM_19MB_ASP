using System.Net.Http.Json;
using System.Text.Json;
using HM_19MB_Core;

Console.WriteLine("=== HM Serial Agent ===");

string apiBase = args.Length > 0 ? args[0] : "http://localhost:5135";
string portName = args.Length > 1 ? args[1] : "COM5";
int sessionId = args.Length > 2 ? int.Parse(args[2]) : 0;

// Nếu chưa có session, tạo mới
if (sessionId == 0)
{
    using var http = new HttpClient();
    var resp = await http.PostAsJsonAsync($"{apiBase}/api/sessions",
        new { TenThietBi = "Tủ nhiệt", NgayHieuChuan = DateTime.Today });

    var body = await resp.Content.ReadAsStringAsync();
    Console.WriteLine($"Status: {resp.StatusCode}");
    Console.WriteLine($"Body: {body}");
    resp.EnsureSuccessStatusCode();

    using var json = JsonDocument.Parse(body);
    sessionId = json.RootElement.GetProperty("id").GetInt32();
    Console.WriteLine($"Tạo session mới: ID = {sessionId}");
}

Console.WriteLine($"Kết nối {portName} → {apiBase}/api/sessions/{sessionId}/measurements");

using var reader = new SerialReader();
using var client = new HttpClient();

reader.BlockReceived += async (_, block) =>
{
    try
    {
        await client.PostAsJsonAsync(
            $"{apiBase}/api/sessions/{sessionId}/measurements", block);
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Gửi: T={block.AvgTemperature:F1}°C");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Lỗi gửi: {ex.Message}");
    }
};

reader.ErrorOccurred += (_, msg) => Console.WriteLine($"Serial error: {msg}");
reader.Connect(portName);

Console.WriteLine("Đang chạy... Nhấn Ctrl+C để dừng.");
await Task.Delay(Timeout.Infinite);
