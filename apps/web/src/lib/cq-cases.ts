import type { InvestigationCase } from "@/lib/api";
import { isCurrentUser } from "@/lib/cw-assignee";
import { matchesQuery } from "@/lib/list-utils";

export const CASE_STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "CLOSED",
] as const;

export const CASE_PRIORITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

export type CaseOwnerFilter = "ALL" | "MINE" | "UNASSIGNED";

export type CaseSort =
  | "DEFAULT"
  | "PRIORITY"
  | "RISK"
  | "UPDATED"
  | "NEWEST";

export interface CaseFilters {
  q: string;
  /** "ALL" or one of CASE_STATUSES. */
  status: string;
  /** "ALL" or one of CASE_PRIORITIES. */
  priority: string;
  owner: CaseOwnerFilter;
  sort: CaseSort;
}

export const DEFAULT_CASE_FILTERS: CaseFilters = {
  q: "",
  status: "ALL",
  priority: "ALL",
  owner: "ALL",
  sort: "DEFAULT",
};

const OWNERS: readonly string[] = ["ALL", "MINE", "UNASSIGNED"];

const SORTS: readonly string[] = [
  "DEFAULT",
  "PRIORITY",
  "RISK",
  "UPDATED",
  "NEWEST",
];

export function isDefaultCaseFilters(filters: CaseFilters) {
  return (
    filters.q === "" &&
    filters.status === "ALL" &&
    filters.priority === "ALL" &&
    filters.owner === "ALL" &&
    filters.sort === "DEFAULT"
  );
}

/** Saved views come from localStorage, so nothing in them is trusted. */
export function normalizeCaseFilters(raw: unknown): CaseFilters {
  const value =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const text = (field: unknown, fallback: string) =>
    typeof field === "string" ? field : fallback;

  const status = text(value.status, "ALL");
  const priority = text(value.priority, "ALL");
  const owner = text(value.owner, "ALL");
  const sort = text(value.sort, "DEFAULT");

  return {
    q: text(value.q, "").slice(0, 120),
    status:
      status === "ALL" ||
      (CASE_STATUSES as readonly string[]).includes(status)
        ? status
        : "ALL",
    priority:
      priority === "ALL" ||
      (CASE_PRIORITIES as readonly string[]).includes(priority)
        ? priority
        : "ALL",
    owner: OWNERS.includes(owner)
      ? (owner as CaseOwnerFilter)
      : "ALL",
    sort: SORTS.includes(sort)
      ? (sort as CaseSort)
      : "DEFAULT",
  };
}

function priorityRank(priority: string) {
  const index = (
    CASE_PRIORITIES as readonly string[]
  ).indexOf(priority);

  return index === -1 ? CASE_PRIORITIES.length : index;
}

function time(value: string) {
  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface CaseUser {
  displayName: string;
  username: string;
}

export function filterCases(
  cases: readonly InvestigationCase[],
  filters: CaseFilters,
  user: CaseUser
): InvestigationCase[] {
  const matching = cases.filter(
    (item) =>
      (filters.status === "ALL" ||
        item.status === filters.status) &&
      (filters.priority === "ALL" ||
        item.priority === filters.priority) &&
      (filters.owner === "ALL" ||
        (filters.owner === "UNASSIGNED"
          ? !item.assignedTo
          : isCurrentUser(
              item.assignedTo,
              user.displayName,
              user.username
            ))) &&
      matchesQuery(filters.q, [
        item.title,
        item.caseNumber,
        item.primaryAlertCode,
        item.assignedTo,
        item.summary,
      ])
  );

  switch (filters.sort) {
    case "PRIORITY":
      return [...matching].sort(
        (a, b) =>
          priorityRank(a.priority) - priorityRank(b.priority) ||
          b.alertRiskScore - a.alertRiskScore
      );

    case "RISK":
      return [...matching].sort(
        (a, b) => b.alertRiskScore - a.alertRiskScore
      );

    case "UPDATED":
      return [...matching].sort(
        (a, b) => time(b.updatedAt) - time(a.updatedAt)
      );

    case "NEWEST":
      return [...matching].sort(
        (a, b) => time(b.createdAt) - time(a.createdAt)
      );

    default:
      return matching;
  }
}

export function countCases(
  cases: readonly InvestigationCase[],
  field: "status" | "priority"
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of cases) {
    counts[item[field]] = (counts[item[field]] ?? 0) + 1;
  }

  return counts;
}
