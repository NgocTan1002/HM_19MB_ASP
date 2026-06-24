namespace HM_19MB_API.Services
{
    public static class CacheKeys
    {
        public const string Sessions = "sessions:list";

        public static string Session(int sessionId)
            => $"sessions:{sessionId}";

        public static string Measurements(int sessionId)
            => $"sessions:{sessionId}:measurements";

        public static string CalibrationResults(int sessionId)
            => $"sessions:{sessionId}:calibration-results";

        public static string CalibrationDetails(int resultId)
            => $"calibration-results:{resultId}:details";

    }
}
