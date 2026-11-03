"use client";

import { RefreshCw } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { InvestigationTriageQueueItem } from "@/lib/api";
import { humanize } from "@/lib/format";
import { plural } from "@/lib/list-utils";
import {
  allOptions,
  distinct,
  rankSort,
} from "@/lib/wf-common";
import {
  DEFAULT_TRIAGE_FILTERS,
  TRIAGE_BANDS,
  TRIAGE_SORTS,
  isDefaultTriageFilters,
  normalizeTriageFilters,
  triageFacetCounts,
  type TriageFilters,
  type TriageOwnerFilter,
  type TriageSort,
} from "@/lib/wf-triage";

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

const BAND_TONES: Record<string, Option<string>["tone"]> = {
  URGENT: "danger",
  HIGH: "warning",
  ROUTINE: "ok",
};

/**
 * Search, filters, sort, saved views, export and the result count for
 * the triage queue. The screen owns the filter state.
 */
export function TriageTools({
  queue,
  filters,
  username,
  hasCaseAges,
  shown,
  loading,
  note,
  onChange,
  onApply,
  onReload,
  onExport,
}: {
  queue: readonly InvestigationTriageQueueItem[];
  filters: TriageFilters;
  username: string;
  /** False when the cases list (case creation times) did not load. */
  hasCaseAges: boolean;
  /** Rows matching the filters. */
  shown: number;
  loading: boolean;
  note?: ReactNode;
  onChange: (patch: Partial<TriageFilters>) => void;
  /** Replaces every filter at once (Reset, saved views). */
  onApply: (filters: TriageFilters) => void;
  onReload: () => void;
  onExport: () => void;
}) {
  const bandCounts = useMemo(
    () => triageFacetCounts(queue, filters, username, "band"),
    [queue, filters, username]
  );

  const ownerCounts = useMemo(
    () => triageFacetCounts(queue, filters, username, "owner"),
    [queue, filters, username]
  );

  const statusCounts = useMemo(
    () => triageFacetCounts(queue, filters, username, "status"),
    [queue, filters, username]
  );

  const priorityCounts = useMemo(
    () => triageFacetCounts(queue, filters, username, "priority"),
    [queue, filters, username]
  );

  const bandOptions = useMemo<Option<string>[]>(
    () =>
      allOptions(
        "All",
        distinct([
          ...TRIAGE_BANDS,
          ...queue.map((item) => item.triageBand),
        ]),
        bandCounts,
        humanize
      ).map((option) => ({
        ...option,
        tone: BAND_TONES[option.value],
      })),
    [queue, bandCounts]
  );

  const ownerOptions: Option<TriageOwnerFilter>[] = [
    { value: "ALL", label: "Everyone", count: ownerCounts.ALL },
    {
      value: "MINE",
      label: "Assigned to me",
      count: ownerCounts.MINE,
    },
    {
      value: "UNASSIGNED",
      label: "Unassigned",
      count: ownerCounts.UNASSIGNED,
    },
    {
      value: "OTHERS",
      label: "Assigned to others",
      count: ownerCounts.OTHERS,
    },
  ];

  const statusOptions = useMemo(
    () =>
      allOptions(
        "All statuses",
        distinct(queue.map((item) => item.caseStatus)).sort(),
        statusCounts,
        humanize
      ),
    [queue, statusCounts]
  );

  const priorityOptions = useMemo(
    () =>
      allOptions(
        "All priorities",
        rankSort(
          distinct(queue.map((item) => item.casePriority)),
          PRIORITY_ORDER
        ),
        priorityCounts,
        humanize
      ),
    [queue, priorityCounts]
  );

  const sortOptions: Option<TriageSort>[] = TRIAGE_SORTS.map(
    (option) => ({
      value: option.value,
      label:
        option.value === "oldest" && !hasCaseAges
          ? "Oldest case first (ages not loaded)"
          : option.label,
    })
  );

  const isFiltered = !isDefaultTriageFilters(filters);

  return (
    <>
      <Toolbar label="Filter the triage queue">
        <SearchField
          label="Search triage queue"
          placeholder="Search case, explanation or owner..."
          value={filters.q}
          onChange={(q) => onChange({ q })}
        />

        <ChipGroup
          label="Filter by triage band"
          value={filters.band}
          options={bandOptions}
          onChange={(band) => onChange({ band })}
        />

        <ChipGroup
          label="Filter by owner"
          value={filters.owner}
          options={ownerOptions}
          onChange={(owner) => onChange({ owner })}
        />

        <SelectField
          label="Filter by case status"
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
          label="Sort the queue"
          value={filters.sort}
          options={sortOptions}
          onChange={(sort) => onChange({ sort })}
        />

        <span className="ui-tools-spacer" />

        <ResetButton
          disabled={!isFiltered}
          onClick={() => onApply(DEFAULT_TRIAGE_FILTERS)}
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
        storageKey="fcg.views.triage"
        current={filters}
        canSave={isFiltered}
        onApply={(view) => onApply(normalizeTriageFilters(view))}
      />

      <div className="ui-wf-count-row">
        <ResultCount
          shown={shown}
          total={queue.length}
          noun={plural(queue.length, "case")}
          filtered={isFiltered}
        />

        {note}
      </div>
    </>
  );
}
