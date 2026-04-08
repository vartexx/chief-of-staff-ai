class TaskTool {
  constructor(database) {
    this.database = database;
    this.actions = ["listOpen", "createTasks", "prioritize"];
    this.description = "Task manager connector backed by persistent SQLite storage.";
  }

  async listOpen({ limit = 6 }) {
    return this.database.listOpenTasks(limit);
  }

  async createTasks({ titles, dueAt, priority = "medium" }) {
    return titles.map((title) =>
      this.database.createTask({
        title,
        dueAt,
        priority,
      }),
    );
  }

  async prioritize({ limit = 5 }) {
    const tasks = this.database.listOpenTasks(limit);

    return tasks.map((task) => ({
      ...task,
      urgencyScore: this.scoreTask(task),
    }));
  }

  scoreTask(task) {
    const priorityScore = { high: 3, medium: 2, low: 1 }[task.priority] || 1;
    const dueBonus = task.due_at ? 2 : 0;
    return priorityScore + dueBonus;
  }
}

module.exports = {
  TaskTool,
};
