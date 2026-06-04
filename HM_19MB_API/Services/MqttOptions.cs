namespace HM_19MB_API.Services
{
    public sealed class MqttOptions
    {
        public bool Enabled { get; set; } = true;
        public string Host { get; set; } = "broker.hivemq.com";
        public int Port { get; set; } = 1883;
        public string ClientId { get; set; } = "HM_19MB_Client";
        public string Topic { get; set; } = "esp32/responses";
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public bool UseTls { get; set; } = false;
    }
}
