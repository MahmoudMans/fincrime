import type {
  InvestigationConclusionPackage,
  InvestigationFinding,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import {
  ALL,
  asRecord,
  isoOrRaw,
  pickChoice,
  pickFreeChoice,
  pickText,
  sameUser,
} from "@/lib/ev-common";
import { humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

export const PACKAGE_STATUSES = [
  "PENDING",
  "RELEASED",
  "REJECTED",
] as const;

/** "Has failed checks" and "All checks valid" for the filter. */
export const INTEGRITY_CHOICES = ["CLEAR", "BLOCKED"] as const;

export interface ReleaseFilters {
  q: string;
  /** PENDING, RELEASED, REJECTED or ALL. */
  status: string;
  /** CLEAR, BLOCKED or ALL. */
  integrity: string;
}

export const DEFAULT_RELEASE_FILTERS: ReleaseFilters = {
  q: "",
  status: ALL,
  integrity: ALL,
};

export type ReleaseFacet = "status" | "integrity";

export function releaseFiltersActive(
  filters: ReleaseFilters
): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.status !== ALL ||
    filters.integrity !== ALL
  );
}

export function sanitizeReleaseFilters(
  value: unknown
): ReleaseFilters {
  const raw = asRecord(value);

  return {
    q: pickText(raw.q),
    status: pickFreeChoice(raw.status),
    integrity: pickChoice(raw.integrity, INTEGRITY_CHOICES),
  };
}

export interface PackageCheck {
  key: string;
  label: string;
  ok: boolean;
}

/** The four integrity facts the backend reports for a package. */
export function dataChecks(
  item: InvestigationConclusionPackage
): PackageCheck[] {
  return [
    {
      key: "fingerprint",
      label: "Release fingerprint",
      ok: item.fingerprintValid,
    },
    {
      key: "finding",
      label: "Finding lineage",
      ok: item.findingLineageCurrent,
    },
    {
      key: "outcome",
      label: "Outcome provenance",
      ok: item.outcomeLineageCurrent,
    },
    {
      key: "source",
      label: "Source lineage",
      ok: item.sourceLineageCurrent,
    },
  ];
}

export function hasFailedChecks(
  item: InvestigationConclusionPackage
): boolean {
  return dataChecks(item).some((check) => !check.ok);
}

export interface ReviewContext {
  canRelease: boolean;
  username: string;
  reviewNote: string;
}

/**
 * Everything that has to be true before an Administrator can
 * release a pending package. Each line is shown to the person, so a
 * disabled Release button always has a visible reason.
 */
export function releaseChecklist(
  item: InvestigationConclusionPackage,
  context: ReviewContext
): PackageCheck[] {
  return [
    ...dataChecks(item).map((check) => ({
      ...check,
      label:
        check.key === "fingerprint"
          ? "Release fingerprint matches the frozen package"
          : check.key === "finding"
            ? "Finding and evidence lineage are still current"
            : check.key === "outcome"
              ? "Governed outcome provenance is still current"
              : "Source lineage is still current",
    })),
    {
      key: "role",
      label: "You hold the Administrator role",
      ok: context.canRelease,
    },
    {
      key: "independent",
      label: `Reviewer differs from the preparer (${item.preparedBy})`,
      ok: !sameUser(context.username, item.preparedBy),
    },
    {
      key: "note",
      label: "A review rationale is entered",
      ok: context.reviewNote.trim() !== "",
    },
  ];
}

export function canRelease(checks: readonly PackageCheck[]): boolean {
  return checks.every((check) => check.ok);
}

/** Rejecting needs the reviewer rules, not the integrity checks. */
export function canReject(checks: readonly PackageCheck[]): boolean {
  return checks
    .filter(
      (check) =>
        check.key === "role" ||
        check.key === "independent" ||
        check.key === "note"
    )
    .every((check) => check.ok);
}

/** Why a package cannot be prepared from the selected finding. */
export function prepareBlockers(input: {
  canPrepare: boolean;
  finding: InvestigationFinding | null;
  packages: readonly InvestigationConclusionPackage[];
}): string[] {
  const blockers: string[] = [];

  if (!input.canPrepare) {
    blockers.push(
      "Preparing a package needs the Senior Analyst role."
    );
  }

  const finding = input.finding;

  if (!finding) {
    return blockers;
  }

  const ofCase = input.packages.filter(
    (item) => item.caseId === finding.caseId
  );

  const released = ofCase.find((item) => item.status === "RELEASED");

  if (released) {
    blockers.push(
      `${finding.caseNumber} already has a released conclusion package (v${released.packageVersion}).`
    );
  }

  const pending = ofCase.find((item) => item.status === "PENDING");

  if (pending) {
    blockers.push(
      `${finding.caseNumber} already has a pending conclusion package (v${pending.packageVersion}). Release or reject it before preparing another.`
    );
  }

  return blockers;
}

export function releaseMatches(
  item: InvestigationConclusionPackage,
  filters: ReleaseFilters,
  skip?: ReleaseFacet
): boolean {
  if (
    skip !== "status" &&
    filters.status !== ALL &&
    item.status !== filters.status
  ) {
    return false;
  }

  if (skip !== "integrity" && filters.integrity !== ALL) {
    const failed = hasFailedChecks(item);

    if (
      (filters.integrity === "BLOCKED" && !failed) ||
      (filters.integrity === "CLEAR" && failed)
    ) {
      return false;
    }
  }

  return matchesQuery(filters.q, [
    item.caseNumber,
    item.findingReference,
    item.findingTitle,
    item.conclusionSummary,
    item.releaseRationale,
    item.preparedBy,
    item.reviewedBy,
    item.status,
    humanize(item.status),
    humanize(item.governedOutcome),
    item.releaseFingerprint,
  ]);
}

export function filterReleases(
  packages: readonly InvestigationConclusionPackage[],
  filters: ReleaseFilters
): InvestigationConclusionPackage[] {
  return packages.filter((item) => releaseMatches(item, filters));
}

export function releaseFacetCounts(
  packages: readonly InvestigationConclusionPackage[],
  filters: ReleaseFilters,
  facet: ReleaseFacet
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of packages) {
    if (releaseMatches(item, filters, facet)) {
      const value =
        facet === "status"
          ? item.status
          : hasFailedChecks(item)
            ? "BLOCKED"
            : "CLEAR";

      counts[value] = (counts[value] ?? 0) + 1;
    }
  }

  return counts;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export const RELEASE_COLUMNS: CsvColumn<InvestigationConclusionPackage>[] =
  [
    { header: "Case", value: (item) => item.caseNumber },
    {
      header: "Package version",
      value: (item) => item.packageVersion,
    },
    { header: "Status", value: (item) => item.status },
    {
      header: "Finding reference",
      value: (item) => item.findingReference,
    },
    {
      header: "Finding version",
      value: (item) => item.findingVersion,
    },
    { header: "Finding title", value: (item) => item.findingTitle },
    {
      header: "Governed outcome",
      value: (item) => item.governedOutcome,
    },
    {
      header: "Conclusion summary",
      value: (item) => item.conclusionSummary,
    },
    {
      header: "Release rationale",
      value: (item) => item.releaseRationale,
    },
    { header: "Prepared by", value: (item) => item.preparedBy },
    {
      header: "Prepared at (UTC)",
      value: (item) => isoOrRaw(item.preparedAt),
    },
    { header: "Reviewed by", value: (item) => item.reviewedBy },
    {
      header: "Reviewed at (UTC)",
      value: (item) => isoOrRaw(item.reviewedAt),
    },
    { header: "Decision", value: (item) => item.releaseDecision },
    { header: "Review note", value: (item) => item.reviewNote },
    {
      header: "Fingerprint valid",
      value: (item) => yesNo(item.fingerprintValid),
    },
    {
      header: "Finding lineage current",
      value: (item) => yesNo(item.findingLineageCurrent),
    },
    {
      header: "Outcome lineage current",
      value: (item) => yesNo(item.outcomeLineageCurrent),
    },
    {
      header: "Source lineage current",
      value: (item) => yesNo(item.sourceLineageCurrent),
    },
    {
      header: "Release fingerprint",
      value: (item) => item.releaseFingerprint,
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
      header: "Outcome provenance hash",
      value: (item) => item.outcomeProvenanceHash,
    },
    {
      header: "Outcome audit root hash",
      value: (item) => item.outcomeAuditRootHash,
    },
    { header: "Package id", value: (item) => item.id },
  ];
