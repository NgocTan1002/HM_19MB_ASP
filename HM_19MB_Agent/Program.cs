using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using HM_19MB_Core;

Console.WriteLine("=== HM Serial Agent ===");

string apiBase = args.Length > 0 ? args[0] : "http://localhost:5135";
string portName = args.Length > 1 ? args[1] : "COM5";

Console.WriteLine($"API: {apiBase}");
Console.WriteLine($"COM: {portName}");
Console.WriteLine("Mode: auto device id from measurement frame");
Console.WriteLine("Web se tao phien cho. Agent se tu gan thiet bi vao phien khi nhan frame dau tien.");

using var reader = new SerialReader();
using var client = new HttpClient();
var jsonOptions = new JsonSerializerOptions
{
    NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
    PropertyNameCaseInsensitive = true
};

var waitingLogged = false;

reader.BlockReceived += async (_, block) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(block.DeviceId))
        {
            Console.WriteLine("Bo qua frame vi khong doc duoc DeviceId.");
            return;
        }

        var payload = CreateJsonSafeBlock(block);
        var measurementUrl =
            $"{apiBase}/api/measurement-runs/{Uri.EscapeDataString(block.DeviceId)}/measurements";
        var response = await client.PostAsJsonAsync(measurementUrl, payload, jsonOptions);
        var responseText = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine(
                $"Loi gui HTTP {(int)response.StatusCode}: {response.ReasonPhrase}. {responseText}"
            );
            return;
        }

        var result = string.IsNullOrWhiteSpace(responseText)
            ? null
            : JsonSerializer.Deserialize<MeasurementPostResult>(
                responseText,
                jsonOptions);

        if (result?.Ignored == true)
        {
            if (!waitingLogged)
            {
                Console.WriteLine("Dang cho web tao/ket noi phien do de bat dau ghi du lieu...");
                waitingLogged = true;
            }

            return;
        }

        waitingLogged = false;
        Console.WriteLine(
            $"[{DateTime.Now:HH:mm:ss}] Gui {block.DeviceId}: T={block.AvgTemperature:F1}C"
        );
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Loi gui: {ex.Message}");
    }
};

reader.ErrorOccurred += (_, msg) => Console.WriteLine($"Serial error: {msg}");
reader.Connect(portName);

Console.WriteLine("Dang chay... Nhan Ctrl+C de dung.");
await Task.Delay(Timeout.Infinite);

static MeasurementBlock CreateJsonSafeBlock(MeasurementBlock source)
{
    var block = new MeasurementBlock
    {
        DeviceId = source.DeviceId,
        Timestamp = source.Timestamp,
        ProbeCount = source.ProbeCount,
        AvgTemperature = source.AvgTemperature,
        AvgHumidity = source.HasHumidity ? source.AvgHumidity : float.NaN,
        UniformityTemp = source.UniformityTemp,
        UniformityHumidity = source.HasHumidity ? source.UniformityHumidity : float.NaN,
        HasHumidity = source.HasHumidity,
        StabilityTemperature = source.StabilityTemperature,
        StabilityHumidity = source.StabilityHumidity,
        StabilityRaw = source.StabilityRaw,
    };

    for (int i = 0; i < block.ProbeTemperatures.Length; i++)
    {
        block.ProbeTemperatures[i] =
            i < source.ProbeCount ? source.ProbeTemperatures[i] : float.NaN;
        block.ProbeHumidities[i] =
            source.HasHumidity && i < source.ProbeCount
                ? source.ProbeHumidities[i]
                : float.NaN;
    }

    return block;
}

record MeasurementPostResult(int? Id, bool Ignored, string? Reason);
