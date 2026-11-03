import type {
  CaseDecisionProposal,
  InvestigationTriageQueueItem,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { matchesQuery } from "@/lib/list-utils";

import { ALL } from "./gv-common";

export const CASE_PAGE_SIZE = 10;

/** The server returns at most this many proposals. */
export const PROPOSAL_LIMIT = 50;

export const NO_PROPOSAL = "NO_PROPOSAL";

export const STATE_ORDER = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  NO_PROPOSAL,
] as const;

export interface DecisionFilters {
  q: string;
  priority: string;
  band: string;
  /** Status of the latest proposal of the case, or NO_PROPOSAL. */
  state: string;
  page: number;
}

export const DEFAULT_DECISION_FILTERS: DecisionFilters = {
  q: "",
  priority: ALL,
  band: ALL,
  state: ALL,
  page: 0,
};

/** Proposals per case, newest version first. */
export function groupProposals(
  proposals: readonly CaseDecisionProposal[]
): Map<string, CaseDecisionProposal[]> {
  const byCase = new Map<string, CaseDecisionProposal[]>();

  for (const proposal of proposals) {
    const list = byCase.get(proposal.caseId);

    if (list) {
      list.push(proposal);
    } else {
      byCase.set(proposal.caseId, [proposal]);
    }
  }

  byCase.forEach((list) => list.sort((a, b) => b.version - a.version));

  return byCase;
}

export function caseState(
  caseId: string,
  byCase: ReadonlyMap<string, readonly CaseDecisionProposal[]>
) {
  return byCase.get(caseId)?.[0]?.status ?? NO_PROPOSAL;
}

export function filterDecisionCases(
  cases: readonly InvestigationTriageQueueItem[],
  byCase: ReadonlyMap<string, readonly CaseDecisionProposal[]>,
  filters: DecisionFilters
): InvestigationTriageQueueItem[] {
  return cases.filter((item) => {
    const proposals = byCase.get(item.caseId) ?? [];

    return (
      (filters.priority === ALL ||
        item.casePriority === filters.priority) &&
      (filters.band === ALL || item.triageBand === filters.band) &&
      (filters.state === ALL ||
        caseState(item.caseId, byCase) === filters.state) &&
      matchesQuery(filters.q, [
        item.caseNumber,
        item.casePriority,
        item.caseStatus,
        item.triageBand,
        item.ownerUsername,
        ...proposals.flatMap((proposal) => [
          proposal.recommendation,
          proposal.status,
          proposal.proposedBy,
          proposal.reviewedBy,
        ]),
      ])
    );
  });
}

/** Every proposal of the listed cases, grouped by case. */
export function proposalsOfCases(
  cases: readonly InvestigationTriageQueueItem[],
  byCase: ReadonlyMap<string, readonly CaseDecisionProposal[]>
): CaseDecisionProposal[] {
  return cases.flatMap((item) => byCase.get(item.caseId) ?? []);
}

export const PROPOSAL_COLUMNS: readonly CsvColumn<CaseDecisionProposal>[] =
  [
    { header: "Case number", value: (item) => item.caseNumber },
    { header: "Case priority", value: (item) => item.casePriority },
    { header: "Case status", value: (item) => item.caseStatus },
    { header: "Version", value: (item) => item.version },
    { header: "Recommendation", value: (item) => item.recommendation },
    { header: "Rationale", value: (item) => item.rationale },
    { header: "Status", value: (item) => item.status },
    { header: "Proposed by", value: (item) => item.proposedBy },
    { header: "Proposed at (UTC)", value: (item) => item.proposedAt },
    { header: "Review decision", value: (item) => item.decision },
    { header: "Reviewed by", value: (item) => item.reviewedBy },
    { header: "Reviewed at (UTC)", value: (item) => item.reviewedAt },
    { header: "Review note", value: (item) => item.reviewNote },
  ];

/** The same person cannot both propose and review (four-eyes). */
export function isSelfReview(
  proposal: CaseDecisionProposal,
  username: string
) {
  return (
    proposal.proposedBy.trim().toLowerCase() ===
    username.trim().toLowerCase()
  );
}
