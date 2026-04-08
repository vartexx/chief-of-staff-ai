require("dotenv").config();

const express = require("express");
const path = require("node:path");

const { DatabaseService } = require("./src/database");
const { createSystem } = require("./src/system");

async function startServer() {
  const app = express();
  const database = await new DatabaseService().initialize();
  const system = createSystem(database);

  function buildDashboardPayload() {
    const googleCalendarStatus = system.googleCalendarService.getConnectionStatus();
    const dashboard = database.getDashboard();
    dashboard.integrations.googleCalendar = {
      ...dashboard.integrations.googleCalendar,
      configured: googleCalendarStatus.configured,
      connected: googleCalendarStatus.connected,
      accountEmail: googleCalendarStatus.accountEmail,
    };

    return dashboard;
  }

  app.use(express.json());
  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");
    next();
  });
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "multi-agent-productivity-system",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/dashboard", (_request, response) => {
    response.json({
      dashboard: buildDashboardPayload(),
      tools: system.gateway.getCatalog(),
      architecture: system.orchestrator.describe(),
    });
  });

  app.get("/api/runs", (_request, response) => {
    response.json({ runs: database.getWorkflowRuns(8) });
  });

  app.get("/api/tasks", (_request, response) => {
    response.json({ tasks: database.listTasks(20) });
  });

  app.get("/api/calendar", (_request, response) => {
    response.json({ events: database.listUpcomingEvents(20) });
  });

  app.get("/api/notes", (_request, response) => {
    response.json({ notes: database.listRecentNotes(20) });
  });

  app.get("/api/tool-calls", (_request, response) => {
    response.json({ toolCalls: database.listRecentToolCalls(30) });
  });

  app.get("/api/integrations/google-calendar/status", (_request, response) => {
    response.json(system.googleCalendarService.getConnectionStatus());
  });

  app.get("/api/auth/google/start", (_request, response) => {
    try {
      const { url } = system.googleCalendarService.createAuthUrl();
      response.redirect(url);
    } catch (error) {
      response
        .status(500)
        .send(
          `<h1>Google Calendar not configured</h1><p>${error instanceof Error ? error.message : String(error)}</p>`,
        );
    }
  });

  app.get("/api/auth/google/callback", async (request, response) => {
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const state = typeof request.query.state === "string" ? request.query.state : "";

    if (!code || !state) {
      response.redirect("/?google_calendar=missing_code");
      return;
    }

    try {
      await system.googleCalendarService.completeOAuth(code, state);
      response.redirect("/?google_calendar=connected");
    } catch (_error) {
      response.redirect("/?google_calendar=error");
    }
  });

  app.post("/api/integrations/google-calendar/disconnect", async (_request, response) => {
    await system.googleCalendarService.disconnect();
    response.json({ ok: true });
  });

  app.post("/api/demo/rehearsal-block", async (_request, response) => {
    const googleStatus = system.googleCalendarService.getConnectionStatus();

    if (!googleStatus.connected) {
      response.status(400).json({
        error: "Google Calendar is not connected yet.",
      });
      return;
    }

    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(11, 0, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 90);

    try {
      const result = await system.gateway.invoke(
        "calendar",
        "createFocusBlock",
        {
          title: "Judge Rehearsal - Chief of Staff AI",
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          location: "Google Calendar demo event",
        },
        {
          agent: "demo-action",
        },
      );

      response.json({
        ok: true,
        event: result.data,
        message: "Real Google Calendar event created successfully.",
      });
    } catch (error) {
      response.status(500).json({
        error: "Failed to create the rehearsal block.",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/demo/reset-workspace", (_request, response) => {
    database.resetWorkspaceData();
    response.json({
      ok: true,
      message: "Demo workspace reset to a clean state.",
      dashboard: buildDashboardPayload(),
    });
  });

  app.post("/api/agent/run", async (request, response) => {
    const input = typeof request.body?.request === "string" ? request.body.request.trim() : "";

    if (!input) {
      response.status(400).json({ error: "A request prompt is required." });
      return;
    }

    try {
      const result = await system.orchestrator.handle(input);
      result.dashboard = buildDashboardPayload();
      response.json(result);
    } catch (error) {
      response.status(500).json({
        error: "The orchestration workflow failed.",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.use((_request, response) => {
    response.sendFile(path.join(__dirname, "public", "index.html"));
  });

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Multi-agent prototype running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start the prototype:", error);
  process.exitCode = 1;
});
