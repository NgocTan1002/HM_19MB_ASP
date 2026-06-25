using System.Threading.Channels;

namespace HM_19MB_API.Services
{
    public sealed class MqttReconnectSignal
    {
        private readonly Channel<bool> _channel =
            Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
                SingleWriter = false
            });

        public void RequestReconnect()
        {
            _channel.Writer.TryWrite(true);
        }

        public ValueTask<bool> WaitAsync(CancellationToken cancellationToken)
        {
            return _channel.Reader.ReadAsync(cancellationToken);
        }
    }
}
