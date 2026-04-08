class OrchestratorAgent {
  constructor({ database, gateway, planner, agents }) {
    this.database = database;
    this.gateway = gateway;
    this.planner = planner;
    this.agents = agents;
  }

  describe() {
    return {
      coordinator: "Chief of Staff Orchestrator",
      coordinatorRole: "Plans the mission, delegates work, merges outputs, and returns an executive brief.",
      subAgents: [
        "Task Agent",
        "Schedule Agent",
        "Knowledge Agent",
      ],
      storage: "Persistent SQLite state for tasks, notes, runs, and tool-call audit logs",
      gateway: "MCP-style tool registry for task manager, calendar, and notes connectors",
    };
  }

  async handle(request) {
    const plan = this.planner.plan(request);
    const transcript = [];
    const runId = this.database.createWorkflowRun({
      request,
      route: plan.route,
      status: "running",
    });

    try {
      const snapshot = this.planner.snapshot();
      transcript.push({
        step: "Planner snapshot",
        detail: snapshot.summary,
        kind: "planner",
      });

      const results = [];

      for (const step of plan.steps) {
        if (step.agent === "planner") {
          continue;
        }

        const agent = this.agents[step.agent];
        const context = {
          runId,
          agent: `${step.agent}-agent`,
        };
        const result = await agent.execute(step, request, context);

        results.push(result);
        transcript.push({
          step: result.label,
          detail: result.summary,
          highlights: result.highlights || [],
          kind: "agent",
          agent: result.agent,
        });
      }

      const synthesis = this.planner.synthesize(plan, results, snapshot);
      transcript.push({
        step: synthesis.label,
        detail: synthesis.summary,
        highlights: synthesis.highlights,
        kind: "planner",
      });

      this.database.completeWorkflowRun(runId, synthesis.summary, transcript);
      const toolCalls = this.database.listToolCallsForRun(runId);

      return {
        runId,
        request,
        mission: {
          title: plan.title,
          route: plan.route,
          urgency: plan.urgency,
        },
        approvals: plan.approvals.map((item) => ({
          label: item,
          status: "auto-approved in demo mode",
        })),
        objectives: plan.objectives,
        successCriteria: plan.successCriteria,
        plan: plan.steps,
        transcript,
        summary: synthesis.summary,
        executiveBrief: synthesis.executiveBrief,
        nextMoves: synthesis.nextMoves,
        scorecard: synthesis.scorecard,
        toolCalls,
        dashboard: this.database.getDashboard(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.database.failWorkflowRun(runId, message, transcript);
      throw error;
    }
  }
}

module.exports = {
  OrchestratorAgent,
};
