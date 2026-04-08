const { formatDateLabel, getNextSlot } = require("../utils/time");

class CalendarTool {
  constructor(database, googleCalendarService) {
    this.database = database;
    this.googleCalendarService = googleCalendarService;
    this.actions = ["listUpcoming", "createFocusBlock", "findAvailability"];
    this.description = "Calendar connector for meetings, focus blocks, and availability.";
  }

  async listUpcoming({ limit = 5 }) {
    const googleEvents = await this.listUpcomingFromGoogle(limit);
    return googleEvents || this.database.listUpcomingEvents(limit);
  }

  async createFocusBlock({ title, startsAt, endsAt, location }) {
    const googleCalendar = await this.googleCalendarService?.getAuthorizedCalendar();

    if (googleCalendar) {
      await googleCalendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: title,
          location: location || undefined,
          start: {
            dateTime: startsAt,
          },
          end: {
            dateTime: endsAt,
          },
        },
      });
    }

    return this.database.createEvent({
      title,
      startsAt,
      endsAt,
      location,
    });
  }

  async findAvailability() {
    const events = (await this.listUpcomingFromGoogle(12)) || this.database.listUpcomingEvents(12);
    const slot = getNextSlot(events);

    return {
      label: `Suggested focus slot: ${formatDateLabel(slot.startsAt)} to ${formatDateLabel(slot.endsAt)}`,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      duration: "60 minutes",
    };
  }

  async listUpcomingFromGoogle(limit) {
    let googleCalendar;

    try {
      googleCalendar = await this.googleCalendarService?.getAuthorizedCalendar();
    } catch (_error) {
      return null;
    }

    if (!googleCalendar) {
      return null;
    }

    try {
      const response = await googleCalendar.events.list({
        calendarId: "primary",
        maxResults: limit,
        singleEvents: true,
        orderBy: "startTime",
        timeMin: new Date().toISOString(),
      });

      return (response.data.items || []).map((event) => ({
        id: event.id,
        title: event.summary || "Untitled event",
        starts_at: event.start?.dateTime || event.start?.date || new Date().toISOString(),
        ends_at: event.end?.dateTime || event.end?.date || new Date().toISOString(),
        location: event.location || "Google Calendar",
        created_at: event.created || new Date().toISOString(),
      }));
    } catch (_error) {
      return null;
    }
  }
}

module.exports = {
  CalendarTool,
};
