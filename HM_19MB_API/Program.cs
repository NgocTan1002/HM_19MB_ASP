using HM_19MB_Core.Data;
using HM_19MB_API.Hubs;
using HM_19MB_API.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.NumberHandling =
            JsonNumberHandling.AllowNamedFloatingPointLiterals;
    });
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.NumberHandling =
            JsonNumberHandling.AllowNamedFloatingPointLiterals;
    });

builder.Services.AddMemoryCache();
builder.Services.AddSingleton<MeasurementRunState>();
builder.Services.AddSingleton<MeasurementIngestionService>();
builder.Services.AddSingleton<SystemSettingsService>();
builder.Services.AddSingleton<MqttReconnectSignal>();
builder.Services.AddSingleton<AuthService>();

builder.Services.Configure<MqttOptions>(
    builder.Configuration.GetSection("Mqtt"));
builder.Services.AddHostedService<MqttBackgroundService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
            (uri.Host is "localhost" or "127.0.0.1") &&
            (uri.Port == 3000 || uri.Port is >= 5173 and <= 5190))
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var postgresConnection =
    builder.Configuration.GetConnectionString("Postgres")
    ?? Environment.GetEnvironmentVariable("POSTGRES_CONN");

if (string.IsNullOrWhiteSpace(postgresConnection))
{
    throw new InvalidOperationException("Missing ConnectionStrings:Postgres.");
}

DatabaseService.ConfigureConnectionString(postgresConnection);

var app = builder.Build();

app.UseCors("AllowFrontend");
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapHub<MeasurementHub>("/hubs/measurement");

app.Run(); ;
