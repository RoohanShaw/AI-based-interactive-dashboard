using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SnapDashboardApi.Models;
using SnapDashboardApi.Settings;

namespace SnapDashboardApi.Services;

// Job: talk to Jira, return clean JiraIssue objects. No dashboard maths here.
public class JiraClient : IJiraClient
{
    private readonly HttpClient _http;
    private readonly JiraOptions _opt;
    private readonly ILogger<JiraClient> _logger;

    public JiraClient(HttpClient http, IOptions<JiraOptions> options, ILogger<JiraClient> logger)
    {
        _http = http;
        _opt = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<JiraIssue>> GetIssuesAsync(CancellationToken ct = default)
    {
        EnsureConfigured();

        var fields = new List<string>
        {
            "summary", "status", "issuetype", "assignee", "priority",
            "components", "labels", "created", "resolutiondate", "updated"
        };
        if (!string.IsNullOrWhiteSpace(_opt.SprintFieldId))
            fields.Add(_opt.SprintFieldId);

        var jql = $"project = {_opt.ProjectKey} ORDER BY created DESC";
        var issues = new List<JiraIssue>();
        string? pageToken = null;
        var pageNumber = 0;

        _logger.LogInformation("Requesting Jira issues for project {ProjectKey} with JQL {Jql}", _opt.ProjectKey, jql);

        // Jira returns max 100 issues per call, so we keep asking until it says there are no more pages.
        do
        {
            var path = "rest/api/3/search/jql"
                + $"?jql={Uri.EscapeDataString(jql)}"
                + $"&fields={Uri.EscapeDataString(string.Join(",", fields))}"
                + "&maxResults=100";
            if (pageToken is not null)
                path += $"&nextPageToken={Uri.EscapeDataString(pageToken)}";

            using var request = CreateRequest(path);
            using var response = await _http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException($"Jira returned {(int)response.StatusCode}: {body}");

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            _logger.LogInformation("Jira response keys: {Keys}",
                string.Join(", ", root.EnumerateObject().Select(p => p.Name)));

            _logger.LogInformation("Jira response preview: {Body}",
                body.Length > 2000 ? body[..2000] : body);

            var pageIssues = root.GetProperty("issues");
            pageNumber++;
            _logger.LogInformation(
                "Jira page {PageNumber} returned {IssueCount} issues for project {ProjectKey}",
                pageNumber,
                pageIssues.GetArrayLength(),
                _opt.ProjectKey);

            foreach (var item in pageIssues.EnumerateArray())
                issues.Add(Map(item));

            pageToken = root.TryGetProperty("nextPageToken", out var t) && t.ValueKind == JsonValueKind.String
                ? t.GetString()
                : null;
        }
        while (pageToken is not null);

        _logger.LogInformation("Collected {IssueCount} Jira issues for project {ProjectKey}", issues.Count, _opt.ProjectKey);
        return issues;
    }

    private JiraIssue Map(JsonElement item)
    {
        var f = item.GetProperty("fields");
        var status = f.GetProperty("status");

        string? assignee = null;
        if (f.TryGetProperty("assignee", out var a) && a.ValueKind == JsonValueKind.Object)
            assignee = GetString(a, "displayName");

        // Sprint field is an array (an issue can belong to several sprints). Keep the newest (highest id).
        SprintInfo? sprint = null;
        if (!string.IsNullOrWhiteSpace(_opt.SprintFieldId)
            && f.TryGetProperty(_opt.SprintFieldId, out var sp)
            && sp.ValueKind == JsonValueKind.Array)
        {
            foreach (var sprintEl in sp.EnumerateArray())
            {
                if (sprintEl.TryGetProperty("id", out var idEl)
                    && idEl.TryGetInt64(out var id)
                    && (sprint is null || id > sprint.Id))
                {
                    sprint = new SprintInfo(id, GetString(sprintEl, "name") ?? $"Sprint {id}");
                }
            }
        }

        var statusCategory = status.TryGetProperty("statusCategory", out var sc) ? GetString(sc, "key") ?? "" : "";

        // Some issues are Done but Jira never recorded a resolution date.
        // Fall back to the last-updated time as an approximation.
        var resolved = ParseDate(GetString(f, "resolutiondate"));
        if (resolved is null && string.Equals(statusCategory, "done", StringComparison.OrdinalIgnoreCase))
            resolved = ParseDate(GetString(f, "updated"));

        var priority = f.TryGetProperty("priority", out var pr) && pr.ValueKind == JsonValueKind.Object
            ? GetString(pr, "name") ?? ""
            : "";

        return new JiraIssue(
            Key: GetString(item, "key") ?? "",
            Summary: GetString(f, "summary") ?? "",
            Status: GetString(status, "name") ?? "",
            StatusCategory: statusCategory,
            IssueType: f.TryGetProperty("issuetype", out var it) ? GetString(it, "name") ?? "" : "",
            Assignee: assignee,
            Components: ReadNames(f, "components"),
            Labels: ReadStrings(f, "labels"),
            Created: ParseDate(GetString(f, "created")) ?? DateTimeOffset.MinValue,
            Resolved: resolved,
            Sprint: sprint,
            Priority: priority);
    }

    private HttpRequestMessage CreateRequest(string pathAndQuery)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"{_opt.BaseUrl.TrimEnd('/')}/{pathAndQuery}");
        var raw = Encoding.UTF8.GetBytes($"{_opt.Email}:{_opt.ApiToken}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(raw));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return request;
    }

    private void EnsureConfigured()
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(_opt.BaseUrl)) missing.Add("Jira:BaseUrl");
        if (string.IsNullOrWhiteSpace(_opt.ProjectKey)) missing.Add("Jira:ProjectKey");
        if (string.IsNullOrWhiteSpace(_opt.Email)) missing.Add("Jira:Email");
        if (string.IsNullOrWhiteSpace(_opt.ApiToken)) missing.Add("Jira:ApiToken");

        if (missing.Count > 0)
            throw new InvalidOperationException(
                "Missing settings: " + string.Join(", ", missing) +
                ". Email and ApiToken belong in User Secrets; the rest in appsettings.json.");
    }

    private static string? GetString(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static List<string> ReadNames(JsonElement f, string name)
    {
        var list = new List<string>();
        if (f.TryGetProperty(name, out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var el in arr.EnumerateArray())
            {
                var n = GetString(el, "name");
                if (!string.IsNullOrWhiteSpace(n)) list.Add(n);
            }
        return list;
    }

    private static List<string> ReadStrings(JsonElement f, string name)
    {
        var list = new List<string>();
        if (f.TryGetProperty(name, out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var el in arr.EnumerateArray())
                if (el.ValueKind == JsonValueKind.String && el.GetString() is { } s) list.Add(s);
        return list;
    }

    private static DateTimeOffset? ParseDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        // Jira sends offsets like +0530; .NET wants +05:30, so insert the colon.
        if (s.Length > 5 && (s[^5] == '+' || s[^5] == '-') && s[^3] != ':')
            s = s.Insert(s.Length - 2, ":");
        return DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
    }
}
