"use client";

import { useMemo, type ReactNode } from "react";

import type { WatchlistScreeningHit } from "@/lib/api";
import { humanize } from "@/lib/format";
import { plural } from "@/lib/list-utils";
import {
  allOptions,
  distinct,
} from "@/lib/wf-common";
import {
  DEFAULT_HIT_FILTERS,
  HIT_SORTS,
  HIT_STATUSES,
  hitFacetCounts,
  isDefaultHitFilters,
  normalizeHitFilters,
  type HitCountry,
  type HitFilters,
  type HitStrength,
} from "@/lib/wf-watchlist";

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

const STATUS_TONES: Record<string, Option<string>["tone"]> = {
  PENDING_REVIEW: "warning",
  ESCALATED: "danger",
  CLEARED: "ok",
};

/**
 * Search, filters, sort, saved views, export and result count for the
 * hits of one screening run.
 */
export function HitTools({
  hits,
  filters,
  shown,
  note,
  onChange,
  onApply,
  onExport,
}: {
  hits: readonly WatchlistScreeningHit[];
  filters: HitFilters;
  /** Rows matching the filters. */
  shown: number;
  note?: ReactNode;
  onChange: (patch: Partial<HitFilters>) => void;
  /** Replaces every filter at once (Reset, saved views). */
  onApply: (filters: HitFilters) => void;
  onExport: () => void;
}) {
  const statusCounts = useMemo(
    () => hitFacetCounts(hits, filters, "status"),
    [hits, filters]
  );

  const strengthCounts = useMemo(
    () => hitFacetCounts(hits, filters, "strength"),
    [hits, filters]
  );

  const categoryCounts = useMemo(
    () => hitFacetCounts(hits, filters, "category"),
    [hits, filters]
  );

  const countryCounts = useMemo(
    () => hitFacetCounts(hits, filters, "country"),
    [hits, filters]
  );

  const statusOptions = useMemo<Option<string>[]>(
    () =>
      allOptions(
        "All",
        distinct([
          ...HIT_STATUSES,
          ...hits.map((hit) => hit.status),
        ]),
        statusCounts,
        humanize
      ).map((option) => ({
        ...option,
        tone: STATUS_TONES[option.value],
      })),
    [hits, statusCounts]
  );

  const categoryOptions = useMemo(
    () =>
      allOptions(
        "All categories",
        distinct(hits.map((hit) => hit.category)).sort(),
        categoryCounts,
        humanize
      ),
    [hits, categoryCounts]
  );

  const strengthOptions: Option<HitStrength>[] = [
    {
      value: "ALL",
      label: "Any match strength",
      count: strengthCounts.ALL,
    },
    {
      value: "critical",
      label: "Critical (95+)",
      count: strengthCounts.critical ?? 0,
    },
    {
      value: "high",
      label: "High (85 to 94)",
      count: strengthCounts.high ?? 0,
    },
    {
      value: "medium",
      label: "Medium (below 85)",
      count: strengthCounts.medium ?? 0,
    },
  ];

  const countryOptions: Option<HitCountry>[] = [
    {
      value: "ALL",
      label: "Any country signal",
      count: countryCounts.ALL,
    },
    {
      value: "MATCH",
      label: "Same country",
      count: countryCounts.MATCH,
    },
    {
      value: "DIFFERENT",
      label: "Different country",
      count: countryCounts.DIFFERENT,
    },
  ];

  const isFiltered = !isDefaultHitFilters(filters);

  return (
    <>
      <Toolbar label="Filter screening hits">
        <SearchField
          label="Search screening hits"
          placeholder="Search customer or watchlist..."
          value={filters.q}
          onChange={(q) => onChange({ q })}
        />

        <ChipGroup
          label="Filter by review status"
          value={filters.status}
          options={statusOptions}
          onChange={(status) => onChange({ status })}
        />

        <SelectField
          label="Filter by match strength"
          value={filters.strength}
          options={strengthOptions}
          onChange={(strength) => onChange({ strength })}
        />

        <SelectField
          label="Filter by watchlist category"
          value={filters.category}
          options={categoryOptions}
          onChange={(category) => onChange({ category })}
        />

        <SelectField
          label="Filter by country signal"
          value={filters.country}
          options={countryOptions}
          onChange={(country) => onChange({ country })}
        />

        <SelectField
          label="Sort screening hits"
          value={filters.sort}
          options={HIT_SORTS}
          onChange={(sort) => onChange({ sort })}
        />

        <span className="ui-tools-spacer" />

        <ResetButton
          disabled={!isFiltered}
          onClick={() => onApply(DEFAULT_HIT_FILTERS)}
        />

        <ExportButton disabled={shown === 0} onExport={onExport} />
      </Toolbar>

      <SavedViews
        storageKey="fcg.views.watchlist"
        current={filters}
        canSave={isFiltered}
        onApply={(view) => onApply(normalizeHitFilters(view))}
      />

      <div className="ui-wf-count-row">
        <ResultCount
          shown={shown}
          total={hits.length}
          noun={plural(hits.length, "hit")}
          filtered={isFiltered}
        />

        {note}
      </div>
    </>
  );
}
