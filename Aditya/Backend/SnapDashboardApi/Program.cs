using SnapDashboardApi.Services;
using SnapDashboardApi.Settings;

var builder = WebApplication.CreateBuilder(args);

// 1. Settings: bind config sections to typed classes (secrets come from User Secrets in Development)
builder.Services.Configure<JiraOptions>(builder.Configuration.GetSection(JiraOptions.SectionName));
builder.Services.Configure<MetricDefinitions>(builder.Configuration.GetSection(MetricDefinitions.SectionName));

// 2. Dependency injection: interface -> implementation
builder.Services.AddHttpClient<IJiraClient, JiraClient>();
builder.Services.AddSingleton<IDashboardMetricsService, DashboardMetricsService>();

builder.Services.AddControllers();
builder.Services.AddOpenApi();   // delete this line and app.MapOpenApi() below if you did not tick "Enable OpenAPI"

// 3. CORS: lets dashboard.js (a different origin) call this API. Wide open = fine for a local POC only.
builder.Services.AddCors(options =>
    options.AddPolicy("Dashboard", p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

var jiraConfig = app.Configuration.GetSection("Jira");
Console.WriteLine($"Environment: {app.Environment.EnvironmentName}");
Console.WriteLine($"ProjectKey: {jiraConfig["ProjectKey"]}");
Console.WriteLine($"Email configured: {!string.IsNullOrWhiteSpace(jiraConfig["Email"])}");
Console.WriteLine($"Token configured: {!string.IsNullOrWhiteSpace(jiraConfig["ApiToken"])}");

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

// Note: no UseHttpsRedirection() on purpose, so a plain http:// call from the dashboard is not redirected.
app.UseCors("Dashboard");
app.MapControllers();
app.Run();