using System.Net.Http.Json;
using HM_19MB_Core;

Console.WriteLine("=== HM Serial Agent ===");

string apiBase = args.Length > 0 ? args[0] : "http://localhost:5135";
string portName = args.Length > 1 ? args[1] : "COM5";
int fixedSessionId = 0;
string deviceId = "u01";

if (args.Length > 2)
{
    if (int.TryParse(args[2], out var parsedSessionId) && parsedSessionId > 0)
    {
        fixedSessionId = parsedSessionId;
        deviceId = args.Length > 3 ? args[3] : deviceId;
    }
    else
    {
        deviceId = args[2];
    }
}

Console.WriteLine($"API: {apiBase}");
Console.WriteLine($"COM: {portName}");

if (fixedSessionId > 0)
{
    Console.WriteLine($"Mode: fixed session {fixedSessionId}");
}
else
{
    Console.WriteLine($"Mode: device-controlled ({deviceId})");
    Console.WriteLine("Web se gan device vao phien do khi bam Ket noi/Ket noi lai.");
}

using var reader = new SerialReader();
using var client = new HttpClient();

var statusCheckedAt = DateTime.MinValue;
var cachedActiveSessionId = 0;
var waitingLogged = false;
var lastLoggedSessionId = 0;

async Task<int?> GetActiveSessionIdAsync()
{
    if ((DateTime.UtcNow - statusCheckedAt).TotalMilliseconds < 1000)
    {
        return cachedActiveSessionId > 0 ? cachedActiveSessionId : null;
    }

    statusCheckedAt = DateTime.UtcNow;

    try
    {
        if (fixedSessionId > 0)
        {
            var statusUrl = $"{apiBase}/api/sessions/{fixedSessionId}/measurements/status";
            var status = await client.GetFromJsonAsync<MeasurementStatus>(statusUrl);
            cachedActiveSessionId = status?.Active == true ? fixedSessionId : 0;
        }
        else
        {
            var statusUrl =
                $"{apiBase}/api/measurement-runs/{Uri.EscapeDataString(deviceId)}/status";
            var status = await client.GetFromJsonAsync<MeasurementRunStatus>(statusUrl);
            cachedActiveSessionId =
                status?.Active == true && status.SessionId.HasValue
                    ? status.SessionId.Value
                    : 0;
        }

        if (cachedActiveSessionId <= 0 && !waitingLogged)
        {
            Console.WriteLine("Dang cho web bam Ket noi de bat dau ghi du lieu...");
            waitingLogged = true;
        }

        if (cachedActiveSessionId > 0 && cachedActiveSessionId != lastLoggedSessionId)
        {
            Console.WriteLine($"Phien do {cachedActiveSessionId} da active. Bat dau gui du lieu.");
            waitingLogged = false;
            lastLoggedSessionId = cachedActiveSessionId;
        }

        return cachedActiveSessionId > 0 ? cachedActiveSessionId : null;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Loi kiem tra trang thai phien do: {ex.Message}");
        cachedActiveSessionId = 0;
        return null;
    }
}

reader.BlockReceived += async (_, block) =>
{
    try
    {
        var activeSessionId = await GetActiveSessionIdAsync();
        if (!activeSessionId.HasValue)
        {
            return;
        }

        var payload = CreateJsonSafeBlock(block);
        var measurementUrl =
            $"{apiBase}/api/sessions/{activeSessionId.Value}/measurements";
        await client.PostAsJsonAsync(measurementUrl, payload);
        Console.WriteLine(
            $"[{DateTime.Now:HH:mm:ss}] Gui vao phien {activeSessionId.Value}: T={block.AvgTemperature:F1}C"
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
        AvgTemperature = ToFiniteOrZero(source.AvgTemperature),
        AvgHumidity = source.HasHumidity ? ToFiniteOrZero(source.AvgHumidity) : 0f,
        UniformityTemp = ToFiniteOrZero(source.UniformityTemp),
        UniformityHumidity = source.HasHumidity ? ToFiniteOrZero(source.UniformityHumidity) : 0f,
        HasHumidity = source.HasHumidity,
        StabilityTemperature = source.StabilityTemperature,
        StabilityHumidity = source.StabilityHumidity,
        StabilityRaw = source.StabilityRaw,
    };

    for (int i = 0; i < block.ProbeTemperatures.Length; i++)
    {
        block.ProbeTemperatures[i] =
            i < source.ProbeCount ? ToFiniteOrZero(source.ProbeTemperatures[i]) : 0f;
        block.ProbeHumidities[i] =
            source.HasHumidity && i < source.ProbeCount
                ? ToFiniteOrZero(source.ProbeHumidities[i])
                : 0f;
    }

    return block;
}

static float ToFiniteOrZero(float value)
    => float.IsFinite(value) ? value : 0f;

record MeasurementStatus(int SessionId, bool Active);
record MeasurementRunStatus(int? SessionId, string DeviceId, bool Active);
