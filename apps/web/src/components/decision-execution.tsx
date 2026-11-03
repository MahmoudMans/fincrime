"use client";

import {
  CheckCircle2,
  FileCheck2,
  PlayCircle,
  RefreshCw,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import {
  useCallback,
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
import { exportRowsAsCsv } from "@/lib/csv";
import { humanize } from "@/lib/format";
import {
  ALL,
  PRIORITY_ORDER,
  countOptions,
  useActionRunner,
  useFilterState,
} from "@/lib/gv-common";
import {
  DEFAULT_EXECUTION_FILTERS,
  EXECUTION_COLUMNS,
  LEDGER_PAGE_SIZE,
  OUTCOME_COLUMNS,
  OUTCOME_PAGE_SIZE,
  READY_COLUMNS,
  READY_PAGE_SIZE,
  executableProposals,
  filterExecutions,
  filterOutcomes,
  filterReady,
  outcomeTone,
  type ExecutionFilters,
} from "@/lib/gv-execution";
import {
  clampPage,
  countBy,
  paginate,
  plural,
} from "@/lib/list-utils";
import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";
import { ConfirmButton } from "./confirm-button";
import { ExecutionTable } from "./gv-execution-ledger";
import {
  Banner,
  LoadNotice,
} from "./gv-parts";
import {
  ExportButton,
  Pager,
  ResetButton,
  ResultCount,
  SavedViews,
  SearchField,
  SelectField,
  Toolbar,
} from "./list-tools";
import { BarList } from "./mini-charts";
import { EmptyState } from "./state-card";

interface ExecutionPayload {
  proposals: CaseDecisionProposal[];
  executions: CaseDecisionExecution[];
  outcomes: GovernedCaseOutcome[];
}

const NO_PROPOSALS: CaseDecisionProposal[] = [];

const NO_EXECUTIONS: CaseDecisionExecution[] = [];

const NO_OUTCOMES: GovernedCaseOutcome[] = [];

export function DecisionExecution() {
  const {
    hasAnyRole,
  } = useAuth();

  const canExecute =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const fetchPayload =
    useCallback(
      async (
        signal: AbortSignal
      ): Promise<ExecutionPayload> => {
        const [
          proposals,
          executions,
          outcomes,
        ] =
          await Promise.all([
            fetchDecisionProposals(
              signal
            ),
            fetchDecisionExecutions(
              signal
            ),
            fetchGovernedCaseOutcomes(
              signal
            ),
          ]);

        return {
          proposals,
          executions,
          outcomes,
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
    "Unable to load governed outcomes."
  );

  const proposals =
    data
      ? data.proposals
      : NO_PROPOSALS;

  const executions =
    data
      ? data.executions
      : NO_EXECUTIONS;

  const outcomes =
    data
      ? data.outcomes
      : NO_OUTCOMES;

  const {
    filters,
    current,
    hasFilters,
    update,
    setPage,
    reset,
    apply,
  } = useFilterState<ExecutionFilters>(
    DEFAULT_EXECUTION_FILTERS
  );

  const [outcomePage, setOutcomePage] =
    useState(0);

  const [ledgerPage, setLedgerPage] =
    useState(0);

  const [note, setNote] =
    useState(
      "Execute the independently approved investigation decision."
    );

  const runner =
    useActionRunner();

  const executable =
    useMemo(
      () =>
        executableProposals(
          proposals,
          executions
        ),
      [
        proposals,
        executions,
      ]
    );

  const readyRows =
    useMemo(
      () =>
        filterReady(
          executable,
          filters
        ),
      [
        executable,
        filters,
      ]
    );

  const outcomeRows =
    useMemo(
      () =>
        filterOutcomes(
          outcomes,
          filters
        ),
      [
        outcomes,
        filters,
      ]
    );

  const ledgerRows =
    useMemo(
      () =>
        filterExecutions(
          executions,
          filters
        ),
      [
        executions,
        filters,
      ]
    );

  const priorityOptions =
    useMemo(
      () =>
        countOptions(
          [
            ...executable.map(
              (item) =>
                item.casePriority
            ),
            ...outcomes.map(
              (item) =>
                item.casePriority
            ),
          ],
          "All priorities",
          {
            order: PRIORITY_ORDER,
            keep: filters.priority,
            label: (value) =>
              value,
          }
        ),
      [
        executable,
        outcomes,
        filters.priority,
      ]
    );

  const outcomeOptions =
    useMemo(
      () =>
        countOptions(
          outcomes.map(
            (item) =>
              item.governedOutcome
          ),
          "All outcomes",
          {
            keep: filters.outcome,
          }
        ),
      [
        outcomes,
        filters.outcome,
      ]
    );

  const outcomeBars =
    useMemo(
      () =>
        Object.entries(
          countBy(
            outcomes,
            (item) =>
              item.governedOutcome
          )
        ).map(
          ([
            key,
            value,
          ]) => ({
            key,
            label:
              humanize(
                key
              ),
            value,
            tone:
              outcomeTone(
                key
              ),
          })
        ),
      [
        outcomes,
      ]
    );

  const readyPage =
    clampPage(
      filters.page,
      readyRows.length,
      READY_PAGE_SIZE
    );

  const outcomePageNow =
    clampPage(
      outcomePage,
      outcomeRows.length,
      OUTCOME_PAGE_SIZE
    );

  const ledgerPageNow =
    clampPage(
      ledgerPage,
      ledgerRows.length,
      LEDGER_PAGE_SIZE
    );

  // Nothing may be sent while a request runs or the lists refresh:
  // an approved decision could already have been executed.
  const busy =
    runner.pending !== null ||
    loading;

  function change(
    patch: Partial<ExecutionFilters>
  ) {
    update(patch);
    setOutcomePage(0);
    setLedgerPage(0);
  }

  function clear() {
    reset();
    setOutcomePage(0);
    setLedgerPage(0);
  }

  function execute(
    proposal: CaseDecisionProposal
  ) {
    if (!canExecute) {
      return;
    }

    void runner.run(
      `execute:${proposal.id}`,
      async () => {
        const result =
          await executeCaseDecision(
            proposal.id,
            note
          );

        reload();

        return `Executed ${proposal.caseNumber} decision v${proposal.version}: ${humanize(
          result.governedOutcome
        )}.`;
      },
      "Unable to execute approved decision."
    );
  }

  return (
    <section
      className="panel decision-execution-panel"
      aria-busy={loading}
    >
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
            aria-hidden="true"
          />

          Approved decisions only
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
        label="Loading governed outcomes"
        errorTitle="Unable to load governed outcomes"
      />

      {data !== null && (
        <>
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

          {outcomeBars.length >
            0 && (
            <div className="ui-gv-summary">
              <h3 className="ui-gv-subhead">
                Governed outcomes by type
              </h3>

              <BarList
                label="Governed outcomes by type"
                items={outcomeBars}
                onSelect={(key) =>
                  change({
                    outcome:
                      filters.outcome ===
                      key
                        ? ALL
                        : key,
                  })
                }
              />
            </div>
          )}

          <Toolbar label="Filter decisions">
            <SearchField
              label="Search decisions"
              placeholder="Search case, user or outcome..."
              value={filters.q}
              onChange={(q) =>
                change({
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
                change({
                  priority,
                })
              }
            />

            <SelectField
              label="Filter outcomes and ledger by governed outcome"
              value={
                filters.outcome
              }
              options={
                outcomeOptions
              }
              onChange={(outcome) =>
                change({
                  outcome,
                })
              }
            />

            <ResetButton
              disabled={!hasFilters}
              onClick={clear}
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

          <SavedViews<ExecutionFilters>
            storageKey="fcg.views.execution"
            current={current}
            canSave={hasFilters}
            onApply={(saved) => {
              apply(saved);
              setOutcomePage(0);
              setLedgerPage(0);
            }}
          />

          <div className="decision-execution-grid">
            <div className="decision-execution-card">
              <div className="decision-execution-card-heading">
                <div>
                  <PlayCircle
                    size={14}
                    aria-hidden="true"
                  />

                  <strong>
                    Approved decisions
                  </strong>
                </div>

                <span className="ui-gv-inline-actions">
                  {
                    executable.length
                  }
                  {" ready"}

                  <ExportButton
                    disabled={
                      readyRows.length ===
                      0
                    }
                    onExport={() =>
                      exportRowsAsCsv(
                        "approved-decisions",
                        readyRows,
                        READY_COLUMNS
                      )
                    }
                  />
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
              </div>

              <ResultCount
                shown={
                  readyRows.length
                }
                total={
                  executable.length
                }
                noun={plural(
                  executable.length,
                  "approved decision"
                )}
                filtered={
                  hasFilters
                }
              />

              <div className="decision-executable-list">
                {executable.length ===
                  0 && (
                  <div className="decision-execution-empty">
                    <CheckCircle2
                      size={21}
                      aria-hidden="true"
                    />

                    <strong>
                      No approved decision waiting
                    </strong>
                  </div>
                )}

                {executable.length >
                  0 &&
                  readyRows.length ===
                    0 && (
                  <EmptyState
                    compact
                    title="No approved decisions match these filters"
                    action={
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={clear}
                      >
                        Clear filters
                      </button>
                    }
                  />
                )}

                {paginate(
                  readyRows,
                  readyPage,
                  READY_PAGE_SIZE
                ).map(
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
                          {humanize(
                            proposal.recommendation
                          )}
                          {" · reviewed by "}
                          {
                            proposal.reviewedBy
                          }
                        </span>
                      </div>

                      <ConfirmButton
                        className="primary-button"
                        confirmLabel="Yes, execute"
                        disabled={
                          !canExecute ||
                          busy ||
                          note.trim()
                            .length ===
                            0
                        }
                        onConfirm={() =>
                          execute(
                            proposal
                          )
                        }
                      >
                        <PlayCircle
                          size={12}
                          aria-hidden="true"
                        />

                        {runner.pending ===
                        `execute:${proposal.id}`
                          ? "Executing..."
                          : "Execute"}
                      </ConfirmButton>
                    </article>
                  )
                )}
              </div>

              <Pager
                label="Approved decision pages"
                page={readyPage}
                pageSize={
                  READY_PAGE_SIZE
                }
                total={
                  readyRows.length
                }
                onPage={setPage}
              />
            </div>

            <div className="decision-execution-card">
              <div className="decision-execution-card-heading">
                <div>
                  <FileCheck2
                    size={14}
                    aria-hidden="true"
                  />

                  <strong>
                    Current governed outcomes
                  </strong>
                </div>

                <span className="ui-gv-inline-actions">
                  {
                    outcomes.length
                  }
                  {" cases"}

                  <ExportButton
                    disabled={
                      outcomeRows.length ===
                      0
                    }
                    onExport={() =>
                      exportRowsAsCsv(
                        "governed-outcomes",
                        outcomeRows,
                        OUTCOME_COLUMNS
                      )
                    }
                  />
                </span>
              </div>

              <ResultCount
                shown={
                  outcomeRows.length
                }
                total={
                  outcomes.length
                }
                noun={plural(
                  outcomes.length,
                  "governed outcome"
                )}
                filtered={
                  hasFilters
                }
              />

              <div className="governed-outcome-list">
                {outcomes.length ===
                  0 && (
                  <div className="decision-execution-empty">
                    <FileCheck2
                      size={21}
                      aria-hidden="true"
                    />

                    <strong>
                      No governed outcome yet
                    </strong>
                  </div>
                )}

                {outcomes.length >
                  0 &&
                  outcomeRows.length ===
                    0 && (
                  <EmptyState
                    compact
                    title="No outcomes match these filters"
                    action={
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={clear}
                      >
                        Clear filters
                      </button>
                    }
                  />
                )}

                {paginate(
                  outcomeRows,
                  outcomePageNow,
                  OUTCOME_PAGE_SIZE
                ).map(
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

              <Pager
                label="Governed outcome pages"
                page={
                  outcomePageNow
                }
                pageSize={
                  OUTCOME_PAGE_SIZE
                }
                total={
                  outcomeRows.length
                }
                onPage={
                  setOutcomePage
                }
              />
            </div>
          </div>

          <div className="decision-execution-card ui-gv-ledger">
            <div className="decision-execution-card-heading">
              <div>
                <ScrollText
                  size={14}
                  aria-hidden="true"
                />

                <strong>
                  Execution ledger
                </strong>
              </div>

              <span className="ui-gv-inline-actions">
                {
                  executions.length
                }
                {" executed"}

                <ExportButton
                  disabled={
                    ledgerRows.length ===
                    0
                  }
                  onExport={() =>
                    exportRowsAsCsv(
                      "decision-executions",
                      ledgerRows,
                      EXECUTION_COLUMNS
                    )
                  }
                />
              </span>
            </div>

            <ResultCount
              shown={
                ledgerRows.length
              }
              total={
                executions.length
              }
              noun={plural(
                executions.length,
                "execution"
              )}
              filtered={
                hasFilters
              }
            />

            {executions.length ===
              0 && (
              <EmptyState
                compact
                icon={
                  <ScrollText
                    size={22}
                    aria-hidden="true"
                  />
                }
                title="No decision has been executed yet"
                message="Executed decisions are recorded here with their maker, checker and executor."
              />
            )}

            {executions.length >
              0 &&
              ledgerRows.length ===
                0 && (
              <EmptyState
                compact
                title="No executions match these filters"
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={clear}
                  >
                    Clear filters
                  </button>
                }
              />
            )}

            {ledgerRows.length >
              0 && (
              <ExecutionTable
                rows={paginate(
                  ledgerRows,
                  ledgerPageNow,
                  LEDGER_PAGE_SIZE
                )}
              />
            )}

            <Pager
              label="Execution ledger pages"
              page={ledgerPageNow}
              pageSize={
                LEDGER_PAGE_SIZE
              }
              total={
                ledgerRows.length
              }
              onPage={
                setLedgerPage
              }
            />
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
