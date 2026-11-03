"use client";

import { RefreshCw } from "lucide-react";
import { useMemo } from "react";

import type { InvestigationFinding } from "@/lib/api";
import { humanize } from "@/lib/format";
import { plural } from "@/lib/list-utils";
import {
  allOptions,
  distinct,
  rankSort,
} from "@/lib/wf-common";
import {
  DEFAULT_FINDING_FILTERS,
  FINDING_SORTS,
  FINDING_STATUSES,
  findingFacetCounts,
  isDefaultFindingFilters,
  normalizeFindingFilters,
  type FindingFilters,
  type FindingLineage,
} from "@/lib/wf-findings";

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

const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const STATUS_TONES: Record<string, Option<string>["tone"]> = {
  PENDING: "warning",
  APPROVED: "ok",
  REJECTED: "danger",
};

/** Search, filters, sort, saved views, export and result count. */
export function FindingTools({
  findings,
  filters,
  shown,
  loading,
  onChange,
  onApply,
  onReload,
  onExport,
}: {
  findings: readonly InvestigationFinding[];
  filters: FindingFilters;
  /** Rows matching the filters. */
  shown: number;
  loading: boolean;
  onChange: (patch: Partial<FindingFilters>) => void;
  /** Replaces every filter at once (Reset, saved views). */
  onApply: (filters: FindingFilters) => void;
  onReload: () => void;
  onExport: () => void;
}) {
  const statusCounts = useMemo(
    () => findingFacetCounts(findings, filters, "status"),
    [findings, filters]
  );

  const priorityCounts = useMemo(
    () => findingFacetCounts(findings, filters, "priority"),
    [findings, filters]
  );

  const lineageCounts = useMemo(
    () => findingFacetCounts(findings, filters, "lineage"),
    [findings, filters]
  );

  const statusOptions = useMemo<Option<string>[]>(
    () =>
      allOptions(
        "All",
        distinct([
          ...FINDING_STATUSES,
          ...findings.map((item) => item.status),
        ]),
        statusCounts,
        humanize
      ).map((option) => ({
        ...option,
        tone: STATUS_TONES[option.value],
      })),
    [findings, statusCounts]
  );

  const priorityOptions = useMemo(
    () =>
      allOptions(
        "All case priorities",
        rankSort(
          distinct(findings.map((item) => item.casePriority)),
          PRIORITY_ORDER
        ),
        priorityCounts,
        humanize
      ),
    [findings, priorityCounts]
  );

  const lineageOptions: Option<FindingLineage>[] = [
    {
      value: "ALL",
      label: "Any evidence lineage",
      count: lineageCounts.ALL,
    },
    {
      value: "CURRENT",
      label: "Lineage current",
      count: lineageCounts.CURRENT,
    },
    {
      value: "HISTORICAL",
      label: "Historical lineage",
      count: lineageCounts.HISTORICAL,
    },
  ];

  const isFiltered = !isDefaultFindingFilters(filters);

  return (
    <>
      <Toolbar label="Filter investigation findings">
        <SearchField
          label="Search findings"
          placeholder="Search reference, title or case..."
          value={filters.q}
          onChange={(q) => onChange({ q })}
        />

        <ChipGroup
          label="Filter by finding status"
          value={filters.status}
          options={statusOptions}
          onChange={(status) => onChange({ status })}
        />

        <SelectField
          label="Filter by case priority"
          value={filters.priority}
          options={priorityOptions}
          onChange={(priority) => onChange({ priority })}
        />

        <SelectField
          label="Filter by evidence lineage"
          value={filters.lineage}
          options={lineageOptions}
          onChange={(lineage) => onChange({ lineage })}
        />

        <SelectField
          label="Sort findings"
          value={filters.sort}
          options={FINDING_SORTS}
          onChange={(sort) => onChange({ sort })}
        />

        <span className="ui-tools-spacer" />

        <ResetButton
          disabled={!isFiltered}
          onClick={() => onApply(DEFAULT_FINDING_FILTERS)}
        />

        <button
          type="button"
          className="ui-icon-text-button"
          disabled={loading}
          onClick={onReload}
        >
          <RefreshCw
            size={14}
            className={loading ? "ui-spin" : undefined}
            aria-hidden="true"
          />
          Refresh
        </button>

        <ExportButton disabled={shown === 0} onExport={onExport} />
      </Toolbar>

      <SavedViews
        storageKey="fcg.views.findings"
        current={filters}
        canSave={isFiltered}
        onApply={(view) => onApply(normalizeFindingFilters(view))}
      />

      <div className="ui-wf-count-row">
        <ResultCount
          shown={shown}
          total={findings.length}
          noun={plural(findings.length, "finding")}
          filtered={isFiltered}
        />
      </div>
    </>
  );
}
