"use client";

import {
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  EvidenceCustodyEvent,
  EvidenceCustodyRecord,
  EvidenceIntegrityVerification,
} from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import { ALL, dataOptions } from "@/lib/ev-common";
import {
  custodyEventMatches,
  custodyEventTypes,
  custodyFacetCounts,
  custodyFacetValues,
  custodyFiltersActive,
  custodyLogColumns,
  CUSTODY_COLUMNS,
  eventsInOrder,
  sanitizeCustodyFilters,
  verificationChecks,
  type CustodyFilters,
} from "@/lib/ev-custody";
import { formatDateTime, humanize } from "@/lib/format";
import {
  clampPage,
  countBy,
  paginate,
} from "@/lib/list-utils";

import { HashText } from "./ev-ui";
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

const EVENT_PAGE_SIZE = 10;

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce(
    (total, value) => total + value,
    0
  );
}

function statusTone(
  status: string
): Option<string>["tone"] {
  if (status === "VERIFIED") {
    return "ok";
  }

  if (status === "INTEGRITY_ALERT") {
    return "danger";
  }

  return undefined;
}

/** Search, filters with counts, saved views, export and refresh. */
export function CustodyFilterBar({
  records,
  filters,
  filtered,
  refreshing,
  onChange,
  onReset,
  onApply,
  onRefresh,
}: {
  records: readonly EvidenceCustodyRecord[];
  filters: CustodyFilters;
  /** Records that match the filters (all pages). */
  filtered: readonly EvidenceCustodyRecord[];
  refreshing: boolean;
  onChange: (patch: Partial<CustodyFilters>) => void;
  onReset: () => void;
  onApply: (filters: CustodyFilters) => void;
  onRefresh: () => void;
}) {
  const active = custodyFiltersActive(filters);

  const typeCounts = useMemo(
    () => custodyFacetCounts(records, filters, "type"),
    [records, filters]
  );

  const statusCounts = useMemo(
    () => custodyFacetCounts(records, filters, "status"),
    [records, filters]
  );

  const handlerCounts = useMemo(
    () => custodyFacetCounts(records, filters, "handler"),
    [records, filters]
  );

  const typeOptions = dataOptions(
    custodyFacetValues(records, "type"),
    filters.type,
    "All types",
    typeCounts,
    sum(typeCounts),
    humanize
  );

  const handlerOptions = dataOptions(
    custodyFacetValues(records, "handler"),
    filters.handler,
    "All handlers",
    handlerCounts,
    sum(handlerCounts)
  );

  const statusOptions: Option<string>[] = dataOptions(
    custodyFacetValues(records, "status"),
    filters.status,
    "All",
    statusCounts,
    sum(statusCounts),
    humanize
  ).map((option) => ({
    ...option,
    tone: statusTone(option.value),
  }));

  return (
    <div className="ui-ev-filters">
      <Toolbar label="Filter evidence">
        <SearchField
          value={filters.q}
          label="Search evidence"
          placeholder="Search reference, title, case, hash..."
          onChange={(q) => onChange({ q })}
        />

        <SelectField
          value={filters.type}
          label="Filter by evidence type"
          options={typeOptions}
          onChange={(type) => onChange({ type })}
        />

        <SelectField
          value={filters.handler}
          label="Filter by current handler"
          options={handlerOptions}
          onChange={(handler) => onChange({ handler })}
        />

        <ResetButton disabled={!active} onClick={onReset} />

        <ExportButton
          label="Export registry"
          disabled={filtered.length === 0}
          onExport={() =>
            exportRowsAsCsv(
              "Evidence registry",
              filtered,
              CUSTODY_COLUMNS
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
          label="Filter by custody status"
          options={statusOptions}
          onChange={(status) => onChange({ status })}
        />
      </div>

      <SavedViews<CustodyFilters>
        storageKey="fcg.views.custody"
        current={filters}
        canSave={active}
        onApply={(value) =>
          onApply(sanitizeCustodyFilters(value))
        }
      />

      <ResultCount
        shown={filtered.length}
        total={records.length}
        noun="evidence records"
        filtered={active}
      />
    </div>
  );
}

/**
 * What the last "Verify integrity" found for one evidence record:
 * the verdict and each check in words (never colour alone).
 */
export function VerificationResult({
  result,
  verifying,
  currentStatus,
}: {
  result: EvidenceIntegrityVerification | null;
  verifying: boolean;
  currentStatus: string;
}) {
  const checks = result ? verificationChecks(result) : [];

  return (
    <div className="ui-ev-verify" role="status">
      {verifying && (
        <p className="ui-ev-verify-wait">
          <RefreshCw
            size={13}
            className="ui-spin"
            aria-hidden="true"
          />
          Verifying the registry fingerprint and the custody
          hash chain...
        </p>
      )}

      {!verifying && !result && (
        <p className="ui-ev-verify-meta">
          Not verified in this session. Current status:{" "}
          {humanize(currentStatus)}. Verify integrity checks
          the registry fingerprint and the custody hash chain.
        </p>
      )}

      {!verifying && result && (
        <div
          className={
            result.integrityValid
              ? "ui-ev-verify-result ui-ev-verify-ok"
              : "ui-ev-verify-result ui-ev-verify-fail"
          }
        >
          <div className="ui-ev-verify-head">
            {result.integrityValid ? (
              <ShieldCheck size={16} aria-hidden="true" />
            ) : (
              <ShieldAlert size={16} aria-hidden="true" />
            )}

            <strong>
              {result.integrityValid
                ? "Integrity verified"
                : "Integrity check failed"}
            </strong>
          </div>

          <ul className="ui-ev-checks">
            {checks.map((check) => (
              <li
                key={check.label}
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

                {check.label}
                {": "}
                {check.ok ? "valid" : "invalid"}
              </li>
            ))}
          </ul>

          <p>{result.detail}</p>

          <p className="ui-ev-verify-meta">
            Checked by {result.verifiedBy} on{" "}
            {formatDateTime(result.verifiedAt)} UTC
            {" · "}
            {result.eventCount} custody events
            {" · "}
            held by {result.currentCustodian}
            {" · "}
            status {humanize(result.currentStatus)}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The custody history of one evidence record: search, event-type
 * filter, paging and an export of the log with full hashes. Mount it
 * with `key` = evidence id so its filters start fresh per record.
 */
export function EvidenceEventLog({
  record,
  events,
  loading,
  error,
  onRetry,
}: {
  record: EvidenceCustodyRecord;
  /** Events of this record, or null while none have arrived. */
  events: readonly EvidenceCustodyEvent[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");

  const [eventType, setEventType] = useState(ALL);

  const [page, setPage] = useState(0);

  const ordered = useMemo(
    () => eventsInOrder(events ?? []),
    [events]
  );

  const filtered = useMemo(
    () =>
      ordered.filter((event) =>
        custodyEventMatches(event, query, eventType)
      ),
    [ordered, query, eventType]
  );

  const types = useMemo(
    () => custodyEventTypes(ordered),
    [ordered]
  );

  const active = query.trim() !== "" || eventType !== ALL;

  const safePage = clampPage(
    page,
    filtered.length,
    EVENT_PAGE_SIZE
  );

  const shown = paginate(filtered, safePage, EVENT_PAGE_SIZE);

  const typeOptions = dataOptions(
    types,
    eventType,
    "All events",
    countBy(ordered, (event) => event.eventType),
    ordered.length,
    humanize
  );

  return (
    <div className="evidence-event-card" aria-busy={loading}>
      <div className="evidence-card-heading">
        <div>
          <ShieldCheck size={14} aria-hidden="true" />

          <strong>Custody history</strong>
        </div>

        <span>
          {active
            ? `${filtered.length} of ${ordered.length}`
            : ordered.length}
          {" events"}
        </span>
      </div>

      {ordered.length > 0 && (
        <Toolbar label="Filter custody events">
          <SearchField
            value={query}
            label="Search custody events"
            placeholder="Search actor, note, hash..."
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
          />

          {types.length > 1 && (
            <SelectField
              value={eventType}
              label="Filter by event type"
              options={typeOptions}
              onChange={(value) => {
                setEventType(value);
                setPage(0);
              }}
            />
          )}

          <ResetButton
            disabled={!active}
            onClick={() => {
              setQuery("");
              setEventType(ALL);
              setPage(0);
            }}
          />

          <ExportButton
            label="Export log"
            disabled={filtered.length === 0}
            onExport={() =>
              exportRowsAsCsv(
                `Custody log ${record.evidenceReference}`,
                filtered,
                custodyLogColumns(record)
              )
            }
          />
        </Toolbar>
      )}

      {error && (
        <ErrorState
          compact
          title="Unable to load the custody history"
          message={error}
          onRetry={onRetry}
        />
      )}

      {!error && events === null && (
        <LoadingState compact label="Loading custody history" />
      )}

      {!error && events !== null && ordered.length === 0 && (
        <EmptyState
          compact
          title="No custody events"
          message="This record has no custody history yet."
        />
      )}

      {!error &&
        ordered.length > 0 &&
        filtered.length === 0 && (
          <EmptyState
            compact
            title="No events match these filters"
            message="Try a different search or clear the filters."
          />
        )}

      {shown.map((event) => (
        <article key={event.id} className="evidence-event-row">
          <div className="evidence-event-sequence">
            #{event.sequenceNumber}
          </div>

          <div>
            <strong>{humanize(event.eventType)}</strong>

            <span>
              {event.actorUsername}
              {" · "}
              {formatDateTime(event.occurredAt)}
              {" UTC"}
            </span>

            {(event.fromCustodian || event.toCustodian) && (
              <span>
                {event.fromCustodian ?? "—"}
                {" → "}
                {event.toCustodian ?? "—"}
              </span>
            )}

            <p>{event.eventNote}</p>

            <div className="ui-ev-hash-rows">
              <div className="ui-ev-hash-row">
                <b>Hash</b>

                <HashText
                  value={event.eventHash}
                  label={`event ${event.sequenceNumber} hash`}
                />
              </div>

              <div className="ui-ev-hash-row">
                <b>Previous</b>

                <HashText
                  value={event.previousEventHash}
                  label={`event ${event.sequenceNumber} previous hash`}
                />
              </div>
            </div>
          </div>
        </article>
      ))}

      <Pager
        page={safePage}
        pageSize={EVENT_PAGE_SIZE}
        total={filtered.length}
        label="Custody event pages"
        onPage={setPage}
      />
    </div>
  );
}
