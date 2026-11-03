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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  commitDataImport,
  fetchDataImportJob,
  fetchDataImportJobs,
  fetchDataImportSchemas,
  previewDataImport,
  resynchronizeImportGraph,
  runAmlDetection,
  type DataImportJob,
} from "@/lib/api";
import {
  formatFileSize,
  validateImportFile,
} from "@/lib/cw-ingestion";
import {
  humanize,
  shortHash,
} from "@/lib/format";
import { useLoad } from "@/lib/use-load";

import { useAuth } from "./auth-context";
import { ConfirmButton } from "./confirm-button";
import {
  IngestionIssues,
  IngestionJobLog,
  StatusBadge,
} from "./ingestion-job-log";

/** The operations that can fail and be tried again. */
type IngestionAction =
  | "validate"
  | "commit"
  | "graph"
  | "detect";

export function DataIngestionCenter() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "ADMIN"
    );

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
    activity,
    setActivity,
  ] =
    useState<string | null>(
      null
    );

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

  const [
    failedAction,
    setFailedAction,
  ] =
    useState<IngestionAction | null>(
      null
    );

  const [
    openingJobId,
    setOpeningJobId,
  ] =
    useState<string | null>(
      null
    );

  const [
    openError,
    setOpenError,
  ] =
    useState<string | null>(
      null
    );

  const busyRef =
    useRef(false);

  const openSequence =
    useRef(0);

  const previewRef =
    useRef<HTMLElement | null>(
      null
    );

  // The schema list and the job log load on their own, so one failing
  // does not hide the other, and each can be retried.
  const loadSchemas =
    useCallback(
      (signal: AbortSignal) =>
        canManage
          ? fetchDataImportSchemas(
              signal
            )
          : Promise.resolve([]),
      [
        canManage,
      ]
    );

  const loadJobs =
    useCallback(
      (signal: AbortSignal) =>
        canManage
          ? fetchDataImportJobs(
              signal
            )
          : Promise.resolve([]),
      [
        canManage,
      ]
    );

  const schemaLoad =
    useLoad(
      loadSchemas,
      "Unable to load the dataset list."
    );

  const jobsLoad =
    useLoad(
      loadJobs,
      "Unable to load import history."
    );

  const schemas =
    schemaLoad.data ?? [];

  const history =
    jobsLoad.data ?? [];

  const reloadJobs =
    jobsLoad.reload;

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

  const activeJobId =
    activeJob?.id ?? null;

  // A job that was just validated or opened appears below the upload
  // card; bring it into view.
  useEffect(() => {
    if (activeJobId) {
      previewRef.current
        ?.scrollIntoView({
          block: "nearest",
        });
    }
  }, [
    activeJobId,
  ]);

  /**
   * Runs one import operation at a time (also when a second one is
   * triggered before the buttons have re-rendered as disabled) and
   * records what failed so it can be tried again.
   */
  async function runAction(
    kind: IngestionAction,
    progress: string,
    task: () => Promise<void>
  ) {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;

    try {
      setLoading(true);
      setActivity(progress);
      setError(null);
      setFailedAction(null);
      setActionMessage(null);

      await task();

    } catch (cause) {
      setError(
        errorMessage(
          cause
        )
      );

      setFailedAction(
        kind
      );

    } finally {
      busyRef.current = false;

      setLoading(false);
      setActivity(null);
    }
  }

  function selectFile(
    file: File | null
  ) {
    if (
      busyRef.current
    ) {
      return false;
    }

    setError(
      null
    );

    setFailedAction(
      null
    );

    setActionMessage(
      null
    );

    if (file) {
      const problem =
        validateImportFile(
          file
        );

      if (problem) {
        setSelectedFile(
          null
        );

        setError(
          problem
        );

        return false;
      }
    }

    setSelectedFile(
      file
    );

    setActiveJob(
      null
    );

    return true;
  }

  async function openJob(
    job: DataImportJob
  ) {
    if (
      busyRef.current
    ) {
      return;
    }

    // Only the latest click wins if responses arrive out of order.
    openSequence.current += 1;

    const sequence =
      openSequence.current;

    setOpenError(
      null
    );

    setOpeningJobId(
      job.id
    );

    try {
      const detailed =
        await fetchDataImportJob(
          job.id
        );

      if (
        sequence ===
        openSequence.current
      ) {
        setActiveJob(
          detailed
        );
      }

    } catch (cause) {
      if (
        sequence ===
        openSequence.current
      ) {
        setOpenError(
          errorMessage(
            cause
          )
        );
      }

    } finally {
      if (
        sequence ===
        openSequence.current
      ) {
        setOpeningJobId(
          null
        );
      }
    }
  }

  async function handlePreview() {
    if (!selectedFile) {
      setError(
        "Choose a CSV or JSON file first."
      );

      return;
    }

    const file =
      selectedFile;

    await runAction(
      "validate",
      `Validating ${file.name}…`,
      async () => {
        const result =
          await previewDataImport(
            file,
            selectedType
          );

        setActiveJob(
          result
        );

        reloadJobs();

        if (
          result.status ===
          "FAILED"
        ) {
          throw new Error(
            result.failureMessage
              ? `Validation failed: ${result.failureMessage}`
              : "Validation failed. See the job details below."
          );
        }

        setActionMessage(
          result.status ===
            "READY"
            ? "Validation complete. This dataset is ready to import."
            : "Validation complete. Resolve invalid rows or provide new data before committing."
        );
      }
    );
  }

  async function handleCommit() {
    if (!activeJob) {
      return;
    }

    const job =
      activeJob;

    await runAction(
      "commit",
      `Importing ${job.fileName}…`,
      async () => {
        const result =
          await commitDataImport(
            job.id
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

        reloadJobs();
      }
    );
  }

  async function handleGraphSync() {
    await runAction(
      "graph",
      "Synchronizing the graph from PostgreSQL…",
      async () => {
        const result =
          await resynchronizeImportGraph();

        setActionMessage(
          `Neo4j synchronized from PostgreSQL: ${result.customers} customers, ${result.accounts} accounts and ${result.transactions} transactions.`
        );

        reloadJobs();
      }
    );
  }

  async function handleDetection() {
    await runAction(
      "detect",
      "Running AML detection…",
      async () => {
        const run =
          await runAmlDetection();

        setActionMessage(
          `AML detection completed: ${run.rulesExecuted} rules, ${run.candidatesFound} candidates and ${run.alertsCreated} new alerts.`
        );
      }
    );
  }

  function retryFailedAction() {
    if (failedAction === "validate") {
      void handlePreview();
    } else if (failedAction === "commit") {
      void handleCommit();
    } else if (failedAction === "graph") {
      void handleGraphSync();
    } else if (failedAction === "detect") {
      void handleDetection();
    }
  }

  function handleDrop(
    event:
      DragEvent<HTMLLabelElement>
  ) {
    event.preventDefault();

    const files =
      event.dataTransfer
        .files;

    const file =
      files?.[0];

    if (file) {
      const accepted =
        selectFile(
          file
        );

      if (
        accepted &&
        files.length > 1
      ) {
        setActionMessage(
          `Only one file can be validated at a time, so only ${file.name} was used.`
        );
      }
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

        <section
          className="ingestion-upload-card"
          aria-busy={
            loading
          }
        >
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

          {schemaLoad.error && (
            <div
              className="ingestion-message ingestion-message-error"
              role="alert"
            >
              <AlertTriangle
                size={14}
                aria-hidden="true"
              />

              <span>
                The dataset list could not be loaded ({schemaLoad.error}). Auto detect still works.
              </span>

              <button
                className="ui-cw-inline-retry"
                type="button"
                onClick={
                  schemaLoad.reload
                }
              >
                Try again
              </button>
            </div>
          )}

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
            disabled={
              loading
            }
            onChange={(
              event
            ) => {
              const file =
                event.target
                  .files?.[0] ??
                null;

              selectFile(
                file
              );

              // Lets the same file be chosen again after an error.
              event.target.value =
                "";
            }}
          />

          <div className="ingestion-primary-actions">
            <button
              className="primary-button"
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

            <ConfirmButton
              className="secondary-button"
              confirmLabel="Yes, resync the graph"
              disabled={
                loading
              }
              onConfirm={() =>
                void handleGraphSync()
              }
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
              />

              Resync graph
            </ConfirmButton>
          </div>

          {activity && (
            <div
              className="ui-cw-progress"
              role="status"
            >
              <progress
                aria-label={
                  activity
                }
              />

              <span>
                {activity}
              </span>
            </div>
          )}

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

              <span>
                {error}
              </span>

              {failedAction && (
                <button
                  className="ui-cw-inline-retry"
                  type="button"
                  disabled={
                    loading
                  }
                  onClick={
                    retryFailedAction
                  }
                >
                  Try again
                </button>
              )}
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
        <section
          className="ingestion-preview-panel"
          ref={previewRef}
        >
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
                <code
                  title={
                    activeJob
                      .sha256
                  }
                >
                  {shortHash(
                    activeJob
                      .sha256,
                    16
                  )}
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
            <ConfirmButton
              className="primary-button"
              confirmLabel={`Yes, import ${activeJob.validRows.toLocaleString()} valid row${
                activeJob.validRows === 1
                  ? ""
                  : "s"
              }`}
              disabled={
                loading ||
                activeJob.status !==
                  "READY"
              }
              onConfirm={() =>
                void handleCommit()
              }
            >
              <Database
                size={14}
                aria-hidden="true"
              />

              Commit import
            </ConfirmButton>

            <button
              className="secondary-button"
              type="button"
              disabled={
                loading ||
                activeJob.status !==
                  "IMPORTED"
              }
              onClick={() =>
                void handleDetection()
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

          {activeJob.failureMessage && (
            <div
              className="ingestion-message ingestion-message-error"
              role="alert"
            >
              <AlertTriangle
                size={14}
                aria-hidden="true"
              />

              <span>
                <strong>
                  This job failed.
                </strong>{" "}
                {activeJob.failureMessage}
              </span>
            </div>
          )}

          {activeJob.graphSyncError && (
            <div
              className="ingestion-message ingestion-message-error"
              role="alert"
            >
              <AlertTriangle
                size={14}
                aria-hidden="true"
              />

              <span>
                <strong>
                  Graph synchronization failed.
                </strong>{" "}
                {activeJob.graphSyncError}{" "}
                Use Resync graph to try again.
              </span>
            </div>
          )}

          {activeJob.previewRows.length >
            0 && (
            <div className="ingestion-preview-table-wrap">
              <table className="ingestion-preview-table">
                <caption className="ui-visually-hidden">
                  First rows of the dataset
                </caption>

                <thead>
                  <tr>
                    {previewColumns.map(
                      (column) => (
                        <th
                          scope="col"
                          key={
                            column
                          }
                        >
                          {column}
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
            <IngestionIssues
              key={
                activeJob.id
              }
              job={activeJob}
            />
          )}
        </section>
      )}

      <IngestionJobLog
        jobs={history}
        loading={
          jobsLoad.loading
        }
        error={
          jobsLoad.error
        }
        actionError={
          openError
        }
        disabled={
          loading
        }
        activeJobId={
          activeJobId
        }
        openingJobId={
          openingJobId
        }
        onRefresh={
          reloadJobs
        }
        onDismissActionError={() =>
          setOpenError(
            null
          )
        }
        onOpen={(job) =>
          void openJob(
            job
          )
        }
      />
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

function errorMessage(
  cause: unknown
) {
  return cause instanceof
    Error
    ? cause.message
    : "The ingestion operation failed.";
}
