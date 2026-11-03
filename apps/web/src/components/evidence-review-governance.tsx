"use client";

import {
  CheckCircle2,
  FileSearch,
  ShieldCheck,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  fetchEvidenceCustodyRegistry,
  fetchEvidenceReviews,
  reviewEvidence,
} from "@/lib/api";

import { exportRowsAsCsv } from "@/lib/csv";

import {
  buildReviewRows,
  DEFAULT_REVIEW_FILTERS,
  filterReviewRows,
  REVIEW_DECISIONS,
  REVIEW_HISTORY_COLUMNS,
  reasonForDecision,
  reviewBlockers,
  reviewStateLabel,
  type ReviewFilters,
} from "@/lib/ev-review";

import { useActionRunner } from "@/lib/ev-hooks";

import { formatDateTime, humanize } from "@/lib/format";

import { clampPage, paginate } from "@/lib/list-utils";

import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";

import { ConfirmButton } from "./confirm-button";

import {
  ReviewCoverage,
  ReviewFilterBar,
} from "./ev-review-parts";

import {
  ErrorBanner,
  SuccessBanner,
} from "./ev-ui";

import {
  ExportButton,
  Pager,
} from "./list-tools";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./state-card";

const DECISIONS = REVIEW_DECISIONS;

const LIST_PAGE_SIZE = 20;

/** Both lists the screen needs, loaded together. */
function fetchGovernance(
  signal: AbortSignal
) {
  return Promise.all([
    fetchEvidenceCustodyRegistry(
      signal
    ),
    fetchEvidenceReviews(
      signal
    ),
  ]).then(
    ([
      evidence,
      reviews,
    ]) => ({
      evidence,
      reviews,
    })
  );
}

export function EvidenceReviewGovernance() {
  const {
    session,
    hasAnyRole,
  } = useAuth();

  const canReview =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const load =
    useLoad(
      fetchGovernance,
      "Unable to load evidence review governance."
    );

  const evidence =
    useMemo(
      () =>
        load.data?.evidence ??
        [],
      [
        load.data,
      ]
    );

  const reviews =
    useMemo(
      () =>
        load.data?.reviews ??
        [],
      [
        load.data,
      ]
    );

  const [
    selectedEvidenceId,
    setSelectedEvidenceId,
  ] =
    useState<string>("");

  const [
    decision,
    setDecision,
  ] =
    useState(
      "ACCEPTED_FOR_ANALYSIS"
    );

  const [
    reviewReason,
    setReviewReason,
  ] =
    useState(
      "Evidence integrity and custody lineage are suitable for analytical use in the investigation."
    );

  const [filters, setFilters] =
    useState<ReviewFilters>(
      DEFAULT_REVIEW_FILTERS
    );

  const [page, setPage] =
    useState(
      0
    );

  const [notice, setNotice] =
    useState<string | null>(
      null
    );

  const {
    busy: action,
    error,
    clearError,
    run,
  } =
    useActionRunner();

  const rows =
    useMemo(
      () =>
        buildReviewRows(
          evidence,
          reviews
        ),
      [
        evidence,
        reviews,
      ]
    );

  const filteredRows =
    useMemo(
      () =>
        filterReviewRows(
          rows,
          filters
        ),
      [
        rows,
        filters,
      ]
    );

  const safePage =
    clampPage(
      page,
      filteredRows.length,
      LIST_PAGE_SIZE
    );

  const pageRows =
    paginate(
      filteredRows,
      safePage,
      LIST_PAGE_SIZE
    );

  // A choice that is gone from the data (or never made) falls back to
  // the first record that the filters show.
  const activeEvidenceId =
    selectedEvidenceId &&
    evidence.some(
      (
        item
      ) =>
        item.id ===
        selectedEvidenceId
    )
      ? selectedEvidenceId
      : filteredRows[0]?.evidence.id ??
        evidence[0]?.id ??
        "";

  const selectedRow =
    useMemo(
      () =>
        rows.find(
          (
            row
          ) =>
            row.evidence.id ===
            activeEvidenceId
        ) ?? null,
      [
        rows,
        activeEvidenceId,
      ]
    );

  const selectedEvidence =
    selectedRow?.evidence ??
    null;

  const selectedReviews =
    useMemo(
      () =>
        reviews
          .filter(
            (
              item
            ) =>
              item.evidenceId ===
              activeEvidenceId
          )
          .sort(
            (
              left,
              right
            ) =>
              right.reviewVersion -
              left.reviewVersion
          ),
      [
        reviews,
        activeEvidenceId,
      ]
    );

  const currentReviews =
    useMemo(
      () =>
        reviews.filter(
          (
            item
          ) =>
            item.lineageCurrent
        ),
      [
        reviews,
      ]
    );

  const acceptedCount =
    useMemo(
      () =>
        currentReviews.filter(
          (
            item
          ) =>
            item.reviewDecision ===
            "ACCEPTED_FOR_ANALYSIS"
        ).length,
      [
        currentReviews,
      ]
    );

  const blockers =
    selectedRow
      ? reviewBlockers(
          {
            canReview,
            evidence:
              selectedRow.evidence,
            current:
              selectedRow.current,
            username:
              session.username,
          }
        )
      : [];

  function updateFilters(
    patch: Partial<ReviewFilters>
  ) {
    setFilters(
      (current) => ({
        ...current,
        ...patch,
      })
    );

    setPage(
      0
    );
  }

  function resetFilters() {
    setFilters(
      DEFAULT_REVIEW_FILTERS
    );

    setPage(
      0
    );
  }

  function applyFilters(
    next: ReviewFilters
  ) {
    setFilters(
      next
    );

    setPage(
      0
    );
  }

  async function submitReview() {
    if (
      !selectedEvidence ||
      blockers.length > 0
    ) {
      return;
    }

    const evidenceId =
      selectedEvidence.id;

    setNotice(
      null
    );

    await run(
      `review:${evidenceId}`,
      () =>
        reviewEvidence(
          evidenceId,
          decision,
          reviewReason.trim()
        ),
      "Unable to record evidence review.",
      (created) => {
        setNotice(
          `Recorded review version ${created.reviewVersion} (${humanize(created.reviewDecision)}) for ${created.evidenceReference}.`
        );

        load.reload();
      }
    );
  }

  return (
    <section
      className="panel evidence-review-panel"
      aria-busy={load.loading}
    >
      <div className="panel-heading evidence-review-heading">
        <div>
          <div className="eyebrow">
            Analytical-use governance
          </div>

          <h2>
            Evidence review governance
          </h2>

          <p>
            Integrity-verified evidence can
            receive an independent review
            anchored to its exact registry
            fingerprint and custody-chain
            head.
          </p>
        </div>

        <div className="evidence-review-badge">
          <ShieldCheck
            size={13}
          />

          Independent review
        </div>
      </div>

      {notice && (
        <SuccessBanner
          message={notice}
          onDismiss={() =>
            setNotice(null)
          }
        />
      )}

      {load.error && (
        <ErrorState
          compact
          title="Unable to load evidence reviews"
          message={load.error}
          onRetry={load.reload}
        />
      )}

      {load.data === null &&
        load.loading && (
          <LoadingState
            compact
            label="Loading evidence reviews"
          />
        )}

      {load.data !== null && (
      <>
      <div className="evidence-review-metrics">
        <Metric
          label="Evidence"
          value={
            evidence.length
          }
        />

        <Metric
          label="Current reviews"
          value={
            currentReviews.length
          }
        />

        <Metric
          label="Accepted"
          value={
            acceptedCount
          }
        />
      </div>

      {evidence.length > 0 && (
        <>
          <ReviewCoverage
            rows={rows}
          />

          <ReviewFilterBar
            rows={rows}
            filters={filters}
            filtered={filteredRows}
            refreshing={
              load.loading
            }
            onChange={updateFilters}
            onReset={resetFilters}
            onApply={applyFilters}
            onRefresh={load.reload}
          />
        </>
      )}

      <div className="evidence-review-layout">
        <div className="evidence-review-list">
          {evidence.length === 0 && (
            <EmptyState
              compact
              icon={
                <FileSearch
                  size={22}
                  aria-hidden="true"
                />
              }
              title="No evidence to review"
              message="Register evidence in Chain of custody and verify its integrity to make it reviewable."
            />
          )}

          {evidence.length > 0 &&
            filteredRows.length === 0 && (
              <EmptyState
                compact
                title="No evidence matches these filters"
                message="Try a different search or clear the filters."
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetFilters}
                  >
                    Reset filters
                  </button>
                }
              />
            )}

          {pageRows.map(
            (
              row
            ) => {
              const item =
                row.evidence;

              return (
                <button
                  key={
                    item.id
                  }
                  type="button"
                  aria-current={
                    item.id ===
                    activeEvidenceId
                      ? "true"
                      : undefined
                  }
                  className={
                    item.id ===
                    activeEvidenceId
                      ? "evidence-review-list-row selected"
                      : "evidence-review-list-row"
                  }
                  onClick={() =>
                    setSelectedEvidenceId(
                      item.id
                    )
                  }
                >
                  <div>
                    <strong>
                      {
                        item.evidenceReference
                      }
                    </strong>

                    <span>
                      {
                        item.caseNumber
                      }
                      {" · "}
                      {
                        humanize(
                          item.currentStatus
                        )
                      }
                    </span>
                  </div>

                  <div
                    className={
                      row.current
                        ? `evidence-review-list-state reviewed ui-ev-rs-${row.state.toLowerCase()}`
                        : "evidence-review-list-state"
                    }
                  >
                    {reviewStateLabel(
                      row.state
                    )}
                  </div>
                </button>
              );
            }
          )}

          <Pager
            page={safePage}
            pageSize={LIST_PAGE_SIZE}
            total={filteredRows.length}
            label="Evidence pages"
            onPage={setPage}
          />
        </div>

        <div className="evidence-review-workspace">
          {selectedEvidence ? (
            <>
              <div className="evidence-review-detail-head">
                <div>
                  <div className="eyebrow">
                    Evidence lineage
                  </div>

                  <h3>
                    {
                      selectedEvidence.title
                    }
                  </h3>

                  <p>
                    {
                      selectedEvidence.evidenceReference
                    }
                    {" · custodian "}
                    {
                      selectedEvidence.currentCustodian
                    }
                    {" · "}
                    {
                      humanize(
                        selectedEvidence.currentStatus
                      )
                    }
                  </p>
                </div>

                <div
                  className={
                    selectedEvidence.currentStatus ===
                    "VERIFIED"
                      ? "evidence-review-integrity valid"
                      : "evidence-review-integrity"
                  }
                >
                  <ShieldCheck
                    size={12}
                  />

                  {
                    selectedEvidence.currentStatus ===
                    "VERIFIED"
                      ? "Integrity verified"
                      : "Review blocked"
                  }
                </div>
              </div>

              <div className="evidence-review-anchor-grid">
                <Anchor
                  label="Registry fingerprint"
                  value={
                    selectedEvidence.registryFingerprint
                  }
                />

                <Anchor
                  label="Current custodian"
                  value={
                    selectedEvidence.currentCustodian
                  }
                />
              </div>

              <div className="evidence-review-form">
                <label>
                  <span>
                    Review decision
                  </span>

                  <select
                    value={
                      decision
                    }
                    disabled={
                      !canReview ||
                      action !== null
                    }
                    onChange={(
                      event
                    ) => {
                      setDecision(
                        event.target.value
                      );

                      setReviewReason(
                        (
                          current
                        ) =>
                          reasonForDecision(
                            current,
                            event.target.value
                          )
                      );
                    }}
                  >
                    {DECISIONS.map(
                      (
                        value
                      ) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {
                            humanize(
                              value
                            )
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Review rationale
                  </span>

                  <input
                    value={
                      reviewReason
                    }
                    maxLength={
                      2000
                    }
                    disabled={
                      !canReview ||
                      action !== null
                    }
                    onChange={(
                      event
                    ) =>
                      setReviewReason(
                        event.target.value
                      )
                    }
                  />
                </label>

                <ConfirmButton
                  className="primary-button"
                  confirmLabel="Yes, record review"
                  disabled={
                    action !== null ||
                    blockers.length > 0 ||
                    !reviewReason.trim()
                  }
                  onConfirm={() =>
                    void submitReview()
                  }
                >
                  <FileSearch
                    size={12}
                  />

                  {action ===
                  `review:${selectedEvidence.id}`
                    ? "Recording..."
                    : "Record review"}
                </ConfirmButton>
              </div>

              {blockers.length > 0 && (
                <div
                  className="ui-notice"
                  role="status"
                >
                  <ShieldCheck
                    size={15}
                    aria-hidden="true"
                  />

                  <div>
                    <strong>
                      A review cannot be recorded yet
                    </strong>

                    <ul className="ui-ev-blockers">
                      {blockers.map(
                        (
                          blocker
                        ) => (
                          <li
                            key={
                              blocker
                            }
                          >
                            {
                              blocker
                            }
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {error && (
                <ErrorBanner
                  message={error}
                  onDismiss={clearError}
                />
              )}

              <div className="evidence-review-history">
                <div className="evidence-review-history-heading">
                  <div>
                    <FileSearch
                      size={14}
                    />

                    <strong>
                      Review history
                    </strong>
                  </div>

                  <span>
                    {
                      selectedReviews.length
                    }
                    {" versions"}
                  </span>

                  <ExportButton
                    label="Export history"
                    disabled={
                      selectedReviews.length ===
                      0
                    }
                    onExport={() =>
                      exportRowsAsCsv(
                        `Evidence review history ${selectedEvidence.evidenceReference}`,
                        selectedReviews,
                        REVIEW_HISTORY_COLUMNS
                      )
                    }
                  />
                </div>

                {selectedReviews.length ===
                  0 && (
                  <div className="evidence-review-empty">
                    <FileSearch
                      size={22}
                    />

                    <strong>
                      No analytical-use review yet
                    </strong>
                  </div>
                )}

                {selectedReviews.map(
                  (
                    review
                  ) => (
                    <article
                      key={
                        review.id
                      }
                      className="evidence-review-history-row"
                    >
                      <div className="evidence-review-history-top">
                        <div>
                          <strong>
                            Version
                            {" "}
                            {
                              review.reviewVersion
                            }
                            {" · "}
                            {
                              humanize(
                                review.reviewDecision
                              )
                            }
                          </strong>

                          <span>
                            {
                              review.reviewedBy
                            }
                            {" · "}
                            {
                              formatDateTime(
                                review.reviewedAt
                              )
                            }
                          </span>
                        </div>

                        <div
                          className={
                            review.lineageCurrent
                              ? "evidence-review-lineage current"
                              : "evidence-review-lineage"
                          }
                        >
                          {review.lineageCurrent
                            ? "Current lineage"
                            : "Historical lineage"}
                        </div>
                      </div>

                      <p>
                        {
                          review.reviewReason
                        }
                      </p>

                      <div className="evidence-review-hash">
                        <span>
                          Registry
                        </span>

                        <code>
                          {
                            review.registryFingerprint
                          }
                        </code>
                      </div>

                      <div className="evidence-review-hash">
                        <span>
                          Custody head
                        </span>

                        <code>
                          {
                            review.custodyHeadHash
                          }
                        </code>
                      </div>

                      {review.lineageCurrent && (
                        <div className="evidence-review-current-proof">
                          <CheckCircle2
                            size={12}
                          />

                          Review remains anchored
                          to the current verified
                          evidence lineage.
                        </div>
                      )}
                    </article>
                  )
                )}
              </div>
            </>
          ) : (
            <div className="evidence-review-empty large">
              <FileSearch
                size={26}
              />

              <strong>
                No evidence available
              </strong>
            </div>
          )}
        </div>
      </div>
      </>
      )}
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
    <div className="evidence-review-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Anchor({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="evidence-review-anchor">
      <span>
        {label}
      </span>

      <code>
        {value}
      </code>
    </div>
  );
}
