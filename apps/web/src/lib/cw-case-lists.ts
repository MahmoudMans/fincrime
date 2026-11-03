import type {
  CaseWorkspaceEvidence,
  CaseWorkspaceNote,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { formatDateTime, humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

/** Longest note and resolution summary the backend accepts. */
export const CASE_TEXT_MAX_LENGTH = 2000;

function timeOf(value: string): number {
  const time = Date.parse(value);

  return Number.isNaN(time) ? 0 : time;
}

/**
 * Newest first. Items with the same timestamp come back in the
 * reverse of the order the server sent them in, like reversing the
 * server list would.
 */
export function newestFirst<T extends { createdAt: string }>(
  items: readonly T[]
): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      time: timeOf(item.createdAt),
    }))
    .sort(
      (left, right) =>
        right.time - left.time || right.index - left.index
    )
    .map((entry) => entry.item);
}

export function filterNotes(
  notes: readonly CaseWorkspaceNote[],
  query: string
): CaseWorkspaceNote[] {
  return notes.filter((note) =>
    matchesQuery(query, [
      note.authorName,
      note.body,
      formatDateTime(note.createdAt),
    ])
  );
}

function evidenceMatches(
  item: CaseWorkspaceEvidence,
  query: string
): boolean {
  return matchesQuery(query, [
    item.title,
    item.description,
    item.evidenceType,
    humanize(item.evidenceType),
    item.referenceId,
    item.snapshotText,
  ]);
}

export function filterEvidence(
  items: readonly CaseWorkspaceEvidence[],
  query: string,
  type: string
): CaseWorkspaceEvidence[] {
  return items.filter(
    (item) =>
      (type === "ALL" || item.evidenceType === type) &&
      evidenceMatches(item, query)
  );
}

/** Per-type counts for the evidence that matches the search text. */
export function countEvidenceTypes(
  items: readonly CaseWorkspaceEvidence[],
  query: string
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    if (!evidenceMatches(item, query)) {
      continue;
    }

    counts[item.evidenceType] =
      (counts[item.evidenceType] ?? 0) + 1;
  }

  return counts;
}

export function hasEvidenceFor(
  items: readonly CaseWorkspaceEvidence[],
  referenceType: string,
  referenceId: string
): boolean {
  return items.some(
    (item) =>
      item.referenceType === referenceType &&
      item.referenceId === referenceId
  );
}

export function evidenceCsvColumns(
  caseNumber: string
): CsvColumn<CaseWorkspaceEvidence>[] {
  return [
    { header: "Case number", value: () => caseNumber },
    {
      header: "Attached at (ISO 8601)",
      value: (item) => item.createdAt,
    },
    {
      header: "Evidence type",
      value: (item) => item.evidenceType,
    },
    {
      header: "Reference type",
      value: (item) => item.referenceType,
    },
    {
      header: "Reference id",
      value: (item) => item.referenceId,
    },
    { header: "Title", value: (item) => item.title },
    {
      header: "Description",
      value: (item) => item.description,
    },
    {
      header: "Snapshot",
      value: (item) => item.snapshotText,
    },
  ];
}
