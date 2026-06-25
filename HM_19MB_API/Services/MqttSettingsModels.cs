namespace HM_19MB_API.Services
{
    public sealed class MqttSettingsResponse
    {
        public bool Enabled { get; set; }
        public string Host { get; set; } = "";
        public int Port { get; set; }
        public string ClientId { get; set; } = "";
        public string Topic { get; set; } = "";
        public string Username { get; set; } = "";
        public bool HasPassword { get; set; }
        public bool UseTls { get; set; }
    }

    public sealed class MqttSettingsUpdateRequest
    {
        public bool Enabled { get; set; }
        public string Host { get; set; } = "";
        public int Port { get; set; }
        public string ClientId { get; set; } = "";
        public string Topic { get; set; } = "";
        public string Username { get; set; } = "";
        public string? Password { get; set; }
        public bool UseTls { get; set; }
    }

    public sealed class MqttTestConnectionRequest
    {
        public bool Enabled { get; set; } = true;
        public string Host { get; set; } = "";
        public int Port { get; set; }
        public string ClientId { get; set; } = "";
        public string Topic { get; set; } = "";
        public string Username { get; set; } = "";
        public string? Password { get; set; }
        public bool UseTls { get; set; }
    }

    public sealed class MqttTestConnectionResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
    }

    public sealed class MqttRuntimeSettings
    {
        public bool Enabled { get; set; }
        public string Host { get; set; } = "";
        public int Port { get; set; }
        public string ClientId { get; set; } = "";
        public string Topic { get; set; } = "";
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public bool UseTls { get; set; }
    }
}
