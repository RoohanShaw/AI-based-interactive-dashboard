using Microsoft.AspNetCore.Mvc;
using SnapDashboardApi.Models;
using SnapDashboardApi.Services;

namespace SnapDashboardApi.Controllers;

// The controller only handles HTTP: call the services, translate failures into status codes.
[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IJiraClient _jira;
    private readonly IDashboardMetricsService _metrics;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(IJiraClient jira, IDashboardMetricsService metrics, ILogger<DashboardController> logger)
    {
        _jira = jira;
        _metrics = metrics;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<DashboardResponse>> Get(CancellationToken ct)
    {
        try
        {
            var issues = await _jira.GetIssuesAsync(ct);
            return Ok(_metrics.Build(issues, DateTimeOffset.UtcNow));
        }
        catch (InvalidOperationException ex)   // settings missing
        {
            _logger.LogError(ex, "Configuration problem");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
        }
        catch (HttpRequestException ex)        // Jira said no, or was unreachable
        {
            _logger.LogError(ex, "Jira request failed");
            return StatusCode(StatusCodes.Status502BadGateway, new { error = "Could not get data from Jira.", detail = ex.Message });
        }
    }
}
