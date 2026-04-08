const fs = require("node:fs");
const path = require("node:path");

const initSqlJs = require("sql.js");

const DATABASE_FILE = path.join(__dirname, "..", "data", "agent-hub.sqlite");

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    const SQL = await initSqlJs();
    const databaseBuffer = fs.existsSync(DATABASE_FILE) ? fs.readFileSync(DATABASE_FILE) : null;

    this.db = databaseBuffer ? new SQL.Database(databaseBuffer) : new SQL.Database();

    this.createSchema();
    this.seedDemoData();
    this.persist();

    return this;
  }

  createSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        due_at TEXT,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        location TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tag TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request TEXT NOT NULL,
        route TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT,
        transcript TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER,
        agent TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT,
        result_preview TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS integrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL UNIQUE,
        account_email TEXT,
        access_token TEXT,
        refresh_token TEXT,
        scope TEXT,
        expiry_date INTEGER,
        token_type TEXT,
        meta TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        state TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);
  }

  persist() {
    const data = this.db.export();
    fs.writeFileSync(DATABASE_FILE, Buffer.from(data));
  }

  now() {
    return new Date().toISOString();
  }

  all(sql, params = []) {
    const statement = this.db.prepare(sql, params);
    const rows = [];

    while (statement.step()) {
      rows.push(statement.getAsObject());
    }

    statement.free();
    return rows;
  }

  get(sql, params = []) {
    return this.all(sql, params)[0] || null;
  }

  execute(sql, params = []) {
    this.db.run(sql, params);
    this.persist();
  }

  seedDemoData() {
    const existingTasks = this.get("SELECT COUNT(*) AS count FROM tasks");

    if (Number(existingTasks?.count || 0) > 0) {
      return;
    }

    const seedTasks = [
      ["Finalize demo storyline for judges", "open", "high", "2026-04-09T06:30:00.000Z", "seed"],
      ["Prepare agent orchestration walkthrough", "open", "high", "2026-04-09T08:00:00.000Z", "seed"],
      ["Validate API payloads for live demo", "in_progress", "high", "2026-04-09T09:15:00.000Z", "seed"],
      ["Polish presentation deck", "open", "medium", "2026-04-09T10:00:00.000Z", "seed"],
    ];

    const seedEvents = [
      ["Daily standup", "2026-04-08T10:00:00.000Z", "2026-04-08T10:30:00.000Z", "Meet"],
      ["Judge rehearsal", "2026-04-08T13:30:00.000Z", "2026-04-08T14:15:00.000Z", "War room"],
      ["Submission buffer", "2026-04-08T16:00:00.000Z", "2026-04-08T17:00:00.000Z", "Focus block"],
    ];

    const seedNotes = [
      ["Winning angle", "Pitch the system as an AI Chief of Staff that turns one high-stakes request into coordinated execution.", "strategy"],
      ["Judging cues", "Show the orchestrator plan, then the MCP tool calls, then the persisted results in the database.", "judges"],
      ["Risk log", "Sensitive actions should be framed as approval-ready decisions even when demo mode auto-approves them.", "risk"],
    ];

    seedTasks.forEach(([title, status, priority, dueAt, source]) => {
      this.db.run(
        "INSERT INTO tasks (title, status, priority, due_at, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [title, status, priority, dueAt, source, this.now()],
      );
    });

    seedEvents.forEach(([title, startsAt, endsAt, location]) => {
      this.db.run(
        "INSERT INTO calendar_events (title, starts_at, ends_at, location, created_at) VALUES (?, ?, ?, ?, ?)",
        [title, startsAt, endsAt, location, this.now()],
      );
    });

    seedNotes.forEach(([title, content, tag]) => {
      this.db.run(
        "INSERT INTO notes (title, content, tag, created_at) VALUES (?, ?, ?, ?)",
        [title, content, tag, this.now()],
      );
    });

    this.persist();
  }

  createTask(task) {
    this.execute(
      "INSERT INTO tasks (title, status, priority, due_at, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        task.title,
        task.status || "open",
        task.priority || "medium",
        task.dueAt || null,
        task.source || "task-agent",
        this.now(),
      ],
    );

    return this.get("SELECT * FROM tasks ORDER BY id DESC LIMIT 1");
  }

  listTasks(limit = 12) {
    return this.all(
      "SELECT * FROM tasks ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, COALESCE(due_at, '9999-12-31T00:00:00.000Z'), id DESC LIMIT ?",
      [limit],
    );
  }

  listOpenTasks(limit = 6) {
    return this.all(
      "SELECT * FROM tasks WHERE status != 'done' ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, COALESCE(due_at, '9999-12-31T00:00:00.000Z') LIMIT ?",
      [limit],
    );
  }

  createEvent(event) {
    this.execute(
      "INSERT INTO calendar_events (title, starts_at, ends_at, location, created_at) VALUES (?, ?, ?, ?, ?)",
      [event.title, event.startsAt, event.endsAt, event.location || null, this.now()],
    );

    return this.get("SELECT * FROM calendar_events ORDER BY id DESC LIMIT 1");
  }

  listUpcomingEvents(limit = 5) {
    return this.all("SELECT * FROM calendar_events ORDER BY starts_at ASC LIMIT ?", [limit]);
  }

  createNote(note) {
    this.execute(
      "INSERT INTO notes (title, content, tag, created_at) VALUES (?, ?, ?, ?)",
      [note.title, note.content, note.tag || "general", this.now()],
    );

    return this.get("SELECT * FROM notes ORDER BY id DESC LIMIT 1");
  }

  listRecentNotes(limit = 5) {
    return this.all("SELECT * FROM notes ORDER BY id DESC LIMIT ?", [limit]);
  }

  createToolCall(call) {
    this.execute(
      "INSERT INTO tool_calls (run_id, agent, tool_name, action, payload, result_preview, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        call.runId || null,
        call.agent,
        call.toolName,
        call.action,
        JSON.stringify(call.payload || {}),
        call.resultPreview || "",
        this.now(),
      ],
    );

    return this.get("SELECT * FROM tool_calls ORDER BY id DESC LIMIT 1");
  }

  listRecentToolCalls(limit = 10) {
    return this.all("SELECT * FROM tool_calls ORDER BY id DESC LIMIT ?", [limit]).map((call) => ({
      ...call,
      payload: call.payload ? JSON.parse(call.payload) : {},
    }));
  }

  listToolCallsForRun(runId) {
    return this.all("SELECT * FROM tool_calls WHERE run_id = ? ORDER BY id ASC", [runId]).map((call) => ({
      ...call,
      payload: call.payload ? JSON.parse(call.payload) : {},
    }));
  }

  upsertIntegration(integration) {
    const existing = this.get("SELECT id FROM integrations WHERE provider = ?", [integration.provider]);
    const now = this.now();
    const meta = JSON.stringify(integration.meta || {});

    if (existing) {
      this.execute(
        `
          UPDATE integrations
          SET account_email = ?, access_token = ?, refresh_token = ?, scope = ?, expiry_date = ?, token_type = ?, meta = ?, updated_at = ?
          WHERE provider = ?
        `,
        [
          integration.accountEmail || null,
          integration.accessToken || null,
          integration.refreshToken || null,
          integration.scope || null,
          integration.expiryDate || null,
          integration.tokenType || null,
          meta,
          now,
          integration.provider,
        ],
      );
    } else {
      this.execute(
        `
          INSERT INTO integrations (provider, account_email, access_token, refresh_token, scope, expiry_date, token_type, meta, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          integration.provider,
          integration.accountEmail || null,
          integration.accessToken || null,
          integration.refreshToken || null,
          integration.scope || null,
          integration.expiryDate || null,
          integration.tokenType || null,
          meta,
          now,
          now,
        ],
      );
    }

    return this.getIntegration(integration.provider);
  }

  getIntegration(provider) {
    const integration = this.get("SELECT * FROM integrations WHERE provider = ?", [provider]);

    if (!integration) {
      return null;
    }

    return {
      ...integration,
      meta: integration.meta ? JSON.parse(integration.meta) : {},
    };
  }

  deleteIntegration(provider) {
    this.execute("DELETE FROM integrations WHERE provider = ?", [provider]);
  }

  resetWorkspaceData() {
    this.execute("DELETE FROM tasks");
    this.execute("DELETE FROM calendar_events");
    this.execute("DELETE FROM notes");
    this.execute("DELETE FROM workflow_runs");
    this.execute("DELETE FROM tool_calls");
    this.execute("DELETE FROM sqlite_sequence WHERE name IN ('tasks', 'calendar_events', 'notes', 'workflow_runs', 'tool_calls')");
    this.seedDemoData();
    this.persist();
  }

  createAuthState(provider, state) {
    this.execute(
      "INSERT INTO auth_states (provider, state, created_at) VALUES (?, ?, ?)",
      [provider, state, this.now()],
    );
  }

  consumeAuthState(provider, state) {
    const record = this.get("SELECT * FROM auth_states WHERE provider = ? AND state = ?", [provider, state]);

    if (!record) {
      return null;
    }

    this.execute("DELETE FROM auth_states WHERE id = ?", [record.id]);
    return record;
  }

  createWorkflowRun(run) {
    this.execute(
      "INSERT INTO workflow_runs (request, route, status, summary, transcript, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [run.request, run.route, run.status, run.summary || null, run.transcript || null, this.now()],
    );

    return Number(this.get("SELECT MAX(id) AS id FROM workflow_runs")?.id || 0);
  }

  completeWorkflowRun(id, summary, transcript) {
    this.execute(
      "UPDATE workflow_runs SET status = 'completed', summary = ?, transcript = ? WHERE id = ?",
      [summary, JSON.stringify(transcript), id],
    );
  }

  failWorkflowRun(id, errorMessage, transcript) {
    this.execute(
      "UPDATE workflow_runs SET status = 'failed', summary = ?, transcript = ? WHERE id = ?",
      [errorMessage, JSON.stringify(transcript), id],
    );
  }

  getWorkflowRuns(limit = 6) {
    return this.all("SELECT * FROM workflow_runs ORDER BY id DESC LIMIT ?", [limit]).map((run) => ({
      ...run,
      transcript: run.transcript ? JSON.parse(run.transcript) : [],
    }));
  }

  getDashboard() {
    const taskTotals = this.get(`
      SELECT
        SUM(CASE WHEN status != 'done' THEN 1 ELSE 0 END) AS open_tasks,
        SUM(CASE WHEN priority = 'high' AND status != 'done' THEN 1 ELSE 0 END) AS critical_tasks,
        COUNT(*) AS total_tasks
      FROM tasks
    `);

    const noteTotals = this.get("SELECT COUNT(*) AS total_notes FROM notes");
    const eventTotals = this.get("SELECT COUNT(*) AS total_events FROM calendar_events");
    const runTotals = this.get("SELECT COUNT(*) AS total_runs FROM workflow_runs");
    const toolTotals = this.get("SELECT COUNT(*) AS total_calls FROM tool_calls");

    return {
      product: {
        name: "Chief of Staff AI",
        tagline: "One coordinator agent that turns a deadline into delegated execution.",
        narrative:
          "The system accepts one high-stakes request, plans the workflow, delegates to sub-agents, executes through MCP tools, and persists every result as an API-first audit trail.",
      },
      integrations: {
        googleCalendar: (() => {
          const integration = this.getIntegration("google_calendar");
          return {
            connected: Boolean(integration?.refresh_token),
            accountEmail: integration?.account_email || null,
          };
        })(),
      },
      metrics: [
        { label: "Active tasks", value: Number(taskTotals?.open_tasks || 0) },
        { label: "Critical tasks", value: Number(taskTotals?.critical_tasks || 0) },
        { label: "Tool executions", value: Number(toolTotals?.total_calls || 0) },
        { label: "Workflow runs", value: Number(runTotals?.total_runs || 0) },
      ],
      tasks: this.listTasks(8),
      events: this.listUpcomingEvents(5),
      notes: this.listRecentNotes(4),
      runs: this.getWorkflowRuns(4),
      toolCalls: this.listRecentToolCalls(8),
      requirements: [
        "Primary orchestrator coordinating sub-agents",
        "Persistent structured storage with workflow history",
        "MCP-style tool integrations for tasks, calendar, and notes",
        "Multi-step execution with visible delegation",
        "API-first deployment model",
      ],
      judgeChecklist: [
        "One prompt triggers a full, multi-agent workflow",
        "Every tool call is logged and persisted",
        "The database updates immediately after execution",
        "The user sees a final chief-of-staff brief, not raw CRUD output",
      ],
      apiSurface: [
        "POST /api/agent/run",
        "GET /api/dashboard",
        "GET /api/tasks",
        "GET /api/calendar",
        "GET /api/notes",
        "GET /api/tool-calls",
      ],
      samplePrompts: [
        "We present tomorrow at 11 AM. Create missing prep tasks, block 2 hours for rehearsal, summarize the judging notes, and prepare a final checklist.",
        "I need a submission-day brief with top priorities, calendar risks, and the context I should remember before the demo.",
        "Capture deployment risks, suggest the next available focus slot, and tell me what the team should do in the next 3 hours.",
        "We just got shortlisted for the final round. Create a rapid-response plan, schedule a war room in the next open slot, and summarize our strongest judging angles.",
        "Prepare me for a surprise judge Q&A. Create follow-up tasks, block a 90-minute prep session, and pull the most important architecture notes.",
        "Our backend deploy may slip. Capture the risk, create mitigation tasks, and give me a concise execution brief for the next 2 hours.",
        "Plan tomorrow like an AI chief of staff: rank the most critical work, reserve rehearsal time, and tell me what I need to remember before presenting.",
        "Turn this into an investor-style demo day runbook: create checklist tasks, schedule prep time, and summarize the product story I should lead with.",
        "We need to coordinate design, backend, and pitch in one plan. Create workstreams, suggest calendar protection, and save the key delivery note.",
        "Find my next available focus window, create the top three remaining submission tasks, and summarize the notes that matter most for the final pitch.",
      ],
    };
  }
}

module.exports = {
  DatabaseService,
};
