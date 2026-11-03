"use client";

import {
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import {
  ApiError,
  fetchAlertQueue,
  type AlertQueuePage,
  type AlertView,
} from "@/lib/api";
import { exportRowsAsCsv, type CsvColumn } from "@/lib/csv";
import { humanize } from "@/lib/format";

import { ExportButton, SavedViews } from "./list-tools";
import { AlertRow } from "./overview-panels";

const PAGE_SIZE = 20;

/** The API returns at most 100 alerts per page. */
const EXPORT_PAGE_SIZE = 100;

/** Stops an export of a very large queue at 3,000 rows. */
const EXPORT_MAX_PAGES = 30;

const ALERT_COLUMNS: CsvColumn<AlertView>[] = [
  { header: "Code", value: (alert) => alert.code },
  { header: "Title", value: (alert) => alert.title },
  { header: "Severity", value: (alert) => alert.severity },
  { header: "Status", value: (alert) => alert.status },
  { header: "Risk score", value: (alert) => alert.riskScore },
  { header: "Type", value: (alert) => alert.type },
  { header: "Account", value: (alert) => alert.accountNumber },
  {
    header: "Transaction reference",
    value: (alert) => alert.transactionReference,
  },
  { header: "Created (UTC)", value: (alert) => alert.createdAt },
  { header: "Description", value: (alert) => alert.description },
];

const SEVERITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

const STATUSES = ["OPEN", "IN_REVIEW", "CLOSED"] as const;

interface Filters {
  q: string;
  severity: string;
  status: string;
  page: number;
}

/** What a saved view remembers: the filters, not the page. */
type ViewFilters = Pick<Filters, "q" | "severity" | "status">;

/** Saved views come from localStorage, so check what they hold. */
function toViewFilters(raw: unknown): ViewFilters {
  const value =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const pick = (
    field: unknown,
    allowed: readonly string[]
  ) =>
    typeof field === "string" && allowed.includes(field)
      ? field
      : "ALL";

  return {
    q:
      typeof value.q === "string"
        ? value.q.slice(0, 120)
        : "",
    severity: pick(value.severity, SEVERITIES),
    status: pick(value.status, STATUSES),
  };
}

/**
 * Full alert queue: server-side search, severity and status filters
 * and paging. Falls back to the eight alerts held by the dashboard
 * overview when the backend does not have /api/v1/alerts yet, so the
 * page still works against an older backend.
 */
export function AlertQueue({
  fallbackAlerts,
  casesByAlert,
  busyAlertId,
  initialQuery = "",
  initialSeverity = "ALL",
  initialStatus = "ALL",
  refreshKey,
  onOpenCase,
  onViewCase,
}: {
  fallbackAlerts: AlertView[];
  casesByAlert: Map<string, string>;
  busyAlertId: string | null;
  initialQuery?: string;
  /** A severity such as "HIGH", or "ALL". */
  initialSeverity?: string;
  /** A status such as "OPEN", or "ALL". */
  initialStatus?: string;
  /** Change to force a reload (e.g. after a detection run). */
  refreshKey: number;
  onOpenCase: (alertId: string) => Promise<void>;
  onViewCase: (caseId: string) => void;
}) {
  const [filters, setFilters] = useState<Filters>({
    q: initialQuery,
    severity: initialSeverity,
    status: initialStatus,
    page: 0,
  });

  // The text box is edited freely; filters.q follows after a pause so
  // that typing does not fire a request per keystroke.
  const [draft, setDraft] = useState(initialQuery);

  const [data, setData] =
    useState<AlertQueuePage | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [legacy, setLegacy] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  const [exporting, setExporting] = useState(false);

  const [exportNote, setExportNote] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (draft === filters.q) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFilters((current) => ({
        ...current,
        q: draft,
        page: 0,
      }));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [draft, filters.q]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const page = await fetchAlertQueue(
          {
            q: filters.q.trim() || undefined,
            severity:
              filters.severity === "ALL"
                ? undefined
                : filters.severity,
            status:
              filters.status === "ALL"
                ? undefined
                : filters.status,
            page: filters.page,
            size: PAGE_SIZE,
          },
          controller.signal
        );

        setData(page);
        setLegacy(false);
      } catch (failure) {
        if (
          failure instanceof DOMException &&
          failure.name === "AbortError"
        ) {
          return;
        }

        if (
          failure instanceof ApiError &&
          (failure.status === 404 ||
            failure.status === 405)
        ) {
          setLegacy(true);
          setData(null);
          return;
        }

        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to load alerts."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [filters, refreshKey, reloadTick]);

  function update(patch: Partial<Filters>) {
    setFilters((current) => ({
      ...current,
      page: 0,
      ...patch,
    }));
  }

  function reset() {
    setDraft("");
    setFilters({
      q: "",
      severity: "ALL",
      status: "ALL",
      page: 0,
    });
  }

  async function exportMatching() {
    setExporting(true);
    setExportNote(null);

    try {
      let rows: AlertView[] = items;
      let note: string | null = null;

      if (!legacy) {
        rows = [];

        let page = 0;
        let totalPages = 1;

        while (page < totalPages && page < EXPORT_MAX_PAGES) {
          const result = await fetchAlertQueue({
            q: filters.q.trim() || undefined,
            severity:
              filters.severity === "ALL"
                ? undefined
                : filters.severity,
            status:
              filters.status === "ALL"
                ? undefined
                : filters.status,
            page,
            size: EXPORT_PAGE_SIZE,
          });

          rows.push(...result.items);
          totalPages = result.totalPages;
          page += 1;

          if (page >= EXPORT_MAX_PAGES && page < totalPages) {
            note = `Exported the first ${rows.length.toLocaleString()} of ${result.totalItems.toLocaleString()} alerts. Narrow the filters to export the rest.`;
          }
        }
      }

      exportRowsAsCsv("alerts", rows, ALERT_COLUMNS);

      setExportNote(note);
    } catch (failure) {
      setExportNote(
        failure instanceof Error
          ? `Export failed: ${failure.message}`
          : "Export failed."
      );
    } finally {
      setExporting(false);
    }
  }

  const hasFilters =
    filters.q !== "" ||
    filters.severity !== "ALL" ||
    filters.status !== "ALL";

  const normalizedFallbackQuery = filters.q
    .trim()
    .toLowerCase();

  const items: AlertView[] = legacy
    ? fallbackAlerts.filter(
        (alert) =>
          (filters.severity === "ALL" ||
            alert.severity === filters.severity) &&
          (filters.status === "ALL" ||
            alert.status === filters.status) &&
          (normalizedFallbackQuery === "" ||
            [
              alert.title,
              alert.code,
              alert.description,
              alert.accountNumber ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedFallbackQuery))
      )
    : (data?.items ?? []);

  const totalItems = legacy
    ? items.length
    : (data?.totalItems ?? 0);

  const totalPages = legacy ? 1 : (data?.totalPages ?? 0);

  const firstShown =
    totalItems === 0
      ? 0
      : filters.page * PAGE_SIZE + 1;

  const lastShown = legacy
    ? items.length
    : Math.min(
        (filters.page + 1) * PAGE_SIZE,
        totalItems
      );

  return (
    <section
      className="panel ui-alert-queue"
      aria-busy={loading}
    >
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Risk queue</div>

          <h2>All alerts</h2>

          <p>
            Search, filter and work through every alert.
            Highest risk first.
          </p>
        </div>

        <ExportButton
          label={exporting ? "Exporting..." : "Export CSV"}
          disabled={exporting || totalItems === 0}
          onExport={() => void exportMatching()}
        />
      </div>

      {exportNote && (
        <div className="ui-notice" role="status">
          <AlertTriangle size={15} aria-hidden="true" />

          <span>{exportNote}</span>
        </div>
      )}

      {legacy && (
        <div className="ui-notice" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            This backend does not provide the alert search API
            yet, so only the top alerts are shown. Update the
            backend to see every alert.
          </span>
        </div>
      )}

      <div
        className="ui-toolbar"
        role="search"
        aria-label="Filter alerts"
      >
        <label className="ui-search-field">
          <span className="ui-visually-hidden">
            Search alerts
          </span>

          <Search size={15} aria-hidden="true" />

          <input
            type="search"
            value={draft}
            placeholder="Search title, code or description..."
            onChange={(event) =>
              setDraft(event.target.value)
            }
          />
        </label>

        <select
          className="ui-select"
          aria-label="Filter by status"
          value={filters.status}
          onChange={(event) =>
            update({ status: event.target.value })
          }
        >
          <option value="ALL">All statuses</option>

          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {humanize(status)}
              {data
                ? ` (${data.statusCounts[status] ?? 0})`
                : ""}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="ui-reset"
          disabled={!hasFilters}
          onClick={reset}
        >
          Reset
        </button>

        <button
          type="button"
          className="ui-icon-text-button"
          onClick={() => setReloadTick((tick) => tick + 1)}
          disabled={loading}
        >
          <RefreshCw
            size={14}
            className={loading ? "ui-spin" : undefined}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      <SavedViews<ViewFilters>
        storageKey="fcg.views.alerts"
        current={{
          q: filters.q,
          severity: filters.severity,
          status: filters.status,
        }}
        canSave={hasFilters}
        onApply={(value) => {
          const view = toViewFilters(value);

          setDraft(view.q);
          setFilters({ ...view, page: 0 });
        }}
      />

      <div
        className="ui-chip-row"
        role="group"
        aria-label="Filter by severity"
      >
        <button
          type="button"
          className={
            filters.severity === "ALL"
              ? "ui-chip active"
              : "ui-chip"
          }
          aria-pressed={filters.severity === "ALL"}
          onClick={() => update({ severity: "ALL" })}
        >
          All
        </button>

        {SEVERITIES.map((severity) => (
          <button
            key={severity}
            type="button"
            className={
              filters.severity === severity
                ? `ui-chip active ui-chip-${severity.toLowerCase()}`
                : `ui-chip ui-chip-${severity.toLowerCase()}`
            }
            aria-pressed={filters.severity === severity}
            onClick={() => update({ severity })}
          >
            {humanize(severity)}

            {data && (
              <span className="ui-chip-count">
                {data.severityCounts[severity] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="state-card error-state" role="alert">
          <AlertTriangle size={26} aria-hidden="true" />

          <strong>Unable to load alerts</strong>

          <span>{error}</span>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setReloadTick((tick) => tick + 1)}
          >
            <RefreshCw size={13} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {!error && loading && items.length === 0 && (
        <div className="state-card">
          <div className="spinner" />
          <strong>Loading alerts</strong>
        </div>
      )}

      {!error && !loading && items.length === 0 && (
        <div className="case-empty">
          <ShieldAlert size={25} aria-hidden="true" />

          <strong>
            {hasFilters
              ? "No alerts match these filters"
              : "No alerts yet"}
          </strong>

          <span>
            {hasFilters
              ? "Try a different search or clear the filters."
              : "Run AML detection to generate alerts from monitored transactions."}
          </span>
        </div>
      )}

      {!error && items.length > 0 && (
        <>
          <p className="ui-result-count" aria-live="polite">
            Showing {firstShown}–{lastShown} of{" "}
            {totalItems.toLocaleString()}
            {hasFilters ? " matching alerts" : " alerts"}
          </p>

          <div
            className={
              loading
                ? "alert-list ui-list-loading"
                : "alert-list"
            }
          >
            {items.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                caseId={casesByAlert.get(alert.id) ?? null}
                busy={busyAlertId === alert.id}
                onOpenCase={onOpenCase}
                onViewCase={onViewCase}
              />
            ))}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <nav
          className="ui-pager"
          aria-label="Alert pages"
        >
          <button
            type="button"
            className="secondary-button"
            disabled={filters.page === 0 || loading}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: Math.max(0, current.page - 1),
              }))
            }
          >
            Previous
          </button>

          <span>
            Page {filters.page + 1} of {totalPages}
          </span>

          <button
            type="button"
            className="secondary-button"
            disabled={
              filters.page >= totalPages - 1 || loading
            }
            onClick={() =>
              setFilters((current) => ({
                ...current,
                page: current.page + 1,
              }))
            }
          >
            Next
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
}
