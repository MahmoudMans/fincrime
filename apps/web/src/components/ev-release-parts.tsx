"use client";

import {
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";

import type { InvestigationConclusionPackage } from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import { ALL } from "@/lib/ev-common";
import {
  canReject,
  canRelease as canReleaseChecks,
  PACKAGE_STATUSES,
  RELEASE_COLUMNS,
  releaseChecklist,
  releaseFacetCounts,
  releaseFiltersActive,
  sanitizeReleaseFilters,
  type PackageCheck,
  type ReleaseFilters,
} from "@/lib/ev-release";
import { humanize } from "@/lib/format";

import { ConfirmButton } from "./confirm-button";
import {
  ChipGroup,
  ExportButton,
  ResetButton,
  ResultCount,
  SavedViews,
  SearchField,
  SelectField,
  Toolbar,
  type Option,
} from "./list-tools";

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce(
    (total, value) => total + value,
    0
  );
}

const STATUS_TONES: Record<string, Option<string>["tone"]> = {
  PENDING: "warning",
  RELEASED: "ok",
  REJECTED: "danger",
};

/** Search, status chips and integrity filter with counts, export. */
export function ReleaseFilterBar({
  packages,
  filters,
  filtered,
  refreshing,
  onChange,
  onReset,
  onApply,
  onRefresh,
}: {
  packages: readonly InvestigationConclusionPackage[];
  filters: ReleaseFilters;
  filtered: readonly InvestigationConclusionPackage[];
  refreshing: boolean;
  onChange: (patch: Partial<ReleaseFilters>) => void;
  onReset: () => void;
  onApply: (filters: ReleaseFilters) => void;
  onRefresh: () => void;
}) {
  const active = releaseFiltersActive(filters);

  const statusCounts = useMemo(
    () => releaseFacetCounts(packages, filters, "status"),
    [packages, filters]
  );

  const integrityCounts = useMemo(
    () => releaseFacetCounts(packages, filters, "integrity"),
    [packages, filters]
  );

  const statusOptions: Option<string>[] = [
    { value: ALL, label: "All", count: sum(statusCounts) },
    ...PACKAGE_STATUSES.map((status) => ({
      value: status,
      label: humanize(status),
      count: statusCounts[status] ?? 0,
      tone: STATUS_TONES[status],
    })),
  ];

  const integrityOptions: Option<string>[] = [
    {
      value: ALL,
      label: "All integrity states",
      count: sum(integrityCounts),
    },
    {
      value: "CLEAR",
      label: "All checks valid",
      count: integrityCounts.CLEAR ?? 0,
    },
    {
      value: "BLOCKED",
      label: "Has failed checks",
      count: integrityCounts.BLOCKED ?? 0,
    },
  ];

  return (
    <div className="ui-ev-filters">
      <Toolbar label="Filter conclusion packages">
        <SearchField
          value={filters.q}
          label="Search conclusion packages"
          placeholder="Search case, finding, summary, preparer..."
          onChange={(q) => onChange({ q })}
        />

        <SelectField
          value={filters.integrity}
          label="Filter by integrity checks"
          options={integrityOptions}
          onChange={(integrity) => onChange({ integrity })}
        />

        <ResetButton disabled={!active} onClick={onReset} />

        <ExportButton
          label="Export packages"
          disabled={filtered.length === 0}
          onExport={() =>
            exportRowsAsCsv(
              "Conclusion packages",
              filtered,
              RELEASE_COLUMNS
            )
          }
        />

        <button
          type="button"
          className="ui-icon-text-button"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            size={14}
            className={refreshing ? "ui-spin" : undefined}
            aria-hidden="true"
          />
          Refresh
        </button>
      </Toolbar>

      <div className="ui-chips-row">
        <ChipGroup
          value={filters.status}
          label="Filter by package status"
          options={statusOptions}
          onChange={(status) => onChange({ status })}
        />
      </div>

      <SavedViews<ReleaseFilters>
        storageKey="fcg.views.release"
        current={filters}
        canSave={active}
        onApply={(value) =>
          onApply(sanitizeReleaseFilters(value))
        }
      />

      <ResultCount
        shown={filtered.length}
        total={packages.length}
        noun="conclusion packages"
        filtered={active}
      />
    </div>
  );
}

/**
 * The conditions for a decision on one package, each stated in
 * words with "met" or "not met" (never colour alone).
 */
export function ChecklistList({
  checks,
  heading,
}: {
  checks: readonly PackageCheck[];
  heading: string;
}) {
  const failed = checks.filter((check) => !check.ok).length;

  return (
    <div className="ui-ev-checklist">
      <p className="ui-ev-checklist-title">
        {heading}
        {": "}
        {failed === 0
          ? "all conditions met"
          : `${failed} not met`}
      </p>

      <ul>
        {checks.map((check) => (
          <li
            key={check.key}
            className={
              check.ok
                ? "ui-ev-check ui-ev-check-ok"
                : "ui-ev-check ui-ev-check-fail"
            }
          >
            {check.ok ? (
              <CheckCircle2 size={13} aria-hidden="true" />
            ) : (
              <ShieldAlert size={13} aria-hidden="true" />
            )}

            <span>
              {check.label}
              {": "}
              <b>{check.ok ? "met" : "not met"}</b>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The decision controls of one pending package: its checklist and
 * the Reject and Release buttons. Both decisions are final, so each
 * asks once more before it calls the backend.
 */
export function PendingReview({
  item,
  canRelease,
  username,
  reviewNote,
  action,
  onDecide,
}: {
  item: InvestigationConclusionPackage;
  canRelease: boolean;
  username: string;
  reviewNote: string;
  /** Key of the action running on the screen, or null. */
  action: string | null;
  onDecide: (packageId: string, decision: string) => Promise<void>;
}) {
  const checks = releaseChecklist(item, {
    canRelease,
    username,
    reviewNote,
  });

  const busy = action !== null;

  return (
    <>
      <ChecklistList checks={checks} heading="Release checklist" />

      <div className="conclusion-package-actions">
        <ConfirmButton
          className="secondary-button"
          confirmLabel="Yes, reject"
          disabled={busy || !canReject(checks)}
          onConfirm={() => void onDecide(item.id, "REJECTED")}
        >
          <XCircle size={12} aria-hidden="true" />

          {action === `review:${item.id}:REJECTED`
            ? "Rejecting..."
            : "Reject"}
        </ConfirmButton>

        <ConfirmButton
          className="primary-button"
          confirmLabel="Yes, release"
          disabled={busy || !canReleaseChecks(checks)}
          onConfirm={() => void onDecide(item.id, "RELEASED")}
        >
          <CheckCircle2 size={12} aria-hidden="true" />

          {action === `review:${item.id}:RELEASED`
            ? "Releasing..."
            : "Release"}
        </ConfirmButton>
      </div>
    </>
  );
}
