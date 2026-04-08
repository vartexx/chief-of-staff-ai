const { extractNotePayload } = require("../utils/time");

class KnowledgeAgent {
  constructor(gateway) {
    this.gateway = gateway;
  }

  async execute(step, request, context) {
    if (step.action === "review") {
      return this.review(context);
    }

    return this.captureOrReview(request, context);
  }

  async review(context) {
    const recent = await this.gateway.invoke("notes", "summarizeMemory", {}, context);

    return {
      agent: "knowledge",
      label: "Knowledge agent",
      summary: "Knowledge agent recovered the latest memory so the final response includes the right team context.",
      highlights: recent.data.highlights,
      payload: recent.data,
    };
  }

  async captureOrReview(request, context) {
    const note = extractNotePayload(request);

    if (note) {
      const saved = await this.gateway.invoke("notes", "createNote", note, context);

      return {
        agent: "knowledge",
        label: "Knowledge agent",
        summary: `Knowledge agent stored a reusable note titled "${saved.data.title}" in the shared knowledge base.`,
        highlights: [saved.data.title],
        payload: {
          note: saved.data,
          notes: [saved.data],
        },
      };
    }

    return this.review(context);
  }
}

module.exports = {
  KnowledgeAgent,
};
