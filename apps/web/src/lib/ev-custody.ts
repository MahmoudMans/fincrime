import type {
  EvidenceCustodyEvent,
  EvidenceCustodyRecord,
  EvidenceIntegrityVerification,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import {
  ALL,
  asRecord,
  isoOrRaw,
  pickFreeChoice,
  pickText,
  uniqueSorted,
} from "@/lib/ev-common";
import { humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

export interface CustodyFilters {
  q: string;
  type: string;
  status: string;
  handler: string;
}

export const DEFAULT_CUSTODY_FILTERS: CustodyFilters = {
  q: "",
  type: ALL,
  status: ALL,
  handler: ALL,
};

export type CustodyFacet = "type" | "status" | "handler";

export function custodyFiltersActive(
  filters: CustodyFilters
): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.type !== ALL ||
    filters.status !== ALL ||
    filters.handler !== ALL
  );
}

/** Makes a saved view safe to apply (it came from localStorage). */
export function sanitizeCustodyFilters(
  value: unknown
): CustodyFilters {
  const raw = asRecord(value);

  return {
    q: pickText(raw.q),
    type: pickFreeChoice(raw.type),
    status: pickFreeChoice(raw.status),
    handler: pickFreeChoice(raw.handler),
  };
}

function custodyValue(
  record: EvidenceCustodyRecord,
  facet: CustodyFacet
): string {
  return facet === "type"
    ? record.evidenceType
    : facet === "status"
      ? record.currentStatus
      : record.currentCustodian;
}

/**
 * Does the record match the filters? `skip` leaves one facet out,
 * which is how the counts beside a filter are worked out: how many
 * rows each choice WOULD show with the other filters kept.
 */
export function custodyMatches(
  record: EvidenceCustodyRecord,
  filters: CustodyFilters,
  skip?: CustodyFacet
): boolean {
  if (
    skip !== "type" &&
    filters.type !== ALL &&
    record.evidenceType !== filters.type
  ) {
    return false;
  }

  if (
    skip !== "status" &&
    filters.status !== ALL &&
    record.currentStatus !== filters.status
  ) {
    return false;
  }

  if (
    skip !== "handler" &&
    filters.handler !== ALL &&
    record.currentCustodian !== filters.handler
  ) {
    return false;
  }

  return matchesQuery(filters.q, [
    record.evidenceReference,
    record.caseNumber,
    record.title,
    record.evidenceType,
    humanize(record.evidenceType),
    record.sourceReference,
    record.description,
    record.currentCustodian,
    record.currentStatus,
    humanize(record.currentStatus),
    record.registeredBy,
    record.contentSha256,
    record.registryFingerprint,
  ]);
}

export function filterCustody(
  records: readonly EvidenceCustodyRecord[],
  filters: CustodyFilters
): EvidenceCustodyRecord[] {
  return records.filter((record) =>
    custodyMatches(record, filters)
  );
}

/** Rows per value of one facet, with every other filter applied. */
export function custodyFacetCounts(
  records: readonly EvidenceCustodyRecord[],
  filters: CustodyFilters,
  facet: CustodyFacet
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const record of records) {
    if (custodyMatches(record, filters, facet)) {
      const value = custodyValue(record, facet);

      counts[value] = (counts[value] ?? 0) + 1;
    }
  }

  return counts;
}

export function custodyFacetValues(
  records: readonly EvidenceCustodyRecord[],
  facet: CustodyFacet
): string[] {
  return uniqueSorted(
    records.map((record) => custodyValue(record, facet))
  );
}

export const CUSTODY_COLUMNS: CsvColumn<EvidenceCustodyRecord>[] =
  [
    {
      header: "Evidence reference",
      value: (row) => row.evidenceReference,
    },
    { header: "Case", value: (row) => row.caseNumber },
    { header: "Title", value: (row) => row.title },
    { header: "Type", value: (row) => row.evidenceType },
    { header: "Status", value: (row) => row.currentStatus },
    {
      header: "Current custodian",
      value: (row) => row.currentCustodian,
    },
    { header: "Source", value: (row) => row.sourceReference },
    { header: "Description", value: (row) => row.description },
    {
      header: "Content SHA-256",
      value: (row) => row.contentSha256,
    },
    {
      header: "Registry fingerprint",
      value: (row) => row.registryFingerprint,
    },
    {
      header: "Custody events",
      value: (row) => row.custodyEventCount,
    },
    {
      header: "Registered by",
      value: (row) => row.registeredBy,
    },
    {
      header: "Registered at (UTC)",
      value: (row) => isoOrRaw(row.registeredAt),
    },
  ];

export function eventsInOrder(
  events: readonly EvidenceCustodyEvent[]
): EvidenceCustodyEvent[] {
  return [...events].sort(
    (left, right) => left.sequenceNumber - right.sequenceNumber
  );
}

export function custodyEventTypes(
  events: readonly EvidenceCustodyEvent[]
): string[] {
  return uniqueSorted(events.map((event) => event.eventType));
}

export function custodyEventMatches(
  event: EvidenceCustodyEvent,
  query: string,
  eventType: string
): boolean {
  if (eventType !== ALL && event.eventType !== eventType) {
    return false;
  }

  return matchesQuery(query, [
    event.sequenceNumber,
    event.eventType,
    humanize(event.eventType),
    event.fromCustodian,
    event.toCustodian,
    event.actorUsername,
    event.eventNote,
    event.eventHash,
    event.previousEventHash,
  ]);
}

/** The custody log of one evidence record, hashes in full. */
export function custodyLogColumns(
  record: EvidenceCustodyRecord | null
): CsvColumn<EvidenceCustodyEvent>[] {
  return [
    {
      header: "Evidence reference",
      value: () => record?.evidenceReference ?? "",
    },
    { header: "Case", value: () => record?.caseNumber ?? "" },
    {
      header: "Sequence",
      value: (event) => event.sequenceNumber,
    },
    { header: "Event", value: (event) => event.eventType },
    { header: "From", value: (event) => event.fromCustodian },
    { header: "To", value: (event) => event.toCustodian },
    { header: "Actor", value: (event) => event.actorUsername },
    { header: "Note", value: (event) => event.eventNote },
    {
      header: "Previous event hash",
      value: (event) => event.previousEventHash,
    },
    { header: "Event hash", value: (event) => event.eventHash },
    {
      header: "Occurred at (UTC)",
      value: (event) => isoOrRaw(event.occurredAt),
    },
  ];
}

export interface VerificationCheck {
  label: string;
  ok: boolean;
}

/** The three checks behind one integrity verification. */
export function verificationChecks(
  result: EvidenceIntegrityVerification
): VerificationCheck[] {
  return [
    {
      label: "Registry fingerprint",
      ok: result.registryFingerprintValid,
    },
    {
      label: "Custody hash chain",
      ok: result.custodyChainValid,
    },
    { label: "Overall integrity", ok: result.integrityValid },
  ];
}

/** 64 hexadecimal characters, the form the backend accepts. */
export function isSha256(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

/** The backend refuses a second evidence reference per case. */
export function duplicateReference(
  records: readonly EvidenceCustodyRecord[],
  caseId: string,
  reference: string
): EvidenceCustodyRecord | null {
  const wanted = reference.trim().toLowerCase();

  if (wanted === "") {
    return null;
  }

  return (
    records.find(
      (record) =>
        record.caseId === caseId &&
        record.evidenceReference.trim().toLowerCase() === wanted
    ) ?? null
  );
}
