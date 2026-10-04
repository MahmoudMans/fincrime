"use client";

import {
  AlertTriangle,
  Database,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react";

import {
  type DragEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  commitDataImport,
  fetchDataImportJobs,
  fetchDataImportSchemas,
  previewDataImport,
  resynchronizeImportGraph,
  runAmlDetection,
  type DataImportJob,
  type DataImportSchema,
} from "@/lib/api";

import { useAuth } from "./auth-context";

export function DataIngestionCenter() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "ADMIN"
    );

  const [
    schemas,
    setSchemas,
  ] =
    useState<DataImportSchema[]>([]);

  const [
    history,
    setHistory,
  ] =
    useState<DataImportJob[]>([]);

  const [
    selectedType,
    setSelectedType,
  ] =
    useState(
      "AUTO"
    );

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    activeJob,
    setActiveJob,
  ] =
    useState<DataImportJob | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  const [
    actionMessage,
    setActionMessage,
  ] =
    useState<string | null>(
      null
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    if (!canManage) {
      return;
    }

    const controller =
      new AbortController();

    async function load() {
      try {
        setHistoryLoading(
          true
        );

        const [
          schemaData,
          historyData,
        ] =
          await Promise.all([
            fetchDataImportSchemas(
              controller.signal
            ),

            fetchDataImportJobs(
              controller.signal
            ),
          ]);

        setSchemas(
          schemaData
        );

        setHistory(
          historyData
        );

      } catch (cause) {
        if (
          !controller
            .signal
            .aborted
        ) {
          setError(
            errorMessage(
              cause
            )
          );
        }

      } finally {
        if (
          !controller
            .signal
            .aborted
        ) {
          setHistoryLoading(
            false
          );
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    canManage,
  ]);

  const selectedSchema =
    useMemo(
      () =>
        schemas.find(
          (schema) =>
            schema.datasetType ===
            selectedType
        ) ?? null,
      [
        schemas,
        selectedType,
      ]
    );

  async function refreshHistory() {
    const jobs =
      await fetchDataImportJobs();

    setHistory(
      jobs
    );
  }

  async function handlePreview() {
    if (!selectedFile) {
      setError(
        "Choose a CSV or JSON file first."
      );

      return;
    }

    try {
      setLoading(true);
      setError(null);
      setActionMessage(null);

      const result =
        await previewDataImport(
          selectedFile,
          selectedType
        );

      setActiveJob(
        result
      );

      setActionMessage(
        result.status ===
          "READY"
          ? "Validation complete. This dataset is ready to import."
          : "Validation complete. Resolve invalid rows or provide new data before committing."
      );

      await refreshHistory();

    } catch (cause) {
      setError(
        errorMessage(
          cause
        )
      );

    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!activeJob) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setActionMessage(null);

      const result =
        await commitDataImport(
          activeJob.id
        );

      setActiveJob(
        result
      );

      if (
        result.status ===
        "IMPORTED"
      ) {
        setActionMessage(
          `Imported ${result.importedRows} ${result.datasetType.toLowerCase()} row${
            result.importedRows === 1
              ? ""
              : "s"
          }. Neo4j synchronization: ${humanize(
            result.graphSyncStatus
          )}.`
        );

      } else {
        setActionMessage(
          "The dataset was revalidated and is no longer commit-ready."
        );
      }

      await refreshHistory();

    } catch (cause) {
      setError(
        errorMessage(
          cause
        )
      );

    } finally {
      setLoading(false);
    }
  }

  async function handleGraphSync() {
    try {
      setLoading(true);
      setError(null);
      setActionMessage(null);

      const result =
        await resynchronizeImportGraph();

      setActionMessage(
        `Neo4j synchronized from PostgreSQL: ${result.customers} customers, ${result.accounts} accounts and ${result.transactions} transactions.`
      );

      await refreshHistory();

    } catch (cause) {
      setError(
        errorMessage(
          cause
        )
      );

    } finally {
      setLoading(false);
    }
  }

  async function handleDetection() {
    try {
      setLoading(true);
      setError(null);
      setActionMessage(null);

      const run =
        await runAmlDetection();

      setActionMessage(
        `AML detection completed: ${run.rulesExecuted} rules, ${run.candidatesFound} candidates and ${run.alertsCreated} new alerts.`
      );

    } catch (cause) {
      setError(
        errorMessage(
          cause
        )
      );

    } finally {
      setLoading(false);
    }
  }

  function handleDrop(
    event:
      DragEvent<HTMLLabelElement>
  ) {
    event.preventDefault();

    const file =
      event.dataTransfer
        .files?.[0];

    if (file) {
      setSelectedFile(
        file
      );

      setActiveJob(
        null
      );

      setError(
        null
      );

      setActionMessage(
        null
      );
    }
  }

  if (!canManage) {
    return (
      <section className="ingestion-restricted-panel">
        <Database
          size={22}
          aria-hidden="true"
        />

        <div>
          <span className="eyebrow">
            Data administration
          </span>

          <h2>
            Data ingestion is restricted
          </h2>

          <p>
            Administrator access is required to validate and commit customer, account, and transaction datasets.
          </p>
        </div>
      </section>
    );
  }

  const previewColumns =
    activeJob?.previewRows[0]
      ? Object.keys(
          activeJob
            .previewRows[0]
        )
      : [];

  return (
    <section className="data-ingestion-center">
      <div className="ingestion-command-grid">

        <section className="ingestion-upload-card">
          <div className="ingestion-card-heading">
            <div>
              <span className="eyebrow">
                Controlled intake
              </span>

              <h2>
                Import financial data
              </h2>

              <p>
                Validate source data before it enters PostgreSQL, the investigation graph, and AML monitoring workflows.
              </p>
            </div>

            <span className="ingestion-admin-badge">
              ADMIN
            </span>
          </div>

          <div className="ingestion-type-row">
            <label>
              <span>
                Dataset
              </span>

              <select
                value={
                  selectedType
                }
                onChange={(
                  event
                ) => {
                  setSelectedType(
                    event
                      .target
                      .value
                  );

                  setActiveJob(
                    null
                  );
                }}
                disabled={
                  loading
                }
              >
                <option value="AUTO">
                  Auto detect
                </option>

                {schemas.map(
                  (schema) => (
                    <option
                      key={
                        schema.datasetType
                      }
                      value={
                        schema.datasetType
                      }
                    >
                      {humanize(
                        schema.datasetType
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <div className="ingestion-limit">
              CSV / JSON
              <span>
                Maximum 5 MB · 5,000 rows
              </span>
            </div>
          </div>

          <label
            className="ingestion-dropzone"
            htmlFor="fincrime-import-file"
            onDragOver={(
              event
            ) =>
              event.preventDefault()
            }
            onDrop={
              handleDrop
            }
          >
            <Upload
              size={24}
              aria-hidden="true"
            />

            <strong>
              {selectedFile
                ? selectedFile.name
                : "Drop a dataset here"}
            </strong>

            <span>
              {selectedFile
                ? formatFileSize(
                    selectedFile.size
                  )
                : "or choose a CSV / JSON file"}
            </span>
          </label>

          <input
            id="fincrime-import-file"
            className="ingestion-file-input"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(
              event
            ) => {
              const file =
                event.target
                  .files?.[0] ??
                null;

              setSelectedFile(
                file
              );

              setActiveJob(
                null
              );

              setError(
                null
              );

              setActionMessage(
                null
              );
            }}
          />

          <div className="ingestion-primary-actions">
            <button
              className="primary-action"
              type="button"
              disabled={
                loading ||
                !selectedFile
              }
              onClick={
                handlePreview
              }
            >
              <Upload
                size={14}
                aria-hidden="true"
              />

              {loading
                ? "Working..."
                : "Validate dataset"}
            </button>

            <button
              className="secondary-action"
              type="button"
              disabled={
                loading
              }
              onClick={
                handleGraphSync
              }
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
              />

              Resync graph
            </button>
          </div>

          {selectedSchema && (
            <div className="ingestion-schema-guide">
              <div>
                <span>
                  Natural key
                </span>

                <strong>
                  {
                    selectedSchema
                      .naturalKey
                  }
                </strong>
              </div>

              <div>
                <span>
                  Dependency
                </span>

                <strong>
                  {
                    selectedSchema
                      .dependency
                  }
                </strong>
              </div>

              <div className="ingestion-columns">
                <span>
                  Required columns
                </span>

                <code>
                  {selectedSchema
                    .requiredColumns
                    .join(", ")}
                </code>
              </div>
            </div>
          )}

          {error && (
            <div
              className="ingestion-message ingestion-message-error"
              role="alert"
            >
              <AlertTriangle
                size={14}
                aria-hidden="true"
              />

              {error}
            </div>
          )}

          {actionMessage && (
            <div
              className="ingestion-message ingestion-message-success"
              role="status"
            >
              {actionMessage}
            </div>
          )}
        </section>

        <section className="ingestion-process-card">
          <span className="eyebrow">
            Import contract
          </span>

          <h2>
            Governed ingestion pipeline
          </h2>

          <div className="ingestion-pipeline">
            {[
              [
                "01",
                "Upload",
                "Fingerprint source file",
              ],
              [
                "02",
                "Validate",
                "Schema, values and references",
              ],
              [
                "03",
                "Preview",
                "Valid, duplicate and invalid rows",
              ],
              [
                "04",
                "Commit",
                "Transactional PostgreSQL write",
              ],
              [
                "05",
                "Synchronize",
                "Rebuild authoritative Neo4j graph",
              ],
            ].map(
              ([
                number,
                title,
                copy,
              ]) => (
                <div
                  className="ingestion-pipeline-step"
                  key={
                    number
                  }
                >
                  <span>
                    {number}
                  </span>

                  <div>
                    <strong>
                      {title}
                    </strong>

                    <small>
                      {copy}
                    </small>
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      </div>

      {activeJob && (
        <section className="ingestion-preview-panel">
          <div className="ingestion-preview-heading">
            <div>
              <span className="eyebrow">
                Validation result
              </span>

              <h2>
                {activeJob.fileName}
              </h2>

              <p>
                {humanize(
                  activeJob.datasetType
                )}
                {" · "}
                SHA-256{" "}
                <code>
                  {activeJob
                    .sha256
                    .slice(
                      0,
                      16
                    )}
                  …
                </code>
              </p>
            </div>

            <StatusBadge
              status={
                activeJob.status
              }
            />
          </div>

          <div className="ingestion-metrics">
            <Metric
              label="Rows"
              value={
                activeJob.totalRows
              }
            />

            <Metric
              label="Valid"
              value={
                activeJob.validRows
              }
              tone="success"
            />

            <Metric
              label="Duplicates"
              value={
                activeJob.duplicateRows
              }
              tone="warning"
            />

            <Metric
              label="Invalid"
              value={
                activeJob.invalidRows
              }
              tone="danger"
            />

            <Metric
              label="Imported"
              value={
                activeJob.importedRows
              }
            />
          </div>

          <div className="ingestion-preview-actions">
            <button
              className="primary-action"
              type="button"
              disabled={
                loading ||
                activeJob.status !==
                  "READY"
              }
              onClick={
                handleCommit
              }
            >
              <Database
                size={14}
                aria-hidden="true"
              />

              Commit import
            </button>

            <button
              className="secondary-action"
              type="button"
              disabled={
                loading ||
                activeJob.status !==
                  "IMPORTED"
              }
              onClick={
                handleDetection
              }
            >
              <Play
                size={14}
                aria-hidden="true"
              />

              Run AML detection
            </button>

            <span className="ingestion-graph-state">
              Graph{" "}
              <strong>
                {humanize(
                  activeJob
                    .graphSyncStatus
                )}
              </strong>
            </span>
          </div>

          {activeJob.previewRows.length >
            0 && (
            <div className="ingestion-preview-table-wrap">
              <table className="ingestion-preview-table">
                <thead>
                  <tr>
                    {previewColumns.map(
                      (column) => (
                        <th
                          key={
                            column
                          }
                        >
                          {humanize(
                            column
                          )}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {activeJob
                    .previewRows
                    .map(
                      (
                        row,
                        index
                      ) => (
                        <tr
                          key={
                            `${activeJob.id}-${index}`
                          }
                        >
                          {previewColumns.map(
                            (
                              column
                            ) => (
                              <td
                                key={
                                  column
                                }
                              >
                                {
                                  row[
                                    column
                                  ]
                                }
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          )}

          {activeJob.issues.length >
            0 && (
            <div className="ingestion-issue-list">
              <div className="ingestion-subheading">
                <strong>
                  Validation issues
                </strong>

                <span>
                  Showing up to 100
                </span>
              </div>

              {activeJob.issues.map(
                (
                  issue,
                  index
                ) => (
                  <div
                    className="ingestion-issue-row"
                    key={
                      `${issue.rowNumber}-${issue.code}-${index}`
                    }
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
              )}
            </div>
          )}
        </section>
      )}

      <section className="ingestion-history-panel">
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
              historyLoading ||
              loading
            }
            onClick={() =>
              void refreshHistory()
            }
          >
            <RefreshCw
              size={12}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        {historyLoading &&
        history.length === 0 ? (
          <div className="ingestion-history-empty">
            Loading import history…
          </div>
        ) : history.length ===
          0 ? (
          <div className="ingestion-history-empty">
            No import jobs have been created yet.
          </div>
        ) : (
          <div className="ingestion-history-list">
            {history.map(
              (job) => (
                <button
                  className="ingestion-history-row"
                  type="button"
                  key={job.id}
                  onClick={async () => {
                    try {
                      const detailed =
                        await import(
                          "@/lib/api"
                        ).then(
                          ({
                            fetchDataImportJob,
                          }) =>
                            fetchDataImportJob(
                              job.id
                            )
                        );

                      setActiveJob(
                        detailed
                      );

                    } catch (cause) {
                      setError(
                        errorMessage(
                          cause
                        )
                      );
                    }
                  }}
                >
                  <div className="ingestion-history-primary">
                    <strong>
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
                    <span>
                      {formatDate(
                        job.createdAt
                      )}
                    </span>

                    <small>
                      {job.createdBy}
                    </small>
                  </div>

                  <StatusBadge
                    status={
                      job.status
                    }
                  />
                </button>
              )
            )}
          </div>
        )}
      </section>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?:
    | "neutral"
    | "success"
    | "warning"
    | "danger";
}) {
  return (
    <div className={`ingestion-metric ${tone}`}>
      <span>
        {label}
      </span>

      <strong>
        {value.toLocaleString()}
      </strong>
    </div>
  );
}

function StatusBadge({
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

function humanize(
  value: string
) {
  return value
    .toLowerCase()
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatFileSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}

function errorMessage(
  cause: unknown
) {
  return cause instanceof
    Error
    ? cause.message
    : "The ingestion operation failed.";
}
