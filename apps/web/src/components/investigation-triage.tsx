"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  RefreshCw,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  assignInvestigationQueueOwner,
  fetchInvestigationTriageQueue,
  fetchInvestigationTriageRuns,
  recalculateInvestigationTriage,
  type InvestigationTriageQueueItem,
  type InvestigationTriageRunSummary,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

interface QueueState {
  items: InvestigationTriageQueueItem[];
}

const DEMO_OWNERS = [
  "analyst@fincrime.local",
  "senior@fincrime.local",
  "admin@fincrime.local",
];

export function InvestigationTriage() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [
    queueState,
    setQueueState,
  ] =
    useState<QueueState>({
      items: [],
    });

  const [runs, setRuns] =
    useState<
      InvestigationTriageRunSummary[]
    >([]);

  const [
    selectedCaseId,
    setSelectedCaseId,
  ] =
    useState<string | null>(
      null
    );

  const [owner, setOwner] =
    useState(
      DEMO_OWNERS[0]
    );

  const [note, setNote] =
    useState(
      "Assigned from the investigation triage queue."
    );

  const [action, setAction] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.all([
      fetchInvestigationTriageQueue(
        controller.signal
      ),
      fetchInvestigationTriageRuns(
        controller.signal
      ),
    ])
      .then(
        ([
          queue,
          history,
        ]) => {
          setQueueState({
            items: queue,
          });

          setRuns(
            history
          );

          setError(
            null
          );
        }
      )
      .catch(
        (loadError: unknown) => {
          if (
            loadError instanceof DOMException &&
            loadError.name ===
              "AbortError"
          ) {
            return;
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load investigation triage."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  const queue =
    queueState.items;

  const activeCaseId =
    selectedCaseId &&
    queue.some(
      (item) =>
        item.caseId ===
        selectedCaseId
    )
      ? selectedCaseId
      : queue[0]?.caseId ??
        null;

  const selected =
    useMemo(
      () =>
        queue.find(
          (item) =>
            item.caseId ===
            activeCaseId
        ) ?? null,
      [
        queue,
        activeCaseId,
      ]
    );

  const counts =
    useMemo(
      () => ({
        urgent:
          queue.filter(
            (item) =>
              item.triageBand ===
              "URGENT"
          ).length,

        high:
          queue.filter(
            (item) =>
              item.triageBand ===
              "HIGH"
          ).length,

        medium:
          queue.filter(
            (item) =>
              item.triageBand ===
              "MEDIUM"
          ).length,

        routine:
          queue.filter(
            (item) =>
              item.triageBand ===
              "ROUTINE"
          ).length,

        owned:
          queue.filter(
            (item) =>
              Boolean(
                item.ownerUsername
              )
          ).length,
      }),
      [
        queue,
      ]
    );

  async function recalculate() {
    if (!canManage) {
      return;
    }

    try {
      setAction(
        "recalculate"
      );

      setError(
        null
      );

      const run =
        await recalculateInvestigationTriage();

      setQueueState({
        items: run.queue,
      });

      const history =
        await fetchInvestigationTriageRuns();

      setRuns(
        history
      );

      setSelectedCaseId(
        run.queue[0]
          ?.caseId ??
        null
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to recalculate investigation triage."
      );
    } finally {
      setAction(
        null
      );
    }
  }

  async function assignOwner() {
    if (
      !canManage ||
      !selected
    ) {
      return;
    }

    try {
      setAction(
        "assign"
      );

      setError(
        null
      );

      await assignInvestigationQueueOwner(
        selected.caseId,
        owner,
        note
      );

      const updated =
        await fetchInvestigationTriageQueue();

      setQueueState({
        items: updated,
      });
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to assign investigation owner."
      );
    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel triage-panel">
      <div className="panel-heading triage-heading">
        <div>
          <div className="eyebrow">
            Investigation operations
          </div>

          <h2>
            Explainable triage queue
          </h2>

          <p>
            Deterministic case
            prioritization using case
            priority, SLA pressure,
            case age and investigation
            status.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            !canManage ||
            action !== null
          }
          title={
            canManage
              ? "Recalculate investigation triage"
              : "Senior Analyst or Administrator required"
          }
          onClick={() =>
            void recalculate()
          }
        >
          <RefreshCw
            size={13}
          />

          {action ===
          "recalculate"
            ? "Calculating..."
            : "Recalculate queue"}
        </button>
      </div>

      {error && (
        <div className="triage-error">
          <AlertTriangle
            size={14}
          />

          {error}
        </div>
      )}

      <div className="triage-metrics">
        <Metric
          label="Cases"
          value={
            queue.length
          }
          icon={
            <Activity
              size={15}
            />
          }
        />

        <Metric
          label="Urgent"
          value={
            counts.urgent
          }
          icon={
            <ShieldAlert
              size={15}
            />
          }
        />

        <Metric
          label="High"
          value={
            counts.high
          }
          icon={
            <Gauge
              size={15}
            />
          }
        />

        <Metric
          label="Medium"
          value={
            counts.medium
          }
          icon={
            <Clock3
              size={15}
            />
          }
        />

        <Metric
          label="Owned"
          value={
            counts.owned
          }
          icon={
            <UserRoundCheck
              size={15}
            />
          }
        />
      </div>

      {queue.length === 0 ? (
        <div className="triage-empty">
          <Gauge
            size={27}
          />

          <strong>
            No triage snapshot yet
          </strong>

          <span>
            Senior Analysts and
            Administrators can calculate
            the first explainable queue.
          </span>
        </div>
      ) : (
        <div className="triage-layout">
          <div className="triage-list">
            {queue.map(
              (item) => (
                <button
                  key={
                    item.id
                  }
                  type="button"
                  className={
                    item.caseId ===
                    activeCaseId
                      ? "triage-row selected"
                      : "triage-row"
                  }
                  onClick={() =>
                    setSelectedCaseId(
                      item.caseId
                    )
                  }
                >
                  <Score
                    score={
                      item.triageScore
                    }
                    band={
                      item.triageBand
                    }
                  />

                  <div className="triage-row-copy">
                    <strong>
                      {
                        item.caseNumber
                      }
                    </strong>

                    <span>
                      {
                        item.casePriority
                      }
                      {" · "}
                      {humanize(
                        item.caseStatus
                      )}
                    </span>
                  </div>

                  <div className="triage-row-meta">
                    <strong>
                      {
                        item.triageBand
                      }
                    </strong>

                    <span>
                      {item.ownerUsername
                        ? shortUser(
                            item.ownerUsername
                          )
                        : "Unowned"}
                    </span>
                  </div>
                </button>
              )
            )}
          </div>

          <div className="triage-detail">
            {selected && (
              <>
                <div className="triage-detail-head">
                  <div>
                    <div className="eyebrow">
                      Case prioritization
                    </div>

                    <h3>
                      {
                        selected.caseNumber
                      }
                    </h3>

                    <p>
                      {
                        selected.casePriority
                      }
                      {" · "}
                      {humanize(
                        selected.caseStatus
                      )}
                      {" · calculated "}
                      {formatDateTime(
                        selected.calculatedAt
                      )}
                    </p>
                  </div>

                  <Score
                    score={
                      selected.triageScore
                    }
                    band={
                      selected.triageBand
                    }
                    large
                  />
                </div>

                <div className="triage-factor-grid">
                  <Factor
                    label="Priority"
                    value={
                      selected.priorityPoints
                    }
                  />

                  <Factor
                    label="SLA pressure"
                    value={
                      selected.slaPoints
                    }
                  />

                  <Factor
                    label="Case age"
                    value={
                      selected.agePoints
                    }
                  />

                  <Factor
                    label="Status"
                    value={
                      selected.statusPoints
                    }
                  />
                </div>

                <div className="triage-explanation">
                  <Gauge
                    size={14}
                  />

                  <span>
                    {
                      selected.explanation
                    }
                  </span>
                </div>

                <div className="triage-owner-card">
                  <div className="triage-owner-heading">
                    <div>
                      <UserRoundCheck
                        size={14}
                      />

                      <strong>
                        Queue ownership
                      </strong>
                    </div>

                    <span>
                      {selected.ownerUsername ??
                        "Unassigned"}
                    </span>
                  </div>

                  <div className="triage-owner-form">
                    <label>
                      <span>
                        Owner
                      </span>

                      <select
                        value={
                          owner
                        }
                        disabled={
                          !canManage ||
                          action !== null
                        }
                        onChange={(
                          event
                        ) =>
                          setOwner(
                            event.target.value
                          )
                        }
                      >
                        {DEMO_OWNERS.map(
                          (
                            username
                          ) => (
                            <option
                              key={
                                username
                              }
                              value={
                                username
                              }
                            >
                              {
                                username
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      <span>
                        Assignment rationale
                      </span>

                      <input
                        type="text"
                        value={
                          note
                        }
                        maxLength={
                          1000
                        }
                        disabled={
                          !canManage ||
                          action !== null
                        }
                        onChange={(
                          event
                        ) =>
                          setNote(
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        !canManage ||
                        action !== null ||
                        note.trim()
                          .length ===
                          0
                      }
                      onClick={() =>
                        void assignOwner()
                      }
                    >
                      <UserRoundCheck
                        size={12}
                      />

                      {action ===
                      "assign"
                        ? "Assigning..."
                        : "Assign owner"}
                    </button>
                  </div>

                  {selected.ownerUsername && (
                    <div className="triage-owner-current">
                      <CheckCircle2
                        size={13}
                      />

                      <span>
                        Owned by
                        {" "}
                        <strong>
                          {
                            selected.ownerUsername
                          }
                        </strong>
                        {selected.assignedBy
                          ? ` · assigned by ${selected.assignedBy}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="triage-history">
        <div>
          <Clock3
            size={13}
          />

          <strong>
            Triage history
          </strong>
        </div>

        <span>
          {runs.length === 0
            ? "No prior run"
            : `${runs.length} retained run${
                runs.length === 1
                  ? ""
                  : "s"
              }`}
        </span>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="triage-metric">
      <div>
        {icon}
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Score({
  score,
  band,
  large = false,
}: {
  score: number;
  band: string;
  large?: boolean;
}) {
  return (
    <div
      className={
        `triage-score triage-${band.toLowerCase()} ${
          large
            ? "large"
            : ""
        }`
      }
    >
      <strong>
        {score}
      </strong>

      <span>
        /100
      </span>
    </div>
  );
}

function Factor({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="triage-factor">
      <span>
        {label}
      </span>

      <strong>
        +
        {value}
      </strong>
    </div>
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
      (
        character
      ) =>
        character.toUpperCase()
    );
}

function shortUser(
  value: string
) {
  return value.split(
    "@"
  )[0];
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
