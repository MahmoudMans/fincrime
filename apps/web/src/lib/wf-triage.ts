import type { InvestigationTriageQueueItem } from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { countBy, matchesQuery } from "@/lib/list-utils";

export const TRIAGE_BANDS = [
  "URGENT",
  "HIGH",
  "MEDIUM",
  "ROUTINE",
] as const;

export type TriageOwnerFilter =
  | "ALL"
  | "MINE"
  | "UNASSIGNED"
  | "OTHERS";

export type TriageSort = "score" | "oldest" | "sla" | "case";

export interface TriageFilters {
  q: string;
  /** "ALL" or a triage band. */
  band: string;
  owner: TriageOwnerFilter;
  /** "ALL" or a case status. */
  status: string;
  /** "ALL" or a case priority. */
  priority: string;
  sort: TriageSort;
}

export const DEFAULT_TRIAGE_FILTERS: TriageFilters = {
  q: "",
  band: "ALL",
  owner: "ALL",
  status: "ALL",
  priority: "ALL",
  sort: "score",
};

export const TRIAGE_SORTS: ReadonlyArray<{
  value: TriageSort;
  label: string;
}> = [
  { value: "score", label: "Highest score first" },
  { value: "oldest", label: "Oldest case first" },
  { value: "sla", label: "Highest SLA pressure first" },
  { value: "case", label: "Case number" },
];

const OWNER_VALUES: readonly string[] = [
  "ALL",
  "MINE",
  "UNASSIGNED",
  "OTHERS",
];

const SORT_VALUES: readonly string[] = TRIAGE_SORTS.map(
  (option) => option.value
);

function text(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

/** Saved views come from storage, so their shape is not trusted. */
export function normalizeTriageFilters(
  value: unknown
): TriageFilters {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_TRIAGE_FILTERS;
  }

  const raw = value as Record<string, unknown>;

  const owner = text(raw.owner, "ALL");

  const sort = text(raw.sort, "score");

  return {
    q: text(raw.q, ""),
    band: text(raw.band, "ALL"),
    owner: OWNER_VALUES.includes(owner)
      ? (owner as TriageOwnerFilter)
      : "ALL",
    status: text(raw.status, "ALL"),
    priority: text(raw.priority, "ALL"),
    sort: SORT_VALUES.includes(sort)
      ? (sort as TriageSort)
      : "score",
  };
}

export function isDefaultTriageFilters(filters: TriageFilters) {
  return (
    filters.q.trim() === "" &&
    filters.band === "ALL" &&
    filters.owner === "ALL" &&
    filters.status === "ALL" &&
    filters.priority === "ALL" &&
    filters.sort === "score"
  );
}

/** True when the queue item is owned by the signed-in person. */
export function isOwnedBy(
  item: Pick<InvestigationTriageQueueItem, "ownerUsername">,
  username: string
) {
  return (
    item.ownerUsername !== null &&
    username !== "" &&
    item.ownerUsername.toLowerCase() === username.toLowerCase()
  );
}

export function filterTriage(
  items: readonly InvestigationTriageQueueItem[],
  filters: TriageFilters,
  username: string
): InvestigationTriageQueueItem[] {
  return items.filter((item) => {
    if (filters.band !== "ALL" && item.triageBand !== filters.band) {
      return false;
    }

    if (
      filters.status !== "ALL" &&
      item.caseStatus !== filters.status
    ) {
      return false;
    }

    if (
      filters.priority !== "ALL" &&
      item.casePriority !== filters.priority
    ) {
      return false;
    }

    if (filters.owner === "MINE" && !isOwnedBy(item, username)) {
      return false;
    }

    if (filters.owner === "UNASSIGNED" && item.ownerUsername) {
      return false;
    }

    if (
      filters.owner === "OTHERS" &&
      (!item.ownerUsername || isOwnedBy(item, username))
    ) {
      return false;
    }

    return matchesQuery(filters.q, [
      item.caseNumber,
      item.casePriority,
      item.caseStatus,
      item.triageBand,
      item.explanation,
      item.ownerUsername,
      item.assignedBy,
    ]);
  });
}

/**
 * Counts for one filter group, given every other active filter, so a
 * chip says how many rows it would show if it were picked.
 */
export function triageFacetCounts(
  items: readonly InvestigationTriageQueueItem[],
  filters: TriageFilters,
  username: string,
  facet: "band" | "owner" | "status" | "priority"
): Record<string, number> {
  const rows = filterTriage(
    items,
    { ...filters, [facet]: "ALL" },
    username
  );

  const counts: Record<string, number> =
    facet === "owner"
      ? {
          MINE: rows.filter((item) => isOwnedBy(item, username))
            .length,
          UNASSIGNED: rows.filter((item) => !item.ownerUsername)
            .length,
          OTHERS: rows.filter(
            (item) =>
              Boolean(item.ownerUsername) &&
              !isOwnedBy(item, username)
          ).length,
        }
      : countBy(rows, (item) => {
          switch (facet) {
            case "band":
              return item.triageBand;
            case "status":
              return item.caseStatus;
            default:
              return item.casePriority;
          }
        });

  counts.ALL = rows.length;

  return counts;
}

function opened(
  item: InvestigationTriageQueueItem,
  openedAt: ReadonlyMap<string, string>
) {
  const value = openedAt.get(item.caseId);

  const stamp = value ? new Date(value).getTime() : Number.NaN;

  return Number.isNaN(stamp) ? null : stamp;
}

/**
 * Returns a new sorted array. "oldest" needs the case creation time
 * (from the cases list); cases without one go last.
 */
export function sortTriage(
  items: readonly InvestigationTriageQueueItem[],
  sort: TriageSort,
  openedAt: ReadonlyMap<string, string>
): InvestigationTriageQueueItem[] {
  const byScore = (
    a: InvestigationTriageQueueItem,
    b: InvestigationTriageQueueItem
  ) =>
    b.triageScore - a.triageScore ||
    a.caseNumber.localeCompare(b.caseNumber);

  return [...items].sort((a, b) => {
    switch (sort) {
      case "oldest": {
        const left = opened(a, openedAt);
        const right = opened(b, openedAt);

        if (left === null && right === null) {
          return byScore(a, b);
        }

        if (left === null) {
          return 1;
        }

        if (right === null) {
          return -1;
        }

        return left - right || byScore(a, b);
      }

      case "sla":
        return b.slaPoints - a.slaPoints || byScore(a, b);

      case "case":
        return a.caseNumber.localeCompare(b.caseNumber);

      default:
        return byScore(a, b);
    }
  });
}

export function triageCsvColumns(
  openedAt: ReadonlyMap<string, string>
): CsvColumn<InvestigationTriageQueueItem>[] {
  return [
    { header: "Case number", value: (item) => item.caseNumber },
    { header: "Case priority", value: (item) => item.casePriority },
    { header: "Case status", value: (item) => item.caseStatus },
    { header: "Triage band", value: (item) => item.triageBand },
    { header: "Triage score", value: (item) => item.triageScore },
    {
      header: "Priority points",
      value: (item) => item.priorityPoints,
    },
    { header: "SLA points", value: (item) => item.slaPoints },
    { header: "Age points", value: (item) => item.agePoints },
    { header: "Status points", value: (item) => item.statusPoints },
    { header: "Explanation", value: (item) => item.explanation },
    {
      header: "Case opened (UTC)",
      value: (item) => openedAt.get(item.caseId) ?? "",
    },
    {
      header: "Calculated at (UTC)",
      value: (item) => item.calculatedAt,
    },
    { header: "Owner", value: (item) => item.ownerUsername },
    { header: "Assigned by", value: (item) => item.assignedBy },
    {
      header: "Assigned at (UTC)",
      value: (item) => item.assignedAt,
    },
    {
      header: "Assignment note",
      value: (item) => item.assignmentNote,
    },
  ];
}

/**
 * How old a row is: the case opening time when the cases list is
 * known, otherwise the time the snapshot was scored.
 */
export function triageAge(
  item: Pick<InvestigationTriageQueueItem, "caseId" | "calculatedAt">,
  openedAt: ReadonlyMap<string, string>
): { label: string; title: string } {
  const opened = openedAt.get(item.caseId);

  return opened
    ? {
        label: `Opened ${formatRelativeTime(opened)}`,
        title: `Case opened ${formatDateTime(opened)} UTC`,
      }
    : {
        label: `Scored ${formatRelativeTime(item.calculatedAt)}`,
        title: `Scored ${formatDateTime(item.calculatedAt)} UTC`,
      };
}
