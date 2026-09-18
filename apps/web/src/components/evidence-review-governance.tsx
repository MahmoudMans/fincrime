"use client";

import {
  CheckCircle2,
  FileSearch,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchEvidenceCustodyRegistry,
  fetchEvidenceReviews,
  reviewEvidence,
  type EvidenceCustodyRecord,
  type EvidenceReviewRecord,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

const DECISIONS = [
  "ACCEPTED_FOR_ANALYSIS",
  "QUESTIONED",
  "EXCLUDED",
];

export function EvidenceReviewGovernance() {
  const {
    hasAnyRole,
  } = useAuth();

  const canReview =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [evidence, setEvidence] =
    useState<
      EvidenceCustodyRecord[]
    >([]);

  const [reviews, setReviews] =
    useState<
      EvidenceReviewRecord[]
    >([]);

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
      fetchEvidenceCustodyRegistry(
        controller.signal
      ),
      fetchEvidenceReviews(
        controller.signal
      ),
    ])
      .then(
        ([
          loadedEvidence,
          loadedReviews,
        ]) => {
          setEvidence(
            loadedEvidence
          );

          setReviews(
            loadedReviews
          );

          setError(
            null
          );
        }
      )
      .catch(
        (
          loadError: unknown
        ) => {
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
              : "Unable to load evidence review governance."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

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
      : evidence[0]?.id ??
        "";

  const selectedEvidence =
    useMemo(
      () =>
        evidence.find(
          (
            item
          ) =>
            item.id ===
            activeEvidenceId
        ) ?? null,
      [
        evidence,
        activeEvidenceId,
      ]
    );

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

  async function reload() {
    const [
      loadedEvidence,
      loadedReviews,
    ] =
      await Promise.all([
        fetchEvidenceCustodyRegistry(),
        fetchEvidenceReviews(),
      ]);

    setEvidence(
      loadedEvidence
    );

    setReviews(
      loadedReviews
    );
  }

  async function submitReview() {
    if (
      !selectedEvidence
    ) {
      return;
    }

    try {
      setAction(
        "review"
      );

      setError(
        null
      );

      await reviewEvidence(
        selectedEvidence.id,
        decision,
        reviewReason
      );

      await reload();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to record evidence review."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel evidence-review-panel">
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

      {error && (
        <div className="evidence-review-error">
          {error}
        </div>
      )}

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

      <div className="evidence-review-layout">
        <div className="evidence-review-list">
          {evidence.map(
            (
              item
            ) => {
              const currentReview =
                reviews.find(
                  (
                    review
                  ) =>
                    review.evidenceId ===
                      item.id &&
                    review.lineageCurrent
                );

              return (
                <button
                  key={
                    item.id
                  }
                  type="button"
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
                      currentReview
                        ? "evidence-review-list-state reviewed"
                        : "evidence-review-list-state"
                    }
                  >
                    {currentReview
                      ? humanize(
                          currentReview.reviewDecision
                        )
                      : "Not reviewed"}
                  </div>
                </button>
              );
            }
          )}
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
                    ) =>
                      setDecision(
                        event.target.value
                      )
                    }
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

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    !canReview ||
                    action !== null ||
                    selectedEvidence.currentStatus !==
                      "VERIFIED" ||
                    !reviewReason.trim()
                  }
                  onClick={() =>
                    void submitReview()
                  }
                >
                  <FileSearch
                    size={12}
                  />

                  {action ===
                  "review"
                    ? "Recording..."
                    : "Record review"}
                </button>
              </div>

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
    new Date(
      value
    )
  );
}
