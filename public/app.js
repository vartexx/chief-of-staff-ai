const state = {
  dashboard: null,
  architecture: null,
  tools: [],
  latestRun: null,
};

const elements = {
  statusBanner: document.getElementById("statusBanner"),
  productNarrative: document.getElementById("productNarrative"),
  requirementsList: document.getElementById("requirementsList"),
  judgeChecklist: document.getElementById("judgeChecklist"),
  architectureList: document.getElementById("architectureList"),
  apiSurface: document.getElementById("apiSurface"),
  googleCalendarStatus: document.getElementById("googleCalendarStatus"),
  googleConnectButton: document.getElementById("googleConnectButton"),
  googleDemoButton: document.getElementById("googleDemoButton"),
  googleDisconnectButton: document.getElementById("googleDisconnectButton"),
  metricsGrid: document.getElementById("metricsGrid"),
  toolCatalog: document.getElementById("toolCatalog"),
  samplePrompts: document.getElementById("samplePrompts"),
  commandForm: document.getElementById("commandForm"),
  requestInput: document.getElementById("requestInput"),
  refreshButton: document.getElementById("refreshButton"),
  resetWorkspaceButton: document.getElementById("resetWorkspaceButton"),
  executiveBrief: document.getElementById("executiveBrief"),
  nextMoves: document.getElementById("nextMoves"),
  approvalsList: document.getElementById("approvalsList"),
  scorecardGrid: document.getElementById("scorecardGrid"),
  planList: document.getElementById("planList"),
  transcriptList: document.getElementById("transcriptList"),
  toolCallList: document.getElementById("toolCallList"),
  taskList: document.getElementById("taskList"),
  eventList: document.getElementById("eventList"),
  noteList: document.getElementById("noteList"),
};

function createEmptyState(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function createCard(className, html) {
  const node = document.createElement("article");
  node.className = className;
  node.innerHTML = html;
  return node;
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function showStatus(message, tone = "info") {
  elements.statusBanner.textContent = message;
  elements.statusBanner.className = `status-banner ${tone}`;
}

function clearStatus() {
  elements.statusBanner.textContent = "";
  elements.statusBanner.className = "status-banner hidden";
}

function applyStatusFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const googleStatus = params.get("google_calendar");

  if (!googleStatus) {
    return;
  }

  if (googleStatus === "connected") {
    showStatus("Google Calendar connected. You can now create real calendar events from the demo.", "success");
  } else if (googleStatus === "error") {
    showStatus("Google Calendar connection failed. Double-check your OAuth credentials and redirect URI.", "error");
  } else if (googleStatus === "missing_code") {
    showStatus("Google OAuth did not return a usable authorization code.", "error");
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("google_calendar");
  window.history.replaceState({}, "", url);
}

function renderSimpleList(target, items, className, formatter, emptyMessage) {
  if (!items || items.length === 0) {
    target.replaceChildren(createEmptyState(emptyMessage));
    return;
  }

  target.replaceChildren(...items.map((item) => createCard(className, formatter(item))));
}

function renderHeaderData() {
  elements.productNarrative.textContent = state.dashboard.product.narrative;

  renderSimpleList(
    elements.requirementsList,
    state.dashboard.requirements,
    "requirement-item",
    (item) => `<span>${item}</span>`,
    "No requirements loaded.",
  );

  renderSimpleList(
    elements.judgeChecklist,
    state.dashboard.judgeChecklist,
    "judge-item",
    (item) => `<strong>Proof point</strong><span>${item}</span>`,
    "No proof points loaded.",
  );

  const architectureCards = [
    { title: state.architecture.coordinator, copy: state.architecture.coordinatorRole },
    { title: "Sub-agents", copy: state.architecture.subAgents.join(", ") },
    { title: "Persistence", copy: state.architecture.storage },
    { title: "Tool layer", copy: state.architecture.gateway },
  ];

  renderSimpleList(
    elements.architectureList,
    architectureCards,
    "architecture-item",
    (item) => `<strong>${item.title}</strong><span>${item.copy}</span>`,
    "No architecture data loaded.",
  );

  renderSimpleList(
    elements.apiSurface,
    state.dashboard.apiSurface,
    "api-item",
    (item) => `<code>${item}</code>`,
    "No endpoints loaded.",
  );
}

function renderIntegrationStatus() {
  const status = state.dashboard.integrations?.googleCalendar;

  if (!status) {
    elements.googleCalendarStatus.textContent = "Google Calendar status unavailable.";
    elements.googleDisconnectButton.disabled = true;
    elements.googleDemoButton.disabled = true;
    elements.googleConnectButton.textContent = "Connect Calendar";
    return;
  }

  if (!status.configured) {
    elements.googleCalendarStatus.textContent =
      "Not configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to enable Google sign-in.";
    elements.googleConnectButton.setAttribute("aria-disabled", "true");
    elements.googleConnectButton.classList.add("disabled-link");
    elements.googleConnectButton.href = "#";
    elements.googleConnectButton.textContent = "Connect Calendar";
    elements.googleDisconnectButton.disabled = true;
    elements.googleDemoButton.disabled = true;
    return;
  }

  elements.googleConnectButton.removeAttribute("aria-disabled");
  elements.googleConnectButton.classList.remove("disabled-link");
  elements.googleConnectButton.href = "/api/auth/google/start";

  if (status.connected) {
    elements.googleCalendarStatus.textContent = `Connected as ${status.accountEmail || "your Google account"}. New focus blocks will be created on your real Google Calendar.`;
    elements.googleConnectButton.textContent = "Connected";
    elements.googleConnectButton.classList.add("disabled-link");
    elements.googleConnectButton.href = "#";
    elements.googleConnectButton.setAttribute("aria-disabled", "true");
    elements.googleDisconnectButton.disabled = false;
    elements.googleDemoButton.disabled = false;
  } else {
    elements.googleCalendarStatus.textContent = "Configured, but not connected yet. Click Connect Calendar to authorize access.";
    elements.googleConnectButton.textContent = "Connect Calendar";
    elements.googleDisconnectButton.disabled = true;
    elements.googleDemoButton.disabled = true;
  }
}

function renderMetrics() {
  renderSimpleList(
    elements.metricsGrid,
    state.dashboard.metrics,
    "metric-card",
    (metric) => `<strong>${metric.value}</strong><span>${metric.label}</span>`,
    "No metrics available.",
  );
}

function renderTools() {
  renderSimpleList(
    elements.toolCatalog,
    state.tools,
    "tool-chip",
    (tool) => `<strong>${tool.name}</strong><span>${tool.actions.join(", ")}</span>`,
    "No tools loaded.",
  );
}

function renderSamples() {
  if (!state.dashboard.samplePrompts?.length) {
    elements.samplePrompts.replaceChildren(createEmptyState("No sample prompts loaded."));
    return;
  }

  elements.samplePrompts.replaceChildren(
    ...state.dashboard.samplePrompts.map((prompt, index) => {
      const category = prompt.toLowerCase().includes("risk")
        ? "Risk Drill"
        : prompt.toLowerCase().includes("judge")
          ? "Judge Prep"
          : prompt.toLowerCase().includes("investor")
            ? "Demo Story"
            : prompt.toLowerCase().includes("focus")
              ? "Execution"
              : "Scenario";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sample-button";
      button.innerHTML = `
        <div class="sample-meta">
          <strong>${category}</strong>
          <span class="sample-index">${String(index + 1).padStart(2, "0")}</span>
        </div>
        <span>${prompt}</span>
      `;
      button.addEventListener("click", () => {
        elements.requestInput.value = prompt;
      });
      return button;
    }),
  );
}

function renderRunOutcome() {
  if (!state.latestRun) {
    elements.executiveBrief.textContent = "Run the workflow to generate a live chief-of-staff brief.";
    elements.nextMoves.replaceChildren(createEmptyState("No next moves yet."));
    elements.approvalsList.replaceChildren(createEmptyState("No approvals yet."));
    elements.scorecardGrid.replaceChildren(createEmptyState("No scorecard yet."));
    elements.planList.replaceChildren(createEmptyState("No plan yet."));
    elements.transcriptList.replaceChildren(createEmptyState("No transcript yet."));
    return;
  }

  elements.executiveBrief.textContent = state.latestRun.executiveBrief || state.latestRun.summary || "Workflow completed.";

  renderSimpleList(
    elements.nextMoves,
    state.latestRun.nextMoves || [],
    "next-move",
    (item) => `<strong>Next move</strong><span>${item}</span>`,
    "No next moves generated.",
  );

  renderSimpleList(
    elements.approvalsList,
    state.latestRun.approvals || [],
    "approval-item",
    (item) => `<strong>${item.label}</strong><span>${item.status}</span>`,
    "No approvals required.",
  );

  renderSimpleList(
    elements.scorecardGrid,
    state.latestRun.scorecard || [],
    "scorecard-item",
    (item) => `<strong>${item.value}</strong><span>${item.label}</span>`,
    "No scorecard available.",
  );

  renderSimpleList(
    elements.planList,
    state.latestRun.plan || [],
    "plan-item",
    (item) => `<strong>${item.agent}</strong><span>${item.summary}</span>`,
    "No plan steps available.",
  );

  renderSimpleList(
    elements.transcriptList,
    state.latestRun.transcript || [],
    "timeline-item",
    (item) => `
      <strong>${item.step}</strong>
      <span>${item.detail}</span>
      ${item.highlights?.length ? `<em>${item.highlights.join(" • ")}</em>` : ""}
    `,
    "No transcript available.",
  );
}

function renderToolCalls() {
  const toolCalls = state.latestRun?.toolCalls || state.dashboard.toolCalls;

  renderSimpleList(
    elements.toolCallList,
    toolCalls,
    "tool-call-item",
    (call) => `
      <strong>${call.agent} -> ${call.tool_name || call.toolName}.${call.action}</strong>
      <span>${call.result_preview || "Completed"}</span>
      <em>${call.created_at ? formatDate(call.created_at) : "Just now"}</em>
    `,
    "No tool calls recorded yet.",
  );
}

function renderWorkspaceState() {
  renderSimpleList(
    elements.taskList,
    state.dashboard.tasks,
    "stack-item",
    (task) => `
      <strong>${task.title}</strong>
      <span>${task.priority} priority • ${task.status}</span>
      <em>${task.due_at ? formatDate(task.due_at) : "No due date"}</em>
    `,
    "No tasks available.",
  );

  renderSimpleList(
    elements.eventList,
    state.dashboard.events,
    "stack-item",
    (event) => `
      <strong>${event.title}</strong>
      <span>${formatDate(event.starts_at)}</span>
      <em>${event.location || "No location"}</em>
    `,
    "No events available.",
  );

  renderSimpleList(
    elements.noteList,
    state.dashboard.notes,
    "stack-item",
    (note) => `
      <strong>${note.title}</strong>
      <span>${note.content}</span>
      <em>${note.tag}</em>
    `,
    "No notes available.",
  );
}

function renderDashboard() {
  renderHeaderData();
  renderIntegrationStatus();
  renderMetrics();
  renderTools();
  renderSamples();
  renderRunOutcome();
  renderToolCalls();
  renderWorkspaceState();

  if (!elements.requestInput.value.trim() && state.dashboard.samplePrompts?.[0]) {
    elements.requestInput.value = state.dashboard.samplePrompts[0];
  }
}

async function fetchDashboard() {
  const response = await fetch("/api/dashboard");
  const data = await response.json();

  state.dashboard = data.dashboard;
  state.tools = data.tools;
  state.architecture = data.architecture;
  const recentRun = data.dashboard.runs?.[0];
  state.latestRun = recentRun
    ? {
        summary: recentRun.summary,
        executiveBrief: recentRun.summary,
        transcript: recentRun.transcript || [],
        toolCalls: data.dashboard.toolCalls || [],
        plan: [],
        nextMoves: [],
        approvals: [],
        scorecard: [],
      }
    : null;

  renderDashboard();
}

async function runWorkflow(request) {
  const response = await fetch("/api/agent/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ request }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.details || data.error || "Workflow failed");
  }

  state.latestRun = data;
  state.dashboard = data.dashboard;
  renderDashboard();
}

elements.commandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const request = elements.requestInput.value.trim();

  if (!request) {
    return;
  }

  elements.executiveBrief.textContent = "Launching multi-agent workflow...";

  try {
    await runWorkflow(request);
  } catch (error) {
    elements.executiveBrief.textContent = error.message;
  }
});

elements.refreshButton.addEventListener("click", () => {
  fetchDashboard().catch((error) => {
    elements.executiveBrief.textContent = error.message;
  });
});

elements.resetWorkspaceButton.addEventListener("click", async () => {
  showStatus("Resetting demo workspace to a clean state...", "info");

  const response = await fetch("/api/demo/reset-workspace", {
    method: "POST",
  });
  const data = await response.json();

  if (!response.ok) {
    showStatus(data.details || data.error || "Failed to reset demo workspace.", "error");
    return;
  }

  state.dashboard = data.dashboard;
  state.latestRun = null;
  renderDashboard();
  showStatus(data.message, "success");
  elements.executiveBrief.textContent =
    "Workspace cleaned for a fresh judge run. Use the first scenario for the strongest live demo.";
});

elements.googleDisconnectButton.addEventListener("click", async () => {
  await fetch("/api/integrations/google-calendar/disconnect", {
    method: "POST",
  });

  showStatus("Google Calendar disconnected.", "info");
  await fetchDashboard();
});

elements.googleDemoButton.addEventListener("click", async () => {
  showStatus("Creating a real Google Calendar demo event...", "info");

  const response = await fetch("/api/demo/rehearsal-block", {
    method: "POST",
  });
  const data = await response.json();

  if (!response.ok) {
    showStatus(data.details || data.error || "Failed to create the demo event.", "error");
    return;
  }

  showStatus(`${data.message} Scheduled for ${formatDate(data.event.starts_at)}.`, "success");
  await fetchDashboard();
  elements.executiveBrief.textContent =
    "Live external-tool proof completed: the app created a real Google Calendar event and persisted the action in the audit trail.";
});

applyStatusFromUrl();
fetchDashboard().catch((error) => {
  showStatus(error.message, "error");
  elements.executiveBrief.textContent = error.message;
});
