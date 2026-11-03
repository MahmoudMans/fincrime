"use client";

import {
  CheckCircle2,
  History,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  SecurityAuditEvent,
  SecurityAuditLedgerVerification,
} from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  AUDIT_COLUMNS,
  AUDIT_EVENT_LIMIT,
  auditFacetCounts,
  auditFacetValues,
  auditFiltersActive,
  DEFAULT_AUDIT_FILTERS,
  dateRangeProblem,
  filterAudit,
  HISTORY_COLUMNS,
  historyMatches,
  historyNewestFirst,
  newestFirst,
  sanitizeAuditFilters,
  type AuditFilters,
  type HistoryFilter,
} from "@/lib/ev-audit";
import { ALL, dataOptions } from "@/lib/ev-common";
import {
  formatDateTime,
  humanize,
  shortHash,
} from "@/lib/format";
import {
  clampPage,
  countBy,
  paginate,
} from "@/lib/list-utils";

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

const EVENT_PAGE_SIZE = 20;

const HISTORY_PAGE_SIZE = 5;

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce(
    (total, value) => total + value,
    0
  );
}

/**
 * Security events: search, actor / action / outcome / date range
 * filters with counts, saved views, paging and a CSV of what the
 * filters show.
 */
export function AuditEventsCard({
  events,
  loading,
  error,
  onRetry,
}: {
  /** Null until the first load has finished. */
  events: readonly SecurityAuditEvent[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [filters, setFilters] = useState<AuditFilters>(
    DEFAULT_AUDIT_FILTERS
  );

  const [page, setPage] = useState(0);

  const ordered = useMemo(
    () => newestFirst(events ?? []),
    [events]
  );

  const filtered = useMemo(
    () => filterAudit(ordered, filters),
    [ordered, filters]
  );

  const active = auditFiltersActive(filters);

  const rangeProblem = dateRangeProblem(filters);

  const actorCounts = useMemo(
    () => auditFacetCounts(ordered, filters, "actor"),
    [ordered, filters]
  );

  const actionCounts = useMemo(
    () => auditFacetCounts(ordered, filters, "action"),
    [ordered, filters]
  );

  const outcomeCounts = useMemo(
    () => auditFacetCounts(ordered, filters, "outcome"),
    [ordered, filters]
  );

  const actorOptions = dataOptions(
    auditFacetValues(ordered, "actor"),
    filters.actor,
    "All actors",
    actorCounts,
    sum(actorCounts)
  );

  const actionOptions = dataOptions(
    auditFacetValues(ordered, "action"),
    filters.action,
    "All actions",
    actionCounts,
    sum(actionCounts),
    humanize
  );

  const outcomeOptions: Option<string>[] = dataOptions(
    auditFacetValues(ordered, "outcome"),
    filters.outcome,
    "All",
    outcomeCounts,
    sum(outcomeCounts),
    humanize
  ).map((option) => ({
    ...option,
    tone:
      option.value === ALL
        ? undefined
        : option.value === "SUCCESS"
          ? "ok"
          : "danger",
  }));

  const safePage = clampPage(
    page,
    filtered.length,
    EVENT_PAGE_SIZE
  );

  const shown = paginate(filtered, safePage, EVENT_PAGE_SIZE);

  function update(patch: Partial<AuditFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  function reset() {
    setFilters(DEFAULT_AUDIT_FILTERS);
    setPage(0);
  }

  return (
    <div className="audit-ledger-card ui-ev-events" aria-busy={loading}>
      <div className="audit-ledger-card-heading">
        <div>
          <History size={14} aria-hidden="true" />

          <strong>Security events</strong>
        </div>

        <span>
          {events === null
            ? "Loading"
            : `${ordered.length} ${
                ordered.length === 1 ? "event" : "events"
              }`}
        </span>
      </div>

      {events !== null && ordered.length >= AUDIT_EVENT_LIMIT && (
        <div className="ui-notice" role="status">
          <ShieldAlert size={15} aria-hidden="true" />

          <span>
            The audit API lists the {AUDIT_EVENT_LIMIT} most recent
            events. Older events are still covered by the ledger
            but are not shown here.
          </span>
        </div>
      )}

      {events !== null && (
        <>
          <Toolbar label="Filter security events">
            <SearchField
              value={filters.q}
              label="Search security events"
              placeholder="Search actor, action, resource, detail..."
              onChange={(q) => update({ q })}
            />

            <SelectField
              value={filters.actor}
              label="Filter by actor"
              options={actorOptions}
              onChange={(actor) => update({ actor })}
            />

            <SelectField
              value={filters.action}
              label="Filter by action"
              options={actionOptions}
              onChange={(action) => update({ action })}
            />

            <label className="ui-ev-date">
              <span>From</span>

              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) =>
                  update({ from: event.target.value })
                }
              />
            </label>

            <label className="ui-ev-date">
              <span>To</span>

              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) =>
                  update({ to: event.target.value })
                }
              />
            </label>

            <ResetButton disabled={!active} onClick={reset} />

            <ExportButton
              label="Export events"
              disabled={filtered.length === 0}
              onExport={() =>
                exportRowsAsCsv(
                  "Security audit events",
                  filtered,
                  AUDIT_COLUMNS
                )
              }
            />
          </Toolbar>

          <div className="ui-chips-row">
            <ChipGroup
              value={filters.outcome}
              label="Filter by outcome"
              options={outcomeOptions}
              onChange={(outcome) => update({ outcome })}
            />
          </div>

          <SavedViews<AuditFilters>
            storageKey="fcg.views.audit"
            current={filters}
            canSave={active}
            onApply={(value) => {
              setFilters(sanitizeAuditFilters(value));
              setPage(0);
            }}
          />

          {rangeProblem && (
            <p className="ui-ev-hint ui-ev-hint-warn" role="alert">
              {rangeProblem}
            </p>
          )}

          <ResultCount
            shown={filtered.length}
            total={ordered.length}
            noun="security events"
            filtered={active}
          />
        </>
      )}

      {error && (
        <ErrorState
          compact
          title="Unable to load the security events"
          message={error}
          onRetry={onRetry}
        />
      )}

      {!error && events === null && (
        <LoadingState compact label="Loading security events" />
      )}

      {!error && events !== null && ordered.length === 0 && (
        <EmptyState
          compact
          title="No security events recorded"
          message="Sign-ins and governed actions appear here as they happen."
        />
      )}

      {!error && ordered.length > 0 && filtered.length === 0 && (
        <EmptyState
          compact
          title="No events match these filters"
          message="Try a different search, widen the date range or clear the filters."
          action={
            <button
              type="button"
              className="secondary-button"
              onClick={reset}
            >
              Reset filters
            </button>
          }
        />
      )}

      {filtered.length > 0 && (
        <div
          className={
            loading
              ? "ui-ev-table-wrap ui-list-loading"
              : "ui-ev-table-wrap"
          }
        >
          <table className="ui-ev-table">
            <caption className="ui-visually-hidden">
              Security audit events, newest first
            </caption>

            <thead>
              <tr>
                <th scope="col">Time (UTC)</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Resource</th>
                <th scope="col">Outcome</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>

            <tbody>
              {shown.map((event) => (
                <tr key={event.id}>
                  <td className="ui-ev-nowrap">
                    <time dateTime={event.occurredAt}>
                      {formatDateTime(event.occurredAt)}
                    </time>
                  </td>

                  <td>{event.username}</td>

                  <td>{humanize(event.action)}</td>

                  <td>
                    {humanize(event.resourceType)}

                    {event.resourceId && (
                      <code
                        className="ui-ev-resource"
                        title={event.resourceId}
                      >
                        {shortHash(event.resourceId, 10)}
                      </code>
                    )}
                  </td>

                  <td>
                    <span
                      className={
                        event.outcome === "SUCCESS"
                          ? "ui-ev-outcome ui-ev-outcome-ok"
                          : "ui-ev-outcome ui-ev-outcome-fail"
                      }
                    >
                      {event.outcome === "SUCCESS" ? (
                        <CheckCircle2
                          size={12}
                          aria-hidden="true"
                        />
                      ) : (
                        <ShieldAlert
                          size={12}
                          aria-hidden="true"
                        />
                      )}

                      {humanize(event.outcome)}
                    </span>
                  </td>

                  <td className="ui-ev-detail">{event.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        page={safePage}
        pageSize={EVENT_PAGE_SIZE}
        total={filtered.length}
        label="Security event pages"
        onPage={setPage}
      />
    </div>
  );
}

/** Verification runs of the ledger: filter, page, export. */
export function VerificationHistoryCard({
  history,
}: {
  history: readonly SecurityAuditLedgerVerification[];
}) {
  const [filter, setFilter] = useState<HistoryFilter>("ALL");

  const [page, setPage] = useState(0);

  const ordered = useMemo(
    () => historyNewestFirst(history),
    [history]
  );

  const filtered = useMemo(
    () => ordered.filter((entry) => historyMatches(entry, filter)),
    [ordered, filter]
  );

  const counts = countBy(ordered, (entry) =>
    entry.integrityValid ? "VERIFIED" : "ATTENTION"
  );

  const options: Option<HistoryFilter>[] = [
    { value: "ALL", label: "All", count: ordered.length },
    {
      value: "VERIFIED",
      label: "Verified",
      count: counts.VERIFIED ?? 0,
      tone: "ok",
    },
    {
      value: "ATTENTION",
      label: "Attention",
      count: counts.ATTENTION ?? 0,
      tone: "danger",
    },
  ];

  const safePage = clampPage(
    page,
    filtered.length,
    HISTORY_PAGE_SIZE
  );

  const shown = paginate(filtered, safePage, HISTORY_PAGE_SIZE);

  return (
    <div className="audit-ledger-card">
      <div className="audit-ledger-card-heading">
        <div>
          <History size={14} aria-hidden="true" />

          <strong>Verification history</strong>
        </div>

        <span>
          {filter === "ALL"
            ? ordered.length
            : `${filtered.length} of ${ordered.length}`}
          {" checks"}
        </span>
      </div>

      {ordered.length > 0 && (
        <div className="ui-ev-history-tools">
          <ChipGroup
            value={filter}
            label="Filter verification history"
            options={options}
            onChange={(next) => {
              setFilter(next);
              setPage(0);
            }}
          />

          <ExportButton
            label="Export history"
            disabled={filtered.length === 0}
            onExport={() =>
              exportRowsAsCsv(
                "Audit ledger verifications",
                filtered,
                HISTORY_COLUMNS
              )
            }
          />
        </div>
      )}

      <div className="audit-verification-list">
        {ordered.length === 0 && (
          <div className="audit-ledger-empty">
            <History size={22} aria-hidden="true" />

            <strong>No verification run</strong>

            <span>
              Refresh the ledger to create its first verification
              record.
            </span>
          </div>
        )}

        {ordered.length > 0 && filtered.length === 0 && (
          <div className="audit-ledger-empty">
            <History size={22} aria-hidden="true" />

            <strong>No checks match this filter</strong>
          </div>
        )}

        {shown.map((verification) => (
          <article
            key={verification.id}
            className="audit-verification-row"
          >
            <div
              className={
                verification.integrityValid
                  ? "audit-verification-icon valid"
                  : "audit-verification-icon"
              }
            >
              {verification.integrityValid ? (
                <CheckCircle2 size={13} aria-hidden="true" />
              ) : (
                <ShieldAlert size={13} aria-hidden="true" />
              )}
            </div>

            <div>
              <strong>
                {verification.integrityValid
                  ? "Integrity verified"
                  : "Verification attention"}
              </strong>

              <span>
                {verification.ledgerEntryCount}
                {" entries · +"}
                {verification.appendedCount}
                {" appended · "}
                {formatDateTime(verification.verifiedAt)}
                {" UTC"}
              </span>

              <p>{verification.detail}</p>

              {verification.rootHash && (
                <p
                  className="ui-ev-root"
                  title={verification.rootHash}
                >
                  <ShieldCheck size={12} aria-hidden="true" />
                  Root {shortHash(verification.rootHash, 16)}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <Pager
        page={safePage}
        pageSize={HISTORY_PAGE_SIZE}
        total={filtered.length}
        label="Verification history pages"
        onPage={setPage}
      />
    </div>
  );
}
