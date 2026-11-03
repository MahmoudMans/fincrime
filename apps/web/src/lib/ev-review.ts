import type {
  EvidenceCustodyRecord,
  EvidenceReviewRecord,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import {
  ALL,
  asRecord,
  isoOrRaw,
  pickFreeChoice,
  pickText,
  sameUser,
} from "@/lib/ev-common";
import { humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

export const REVIEW_DECISIONS = [
  "ACCEPTED_FOR_ANALYSIS",
  "QUESTIONED",
  "EXCLUDED",
];

/** Rationale offered for each decision; the person edits it. */
export const DEFAULT_REASONS: Record<string, string> = {
  ACCEPTED_FOR_ANALYSIS:
    "Evidence integrity and custody lineage are suitable for analytical use in the investigation.",
  QUESTIONED:
    "Evidence integrity or custody lineage raises questions that need follow-up before analytical use.",
  EXCLUDED:
    "Evidence is excluded from analytical use in the investigation.",
};

/**
 * When the decision changes and the rationale is still blank or one
 * of the offered texts, offer the text that fits the new decision.
 * A rationale the person wrote or edited is left alone.
 */
export function reasonForDecision(
  currentReason: string,
  nextDecision: string
): string {
  const untouched =
    currentReason.trim() === "" ||
    Object.values(DEFAULT_REASONS).includes(currentReason);

  return untouched
    ? (DEFAULT_REASONS[nextDecision] ?? currentReason)
    : currentReason;
}

/** Where one evidence record stands with its analytical-use review. */
export type ReviewState =
  | "ACCEPTED_FOR_ANALYSIS"
  | "QUESTIONED"
  | "EXCLUDED"
  | "OUTDATED"
  | "NOT_REVIEWED";

export const REVIEW_STATES: ReviewState[] = [
  "ACCEPTED_FOR_ANALYSIS",
  "QUESTIONED",
  "EXCLUDED",
  "OUTDATED",
  "NOT_REVIEWED",
];

export function reviewStateLabel(state: string): string {
  if (state === "OUTDATED") {
    return "Review outdated";
  }

  if (state === "NOT_REVIEWED") {
    return "Not reviewed";
  }

  return humanize(state);
}

export interface ReviewRow {
  evidence: EvidenceCustodyRecord;
  /** Newest review that still matches the evidence lineage. */
  current: EvidenceReviewRecord | null;
  /** Newest review of any lineage (what a history export shows). */
  latest: EvidenceReviewRecord | null;
  state: ReviewState;
}

function newest(
  reviews: readonly EvidenceReviewRecord[]
): EvidenceReviewRecord | null {
  let best: EvidenceReviewRecord | null = null;

  for (const review of reviews) {
    if (!best || review.reviewVersion > best.reviewVersion) {
      best = review;
    }
  }

  return best;
}

export function stateOf(
  current: EvidenceReviewRecord | null,
  latest: EvidenceReviewRecord | null
): ReviewState {
  if (current) {
    // The backend only stores these three decisions; anything else
    // is shown as questioned rather than counted as accepted.
    return current.reviewDecision === "ACCEPTED_FOR_ANALYSIS" ||
      current.reviewDecision === "EXCLUDED"
      ? current.reviewDecision
      : "QUESTIONED";
  }

  return latest ? "OUTDATED" : "NOT_REVIEWED";
}

/** One row per evidence record, with its reviews worked out once. */
export function buildReviewRows(
  evidence: readonly EvidenceCustodyRecord[],
  reviews: readonly EvidenceReviewRecord[]
): ReviewRow[] {
  const byEvidence = new Map<string, EvidenceReviewRecord[]>();

  for (const review of reviews) {
    const list = byEvidence.get(review.evidenceId);

    if (list) {
      list.push(review);
    } else {
      byEvidence.set(review.evidenceId, [review]);
    }
  }

  return evidence.map((item) => {
    const own = byEvidence.get(item.id) ?? [];

    const current = newest(
      own.filter((review) => review.lineageCurrent)
    );

    const latest = newest(own);

    return {
      evidence: item,
      current,
      latest,
      state: stateOf(current, latest),
    };
  });
}

export interface ReviewFilters {
  q: string;
  /** A ReviewState or ALL. */
  state: string;
  /** A custody status or ALL. */
  status: string;
}

export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  q: "",
  state: ALL,
  status: ALL,
};

export type ReviewFacet = "state" | "status";

export function reviewFiltersActive(
  filters: ReviewFilters
): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.state !== ALL ||
    filters.status !== ALL
  );
}

export function sanitizeReviewFilters(
  value: unknown
): ReviewFilters {
  const raw = asRecord(value);

  return {
    q: pickText(raw.q),
    state: pickFreeChoice(raw.state),
    status: pickFreeChoice(raw.status),
  };
}

export function reviewRowMatches(
  row: ReviewRow,
  filters: ReviewFilters,
  skip?: ReviewFacet
): boolean {
  if (
    skip !== "state" &&
    filters.state !== ALL &&
    row.state !== filters.state
  ) {
    return false;
  }

  if (
    skip !== "status" &&
    filters.status !== ALL &&
    row.evidence.currentStatus !== filters.status
  ) {
    return false;
  }

  const shown = row.current ?? row.latest;

  return matchesQuery(filters.q, [
    row.evidence.evidenceReference,
    row.evidence.caseNumber,
    row.evidence.title,
    row.evidence.currentCustodian,
    row.evidence.currentStatus,
    humanize(row.evidence.currentStatus),
    reviewStateLabel(row.state),
    shown?.reviewedBy,
    shown?.reviewReason,
    shown?.reviewDecision,
  ]);
}

export function filterReviewRows(
  rows: readonly ReviewRow[],
  filters: ReviewFilters
): ReviewRow[] {
  return rows.filter((row) => reviewRowMatches(row, filters));
}

/** Rows per value of one facet, with the other filters applied. */
export function reviewFacetCounts(
  rows: readonly ReviewRow[],
  filters: ReviewFilters,
  facet: ReviewFacet
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    if (reviewRowMatches(row, filters, facet)) {
      const value =
        facet === "state" ? row.state : row.evidence.currentStatus;

      counts[value] = (counts[value] ?? 0) + 1;
    }
  }

  return counts;
}

export const REVIEW_ROW_COLUMNS: CsvColumn<ReviewRow>[] = [
  {
    header: "Evidence reference",
    value: (row) => row.evidence.evidenceReference,
  },
  { header: "Case", value: (row) => row.evidence.caseNumber },
  { header: "Title", value: (row) => row.evidence.title },
  {
    header: "Custody status",
    value: (row) => row.evidence.currentStatus,
  },
  {
    header: "Current custodian",
    value: (row) => row.evidence.currentCustodian,
  },
  {
    header: "Review state",
    value: (row) => reviewStateLabel(row.state),
  },
  {
    header: "Review version",
    value: (row) => (row.current ?? row.latest)?.reviewVersion,
  },
  {
    header: "Decision",
    value: (row) => (row.current ?? row.latest)?.reviewDecision,
  },
  {
    header: "Rationale",
    value: (row) => (row.current ?? row.latest)?.reviewReason,
  },
  {
    header: "Reviewed by",
    value: (row) => (row.current ?? row.latest)?.reviewedBy,
  },
  {
    header: "Reviewed at (UTC)",
    value: (row) => isoOrRaw((row.current ?? row.latest)?.reviewedAt),
  },
  {
    header: "Registry fingerprint",
    value: (row) => row.evidence.registryFingerprint,
  },
  {
    header: "Review custody head hash",
    value: (row) => (row.current ?? row.latest)?.custodyHeadHash,
  },
];

export const REVIEW_HISTORY_COLUMNS: CsvColumn<EvidenceReviewRecord>[] =
  [
    {
      header: "Evidence reference",
      value: (row) => row.evidenceReference,
    },
    { header: "Case", value: (row) => row.caseNumber },
    { header: "Version", value: (row) => row.reviewVersion },
    { header: "Decision", value: (row) => row.reviewDecision },
    { header: "Rationale", value: (row) => row.reviewReason },
    { header: "Reviewed by", value: (row) => row.reviewedBy },
    {
      header: "Reviewed at (UTC)",
      value: (row) => isoOrRaw(row.reviewedAt),
    },
    {
      header: "Lineage",
      value: (row) =>
        row.lineageCurrent ? "Current" : "Historical",
    },
    {
      header: "Registry fingerprint",
      value: (row) => row.registryFingerprint,
    },
    {
      header: "Custody head hash",
      value: (row) => row.custodyHeadHash,
    },
  ];

/**
 * Why a review cannot be recorded right now, in plain words. The
 * backend enforces the same rules; showing them first saves a
 * failed request.
 */
export function reviewBlockers(input: {
  canReview: boolean;
  evidence: EvidenceCustodyRecord;
  current: EvidenceReviewRecord | null;
  username: string;
}): string[] {
  const blockers: string[] = [];

  if (!input.canReview) {
    blockers.push(
      "Recording a review needs the Senior Analyst or Administrator role."
    );
  }

  if (input.evidence.currentStatus !== "VERIFIED") {
    blockers.push(
      "Only integrity-verified evidence can be reviewed. Verify it in Chain of custody first."
    );
  }

  if (sameUser(input.username, input.evidence.currentCustodian)) {
    blockers.push(
      "You are the current custodian, so a different reviewer has to record this review."
    );
  }

  if (input.current) {
    blockers.push(
      `Version ${input.current.reviewVersion} already reviews the current evidence lineage. Another review is possible once the custody chain changes, for example after a new integrity verification.`
    );
  }

  return blockers;
}
