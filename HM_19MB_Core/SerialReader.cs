using System;
using System.IO.Ports;
using System.Text;
using System.Threading;

namespace HM_19MB_Core
{
    public class SerialReader : IDisposable
    {
        private const int FixedTenProbeFullFrameLength = 115;
        private const int IdleFrameParseDelayMs = 15_000;

        private SerialPort? _port;
        private readonly StringBuilder _buffer = new StringBuilder();
        private readonly object _bufferLock = new object();
        private System.Threading.Timer? _idleFrameTimer;
        private bool _disposed = false;

        public event EventHandler<MeasurementBlock>? BlockReceived;
        public event EventHandler<string>? ErrorOccurred;

        public bool IsConnected => _port?.IsOpen ?? false;

        public void Connect(string portName)
        {
            if (_port != null && _port.IsOpen)
                throw new InvalidOperationException("Port is already open.");

            _port = new SerialPort(portName)
            {
                BaudRate = 9600,
                DataBits = 8,
                Parity = Parity.None,
                StopBits = StopBits.One,
                Encoding = Encoding.ASCII,
                ReadTimeout = 5000,
                WriteTimeout = 2000,
                NewLine = "\n",
                DtrEnable = true,
                RtsEnable = true
            };

            _port.DataReceived += Port_DataReceived;
            lock (_bufferLock)
            {
                _buffer.Clear();
            }
            _port.Open();
        }

        public void Disconnect()
        {
            if (_port != null && _port.IsOpen)
            {
                _port.DataReceived -= Port_DataReceived;
                _port.Close();
            }
        }

        private void Port_DataReceived(object sender, SerialDataReceivedEventArgs e)
        {
            if (_port == null || !_port.IsOpen) return;

            try
            {
                string incoming = _port.ReadExisting();
                string bufStr;
                lock (_bufferLock)
                {
                    _idleFrameTimer?.Dispose();
                    _idleFrameTimer = null;
                    _buffer.Append(incoming);
                    bufStr = _buffer.ToString();
                }

                int endMarkerIdx;

                // Accept both the old ';' terminator and CR/LF line endings.
                while ((endMarkerIdx = FindFrameTerminator(bufStr)) >= 0)
                {
                    string blockData = bufStr.Substring(0, endMarkerIdx);
                    bufStr = bufStr.Substring(endMarkerIdx + 1);

                    if (!string.IsNullOrWhiteSpace(blockData))
                        ParseAndRaise(blockData);
                }

                // Some devices send a fixed-size frame and then stop transmitting,
                // without sending ';', CR or LF. The 10-probe frames are 115 bytes
                // with humidity and 64 bytes in temperature-only mode.
                while (TryExtractFixedLengthFrame(ref bufStr, out string blockData))
                {
                    ParseAndRaise(blockData);
                }

                lock (_bufferLock)
                {
                    _buffer.Clear();
                    _buffer.Append(bufStr);

                    if (_buffer.Length > 0)
                    {
                        _idleFrameTimer = new System.Threading.Timer(
                            ParseBufferedFrameAfterIdle,
                            null,
                            IdleFrameParseDelayMs,
                            Timeout.Infinite);
                    }
                }
            }
            catch (Exception ex)
            {
                AppLogger.Warning("SerialReader", $"Serial read error: {ex.Message}", ex);
                ErrorOccurred?.Invoke(this, $"Serial read error: {ex.Message}");
            }
        }

        private void ParseBufferedFrameAfterIdle(object? state)
        {
            string? blockData = null;

            lock (_bufferLock)
            {
                string bufStr = _buffer.ToString();
                int startIdx = bufStr.IndexOf('u');
                if (startIdx >= 0)
                {
                    blockData = bufStr.Substring(startIdx);
                    _buffer.Clear();
                }

                _idleFrameTimer?.Dispose();
                _idleFrameTimer = null;
            }

            if (!string.IsNullOrWhiteSpace(blockData))
                ParseAndRaise(blockData);
        }

        private void ParseAndRaise(string blockData)
        {
            var parsed = DataParser.ParseBlock(blockData);
            if (parsed != null)
            {
                BlockReceived?.Invoke(this, parsed);
            }
            else
            {
                AppLogger.Warning("SerialReader", $"Du lieu khong dung dinh dang: {TrimForDisplay(blockData)}");
                ErrorOccurred?.Invoke(this, $"Du lieu khong dung dinh dang: {TrimForDisplay(blockData)}");
            }
        }

        private static int FindFrameTerminator(string data)
        {
            int semicolonIdx = data.IndexOf(';');
            int carriageReturnIdx = data.IndexOf('\r');
            int lineFeedIdx = data.IndexOf('\n');

            int terminatorIdx = -1;
            foreach (int idx in new[] { semicolonIdx, carriageReturnIdx, lineFeedIdx })
            {
                if (idx >= 0 && (terminatorIdx < 0 || idx < terminatorIdx))
                    terminatorIdx = idx;
            }

            return terminatorIdx;
        }

        private static bool TryExtractFixedLengthFrame(ref string data, out string blockData)
        {
            blockData = string.Empty;

            int startIdx = data.IndexOf('u');
            if (startIdx < 0)
            {
                int hashIdx = data.LastIndexOf('#');
                if (hashIdx > 0)
                    data = data.Substring(hashIdx);
                return false;
            }

            if (startIdx > 0)
                data = data.Substring(startIdx);

            if (data.Length < FixedTenProbeFullFrameLength)
                return false;

            blockData = data.Substring(0, FixedTenProbeFullFrameLength);
            data = data.Substring(FixedTenProbeFullFrameLength);
            return true;
        }

        private static string TrimForDisplay(string value)
        {
            value = value.Replace("\r", "\\r").Replace("\n", "\\n");
            return value.Length <= 120 ? value : value.Substring(0, 120) + "...";
        }

        public static string[] GetAvailablePorts()
        {
            return SerialPort.GetPortNames();
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _idleFrameTimer?.Dispose();
                Disconnect();
                _port?.Dispose();
                _disposed = true;
            }
        }
    }
}
