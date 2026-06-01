using System.Net.Http.Json;
using HM_19MB_Core;

Console.WriteLine("=== HM Serial Agent ===");

string apiBase = args.Length > 0 ? args[0] : "http://localhost:5135";
string portName = args.Length > 1 ? args[1] : "COM5";
int sessionId = args.Length > 2 ? int.Parse(args[2]) : 0;

if (sessionId == 0)
{
    Console.WriteLine("Chưa có sessionId.");
    Console.WriteLine("Hãy tạo hoặc chọn phiên đo trên web trước, sau đó chạy Agent với ID phiên đó.");
    Console.WriteLine("Ví dụ:");
    Console.WriteLine("  dotnet run --project HM_19MB_Agent -- http://localhost:5135 COM5 12");
    return;
}

Console.WriteLine($"Kết nối {portName} → {apiBase}/api/sessions/{sessionId}/measurements");

using var reader = new SerialReader();
using var client = new HttpClient();

var measurementUrl = $"{apiBase}/api/sessions/{sessionId}/measurements";
var statusUrl = $"{measurementUrl}/status";
var isActive = false;
var statusCheckedAt = DateTime.MinValue;
var waitingLogged = false;

async Task<bool> IsMeasurementActiveAsync()
{
    if ((DateTime.UtcNow - statusCheckedAt).TotalMilliseconds < 1000)
        return isActive;

    statusCheckedAt = DateTime.UtcNow;

    try
    {
        var status = await client.GetFromJsonAsync<MeasurementStatus>(statusUrl);
        isActive = status?.Active == true;

        if (!isActive && !waitingLogged)
        {
            Console.WriteLine("Đang chờ web bấm Kết nối để bắt đầu ghi dữ liệu...");
            waitingLogged = true;
        }

        if (isActive && waitingLogged)
        {
            Console.WriteLine("Phiên đo đã active. Bắt đầu gửi dữ liệu.");
            waitingLogged = false;
        }

        return isActive;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Lỗi kiểm tra trạng thái phiên đo: {ex.Message}");
        isActive = false;
        return false;
    }
}

reader.BlockReceived += async (_, block) =>
{
    try
    {
        if (!await IsMeasurementActiveAsync())
            return;

        await client.PostAsJsonAsync(measurementUrl, block);
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

record MeasurementStatus(int SessionId, bool Active);
