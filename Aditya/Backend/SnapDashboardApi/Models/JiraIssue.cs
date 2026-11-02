namespace SnapDashboardApi.Models;

public record SprintInfo(long Id, string Name);

// One Jira issue, reduced to only the fields the dashboard needs.
public record JiraIssue(
    string Key,
    string Summary,
    string Status,
    string StatusCategory,          // "new", "indeterminate" or "done" (Jira's own grouping)
    string IssueType,
    string? Assignee,
    IReadOnlyList<string> Components,
    IReadOnlyList<string> Labels,
    DateTimeOffset Created,
    DateTimeOffset? Resolved,
    SprintInfo? Sprint,
    string Priority);
