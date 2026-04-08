const { buildEventWindow, formatDateLabel } = require("../utils/time");

class ScheduleAgent {
  constructor(gateway) {
    this.gateway = gateway;
  }

  async execute(step, request, context) {
    if (step.action === "review") {
      return this.review(context);
    }

    return this.scheduleOrReview(request, context);
  }

  async review(context) {
    const availability = await this.gateway.invoke("calendar", "findAvailability", {}, context);
    const events = await this.gateway.invoke("calendar", "listUpcoming", { limit: 4 }, context);

    return {
      agent: "schedule",
      label: "Schedule agent",
      summary: `Schedule agent reviewed ${events.data.length} upcoming events and proposed the next protected execution window.`,
      highlights: [
        ...events.data.slice(0, 2).map((event) => `${event.title} at ${formatDateLabel(event.starts_at)}`),
        availability.data?.label || "Availability ready",
      ],
      payload: {
        events: events.data,
        availability: availability.data,
      },
    };
  }

  async scheduleOrReview(request, context) {
    const eventWindow = buildEventWindow(request);

    if (eventWindow) {
      const created = await this.gateway.invoke("calendar", "createFocusBlock", eventWindow, context);

      return {
        agent: "schedule",
        label: "Schedule agent",
        summary: `Schedule agent reserved a calendar block for ${formatDateLabel(created.data.starts_at)} to protect execution time.`,
        highlights: [`${created.data.title} at ${formatDateLabel(created.data.starts_at)}`],
        payload: created.data,
      };
    }

    return this.review(context);
  }
}

module.exports = {
  ScheduleAgent,
};
