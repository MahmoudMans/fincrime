"use client";

import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useCallback,
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
import { exportRowsAsCsv } from "@/lib/csv";
import {
  formatDateTime,
  humanize,
} from "@/lib/format";
import {
  ALL,
  PRIORITY_ORDER,
  countOptions,
  useActionRunner,
  useFilterState,
} from "@/lib/gv-common";
import {
  CASE_PAGE_SIZE,
  DEFAULT_DECISION_FILTERS,
  NO_PROPOSAL,
  PROPOSAL_COLUMNS,
  PROPOSAL_LIMIT,
  STATE_ORDER,
  caseState,
  filterDecisionCases,
  groupProposals,
  isSelfReview,
  proposalsOfCases,
  type DecisionFilters,
} from "@/lib/gv-decisions";
import {
  clampPage,
  paginate,
  plural,
} from "@/lib/list-utils";
import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";
import { ConfirmButton } from "./confirm-button";
import {
  Banner,
  LoadNotice,
  StatusPill,
} from "./gv-parts";
import {
  ChipGroup,
  ExportButton,
  Pager,
  ResetButton,
  ResultCount,
  SavedViews,
  SearchField,
  SelectField,
  Toolbar,
} from "./list-tools";
import { StackedBar } from "./mini-charts";
import { EmptyState } from "./state-card";

const RECOMMENDATIONS = [
  "ESCALATE",
  "CONTINUE_INVESTIGATION",
  "CLOSE_NO_ACTION",
];

const BAND_ORDER = [
  "URGENT",
  "HIGH",
  "MEDIUM",
  "ROUTINE",
];

interface Draft {
  recommendation: string;
  rationale: string;
}

const DEFAULT_DRAFT: Draft = {
  recommendation: "CONTINUE_INVESTIGATION",
  rationale:
    "Continue investigation based on the currently available evidence.",
};

interface DecisionPayload {
  cases: InvestigationTriageQueueItem[];
  proposals: CaseDecisionProposal[];
}

const NO_CASES: InvestigationTriageQueueItem[] = [];

const NO_PROPOSALS: CaseDecisionProposal[] = [];

const STATE_TONES = {
  PENDING: "warning",
  APPROVED: "ok",
  REJECTED: "danger",
} as const;

function stateLabel(
  state: string
) {
  return state === NO_PROPOSAL
    ? "No proposal"
    : humanize(
        state
      );
}

function stateTone(
  state: string
) {
  return state === "PENDING"
    ? "warning"
    : state === "APPROVED"
      ? "ok"
      : state === "REJECTED"
        ? "danger"
        : "neutral";
}

export function DecisionGovernance() {
  const {
    hasAnyRole,
    session,
  } = useAuth();

  const canReview =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const fetchPayload =
    useCallback(
      async (
        signal: AbortSignal
      ): Promise<DecisionPayload> => {
        const [
          cases,
          proposals,
        ] =
          await Promise.all([
            fetchInvestigationTriageQueue(
              signal
            ),
            fetchDecisionProposals(
              signal
            ),
          ]);

        return {
          cases,
          proposals,
        };
      },
      []
    );

  const {
    data,
    error,
    loading,
    reload,
  } = useLoad(
    fetchPayload,
    "Unable to load decision governance."
  );

  const cases =
    data
      ? data.cases
      : NO_CASES;

  const proposals =
    data
      ? data.proposals
      : NO_PROPOSALS;

  const {
    filters,
    current,
    hasFilters,
    update,
    setPage,
    reset,
    apply,
  } = useFilterState<DecisionFilters>(
    DEFAULT_DECISION_FILTERS
  );

  const [
    selectedCaseId,
    setSelectedCaseId,
  ] =
    useState<string | null>(
      null
    );

  // One draft per case, so that text typed for one case is never
  // submitted for another.
  const [drafts, setDrafts] =
    useState<
      Record<string, Draft>
    >({});

  const [reviewNote, setReviewNote] =
    useState(
      "Independent four-eyes review completed."
    );

  const runner =
    useActionRunner();

  const byCase =
    useMemo(
      () =>
        groupProposals(
          proposals
        ),
      [
        proposals,
      ]
    );

  const filtered =
    useMemo(
      () =>
        filterDecisionCases(
          cases,
          byCase,
          filters
        ),
      [
        cases,
        byCase,
        filters,
      ]
    );

  const stateOptions =
    useMemo(
      () =>
        countOptions(
          filterDecisionCases(
            cases,
            byCase,
            {
              ...filters,
              state: ALL,
            }
          ).map(
            (item) =>
              caseState(
                item.caseId,
                byCase
              )
          ),
          "All cases",
          {
            order: STATE_ORDER,
            always: STATE_ORDER,
            keep: filters.state,
            tones: STATE_TONES,
            label: stateLabel,
          }
        ),
      [
        cases,
        byCase,
        filters,
      ]
    );

  const priorityOptions =
    useMemo(
      () =>
        countOptions(
          filterDecisionCases(
            cases,
            byCase,
            {
              ...filters,
              priority: ALL,
            }
          ).map(
            (item) =>
              item.casePriority
          ),
          "All priorities",
          {
            order: PRIORITY_ORDER,
            keep: filters.priority,
            label: (value) =>
              value,
          }
        ),
      [
        cases,
        byCase,
        filters,
      ]
    );

  const bandOptions =
    useMemo(
      () =>
        countOptions(
          filterDecisionCases(
            cases,
            byCase,
            {
              ...filters,
              band: ALL,
            }
          ).map(
            (item) =>
              item.triageBand
          ),
          "All triage bands",
          {
            order: BAND_ORDER,
            keep: filters.band,
          }
        ),
      [
        cases,
        byCase,
        filters,
      ]
    );

  const segments =
    useMemo(
      () =>
        (
          [
            "PENDING",
            "APPROVED",
            "REJECTED",
          ] as const
        ).map(
          (status) => ({
            key: status,
            label:
              humanize(
                status
              ),
            value:
              proposals.filter(
                (proposal) =>
                  proposal.status ===
                  status
              ).length,
            tone:
              STATE_TONES[
                status
              ],
          })
        ),
      [
        proposals,
      ]
    );

  // The selection follows the list: a case hidden by the filters
  // gives way to the first case that is still shown.
  const selectedCase =
    filtered.find(
      (item) =>
        item.caseId ===
        selectedCaseId
    ) ??
    filtered[0] ??
    null;

  const activeCaseId =
    selectedCase?.caseId ??
    null;

  const caseProposals =
    activeCaseId
      ? (
          byCase.get(
            activeCaseId
          ) ?? NO_PROPOSALS
        )
      : NO_PROPOSALS;

  const hasPending =
    caseProposals.some(
      (proposal) =>
        proposal.status ===
        "PENDING"
    );

  const draft =
    (activeCaseId
      ? drafts[
          activeCaseId
        ]
      : undefined) ??
    DEFAULT_DRAFT;

  const page =
    clampPage(
      filters.page,
      filtered.length,
      CASE_PAGE_SIZE
    );

  const visibleCases =
    paginate(
      filtered,
      page,
      CASE_PAGE_SIZE
    );

  // Nothing may be sent while a request runs or the list refreshes:
  // the screen would be deciding on out-of-date proposals.
  const busy =
    runner.pending !== null ||
    loading;

  function editDraft(
    patch: Partial<Draft>
  ) {
    if (!activeCaseId) {
      return;
    }

    setDrafts(
      (existing) => ({
        ...existing,
        [activeCaseId]: {
          ...(existing[
            activeCaseId
          ] ?? DEFAULT_DRAFT),
          ...patch,
        },
      })
    );
  }

  function submit() {
    if (
      !activeCaseId ||
      !selectedCase
    ) {
      return;
    }

    const caseId =
      activeCaseId;

    const caseNumber =
      selectedCase.caseNumber;

    void runner.run(
      "submit",
      async () => {
        await submitCaseDecisionProposal(
          caseId,
          draft.recommendation,
          draft.rationale
        );

        setDrafts(
          (existing) => ({
            ...existing,
            [caseId]:
              DEFAULT_DRAFT,
          })
        );

        reload();

        return `Proposal submitted for ${caseNumber}. A different reviewer must now approve or reject it.`;
      },
      "Unable to submit recommendation."
    );
  }

  function review(
    proposal: CaseDecisionProposal,
    decision: string
  ) {
    if (!canReview) {
      return;
    }

    void runner.run(
      `review:${proposal.id}`,
      async () => {
        await reviewCaseDecisionProposal(
          proposal.id,
          decision,
          reviewNote
        );

        reload();

        return `${proposal.caseNumber} version ${proposal.version} ${
          decision ===
          "APPROVED"
            ? "approved"
            : "rejected"
        }.`;
      },
      "Unable to review recommendation."
    );
  }

  return (
    <section
      className="panel decision-governance-panel"
      aria-busy={loading}
    >
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

      {runner.error && (
        <Banner
          kind="error"
          onDismiss={runner.dismiss}
        >
          {runner.error}
        </Banner>
      )}

      {runner.notice && (
        <Banner
          kind="ok"
          onDismiss={runner.dismiss}
        >
          {runner.notice}
        </Banner>
      )}

      <LoadNotice
        data={data}
        error={error}
        onRetry={reload}
        label="Loading decisions"
        errorTitle="Unable to load decision governance"
      />

      {data !== null && (
        <>
          {proposals.length >=
            PROPOSAL_LIMIT && (
            <div
              className="ui-notice"
              role="status"
            >
              <AlertTriangle
                size={15}
                aria-hidden="true"
              />

              <span>
                Only the
                {" "}
                {PROPOSAL_LIMIT}
                {" "}
                most recent proposals
                are loaded, so older
                proposals may be missing
                from the case history
                below.
              </span>
            </div>
          )}

          {proposals.length >
            0 && (
            <div className="ui-gv-summary">
              <StackedBar
                segments={segments}
                label="Proposals by status"
              />
            </div>
          )}

          <Toolbar label="Filter cases">
            <SearchField
              label="Search cases"
              placeholder="Search case, owner or proposal..."
              value={filters.q}
              onChange={(q) =>
                update({
                  q,
                })
              }
            />

            <SelectField
              label="Filter by priority"
              value={
                filters.priority
              }
              options={
                priorityOptions
              }
              onChange={(priority) =>
                update({
                  priority,
                })
              }
            />

            <SelectField
              label="Filter by triage band"
              value={filters.band}
              options={bandOptions}
              onChange={(band) =>
                update({
                  band,
                })
              }
            />

            <ResetButton
              disabled={!hasFilters}
              onClick={reset}
            />

            <ExportButton
              label="Export proposals"
              disabled={
                proposalsOfCases(
                  filtered,
                  byCase
                ).length === 0
              }
              onExport={() =>
                exportRowsAsCsv(
                  "decision-proposals",
                  proposalsOfCases(
                    filtered,
                    byCase
                  ),
                  PROPOSAL_COLUMNS
                )
              }
            />

            <button
              type="button"
              className="ui-icon-text-button"
              disabled={loading}
              onClick={reload}
            >
              <RefreshCw
                size={14}
                className={
                  loading
                    ? "ui-spin"
                    : undefined
                }
                aria-hidden="true"
              />

              Refresh
            </button>
          </Toolbar>

          <div className="ui-chips-row">
            <ChipGroup
              label="Filter by latest proposal"
              value={filters.state}
              options={stateOptions}
              onChange={(state) =>
                update({
                  state,
                })
              }
            />
          </div>

          <SavedViews<DecisionFilters>
            storageKey="fcg.views.decisions"
            current={current}
            canSave={hasFilters}
            onApply={apply}
          />

          <ResultCount
            shown={filtered.length}
            total={cases.length}
            noun={plural(
              cases.length,
              "case"
            )}
            filtered={hasFilters}
          />

          <div className="decision-governance-layout">
            <div className="decision-case-list">
              {cases.length ===
                0 && (
                <EmptyState
                  compact
                  title="No cases in the triage queue"
                  message="Cases appear here once an investigation triage run has been calculated."
                />
              )}

              {cases.length >
                0 &&
                filtered.length ===
                  0 && (
                <EmptyState
                  compact
                  title="No cases match these filters"
                  message="Try a different search or clear the filters."
                  action={
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={reset}
                    >
                      Clear filters
                    </button>
                  }
                />
              )}

              {visibleCases.map(
                (item) => {
                  const state =
                    caseState(
                      item.caseId,
                      byCase
                    );

                  return (
                    <button
                      key={item.caseId}
                      type="button"
                      className={
                        item.caseId ===
                        activeCaseId
                          ? "decision-case-row selected"
                          : "decision-case-row"
                      }
                      aria-pressed={
                        item.caseId ===
                        activeCaseId
                      }
                      onClick={() =>
                        setSelectedCaseId(
                          item.caseId
                        )
                      }
                    >
                      <div className="decision-score">
                        <span className="ui-visually-hidden">
                          Triage score
                        </span>

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

                        <StatusPill
                          tone={stateTone(
                            state
                          )}
                        >
                          {stateLabel(
                            state
                          )}
                        </StatusPill>
                      </div>
                    </button>
                  );
                }
              )}

              <Pager
                label="Case pages"
                page={page}
                pageSize={
                  CASE_PAGE_SIZE
                }
                total={
                  filtered.length
                }
                onPage={setPage}
              />
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
                        value={
                          draft.recommendation
                        }
                        onChange={(
                          event
                        ) =>
                          editDraft({
                            recommendation:
                              event.target
                                .value,
                          })
                        }
                      >
                        {RECOMMENDATIONS.map(
                          (value) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {humanize(
                                value
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      Rationale

                      <textarea
                        value={
                          draft.rationale
                        }
                        maxLength={
                          2000
                        }
                        onChange={(
                          event
                        ) =>
                          editDraft({
                            rationale:
                              event.target
                                .value,
                          })
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        busy ||
                        hasPending ||
                        !draft.rationale.trim()
                      }
                      onClick={submit}
                    >
                      {runner.pending ===
                      "submit"
                        ? "Submitting..."
                        : "Submit proposal"}
                    </button>
                  </div>

                  {hasPending && (
                    <p className="ui-gv-hint">
                      This case already has a
                      pending proposal. Review
                      it before submitting
                      another one.
                    </p>
                  )}

                  <div className="decision-review-note">
                    <label>
                      Reviewer rationale

                      <input
                        value={reviewNote}
                        maxLength={2000}
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

                    {!canReview && (
                      <p className="ui-gv-hint">
                        Reviewing needs the
                        Senior Analyst or
                        Administrator role.
                      </p>
                    )}
                  </div>

                  <div className="decision-history">
                    {caseProposals.length ===
                      0 && (
                      <EmptyState
                        compact
                        title="No proposal yet"
                        message="Submit a recommendation above to start the four-eyes review."
                      />
                    )}

                    {caseProposals.map(
                      (proposal) => {
                        const selfReview =
                          isSelfReview(
                            proposal,
                            session.username
                          );

                        const noteMissing =
                          !reviewNote.trim();

                        return (
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
                                {humanize(
                                  proposal.recommendation
                                )}
                              </strong>

                              <StatusPill
                                tone={stateTone(
                                  proposal.status
                                )}
                              >
                                {humanize(
                                  proposal.status
                                )}
                              </StatusPill>
                            </div>

                            <p>
                              {proposal.rationale}
                            </p>

                            <p className="ui-gv-meta">
                              Proposed by
                              {" "}
                              {proposal.proposedBy}
                              {" · "}
                              {formatDateTime(
                                proposal.proposedAt
                              )}
                            </p>

                            {proposal.status ===
                              "PENDING" && (
                              <>
                                <div className="decision-review-actions">
                                  <ConfirmButton
                                    className="ui-gv-review"
                                    confirmLabel="Yes, approve"
                                    disabled={
                                      !canReview ||
                                      busy ||
                                      noteMissing ||
                                      selfReview
                                    }
                                    onConfirm={() =>
                                      review(
                                        proposal,
                                        "APPROVED"
                                      )
                                    }
                                  >
                                    <CheckCircle2
                                      size={12}
                                      aria-hidden="true"
                                    />
                                    Approve
                                  </ConfirmButton>

                                  <ConfirmButton
                                    className="ui-gv-review"
                                    confirmLabel="Yes, reject"
                                    disabled={
                                      !canReview ||
                                      busy ||
                                      noteMissing ||
                                      selfReview
                                    }
                                    onConfirm={() =>
                                      review(
                                        proposal,
                                        "REJECTED"
                                      )
                                    }
                                  >
                                    <XCircle
                                      size={12}
                                      aria-hidden="true"
                                    />
                                    Reject
                                  </ConfirmButton>
                                </div>

                                {canReview &&
                                  selfReview && (
                                  <p className="ui-gv-hint">
                                    You proposed
                                    this version,
                                    so a different
                                    reviewer must
                                    decide it.
                                  </p>
                                )}

                                {canReview &&
                                  !selfReview &&
                                  noteMissing && (
                                  <p className="ui-gv-hint">
                                    Enter a reviewer
                                    rationale to
                                    approve or reject.
                                  </p>
                                )}
                              </>
                            )}

                            {proposal.reviewedBy && (
                              <div
                                className={
                                  proposal.status ===
                                  "REJECTED"
                                    ? "decision-review-result ui-gv-rejected"
                                    : "decision-review-result"
                                }
                              >
                                <ShieldCheck
                                  size={12}
                                  aria-hidden="true"
                                />

                                {humanize(
                                  proposal.decision ??
                                    proposal.status
                                )}
                                {" by "}
                                {proposal.reviewedBy}
                                {proposal.reviewedAt
                                  ? ` · ${formatDateTime(
                                      proposal.reviewedAt
                                    )}`
                                  : ""}
                                {proposal.reviewNote
                                  ? ` — ${proposal.reviewNote}`
                                  : ""}
                              </div>
                            )}
                          </article>
                        );
                      }
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
