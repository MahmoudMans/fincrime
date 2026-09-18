"use client";

import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  FileClock,
  FilePlus2,
  MessageSquareText,
  Network,
  Paperclip,
  Save,
  ShieldAlert,
  UserRoundCog,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addCaseNote,
  assignCase,
  attachCaseAlertEvidence,
  attachCaseCircularGraphEvidence,
  attachCaseTransactionEvidence,
  fetchCaseWorkspace,
  resolveCaseWorkspace,
  type CaseWorkspaceView,
  type InvestigationCase,
} from "@/lib/api";

import { useAuth } from "./auth-context";

interface CaseWorkspaceProps {
  cases: InvestigationCase[];
}

export function CaseWorkspace({
  cases,
}: CaseWorkspaceProps) {
  const [selectedCaseId, setSelectedCaseId] =
    useState<string | null>(null);

  const [workspace, setWorkspace] =
    useState<CaseWorkspaceView | null>(
      null
    );

  const [noteBody, setNoteBody] =
    useState("");

  const [assignee, setAssignee] =
    useState("AML Analyst");

  const [disposition, setDisposition] =
    useState("ESCALATED");

  const [resolution, setResolution] =
    useState("");

  const [action, setAction] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const activeCaseId =
    selectedCaseId &&
    cases.some(
      (item) =>
        item.id === selectedCaseId
    )
      ? selectedCaseId
      : cases[0]?.id ?? null;

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
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load case workspace."
        );
      });

    return () =>
      controller.abort();
  }, [activeCaseId]);

  const visibleWorkspace =
    workspace?.id === activeCaseId
      ? workspace
      : null;

  const loading =
    Boolean(
      activeCaseId &&
      !visibleWorkspace &&
      !error
    );

  const sortedTimeline =
    useMemo(
      () =>
        visibleWorkspace
          ? [...visibleWorkspace.timeline]
              .reverse()
          : [],
      [visibleWorkspace]
    );

  async function execute(
    label: string,
    operation: () =>
      Promise<CaseWorkspaceView>
  ) {
    try {
      setAction(label);
      setError(null);

      const updated =
        await operation();

      setWorkspace(updated);

      return true;
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Case operation failed."
      );

      return false;
    } finally {
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
            "AML Analyst",
            noteBody.trim()
          )
      );

    if (success) {
      setNoteBody("");
    }
  }

  async function submitAssignment() {
    if (
      !activeCaseId ||
      !assignee.trim()
    ) {
      return;
    }

    await execute(
      "assign",
      () =>
        assignCase(
          activeCaseId,
          assignee.trim(),
          "AML Analyst"
        )
    );
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
          "AML Analyst"
        )
    );
  }

  async function attachTransaction() {
    if (
      !activeCaseId ||
      !visibleWorkspace
        ?.primaryAlert
        .transactionReference
    ) {
      return;
    }

    await execute(
      "transaction",
      () =>
        attachCaseTransactionEvidence(
          activeCaseId,
          visibleWorkspace
            .primaryAlert
            .transactionReference!,
          "AML Analyst"
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
          "AML Analyst"
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
            "AML Analyst"
          )
      );

    if (success) {
      setResolution("");
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
            disabled={cases.length === 0}
            onChange={(event) => {
              setError(null);

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
        <div className="case-workspace-error">
          <AlertTriangle size={15} />
          {error}
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
      ) : loading &&
        !visibleWorkspace ? (
        <div className="case-workspace-empty">
          <div className="spinner" />

          <strong>
            Loading case workspace
          </strong>
        </div>
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

              <strong>
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

          <div className="case-workspace-grid">
            <div className="case-workspace-main">
              <CaseAlertCard
                workspace={
                  visibleWorkspace
                }
              />

              <EvidenceSection
                workspace={
                  visibleWorkspace
                }
                action={action}
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
                workspace={
                  visibleWorkspace
                }
                noteBody={noteBody}
                action={action}
                onNoteChange={
                  setNoteBody
                }
                onSubmit={
                  submitNote
                }
              />
            </div>

            <aside className="case-workspace-sidebar">
              <AssignmentSection
                workspace={
                  visibleWorkspace
                }
                assignee={assignee}
                action={action}
                onAssigneeChange={
                  setAssignee
                }
                onAssign={
                  submitAssignment
                }
              />

              <ResolutionSection
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

              <TimelineSection
                events={
                  sortedTimeline
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

function EvidenceSection({
  workspace,
  action,
  onAttachAlert,
  onAttachTransaction,
  onAttachGraph,
}: {
  workspace: CaseWorkspaceView;
  action: string | null;
  onAttachAlert: () => Promise<void>;
  onAttachTransaction:
    () => Promise<void>;
  onAttachGraph: () => Promise<void>;
}) {
  return (
    <section className="case-workspace-block">
      <div className="case-block-heading">
        <div>
          <Paperclip size={15} />

          <strong>
            Evidence
          </strong>
        </div>

        <span>
          {workspace.evidence.length}
        </span>
      </div>

      <div className="evidence-actions">
        <button
          type="button"
          className="mini-button"
          disabled={action !== null}
          onClick={() =>
            void onAttachAlert()
          }
        >
          <ShieldAlert size={12} />
          Attach alert
        </button>

        <button
          type="button"
          className="mini-button"
          disabled={
            action !== null ||
            !workspace.primaryAlert
              .transactionReference
          }
          onClick={() =>
            void onAttachTransaction()
          }
        >
          <FilePlus2 size={12} />
          Attach transaction
        </button>

        <button
          type="button"
          className="mini-button"
          disabled={action !== null}
          onClick={() =>
            void onAttachGraph()
          }
        >
          <Network size={12} />
          Attach circular graph
        </button>
      </div>

      <div className="evidence-list">
        {workspace.evidence.length ===
          0 && (
          <div className="case-list-empty">
            No preserved evidence yet.
          </div>
        )}

        {workspace.evidence.map(
          (evidence) => (
            <article
              className="evidence-item"
              key={evidence.id}
            >
              <div className="evidence-icon">
                {evidence.evidenceType ===
                "GRAPH_CYCLE" ? (
                  <Network size={15} />
                ) : evidence.evidenceType ===
                  "TRANSACTION" ? (
                  <FilePlus2 size={15} />
                ) : (
                  <ShieldAlert size={15} />
                )}
              </div>

              <div className="evidence-copy">
                <strong>
                  {evidence.title}
                </strong>

                <p>
                  {
                    evidence
                      .description
                  }
                </p>

                <div className="evidence-meta">
                  <span>
                    {
                      evidence
                        .evidenceType
                    }
                  </span>

                  <span>
                    {
                      evidence
                        .referenceId
                    }
                  </span>

                  <span>
                    {formatDateTime(
                      evidence.createdAt
                    )}
                  </span>
                </div>

                <code>
                  {
                    evidence
                      .snapshotText
                  }
                </code>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

function NotesSection({
  workspace,
  noteBody,
  action,
  onNoteChange,
  onSubmit,
}: {
  workspace: CaseWorkspaceView;
  noteBody: string;
  action: string | null;
  onNoteChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <section className="case-workspace-block">
      <div className="case-block-heading">
        <div>
          <MessageSquareText
            size={15}
          />

          <strong>
            Analyst notes
          </strong>
        </div>

        <span>
          {workspace.notes.length}
        </span>
      </div>

      <div className="note-composer">
        <textarea
          value={noteBody}
          maxLength={2000}
          placeholder="Record investigative observations, rationale or follow-up..."
          onChange={(event) =>
            onNoteChange(
              event.target.value
            )
          }
        />

        <button
          type="button"
          className="primary-button"
          disabled={
            !noteBody.trim() ||
            action !== null
          }
          onClick={() =>
            void onSubmit()
          }
        >
          <Save size={14} />
          Save note
        </button>
      </div>

      <div className="case-note-list">
        {workspace.notes.length ===
          0 && (
          <div className="case-list-empty">
            No analyst notes yet.
          </div>
        )}

        {[...workspace.notes]
          .reverse()
          .map((note) => (
            <article
              className="case-note"
              key={note.id}
            >
              <div className="case-note-head">
                <strong>
                  {note.authorName}
                </strong>

                <span>
                  {formatDateTime(
                    note.createdAt
                  )}
                </span>
              </div>

              <p>{note.body}</p>
            </article>
          ))}
      </div>
    </section>
  );
}

function AssignmentSection({
  workspace,
  assignee,
  action,
  onAssigneeChange,
  onAssign,
}: {
  workspace: CaseWorkspaceView;
  assignee: string;
  action: string | null;
  onAssigneeChange:
    (value: string) => void;
  onAssign: () => Promise<void>;
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

      <label>
        Current owner

        <strong>
          {workspace.assignedTo ??
            "Unassigned"}
        </strong>
      </label>

      <input
        value={assignee}
        maxLength={160}
        onChange={(event) =>
          onAssigneeChange(
            event.target.value
          )
        }
      />

      <button
        type="button"
        className="secondary-button case-wide-button"
        disabled={
          !canManageCase ||
          !assignee.trim() ||
          action !== null
        }
        onClick={() =>
          void onAssign()
        }
      >
        Assign case
      </button>
    </section>
  );
}

function ResolutionSection({
  workspace,
  disposition,
  resolution,
  action,
  onDispositionChange,
  onResolutionChange,
  onResolve,
}: {
  workspace: CaseWorkspaceView;
  disposition: string;
  resolution: string;
  action: string | null;
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

          <p>
            {
              workspace
                .resolutionSummary ??
              "Case closed."
            }
          </p>
        </div>
      ) : (
        <>
          <select
            value={disposition}
            onChange={(event) =>
              onDispositionChange(
                event.target.value
              )
            }
          >
            <option value="ESCALATED">
              Escalated
            </option>

            <option value="SAR_RECOMMENDED">
              SAR recommended
            </option>

            <option value="FALSE_POSITIVE">
              False positive
            </option>

            <option value="NO_ACTION">
              No action
            </option>
          </select>

          <textarea
            value={resolution}
            maxLength={2000}
            placeholder="Resolution rationale..."
            onChange={(event) =>
              onResolutionChange(
                event.target.value
              )
            }
          />

          <button
            type="button"
            className="secondary-button case-wide-button"
            disabled={
              !canResolveCase ||
              !resolution.trim() ||
              action !== null
            }
            onClick={() =>
              void onResolve()
            }
          >
            Resolve case
          </button>
        </>
      )}
    </section>
  );
}

function TimelineSection({
  events,
}: {
  events: CaseWorkspaceView["timeline"];
}) {
  return (
    <section className="case-side-block timeline-block">
      <div className="case-side-heading">
        <FileClock size={14} />
        <strong>Activity timeline</strong>
      </div>

      {events.length === 0 && (
        <div className="case-list-empty">
          No workspace activity yet.
        </div>
      )}

      <div className="case-timeline">
        {events.map((event) => (
          <article
            className="timeline-event"
            key={event.id}
          >
            <span className="timeline-dot" />

            <div>
              <strong>
                {humanize(
                  event.eventType
                )}
              </strong>

              <p>
                {event.description}
              </p>

              <small>
                {event.actorName}
                {" · "}
                {formatDateTime(
                  event.createdAt
                )}
              </small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function humanize(
  value: string
) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}
