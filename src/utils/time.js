function titleCase(value) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function cleanFragment(value) {
  return titleCase(
    value
      .replace(/[.]+$/g, "")
      .replace(/\b(a|an|the)\b/gi, " ")
      .replace(/\b(tasks|task)\b/gi, " ")
      .replace(/\s+/g, " "),
  );
}

function addHours(dateValue, hours) {
  const date = new Date(dateValue);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function extractTaskTitles(request) {
  const lower = request.toLowerCase();

  if (!/(task|todo|follow-up|follow up|submit|finish|complete|prepare|review|create|add)/.test(lower)) {
    return [];
  }

  if (lower.includes("missing prep tasks")) {
    return ["Finalize Demo Script", "Rehearse Judge Walkthrough", "Prepare Submission Checklist"];
  }

  const matches = [
    ...request.matchAll(
      /(?:create|add|prepare|submit|review|finish|complete|follow up on|follow-up on)\s+([^,.]+?)(?=(?:\s+and\s+|\s*,|$))/gi,
    ),
  ];

  if (matches.length > 0) {
    return matches
      .map((match) => cleanFragment(match[1]))
      .map((title) => title.replace(/\bMissing\b/gi, "").trim())
      .filter(Boolean);
  }

  return [cleanFragment(request.slice(0, 80))];
}

function extractPriority(request) {
  const lower = request.toLowerCase();

  if (lower.includes("urgent") || lower.includes("high priority")) {
    return "high";
  }

  if (lower.includes("low priority")) {
    return "low";
  }

  return "medium";
}

function weekdayIndex(weekday) {
  const values = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  return values[weekday];
}

function nextWeekday(targetIndex) {
  const now = new Date();
  const date = new Date(now);
  const offset = (targetIndex + 7 - now.getDay()) % 7 || 7;
  date.setDate(now.getDate() + offset);
  date.setHours(10, 0, 0, 0);
  return date;
}

function extractDueDate(request) {
  const lower = request.toLowerCase();
  const now = new Date();

  if (lower.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString();
  }

  const weekdayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);

  if (weekdayMatch) {
    return nextWeekday(weekdayIndex(weekdayMatch[1])).toISOString();
  }

  return null;
}

function extractTime(request) {
  const match = request.toLowerCase().match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);

  if (!match) {
    return { hours: 11, minutes: 0 };
  }

  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2] || 0);

  if (match[3] === "pm") {
    hours += 12;
  }

  return { hours, minutes };
}

function extractDurationHours(request) {
  const match = request.toLowerCase().match(/\b(\d+)\s*(hour|hours|hr|hrs)\b/);

  if (!match) {
    return 1;
  }

  return Math.max(Number(match[1]), 1);
}

function buildEventWindow(request) {
  const lower = request.toLowerCase();

  if (!/(schedule|block|calendar|meeting|slot|focus)/.test(lower)) {
    return null;
  }

  const titleMatch = request.match(/(?:schedule|block)\s+([^,.]+?)(?=(?:\s+tomorrow|\s+today|\s+on\s+\w+|\s+at\s+\d|$))/i);
  const rawTitle = cleanFragment((titleMatch?.[1] || "Focus Block").replace(/\b(calendar|event|meeting)\b/gi, ""));
  const title = lower.includes("rehearsal")
    ? "Rehearsal Block"
    : rawTitle.length < 5 || /^(time|slot)$/i.test(rawTitle)
      ? "Focus Block"
      : rawTitle;
  const { hours, minutes } = extractTime(request);
  const durationHours = extractDurationHours(request);
  const extractedDueDate = extractDueDate(request);
  const start = extractedDueDate ? new Date(extractedDueDate) : new Date();

  if (lower.includes("today")) {
    start.setHours(hours, minutes, 0, 0);
  } else if (lower.includes("tomorrow") || /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)) {
    start.setHours(hours, minutes, 0, 0);
  } else {
    start.setHours(Math.max(start.getHours() + 1, hours), minutes, 0, 0);
  }

  const end = new Date(start);
  end.setHours(start.getHours() + durationHours);

  return {
    title,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    location: "Auto-scheduled by agent",
  };
}

function extractNotePayload(request) {
  const lower = request.toLowerCase();

  if (!/(note|capture|remember|write down|story|context|risk)/.test(lower)) {
    return null;
  }

  const noteMatch = request.match(/(?:note|capture|remember|write down)\s+(.*)/i);
  const content = (noteMatch?.[1] || request).trim();
  const cleanedTitle = cleanFragment(content.replace(/^(for|about)\s+/i, ""));

  return {
    title: cleanedTitle || (lower.includes("judge") ? "Judging Note" : "Knowledge Note"),
    content,
    tag: lower.includes("risk") ? "risk" : "general",
  };
}

function formatDateLabel(dateValue) {
  return new Date(dateValue).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getNextSlot(events) {
  const sorted = [...events].sort((left, right) => new Date(left.ends_at) - new Date(right.ends_at));
  const base = sorted.at(-1)?.ends_at || new Date().toISOString();
  const start = new Date(base);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);

  return {
    startsAt: start.toISOString(),
    endsAt: addHours(start.toISOString(), 1),
  };
}

module.exports = {
  addHours,
  buildEventWindow,
  extractDurationHours,
  extractDueDate,
  extractNotePayload,
  extractPriority,
  extractTaskTitles,
  formatDateLabel,
  getNextSlot,
};
