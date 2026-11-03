import type {
  SecurityAuditEvent,
  SecurityAuditLedgerStatus,
  SecurityAuditLedgerVerification,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import {
  ALL,
  asRecord,
  isoOrRaw,
  pickDate,
  pickFreeChoice,
  pickText,
  uniqueSorted,
} from "@/lib/ev-common";
import { humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

/** The security audit endpoint returns at most this many events. */
export const AUDIT_EVENT_LIMIT = 100;

export interface AuditFilters {
  q: string;
  actor: string;
  action: string;
  outcome: string;
  /** First day, YYYY-MM-DD (UTC), or "". */
  from: string;
  /** Last day, YYYY-MM-DD (UTC), or "". */
  to: string;
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  q: "",
  actor: ALL,
  action: ALL,
  outcome: ALL,
  from: "",
  to: "",
};

export type AuditFacet = "actor" | "action" | "outcome";

export function auditFiltersActive(filters: AuditFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.actor !== ALL ||
    filters.action !== ALL ||
    filters.outcome !== ALL ||
    filters.from !== "" ||
    filters.to !== ""
  );
}

export function sanitizeAuditFilters(value: unknown): AuditFilters {
  const raw = asRecord(value);

  return {
    q: pickText(raw.q),
    actor: pickFreeChoice(raw.actor),
    action: pickFreeChoice(raw.action),
    outcome: pickFreeChoice(raw.outcome),
    from: pickDate(raw.from),
    to: pickDate(raw.to),
  };
}

/** Both ends of the range in UTC milliseconds; null = open end. */
export function dateRange(filters: AuditFilters): {
  start: number | null;
  end: number | null;
} {
  const start =
    filters.from === ""
      ? null
      : Date.parse(`${filters.from}T00:00:00.000Z`);

  const end =
    filters.to === ""
      ? null
      : Date.parse(`${filters.to}T23:59:59.999Z`);

  return {
    start: start !== null && Number.isNaN(start) ? null : start,
    end: end !== null && Number.isNaN(end) ? null : end,
  };
}

/** Text for a range that cannot match anything, or null. */
export function dateRangeProblem(
  filters: AuditFilters
): string | null {
  const { start, end } = dateRange(filters);

  return start !== null && end !== null && start > end
    ? "The end date is before the start date, so no event can match."
    : null;
}

export function auditMatches(
  event: SecurityAuditEvent,
  filters: AuditFilters,
  skip?: AuditFacet
): boolean {
  if (
    skip !== "actor" &&
    filters.actor !== ALL &&
    event.username !== filters.actor
  ) {
    return false;
  }

  if (
    skip !== "action" &&
    filters.action !== ALL &&
    event.action !== filters.action
  ) {
    return false;
  }

  if (
    skip !== "outcome" &&
    filters.outcome !== ALL &&
    event.outcome !== filters.outcome
  ) {
    return false;
  }

  const { start, end } = dateRange(filters);

  if (start !== null || end !== null) {
    const time = Date.parse(event.occurredAt);

    // An event without a readable time cannot be placed in a range.
    if (Number.isNaN(time)) {
      return false;
    }

    if (start !== null && time < start) {
      return false;
    }

    if (end !== null && time > end) {
      return false;
    }
  }

  return matchesQuery(filters.q, [
    event.username,
    event.action,
    humanize(event.action),
    event.resourceType,
    humanize(event.resourceType),
    event.resourceId,
    event.outcome,
    event.detail,
  ]);
}

export function filterAudit(
  events: readonly SecurityAuditEvent[],
  filters: AuditFilters
): SecurityAuditEvent[] {
  return events.filter((event) => auditMatches(event, filters));
}

function facetValue(
  event: SecurityAuditEvent,
  facet: AuditFacet
): string {
  return facet === "actor"
    ? event.username
    : facet === "action"
      ? event.action
      : event.outcome;
}

export function auditFacetCounts(
  events: readonly SecurityAuditEvent[],
  filters: AuditFilters,
  facet: AuditFacet
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const event of events) {
    if (auditMatches(event, filters, facet)) {
      const value = facetValue(event, facet);

      counts[value] = (counts[value] ?? 0) + 1;
    }
  }

  return counts;
}

export function auditFacetValues(
  events: readonly SecurityAuditEvent[],
  facet: AuditFacet
): string[] {
  return uniqueSorted(events.map((event) => facetValue(event, facet)));
}

/** Newest first, whatever order the API used. */
export function newestFirst(
  events: readonly SecurityAuditEvent[]
): SecurityAuditEvent[] {
  return [...events].sort(
    (left, right) =>
      Date.parse(right.occurredAt) - Date.parse(left.occurredAt) ||
      left.id.localeCompare(right.id)
  );
}

export const AUDIT_COLUMNS: CsvColumn<SecurityAuditEvent>[] = [
  {
    header: "Occurred at (UTC)",
    value: (event) => isoOrRaw(event.occurredAt),
  },
  { header: "Actor", value: (event) => event.username },
  { header: "Action", value: (event) => event.action },
  { header: "Resource type", value: (event) => event.resourceType },
  { header: "Resource id", value: (event) => event.resourceId },
  { header: "Outcome", value: (event) => event.outcome },
  { header: "Detail", value: (event) => event.detail },
  { header: "Event id", value: (event) => event.id },
];

/** One ledger verification run. */
export type HistoryFilter = "ALL" | "VERIFIED" | "ATTENTION";

export function historyMatches(
  entry: SecurityAuditLedgerVerification,
  filter: HistoryFilter
): boolean {
  return (
    filter === "ALL" ||
    (filter === "VERIFIED") === entry.integrityValid
  );
}

export function historyNewestFirst(
  history: readonly SecurityAuditLedgerVerification[]
): SecurityAuditLedgerVerification[] {
  return [...history].sort(
    (left, right) =>
      Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt) ||
      left.id.localeCompare(right.id)
  );
}

export const HISTORY_COLUMNS: CsvColumn<SecurityAuditLedgerVerification>[] =
  [
    {
      header: "Verified at (UTC)",
      value: (entry) => isoOrRaw(entry.verifiedAt),
    },
    {
      header: "Integrity",
      value: (entry) =>
        entry.integrityValid ? "Verified" : "Attention",
    },
    {
      header: "Hash chain valid",
      value: (entry) => (entry.chainValid ? "Yes" : "No"),
    },
    {
      header: "Coverage complete",
      value: (entry) => (entry.complete ? "Yes" : "No"),
    },
    {
      header: "Source events",
      value: (entry) => entry.sourceEventCount,
    },
    {
      header: "Ledger entries",
      value: (entry) => entry.ledgerEntryCount,
    },
    {
      header: "Uncovered events",
      value: (entry) => entry.uncoveredEventCount,
    },
    { header: "Appended", value: (entry) => entry.appendedCount },
    { header: "Root hash", value: (entry) => entry.rootHash },
    { header: "Detail", value: (entry) => entry.detail },
    { header: "Run id", value: (entry) => entry.id },
  ];

export type LedgerState =
  | "UNKNOWN"
  | "VERIFIED"
  | "REFRESH_REQUIRED"
  | "FAILURE";

export function ledgerState(
  status: SecurityAuditLedgerStatus | null
): LedgerState {
  if (!status) {
    return "UNKNOWN";
  }

  if (status.integrityValid) {
    return "VERIFIED";
  }

  if (status.chainValid && !status.complete) {
    return "REFRESH_REQUIRED";
  }

  return "FAILURE";
}

export function ledgerStateLabel(state: LedgerState): string {
  return state === "VERIFIED"
    ? "Verified"
    : state === "REFRESH_REQUIRED"
      ? "Refresh required"
      : state === "FAILURE"
        ? "Integrity failure"
        : "Unknown";
}

/** What the state means and what to do, in one sentence. */
export function ledgerStateExplanation(
  status: SecurityAuditLedgerStatus | null
): string {
  const state = ledgerState(status);

  if (!status || state === "UNKNOWN") {
    return "The ledger status has not been loaded.";
  }

  if (state === "VERIFIED") {
    return "The hash chain is intact and every security event is covered by the ledger.";
  }

  if (state === "REFRESH_REQUIRED") {
    return `${status.uncoveredEventCount} security ${
      status.uncoveredEventCount === 1 ? "event is" : "events are"
    } not in the ledger yet. Use Refresh & verify to cover ${
      status.uncoveredEventCount === 1 ? "it" : "them"
    }.`;
  }

  return "The hash chain does not match the recorded security events. Treat this as a possible tampering alert and investigate before relying on the audit trail.";
}
