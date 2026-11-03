import type { InvestigationFinding } from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { countBy, matchesQuery } from "@/lib/list-utils";

export const FINDING_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type FindingLineage = "ALL" | "CURRENT" | "HISTORICAL";

export type FindingSort = "newest" | "oldest" | "reference";

export interface FindingFilters {
  q: string;
  /** "ALL" or a finding status. */
  status: string;
  /** "ALL" or a case priority. */
  priority: string;
  lineage: FindingLineage;
  sort: FindingSort;
}

export const DEFAULT_FINDING_FILTERS: FindingFilters = {
  q: "",
  status: "ALL",
  priority: "ALL",
  lineage: "ALL",
  sort: "newest",
};

export const FINDING_SORTS: ReadonlyArray<{
  value: FindingSort;
  label: string;
}> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "reference", label: "Reference A to Z" },
];

const LINEAGE_VALUES: readonly string[] = [
  "ALL",
  "CURRENT",
  "HISTORICAL",
];

const SORT_VALUES: readonly string[] = FINDING_SORTS.map(
  (option) => option.value
);

function text(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

export function normalizeFindingFilters(
  value: unknown
): FindingFilters {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_FINDING_FILTERS;
  }

  const raw = value as Record<string, unknown>;

  const lineage = text(raw.lineage, "ALL");

  const sort = text(raw.sort, "newest");

  return {
    q: text(raw.q, ""),
    status: text(raw.status, "ALL"),
    priority: text(raw.priority, "ALL"),
    lineage: LINEAGE_VALUES.includes(lineage)
      ? (lineage as FindingLineage)
      : "ALL",
    sort: SORT_VALUES.includes(sort)
      ? (sort as FindingSort)
      : "newest",
  };
}

export function isDefaultFindingFilters(filters: FindingFilters) {
  return (
    filters.q.trim() === "" &&
    filters.status === "ALL" &&
    filters.priority === "ALL" &&
    filters.lineage === "ALL" &&
    filters.sort === "newest"
  );
}

export function filterFindings(
  items: readonly InvestigationFinding[],
  filters: FindingFilters
): InvestigationFinding[] {
  return items.filter((item) => {
    if (filters.status !== "ALL" && item.status !== filters.status) {
      return false;
    }

    if (
      filters.priority !== "ALL" &&
      item.casePriority !== filters.priority
    ) {
      return false;
    }

    if (
      filters.lineage === "CURRENT" &&
      !item.evidenceLineageCurrent
    ) {
      return false;
    }

    if (
      filters.lineage === "HISTORICAL" &&
      item.evidenceLineageCurrent
    ) {
      return false;
    }

    return matchesQuery(filters.q, [
      item.findingReference,
      item.title,
      item.narrative,
      item.caseNumber,
      item.evidenceReference,
      item.submittedBy,
      item.reviewedBy,
      item.status,
    ]);
  });
}

/** Counts for one filter group, given every other active filter. */
export function findingFacetCounts(
  items: readonly InvestigationFinding[],
  filters: FindingFilters,
  facet: "status" | "priority" | "lineage"
): Record<string, number> {
  const rows = filterFindings(items, { ...filters, [facet]: "ALL" });

  const counts: Record<string, number> =
    facet === "lineage"
      ? {
          CURRENT: rows.filter((item) => item.evidenceLineageCurrent)
            .length,
          HISTORICAL: rows.filter(
            (item) => !item.evidenceLineageCurrent
          ).length,
        }
      : countBy(rows, (item) =>
          facet === "status" ? item.status : item.casePriority
        );

  counts.ALL = rows.length;

  return counts;
}

function stamp(value: string) {
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

/** Returns a new sorted array. */
export function sortFindings(
  items: readonly InvestigationFinding[],
  sort: FindingSort
): InvestigationFinding[] {
  return [...items].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return stamp(a.submittedAt) - stamp(b.submittedAt);

      case "reference":
        return (
          a.findingReference.localeCompare(b.findingReference) ||
          b.findingVersion - a.findingVersion
        );

      default:
        return stamp(b.submittedAt) - stamp(a.submittedAt);
    }
  });
}

export const FINDING_CSV_COLUMNS: CsvColumn<InvestigationFinding>[] =
  [
    {
      header: "Finding reference",
      value: (item) => item.findingReference,
    },
    { header: "Version", value: (item) => item.findingVersion },
    { header: "Title", value: (item) => item.title },
    { header: "Narrative", value: (item) => item.narrative },
    { header: "Status", value: (item) => item.status },
    { header: "Case number", value: (item) => item.caseNumber },
    { header: "Case priority", value: (item) => item.casePriority },
    { header: "Case status", value: (item) => item.caseStatus },
    { header: "Submitted by", value: (item) => item.submittedBy },
    {
      header: "Submitted at (UTC)",
      value: (item) => item.submittedAt,
    },
    {
      header: "Review decision",
      value: (item) => item.findingReviewDecision,
    },
    { header: "Reviewed by", value: (item) => item.reviewedBy },
    {
      header: "Reviewed at (UTC)",
      value: (item) => item.reviewedAt,
    },
    { header: "Review note", value: (item) => item.reviewNote },
    {
      header: "Evidence reference",
      value: (item) => item.evidenceReference,
    },
    { header: "Evidence ID", value: (item) => item.evidenceId },
    {
      header: "Evidence review ID",
      value: (item) => item.evidenceReviewId,
    },
    {
      header: "Evidence review version",
      value: (item) => item.evidenceReviewVersion,
    },
    {
      header: "Evidence registry fingerprint",
      value: (item) => item.evidenceRegistryFingerprint,
    },
    {
      header: "Evidence custody head hash",
      value: (item) => item.evidenceCustodyHeadHash,
    },
    {
      header: "Evidence lineage current",
      value: (item) => (item.evidenceLineageCurrent ? "Yes" : "No"),
    },
  ];
