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
  useMemo,
  useState,
} from "react";

import {
  assignInvestigationQueueOwner,
  fetchCases,
  fetchInvestigationTriageQueue,
  fetchInvestigationTriageRuns,
  recalculateInvestigationTriage,
  type InvestigationTriageQueueItem,
  type InvestigationTriageRunSummary,
} from "@/lib/api";

import {
  exportRowsAsCsv,
} from "@/lib/csv";

import {
  formatDateTime,
  formatRelativeTime,
  humanize,
} from "@/lib/format";

import {
  clampPage,
  paginate,
  plural,
} from "@/lib/list-utils";

import {
  useLoad,
} from "@/lib/use-load";

import {
  useIsMounted,
} from "@/lib/wf-common";

import {
  DEFAULT_TRIAGE_FILTERS,
  filterTriage,
  sortTriage,
  triageAge,
  triageCsvColumns,
  type TriageFilters,
} from "@/lib/wf-triage";

import {
  useAuth,
} from "./auth-context";

import {
  Pager,
} from "./list-tools";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./state-card";

import {
  TriageTools,
} from "./wf-triage-tools";

interface TriageData {
  queue: InvestigationTriageQueueItem[];
  /** Null when the run history could not be loaded. */
  runs: InvestigationTriageRunSummary[] | null;
}

const PAGE_SIZE = 15;

const EMPTY_QUEUE: InvestigationTriageQueueItem[] = [];

const DEMO_OWNERS = [
  "analyst@fincrime.local",
  "senior@fincrime.local",
  "admin@fincrime.local",
];

async function loadTriage(
  signal: AbortSignal
): Promise<TriageData> {
  const [queue, runs] =
    await Promise.all([
      fetchInvestigationTriageQueue(
        signal
      ),

      // The history is a footnote; the queue still works without it.
      fetchInvestigationTriageRuns(
        signal
      ).catch(() => null),
    ]);

  return {
    queue,
    runs,
  };
}

export function InvestigationTriage() {
  const {
    hasAnyRole,
    session,
  } = useAuth();

  const username =
    session.username;

  const isMounted =
    useIsMounted();

  const canManage =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const load =
    useLoad(
      loadTriage,
      "Unable to load investigation triage."
    );

  // Case creation times, to show how old each case is. Optional: the
  // queue works (and shows the snapshot age) when this fails.
  const casesLoad =
    useLoad(
      fetchCases
    );

  const [filters, setFilters] =
    useState<TriageFilters>(
      DEFAULT_TRIAGE_FILTERS
    );

  const [page, setPage] =
    useState(0);

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

  const [
    actionFailure,
    setActionFailure,
  ] =
    useState<string | null>(
      null
    );

  const [notice, setNotice] =
    useState<string | null>(
      null
    );

  const queue =
    load.data?.queue ??
    EMPTY_QUEUE;

  const runs =
    load.data?.runs ??
    null;

  const busy =
    action !== null ||
    load.loading;

  const openedAt =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            string
          >();

        for (const item of casesLoad.data ?? []) {
          map.set(
            item.id,
            item.createdAt
          );
        }

        return map;
      },
      [
        casesLoad.data,
      ]
    );

  const filtered =
    useMemo(
      () =>
        sortTriage(
          filterTriage(
            queue,
            filters,
            username
          ),
          filters.sort,
          openedAt
        ),
      [
        queue,
        filters,
        username,
        openedAt,
      ]
    );

  const safePage =
    clampPage(
      page,
      filtered.length,
      PAGE_SIZE
    );

  const pageItems =
    paginate(
      filtered,
      safePage,
      PAGE_SIZE
    );

  const activeCaseId =
    selectedCaseId &&
    filtered.some(
      (item) =>
        item.caseId ===
        selectedCaseId
    )
      ? selectedCaseId
      : filtered[0]?.caseId ??
        null;

  const selected =
    useMemo(
      () =>
        filtered.find(
          (item) =>
            item.caseId ===
            activeCaseId
        ) ?? null,
      [
        filtered,
        activeCaseId,
      ]
    );

  const selectedOpened =
    selected
      ? openedAt.get(
          selected.caseId
        ) ?? null
      : null;

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

  const lastRun =
    useMemo(
      () =>
        (runs ?? []).reduce<
          InvestigationTriageRunSummary | null
        >(
          (latest, run) =>
            latest === null ||
            run.calculatedAt >
              latest.calculatedAt
              ? run
              : latest,
          null
        ),
      [
        runs,
      ]
    );

  const ownerChoices =
    DEMO_OWNERS.includes(
      username
    )
      ? DEMO_OWNERS
      : [
          ...DEMO_OWNERS,
          username,
        ];

  function update(
    patch: Partial<TriageFilters>
  ) {
    setFilters(
      (current) => ({
        ...current,
        ...patch,
      })
    );

    setPage(0);
  }

  function apply(
    next: TriageFilters
  ) {
    setFilters(
      next
    );

    setPage(0);
  }

  async function recalculate() {
    if (
      !canManage ||
      busy
    ) {
      return;
    }

    try {
      setAction(
        "recalculate"
      );

      setActionFailure(
        null
      );

      setNotice(
        null
      );

      const run =
        await recalculateInvestigationTriage();

      if (!isMounted()) {
        return;
      }

      setSelectedCaseId(
        null
      );

      setPage(0);

      setNotice(
        `Queue recalculated: ${run.caseCount} ${plural(
          run.caseCount,
          "case"
        )} scored.`
      );

      load.reload();
    } catch (failure) {
      if (!isMounted()) {
        return;
      }

      setActionFailure(
        failure instanceof Error
          ? failure.message
          : "Unable to recalculate investigation triage."
      );
    } finally {
      if (isMounted()) {
        setAction(
          null
        );
      }
    }
  }

  async function assignOwner() {
    if (
      !canManage ||
      !selected ||
      busy
    ) {
      return;
    }

    const caseNumber =
      selected.caseNumber;

    try {
      setAction(
        "assign"
      );

      setActionFailure(
        null
      );

      setNotice(
        null
      );

      await assignInvestigationQueueOwner(
        selected.caseId,
        owner,
        note.trim()
      );

      if (!isMounted()) {
        return;
      }

      setNotice(
        `${caseNumber} assigned to ${owner}.`
      );

      load.reload();
    } catch (failure) {
      if (!isMounted()) {
        return;
      }

      setActionFailure(
        failure instanceof Error
          ? failure.message
          : "Unable to assign investigation owner."
      );
    } finally {
      if (isMounted()) {
        setAction(
          null
        );
      }
    }
  }

  return (
    <section
      className="panel triage-panel"
      aria-busy={
        load.loading
      }
    >
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
            busy
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

      {actionFailure && (
        <div
          className="triage-error"
          role="alert"
        >
          <AlertTriangle
            size={14}
          />

          {actionFailure}
        </div>
      )}

      {notice && (
        <div
          className="ui-notice ui-wf-ok"
          role="status"
        >
          <CheckCircle2
            size={15}
            aria-hidden="true"
          />

          <span>
            {notice}
          </span>
        </div>
      )}

      {load.error &&
        !load.data && (
          <ErrorState
            title="Unable to load investigation triage"
            message={
              load.error
            }
            onRetry={
              load.reload
            }
          />
        )}

      {load.error &&
        load.data && (
          <ErrorState
            compact
            title="Could not refresh the triage queue"
            message={
              load.error
            }
            onRetry={
              load.reload
            }
          />
        )}

      {!load.error &&
        !load.data && (
          <LoadingState label="Loading triage queue" />
        )}

      {load.data && (
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
      )}

      {load.data &&
        queue.length > 0 && (
          <TriageTools
            queue={
              queue
            }
            filters={
              filters
            }
            username={
              username
            }
            hasCaseAges={
              openedAt.size >
              0
            }
            shown={
              filtered.length
            }
            loading={
              load.loading
            }
            note={
              lastRun && (
                <span
                  className="ui-wf-muted"
                  title={`Calculated ${formatDateTime(
                    lastRun.calculatedAt
                  )} UTC`}
                >
                  Last calculated{" "}
                  {formatRelativeTime(
                    lastRun.calculatedAt
                  )}
                  {" by "}
                  {shortUser(
                    lastRun.calculatedBy
                  )}
                </span>
              )
            }
            onChange={
              update
            }
            onApply={
              apply
            }
            onReload={
              load.reload
            }
            onExport={() =>
              exportRowsAsCsv(
                "Investigation triage",
                filtered,
                triageCsvColumns(
                  openedAt
                )
              )
            }
          />
        )}

      {!load.data ? null : queue.length === 0 ? (
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
          <div
            className={
              load.loading
                ? "triage-list ui-list-loading"
                : "triage-list"
            }
          >
            {filtered.length ===
              0 && (
              <EmptyState
                compact
                title="No cases match these filters"
                message="Try a different search or clear the filters."
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      apply(
                        DEFAULT_TRIAGE_FILTERS
                      )
                    }
                  >
                    Reset filters
                  </button>
                }
              />
            )}

            {pageItems.map(
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
                  aria-current={
                    item.caseId ===
                    activeCaseId
                      ? "true"
                      : undefined
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

                    <span
                      className="ui-wf-age"
                      title={
                        triageAge(
                          item,
                          openedAt
                        ).title
                      }
                    >
                      {
                        triageAge(
                          item,
                          openedAt
                        ).label
                      }
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

            <Pager
              label="Triage queue pages"
              page={
                safePage
              }
              pageSize={
                PAGE_SIZE
              }
              total={
                filtered.length
              }
              onPage={
                setPage
              }
            />
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
                      {" UTC ("}
                      {formatRelativeTime(
                        selected.calculatedAt
                      )}
                      {")"}
                    </p>

                    {selectedOpened && (
                      <p>
                        {"Case opened "}
                        {formatDateTime(
                          selectedOpened
                        )}
                        {" UTC ("}
                        {formatRelativeTime(
                          selectedOpened
                        )}
                        {")"}
                      </p>
                    )}
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
                          busy
                        }
                        onChange={(
                          event
                        ) =>
                          setOwner(
                            event.target.value
                          )
                        }
                      >
                        {ownerChoices.map(
                          (
                            choice
                          ) => (
                            <option
                              key={
                                choice
                              }
                              value={
                                choice
                              }
                            >
                              {
                                choice
                              }
                              {choice ===
                              username
                                ? " (you)"
                                : ""}
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
                          busy
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
                        busy ||
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
                        {selected.assignedAt && (
                          <span
                            className="ui-wf-age"
                            title={`Assigned ${formatDateTime(
                              selected.assignedAt
                            )} UTC`}
                          >
                            {" · "}
                            {formatRelativeTime(
                              selected.assignedAt
                            )}
                          </span>
                        )}
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
          {runs === null
            ? "History unavailable"
            : runs.length === 0
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

function shortUser(
  value: string
) {
  return value.split(
    "@"
  )[0];
}
