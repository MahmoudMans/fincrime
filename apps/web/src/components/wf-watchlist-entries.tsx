"use client";

import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import type { WatchlistEntry } from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  formatDate,
  formatDateTime,
  humanize,
} from "@/lib/format";
import {
  clampPage,
  paginate,
  plural,
} from "@/lib/list-utils";
import {
  allOptions,
  distinct,
  rankSort,
} from "@/lib/wf-common";
import {
  DEFAULT_ENTRY_FILTERS,
  ENTRY_CSV_COLUMNS,
  ENTRY_SORTS,
  RISK_LEVEL_ORDER,
  entryFacetCounts,
  filterEntries,
  isDefaultEntryFilters,
  normalizeEntryFilters,
  sortEntries,
  type EntryActive,
  type EntryFilters,
} from "@/lib/wf-watchlist";

import {
  ChipGroup,
  ExportButton,
  Pager,
  ResetButton,
  ResultCount,
  SavedViews,
  SearchField,
  SelectField,
  Toolbar,
  type Option,
} from "./list-tools";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./state-card";

const PAGE_SIZE = 15;

const NO_ENTRIES: readonly WatchlistEntry[] = [];

/**
 * The watchlist records screening runs compare customers with, as a
 * searchable, filterable table. Collapsed until opened.
 */
export function WatchlistEntries({
  entries,
  error,
  loading,
  onRetry,
}: {
  /** Null until the entries have loaded. */
  entries: readonly WatchlistEntry[] | null;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}) {
  const [filters, setFilters] = useState<EntryFilters>(
    DEFAULT_ENTRY_FILTERS
  );

  const [page, setPage] = useState(0);

  const rows = entries ?? NO_ENTRIES;

  const filtered = useMemo(
    () => sortEntries(filterEntries(rows, filters), filters.sort),
    [rows, filters]
  );

  const safePage = clampPage(page, filtered.length, PAGE_SIZE);

  const pageRows = paginate(filtered, safePage, PAGE_SIZE);

  const categoryCounts = useMemo(
    () => entryFacetCounts(rows, filters, "category"),
    [rows, filters]
  );

  const riskCounts = useMemo(
    () => entryFacetCounts(rows, filters, "risk"),
    [rows, filters]
  );

  const activeCounts = useMemo(
    () => entryFacetCounts(rows, filters, "active"),
    [rows, filters]
  );

  const categoryOptions = useMemo(
    () =>
      allOptions(
        "All categories",
        distinct(rows.map((entry) => entry.category)).sort(),
        categoryCounts,
        humanize
      ),
    [rows, categoryCounts]
  );

  const riskOptions = useMemo(
    () =>
      allOptions(
        "All risk levels",
        rankSort(
          distinct(rows.map((entry) => entry.riskLevel)),
          RISK_LEVEL_ORDER
        ),
        riskCounts,
        humanize
      ),
    [rows, riskCounts]
  );

  const activeOptions: Option<EntryActive>[] = [
    { value: "ALL", label: "All", count: activeCounts.ALL },
    { value: "ACTIVE", label: "Active", count: activeCounts.ACTIVE },
    {
      value: "INACTIVE",
      label: "Inactive",
      count: activeCounts.INACTIVE,
    },
  ];

  const isFiltered = !isDefaultEntryFilters(filters);

  function update(patch: Partial<EntryFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  function apply(next: EntryFilters) {
    setFilters(next);
    setPage(0);
  }

  return (
    <details className="ui-wf-details">
      <summary>
        Watchlist entries
        {entries ? ` (${entries.length.toLocaleString()})` : ""}
      </summary>

      {error && (
        <ErrorState
          compact
          title="Unable to load watchlist entries"
          message={error}
          onRetry={onRetry}
        />
      )}

      {!error && !entries && (
        <LoadingState compact label="Loading watchlist entries" />
      )}

      {entries && entries.length === 0 && (
        <EmptyState
          compact
          title="No watchlist entries"
          message="Nothing has been loaded into the watchlist yet."
        />
      )}

      {entries && entries.length > 0 && (
        <>
          <Toolbar label="Filter watchlist entries">
            <SearchField
              label="Search watchlist entries"
              placeholder="Search name, alias or list key..."
              value={filters.q}
              onChange={(q) => update({ q })}
            />

            <ChipGroup
              label="Filter by entry state"
              value={filters.active}
              options={activeOptions}
              onChange={(active) => update({ active })}
            />

            <SelectField
              label="Filter entries by category"
              value={filters.category}
              options={categoryOptions}
              onChange={(category) => update({ category })}
            />

            <SelectField
              label="Filter entries by risk level"
              value={filters.risk}
              options={riskOptions}
              onChange={(risk) => update({ risk })}
            />

            <SelectField
              label="Sort watchlist entries"
              value={filters.sort}
              options={ENTRY_SORTS}
              onChange={(sort) => update({ sort })}
            />

            <span className="ui-tools-spacer" />

            <ResetButton
              disabled={!isFiltered}
              onClick={() => apply(DEFAULT_ENTRY_FILTERS)}
            />

            <button
              type="button"
              className="ui-icon-text-button"
              disabled={loading}
              onClick={onRetry}
            >
              <RefreshCw
                size={14}
                className={loading ? "ui-spin" : undefined}
                aria-hidden="true"
              />
              Refresh
            </button>

            <ExportButton
              disabled={filtered.length === 0}
              onExport={() =>
                exportRowsAsCsv(
                  "Watchlist entries",
                  filtered,
                  ENTRY_CSV_COLUMNS
                )
              }
            />
          </Toolbar>

          <SavedViews
            storageKey="fcg.views.watchlist-entries"
            current={filters}
            canSave={isFiltered}
            onApply={(view) => apply(normalizeEntryFilters(view))}
          />

          <div className="ui-wf-count-row">
            <ResultCount
              shown={filtered.length}
              total={entries.length}
              noun={plural(entries.length, "entry", "entries")}
              filtered={isFiltered}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              compact
              title="No entries match these filters"
              message="Try a different search or clear the filters."
              action={
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => apply(DEFAULT_ENTRY_FILTERS)}
                >
                  Reset filters
                </button>
              }
            />
          ) : (
            <div className="ui-wf-table-wrap">
              <table className="ui-wf-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">List key</th>
                    <th scope="col">Country</th>
                    <th scope="col">Category</th>
                    <th scope="col">Risk level</th>
                    <th scope="col">Source</th>
                    <th scope="col">State</th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>

                <tbody>
                  {pageRows.map((entry) => (
                    <tr key={entry.id}>
                      <th scope="row">
                        {entry.fullName}

                        {entry.aliases && (
                          <span className="ui-wf-muted">
                            aka {entry.aliases}
                          </span>
                        )}
                      </th>
                      <td>{entry.listKey}</td>
                      <td>{entry.countryCode ?? "—"}</td>
                      <td>{humanize(entry.category)}</td>
                      <td>{humanize(entry.riskLevel)}</td>
                      <td>
                        {entry.sourceName}

                        <span className="ui-wf-muted">
                          {entry.sourceReference}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            entry.active
                              ? "ui-wf-pill ui-wf-pill-ok"
                              : "ui-wf-pill"
                          }
                        >
                          {entry.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td title={`${formatDateTime(entry.updatedAt)} UTC`}>
                        {formatDate(entry.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pager
            label="Watchlist entry pages"
            page={safePage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPage={setPage}
          />
        </>
      )}
    </details>
  );
}
