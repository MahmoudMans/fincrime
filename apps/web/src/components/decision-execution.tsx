"use client";

import {
  CheckCircle2,
  FileCheck2,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  executeCaseDecision,
  fetchDecisionExecutions,
  fetchDecisionProposals,
  fetchGovernedCaseOutcomes,
  type CaseDecisionExecution,
  type CaseDecisionProposal,
  type GovernedCaseOutcome,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

export function DecisionExecution() {
  const {
    hasAnyRole,
  } = useAuth();

  const canExecute =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [proposals, setProposals] =
    useState<
      CaseDecisionProposal[]
    >([]);

  const [executions, setExecutions] =
    useState<
      CaseDecisionExecution[]
    >([]);

  const [outcomes, setOutcomes] =
    useState<
      GovernedCaseOutcome[]
    >([]);

  const [note, setNote] =
    useState(
      "Execute the independently approved investigation decision."
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
      fetchDecisionProposals(
        controller.signal
      ),
      fetchDecisionExecutions(
        controller.signal
      ),
      fetchGovernedCaseOutcomes(
        controller.signal
      ),
    ])
      .then(
        ([
          loadedProposals,
          loadedExecutions,
          loadedOutcomes,
        ]) => {
          setProposals(
            loadedProposals
          );

          setExecutions(
            loadedExecutions
          );

          setOutcomes(
            loadedOutcomes
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
              : "Unable to load governed outcomes."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  const executedProposalIds =
    useMemo(
      () =>
        new Set(
          executions.map(
            (execution) =>
              execution.proposalId
          )
        ),
      [
        executions,
      ]
    );

  const executable =
    useMemo(
      () =>
        proposals.filter(
          (proposal) =>
            proposal.status ===
              "APPROVED" &&
            !executedProposalIds.has(
              proposal.id
            )
        ),
      [
        proposals,
        executedProposalIds,
      ]
    );

  async function reload() {
    const [
      loadedProposals,
      loadedExecutions,
      loadedOutcomes,
    ] =
      await Promise.all([
        fetchDecisionProposals(),
        fetchDecisionExecutions(),
        fetchGovernedCaseOutcomes(),
      ]);

    setProposals(
      loadedProposals
    );

    setExecutions(
      loadedExecutions
    );

    setOutcomes(
      loadedOutcomes
    );
  }

  async function execute(
    proposalId: string
  ) {
    if (!canExecute) {
      return;
    }

    try {
      setAction(
        proposalId
      );

      setError(
        null
      );

      await executeCaseDecision(
        proposalId,
        note
      );

      await reload();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to execute approved decision."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel decision-execution-panel">
      <div className="panel-heading decision-execution-heading">
        <div>
          <div className="eyebrow">
            Controlled outcome execution
          </div>

          <h2>
            Governed case outcomes
          </h2>

          <p>
            Approved four-eyes
            recommendations can be
            executed once and preserved as
            governed investigation
            outcomes.
          </p>
        </div>

        <div className="decision-execution-control">
          <ShieldCheck
            size={13}
          />

          Approved decisions only
        </div>
      </div>

      {error && (
        <div className="decision-execution-error">
          {error}
        </div>
      )}

      <div className="decision-execution-metrics">
        <Metric
          label="Executable"
          value={
            executable.length
          }
        />

        <Metric
          label="Executed"
          value={
            executions.length
          }
        />

        <Metric
          label="Governed outcomes"
          value={
            outcomes.length
          }
        />
      </div>

      <div className="decision-execution-grid">
        <div className="decision-execution-card">
          <div className="decision-execution-card-heading">
            <div>
              <PlayCircle
                size={14}
              />

              <strong>
                Approved decisions
              </strong>
            </div>

            <span>
              {
                executable.length
              }
              {" ready"}
            </span>
          </div>

          <div className="decision-execution-note">
            <label>
              <span>
                Execution rationale
              </span>

              <input
                type="text"
                value={
                  note
                }
                maxLength={
                  2000
                }
                disabled={
                  !canExecute ||
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
          </div>

          <div className="decision-executable-list">
            {executable.length ===
              0 && (
              <div className="decision-execution-empty">
                <CheckCircle2
                  size={21}
                />

                <strong>
                  No approved decision waiting
                </strong>
              </div>
            )}

            {executable.map(
              (proposal) => (
                <article
                  key={
                    proposal.id
                  }
                  className="decision-executable-row"
                >
                  <div>
                    <strong>
                      {
                        proposal.caseNumber
                      }
                      {" · v"}
                      {
                        proposal.version
                      }
                    </strong>

                    <span>
                      {
                        proposal.recommendation
                      }
                      {" · reviewed by "}
                      {
                        proposal.reviewedBy
                      }
                    </span>
                  </div>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      !canExecute ||
                      action !== null ||
                      note.trim()
                        .length ===
                        0
                    }
                    onClick={() =>
                      void execute(
                        proposal.id
                      )
                    }
                  >
                    <PlayCircle
                      size={12}
                    />

                    {action ===
                    proposal.id
                      ? "Executing..."
                      : "Execute"}
                  </button>
                </article>
              )
            )}
          </div>
        </div>

        <div className="decision-execution-card">
          <div className="decision-execution-card-heading">
            <div>
              <FileCheck2
                size={14}
              />

              <strong>
                Current governed outcomes
              </strong>
            </div>

            <span>
              {
                outcomes.length
              }
              {" cases"}
            </span>
          </div>

          <div className="governed-outcome-list">
            {outcomes.length ===
              0 && (
              <div className="decision-execution-empty">
                <FileCheck2
                  size={21}
                />

                <strong>
                  No governed outcome yet
                </strong>
              </div>
            )}

            {outcomes.map(
              (outcome) => (
                <article
                  key={
                    outcome.caseId
                  }
                  className="governed-outcome-row"
                >
                  <div>
                    <strong>
                      {
                        outcome.caseNumber
                      }
                    </strong>

                    <span>
                      Decision v
                      {
                        outcome.decisionVersion
                      }
                      {" · "}
                      {
                        outcome.lastUpdatedBy
                      }
                    </span>
                  </div>

                  <div className="governed-outcome-badge">
                    {
                      humanize(
                        outcome.governedOutcome
                      )
                    }
                  </div>
                </article>
              )
            )}
          </div>
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
    <div className="decision-execution-metric">
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
      (
        character
      ) =>
        character.toUpperCase()
    );
}
