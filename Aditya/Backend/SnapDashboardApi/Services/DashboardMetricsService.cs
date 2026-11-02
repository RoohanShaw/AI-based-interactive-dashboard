using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using SnapDashboardApi.Models;
using SnapDashboardApi.Settings;

namespace SnapDashboardApi.Services;

public interface IDashboardMetricsService
{
    DashboardResponse Build(IReadOnlyList<JiraIssue> issues, DateTimeOffset now);
}

// Job: turn a list of issues into the numbers each chart needs.
// It never calls Jira, so you can unit-test it with fake issues.
public class DashboardMetricsService : IDashboardMetricsService
{
    private readonly MetricDefinitions _defs;
    private readonly ILogger<DashboardMetricsService> _logger;

    public DashboardMetricsService(IOptions<MetricDefinitions> defs, ILogger<DashboardMetricsService> logger)
    {
        _defs = defs.Value;
        _logger = logger;
    }

    private bool IsBug(JiraIssue i) =>
        _defs.BugIssueTypes.Any(t => string.Equals(t, i.IssueType, StringComparison.OrdinalIgnoreCase));

    private bool IsDone(JiraIssue i) =>
        string.Equals(i.StatusCategory, _defs.DoneStatusCategory, StringComparison.OrdinalIgnoreCase);

    private bool IsCritical(JiraIssue i) =>
        _defs.CriticalPriorities.Any(p => string.Equals(p, i.Priority, StringComparison.OrdinalIgnoreCase));

    private static int Percent(int part, int total) =>
        total == 0 ? 0 : (int)Math.Round(part * 100.0 / total, MidpointRounding.AwayFromZero);

    // Sort sprints by the last number in their name ("Sprint 3" -> 3); fall back to the id
    private static int SprintNumber(string name)
    {
        var m = Regex.Match(name, @"\d+(?!.*\d)");
        return m.Success && int.TryParse(m.Value, out var n) ? n : int.MaxValue;
    }

    public DashboardResponse Build(IReadOnlyList<JiraIssue> issues, DateTimeOffset now)
    {
        _logger.LogInformation("Building dashboard metrics from {IssueCount} Jira issues", issues.Count);
        var warnings = new List<string>();
        if (issues.Count == 0)
            warnings.Add("Jira returned 0 issues. Check Jira:ProjectKey and that the project has issues.");

        var bugs = issues.Where(IsBug).ToList();

        // ---- TESTER: pass / fail (Assumption A in the guide) ----
        var passed = issues.Count(i => !IsBug(i) && IsDone(i));
        var failed = bugs.Count(b => !IsDone(b));

        // ---- MANAGER: team performance = % of each person's issues that are done ----
        var team = issues
            .Where(i => !string.IsNullOrWhiteSpace(i.Assignee))
            .GroupBy(i => i.Assignee!)
            .Select(g => new TeamMember(g.Key, Percent(g.Count(IsDone), g.Count())))
            .OrderByDescending(t => t.CompletedPercentage)
            .Take(6)
            .ToList();
        if (team.Count == 0)
            warnings.Add("No issues have an assignee, so Team Performance is empty.");

        // ---- MANAGER: defect density = bugs per component ----
        IEnumerable<string> ModulesOf(JiraIssue b) =>
            b.Components.Count > 0 ? b.Components : new[] { "No component" };

        var density = bugs
            .SelectMany(b => ModulesOf(b))
            .GroupBy(m => m)
            .Select(g => new DefectDensityItem(g.Key, g.Count()))
            .OrderByDescending(d => d.Value)
            .ThenBy(d => d.Module)
            .Take(5)
            .ToList();
        if (bugs.Count == 0)
            warnings.Add("No issues match Definitions:BugIssueTypes, so Defect Density is empty.");

        // ---- MANAGER: sprint trend (real data from the sprint field) ----
        var sprintTrend = issues
            .Where(i => i.Sprint is not null)
            .GroupBy(i => i.Sprint!.Id)
            .OrderBy(g => SprintNumber(g.First().Sprint!.Name))
            .ThenBy(g => g.Key)
            .TakeLast(Math.Max(1, _defs.MaxSprints))
            .Select(g => new SprintPoint(
                g.First().Sprint!.Name,
                g.Count(IsDone),      // "velocity" = issues completed (no story points yet)
                g.Count(IsBug),
                Percent(g.Count(IsDone), g.Count())))
            .ToList();
        if (sprintTrend.Count == 0)
            warnings.Add("No sprint data found. Check Jira:SprintFieldId and that issues are in a sprint.");

        // ---- MANAGER: burndown (real: open issues at the end of each day) ----
        var burndown = BuildBurndown(issues, now, warnings);

        // ---- DELIVERY: defect detection effectiveness (Assumption B in the guide) ----
        var reportedByClient = bugs.Count(b => b.Labels.Any(l =>
            string.Equals(l, _defs.ClientReportedLabel, StringComparison.OrdinalIgnoreCase)));
        var caught = bugs.Count - reportedByClient;
        if (bugs.Count > 0 && reportedByClient == 0)
            warnings.Add($"No bug has the label '{_defs.ClientReportedLabel}', so every bug counts as caught before release.");

        return new DashboardResponse(
            new TesterData(new PassFail(passed, failed)),
            new ManagerData(burndown, density, team, sprintTrend),
            new DeliveryData(
                new DefectDetection(caught, reportedByClient),
                bugs.Count(b => !IsDone(b) && IsCritical(b))),
            new DashboardMeta(now, issues.Count, warnings));
    }

    private Burndown BuildBurndown(IReadOnlyList<JiraIssue> issues, DateTimeOffset now, List<string> warnings)
    {
        var days = Math.Max(1, _defs.BurndownDays);
        var start = now.AddDays(-days);

        int OpenAt(DateTimeOffset t) =>
            issues.Count(i => i.Created <= t && (i.Resolved is null || i.Resolved > t));

        var labels = new string[days + 1];
        var ideal = new int[days + 1];
        var actual = new int[days + 1];
        var startOpen = OpenAt(start);

        for (var d = 0; d <= days; d++)
        {
            labels[d] = $"Day {d}";
            actual[d] = OpenAt(start.AddDays(d));
            ideal[d] = (int)Math.Round(startOpen * (1.0 - (double)d / days), MidpointRounding.AwayFromZero);
        }

        if (startOpen == 0)
            warnings.Add($"Nothing was open {days} days ago, so the ideal burndown line is flat at 0. Increase Definitions:BurndownDays once your project has history.");

        return new Burndown(labels, ideal, actual);
    }
}
