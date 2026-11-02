/* ===== SNAP: load real data from the C# API ===== */
var API_BASE = "http://localhost:5154";   // your http port

function snapChart(id) {
    var c = Chart.getChart(id);
    if (!c) console.warn("Chart not found: " + id);
    return c;
}

async function loadSnapDashboardData() {
    try {
        var res = await fetch(API_BASE + "/api/dashboard");
        if (!res.ok) throw new Error("API returned " + res.status);
        var d = await res.json();
        if (d.meta.warnings.length) console.warn("Dashboard warnings:", d.meta.warnings);

        // Tester: Pass / Fail
        var c = snapChart("testerPassFailChart");
        if (c) {
            c.data.datasets[0].data = [d.tester.passFail.passed, d.tester.passFail.failed];
            c.update();
        }

        // Manager: Burndown (Rohan's chart is in % remaining, so convert counts to %)
        c = snapChart("managerBurndownChart");
        if (c) {
            var bd = d.manager.burndown, start = bd.ideal[0];
            var pct = function (v) { return start ? Math.round(v / start * 100) : 0; };
            c.data.labels = bd.labels;
            c.data.datasets[0].data = bd.ideal.map(pct);
            c.data.datasets[1].data = bd.actual.map(pct);
            c.data.datasets[2].data = bd.labels.map(function () { return null; }); // no projection yet
            c.update();
        }

        // Manager: Defect Density (counts per component, so drop the fixed % axis)
        c = snapChart("managerDefectChart");
        if (c) {
            c.data.labels = d.manager.defectDensity.map(function (m) { return m.module; });
            c.data.datasets[0].data = d.manager.defectDensity.map(function (m) { return m.value; });
            c.options.scales.y.max = undefined;
            c.options.scales.y.ticks.callback = function (v) { return v; };
            c.update();
        }

        // Manager: Team Performance (red under 50%, green otherwise, like Rohan's dummy)
        c = snapChart("managerTeamChart");
        if (c) {
            var vals = d.manager.teamPerformance.map(function (t) { return t.completedPercentage; });
            c.data.labels = d.manager.teamPerformance.map(function (t) { return t.tester; });
            c.data.datasets[0].data = vals;
            c.data.datasets[0].backgroundColor = vals.map(function (v) { return v < 50 ? "#dc2626" : "#4f8a35"; });
            c.update();
        }

        // Manager: Sprint Trend (only if the API found sprint data)
        c = snapChart("managerTrendChart");
        if (c && d.manager.sprintTrend.length) {
            c.data.labels = d.manager.sprintTrend.map(function (s) { return s.sprint; });
            c.data.datasets[0].data = d.manager.sprintTrend.map(function (s) { return s.velocity; });
            c.data.datasets[1].data = d.manager.sprintTrend.map(function (s) { return s.bugCount; });
            c.data.datasets[2].data = d.manager.sprintTrend.map(function (s) { return s.passRate; });
            c.update();
        }

        // Delivery: Defect Detection Effectiveness
        c = snapChart("deliveryDefectEffectivenessChart");
        if (c) {
            var dde = d.delivery.defectDetectionEffectiveness;
            c.data.datasets[0].data = [dde.caughtBeforeRelease, dde.reportedByClient];
            c.update();
        }
    } catch (err) {
        console.error("Could not load dashboard data:", err);
    }
}

document.addEventListener("DOMContentLoaded", loadSnapDashboardData);