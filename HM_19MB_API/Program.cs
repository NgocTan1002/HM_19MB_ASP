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

builder.Services.Configure<MqttOptions>(
    builder.Configuration.GetSection("Mqtt"));
builder.Services.AddHostedService<MqttBackgroundService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5173"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors("AllowFrontend");
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapHub<MeasurementHub>("/hubs/measurement");

app.Run(); ;
