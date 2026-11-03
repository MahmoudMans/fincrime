"use client";

import { RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { exportRowsAsCsv } from "@/lib/csv";
import { ALL, dataOptions, uniqueSorted } from "@/lib/ev-common";
import {
  REVIEW_ROW_COLUMNS,
  REVIEW_STATES,
  reviewFacetCounts,
  reviewFiltersActive,
  reviewStateLabel,
  sanitizeReviewFilters,
  type ReviewFilters,
  type ReviewRow,
  type ReviewState,
} from "@/lib/ev-review";
import { humanize } from "@/lib/format";

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
import { StackedBar, type Segment } from "./mini-charts";

const STATE_TONES: Record<ReviewState, Option<string>["tone"]> = {
  ACCEPTED_FOR_ANALYSIS: "ok",
  QUESTIONED: "warning",
  EXCLUDED: "danger",
  OUTDATED: "info",
  NOT_REVIEWED: undefined,
};

const SEGMENT_TONES: Record<ReviewState, Segment["tone"]> = {
  ACCEPTED_FOR_ANALYSIS: "ok",
  QUESTIONED: "warning",
  EXCLUDED: "danger",
  OUTDATED: "info",
  NOT_REVIEWED: "neutral",
};

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce(
    (total, value) => total + value,
    0
  );
}

/** How much of the evidence has a current review, and of what kind. */
export function ReviewCoverage({
  rows,
}: {
  rows: readonly ReviewRow[];
}) {
  const segments: Segment[] = REVIEW_STATES.map((state) => ({
    key: state,
    label: reviewStateLabel(state),
    value: rows.filter((row) => row.state === state).length,
    tone: SEGMENT_TONES[state],
  }));

  return (
    <div className="ui-ev-coverage">
      <h3 className="ui-ev-coverage-title">Review coverage</h3>

      <StackedBar
        segments={segments}
        label="Evidence by review state"
      />
    </div>
  );
}

/** Search, review-state chips with counts, saved views, export. */
export function ReviewFilterBar({
  rows,
  filters,
  filtered,
  refreshing,
  onChange,
  onReset,
  onApply,
  onRefresh,
}: {
  rows: readonly ReviewRow[];
  filters: ReviewFilters;
  filtered: readonly ReviewRow[];
  refreshing: boolean;
  onChange: (patch: Partial<ReviewFilters>) => void;
  onReset: () => void;
  onApply: (filters: ReviewFilters) => void;
  onRefresh: () => void;
}) {
  const active = reviewFiltersActive(filters);

  const stateCounts = useMemo(
    () => reviewFacetCounts(rows, filters, "state"),
    [rows, filters]
  );

  const statusCounts = useMemo(
    () => reviewFacetCounts(rows, filters, "status"),
    [rows, filters]
  );

  const stateOptions: Option<string>[] = [
    {
      value: ALL,
      label: "All",
      count: sum(stateCounts),
    },
    ...REVIEW_STATES.map((state) => ({
      value: state,
      label: reviewStateLabel(state),
      count: stateCounts[state] ?? 0,
      tone: STATE_TONES[state],
    })),
  ];

  const statusOptions = dataOptions(
    uniqueSorted(rows.map((row) => row.evidence.currentStatus)),
    filters.status,
    "All custody statuses",
    statusCounts,
    sum(statusCounts),
    humanize
  );

  return (
    <div className="ui-ev-filters">
      <Toolbar label="Filter evidence reviews">
        <SearchField
          value={filters.q}
          label="Search evidence reviews"
          placeholder="Search reference, case, title, reviewer..."
          onChange={(q) => onChange({ q })}
        />

        <SelectField
          value={filters.status}
          label="Filter by custody status"
          options={statusOptions}
          onChange={(status) => onChange({ status })}
        />

        <ResetButton disabled={!active} onClick={onReset} />

        <ExportButton
          label="Export reviews"
          disabled={filtered.length === 0}
          onExport={() =>
            exportRowsAsCsv(
              "Evidence reviews",
              filtered,
              REVIEW_ROW_COLUMNS
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
          value={filters.state}
          label="Filter by review state"
          options={stateOptions}
          onChange={(state) => onChange({ state })}
        />
      </div>

      <SavedViews<ReviewFilters>
        storageKey="fcg.views.evidence-review"
        current={filters}
        canSave={active}
        onApply={(value) =>
          onApply(sanitizeReviewFilters(value))
        }
      />

      <ResultCount
        shown={filtered.length}
        total={rows.length}
        noun="evidence records"
        filtered={active}
      />
    </div>
  );
}
