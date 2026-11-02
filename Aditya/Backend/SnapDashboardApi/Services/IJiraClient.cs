using SnapDashboardApi.Models;

namespace SnapDashboardApi.Services;

public interface IJiraClient
{
    Task<IReadOnlyList<JiraIssue>> GetIssuesAsync(CancellationToken ct = default);
}
