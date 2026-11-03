import type { CaseWorkspaceEvent } from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { formatDateTime, humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

export type TimelineOrder = "newest" | "oldest";

export interface TimelineFilters {
  q: string;
  /** An event type, or "ALL". */
  type: string;
  order: TimelineOrder;
}

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  q: "",
  type: "ALL",
  order: "newest",
};

export interface TimelineGroup {
  /** "YYYY-MM-DD" in UTC, or "unknown" for an unreadable timestamp. */
  key: string;
  events: CaseWorkspaceEvent[];
}

const DAY_MS = 86_400_000;

function timeOf(value: string): number {
  const time = Date.parse(value);

  return Number.isNaN(time) ? 0 : time;
}

/**
 * Orders events by time without touching the input. Events with the
 * same timestamp keep the order the server sent them in (oldest
 * first) or the reverse of it (newest first).
 */
export function sortEvents(
  events: readonly CaseWorkspaceEvent[],
  order: TimelineOrder
): CaseWorkspaceEvent[] {
  const indexed = events.map((event, index) => ({
    event,
    index,
    time: timeOf(event.createdAt),
  }));

  indexed.sort((left, right) => {
    const byTime =
      order === "newest"
        ? right.time - left.time
        : left.time - right.time;

    if (byTime !== 0) {
      return byTime;
    }

    return order === "newest"
      ? right.index - left.index
      : left.index - right.index;
  });

  return indexed.map((item) => item.event);
}

/** Event types present in the data, in alphabetical order. */
export function eventTypesOf(
  events: readonly CaseWorkspaceEvent[]
): string[] {
  return Array.from(
    new Set(events.map((event) => event.eventType))
  ).sort();
}

export function eventMatchesQuery(
  event: CaseWorkspaceEvent,
  query: string
): boolean {
  return matchesQuery(query, [
    humanize(event.eventType),
    event.eventType,
    event.description,
    event.actorName,
    formatDateTime(event.createdAt),
  ]);
}

/** Events that match the search text and the chosen type. */
export function filterEvents(
  events: readonly CaseWorkspaceEvent[],
  filters: Pick<TimelineFilters, "q" | "type">
): CaseWorkspaceEvent[] {
  return events.filter(
    (event) =>
      (filters.type === "ALL" ||
        event.eventType === filters.type) &&
      eventMatchesQuery(event, filters.q)
  );
}

/** Per-type counts for the events that match the search text. */
export function countEventTypes(
  events: readonly CaseWorkspaceEvent[],
  query: string
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const event of events) {
    if (!eventMatchesQuery(event, query)) {
      continue;
    }

    counts[event.eventType] =
      (counts[event.eventType] ?? 0) + 1;
  }

  return counts;
}

/** "2026-10-07" (UTC day of the timestamp) or "unknown". */
export function dayKeyOf(value: string): string {
  const time = Date.parse(value);

  if (Number.isNaN(time)) {
    return "unknown";
  }

  return new Date(time).toISOString().slice(0, 10);
}

/** Groups neighbouring events that fall on the same UTC day. */
export function groupByDay(
  events: readonly CaseWorkspaceEvent[]
): TimelineGroup[] {
  const groups: TimelineGroup[] = [];

  for (const event of events) {
    const key = dayKeyOf(event.createdAt);

    const last = groups[groups.length - 1];

    if (last && last.key === key) {
      last.events.push(event);
    } else {
      groups.push({ key, events: [event] });
    }
  }

  return groups;
}

/** "Wed 07 Oct 2026" for a day key. */
export function formatDayHeading(key: string): string {
  if (key === "unknown") {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00Z`));
}

/**
 * "Today", "Yesterday", "3 days ago" for a day key, counted in UTC
 * days. Null when the day is unknown or in the future.
 */
export function relativeDayLabel(
  key: string,
  nowMs: number
): string | null {
  const dayStart = Date.parse(`${key}T00:00:00Z`);

  if (Number.isNaN(dayStart)) {
    return null;
  }

  const days =
    Math.floor(nowMs / DAY_MS) - Math.floor(dayStart / DAY_MS);

  if (days < 0) {
    return null;
  }

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "Yesterday";
  }

  return `${days} days ago`;
}

/** "09:41" in UTC, or the raw value when it cannot be read. */
export function formatClock(value: string): string {
  const time = Date.parse(value);

  if (Number.isNaN(time)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(time));
}

/** "07 Oct 2026, 09:41:12 UTC" for the tooltip next to a time. */
export function formatExactTime(value: string): string {
  const time = Date.parse(value);

  if (Number.isNaN(time)) {
    return value;
  }

  return `${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(time))} UTC`;
}

export function timelineCsvColumns(
  caseNumber: string
): CsvColumn<CaseWorkspaceEvent>[] {
  return [
    { header: "Case number", value: () => caseNumber },
    {
      header: "Timestamp (ISO 8601)",
      value: (event) => event.createdAt,
    },
    {
      header: "Event type",
      value: (event) => event.eventType,
    },
    {
      header: "Description",
      value: (event) => event.description,
    },
    { header: "Actor", value: (event) => event.actorName },
    { header: "Event id", value: (event) => event.id },
  ];
}
