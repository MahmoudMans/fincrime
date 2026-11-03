"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  FileDown,
  ShieldAlert,
  UserRoundCog,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  addCaseNote,
  assignCase,
  attachCaseAlertEvidence,
  attachCaseCircularGraphEvidence,
  attachCaseTransactionEvidence,
  downloadCaseReport,
  fetchCaseWorkspace,
  resolveCaseWorkspace,
  type CaseWorkspaceView,
  type InvestigationCase,
} from "@/lib/api";
import { CASE_TEXT_MAX_LENGTH } from "@/lib/cw-case-lists";
import { formatAssignee } from "@/lib/cw-assignee";
import {
  formatDateTime,
  humanize,
} from "@/lib/format";

import { AssigneePicker } from "./assignee-picker";
import { useAuth } from "./auth-context";
import {
  CaseActionError,
  EvidenceSection,
  NotesSection,
} from "./case-evidence-notes";
import { CaseTimeline } from "./case-timeline";
import { ConfirmButton } from "./confirm-button";
import {
  ErrorState,
  LoadingState,
} from "./state-card";

interface CaseWorkspaceProps {
  cases: InvestigationCase[];
  /** Case to open first, e.g. from a #/cases/<id> link. */
  initialCaseId?: string | null;
  /**
   * Called with the saved case after a note, assignment, evidence or
   * resolution succeeds, so the caller can refresh its case list.
   */
  onCaseChanged?: (updated: CaseWorkspaceView) => void;
}

/** Which part of the workspace a failed operation belongs to. */
type ActionScope = "evidence" | "note" | "assign" | "resolve";

const DISPOSITIONS = [
  { value: "ESCALATED", label: "Escalated" },
  { value: "SAR_RECOMMENDED", label: "SAR recommended" },
  { value: "FALSE_POSITIVE", label: "False positive" },
  { value: "NO_ACTION", label: "No action" },
] as const;

function scopeOf(label: string): ActionScope {
  return label === "note" ||
    label === "assign" ||
    label === "resolve"
    ? label
    : "evidence";
}

export function CaseWorkspace({
  cases,
  initialCaseId = null,
  onCaseChanged,
}: CaseWorkspaceProps) {
  const {
    hasAnyRole,
    session,
  } = useAuth();

  // The backend takes the acting user from the access token, so this
  // only labels the request; it matches how events are recorded.
  const actor =
    formatAssignee(
      session.displayName,
      session.username
    );

  const canExportReport =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [selectedCaseId, setSelectedCaseId] =
    useState<string | null>(initialCaseId);

  const [workspace, setWorkspace] =
    useState<CaseWorkspaceView | null>(
      null
    );

  // Drafts are kept per case, so text typed for one case can never be
  // saved on another one after switching.
  const [noteDrafts, setNoteDrafts] =
    useState<Record<string, string>>({});

  const [resolutionDrafts, setResolutionDrafts] =
    useState<Record<string, string>>({});

  const [disposition, setDisposition] =
    useState("ESCALATED");

  const [action, setAction] =
    useState<string | null>(null);

  const [exportingReport, setExportingReport] =
    useState(false);

  // Report export problems (shown at the top, next to the button).
  const [error, setError] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<{
      scope: ActionScope;
      message: string;
    } | null>(null);

  const [loadFailure, setLoadFailure] =
    useState<{
      caseId: string;
      message: string;
    } | null>(null);

  const [loadTick, setLoadTick] =
    useState(0);

  // Assignees saved during this visit; the case list the shell holds
  // does not know about them yet.
  const [assignedHere, setAssignedHere] =
    useState<string[]>([]);

  const busyRef =
    useRef(false);

  const activeCaseId =
    selectedCaseId &&
    cases.some(
      (item) =>
        item.id === selectedCaseId
    )
      ? selectedCaseId
      : cases[0]?.id ?? null;

  const requestedCaseMissing =
    selectedCaseId !== null &&
    cases.length > 0 &&
    activeCaseId !== selectedCaseId;

  useEffect(() => {
    if (!activeCaseId) {
      return;
    }

    const controller =
      new AbortController();

    void fetchCaseWorkspace(
      activeCaseId,
      controller.signal
    )
      .then((data) => {
        setWorkspace(data);
        setLoadFailure(null);
      })
      .catch((loadError: unknown) => {
        if (
          controller.signal.aborted ||
          (loadError instanceof DOMException &&
            loadError.name === "AbortError")
        ) {
          return;
        }

        setLoadFailure({
          caseId: activeCaseId,
          message:
            loadError instanceof Error
              ? loadError.message
              : "Unable to load case workspace.",
        });
      });

    return () =>
      controller.abort();
  }, [activeCaseId, loadTick]);

  const visibleWorkspace =
    workspace?.id === activeCaseId
      ? workspace
      : null;

  const failedLoad =
    loadFailure !== null &&
    loadFailure.caseId === activeCaseId
      ? loadFailure.message
      : null;

  const loading =
    Boolean(
      activeCaseId &&
      !visibleWorkspace &&
      !failedLoad
    );

  const noteBody =
    (activeCaseId && noteDrafts[activeCaseId]) ||
    "";

  const resolution =
    (activeCaseId &&
      resolutionDrafts[activeCaseId]) ||
    "";

  const knownAssignees =
    useMemo(
      () => [
        ...cases.map(
          (item) => item.assignedTo
        ),
        ...assignedHere,
      ],
      [cases, assignedHere]
    );

  function retryLoad() {
    setLoadFailure(null);
    setLoadTick((tick) => tick + 1);
  }

  function setNoteBody(
    value: string
  ) {
    if (!activeCaseId) {
      return;
    }

    setNoteDrafts((drafts) => ({
      ...drafts,
      [activeCaseId]: value,
    }));
  }

  function setResolution(
    value: string
  ) {
    if (!activeCaseId) {
      return;
    }

    setResolutionDrafts((drafts) => ({
      ...drafts,
      [activeCaseId]: value,
    }));
  }

  async function execute(
    label: string,
    operation: () =>
      Promise<CaseWorkspaceView>
  ) {
    // One operation at a time, even if a second one is triggered
    // before the disabled buttons have re-rendered (e.g. Ctrl+Enter).
    if (busyRef.current) {
      return false;
    }

    busyRef.current = true;

    try {
      setAction(label);
      setActionError(null);

      const updated =
        await operation();

      setWorkspace(updated);

      onCaseChanged?.(updated);

      return true;
    } catch (failure) {
      setActionError({
        scope: scopeOf(label),
        message:
          failure instanceof Error
            ? failure.message
            : "Case operation failed.",
      });

      return false;
    } finally {
      busyRef.current = false;

      setAction(null);
    }
  }

  async function submitNote() {
    if (
      !activeCaseId ||
      !noteBody.trim()
    ) {
      return;
    }

    const success =
      await execute(
        "note",
        () =>
          addCaseNote(
            activeCaseId,
            actor,
            noteBody.trim()
          )
      );

    if (success) {
      setNoteBody("");
    }
  }

  async function submitAssignment(
    assignee: string
  ) {
    if (!activeCaseId) {
      return false;
    }

    const success =
      await execute(
        "assign",
        () =>
          assignCase(
            activeCaseId,
            assignee,
            actor
          )
      );

    if (success) {
      setAssignedHere((names) => [
        ...names,
        assignee,
      ]);
    }

    return success;
  }

  async function attachAlert() {
    if (
      !activeCaseId ||
      !visibleWorkspace
    ) {
      return;
    }

    await execute(
      "alert",
      () =>
        attachCaseAlertEvidence(
          activeCaseId,
          visibleWorkspace
            .primaryAlert.id,
          actor
        )
    );
  }

  async function attachTransaction() {
    const reference =
      visibleWorkspace
        ?.primaryAlert
        .transactionReference;

    if (
      !activeCaseId ||
      !reference
    ) {
      return;
    }

    await execute(
      "transaction",
      () =>
        attachCaseTransactionEvidence(
          activeCaseId,
          reference,
          actor
        )
    );
  }

  async function attachGraph() {
    if (!activeCaseId) {
      return;
    }

    await execute(
      "graph",
      () =>
        attachCaseCircularGraphEvidence(
          activeCaseId,
          actor
        )
    );
  }

  async function resolveCase() {
    if (
      !activeCaseId ||
      !resolution.trim()
    ) {
      return;
    }

    const success =
      await execute(
        "resolve",
        () =>
          resolveCaseWorkspace(
            activeCaseId,
            disposition,
            resolution.trim(),
            actor
          )
      );

    if (success) {
      setResolution("");
    }
  }

  async function exportReport() {
    if (
      !activeCaseId ||
      !canExportReport
    ) {
      return;
    }

    try {
      setExportingReport(true);
      setError(null);

      const report =
        await downloadCaseReport(
          activeCaseId
        );

      const url =
        URL.createObjectURL(
          report.blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download =
        report.filename;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      // Revoking at once can cancel the download in some browsers.
      window.setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        10_000
      );
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to export investigation report."
      );
    } finally {
      setExportingReport(false);
    }
  }

  return (
    <section className="panel case-workspace-panel">
      <div className="panel-heading case-workspace-heading">
        <div>
          <div className="eyebrow">
            Investigation operations
          </div>

          <h2>
            Case evidence workspace
          </h2>

          <p>
            Preserve analyst notes,
            transaction evidence, graph
            findings and investigation
            decisions.
          </p>
        </div>

        <div className="case-selector">
          <label htmlFor="case-workspace-case">
            Investigation
          </label>

          <select
            id="case-workspace-case"
            value={activeCaseId ?? ""}
            disabled={
              cases.length === 0 ||
              action !== null
            }
            onChange={(event) => {
              setError(null);
              setActionError(null);
              setDisposition("ESCALATED");

              setSelectedCaseId(
                event.target.value
              );
            }}
          >
            {cases.length === 0 && (
              <option value="">
                No cases
              </option>
            )}

            {cases.map(
              (investigationCase) => (
                <option
                  key={
                    investigationCase.id
                  }
                  value={
                    investigationCase.id
                  }
                >
                  {
                    investigationCase
                      .caseNumber
                  }
                  {" · "}
                  {
                    investigationCase
                      .title
                  }
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {error && (
        <div
          className="case-workspace-error ui-cw-banner"
          role="alert"
        >
          <AlertTriangle size={15} aria-hidden="true" />

          <span>{error}</span>

          <button
            type="button"
            aria-label="Dismiss this error"
            onClick={() => setError(null)}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}

      {requestedCaseMissing && (
        <div className="ui-notice" role="status">
          <AlertTriangle size={15} aria-hidden="true" />

          <span>
            The requested case was not found, so another case is
            shown. Check the case number before acting on it.
          </span>
        </div>
      )}

      {cases.length === 0 ? (
        <div className="case-workspace-empty">
          <BriefcaseBusiness size={28} />

          <strong>
            No investigation case selected
          </strong>

          <span>
            Open a case from an AML alert
            before collecting evidence.
          </span>
        </div>
      ) : failedLoad &&
        !visibleWorkspace ? (
        <ErrorState
          title="Unable to load this case"
          message={failedLoad}
          onRetry={retryLoad}
        />
      ) : loading &&
        !visibleWorkspace ? (
        <LoadingState label="Loading case workspace" />
      ) : visibleWorkspace ? (
        <>
          <div className="case-overview-strip">
            <div>
              <span>Case</span>

              <strong>
                {
                  visibleWorkspace
                    .caseNumber
                }
              </strong>
            </div>

            <div>
              <span>Status</span>

              <strong>
                {humanize(
                  visibleWorkspace.status
                )}
              </strong>
            </div>

            <div>
              <span>Priority</span>

              <strong
                className={
                  `risk-text risk-${visibleWorkspace.priority.toLowerCase()}`
                }
              >
                {
                  visibleWorkspace
                    .priority
                }
              </strong>
            </div>

            <div>
              <span>Assigned to</span>

              <strong
                title={
                  visibleWorkspace
                    .assignedTo ??
                  "Unassigned"
                }
              >
                {
                  visibleWorkspace
                    .assignedTo ??
                  "Unassigned"
                }
              </strong>
            </div>

            <div>
              <span>Evidence</span>

              <strong>
                {
                  visibleWorkspace
                    .evidence.length
                }
              </strong>
            </div>

            <div>
              <span>Notes</span>

              <strong>
                {
                  visibleWorkspace
                    .notes.length
                }
              </strong>
            </div>
          </div>

          <div className="case-report-toolbar">
            <div>
              <FileDown size={15} />

              <div>
                <strong>
                  Investigation report
                </strong>

                <span>
                  Case summary, evidence fingerprints,
                  analyst notes and audit timeline.
                </span>
              </div>
            </div>

            <div className="case-permission-action case-permission-action--export">
              <button
                type="button"
                className="secondary-button"
                disabled={
                  !canExportReport ||
                  exportingReport
                }
                title={
                  canExportReport
                    ? "Export investigation PDF"
                    : "Senior Analyst or Administrator required"
                }
                onClick={() =>
                  void exportReport()
                }
               aria-describedby={!canExportReport ? "case-export-permission" : undefined}>
                <FileDown size={13} />

                {exportingReport
                  ? "Generating..."
                  : "Export PDF"}
              </button>

              {!canExportReport && (
                <span
                  id="case-export-permission"
                  className="case-permission-note"
                  role="note"
                >
                  Senior Analyst or Administrator required
                </span>
              )}
            </div>
          </div>

          <div className="case-workspace-grid">
            <div className="case-workspace-main">
              <CaseAlertCard
                workspace={
                  visibleWorkspace
                }
              />

              <EvidenceSection
                key={`evidence-${visibleWorkspace.id}`}
                workspace={
                  visibleWorkspace
                }
                action={action}
                error={
                  actionError?.scope === "evidence"
                    ? actionError.message
                    : null
                }
                onDismissError={() =>
                  setActionError(null)
                }
                onAttachAlert={
                  attachAlert
                }
                onAttachTransaction={
                  attachTransaction
                }
                onAttachGraph={
                  attachGraph
                }
              />

              <NotesSection
                key={`notes-${visibleWorkspace.id}`}
                workspace={
                  visibleWorkspace
                }
                noteBody={noteBody}
                action={action}
                error={
                  actionError?.scope === "note"
                    ? actionError.message
                    : null
                }
                onDismissError={() =>
                  setActionError(null)
                }
                onNoteChange={
                  setNoteBody
                }
                onSubmit={
                  submitNote
                }
              />

              <CaseTimeline
                key={`timeline-${visibleWorkspace.id}`}
                events={
                  visibleWorkspace.timeline
                }
                caseNumber={
                  visibleWorkspace.caseNumber
                }
              />
            </div>

            <aside className="case-workspace-sidebar">
              <AssignmentSection
                key={`assignment-${visibleWorkspace.id}`}
                workspace={
                  visibleWorkspace
                }
                knownAssignees={
                  knownAssignees
                }
                action={action}
                error={
                  actionError?.scope === "assign"
                    ? actionError.message
                    : null
                }
                onDismissError={() =>
                  setActionError(null)
                }
                onAssign={
                  submitAssignment
                }
              />

              <ResolutionSection
                key={`resolution-${visibleWorkspace.id}`}
                workspace={
                  visibleWorkspace
                }
                disposition={
                  disposition
                }
                resolution={
                  resolution
                }
                action={action}
                error={
                  actionError?.scope === "resolve"
                    ? actionError.message
                    : null
                }
                onDismissError={() =>
                  setActionError(null)
                }
                onDispositionChange={
                  setDisposition
                }
                onResolutionChange={
                  setResolution
                }
                onResolve={
                  resolveCase
                }
              />
            </aside>
          </div>
        </>
      ) : null}
    </section>
  );
}

function CaseAlertCard({
  workspace,
}: {
  workspace: CaseWorkspaceView;
}) {
  const alert =
    workspace.primaryAlert;

  return (
    <section className="case-workspace-block">
      <div className="case-block-heading">
        <div>
          <ShieldAlert size={15} />

          <strong>
            Primary alert
          </strong>
        </div>

        <span>
          Risk {alert.riskScore}
        </span>
      </div>

      <div className="primary-alert-card">
        <div>
          <span className="case-label">
            {alert.code}
          </span>

          <h3>{alert.title}</h3>

          <p>
            {humanize(alert.type)}
            {" · "}
            {alert.severity}
            {" · "}
            {alert.accountNumber ??
              "No account"}
          </p>
        </div>

        {alert.transactionReference && (
          <div className="primary-alert-reference">
            <span>
              Transaction
            </span>

            <strong>
              {
                alert
                  .transactionReference
              }
            </strong>
          </div>
        )}
      </div>
    </section>
  );
}

function AssignmentSection({
  workspace,
  knownAssignees,
  action,
  error,
  onDismissError,
  onAssign,
}: {
  workspace: CaseWorkspaceView;
  knownAssignees:
    ReadonlyArray<string | null>;
  action: string | null;
  error: string | null;
  onDismissError: () => void;
  onAssign:
    (assignee: string) => Promise<boolean>;
}) {
  const {
    hasAnyRole,
  } = useAuth();

  const canManageCase =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  return (
    <section className="case-side-block">
      <div className="case-side-heading">
        <UserRoundCog size={14} />
        <strong>Assignment</strong>
      </div>

      <AssigneePicker
        assignedTo={
          workspace.assignedTo
        }
        knownAssignees={
          knownAssignees
        }
        canEdit={canManageCase}
        busy={action !== null}
        onAssign={onAssign}
      />

      <CaseActionError
        message={error}
        onDismiss={onDismissError}
      />
    </section>
  );
}

function ResolutionSection({
  workspace,
  disposition,
  resolution,
  action,
  error,
  onDismissError,
  onDispositionChange,
  onResolutionChange,
  onResolve,
}: {
  workspace: CaseWorkspaceView;
  disposition: string;
  resolution: string;
  action: string | null;
  error: string | null;
  onDismissError: () => void;
  onDispositionChange:
    (value: string) => void;
  onResolutionChange:
    (value: string) => void;
  onResolve: () => Promise<void>;
}) {
  const {
    hasAnyRole,
  } = useAuth();

  const canResolveCase =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const closed =
    workspace.status === "CLOSED";

  const dispositionLabel =
    DISPOSITIONS.find(
      (item) =>
        item.value === disposition
    )?.label ?? humanize(disposition);

  return (
    <section className="case-side-block">
      <div className="case-side-heading">
        <BadgeCheck size={14} />
        <strong>Disposition</strong>
      </div>

      {closed ? (
        <div className="resolved-case">
          <span>
            {
              workspace.disposition ??
              "CLOSED"
            }
          </span>

          <p className="ui-cw-pre">
            {
              workspace
                .resolutionSummary ??
              "Case closed."
            }
          </p>

          {workspace.closedAt && (
            <small className="ui-cw-closed-at">
              Closed{" "}
              <time
                dateTime={
                  workspace.closedAt
                }
                title={
                  workspace.closedAt
                }
              >
                {formatDateTime(
                  workspace.closedAt
                )}
              </time>{" "}
              UTC
            </small>
          )}
        </div>
      ) : (
        <>
          <select
            value={disposition}
            aria-label="Case disposition"
            disabled={action !== null}
            onChange={(event) =>
              onDispositionChange(
                event.target.value
              )
            }
          >
            {DISPOSITIONS.map(
              (item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              )
            )}
          </select>

          <textarea
            value={resolution}
            maxLength={
              CASE_TEXT_MAX_LENGTH
            }
            readOnly={
              action === "resolve"
            }
            placeholder="Resolution rationale..."
            aria-label="Resolution rationale"
            aria-describedby="case-resolution-counter"
            onChange={(event) =>
              onResolutionChange(
                event.target.value
              )
            }
          />

          <p
            id="case-resolution-counter"
            className="ui-cw-counter ui-cw-side-counter"
          >
            {resolution.length.toLocaleString()}
            {" / "}
            {CASE_TEXT_MAX_LENGTH.toLocaleString()}
            {" characters"}
          </p>

          <div className="ui-cw-confirm-row">
            <ConfirmButton
              className="secondary-button case-wide-button"
              confirmLabel={`Yes, close as ${dispositionLabel}`}
              disabled={
                !canResolveCase ||
                !resolution.trim() ||
                action !== null
              }
              onConfirm={() =>
                void onResolve()
              }
            >
              Resolve case
            </ConfirmButton>
          </div>

          {action === "resolve" && (
            <p
              className="ui-cw-hint ui-cw-side-hint"
              role="status"
            >
              Closing the case...
            </p>
          )}

          {!canResolveCase && (
            <span
              className="case-permission-note ui-cw-side-hint"
              role="note"
            >
              Senior Analyst or Administrator required
            </span>
          )}

          <CaseActionError
            message={error}
            onDismiss={
              onDismissError
            }
          />
        </>
      )}
    </section>
  );
}
