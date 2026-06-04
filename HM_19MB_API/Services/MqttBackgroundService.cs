using System.Text;
using HM_19MB_Core;
using Microsoft.Extensions.Options;
using MQTTnet;

namespace HM_19MB_API.Services
{
    public sealed class MqttBackgroundService : BackgroundService
    {
        private readonly ILogger<MqttBackgroundService> _logger;
        private readonly MeasurementIngestionService _ingestion;
        private readonly MqttOptions _options;
        private readonly IMqttClient _client;

        public MqttBackgroundService(
            ILogger<MqttBackgroundService> logger,
            MeasurementIngestionService ingestion,
            IOptions<MqttOptions> options)
        {
            _logger = logger;
            _ingestion = ingestion;
            _options = options.Value;
            var factory = new MqttClientFactory();
            _client = factory.CreateMqttClient();
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.Enabled)
            {
                _logger.LogInformation("MQTT is disabled in config, skipping.");
                return;
            }

            _client.ApplicationMessageReceivedAsync += HandleMessageAsync;

            var builder = new MqttClientOptionsBuilder()
                .WithClientId(_options.ClientId)
                .WithTcpServer(_options.Host, _options.Port)
                .WithCleanSession();

            if (!string.IsNullOrWhiteSpace(_options.Username))
            {
                builder = builder.WithCredentials(_options.Username, _options.Password);
            }

            if (_options.UseTls)
            {
                builder = builder.WithTlsOptions(options =>
                {
                    options.UseTls();
                });
            }

            var mqttOptions  = builder.Build();

            try
            {
                while (!stoppingToken.IsCancellationRequested)
                {
                    try
                    {
                        if (!_client.IsConnected)
                        {
                            _logger.LogInformation(
                                "MQTT connecting to {Host}:{Port}",
                                _options.Host,
                                _options.Port);

                            await _client.ConnectAsync(mqttOptions, stoppingToken);

                            _logger.LogInformation(
                                "MQTT connected. Subscribing to topic {Topic}...",
                                _options.Topic);

                            var subscribeOptions = new MqttClientSubscribeOptionsBuilder()
                                .WithTopicFilter(_options.Topic)
                                .Build();

                            await _client.SubscribeAsync(
                                subscribeOptions,
                                stoppingToken);

                            _logger.LogInformation(
                                "MQTT subscribed to topic {Topic}",
                                _options.Topic);
                        }
                        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "MQTT connection error. Retrying in 10 seconds...");

                        try
                        {
                            await Task.Delay(
                                TimeSpan.FromSeconds(10),
                                stoppingToken);
                        }
                        catch (OperationCanceledException)
                        {
                            break;
                        }
                    }
                }
            }
            finally
            {
                if (_client.IsConnected)
                {
                    _logger.LogInformation("MQTT disconnecting...");

                    await _client.DisconnectAsync(
                        cancellationToken: CancellationToken.None);

                    _logger.LogInformation("MQTT disconnected.");
                }

                _client.Dispose();
            }
        }

        private async Task HandleMessageAsync(MqttApplicationMessageReceivedEventArgs args)
        {
            try
            {
                var topic = args.ApplicationMessage.Topic;
                var payload = args.ApplicationMessage.ConvertPayloadToString();

                _logger.LogDebug(
                            "MQTT message received. Topic={Topic}, PayloadLength={Length}",
                            topic,
                            payload.Length);

                var frame = ExtractMeasurementFrame(payload);
                if (frame == null)
                {
                    _logger.LogWarning(
                        "MQTT payload does not contain measurement frame. Topic={Topic}",
                        topic);
                    return;
                }

                var block = DataParser.ParseBlock(frame);
                if (block == null)
                {
                    _logger.LogWarning(
                        "Failed to parse MQTT measurement frame. Topic={Topic}, Frame={Frame}",
                        topic,
                        frame);
                    return;
                }

                var result = await _ingestion.IngestFromDeviceAsync(
                    block.DeviceId,
                    block);

                if (result.Ignored)
                {
                    _logger.LogWarning(
                        "MQTT measurement ignored. DeviceId={DeviceId}, Reason={Reason}",
                        block.DeviceId,
                        result.Reason);
                    return;
                }

                _logger.LogInformation(
                    "MQTT measurement ingested. DeviceId={DeviceId}, RecordId={RecordId}",
                    block.DeviceId,
                    result.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process MQTT message.");
            }
        }

        private static string? ExtractMeasurementFrame(string payload)
        {
            var hashIndex = payload.LastIndexOf("#u", StringComparison.Ordinal);
            if (hashIndex >= 0)
            {
                return CleanFrame(payload[(hashIndex + 1)..]);
            }

            var uIndex = payload.LastIndexOf('u');
            if (uIndex >= 0)
            {
                return CleanFrame(payload[uIndex..]);
            }

            return null;
        }

        private static string CleanFrame(string frame)
        {
            var endIndex = frame.IndexOfAny(['\r', '\n', '\0']);

            if (endIndex >= 0)
            {
                frame = frame[..endIndex];
            }

            return frame.Trim();
        }
    }
}
