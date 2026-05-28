using System;
using System.Collections.Generic;
using System.Globalization;

namespace HM_19MB_Core
{
    public class MeasurementBlock
    {
        public string DeviceId { get; set; } = "";
        public DateTime Timestamp { get; set; }
        public int ProbeCount { get; set; }
        public float[] ProbeTemperatures { get; set; } = new float[10];
        public float[] ProbeHumidities { get; set; } = new float[10];
        public float AvgTemperature { get; set; }
        public float AvgHumidity { get; set; }
        public float UniformityTemp { get; set; }
        public float UniformityHumidity { get; set; }
        public string StabilityTemperature { get; set; } = "---";
        public string StabilityHumidity { get; set; } = "---";
        public string StabilityRaw { get; set; } = "---";
    }

    public static class DataParser
    {
        public static MeasurementBlock? ParseBlock(string rawData)
        {
            try
            {
                // ';' is the frame terminator. The six characters before it are stability data,
                // so do not treat "------" as an end marker.
                int markerIdx = rawData.IndexOf(';');
                if (markerIdx >= 0)
                    rawData = rawData.Substring(0, markerIdx);

                // Remove ALL whitespace and null characters
                string clean = rawData.Replace(" ", "").Replace("\r", "").Replace("\n", "").Replace("\t", "").Replace("\0", "");

                const int deviceLength = 3;
                const int dateLength = 6;
                const int timeLength = 4;
                const int fullProbeLength = 8;
                const int tempOnlyProbeLength = 4;
                const int fullTailLength = 8 + 8 + 6; // Avg + Uniformity + Stability
                const int tempOnlyTailLength = 4 + 4 + 3; // Avg temp + Uniformity temp + Stability temp
                const int tempOnlyLegacyTailLength = 4 + 4 + 6; // Previous temp-only variant with two stability fields
                const int fullFixedLength = deviceLength + dateLength + timeLength + fullTailLength;
                const int tempOnlyFixedLength = deviceLength + dateLength + timeLength + tempOnlyTailLength;
                const int tempOnlyLegacyFixedLength = deviceLength + dateLength + timeLength + tempOnlyLegacyTailLength;
                const int minFrameLength = tempOnlyFixedLength + tempOnlyProbeLength;
                const int maxProbeCount = 10;
                const int maxFrameLength = fullFixedLength + maxProbeCount * fullProbeLength;

                if (clean.Length < minFrameLength)
                    return null;

                // Find the start of the block. Usually starts with 'u' (e.g. u99)
                int startIdx = clean.LastIndexOf('u');
                if (startIdx >= 0 && clean.Length - startIdx >= minFrameLength)
                {
                    clean = clean.Substring(startIdx);
                }
                else
                {
                    // Fallback if 'u' not found: take the last complete frame.
                    int len = Math.Min(clean.Length, maxFrameLength);
                    if (clean.Length > len)
                        clean = clean.Substring(clean.Length - len);
                }

                if (clean.Length < minFrameLength) return null;

                int fullProbePayloadLength = clean.Length - fullFixedLength;
                bool isFullFrame = fullProbePayloadLength > 0 && fullProbePayloadLength % fullProbeLength == 0;
                int tempOnlyProbePayloadLength = clean.Length - tempOnlyFixedLength;
                bool isTempOnlyFrame = tempOnlyProbePayloadLength > 0 && tempOnlyProbePayloadLength % tempOnlyProbeLength == 0;
                int tempOnlyLegacyProbePayloadLength = clean.Length - tempOnlyLegacyFixedLength;
                bool isTempOnlyLegacyFrame = tempOnlyLegacyProbePayloadLength > 0 && tempOnlyLegacyProbePayloadLength % tempOnlyProbeLength == 0;

                int probeCount;
                bool hasHumidity;
                bool hasHumidityStability;
                if (isFullFrame)
                {
                    probeCount = fullProbePayloadLength / fullProbeLength;
                    hasHumidity = true;
                    hasHumidityStability = true;
                }
                else if (isTempOnlyFrame)
                {
                    probeCount = tempOnlyProbePayloadLength / tempOnlyProbeLength;
                    hasHumidity = false;
                    hasHumidityStability = false;
                }
                else if (isTempOnlyLegacyFrame)
                {
                    probeCount = tempOnlyLegacyProbePayloadLength / tempOnlyProbeLength;
                    hasHumidity = false;
                    hasHumidityStability = true;
                }
                else
                {
                    return null;
                }

                if (probeCount < 1 || probeCount > maxProbeCount)
                    return null;

                var block = new MeasurementBlock();
                block.ProbeCount = probeCount;
                Array.Fill(block.ProbeTemperatures, float.NaN);
                Array.Fill(block.ProbeHumidities, float.NaN);
                
                block.DeviceId = clean.Substring(0, 3);
                
                string datePart = clean.Substring(3, 6);
                string timePart = clean.Substring(9, 4);

                try
                {
                    int yy = int.Parse(datePart.Substring(0, 2), CultureInfo.InvariantCulture);
                    int mm = int.Parse(datePart.Substring(2, 2), CultureInfo.InvariantCulture);
                    int dd = int.Parse(datePart.Substring(4, 2), CultureInfo.InvariantCulture);
                    int hh = int.Parse(timePart.Substring(0, 2), CultureInfo.InvariantCulture);
                    int mn = int.Parse(timePart.Substring(2, 2), CultureInfo.InvariantCulture);
                    block.Timestamp = new DateTime(2000 + yy, mm, dd, hh, mn, 0);
                }
                catch
                {
                    block.Timestamp = DateTime.Now;
                }

                int offset = 13;
                for (int i = 0; i < block.ProbeCount; i++)
                {
                    block.ProbeTemperatures[i] = ParseContinuousFourDigit(clean.Substring(offset, 4));
                    if (hasHumidity)
                        block.ProbeHumidities[i] = ParseContinuousFourDigit(clean.Substring(offset + 4, 4));
                    offset += hasHumidity ? fullProbeLength : tempOnlyProbeLength;
                }

                block.AvgTemperature = ParseContinuousFourDigit(clean.Substring(offset, 4));
                block.AvgHumidity = hasHumidity ? ParseContinuousFourDigit(clean.Substring(offset + 4, 4)) : float.NaN;
                offset += hasHumidity ? 8 : 4;

                block.UniformityTemp = ParseContinuousFourDigit(clean.Substring(offset, 4));
                block.UniformityHumidity = hasHumidity ? ParseContinuousFourDigit(clean.Substring(offset + 4, 4)) : float.NaN;
                offset += hasHumidity ? 8 : 4;

                // Stability is 3 bytes temperature, plus 3 bytes humidity only in humidity-capable frames.
                if (clean.Length >= offset + 3)
                {
                    string stabTemp = clean.Substring(offset, 3);
                    string stabHum = hasHumidityStability && clean.Length >= offset + 6
                        ? clean.Substring(offset + 3, 3)
                        : "---";
                    block.StabilityTemperature = FormatStability(stabTemp);
                    block.StabilityHumidity = FormatStability(stabHum);
                    block.StabilityRaw = $"{block.StabilityTemperature} / {block.StabilityHumidity}";
                }
                else
                {
                    block.StabilityTemperature = "---";
                    block.StabilityHumidity = "---";
                    block.StabilityRaw = "---";
                }

                return block;
            }
            catch
            {
                return null;
            }
        }

        private static float ParseContinuousFourDigit(string raw)
        {
            if (int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out int val))
                return val / 10.0f;
            return 0f;
        }

        private static string FormatStability(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw) || raw == "---")
                return "---";

            if (int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out int val))
                return (val / 10.0f).ToString("F1", CultureInfo.InvariantCulture);

            return raw;
        }
    }
}
