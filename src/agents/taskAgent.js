const { extractTaskTitles, extractPriority, extractDueDate } = require("../utils/time");

class TaskAgent {
  constructor(gateway) {
    this.gateway = gateway;
  }

  async execute(step, request, context) {
    if (step.action === "review") {
      return this.review(context);
    }

    return this.createOrReview(request, context);
  }

  async review(context) {
    const prioritized = await this.gateway.invoke("taskManager", "prioritize", { limit: 5 }, context);

    return {
      agent: "task",
      label: "Task agent",
      summary: `Task agent ranked ${prioritized.data.length} active items and surfaced the highest-leverage work.`,
      highlights: prioritized.data.map((task) => `${task.priority.toUpperCase()}: ${task.title}`),
      payload: prioritized.data,
    };
  }

  async createOrReview(request, context) {
    const taskTitles = extractTaskTitles(request);
    const dueAt = extractDueDate(request);
    const priority = extractPriority(request);

    if (taskTitles.length > 0) {
      const created = await this.gateway.invoke(
        "taskManager",
        "createTasks",
        {
          titles: taskTitles,
          dueAt,
          priority,
        },
        context,
      );

      return {
        agent: "task",
        label: "Task agent",
        summary: `Task agent created ${created.data.length} new task${created.data.length === 1 ? "" : "s"} and synced them to persistent storage.`,
        highlights: created.data.map((task) => `${task.title}${task.due_at ? ` due ${task.due_at}` : ""}`),
        payload: created.data,
      };
    }

    return this.review(context);
  }
}

module.exports = {
  TaskAgent,
};
