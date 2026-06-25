using HM_19MB_Core.Data;
using Microsoft.Extensions.Options;
using Npgsql;

namespace HM_19MB_API.Services
{
    public sealed class SystemSettingsService
    {
        private const string EnabledKey = "mqtt.enabled";
        private const string HostKey = "mqtt.host";
        private const string PortKey = "mqtt.port";
        private const string ClientIdKey = "mqtt.client_id";
        private const string TopicKey = "mqtt.topic";
        private const string UsernameKey = "mqtt.username";
        private const string PasswordKey = "mqtt.password";
        private const string UseTlsKey = "mqtt.use_tls";

        private readonly IOptions<MqttOptions> _defaults;

        private static string ConnectionString =>
            Environment.GetEnvironmentVariable("POSTGRES_CONN")
            ?? throw new InvalidOperationException(
                "Missing POSTGRES_CONN environment variable.");

        public SystemSettingsService(IOptions<MqttOptions> defaults)
        {
            _defaults = defaults;
        }

        public async Task<MqttRuntimeSettings> GetMqttSettingsAsync(
            CancellationToken cancellationToken = default)
        {
            await DatabaseService.EnsureSchemaAsync();

            var values = await ReadSettingsAsync(cancellationToken);
            var defaults = _defaults.Value;

            var settings = new MqttRuntimeSettings
            {
                Enabled = ReadBool(values, EnabledKey, defaults.Enabled),
                Host = ReadString(values, HostKey, defaults.Host),
                Port = ReadPort(values, PortKey, defaults.Port),
                ClientId = ReadString(values, ClientIdKey, defaults.ClientId),
                Topic = ReadString(values, TopicKey, defaults.Topic),
                Username = ReadString(values, UsernameKey, defaults.Username),
                Password = ReadString(values, PasswordKey, defaults.Password),
                UseTls = ReadBool(values, UseTlsKey, defaults.UseTls)
            };

            Validate(settings);
            return settings;
        }

        public async Task<MqttSettingsResponse> GetMqttSettingsResponseAsync(
            CancellationToken cancellationToken = default)
        {
            var settings = await GetMqttSettingsAsync(cancellationToken);

            return new MqttSettingsResponse
            {
                Enabled = settings.Enabled,
                Host = settings.Host,
                Port = settings.Port,
                ClientId = settings.ClientId,
                Topic = settings.Topic,
                Username = settings.Username,
                HasPassword = !string.IsNullOrEmpty(settings.Password),
                UseTls = settings.UseTls
            };
        }

        public async Task<MqttRuntimeSettings> SaveMqttSettingsAsync(
            MqttSettingsUpdateRequest request,
            CancellationToken cancellationToken = default)
        {
            var current = await GetMqttSettingsAsync(cancellationToken);
            var next = new MqttRuntimeSettings
            {
                Enabled = request.Enabled,
                Host = request.Host.Trim(),
                Port = request.Port,
                ClientId = request.ClientId.Trim(),
                Topic = request.Topic.Trim(),
                Username = request.Username.Trim(),
                Password = request.Password ?? current.Password,
                UseTls = request.UseTls
            };

            Validate(next);

            await DatabaseService.EnsureSchemaAsync();
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(cancellationToken);

            await UpsertAsync(conn, EnabledKey, next.Enabled.ToString(), cancellationToken);
            await UpsertAsync(conn, HostKey, next.Host, cancellationToken);
            await UpsertAsync(conn, PortKey, next.Port.ToString(), cancellationToken);
            await UpsertAsync(conn, ClientIdKey, next.ClientId, cancellationToken);
            await UpsertAsync(conn, TopicKey, next.Topic, cancellationToken);
            await UpsertAsync(conn, UsernameKey, next.Username, cancellationToken);
            await UpsertAsync(conn, PasswordKey, next.Password, cancellationToken);
            await UpsertAsync(conn, UseTlsKey, next.UseTls.ToString(), cancellationToken);

            return next;
        }

        public MqttRuntimeSettings MergeTestRequest(
            MqttRuntimeSettings current,
            MqttTestConnectionRequest? request)
        {
            if (request == null)
            {
                return current;
            }

            var settings = new MqttRuntimeSettings
            {
                Enabled = request.Enabled,
                Host = request.Host.Trim(),
                Port = request.Port,
                ClientId = request.ClientId.Trim(),
                Topic = request.Topic.Trim(),
                Username = request.Username.Trim(),
                Password = request.Password ?? current.Password,
                UseTls = request.UseTls
            };

            Validate(settings);
            return settings;
        }

        private static async Task<Dictionary<string, string>> ReadSettingsAsync(
            CancellationToken cancellationToken)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync(cancellationToken);

            await using var cmd = new NpgsqlCommand(@"
                SELECT khoa, gia_tri
                FROM cai_dat_he_thong
                WHERE khoa = ANY(@keys)", conn);

            cmd.Parameters.AddWithValue("@keys", new[]
            {
                EnabledKey,
                HostKey,
                PortKey,
                ClientIdKey,
                TopicKey,
                UsernameKey,
                PasswordKey,
                UseTlsKey
            });

            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                values[reader.GetString(0)] = reader.GetString(1);
            }

            return values;
        }

        private static async Task UpsertAsync(
            NpgsqlConnection conn,
            string key,
            string value,
            CancellationToken cancellationToken)
        {
            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO cai_dat_he_thong (khoa, gia_tri, cap_nhat)
                VALUES (@key, @value, NOW())
                ON CONFLICT (khoa) DO UPDATE
                    SET gia_tri = EXCLUDED.gia_tri,
                        cap_nhat = EXCLUDED.cap_nhat", conn);

            cmd.Parameters.AddWithValue("@key", key);
            cmd.Parameters.AddWithValue("@value", value);
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }

        private static string ReadString(
            IReadOnlyDictionary<string, string> values,
            string key,
            string fallback)
        {
            return values.TryGetValue(key, out var value)
                ? value.Trim()
                : fallback.Trim();
        }

        private static bool ReadBool(
            IReadOnlyDictionary<string, string> values,
            string key,
            bool fallback)
        {
            return values.TryGetValue(key, out var value)
                && bool.TryParse(value, out var parsed)
                    ? parsed
                    : fallback;
        }

        private static int ReadPort(
            IReadOnlyDictionary<string, string> values,
            string key,
            int fallback)
        {
            return values.TryGetValue(key, out var value)
                && int.TryParse(value, out var parsed)
                && parsed is >= 1 and <= 65535
                    ? parsed
                    : fallback;
        }

        private static void Validate(MqttRuntimeSettings settings)
        {
            if (settings.Port is < 1 or > 65535)
            {
                throw new ArgumentException("MQTT port must be between 1 and 65535.");
            }

            if (!settings.Enabled)
            {
                return;
            }

            if (string.IsNullOrWhiteSpace(settings.Host))
            {
                throw new ArgumentException("MQTT host is required.");
            }

            if (string.IsNullOrWhiteSpace(settings.ClientId))
            {
                throw new ArgumentException("MQTT client ID is required.");
            }

            if (string.IsNullOrWhiteSpace(settings.Topic))
            {
                throw new ArgumentException("MQTT topic is required.");
            }
        }
    }
}
