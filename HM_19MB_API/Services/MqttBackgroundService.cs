using System.Text;
using HM_19MB_Core;
using MQTTnet;

namespace HM_19MB_API.Services
{
    public sealed class MqttBackgroundService : BackgroundService
    {
        private static readonly TimeSpan ConnectTimeout = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan HealthCheckInterval = TimeSpan.FromSeconds(5);
        private static readonly TimeSpan[] RetryDelays =
        [
            TimeSpan.FromSeconds(2),
            TimeSpan.FromSeconds(5),
            TimeSpan.FromSeconds(10),
            TimeSpan.FromSeconds(30)
        ];

        private readonly ILogger<MqttBackgroundService> _logger;
        private readonly MeasurementIngestionService _ingestion;
        private readonly SystemSettingsService _settingsService;
        private readonly MqttReconnectSignal _reconnectSignal;

        public MqttBackgroundService(
            ILogger<MqttBackgroundService> logger,
            MeasurementIngestionService ingestion,
            SystemSettingsService settingsService,
            MqttReconnectSignal reconnectSignal)
        {
            _logger = logger;
            _ingestion = ingestion;
            _settingsService = settingsService;
            _reconnectSignal = reconnectSignal;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var retryIndex = 0;

            while (!stoppingToken.IsCancellationRequested)
            {
                IMqttClient? client = null;
                CancellationTokenSource? reconnectWaitCts = null;

                try
                {
                    var settings = await _settingsService.GetMqttSettingsAsync(stoppingToken);

                    if (!settings.Enabled)
                    {
                        _logger.LogInformation("MQTT is disabled in settings.");
                        retryIndex = 0;
                        await WaitForReconnectAsync(stoppingToken);
                        continue;
                    }

                    var factory = new MqttClientFactory();
                    client = factory.CreateMqttClient();
                    client.ApplicationMessageReceivedAsync += HandleMessageAsync;

                    var mqttOptions = BuildClientOptions(settings);
                    reconnectWaitCts =
                        CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    var reconnectTask =
                        _reconnectSignal.WaitAsync(reconnectWaitCts.Token).AsTask();

                    _logger.LogInformation(
                        "MQTT connecting to {Host}:{Port}",
                        settings.Host,
                        settings.Port);

                    using var connectTimeoutCts =
                        CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                    connectTimeoutCts.CancelAfter(ConnectTimeout);

                    var connectTask = client.ConnectAsync(
                        mqttOptions,
                        connectTimeoutCts.Token);

                    var connectCompleted = await Task.WhenAny(connectTask, reconnectTask);

                    if (connectCompleted == reconnectTask)
                    {
                        _logger.LogInformation("MQTT reconnect requested while connecting.");
                        connectTimeoutCts.Cancel();
                        await SafeDisconnectAsync(client);
                        continue;
                    }

                    await connectTask;

                    _logger.LogInformation(
                        "MQTT connected. Subscribing to topic {Topic}...",
                        settings.Topic);

                    var subscribeOptions = new MqttClientSubscribeOptionsBuilder()
                        .WithTopicFilter(settings.Topic)
                        .Build();

                    await client.SubscribeAsync(subscribeOptions, stoppingToken);

                    _logger.LogInformation(
                        "MQTT subscribed to topic {Topic}",
                        settings.Topic);

                    retryIndex = 0;
                    var shouldReconnect =
                        await WaitUntilReconnectOrDisconnectAsync(
                            client,
                            reconnectTask,
                            stoppingToken);

                    if (shouldReconnect)
                    {
                        _logger.LogInformation("MQTT reconnect requested.");
                    }
                    else
                    {
                        _logger.LogWarning("MQTT disconnected. Reconnecting...");
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (OperationCanceledException)
                {
                    _logger.LogWarning(
                        "MQTT connection timed out after {Seconds} seconds.",
                        ConnectTimeout.TotalSeconds);

                    await WaitForRetryAsync(retryIndex, stoppingToken);
                    retryIndex = Math.Min(retryIndex + 1, RetryDelays.Length - 1);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "MQTT connection error.");

                    await WaitForRetryAsync(retryIndex, stoppingToken);
                    retryIndex = Math.Min(retryIndex + 1, RetryDelays.Length - 1);
                }
                finally
                {
                    reconnectWaitCts?.Cancel();
                    reconnectWaitCts?.Dispose();

                    if (client != null)
                    {
                        await SafeDisconnectAsync(client);
                        client.Dispose();
                    }
                }
            }
        }

        private static MqttClientOptions BuildClientOptions(
            MqttRuntimeSettings settings)
        {
            var builder = new MqttClientOptionsBuilder()
                .WithClientId(settings.ClientId)
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

            return builder.Build();
        }

        private async Task<bool> WaitUntilReconnectOrDisconnectAsync(
            IMqttClient client,
            Task reconnectTask,
            CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested && client.IsConnected)
            {
                var delayTask = Task.Delay(HealthCheckInterval, stoppingToken);
                var completed = await Task.WhenAny(delayTask, reconnectTask);

                if (completed == reconnectTask)
                {
                    await reconnectTask;
                    return true;
                }

                await delayTask;
            }

            return false;
        }

        private async Task WaitForReconnectAsync(CancellationToken stoppingToken)
        {
            try
            {
                await _reconnectSignal.WaitAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
            }
        }

        private async Task WaitForRetryAsync(
            int retryIndex,
            CancellationToken stoppingToken)
        {
            var delay = RetryDelays[Math.Clamp(retryIndex, 0, RetryDelays.Length - 1)];
            _logger.LogInformation(
                "MQTT retrying in {Seconds} seconds...",
                delay.TotalSeconds);

            var delayTask = Task.Delay(delay, stoppingToken);
            using var reconnectWaitCts =
                CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            var reconnectTask =
                _reconnectSignal.WaitAsync(reconnectWaitCts.Token).AsTask();
            var completed = await Task.WhenAny(delayTask, reconnectTask);

            if (completed == reconnectTask)
            {
                await reconnectTask;
                _logger.LogInformation("MQTT retry delay interrupted by reconnect request.");
            }
            else
            {
                reconnectWaitCts.Cancel();
                await delayTask;
            }
        }

        private static async Task SafeDisconnectAsync(IMqttClient client)
        {
            try
            {
                if (client.IsConnected)
                {
                    await client.DisconnectAsync(
                        cancellationToken: CancellationToken.None);
                }
            }
            catch
            {
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
