"use client";

import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useState,
} from "react";

import {
  IntelligenceExplorer,
} from "./intelligence-explorer";
import {
  GraphInvestigationWorkbench,
} from "./graph-investigation-workbench";
import {
  InvestigationTriage,
} from "./investigation-triage";
import {
  CustomerRiskDashboard,
} from "./customer-risk-dashboard";
import {
  WatchlistScreening,
} from "./watchlist-screening";
import {
  ComplianceOperations,
} from "./compliance-operations";
import {
  EvidenceChainOfCustody,
} from "./evidence-chain-of-custody";
import {
  EvidenceReviewGovernance,
} from "./evidence-review-governance";
import {
  InvestigationFindings,
} from "./investigation-findings";
import {
  DecisionGovernance,
} from "./decision-governance";
import {
  DecisionExecution,
} from "./decision-execution";
import {
  OutcomeAttestations,
} from "./outcome-attestations";
import {
  InvestigationConclusionRelease,
} from "./investigation-conclusion-release";
import {
  RuleGovernance,
} from "./rule-governance";
import {
  SecurityAuditLedger,
} from "./security-audit-ledger";

type DetailedWorkspace =
  | "operations"
  | "governance";


export function OperationsGovernanceWorkspace({
  caseWorkspace,
  recentTransactions,
}: {
  caseWorkspace: ReactNode;
  recentTransactions: ReactNode;
}) {
  const [
    expanded,
    setExpanded,
  ] =
    useState(false);

  const [
    activeWorkspace,
    setActiveWorkspace,
  ] =
    useState<DetailedWorkspace>(
      "governance"
    );


  function openWorkspace(
    workspace:
      DetailedWorkspace
  ) {
    setActiveWorkspace(
      workspace
    );

    setExpanded(
      true
    );
  }


  useEffect(() => {
    function handleSidebarNavigation(
      event: Event
    ) {
      const navigationEvent =
        event as CustomEvent<string>;

      const target =
        navigationEvent.detail;

      if (
        target !== "network" &&
        target !== "transactions" &&
        target !== "entities"
      ) {
        return;
      }

      setActiveWorkspace(
        "operations"
      );

      setExpanded(
        true
      );

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const destination =
            document.getElementById(
              `workspace-${target}`
            );

          if (!destination) {
            return;
          }

          destination.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });

          destination.focus({
            preventScroll: true,
          });
        });
      });
    }

    window.addEventListener(
      "fincrime:workspace-navigation",
      handleSidebarNavigation
    );

    return () => {
      window.removeEventListener(
        "fincrime:workspace-navigation",
        handleSidebarNavigation
      );
    };
  }, []);

  return (
    <section
      id="operations-governance-workspace"
      className="operations-governance-hub panel"
    >
      <div className="operations-governance-hub__heading">
        <div>
          <div className="eyebrow">
            NEXT WORKSPACE
          </div>

          <h2>
            Operations &amp; governance
          </h2>

          <p>
            The overview stays focused on signals and priorities.
            Open detailed investigation or governance controls
            only when the task requires them.
          </p>
        </div>

        {expanded && (
          <button
            type="button"
            className="operations-governance-hub__close"
            onClick={() =>
              setExpanded(false)
            }
          >
            <ChevronUp size={15} />
            Close workspace
          </button>
        )}
      </div>

      {!expanded ? (
        <>
          <div className="operations-governance-hub__summary">
            <button
              type="button"
              className="operations-governance-hub__entry"
              onClick={() =>
                openWorkspace(
                  "operations"
                )
              }
            >
              <span className="operations-governance-hub__entry-icon">
                <Briefcase size={18} />
              </span>

              <span className="operations-governance-hub__entry-copy">
                <strong>
                  Investigation operations
                </strong>

                <span>
                  Open detailed case, graph, triage, risk,
                  screening and operational controls.
                </span>
              </span>

              <ChevronDown
                size={16}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              className="operations-governance-hub__entry"
              onClick={() =>
                openWorkspace(
                  "governance"
                )
              }
            >
              <span className="operations-governance-hub__entry-icon operations-governance-hub__entry-icon--governance">
                <ShieldCheck size={18} />
              </span>

              <span className="operations-governance-hub__entry-copy">
                <strong>
                  Investigation governance
                </strong>

                <span>
                  Open evidence, findings, review, decision,
                  attestation, release and audit controls.
                </span>
              </span>

              <ChevronDown
                size={16}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="operations-governance-hub__status-grid">
            <div>
              <span>
                EVIDENCE &amp; FINDINGS
              </span>

              <strong>
                Lineage-controlled workflows
              </strong>

              <small>
                Custody, independent review and findings remain available.
              </small>
            </div>

            <div>
              <span>
                DECISIONS &amp; OUTCOMES
              </span>

              <strong>
                Role-gated execution
              </strong>

              <small>
                Existing maker, checker and execution permissions are preserved.
              </small>
            </div>

            <div>
              <span>
                RELEASE &amp; AUDIT
              </span>

              <strong>
                Governed controls
              </strong>

              <small>
                Release provenance and audit workflows remain available.
              </small>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className="operations-governance-hub__tabs"
            role="tablist"
            aria-label="Detailed FinCrime workspaces"
          >
            <button
              type="button"
              role="tab"
              aria-selected={
                activeWorkspace ===
                "operations"
              }
              className={
                activeWorkspace ===
                "operations"
                  ? "operations-governance-hub__tab active"
                  : "operations-governance-hub__tab"
              }
              onClick={() =>
                setActiveWorkspace(
                  "operations"
                )
              }
            >
              <Briefcase size={15} />
              Investigation operations
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activeWorkspace ===
                "governance"
              }
              className={
                activeWorkspace ===
                "governance"
                  ? "operations-governance-hub__tab active"
                  : "operations-governance-hub__tab"
              }
              onClick={() =>
                setActiveWorkspace(
                  "governance"
                )
              }
            >
              <ShieldCheck size={15} />
              Governance
            </button>
          </div>

          <div className="operations-governance-hub__context">
            {activeWorkspace ===
            "operations" ? (
              <>
                <strong>
                  Investigation operations
                </strong>

                <span>
                  Detailed analytical and case workflows for
                  follow-up after the overview identifies a priority.
                </span>
              </>
            ) : (
              <>
                <strong>
                  Investigation governance
                </strong>

                <span>
                  Evidence, decision and release workflows retain
                  their existing role permissions and lineage rules.
                </span>
              </>
            )}
          </div>

          <div className="operations-governance-hub__details">
            {activeWorkspace ===
            "operations" ? (
              <>
              <div className="operations-governance-hub__slot operations-governance-hub__slot--case">
                {caseWorkspace}
              </div>

              <div
                id="workspace-entities"
                className="operations-governance-hub__slot workspace-nav-anchor"
                tabIndex={-1}
              >
                <IntelligenceExplorer />
              </div>

              <div
                id="workspace-network"
                className="operations-governance-hub__slot workspace-nav-anchor"
                tabIndex={-1}
              >
                <GraphInvestigationWorkbench />
              </div>

              <InvestigationTriage />

              <CustomerRiskDashboard />

              <WatchlistScreening />

              <ComplianceOperations />

              <div
                id="workspace-transactions"
                className="operations-governance-hub__slot operations-governance-hub__slot--transactions workspace-nav-anchor"
                tabIndex={-1}
              >
                {recentTransactions}
              </div>
              </>
            ) : (
              <>
              <EvidenceChainOfCustody />

              <EvidenceReviewGovernance />

              <InvestigationFindings />

              <DecisionGovernance />

              <DecisionExecution />

              <OutcomeAttestations />

              <InvestigationConclusionRelease />

              <RuleGovernance />

              <SecurityAuditLedger />
              </>
            )}
          </div>
        </>
      )}

      <div className="operations-governance-hub__permission-note">
        <ShieldCheck
          size={14}
          aria-hidden="true"
        />

        <span>
          Existing frontend role states and backend authorization
          remain unchanged by this information-architecture refactor.
        </span>
      </div>
    </section>
  );
}
