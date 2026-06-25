using HM_19MB_API.Services;
using Microsoft.AspNetCore.Mvc;
using MQTTnet;

namespace HM_19MB_API.Controllers
{
    [ApiController]
    [Route("api/settings")]
    public sealed class SettingsController : ControllerBase
    {
        private static readonly TimeSpan TestConnectionTimeout =
            TimeSpan.FromSeconds(10);

        private readonly SystemSettingsService _settingsService;
        private readonly MqttReconnectSignal _reconnectSignal;
        private readonly ILogger<SettingsController> _logger;

        public SettingsController(
            SystemSettingsService settingsService,
            MqttReconnectSignal reconnectSignal,
            ILogger<SettingsController> logger)
        {
            _settingsService = settingsService;
            _reconnectSignal = reconnectSignal;
            _logger = logger;
        }

        [HttpGet("mqtt")]
        public async Task<IActionResult> GetMqttSettings(
            CancellationToken cancellationToken)
        {
            try
            {
                var settings =
                    await _settingsService.GetMqttSettingsResponseAsync(cancellationToken);

                return Ok(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load MQTT settings.");
                return Problem("Failed to load MQTT settings.");
            }
        }

        [HttpPut("mqtt")]
        public async Task<IActionResult> UpdateMqttSettings(
            [FromBody] MqttSettingsUpdateRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var settings =
                    await _settingsService.SaveMqttSettingsAsync(
                        request,
                        cancellationToken);

                _reconnectSignal.RequestReconnect();

                return Ok(new MqttSettingsResponse
                {
                    Enabled = settings.Enabled,
                    Host = settings.Host,
                    Port = settings.Port,
                    ClientId = settings.ClientId,
                    Topic = settings.Topic,
                    Username = settings.Username,
                    HasPassword = !string.IsNullOrEmpty(settings.Password),
                    UseTls = settings.UseTls
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save MQTT settings.");
                return Problem("Failed to save MQTT settings.");
            }
        }

        [HttpPost("mqtt/test-connection")]
        public async Task<IActionResult> TestMqttConnection(
            [FromBody] MqttTestConnectionRequest? request,
            CancellationToken cancellationToken)
        {
            try
            {
                var current =
                    await _settingsService.GetMqttSettingsAsync(cancellationToken);
                var settings = _settingsService.MergeTestRequest(current, request);

                if (!settings.Enabled)
                {
                    return Ok(new MqttTestConnectionResponse
                    {
                        Success = true,
                        Message = "MQTT is disabled; connection test skipped."
                    });
                }

                var result =
                    await TestConnectionAsync(settings, cancellationToken);

                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new MqttTestConnectionResponse
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MQTT test connection failed.");
                return Ok(new MqttTestConnectionResponse
                {
                    Success = false,
                    Message = ex.Message
                });
            }
        }

        private static async Task<MqttTestConnectionResponse> TestConnectionAsync(
            MqttRuntimeSettings settings,
            CancellationToken cancellationToken)
        {
            var factory = new MqttClientFactory();
            using var client = factory.CreateMqttClient();
            using var timeoutCts =
                CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

            timeoutCts.CancelAfter(TestConnectionTimeout);

            try
            {
                var builder = new MqttClientOptionsBuilder()
                    .WithClientId($"{settings.ClientId}_test_{Guid.NewGuid():N}")
                    .WithTcpServer(settings.Host, settings.Port)
                    .WithCleanSession();

                if (!string.IsNullOrWhiteSpace(settings.Username))
                {
                    builder = builder.WithCredentials(
                        settings.Username,
                        settings.Password);
                }

                if (settings.UseTls)
                {
                    builder = builder.WithTlsOptions(options =>
                    {
                        options.UseTls();
                    });
                }

                await client.ConnectAsync(builder.Build(), timeoutCts.Token);

                return new MqttTestConnectionResponse
                {
                    Success = true,
                    Message = "MQTT connection successful."
                };
            }
            catch (OperationCanceledException)
            {
                return new MqttTestConnectionResponse
                {
                    Success = false,
                    Message = $"MQTT connection timed out after {TestConnectionTimeout.TotalSeconds} seconds."
                };
            }
            finally
            {
                if (client.IsConnected)
                {
                    await client.DisconnectAsync(
                        cancellationToken: CancellationToken.None);
                }
            }
        }
    }
}
