import type {
  ComplianceActivity,
  ComplianceCaseSla,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

import { ALL } from "./gv-common";

export const SLA_PAGE_SIZE = 10;

export interface SlaFilters {
  q: string;
  state: string;
  priority: string;
  status: string;
  page: number;
}

export const DEFAULT_SLA_FILTERS: SlaFilters = {
  q: "",
  state: ALL,
  priority: ALL,
  status: ALL,
  page: 0,
};

export const SLA_STATE_ORDER = [
  "BREACHED",
  "WITHIN_SLA",
  "CLOSED_BREACHED",
  "CLOSED_WITHIN_SLA",
] as const;

/** "CLOSED_WITHIN_SLA" -> "Closed Within SLA". */
export function slaLabel(value: string) {
  return humanize(value).replace(/\bSla\b/g, "SLA");
}

export function isBreached(state: string) {
  return state === "BREACHED" || state === "CLOSED_BREACHED";
}

export function isClosedState(state: string) {
  return state === "CLOSED_BREACHED" || state === "CLOSED_WITHIN_SLA";
}

/** Class suffix used by the existing SLA styles. */
export function slaClass(state: string) {
  if (isBreached(state)) {
    return "breached";
  }

  if (state === "CLOSED_WITHIN_SLA") {
    return "closed";
  }

  return "healthy";
}

export type SlaTone = "danger" | "ok" | "info";

export function slaTone(state: string): SlaTone {
  const kind = slaClass(state);

  return kind === "breached"
    ? "danger"
    : kind === "closed"
      ? "info"
      : "ok";
}

/** "+8h over target", "12h left", or "" for a closed case. */
export function slaRemaining(item: ComplianceCaseSla) {
  if (isClosedState(item.slaState)) {
    return "";
  }

  if (item.breachHours > 0) {
    return `${item.breachHours}h over target`;
  }

  return `${Math.max(0, item.targetHours - item.elapsedHours)}h left`;
}

function urgencyRank(state: string) {
  if (state === "BREACHED") {
    return 0;
  }

  if (state === "CLOSED_BREACHED") {
    return 2;
  }

  if (state === "CLOSED_WITHIN_SLA") {
    return 3;
  }

  return 1;
}

function usedRatio(item: ComplianceCaseSla) {
  return item.targetHours > 0
    ? item.elapsedHours / item.targetHours
    : 0;
}

/** Open breaches first, then open cases closest to their target. */
export function compareSlaUrgency(
  a: ComplianceCaseSla,
  b: ComplianceCaseSla
) {
  return (
    urgencyRank(a.slaState) - urgencyRank(b.slaState) ||
    b.breachHours - a.breachHours ||
    usedRatio(b) - usedRatio(a) ||
    a.caseNumber.localeCompare(b.caseNumber)
  );
}

export function filterSla(
  items: readonly ComplianceCaseSla[],
  filters: SlaFilters
): ComplianceCaseSla[] {
  return items
    .filter(
      (item) =>
        (filters.state === ALL || item.slaState === filters.state) &&
        (filters.priority === ALL ||
          item.priority === filters.priority) &&
        (filters.status === ALL ||
          item.caseStatus === filters.status) &&
        matchesQuery(filters.q, [
          item.caseNumber,
          item.priority,
          item.caseStatus,
          humanize(item.caseStatus),
          slaLabel(item.slaState),
        ])
    )
    .sort(compareSlaUrgency);
}

export const SLA_COLUMNS: readonly CsvColumn<ComplianceCaseSla>[] = [
  { header: "Case number", value: (item) => item.caseNumber },
  { header: "Priority", value: (item) => item.priority },
  { header: "Case status", value: (item) => item.caseStatus },
  { header: "SLA state", value: (item) => item.slaState },
  { header: "Target hours", value: (item) => item.targetHours },
  { header: "Elapsed hours", value: (item) => item.elapsedHours },
  { header: "Breach hours", value: (item) => item.breachHours },
  { header: "Calculated at (UTC)", value: (item) => item.calculatedAt },
];

export interface ActivityFilters {
  q: string;
  outcome: string;
  page: number;
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  q: "",
  outcome: ALL,
  page: 0,
};

export function filterActivity(
  items: readonly ComplianceActivity[],
  filters: ActivityFilters
): ComplianceActivity[] {
  return items.filter(
    (event) =>
      (filters.outcome === ALL || event.outcome === filters.outcome) &&
      matchesQuery(filters.q, [
        event.username,
        event.action,
        slaLabel(event.action),
        event.resourceType,
        event.resourceId,
        event.outcome,
      ])
  );
}

export const ACTIVITY_COLUMNS: readonly CsvColumn<ComplianceActivity>[] = [
  { header: "Time (UTC)", value: (event) => event.createdAt },
  { header: "User", value: (event) => event.username },
  { header: "Action", value: (event) => event.action },
  { header: "Outcome", value: (event) => event.outcome },
  { header: "Resource type", value: (event) => event.resourceType },
  { header: "Resource id", value: (event) => event.resourceId },
];

/** Colour for a distribution bar, by the value it counts. */
export function levelTone(
  key: string
): "danger" | "warning" | "ok" | "info" {
  const value = key.toUpperCase();

  if (value === "CRITICAL" || value === "HIGH") {
    return "danger";
  }

  if (value === "MEDIUM" || value === "PENDING") {
    return "warning";
  }

  if (value === "LOW") {
    return "ok";
  }

  return "info";
}
