using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Reflection;

namespace HM_19MB_Core.Data
{
    internal static class SqlLoader
    {
        private static readonly ConcurrentDictionary<string, string> _cache = new();

        public static string Load(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Tên file SQL không được để trống.", nameof(name));

            return _cache.GetOrAdd(name, ReadFromAssembly);
        }

        private static string ReadFromAssembly(string name)
        {
            var assembly = Assembly.GetExecutingAssembly();
            string resourceSuffix = "." + name + ".sql";
            string? resourceName = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith(resourceSuffix, StringComparison.OrdinalIgnoreCase));

            if (resourceName == null)
            {
                throw new FileNotFoundException(
                    $"Không tìm thấy embedded resource kết thúc bằng '{resourceSuffix}'.\n" +
                    $"Resources hiện có: {string.Join(", ", assembly.GetManifestResourceNames())}");
            }

            using var stream = assembly.GetManifestResourceStream(resourceName)
                ?? throw new FileNotFoundException($"Không mở được embedded resource: '{resourceName}'.");

            using var reader = new StreamReader(stream);
            return reader.ReadToEnd();
        }

        public static void ClearCache() => _cache.Clear();
    }
}
