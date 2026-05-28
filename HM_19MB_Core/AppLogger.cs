using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace HM_19MB_Core  
{
    /// <summary>
    /// Log entry chứa thông tin một bản ghi log
    /// </summary>
    public class LogEntry
    {
        public DateTime Timestamp { get; set; }
        public LogLevel Level { get; set; }
        public string Source { get; set; } = "";
        public string Message { get; set; } = "";
        public Exception? Exception { get; set; }

        public override string ToString()
        {
            string result = $"[{Timestamp:yyyy-MM-dd HH:mm:ss.fff}] [{Level}] [{Source}] {Message}";
            if (Exception != null)
            {
                result += $"\n{Exception}";
            }
            return result;
        }
    }

    /// <summary>
    /// Mức độ log
    /// </summary>
    public enum LogLevel
    {
        Info,
        Warning,
        Error,
        Critical
    }

    /// <summary>
    /// Static logger class cho toàn bộ ứng dụng
    /// Thread-safe, ghi ra file và giữ lịch sử trong bộ nhớ
    /// </summary>
    public static class AppLogger
    {
        private static readonly object _lock = new object();
        private static readonly List<LogEntry> _recentEntries = new List<LogEntry>();
        private const int MaxRecentEntries = 30;
        private static readonly string _logDirectory;

        static AppLogger()
        {
            // Tạo thư mục logs tại thư mục gốc của ứng dụng
            _logDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
            
            try
            {
                if (!Directory.Exists(_logDirectory))
                {
                    Directory.CreateDirectory(_logDirectory);
                }
            }
            catch
            {
                // Nếu không tạo được thư mục, log sẽ fail silent
            }
        }

        /// <summary>
        /// Lấy danh sách các log entry gần nhất (tối đa 30 entry)
        /// </summary>
        public static List<LogEntry> GetRecentEntries()
        {
            lock (_lock)
            {
                return _recentEntries.ToList();
            }
        }

        /// <summary>
        /// Log thông tin thông thường
        /// </summary>
        public static void Info(string source, string message)
        {
            Log(LogLevel.Info, source, message, null);
        }

        /// <summary>
        /// Log cảnh báo
        /// </summary>
        public static void Warning(string source, string message)
        {
            Log(LogLevel.Warning, source, message, null);
        }

        public static void Warning(string source, string message, Exception? exception)
        {
            Log(LogLevel.Warning, source, message, exception);
        }

        /// <summary>
        /// Log lỗi
        /// </summary>
        public static void Error(string source, string message, Exception? exception = null)
        {
            Log(LogLevel.Error, source, message, exception);
        }

        /// <summary>
        /// Log lỗi nghiêm trọng
        /// </summary>
        public static void Critical(string source, string message, Exception? exception = null)
        {
            Log(LogLevel.Critical, source, message, exception);
        }

        /// <summary>
        /// Ghi log với level tùy chỉnh
        /// </summary>
        private static void Log(LogLevel level, string source, string message, Exception? exception)
        {
            var entry = new LogEntry
            {
                Timestamp = DateTime.Now,
                Level = level,
                Source = source,
                Message = message,
                Exception = exception
            };

            lock (_lock)
            {
                // Thêm vào danh sách recent entries
                _recentEntries.Add(entry);
                
                // Giữ tối đa 30 entry gần nhất
                if (_recentEntries.Count > MaxRecentEntries)
                {
                    _recentEntries.RemoveAt(0);
                }

                // Ghi ra file
                WriteToFile(entry);
            }
        }

        /// <summary>
        /// Ghi log entry ra file
        /// </summary>
        private static void WriteToFile(LogEntry entry)
        {
            try
            {
                string fileName = $"app_{entry.Timestamp:yyyy-MM-dd}.log";
                string filePath = Path.Combine(_logDirectory, fileName);

                // Append vào file log của ngày hiện tại
                File.AppendAllText(filePath, entry.ToString() + Environment.NewLine);
            }
            catch
            {
                // Fail silent - không throw exception khi ghi log thất bại
                // để tránh làm crash ứng dụng chính
            }
        }

        /// <summary>
        /// Xóa tất cả log entries trong bộ nhớ
        /// </summary>
        public static void ClearRecentEntries()
        {
            lock (_lock)
            {
                _recentEntries.Clear();
            }
        }
    }
}
