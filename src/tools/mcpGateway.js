class MCPGateway {
  constructor(tools, database) {
    this.tools = tools;
    this.database = database;
  }

  getCatalog() {
    return Object.entries(this.tools).map(([name, tool]) => ({
      name,
      actions: tool.actions,
      description: tool.description,
    }));
  }

  async invoke(toolName, action, payload, meta = {}) {
    const tool = this.tools[toolName];

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    if (typeof tool[action] !== "function") {
      throw new Error(`Tool "${toolName}" does not support action "${action}"`);
    }

    const data = await tool[action](payload || {});
    const resultPreview = Array.isArray(data)
      ? `Returned ${data.length} record(s)`
      : data && typeof data === "object"
        ? Object.keys(data).slice(0, 4).join(", ")
        : String(data);

    if (this.database) {
      this.database.createToolCall({
        runId: meta.runId,
        agent: meta.agent || "system",
        toolName,
        action,
        payload,
        resultPreview,
      });
    }

    return {
      toolName,
      action,
      data,
      executedAt: new Date().toISOString(),
      agent: meta.agent || "system",
    };
  }
}

module.exports = {
  MCPGateway,
};
