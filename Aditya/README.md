# SNAP Dashboard: Jira-connected backend and frontend (Aditya)

A C# ASP.NET Core Web API reads issues from Jira Cloud, calculates the numbers the dashboards need and
returns them as JSON. The HTML/JS dashboards call the API and draw the charts.

```
Jira Cloud  ->  C# API (GET /api/dashboard)  ->  JSON  ->  dashboard.js  ->  charts and cards
```

## Folder layout

```
Aditya/
  README.md
  Backend/
    SnapDashboardApi.sln
    SnapDashboardApi/
      Controllers/DashboardController.cs   HTTP endpoint, error handling
      Services/JiraClient.cs               Calls Jira (paging, auth), maps results to JiraIssue
      Services/DashboardMetricsService.cs  All metric calculations (never calls Jira)
      Models/                              JiraIssue and the JSON contract (DashboardResponse)
      Settings/                            Typed configuration (JiraOptions, MetricDefinitions)
      Program.cs                           Dependency injection, CORS, startup
      appsettings.json                     Non-secret settings
  Frontend/
    index.html                             The three dashboards (markup)
    dashboard.js                           Chart code and the live-data connection (SNAP_API_URL)
```

## How to run

1. Jira credentials are NOT in the repo. In `Aditya/Backend/SnapDashboardApi` run:
   ```
   dotnet user-secrets set "Jira:Email" "<atlassian login email>"
   dotnet user-secrets set "Jira:ApiToken" "<api token>"
   ```
   Set `Jira:BaseUrl`, `Jira:ProjectKey` and `Jira:SprintFieldId` in `appsettings.json`.
2. Open `Aditya/Backend/SnapDashboardApi.sln` in Visual Studio, choose the `http` profile, press F5.
   The API listens on `http://localhost:5154`.
3. Check `http://localhost:5154/api/dashboard` (look at `meta.totalIssues` and `meta.warnings`).
4. Open `Aditya/Frontend/index.html`. The toast "Live Jira data connected" confirms the connection.

## Graphs

All graphs are fed by one endpoint: `GET /api/dashboard`, handled by `DashboardController.Get`.
Each graph reads its own field of the JSON response.

### 1. Pass / Fail Rate
- Role: Tester
- Status: live
- What it shows: how many finished items passed versus how many defects are still open.
- Jira fields: Work type (Bug or not), Status category (Done or not).
- Formula: Passed = issues that are not Bugs and are Done. Failed = Bugs that are not Done.
  Executed = Passed + Failed. Resolved bugs and open non-bugs are outside both buckets.
- JSON field: `tester.passFail`
- Note: Jira stores no test execution results, so this is a stand-in. The definition is to be confirmed by the team.

### 2. Sprint Burndown
- Role: Test Manager
- Status: on hold (sprint-dependent)
- What it shows: how many items remain open day by day against an ideal straight line to zero.
- Jira fields: Created, Resolution date.
- Formula: open at the end of each day = issues created on or before that moment and not yet resolved, over the
  last 10 days. Ideal line = straight line from the starting open count to 0. The chart plots % remaining
  (open count / starting open count x 100).
- JSON field: `manager.burndown`
- Note: uses a rolling 10-day window, not real sprint start and end dates, which is why it is on hold.

### 3. Defect Density by Module
- Role: Test Manager
- Status: live
- What it shows: which modules (components) have the most bugs.
- Jira fields: Work type (Bug), Components.
- Formula: number of bugs per component. A bug with several components counts in each. Bugs without a
  component are grouped as "No component". Highest first, top 5.
- JSON field: `manager.defectDensity`
- Note: the chart shows counts, not a percentage. What "density" should mean is to be confirmed.

### 4. Team Performance
- Role: Test Manager
- Status: live
- What it shows: how much of each tester's assigned work is complete.
- Jira fields: Assignee, Status category.
- Formula: for each assignee, done issues / assigned issues x 100 (rounded). Highest first, top 6.
  The Team Execution Status table uses the same percentages: ON TRACK at 60% or more, otherwise BEHIND.
- JSON field: `manager.teamPerformance`

### 5. 3-Sprint Trend
- Role: Test Manager
- Status: on hold (sprint-dependent)
- What it shows: velocity, bug count and pass rate across the most recent sprints.
- Jira fields: Sprint, Status category, Work type.
- Formula: per sprint, velocity = issues Done, bug count = Bugs in the sprint, pass rate = Done issues /
  all issues in the sprint x 100. Sprints are ordered by the number in their name.
- JSON field: `manager.sprintTrend`
- Note: needs reliable sprint data in Jira.

### 6. Defect Detection Effectiveness
- Role: Delivery Manager
- Status: live
- What it shows: bugs caught by QA before release versus bugs reported by the client.
- Jira fields: Work type (Bug), Labels.
- Formula: Reported by client = Bugs labelled `client-reported`. Caught before release = all other Bugs.
  Effectiveness % = caught / (caught + reported) x 100. The spec benchmark is 85% (its source is still TBD).
- JSON field: `delivery.defectDetectionEffectiveness`

## Other visuals

| Visual | Status |
|---|---|
| Assigned, Completed and Failed cards (Tester) | Live: total issues, Passed and Failed counts |
| Defect Detection card (Delivery) | Live: same figures as graph 6 |
| Quality Gate: Critical Bugs row | Rule defined (bugs not Done with priority Highest, required 0). Jira connection pending. |
| Sprint Progress, Efficiency, Sprint Completion, Team Velocity | On hold (sprint-dependent) |
| Delivery Probability, Release Risk, other Quality Gate rows, Risk-Ranked Cases | Placeholders: Jira does not hold this data |

## Definitions to be confirmed by the team

1. What Pass / Fail should mean, since Jira holds no test results.
2. What "defect density" should mean (count of bugs, or a percentage).
3. Which priority counts as critical, and which marker means "client reported".
4. How the sprint-based visuals should be fed once sprint dates are reliable.
