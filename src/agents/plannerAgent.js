class PlannerAgent {
  constructor(database) {
    this.database = database;
  }

  plan(request) {
    const prompt = request.toLowerCase();
    const wantsBrief = /(brief|summary|summarize|overview|status)/.test(prompt);
    const wantsTasks = /(task|todo|follow-up|follow up|priority|deliverable|submit|finish|complete|action|checklist)/.test(prompt);
    const wantsSchedule = /(calendar|meeting|schedule|slot|tomorrow|today|friday|monday|tuesday|wednesday|thursday|saturday|sunday|am|pm|event|time block|focus|rehearsal|presentation)/.test(prompt);
    const wantsNotes = /(note|remember|capture|knowledge|context|write down|doc|document|story|risk)/.test(prompt);
    const submissionMode = /(judge|submission|demo|present|presentation|hackathon|rehearsal)/.test(prompt);
    const actionMode = this.isCreateIntent(prompt);
    const knowledgeCaptureMode = this.isNoteCaptureIntent(prompt);

    const steps = [
      {
        agent: "planner",
        action: "snapshot",
        summary: "Pull the latest operational state before planning execution.",
      },
    ];

    if (wantsTasks || wantsBrief || submissionMode) {
      steps.push({
        agent: "task",
        action: actionMode ? "createOrReview" : "review",
        summary: "Translate the request into concrete deliverables and rank what matters most.",
      });
    }

    if (wantsSchedule || wantsBrief || submissionMode) {
      steps.push({
        agent: "schedule",
        action: actionMode ? "scheduleOrReview" : "review",
        summary: "Protect time on the calendar and expose timing risks before the deadline.",
      });
    }

    if (wantsNotes || wantsBrief || submissionMode) {
      steps.push({
        agent: "knowledge",
        action: knowledgeCaptureMode ? "captureOrReview" : "review",
        summary: "Recover the right context and store anything the team should not lose.",
      });
    }

    steps.push({
      agent: "planner",
      action: "synthesize",
      summary: "Convert raw agent outputs into an executive-ready brief.",
    });

    return {
      title: submissionMode ? "Submission-day execution plan" : "Operational coordination plan",
      route: submissionMode ? "High-stakes launch workflow" : wantsBrief ? "Daily coordination workflow" : "Targeted tool workflow",
      urgency: submissionMode ? "high" : actionMode ? "medium" : "normal",
      approvals: actionMode
        ? [
            "Create tasks in the task manager",
            "Reserve calendar time if needed",
            "Store new memory in the notes system",
          ]
        : [],
      objectives: [
        "Turn one user prompt into a multi-agent workflow",
        "Execute through task, calendar, and notes tools",
        "Persist the full run for API and database visibility",
      ],
      successCriteria: [
        "At least one sub-agent completes a concrete action",
        "Tool calls are logged with timestamps",
        "The final brief summarizes priorities, timing, and context",
      ],
      steps,
      request,
    };
  }

  isCreateIntent(prompt) {
    return /(create|add|block|schedule|save|capture|remember|set up|plan|prepare|reserve)/.test(prompt);
  }

  isNoteCaptureIntent(prompt) {
    return /(capture|remember|write down|save a note|save note|store note)/.test(prompt);
  }

  snapshot() {
    const dashboard = this.database.getDashboard();
    const criticalTasks = dashboard.tasks.filter((task) => task.priority === "high" && task.status !== "done").length;

    return {
      label: "Planner snapshot",
      summary: `Loaded ${dashboard.tasks.length} tasks, ${dashboard.events.length} calendar events, and ${dashboard.notes.length} notes. Found ${criticalTasks} critical task${criticalTasks === 1 ? "" : "s"} before delegation.`,
      dashboard,
    };
  }

  synthesize(plan, results, snapshot) {
    const highlights = results.flatMap((result) => result.highlights || []);
    const completedActions = results.map((result) => result.summary);
    const tasks = results.find((result) => result.agent === "task")?.payload || [];
    const schedule = results.find((result) => result.agent === "schedule")?.payload || {};
    const knowledge = results.find((result) => result.agent === "knowledge")?.payload || {};

    const nextMoves = [
      tasks[0]?.title ? `Start with "${tasks[0].title}"` : "Review the top open task in the queue",
      schedule.availability?.label || schedule.starts_at ? "Use the protected focus block on the calendar" : "Lock a rehearsal block before the deadline",
      knowledge.notes?.[0]?.title ? `Reference "${knowledge.notes[0].title}" during the demo` : "Keep the latest team context visible",
    ];

    return {
      label: "Planner synthesis",
      summary: completedActions.join(" "),
      executiveBrief: `Mission: ${plan.title}. Route: ${plan.route}. The system converted one request into ${results.length} delegated agent action${results.length === 1 ? "" : "s"}, logged MCP calls, and refreshed persistent state for the team.`,
      nextMoves,
      scorecard: [
        { label: "Coordinator active", value: "Yes" },
        { label: "Sub-agents engaged", value: String(results.length) },
        { label: "Approvals considered", value: plan.approvals.length > 0 ? "Auto-approved in demo mode" : "Not needed" },
        { label: "Database refreshed", value: "Yes" },
      ],
      highlights: [
        snapshot.summary,
        ...highlights,
      ],
    };
  }
}

module.exports = {
  PlannerAgent,
};
