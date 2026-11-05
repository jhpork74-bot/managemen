using System;
namespace FacilityIdleShutdown {
    public static class IdlePolicy {
        public const uint IdleLimitMs = 60 * 60 * 1000;
        public const uint WarningMs = 60 * 1000;
        public static uint IdleMilliseconds(uint now, uint lastInput, uint reset) {
            return Math.Min(unchecked(now - lastInput), unchecked(now - reset));
        }
        public static bool ShouldWarn(uint now, uint lastInput, uint reset) {
            return IdleMilliseconds(now, lastInput, reset) >= IdleLimitMs - WarningMs;
        }
        public static bool ShouldCancel(uint lastInput, uint warningInput) { return lastInput != warningInput; }
        public static int RemainingSeconds(uint now, uint warningStart) {
            uint elapsed = unchecked(now - warningStart);
            return elapsed >= WarningMs ? 0 : (int)((WarningMs - elapsed + 999) / 1000);
        }
    }
}

