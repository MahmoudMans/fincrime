import type {
  CaseOutcomeAttestation,
  CaseOutcomeAttestationVerification,
  GovernedCaseOutcome,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

import { ALL } from "./gv-common";

export const AWAITING_PAGE_SIZE = 6;
export const REGISTRY_PAGE_SIZE = 5;

/** The server returns at most this many verifications. */
export const VERIFICATION_LIMIT = 50;

export type IntegrityStatus = "VERIFIED" | "FAILED" | "UNVERIFIED";

export const STATUS_ORDER: readonly IntegrityStatus[] = [
  "VERIFIED",
  "FAILED",
  "UNVERIFIED",
];

export interface AttestationFilters {
  q: string;
  /** Governed outcome. */
  outcome: string;
  /** Integrity status; applies to the registry. */
  status: string;
  /** Page of the registry. */
  page: number;
}

export const DEFAULT_ATTESTATION_FILTERS: AttestationFilters = {
  q: "",
  outcome: ALL,
  status: ALL,
  page: 0,
};

export interface RegistryRow {
  attestation: CaseOutcomeAttestation;
  verification: CaseOutcomeAttestationVerification | undefined;
  status: IntegrityStatus;
}

function time(value: string) {
  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? 0 : parsed;
}

/** The most recent verification of each attestation. */
export function latestVerifications(
  verifications: readonly CaseOutcomeAttestationVerification[]
): Map<string, CaseOutcomeAttestationVerification> {
  const latest = new Map<
    string,
    CaseOutcomeAttestationVerification
  >();

  for (const verification of verifications) {
    const known = latest.get(verification.attestationId);

    if (
      !known ||
      time(verification.verifiedAt) > time(known.verifiedAt)
    ) {
      latest.set(verification.attestationId, verification);
    }
  }

  return latest;
}

export function integrityStatus(
  verification: CaseOutcomeAttestationVerification | undefined
): IntegrityStatus {
  if (!verification) {
    return "UNVERIFIED";
  }

  return verification.integrityValid ? "VERIFIED" : "FAILED";
}

export function integrityLabel(status: string) {
  if (status === "UNVERIFIED") {
    return "Not verified";
  }

  return status === "FAILED" ? "Verification failed" : humanize(status);
}

export function buildRegistry(
  attestations: readonly CaseOutcomeAttestation[],
  latest: ReadonlyMap<string, CaseOutcomeAttestationVerification>
): RegistryRow[] {
  return attestations.map((attestation) => {
    const verification = latest.get(attestation.id);

    return {
      attestation,
      verification,
      status: integrityStatus(verification),
    };
  });
}

/** Governed outcomes that have no attestation for their execution. */
export function awaitingOutcomes(
  outcomes: readonly GovernedCaseOutcome[],
  attestations: readonly CaseOutcomeAttestation[]
): GovernedCaseOutcome[] {
  const attested = new Set(
    attestations.map((attestation) => attestation.executionId)
  );

  return outcomes.filter(
    (outcome) => !attested.has(outcome.executionId)
  );
}

export function filterAwaiting(
  outcomes: readonly GovernedCaseOutcome[],
  filters: AttestationFilters
): GovernedCaseOutcome[] {
  return outcomes.filter(
    (outcome) =>
      (filters.outcome === ALL ||
        outcome.governedOutcome === filters.outcome) &&
      matchesQuery(filters.q, [
        outcome.caseNumber,
        outcome.casePriority,
        outcome.governedOutcome,
        humanize(outcome.governedOutcome),
        outcome.lastUpdatedBy,
      ])
  );
}

export function filterRegistry(
  rows: readonly RegistryRow[],
  filters: AttestationFilters
): RegistryRow[] {
  return rows.filter(
    (row) =>
      (filters.status === ALL || row.status === filters.status) &&
      (filters.outcome === ALL ||
        row.attestation.governedOutcome === filters.outcome) &&
      matchesQuery(filters.q, [
        row.attestation.caseNumber,
        row.attestation.governedOutcome,
        humanize(row.attestation.governedOutcome),
        row.attestation.attestedBy,
        row.attestation.provenanceHash,
        row.attestation.auditRootHash,
        integrityLabel(row.status),
      ])
  );
}

export const REGISTRY_COLUMNS: readonly CsvColumn<RegistryRow>[] = [
  { header: "Case number", value: (row) => row.attestation.caseNumber },
  {
    header: "Decision version",
    value: (row) => row.attestation.decisionVersion,
  },
  {
    header: "Governed outcome",
    value: (row) => row.attestation.governedOutcome,
  },
  {
    header: "Integrity status",
    value: (row) => integrityLabel(row.status),
  },
  {
    header: "Provenance hash",
    value: (row) => row.attestation.provenanceHash,
  },
  {
    header: "Audit root hash",
    value: (row) => row.attestation.auditRootHash,
  },
  { header: "Attested by", value: (row) => row.attestation.attestedBy },
  {
    header: "Attested at (UTC)",
    value: (row) => row.attestation.attestedAt,
  },
  {
    header: "Provenance valid",
    value: (row) =>
      row.verification
        ? row.verification.provenanceValid
          ? "Yes"
          : "No"
        : "",
  },
  {
    header: "Audit anchor present",
    value: (row) =>
      row.verification
        ? row.verification.auditAnchorPresent
          ? "Yes"
          : "No"
        : "",
  },
  {
    header: "Last verified by",
    value: (row) => row.verification?.verifiedBy,
  },
  {
    header: "Last verified at (UTC)",
    value: (row) => row.verification?.verifiedAt,
  },
  {
    header: "Verification detail",
    value: (row) => row.verification?.detail,
  },
  { header: "Attestation id", value: (row) => row.attestation.id },
  {
    header: "Execution id",
    value: (row) => row.attestation.executionId,
  },
];

export const AWAITING_COLUMNS: readonly CsvColumn<GovernedCaseOutcome>[] = [
  { header: "Case number", value: (item) => item.caseNumber },
  { header: "Case priority", value: (item) => item.casePriority },
  { header: "Case status", value: (item) => item.caseStatus },
  { header: "Decision version", value: (item) => item.decisionVersion },
  { header: "Governed outcome", value: (item) => item.governedOutcome },
  { header: "Effective at (UTC)", value: (item) => item.effectiveAt },
  { header: "Last updated by", value: (item) => item.lastUpdatedBy },
  { header: "Execution id", value: (item) => item.executionId },
];
