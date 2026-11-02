namespace SnapDashboardApi.Settings;

// Bound from the "Jira" section of appsettings.json + User Secrets.
public class JiraOptions
{
    public const string SectionName = "Jira";

    public string BaseUrl { get; set; } = "";        // appsettings.json
    public string ProjectKey { get; set; } = "SNAP"; // appsettings.json
    public string SprintFieldId { get; set; } = "";  // appsettings.json, e.g. customfield_10020

    public string Email { get; set; } = "";          // User Secrets ONLY
    public string ApiToken { get; set; } = "";       // User Secrets ONLY
}
