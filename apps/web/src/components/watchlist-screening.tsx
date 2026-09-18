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
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchWatchlistEntries,
  fetchWatchlistHits,
  fetchWatchlistRuns,
  reviewWatchlistHit,
  runWatchlistScreening,
  type WatchlistEntry,
  type WatchlistScreeningHit,
  type WatchlistScreeningRun,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

interface HitState {
  runId: string;
  items: WatchlistScreeningHit[];
}

export function WatchlistScreening() {
  const {
    hasAnyRole,
  } = useAuth();

  const canRunScreening =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [entries, setEntries] =
    useState<
      WatchlistEntry[]
    >([]);

  const [runs, setRuns] =
    useState<
      WatchlistScreeningRun[]
    >([]);

  const [selectedRunId, setSelectedRunId] =
    useState<string | null>(
      null
    );

  const [hitState, setHitState] =
    useState<HitState | null>(
      null
    );

  const [selectedHitId, setSelectedHitId] =
    useState<string | null>(
      null
    );

  const [reviewNote, setReviewNote] =
    useState(
      "Synthetic fuzzy match reviewed against local customer context."
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
      fetchWatchlistEntries(
        controller.signal
      ),
      fetchWatchlistRuns(
        controller.signal
      ),
    ])
      .then(
        ([
          loadedEntries,
          loadedRuns,
        ]) => {
          setEntries(
            loadedEntries
          );

          setRuns(
            loadedRuns
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
              : "Unable to load watchlist screening data."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  const activeRunId =
    selectedRunId &&
    runs.some(
      (run) =>
        run.id ===
        selectedRunId
    )
      ? selectedRunId
      : runs[0]?.id ?? null;

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    const controller =
      new AbortController();

    void fetchWatchlistHits(
      activeRunId,
      controller.signal
    )
      .then((items) => {
        setHitState({
          runId:
            activeRunId,
          items,
        });

        setError(null);
      })
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
              : "Unable to load screening hits."
          );
        }
      );

    return () =>
      controller.abort();
  }, [
    activeRunId,
  ]);

    const hits =
    useMemo(
      () =>
        hitState?.runId ===
        activeRunId
          ? hitState.items
          : [],
      [
        hitState,
        activeRunId,
      ]
    );


  const selectedHit =
    useMemo(
      () =>
        (
          selectedHitId
            ? hits.find(
                (hit) =>
                  hit.id ===
                  selectedHitId
              )
            : null
        ) ??
        hits[0] ??
        null,
      [
        hits,
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

  async function executeScreening() {
    if (
      !canRunScreening
    ) {
      return;
    }

    try {
      setAction(
        "run"
      );

      setError(
        null
      );

      const run =
        await runWatchlistScreening();

      const [
        refreshedRuns,
        newHits,
      ] =
        await Promise.all([
          fetchWatchlistRuns(),
          fetchWatchlistHits(
            run.id
          ),
        ]);

      setRuns(
        refreshedRuns
      );

      setSelectedRunId(
        run.id
      );

      setHitState({
        runId:
          run.id,
        items:
          newHits,
      });

      setSelectedHitId(
        newHits[0]?.id ??
        null
      );
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "Unable to execute watchlist screening."
      );
    } finally {
      setAction(
        null
      );
    }
  }

  async function review(
    decision:
      | "CLEARED"
      | "ESCALATED"
  ) {
    if (
      !selectedHit ||
      !reviewNote.trim()
    ) {
      return;
    }

    try {
      setAction(
        decision
      );

      setError(
        null
      );

      const updated =
        await reviewWatchlistHit(
          selectedHit.id,
          decision,
          reviewNote.trim()
        );

      setHitState(
        (current) => {
          if (
            !current ||
            current.runId !==
              activeRunId
          ) {
            return current;
          }

          return {
            ...current,
            items:
              current.items.map(
                (item) =>
                  item.id ===
                  updated.id
                    ? updated
                    : item
              ),
          };
        }
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to review screening hit."
      );
    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel watchlist-screening-panel">
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
            action !== null
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

      {error && (
        <div className="watchlist-error">
          <AlertTriangle
            size={14}
          />

          {error}
        </div>
      )}

      <div className="watchlist-metrics">
        <Metric
          label="Watchlist entries"
          value={
            entries.length
          }
        />

        <Metric
          label="Active entries"
          value={
            entries.filter(
              (entry) =>
                entry.active
            ).length
          }
        />

        <Metric
          label="Screening runs"
          value={
            runs.length
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

      <div className="watchlist-layout">
        <div className="watchlist-left">
          <div className="watchlist-run-selector">
            <div>
              <History size={14} />

              <strong>
                Screening run
              </strong>
            </div>

            <select
              value={
                activeRunId ??
                ""
              }
              disabled={
                runs.length === 0
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

          <div className="screening-hit-list">
            {activeRunId &&
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

            {hits.map(
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
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        action !== null ||
                        !reviewNote.trim()
                      }
                      onClick={() =>
                        void review(
                          "CLEARED"
                        )
                      }
                    >
                      <CheckCircle2
                        size={13}
                      />
                      Clear match
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        action !== null ||
                        !reviewNote.trim()
                      }
                      onClick={() =>
                        void review(
                          "ESCALATED"
                        )
                      }
                    >
                      <ShieldAlert
                        size={13}
                      />
                      Escalate
                    </button>
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
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="watchlist-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
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
      (character) =>
        character.toUpperCase()
    );
}

function scoreTone(
  score: number
) {
  if (score >= 95) {
    return "critical";
  }

  if (score >= 85) {
    return "high";
  }

  return "medium";
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
