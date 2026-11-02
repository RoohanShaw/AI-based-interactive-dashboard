namespace SnapDashboardApi.Settings;

// Business definitions live in config, not buried in code,
// so they can be changed (and explained) without touching the maths.
public class MetricDefinitions
{
    public const string SectionName = "Definitions";

    public List<string> BugIssueTypes { get; set; } = new();
    public List<string> CriticalPriorities { get; set; } = new();
    public string DoneStatusCategory { get; set; } = "done";
    public string ClientReportedLabel { get; set; } = "client-reported";
    public int BurndownDays { get; set; } = 10;
    public int MaxSprints { get; set; } = 4;
}
