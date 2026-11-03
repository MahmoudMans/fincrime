import type {
  CaseDecisionExecution,
  CaseDecisionProposal,
  GovernedCaseOutcome,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { humanize } from "@/lib/format";
import { matchesQuery } from "@/lib/list-utils";

import { ALL } from "./gv-common";

export const READY_PAGE_SIZE = 6;
export const OUTCOME_PAGE_SIZE = 8;
export const LEDGER_PAGE_SIZE = 10;

export interface ExecutionFilters {
  q: string;
  priority: string;
  /** Governed outcome; applies to the outcomes and the ledger. */
  outcome: string;
  /** Page of the approved decisions. */
  page: number;
}

export const DEFAULT_EXECUTION_FILTERS: ExecutionFilters = {
  q: "",
  priority: ALL,
  outcome: ALL,
  page: 0,
};

/** Approved proposals that have not been executed yet. */
export function executableProposals(
  proposals: readonly CaseDecisionProposal[],
  executions: readonly CaseDecisionExecution[]
): CaseDecisionProposal[] {
  const executed = new Set(
    executions.map((execution) => execution.proposalId)
  );

  return proposals.filter(
    (proposal) =>
      proposal.status === "APPROVED" && !executed.has(proposal.id)
  );
}

export function filterReady(
  items: readonly CaseDecisionProposal[],
  filters: ExecutionFilters
): CaseDecisionProposal[] {
  return items.filter(
    (proposal) =>
      (filters.priority === ALL ||
        proposal.casePriority === filters.priority) &&
      matchesQuery(filters.q, [
        proposal.caseNumber,
        proposal.casePriority,
        proposal.recommendation,
        humanize(proposal.recommendation),
        proposal.proposedBy,
        proposal.reviewedBy,
      ])
  );
}

export function filterOutcomes(
  items: readonly GovernedCaseOutcome[],
  filters: ExecutionFilters
): GovernedCaseOutcome[] {
  return items.filter(
    (outcome) =>
      (filters.priority === ALL ||
        outcome.casePriority === filters.priority) &&
      (filters.outcome === ALL ||
        outcome.governedOutcome === filters.outcome) &&
      matchesQuery(filters.q, [
        outcome.caseNumber,
        outcome.casePriority,
        outcome.caseStatus,
        outcome.governedOutcome,
        humanize(outcome.governedOutcome),
        outcome.lastUpdatedBy,
      ])
  );
}

export function filterExecutions(
  items: readonly CaseDecisionExecution[],
  filters: ExecutionFilters
): CaseDecisionExecution[] {
  return items.filter(
    (execution) =>
      (filters.priority === ALL ||
        execution.casePriority === filters.priority) &&
      (filters.outcome === ALL ||
        execution.governedOutcome === filters.outcome) &&
      matchesQuery(filters.q, [
        execution.caseNumber,
        execution.casePriority,
        execution.sourceRecommendation,
        execution.governedOutcome,
        humanize(execution.governedOutcome),
        execution.sourceProposedBy,
        execution.sourceReviewedBy,
        execution.executedBy,
        execution.executionNote,
      ])
  );
}

export const READY_COLUMNS: readonly CsvColumn<CaseDecisionProposal>[] = [
  { header: "Case number", value: (item) => item.caseNumber },
  { header: "Case priority", value: (item) => item.casePriority },
  { header: "Decision version", value: (item) => item.version },
  { header: "Recommendation", value: (item) => item.recommendation },
  { header: "Proposed by", value: (item) => item.proposedBy },
  { header: "Reviewed by", value: (item) => item.reviewedBy },
  { header: "Reviewed at (UTC)", value: (item) => item.reviewedAt },
  { header: "Proposal id", value: (item) => item.id },
];

export const OUTCOME_COLUMNS: readonly CsvColumn<GovernedCaseOutcome>[] = [
  { header: "Case number", value: (item) => item.caseNumber },
  { header: "Case priority", value: (item) => item.casePriority },
  { header: "Case status", value: (item) => item.caseStatus },
  { header: "Decision version", value: (item) => item.decisionVersion },
  { header: "Governed outcome", value: (item) => item.governedOutcome },
  { header: "Effective at (UTC)", value: (item) => item.effectiveAt },
  { header: "Last updated by", value: (item) => item.lastUpdatedBy },
  { header: "Execution id", value: (item) => item.executionId },
  { header: "Proposal id", value: (item) => item.proposalId },
];

export const EXECUTION_COLUMNS: readonly CsvColumn<CaseDecisionExecution>[] =
  [
    { header: "Case number", value: (item) => item.caseNumber },
    { header: "Case priority", value: (item) => item.casePriority },
    { header: "Case status", value: (item) => item.caseStatus },
    { header: "Decision version", value: (item) => item.decisionVersion },
    {
      header: "Source recommendation",
      value: (item) => item.sourceRecommendation,
    },
    { header: "Governed outcome", value: (item) => item.governedOutcome },
    { header: "Proposed by", value: (item) => item.sourceProposedBy },
    { header: "Reviewed by", value: (item) => item.sourceReviewedBy },
    { header: "Executed by", value: (item) => item.executedBy },
    { header: "Executed at (UTC)", value: (item) => item.executedAt },
    { header: "Execution note", value: (item) => item.executionNote },
    { header: "Execution id", value: (item) => item.id },
    { header: "Proposal id", value: (item) => item.proposalId },
  ];

export function outcomeTone(
  outcome: string
): "danger" | "warning" | "ok" | "info" {
  if (outcome === "ESCALATED_FOR_REVIEW") {
    return "warning";
  }

  if (outcome === "CLOSED_NO_ACTION") {
    return "ok";
  }

  return "info";
}
