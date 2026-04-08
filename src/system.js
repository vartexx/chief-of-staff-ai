const { OrchestratorAgent } = require("./agents/orchestratorAgent");
const { PlannerAgent } = require("./agents/plannerAgent");
const { TaskAgent } = require("./agents/taskAgent");
const { ScheduleAgent } = require("./agents/scheduleAgent");
const { KnowledgeAgent } = require("./agents/knowledgeAgent");
const { MCPGateway } = require("./tools/mcpGateway");
const { TaskTool } = require("./tools/taskTool");
const { CalendarTool } = require("./tools/calendarTool");
const { NotesTool } = require("./tools/notesTool");
const { GoogleCalendarService } = require("./googleCalendarService");

function createSystem(database) {
  const googleCalendarService = new GoogleCalendarService(database);
  const gateway = new MCPGateway(
    {
      taskManager: new TaskTool(database),
      calendar: new CalendarTool(database, googleCalendarService),
      notes: new NotesTool(database),
    },
    database,
  );

  const planner = new PlannerAgent(database);
  const taskAgent = new TaskAgent(gateway);
  const scheduleAgent = new ScheduleAgent(gateway);
  const knowledgeAgent = new KnowledgeAgent(gateway);

  const orchestrator = new OrchestratorAgent({
    database,
    gateway,
    planner,
    agents: {
      task: taskAgent,
      schedule: scheduleAgent,
      knowledge: knowledgeAgent,
    },
  });

  return {
    database,
    gateway,
    orchestrator,
    googleCalendarService,
  };
}

module.exports = {
  createSystem,
};
