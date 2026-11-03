"use client";

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  History,
  Play,
  Search,
  ShieldAlert,
  UserRoundSearch,
  Users,
} from "lucide-react";

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  fetchWatchlistEntries,
  fetchWatchlistHits,
  fetchWatchlistRuns,
  reviewWatchlistHit,
  runWatchlistScreening,
  type WatchlistScreeningHit,
  type WatchlistScreeningRun,
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
  DEFAULT_HIT_FILTERS,
  HIT_CSV_COLUMNS,
  filterHits,
  scoreTone,
  sortHits,
  type HitFilters,
} from "@/lib/wf-watchlist";

import {
  useAuth,
} from "./auth-context";

import {
  ConfirmButton,
} from "./confirm-button";

import {
  Pager,
} from "./list-tools";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./state-card";

import {
  HitTools,
} from "./wf-watchlist-tools";

import {
  WatchlistEntries,
} from "./wf-watchlist-entries";

interface HitState {
  runId: string;
  items: WatchlistScreeningHit[];
}

const PAGE_SIZE = 15;

const EMPTY_RUNS: WatchlistScreeningRun[] = [];

const EMPTY_HITS: WatchlistScreeningHit[] = [];

export function WatchlistScreening() {
  const {
    hasAnyRole,
  } = useAuth();

  const isMounted =
    useIsMounted();

  const canRunScreening =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const runsLoad =
    useLoad(
      fetchWatchlistRuns,
      "Unable to load watchlist screening data."
    );

  // Only the metrics and the entries table need these.
  const entriesLoad =
    useLoad(
      fetchWatchlistEntries,
      "Unable to load watchlist entries."
    );

  // A run started here, shown at once while the list reloads.
  const [createdRun, setCreatedRun] =
    useState<WatchlistScreeningRun | null>(
      null
    );

  const [selectedRunId, setSelectedRunId] =
    useState<string | null>(
      null
    );

  const [selectedHitId, setSelectedHitId] =
    useState<string | null>(
      null
    );

  const [filters, setFilters] =
    useState<HitFilters>(
      DEFAULT_HIT_FILTERS
    );

  const [page, setPage] =
    useState(0);

  const [reviewNote, setReviewNote] =
    useState(
      "Synthetic fuzzy match reviewed against local customer context."
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

  const runs =
    useMemo(
      () => {
        const loaded =
          runsLoad.data ??
          EMPTY_RUNS;

        return createdRun &&
          !loaded.some(
            (run) =>
              run.id ===
              createdRun.id
          )
          ? [
              createdRun,
              ...loaded,
            ]
          : loaded;
      },
      [
        runsLoad.data,
        createdRun,
      ]
    );

  const activeRunId =
    selectedRunId &&
    runs.some(
      (run) =>
        run.id ===
        selectedRunId
    )
      ? selectedRunId
      : runs[0]?.id ?? null;

  const loadHits =
    useCallback(
      async (
        signal: AbortSignal
      ): Promise<HitState | null> => {
        if (!activeRunId) {
          return null;
        }

        return {
          runId:
            activeRunId,
          items:
            await fetchWatchlistHits(
              activeRunId,
              signal
            ),
        };
      },
      [
        activeRunId,
      ]
    );

  const hitsLoad =
    useLoad(
      loadHits,
      "Unable to load screening hits."
    );

  const hits =
    hitsLoad.data
      ?.runId ===
    activeRunId
      ? hitsLoad.data.items
      : EMPTY_HITS;

  // Buttons wait for any reload, so a hit is never reviewed twice.
  const busy =
    action !== null ||
    runsLoad.loading;

  const reviewBusy =
    busy ||
    hitsLoad.loading;

  const filtered =
    useMemo(
      () =>
        sortHits(
          filterHits(
            hits,
            filters
          ),
          filters.sort
        ),
      [
        hits,
        filters,
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

  const selectedHit =
    useMemo(
      () =>
        (
          selectedHitId
            ? filtered.find(
                (hit) =>
                  hit.id ===
                  selectedHitId
              )
            : null
        ) ??
        filtered[0] ??
        null,
      [
        filtered,
        selectedHitId,
      ]
    );

  const selectedRun =
    runs.find(
      (run) =>
        run.id ===
        activeRunId
    ) ?? null;

  const pendingCount =
    hits.filter(
      (hit) =>
        hit.status ===
        "PENDING_REVIEW"
    ).length;

  const entries =
    entriesLoad.data;

  function update(
    patch: Partial<HitFilters>
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
    next: HitFilters
  ) {
    setFilters(
      next
    );

    setPage(0);
  }

  async function executeScreening() {
    if (
      !canRunScreening ||
      busy
    ) {
      return;
    }

    try {
      setAction(
        "run"
      );

      setActionFailure(
        null
      );

      setNotice(
        null
      );

      const run =
        await runWatchlistScreening();

      if (!isMounted()) {
        return;
      }

      setCreatedRun(
        run
      );

      setSelectedRunId(
        run.id
      );

      setSelectedHitId(
        null
      );

      apply(
        DEFAULT_HIT_FILTERS
      );

      setNotice(
        `Screening complete: ${run.hitsFound} ${plural(
          run.hitsFound,
          "hit"
        )} from ${run.customersScanned} ${plural(
          run.customersScanned,
          "customer"
        )}.`
      );

      runsLoad.reload();
    } catch (runError) {
      if (!isMounted()) {
        return;
      }

      setActionFailure(
        runError instanceof Error
          ? runError.message
          : "Unable to execute watchlist screening."
      );
    } finally {
      if (isMounted()) {
        setAction(
          null
        );
      }
    }
  }

  async function review(
    decision:
      | "CLEARED"
      | "ESCALATED"
  ) {
    if (
      !selectedHit ||
      reviewBusy ||
      !reviewNote.trim()
    ) {
      return;
    }

    const subject =
      `${selectedHit.customerName} / ${selectedHit.watchlistName}`;

    try {
      setAction(
        decision
      );

      setActionFailure(
        null
      );

      setNotice(
        null
      );

      await reviewWatchlistHit(
        selectedHit.id,
        decision,
        reviewNote.trim()
      );

      if (!isMounted()) {
        return;
      }

      setNotice(
        `${subject}: ${
          decision ===
          "CLEARED"
            ? "match cleared"
            : "escalated"
        }.`
      );

      hitsLoad.reload();
    } catch (reviewError) {
      if (!isMounted()) {
        return;
      }

      setActionFailure(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to review screening hit."
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
      className="panel watchlist-screening-panel"
      aria-busy={
        runsLoad.loading ||
        hitsLoad.loading
      }
    >
      <div className="panel-heading watchlist-screening-heading">
        <div>
          <div className="eyebrow">
            Customer due diligence
          </div>

          <h2>
            Watchlist screening
          </h2>

          <p>
            Deterministic local screening
            against synthetic sanctions
            and PEP-style records with
            fuzzy-name explainability.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            !canRunScreening ||
            busy
          }
          title={
            canRunScreening
              ? "Run customer screening"
              : "Senior Analyst or Administrator required"
          }
          onClick={() =>
            void executeScreening()
          }
        >
          <Play size={13} />

          {action === "run"
            ? "Screening..."
            : "Run screening"}
        </button>
      </div>

      {actionFailure && (
        <div
          className="watchlist-error"
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

      {runsLoad.error &&
        !runsLoad.data && (
          <ErrorState
            title="Unable to load watchlist screening"
            message={
              runsLoad.error
            }
            onRetry={
              runsLoad.reload
            }
          />
        )}

      {runsLoad.error &&
        runsLoad.data && (
          <ErrorState
            compact
            title="Could not refresh the screening runs"
            message={
              runsLoad.error
            }
            onRetry={
              runsLoad.reload
            }
          />
        )}

      {!runsLoad.error &&
        !runsLoad.data && (
          <LoadingState label="Loading watchlist screening" />
        )}

      <div className="watchlist-metrics">
        <Metric
          label="Watchlist entries"
          value={
            entries
              ? entries.length
              : null
          }
        />

        <Metric
          label="Active entries"
          value={
            entries
              ? entries.filter(
                  (entry) =>
                    entry.active
                ).length
              : null
          }
        />

        <Metric
          label="Screening runs"
          value={
            runsLoad.data
              ? runs.length
              : null
          }
        />

        <Metric
          label="Current hits"
          value={
            hits.length
          }
        />

        <Metric
          label="Pending review"
          value={
            pendingCount
          }
        />
      </div>

      {hits.length > 0 && (
        <HitTools
          hits={
            hits
          }
          filters={
            filters
          }
          shown={
            filtered.length
          }
          note={
            selectedRun && (
              <span
                className="ui-wf-muted"
                title={`Started ${formatDateTime(
                  selectedRun.startedAt
                )} UTC`}
              >
                Run started{" "}
                {formatRelativeTime(
                  selectedRun.startedAt
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
          onExport={() =>
            exportRowsAsCsv(
              "Watchlist screening hits",
              filtered,
              HIT_CSV_COLUMNS
            )
          }
        />
      )}

      <div
        className="watchlist-layout"
        hidden={
          !runsLoad.data
        }
      >
        <div className="watchlist-left">
          <div className="watchlist-run-selector">
            <div>
              <History size={14} />

              <strong>
                Screening run
              </strong>
            </div>

            <select
              aria-label="Screening run"
              value={
                activeRunId ??
                ""
              }
              disabled={
                runs.length === 0 ||
                busy
              }
              onChange={(event) => {
                setSelectedRunId(
                  event.target.value
                );

                setSelectedHitId(
                  null
                );
              }}
            >
              {runs.length === 0 && (
                <option value="">
                  No runs yet
                </option>
              )}

              {runs.map(
                (run) => (
                  <option
                    key={
                      run.id
                    }
                    value={
                      run.id
                    }
                  >
                    {formatDateTime(
                      run.startedAt
                    )}
                    {" · "}
                    {
                      run.hitsFound
                    }
                    {" hits"}
                  </option>
                )
              )}
            </select>
          </div>

          {selectedRun && (
            <div className="watchlist-run-summary">
              <span>
                {
                  selectedRun
                    .customersScanned
                }
                {" customers"}
              </span>

              <span>
                {
                  selectedRun
                    .entriesScanned
                }
                {" entries"}
              </span>

              <span>
                {
                  selectedRun
                    .hitsFound
                }
                {" hits"}
              </span>

              <span>
                {
                  selectedRun
                    .status
                }
              </span>
            </div>
          )}

          <div
            className={
              hitsLoad.loading
                ? "screening-hit-list ui-list-loading"
                : "screening-hit-list"
            }
          >
            {activeRunId &&
              hitsLoad.error && (
                <ErrorState
                  compact
                  title="Unable to load screening hits"
                  message={
                    hitsLoad.error
                  }
                  onRetry={
                    hitsLoad.reload
                  }
                />
              )}

            {activeRunId &&
              !hitsLoad.error &&
              hitsLoad.loading &&
              hits.length ===
                0 && (
                <LoadingState
                  compact
                  label="Loading screening hits"
                />
              )}

            {activeRunId &&
              !hitsLoad.error &&
              !hitsLoad.loading &&
              hits.length ===
                0 && (
                <div className="watchlist-empty">
                  <BadgeCheck
                    size={26}
                  />

                  <strong>
                    No watchlist hits
                  </strong>

                  <span>
                    This screening run
                    produced no matches.
                  </span>
                </div>
              )}

            {!activeRunId && (
              <div className="watchlist-empty">
                <Search
                  size={26}
                />

                <strong>
                  No screening run
                </strong>

                <span>
                  Senior analysts can run
                  the synthetic screening
                  process.
                </span>
              </div>
            )}

            {hits.length >
              0 &&
              filtered.length ===
                0 && (
                <EmptyState
                  compact
                  title="No hits match these filters"
                  message="Try a different search or clear the filters."
                  action={
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        apply(
                          DEFAULT_HIT_FILTERS
                        )
                      }
                    >
                      Reset filters
                    </button>
                  }
                />
              )}

            {pageItems.map(
              (hit) => (
                <button
                  type="button"
                  key={
                    hit.id
                  }
                  className={
                    selectedHit?.id ===
                    hit.id
                      ? "screening-hit-row selected"
                      : "screening-hit-row"
                  }
                  aria-current={
                    selectedHit?.id ===
                    hit.id
                      ? "true"
                      : undefined
                  }
                  onClick={() =>
                    setSelectedHitId(
                      hit.id
                    )
                  }
                >
                  <div
                    className={
                      `screening-score screening-score-${scoreTone(
                        hit.matchScore
                      )}`
                    }
                  >
                    {
                      hit.matchScore
                    }
                  </div>

                  <div className="screening-hit-copy">
                    <strong>
                      {
                        hit.customerName
                      }
                    </strong>

                    <span>
                      {
                        hit.watchlistName
                      }
                      {" · "}
                      {
                        hit.category
                      }
                    </span>
                  </div>

                  <span
                    className={
                      `screening-status screening-status-${hit.status.toLowerCase()}`
                    }
                  >
                    {humanize(
                      hit.status
                    )}
                  </span>
                </button>
              )
            )}

            <Pager
              label="Screening hit pages"
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
        </div>

        <div className="watchlist-detail">
          {selectedHit ? (
            <>
              <div className="watchlist-detail-heading">
                <div>
                  <div className="eyebrow">
                    Match review
                  </div>

                  <h3>
                    {
                      selectedHit
                        .customerName
                    }
                  </h3>

                  <p>
                    Customer compared with
                    {
                      " "
                    }
                    {
                      selectedHit
                        .watchlistName
                    }
                  </p>
                </div>

                <div
                  className={
                    `watchlist-big-score screening-score-${scoreTone(
                      selectedHit
                        .matchScore
                    )}`
                  }
                >
                  <strong>
                    {
                      selectedHit
                        .matchScore
                    }
                  </strong>

                  <span>
                    match
                  </span>
                </div>
              </div>

              <div className="watchlist-match-grid">
                <Detail
                  label="Customer"
                  value={
                    selectedHit
                      .customerName
                  }
                />

                <Detail
                  label="Customer country"
                  value={
                    selectedHit
                      .customerCountryCode
                  }
                />

                <Detail
                  label="Customer risk"
                  value={
                    selectedHit
                      .customerRiskTier
                  }
                />

                <Detail
                  label="Watchlist record"
                  value={
                    selectedHit
                      .listKey
                  }
                />

                <Detail
                  label="Watchlist name"
                  value={
                    selectedHit
                      .watchlistName
                  }
                />

                <Detail
                  label="Category"
                  value={
                    selectedHit
                      .category
                  }
                />

                <Detail
                  label="Name similarity"
                  value={
                    `${selectedHit.nameScore}%`
                  }
                />

                <Detail
                  label="Country signal"
                  value={
                    selectedHit
                      .countryMatch
                      ? "Match"
                      : "Different"
                  }
                />
              </div>

              <div className="watchlist-explanation">
                <UserRoundSearch
                  size={16}
                />

                <div>
                  <strong>
                    Why this matched
                  </strong>

                  <p>
                    Name similarity was
                    {
                      " "
                    }
                    {
                      selectedHit
                        .nameScore
                    }
                    %. Country signal:
                    {
                      " "
                    }
                    {
                      selectedHit
                        .countryMatch
                        ? "same jurisdiction"
                        : "different jurisdiction"
                    }
                    . Final deterministic
                    score:
                    {
                      " "
                    }
                    {
                      selectedHit
                        .matchScore
                    }
                    /100.
                  </p>
                </div>
              </div>

              <div className="watchlist-source">
                <ShieldAlert
                  size={14}
                />

                <div>
                  <strong>
                    {
                      selectedHit
                        .sourceName
                    }
                  </strong>

                  <span>
                    {
                      selectedHit
                        .sourceReference
                    }
                    {" · synthetic portfolio data"}
                  </span>
                </div>
              </div>

              <div className="watchlist-review">
                <label>
                  Analyst review note

                  <textarea
                    value={
                      reviewNote
                    }
                    maxLength={
                      2000
                    }
                    onChange={(
                      event
                    ) =>
                      setReviewNote(
                        event.target
                          .value
                      )
                    }
                  />
                </label>

                {selectedHit.status ===
                "PENDING_REVIEW" ? (
                  <div className="watchlist-review-actions">
                    <ConfirmButton
                      className="secondary-button"
                      confirmLabel="Yes, clear"
                      disabled={
                        reviewBusy ||
                        !reviewNote.trim()
                      }
                      onConfirm={() =>
                        void review(
                          "CLEARED"
                        )
                      }
                    >
                      <CheckCircle2
                        size={13}
                      />
                      Clear match
                    </ConfirmButton>

                    <ConfirmButton
                      className="primary-button"
                      confirmLabel="Yes, escalate"
                      disabled={
                        reviewBusy ||
                        !reviewNote.trim()
                      }
                      onConfirm={() =>
                        void review(
                          "ESCALATED"
                        )
                      }
                    >
                      <ShieldAlert
                        size={13}
                      />
                      Escalate
                    </ConfirmButton>
                  </div>
                ) : (
                  <div className="watchlist-reviewed">
                    <BadgeCheck
                      size={15}
                    />

                    <div>
                      <strong>
                        {humanize(
                          selectedHit
                            .status
                        )}
                      </strong>

                      <span>
                        {
                          selectedHit
                            .reviewedBy
                        }
                        {" · "}
                        {
                          selectedHit
                            .reviewedAt
                            ? formatDateTime(
                                selectedHit
                                  .reviewedAt
                              )
                            : ""
                        }
                      </span>

                      <p>
                        {
                          selectedHit
                            .reviewNote
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="watchlist-empty watchlist-detail-empty">
              <Users
                size={28}
              />

              <strong>
                Match review
              </strong>

              <span>
                Select a screening hit
                to inspect its matching
                evidence.
              </span>
            </div>
          )}
        </div>
      </div>

      <WatchlistEntries
        entries={
          entries
        }
        error={
          entriesLoad.error
        }
        loading={
          entriesLoad.loading
        }
        onRetry={
          entriesLoad.reload
        }
      />
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  /** Null while the figure is not loaded. */
  value: number | null;
}) {
  return (
    <div className="watchlist-metric">
      <span>
        {label}
      </span>

      <strong>
        {value ?? "—"}
      </strong>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="watchlist-detail-cell">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}
