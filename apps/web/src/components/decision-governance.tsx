"use client";

import {
  CheckCircle2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchDecisionProposals,
  fetchInvestigationTriageQueue,
  reviewCaseDecisionProposal,
  submitCaseDecisionProposal,
  type CaseDecisionProposal,
  type InvestigationTriageQueueItem,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

const RECOMMENDATIONS = [
  "ESCALATE",
  "CONTINUE_INVESTIGATION",
  "CLOSE_NO_ACTION",
];

export function DecisionGovernance() {
  const {
    hasAnyRole,
  } = useAuth();

  const canReview =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [cases, setCases] =
    useState<
      InvestigationTriageQueueItem[]
    >([]);

  const [proposals, setProposals] =
    useState<
      CaseDecisionProposal[]
    >([]);

  const [
    selectedCaseId,
    setSelectedCaseId,
  ] =
    useState<string | null>(
      null
    );

  const [
    recommendation,
    setRecommendation,
  ] =
    useState(
      "CONTINUE_INVESTIGATION"
    );

  const [rationale, setRationale] =
    useState(
      "Continue investigation based on the currently available evidence."
    );

  const [reviewNote, setReviewNote] =
    useState(
      "Independent four-eyes review completed."
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
      fetchDecisionProposals(
        controller.signal
      ),
    ])
      .then(
        ([
          queue,
          decisions,
        ]) => {
          setCases(queue);
          setProposals(decisions);
          setError(null);
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
              : "Unable to load decision governance."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  const activeCaseId =
    selectedCaseId &&
    cases.some(
      (item) =>
        item.caseId ===
        selectedCaseId
    )
      ? selectedCaseId
      : cases[0]?.caseId ??
        null;

  const selectedCase =
    useMemo(
      () =>
        cases.find(
          (item) =>
            item.caseId ===
            activeCaseId
        ) ?? null,
      [
        cases,
        activeCaseId,
      ]
    );

  const caseProposals =
    useMemo(
      () =>
        proposals.filter(
          (proposal) =>
            proposal.caseId ===
            activeCaseId
        ),
      [
        proposals,
        activeCaseId,
      ]
    );

  async function refresh() {
    setProposals(
      await fetchDecisionProposals()
    );
  }

  async function submit() {
    if (!activeCaseId) {
      return;
    }

    try {
      setAction("submit");
      setError(null);

      await submitCaseDecisionProposal(
        activeCaseId,
        recommendation,
        rationale
      );

      await refresh();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to submit recommendation."
      );

    } finally {
      setAction(null);
    }
  }

  async function review(
    proposalId: string,
    decision: string
  ) {
    if (!canReview) {
      return;
    }

    try {
      setAction(proposalId);
      setError(null);

      await reviewCaseDecisionProposal(
        proposalId,
        decision,
        reviewNote
      );

      await refresh();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to review recommendation."
      );

    } finally {
      setAction(null);
    }
  }

  return (
    <section className="panel decision-governance-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">
            Maker-checker governance
          </div>

          <h2>
            Four-eyes investigation decisions
          </h2>

          <p>
            Versioned recommendations
            require independent review
            before approval or rejection.
          </p>
        </div>
      </div>

      {error && (
        <div className="decision-governance-error">
          <XCircle size={14} />

          {error}
        </div>
      )}

      <div className="decision-governance-layout">
        <div className="decision-case-list">
          {cases.map(
            (item) => (
              <button
                key={item.caseId}
                type="button"
                className={
                  item.caseId ===
                  activeCaseId
                    ? "decision-case-row selected"
                    : "decision-case-row"
                }
                onClick={() =>
                  setSelectedCaseId(
                    item.caseId
                  )
                }
              >
                <div className="decision-score">
                  {item.triageScore}
                </div>

                <div>
                  <strong>
                    {item.caseNumber}
                  </strong>

                  <span>
                    {item.casePriority}
                    {" · "}
                    {item.triageBand}
                  </span>
                </div>
              </button>
            )
          )}
        </div>

        <div className="decision-governance-workspace">
          {selectedCase && (
            <>
              <div className="decision-case-head">
                <div>
                  <div className="eyebrow">
                    Investigation case
                  </div>

                  <h3>
                    {selectedCase.caseNumber}
                  </h3>

                  <p>
                    {selectedCase.casePriority}
                    {" · "}
                    {selectedCase.caseStatus}
                    {" · "}
                    {selectedCase.triageScore}
                    /100
                  </p>
                </div>
              </div>

              <div className="decision-submit-card">
                <label>
                  Recommendation

                  <select
                    value={recommendation}
                    onChange={(
                      event
                    ) =>
                      setRecommendation(
                        event.target.value
                      )
                    }
                  >
                    {RECOMMENDATIONS.map(
                      (value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Rationale

                  <textarea
                    value={rationale}
                    onChange={(
                      event
                    ) =>
                      setRationale(
                        event.target.value
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    action !== null ||
                    !rationale.trim()
                  }
                  onClick={() =>
                    void submit()
                  }
                >
                  Submit proposal
                </button>
              </div>

              <div className="decision-review-note">
                <label>
                  Reviewer rationale

                  <input
                    value={reviewNote}
                    disabled={!canReview}
                    onChange={(
                      event
                    ) =>
                      setReviewNote(
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <div className="decision-history">
                {caseProposals.map(
                  (proposal) => (
                    <article
                      key={proposal.id}
                      className="decision-history-row"
                    >
                      <div className="decision-history-top">
                        <strong>
                          Version
                          {" "}
                          {proposal.version}
                          {" · "}
                          {proposal.recommendation}
                        </strong>

                        <span>
                          {proposal.status}
                        </span>
                      </div>

                      <p>
                        {proposal.rationale}
                      </p>

                      {proposal.status ===
                        "PENDING" && (
                        <div className="decision-review-actions">
                          <button
                            type="button"
                            disabled={
                              !canReview ||
                              action !== null
                            }
                            onClick={() =>
                              void review(
                                proposal.id,
                                "APPROVED"
                              )
                            }
                          >
                            <CheckCircle2
                              size={12}
                            />
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={
                              !canReview ||
                              action !== null
                            }
                            onClick={() =>
                              void review(
                                proposal.id,
                                "REJECTED"
                              )
                            }
                          >
                            <XCircle
                              size={12}
                            />
                            Reject
                          </button>
                        </div>
                      )}

                      {proposal.reviewedBy && (
                        <div className="decision-review-result">
                          <ShieldCheck
                            size={12}
                          />

                          Reviewed by
                          {" "}
                          {proposal.reviewedBy}
                        </div>
                      )}
                    </article>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
