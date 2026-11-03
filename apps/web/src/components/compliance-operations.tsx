"use client";

import {
  AlertTriangle,
  BarChart3,
  Clock3,
  FileCheck2,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";

import {
  useCallback,
  useMemo,
} from "react";

import {
  fetchComplianceActivity,
  fetchComplianceCaseSla,
  fetchComplianceOverview,
  fetchComplianceSlaPolicies,
  recalculateComplianceSla,
  type ComplianceActivity,
  type ComplianceCaseSla,
  type ComplianceOverview,
  type ComplianceSlaPolicy,
} from "@/lib/api";
import { humanize } from "@/lib/format";
import { useActionRunner } from "@/lib/gv-common";
import {
  compareSlaUrgency,
  isBreached,
  levelTone,
} from "@/lib/gv-compliance";
import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";
import {
  ActivityCard,
  SlaPortfolioCard,
} from "./gv-compliance-cards";
import {
  Banner,
  LoadNotice,
} from "./gv-parts";
import { BarList } from "./mini-charts";

interface CompliancePayload {
  overview: ComplianceOverview;
  policies: ComplianceSlaPolicy[];
  caseSla: ComplianceCaseSla[];
  activity: ComplianceActivity[];
}

export function ComplianceOperations() {
  const {
    hasAnyRole,
  } = useAuth();

  const canRecalculate =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const fetchPayload = useCallback(
    async (
      signal: AbortSignal
    ): Promise<CompliancePayload> => {
      const [
        overview,
        policies,
        caseSla,
        activity,
      ] =
        await Promise.all([
          fetchComplianceOverview(
            signal
          ),
          fetchComplianceSlaPolicies(
            signal
          ),
          fetchComplianceCaseSla(
            signal
          ),
          fetchComplianceActivity(
            signal
          ),
        ]);

      return {
        overview,
        policies,
        caseSla,
        activity,
      };
    },
    []
  );

  const {
    data: payload,
    error,
    loading,
    reload,
  } = useLoad(
    fetchPayload,
    "Unable to load compliance operations."
  );

  const runner = useActionRunner();

  function recalculate() {
    if (!canRecalculate) {
      return;
    }

    void runner.run(
      "recalculate",
      async () => {
        const result =
          await recalculateComplianceSla();

        reload();

        return `SLA recalculated for ${result.casesEvaluated} cases: ${result.withinSlaCount} within SLA, ${result.breachCount} breached, ${result.closedCount} closed.`;
      },
      "Unable to recalculate case SLA status."
    );
  }

  const breachedCases =
    useMemo(
      () =>
        (
          payload?.caseSla ??
          []
        ).filter(
          (item) =>
            isBreached(
              item.slaState
            )
        ).sort(
          compareSlaUrgency
        ),
      [
        payload,
      ]
    );

  return (
    <section className="panel compliance-operations-panel">
      <div className="panel-heading compliance-operations-heading">
        <div>
          <div className="eyebrow">
            Compliance operations
          </div>

          <h2>
            Investigation command center
          </h2>

          <p>
            Portfolio-wide operational
            health across AML alerts,
            investigation cases,
            watchlist review, customer
            risk and case SLA status.
          </p>
        </div>

        <div className="ui-gv-head-actions">
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

          <button
            type="button"
            className="primary-button"
            disabled={
              !canRecalculate ||
              runner.pending !== null ||
              loading
            }
            title={
              canRecalculate
                ? "Recalculate case SLA status"
                : "Senior Analyst or Administrator required"
            }
            onClick={recalculate}
          >
            <RefreshCw
              size={13}
              aria-hidden="true"
            />

            {runner.pending ===
            "recalculate"
              ? "Calculating..."
              : "Recalculate SLA"}
          </button>
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
        data={payload}
        error={error}
        onRetry={reload}
        label="Loading operations"
        errorTitle="Unable to load compliance operations"
      />

      {payload && (
        <>
          <div className="compliance-kpis">
            <Kpi
              label="Active alerts"
              value={
                payload.overview
                  .activeAlerts
              }
              icon={
                <ShieldAlert
                  size={15}
                />
              }
            />

            <Kpi
              label="Open cases"
              value={
                payload.overview
                  .openCases
              }
              icon={
                <FileCheck2
                  size={15}
                />
              }
            />

            <Kpi
              label="Pending screening"
              value={
                payload.overview
                  .pendingWatchlistHits
              }
              icon={
                <UserRoundSearch
                  size={15}
                />
              }
            />

            <Kpi
              label="Critical risk"
              value={
                payload.overview
                  .criticalRiskCustomers
              }
              icon={
                <BarChart3
                  size={15}
                />
              }
            />

            <Kpi
              label="SLA breaches"
              value={
                payload.overview
                  .slaBreaches
              }
              icon={
                <Clock3
                  size={15}
                />
              }
            />

            <Kpi
              label="AML rules"
              value={
                payload.overview
                  .enabledAmlRules
              }
              icon={
                <ShieldCheck
                  size={15}
                />
              }
            />
          </div>

          <div className="compliance-main-grid">
            <SlaPortfolioCard
              items={
                payload.caseSla
              }
              policies={
                payload.policies
              }
            />

            <div className="compliance-card">
              <div className="compliance-card-heading">
                <div>
                  <Scale
                    size={14}
                  />

                  <strong>
                    Risk & review health
                  </strong>
                </div>

                <span>
                  operational mix
                </span>
              </div>

              <Distribution
                title="Customer risk"
                values={
                  payload.overview
                    .riskBandDistribution
                }
              />

              <Distribution
                title="Watchlist review"
                values={
                  payload.overview
                    .watchlistStatusDistribution
                }
              />

              <Distribution
                title="Alert severity"
                values={
                  payload.overview
                    .alertSeverityDistribution
                }
              />

              <Distribution
                title="Case priority"
                values={
                  payload.overview
                    .casePriorityDistribution
                }
              />
            </div>
          </div>

          <div className="compliance-secondary-grid">
            <div className="compliance-card">
              <div className="compliance-card-heading">
                <div>
                  <AlertTriangle
                    size={14}
                  />

                  <strong>
                    SLA attention queue
                  </strong>
                </div>

                <span>
                  {
                    breachedCases.length
                  }
                  {" breached"}
                </span>
              </div>

              {breachedCases.length ===
                0 ? (
                <div className="compliance-empty compact">
                  <ShieldCheck
                    size={21}
                  />

                  <strong>
                    No tracked SLA breach
                  </strong>

                  <span>
                    Current persisted case
                    snapshot is within the
                    configured demo policy.
                  </span>
                </div>
              ) : (
                <div className="compliance-breach-list">
                  {breachedCases.map(
                    (item) => (
                      <article
                        key={
                          item.id
                        }
                        className="compliance-breach-row"
                      >
                        <div>
                          <strong>
                            {
                              item.caseNumber
                            }
                          </strong>

                          <span>
                            {
                              item.priority
                            }
                            {" · "}
                            {
                              humanize(
                                item.caseStatus
                              )
                            }
                          </span>
                        </div>

                        <strong>
                          +
                          {
                            item.breachHours
                          }
                          h
                        </strong>
                      </article>
                    )
                  )}
                </div>
              )}
            </div>

            <ActivityCard
              events={
                payload.activity
              }
            />
          </div>

          <div className="compliance-footnote">
            <Scale
              size={13}
            />

            <span>
              SLA targets shown here are
              portfolio demonstration
              policies configured locally;
              they are not presented as
              regulatory standards.
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="compliance-kpi">
      <div>
        {icon}
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Distribution({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  const items =
    Object.entries(
      values
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
          levelTone(
            key
          ),
      })
    );

  return (
    <div className="compliance-distribution">
      <strong>
        {title}
      </strong>

      {items.length ===
        0 ? (
        <span className="distribution-empty">
          No data
        </span>
      ) : (
        <BarList
          label={title}
          items={items}
        />
      )}
    </div>
  );
}
