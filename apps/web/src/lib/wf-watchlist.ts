import type {
  WatchlistEntry,
  WatchlistScreeningHit,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { countBy, matchesQuery } from "@/lib/list-utils";

/* ------------------------------------------------------------------ */
/* Screening hits                                                      */
/* ------------------------------------------------------------------ */

export const HIT_STATUSES = [
  "PENDING_REVIEW",
  "ESCALATED",
  "CLEARED",
] as const;

export type HitStrength = "ALL" | "critical" | "high" | "medium";

export type HitCountry = "ALL" | "MATCH" | "DIFFERENT";

export type HitSort =
  | "score-desc"
  | "score-asc"
  | "customer"
  | "watchlist"
  | "pending";

export interface HitFilters {
  q: string;
  /** "ALL" or a hit status. */
  status: string;
  strength: HitStrength;
  /** "ALL" or a watchlist category. */
  category: string;
  country: HitCountry;
  sort: HitSort;
}

export const DEFAULT_HIT_FILTERS: HitFilters = {
  q: "",
  status: "ALL",
  strength: "ALL",
  category: "ALL",
  country: "ALL",
  sort: "score-desc",
};

export const HIT_SORTS: ReadonlyArray<{
  value: HitSort;
  label: string;
}> = [
  { value: "score-desc", label: "Strongest match first" },
  { value: "score-asc", label: "Weakest match first" },
  { value: "pending", label: "Pending review first" },
  { value: "customer", label: "Customer name A to Z" },
  { value: "watchlist", label: "Watchlist name A to Z" },
];

/** Match strength band of a score (95+, 85 to 94, below 85). */
export function scoreTone(score: number): "critical" | "high" | "medium" {
  if (score >= 95) {
    return "critical";
  }

  if (score >= 85) {
    return "high";
  }

  return "medium";
}

const STRENGTH_VALUES: readonly string[] = [
  "ALL",
  "critical",
  "high",
  "medium",
];

const COUNTRY_VALUES: readonly string[] = ["ALL", "MATCH", "DIFFERENT"];

const HIT_SORT_VALUES: readonly string[] = HIT_SORTS.map(
  (option) => option.value
);

function text(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

/** Saved views come from storage, so their shape is not trusted. */
export function normalizeHitFilters(value: unknown): HitFilters {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_HIT_FILTERS;
  }

  const raw = value as Record<string, unknown>;

  const strength = text(raw.strength, "ALL");

  const country = text(raw.country, "ALL");

  const sort = text(raw.sort, "score-desc");

  return {
    q: text(raw.q, ""),
    status: text(raw.status, "ALL"),
    strength: STRENGTH_VALUES.includes(strength)
      ? (strength as HitStrength)
      : "ALL",
    category: text(raw.category, "ALL"),
    country: COUNTRY_VALUES.includes(country)
      ? (country as HitCountry)
      : "ALL",
    sort: HIT_SORT_VALUES.includes(sort)
      ? (sort as HitSort)
      : "score-desc",
  };
}

export function isDefaultHitFilters(filters: HitFilters) {
  return (
    filters.q.trim() === "" &&
    filters.status === "ALL" &&
    filters.strength === "ALL" &&
    filters.category === "ALL" &&
    filters.country === "ALL" &&
    filters.sort === "score-desc"
  );
}

export function filterHits(
  items: readonly WatchlistScreeningHit[],
  filters: HitFilters
): WatchlistScreeningHit[] {
  return items.filter((hit) => {
    if (filters.status !== "ALL" && hit.status !== filters.status) {
      return false;
    }

    if (
      filters.strength !== "ALL" &&
      scoreTone(hit.matchScore) !== filters.strength
    ) {
      return false;
    }

    if (
      filters.category !== "ALL" &&
      hit.category !== filters.category
    ) {
      return false;
    }

    if (filters.country === "MATCH" && !hit.countryMatch) {
      return false;
    }

    if (filters.country === "DIFFERENT" && hit.countryMatch) {
      return false;
    }

    return matchesQuery(filters.q, [
      hit.customerName,
      hit.matchedName,
      hit.watchlistName,
      hit.listKey,
      hit.category,
      hit.customerCountryCode,
      hit.watchlistCountryCode,
      hit.customerRiskTier,
      hit.sourceName,
      hit.sourceReference,
      hit.status,
    ]);
  });
}

/** Counts for one filter group, given every other active filter. */
export function hitFacetCounts(
  items: readonly WatchlistScreeningHit[],
  filters: HitFilters,
  facet: "status" | "strength" | "category" | "country"
): Record<string, number> {
  const rows = filterHits(items, { ...filters, [facet]: "ALL" });

  const counts: Record<string, number> =
    facet === "country"
      ? {
          MATCH: rows.filter((hit) => hit.countryMatch).length,
          DIFFERENT: rows.filter((hit) => !hit.countryMatch).length,
        }
      : countBy(rows, (hit) => {
          switch (facet) {
            case "status":
              return hit.status;
            case "strength":
              return scoreTone(hit.matchScore);
            default:
              return hit.category;
          }
        });

  counts.ALL = rows.length;

  return counts;
}

/** Returns a new sorted array. */
export function sortHits(
  items: readonly WatchlistScreeningHit[],
  sort: HitSort
): WatchlistScreeningHit[] {
  const byScore = (a: WatchlistScreeningHit, b: WatchlistScreeningHit) =>
    b.matchScore - a.matchScore ||
    a.customerName.localeCompare(b.customerName);

  return [...items].sort((a, b) => {
    switch (sort) {
      case "score-asc":
        return (
          a.matchScore - b.matchScore ||
          a.customerName.localeCompare(b.customerName)
        );

      case "pending": {
        const left = a.status === "PENDING_REVIEW" ? 0 : 1;
        const right = b.status === "PENDING_REVIEW" ? 0 : 1;

        return left - right || byScore(a, b);
      }

      case "customer":
        return (
          a.customerName.localeCompare(b.customerName) || byScore(a, b)
        );

      case "watchlist":
        return (
          a.watchlistName.localeCompare(b.watchlistName) ||
          byScore(a, b)
        );

      default:
        return byScore(a, b);
    }
  });
}

export const HIT_CSV_COLUMNS: CsvColumn<WatchlistScreeningHit>[] = [
  { header: "Customer", value: (hit) => hit.customerName },
  { header: "Customer ID", value: (hit) => hit.customerId },
  {
    header: "Customer country",
    value: (hit) => hit.customerCountryCode,
  },
  { header: "Customer risk tier", value: (hit) => hit.customerRiskTier },
  { header: "Watchlist name", value: (hit) => hit.watchlistName },
  { header: "Matched name", value: (hit) => hit.matchedName },
  { header: "List key", value: (hit) => hit.listKey },
  { header: "Category", value: (hit) => hit.category },
  {
    header: "Watchlist country",
    value: (hit) => hit.watchlistCountryCode,
  },
  {
    header: "Watchlist risk level",
    value: (hit) => hit.watchlistRiskLevel,
  },
  { header: "Name similarity", value: (hit) => hit.nameScore },
  {
    header: "Country match",
    value: (hit) => (hit.countryMatch ? "Yes" : "No"),
  },
  { header: "Match score", value: (hit) => hit.matchScore },
  { header: "Status", value: (hit) => hit.status },
  { header: "Review note", value: (hit) => hit.reviewNote },
  { header: "Reviewed by", value: (hit) => hit.reviewedBy },
  { header: "Reviewed at (UTC)", value: (hit) => hit.reviewedAt },
  { header: "Source", value: (hit) => hit.sourceName },
  { header: "Source reference", value: (hit) => hit.sourceReference },
  { header: "Flagged at (UTC)", value: (hit) => hit.createdAt },
  { header: "Run ID", value: (hit) => hit.runId },
  { header: "Hit ID", value: (hit) => hit.id },
];

/* ------------------------------------------------------------------ */
/* Watchlist entries                                                   */
/* ------------------------------------------------------------------ */

export type EntryActive = "ALL" | "ACTIVE" | "INACTIVE";

export type EntrySort = "name" | "updated" | "risk" | "list";

export interface EntryFilters {
  q: string;
  /** "ALL" or a category. */
  category: string;
  /** "ALL" or a risk level. */
  risk: string;
  active: EntryActive;
  sort: EntrySort;
}

export const DEFAULT_ENTRY_FILTERS: EntryFilters = {
  q: "",
  category: "ALL",
  risk: "ALL",
  active: "ALL",
  sort: "name",
};

export const ENTRY_SORTS: ReadonlyArray<{
  value: EntrySort;
  label: string;
}> = [
  { value: "name", label: "Name A to Z" },
  { value: "updated", label: "Recently updated first" },
  { value: "risk", label: "Highest risk level first" },
  { value: "list", label: "List key" },
];

export const RISK_LEVEL_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const ACTIVE_VALUES: readonly string[] = ["ALL", "ACTIVE", "INACTIVE"];

const ENTRY_SORT_VALUES: readonly string[] = ENTRY_SORTS.map(
  (option) => option.value
);

export function normalizeEntryFilters(value: unknown): EntryFilters {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_ENTRY_FILTERS;
  }

  const raw = value as Record<string, unknown>;

  const active = text(raw.active, "ALL");

  const sort = text(raw.sort, "name");

  return {
    q: text(raw.q, ""),
    category: text(raw.category, "ALL"),
    risk: text(raw.risk, "ALL"),
    active: ACTIVE_VALUES.includes(active)
      ? (active as EntryActive)
      : "ALL",
    sort: ENTRY_SORT_VALUES.includes(sort)
      ? (sort as EntrySort)
      : "name",
  };
}

export function isDefaultEntryFilters(filters: EntryFilters) {
  return (
    filters.q.trim() === "" &&
    filters.category === "ALL" &&
    filters.risk === "ALL" &&
    filters.active === "ALL" &&
    filters.sort === "name"
  );
}

export function filterEntries(
  items: readonly WatchlistEntry[],
  filters: EntryFilters
): WatchlistEntry[] {
  return items.filter((entry) => {
    if (
      filters.category !== "ALL" &&
      entry.category !== filters.category
    ) {
      return false;
    }

    if (filters.risk !== "ALL" && entry.riskLevel !== filters.risk) {
      return false;
    }

    if (filters.active === "ACTIVE" && !entry.active) {
      return false;
    }

    if (filters.active === "INACTIVE" && entry.active) {
      return false;
    }

    return matchesQuery(filters.q, [
      entry.fullName,
      entry.aliases,
      entry.listKey,
      entry.countryCode,
      entry.category,
      entry.riskLevel,
      entry.sourceName,
      entry.sourceReference,
    ]);
  });
}

/** Counts for one filter group, given every other active filter. */
export function entryFacetCounts(
  items: readonly WatchlistEntry[],
  filters: EntryFilters,
  facet: "category" | "risk" | "active"
): Record<string, number> {
  const neutral: EntryFilters =
    facet === "active"
      ? { ...filters, active: "ALL" }
      : { ...filters, [facet]: "ALL" };

  const rows = filterEntries(items, neutral);

  const counts: Record<string, number> =
    facet === "active"
      ? {
          ACTIVE: rows.filter((entry) => entry.active).length,
          INACTIVE: rows.filter((entry) => !entry.active).length,
        }
      : countBy(rows, (entry) =>
          facet === "category" ? entry.category : entry.riskLevel
        );

  counts.ALL = rows.length;

  return counts;
}

function stamp(value: string) {
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function riskRank(level: string) {
  const index = RISK_LEVEL_ORDER.indexOf(level);

  return index === -1 ? RISK_LEVEL_ORDER.length : index;
}

/** Returns a new sorted array. */
export function sortEntries(
  items: readonly WatchlistEntry[],
  sort: EntrySort
): WatchlistEntry[] {
  return [...items].sort((a, b) => {
    switch (sort) {
      case "updated":
        return (
          stamp(b.updatedAt) - stamp(a.updatedAt) ||
          a.fullName.localeCompare(b.fullName)
        );

      case "risk":
        return (
          riskRank(a.riskLevel) - riskRank(b.riskLevel) ||
          a.fullName.localeCompare(b.fullName)
        );

      case "list":
        return (
          a.listKey.localeCompare(b.listKey) ||
          a.fullName.localeCompare(b.fullName)
        );

      default:
        return a.fullName.localeCompare(b.fullName);
    }
  });
}

export const ENTRY_CSV_COLUMNS: CsvColumn<WatchlistEntry>[] = [
  { header: "List key", value: (entry) => entry.listKey },
  { header: "Full name", value: (entry) => entry.fullName },
  { header: "Aliases", value: (entry) => entry.aliases },
  { header: "Country", value: (entry) => entry.countryCode },
  { header: "Category", value: (entry) => entry.category },
  { header: "Risk level", value: (entry) => entry.riskLevel },
  { header: "Source", value: (entry) => entry.sourceName },
  { header: "Source reference", value: (entry) => entry.sourceReference },
  {
    header: "Active",
    value: (entry) => (entry.active ? "Yes" : "No"),
  },
  { header: "Updated at (UTC)", value: (entry) => entry.updatedAt },
  { header: "Entry ID", value: (entry) => entry.id },
];
