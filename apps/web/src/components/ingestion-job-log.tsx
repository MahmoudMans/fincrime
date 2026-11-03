"use client";

import {
  AlertTriangle,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useState,
} from "react";

import type {
  DataImportIssue,
  DataImportJob,
} from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  DEFAULT_ISSUE_FILTERS,
  DEFAULT_JOB_FILTERS,
  JOB_CSV_COLUMNS,
  countIssueClassifications,
  countJobStatuses,
  filterIssues,
  filterJobs,
  formatFileSize,
  issueCsvColumns,
  jobDatasetsOf,
  jobStatusesOf,
  statusTone,
  type IssueFilters,
  type JobFilters,
} from "@/lib/cw-ingestion";
import {
  formatDateTime,
  humanize,
} from "@/lib/format";
import {
  clampPage,
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

const JOB_PAGE_SIZE = 10;

const ISSUE_PAGE_SIZE = 15;

/** The backend lists the 50 newest import jobs and no more. */
const JOB_LIST_LIMIT = 50;

export function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span className={`ingestion-status ingestion-status-${status.toLowerCase()}`}>
      {humanize(
        status
      )}
    </span>
  );
}

/**
 * The import job log: search, dataset and status filters with
 * counts, saved views, paging and a CSV export of the filtered jobs.
 * Opening a job is up to the caller.
 */
export function IngestionJobLog({
  jobs,
  loading,
  error,
  actionError,
  disabled,
  activeJobId,
  openingJobId,
  onRefresh,
  onDismissActionError,
  onOpen,
}: {
  jobs: readonly DataImportJob[];
  /** True while the list is loading or reloading. */
  loading: boolean;
  /** Why the list could not be loaded, or null. */
  error: string | null;
  /** Why a job could not be opened, or null. */
  actionError: string | null;
  /** True while an import operation is running. */
  disabled: boolean;
  activeJobId: string | null;
  openingJobId: string | null;
  onRefresh: () => void;
  onDismissActionError: () => void;
  onOpen: (job: DataImportJob) => void;
}) {
  const [filters, setFilters] =
    useState<JobFilters>(DEFAULT_JOB_FILTERS);

  const [page, setPage] = useState(0);

  const statuses = jobStatusesOf(jobs);

  const datasets = jobDatasetsOf(jobs);

  // A filter value that is gone after a reload falls back to "all".
  const status = statuses.includes(filters.status)
    ? filters.status
    : "ALL";

  const dataset = datasets.includes(filters.dataset)
    ? filters.dataset
    : "ALL";

  const effective: JobFilters = {
    q: filters.q,
    status,
    dataset,
  };

  const counts = countJobStatuses(jobs, {
    q: filters.q,
    dataset,
  });

  const visible = filterJobs(jobs, effective);

  const filtered =
    filters.q.trim() !== "" ||
    status !== "ALL" ||
    dataset !== "ALL";

  const safePage = clampPage(
    page,
    visible.length,
    JOB_PAGE_SIZE
  );

  const statusOptions: Option<string>[] = [
    {
      value: "ALL",
      label: "All",
      count: Object.values(counts).reduce(
        (sum, value) => sum + value,
        0
      ),
    },
    ...statuses.map((value) => ({
      value,
      label: humanize(value),
      count: counts[value] ?? 0,
      tone: statusTone(value),
    })),
  ];

  const datasetOptions: Option<string>[] = [
    { value: "ALL", label: "All datasets" },
    ...datasets.map((value) => ({
      value,
      label: humanize(value),
    })),
  ];

  function update(patch: Partial<JobFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  function reset() {
    setFilters(DEFAULT_JOB_FILTERS);
    setPage(0);
  }

  return (
    <section
      className="ingestion-history-panel"
      aria-busy={loading}
    >
      <div className="ingestion-history-heading">
        <div>
          <span className="eyebrow">
            Operational history
          </span>

          <h2>
            Import history
          </h2>

          <p>
            Recent validation and import jobs created by administrators.
          </p>
        </div>

        <button
          className="text-button"
          type="button"
          disabled={
            loading ||
            disabled
          }
          onClick={onRefresh}
        >
          <RefreshCw
            size={12}
            className={loading ? "ui-spin" : undefined}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {actionError && (
        <div className="ui-cw-error ui-cw-error-wide" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />

          <span>{actionError}</span>

          <button
            type="button"
            aria-label="Dismiss this error"
            onClick={onDismissActionError}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}

      {error && jobs.length > 0 && (
        <div className="ui-cw-error ui-cw-error-wide" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />

          <span>
            Could not refresh the history: {error} The list below may be out of date.
          </span>

          <button
            type="button"
            className="ui-cw-error-retry"
            onClick={onRefresh}
          >
            Try again
          </button>
        </div>
      )}

      {jobs.length === 0 && error ? (
        <ErrorState
          compact
          title="Unable to load import history"
          message={error}
          onRetry={onRefresh}
        />
      ) : jobs.length === 0 && loading ? (
        <LoadingState compact label="Loading import history" />
      ) : jobs.length === 0 ? (
        <EmptyState
          compact
          title="No import jobs have been created yet"
          message="Validate a CSV or JSON file above to create the first job."
        />
      ) : (
        <>
          <Toolbar label="Filter import jobs">
            <SearchField
              label="Search import jobs"
              placeholder="Search file, dataset, person or status..."
              value={filters.q}
              onChange={(q) => update({ q })}
            />

            <SelectField<string>
              label="Filter by dataset"
              value={dataset}
              options={datasetOptions}
              onChange={(value) => update({ dataset: value })}
            />

            <ResetButton disabled={!filtered} onClick={reset} />

            <ExportButton
              label="Export job log"
              disabled={visible.length === 0}
              onExport={() =>
                exportRowsAsCsv(
                  "import job log",
                  visible,
                  JOB_CSV_COLUMNS
                )
              }
            />
          </Toolbar>

          <div className="ui-chips-row">
            <ChipGroup
              label="Filter by job status"
              value={status}
              options={statusOptions}
              onChange={(value) => update({ status: value })}
            />
          </div>

          <SavedViews<JobFilters>
            storageKey="fcg.views.ingestion-jobs"
            current={effective}
            canSave={filtered}
            onApply={(value) => {
              setFilters({
                q: typeof value.q === "string" ? value.q : "",
                status:
                  typeof value.status === "string"
                    ? value.status
                    : "ALL",
                dataset:
                  typeof value.dataset === "string"
                    ? value.dataset
                    : "ALL",
              });
              setPage(0);
            }}
          />

          <ResultCount
            shown={visible.length}
            total={jobs.length}
            noun="import jobs"
            filtered={filtered}
          />

          {jobs.length >= JOB_LIST_LIMIT && (
            <p className="ui-cw-note">
              The server lists the {JOB_LIST_LIMIT} most recent jobs. Older jobs are not shown.
            </p>
          )}

          {visible.length === 0 ? (
            <EmptyState
              compact
              title="No import jobs match these filters"
              message="Try a different search or clear the filters."
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
          ) : (
            <div
              className={
                loading
                  ? "ingestion-history-list ui-list-loading"
                  : "ingestion-history-list"
              }
            >
              {paginate(visible, safePage, JOB_PAGE_SIZE).map(
                (job) => (
                  <button
                    className={
                      job.id === activeJobId
                        ? "ingestion-history-row ui-cw-row-active"
                        : "ingestion-history-row"
                    }
                    type="button"
                    key={job.id}
                    aria-current={
                      job.id === activeJobId ? "true" : undefined
                    }
                    disabled={
                      disabled ||
                      openingJobId !== null
                    }
                    onClick={() => onOpen(job)}
                  >
                    <div className="ingestion-history-primary">
                      <strong title={job.fileName}>
                        {job.fileName}
                      </strong>

                      <span>
                        {humanize(
                          job.datasetType
                        )}
                        {" · "}
                        {formatFileSize(
                          job.fileSize
                        )}
                      </span>

                      {job.failureMessage && (
                        <span className="ui-cw-job-failure">
                          {job.failureMessage}
                        </span>
                      )}

                      {job.graphSyncStatus === "FAILED" && (
                        <span className="ui-cw-job-failure">
                          Graph sync failed
                          {job.graphSyncError
                            ? `: ${job.graphSyncError}`
                            : ""}
                        </span>
                      )}
                    </div>

                    <div className="ingestion-history-count">
                      <span>
                        Valid
                      </span>

                      <strong>
                        {job.validRows}
                      </strong>
                    </div>

                    <div className="ingestion-history-count">
                      <span>
                        Imported
                      </span>

                      <strong>
                        {
                          job.importedRows
                        }
                      </strong>
                    </div>

                    <div className="ingestion-history-time">
                      <span title={job.createdAt}>
                        {formatDateTime(
                          job.createdAt
                        )}
                      </span>

                      <small>
                        {job.createdBy}
                      </small>
                    </div>

                    {openingJobId === job.id ? (
                      <span className="ingestion-status">
                        Opening...
                      </span>
                    ) : (
                      <StatusBadge
                        status={
                          job.status
                        }
                      />
                    )}
                  </button>
                )
              )}
            </div>
          )}

          <Pager
            label="Import job pages"
            page={safePage}
            pageSize={JOB_PAGE_SIZE}
            total={visible.length}
            onPage={setPage}
          />
        </>
      )}
    </section>
  );
}

/**
 * The validation issues of one job (the backend returns at most 100):
 * search, a filter per classification, paging and a CSV export.
 */
export function IngestionIssues({
  job,
}: {
  job: Pick<DataImportJob, "id" | "fileName" | "issues">;
}) {
  const [filters, setFilters] =
    useState<IssueFilters>(DEFAULT_ISSUE_FILTERS);

  const [page, setPage] = useState(0);

  const issues = job.issues;

  const classifications = Array.from(
    new Set(issues.map((issue) => issue.classification))
  ).sort();

  const classification = classifications.includes(
    filters.classification
  )
    ? filters.classification
    : "ALL";

  const counts = countIssueClassifications(issues, filters.q);

  const visible = filterIssues(issues, {
    q: filters.q,
    classification,
  });

  const filtered =
    filters.q.trim() !== "" || classification !== "ALL";

  const safePage = clampPage(
    page,
    visible.length,
    ISSUE_PAGE_SIZE
  );

  const options: Option<string>[] = [
    {
      value: "ALL",
      label: "All",
      count: Object.values(counts).reduce(
        (sum, value) => sum + value,
        0
      ),
    },
    ...classifications.map((value) => ({
      value,
      label: humanize(value),
      count: counts[value] ?? 0,
      tone:
        value === "INVALID"
          ? ("danger" as const)
          : ("warning" as const),
    })),
  ];

  function reset() {
    setFilters(DEFAULT_ISSUE_FILTERS);
    setPage(0);
  }

  return (
    <div className="ingestion-issue-list">
      <div className="ingestion-subheading">
        <strong>
          Validation issues
        </strong>

        <span>
          Showing up to 100
        </span>
      </div>

      <Toolbar label="Filter validation issues">
        <SearchField
          label="Search validation issues"
          placeholder="Search row, field, code or message..."
          value={filters.q}
          onChange={(q) => {
            setFilters((current) => ({ ...current, q }));
            setPage(0);
          }}
        />

        <ResetButton disabled={!filtered} onClick={reset} />

        <ExportButton
          label="Export issues"
          disabled={visible.length === 0}
          onExport={() =>
            exportRowsAsCsv(
              `${job.fileName} validation issues`,
              visible,
              issueCsvColumns(job)
            )
          }
        />
      </Toolbar>

      {classifications.length > 1 && (
        <div className="ui-chips-row">
          <ChipGroup
            label="Filter issues by classification"
            value={classification}
            options={options}
            onChange={(value) => {
              setFilters((current) => ({
                ...current,
                classification: value,
              }));
              setPage(0);
            }}
          />
        </div>
      )}

      <ResultCount
        shown={visible.length}
        total={issues.length}
        noun="issues"
        filtered={filtered}
      />

      {visible.length === 0 ? (
        <EmptyState
          compact
          title="No issues match these filters"
          message="Try a different search or clear the filters."
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
      ) : (
        paginate(visible, safePage, ISSUE_PAGE_SIZE).map(
          (issue: DataImportIssue) => (
            <div
              className="ingestion-issue-row"
              key={`${issue.rowNumber}-${issue.code}-${issues.indexOf(issue)}`}
            >
              <span className={`ingestion-issue-kind ${issue.classification.toLowerCase()}`}>
                {
                  issue.classification
                }
              </span>

              <strong>
                Row{" "}
                {
                  issue.rowNumber
                }
              </strong>

              <code>
                {issue.field ??
                  "row"}
              </code>

              <span>
                {
                  issue.message
                }
              </span>
            </div>
          )
        )
      )}

      <Pager
        label="Validation issue pages"
        page={safePage}
        pageSize={ISSUE_PAGE_SIZE}
        total={visible.length}
        onPage={setPage}
      />
    </div>
  );
}
