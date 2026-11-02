namespace SnapDashboardApi.Models;

// These records ARE the JSON contract with dashboard.js.
// ASP.NET converts property names to camelCase: PassFail -> passFail.

public record PassFail(int Passed, int Failed);
public record TesterData(PassFail PassFail);

public record TeamMember(string Tester, int CompletedPercentage);
public record DefectDensityItem(string Module, int Value);
public record Burndown(string[] Labels, int[] Ideal, int[] Actual);
public record SprintPoint(string Sprint, int Velocity, int BugCount, int PassRate);

public record ManagerData(
    Burndown Burndown,
    IReadOnlyList<DefectDensityItem> DefectDensity,
    IReadOnlyList<TeamMember> TeamPerformance,
    IReadOnlyList<SprintPoint> SprintTrend);

public record DefectDetection(int CaughtBeforeRelease, int ReportedByClient);
public record DeliveryData(DefectDetection DefectDetectionEffectiveness, int CriticalBugsOpen);

// Warnings tell you (and the dashboard) when a chart is empty or based on weak data.
public record DashboardMeta(DateTimeOffset GeneratedAt, int TotalIssues, IReadOnlyList<string> Warnings);

public record DashboardResponse(
    TesterData Tester,
    ManagerData Manager,
    DeliveryData Delivery,
    DashboardMeta Meta);
