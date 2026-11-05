using System;
using FacilityIdleShutdown;
class PolicyTests {
    static void Check(bool value, string name) { if (!value) throw new Exception(name); Console.WriteLine("PASS " + name); }
    static void Main() {
        Check(!IdlePolicy.ShouldWarn(3540000, 0, 1), "no warning before 59 minutes");
        Check(IdlePolicy.ShouldWarn(3540000, 0, 0), "warning at 59 minutes; shutdown at 60 minutes");
        Check(!IdlePolicy.ShouldWarn(7200000, 0, 7200000), "launch/resume resets old idle time");
        Check(!IdlePolicy.ShouldWarn(7200000, 7199990, 0), "recent input prevents warning");
        Check(IdlePolicy.IdleMilliseconds(500, unchecked(500u - 1000u), unchecked(500u - 2000u)) == 1000, "tick counter rollover");
        Check(IdlePolicy.RemainingSeconds(100, 100) == 60, "warning starts at sixty seconds");
        Check(IdlePolicy.RemainingSeconds(60099, 100) == 1, "no early shutdown");
        Check(IdlePolicy.RemainingSeconds(60100, 100) == 0, "warning deadline");
        Check(IdlePolicy.ShouldCancel(101, 100) && !IdlePolicy.ShouldCancel(100, 100), "input cancels warning");
    }
}

