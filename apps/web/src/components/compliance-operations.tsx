"use client";

import {
  Activity,
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
  useEffect,
  useMemo,
  useState,
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

import {
  useAuth,
} from "./auth-context";

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

  const [payload, setPayload] =
    useState<CompliancePayload | null>(
      null
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

    void load(
      controller.signal
    );

    return () =>
      controller.abort();
  }, []);

  async function load(
    signal?: AbortSignal
  ) {
    try {
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

      setPayload({
        overview,
        policies,
        caseSla,
        activity,
      });

      setError(
        null
      );
    } catch (loadError) {
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
          : "Unable to load compliance operations."
      );
    }
  }

  async function recalculate() {
    if (!canRecalculate) {
      return;
    }

    try {
      setAction(
        "recalculate"
      );

      setError(
        null
      );

      await recalculateComplianceSla();

      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to recalculate case SLA status."
      );
    } finally {
      setAction(
        null
      );
    }
  }

  const breachedCases =
    useMemo(
      () =>
        (
          payload?.caseSla ??
          []
        ).filter(
          (item) =>
            item.slaState ===
              "BREACHED" ||
            item.slaState ===
              "CLOSED_BREACHED"
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

        <button
          type="button"
          className="primary-button"
          disabled={
            !canRecalculate ||
            action !== null
          }
          title={
            canRecalculate
              ? "Recalculate case SLA status"
              : "Senior Analyst or Administrator required"
          }
          onClick={() =>
            void recalculate()
          }
        >
          <RefreshCw
            size={13}
          />

          {action ===
          "recalculate"
            ? "Calculating..."
            : "Recalculate SLA"}
        </button>
      </div>

      {error && (
        <div className="compliance-error">
          <AlertTriangle
            size={14}
          />

          {error}
        </div>
      )}

      {!payload ? (
        <div className="compliance-empty">
          <Activity
            size={27}
          />

          <strong>
            Loading operations
          </strong>
        </div>
      ) : (
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
            <div className="compliance-card">
              <div className="compliance-card-heading">
                <div>
                  <Clock3
                    size={14}
                  />

                  <strong>
                    Case SLA portfolio
                  </strong>
                </div>

                <span>
                  {
                    payload.caseSla
                      .length
                  }
                  {" tracked"}
                </span>
              </div>

              <div className="compliance-policy-row">
                {payload.policies.map(
                  (policy) => (
                    <div
                      key={
                        policy.priority
                      }
                      className="compliance-policy"
                    >
                      <span>
                        {
                          policy.priority
                        }
                      </span>

                      <strong>
                        {
                          policy.targetHours
                        }
                        h
                      </strong>
                    </div>
                  )
                )}
              </div>

              <div className="sla-case-list">
                {payload.caseSla.length ===
                  0 && (
                  <div className="compliance-empty compact">
                    <Clock3
                      size={20}
                    />

                    <strong>
                      SLA snapshot not generated
                    </strong>

                    <span>
                      Recalculate SLA to
                      populate current case
                      timing.
                    </span>
                  </div>
                )}

                {payload.caseSla.map(
                  (item) => (
                    <article
                      key={
                        item.id
                      }
                      className="sla-case-row"
                    >
                      <div
                        className={
                          `sla-state-dot sla-state-${slaTone(
                            item.slaState
                          )}`
                        }
                      />

                      <div className="sla-case-copy">
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

                      <div className="sla-case-hours">
                        <strong>
                          {
                            item.elapsedHours
                          }
                          h
                        </strong>

                        <span>
                          target
                          {" "}
                          {
                            item.targetHours
                          }
                          h
                        </span>
                      </div>

                      <div
                        className={
                          `sla-state-label sla-state-${slaTone(
                            item.slaState
                          )}`
                        }
                      >
                        {humanize(
                          item.slaState
                        )}
                      </div>
                    </article>
                  )
                )}
              </div>
            </div>

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

            <div className="compliance-card">
              <div className="compliance-card-heading">
                <div>
                  <Activity
                    size={14}
                  />

                  <strong>
                    Recent controlled activity
                  </strong>
                </div>

                <span>
                  {
                    payload.activity
                      .length
                  }
                  {" events"}
                </span>
              </div>

              <div className="compliance-activity-list">
                {payload.activity.map(
                  (event) => (
                    <article
                      key={
                        event.id
                      }
                      className="compliance-activity-row"
                    >
                      <div
                        className={
                          event.outcome ===
                          "SUCCESS"
                            ? "activity-status success"
                            : "activity-status"
                        }
                      />

                      <div>
                        <strong>
                          {humanize(
                            event.action
                          )}
                        </strong>

                        <span>
                          {
                            event.username
                          }
                          {" · "}
                          {formatDateTime(
                            event.createdAt
                          )}
                        </span>
                      </div>
                    </article>
                  )
                )}
              </div>
            </div>
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
  const entries =
    Object.entries(
      values
    );

  const total =
    Math.max(
      1,
      entries.reduce(
        (
          sum,
          [, value]
        ) =>
          sum + value,
        0
      )
    );

  return (
    <div className="compliance-distribution">
      <strong>
        {title}
      </strong>

      <div>
        {entries.length ===
          0 && (
          <span className="distribution-empty">
            No data
          </span>
        )}

        {entries.map(
          ([
            key,
            value,
          ]) => (
            <div
              key={
                key
              }
              className="distribution-row"
            >
              <div>
                <span>
                  {humanize(
                    key
                  )}
                </span>

                <strong>
                  {value}
                </strong>
              </div>

              <div className="distribution-track">
                <div
                  className="distribution-fill"
                  style={{
                    width:
                      `${Math.max(
                        4,
                        (
                          value /
                          total
                        ) *
                          100
                      )}%`,
                  }}
                />
              </div>
            </div>
          )
        )}
      </div>
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
      (character) =>
        character.toUpperCase()
    );
}

function slaTone(
  value: string
) {
  if (
    value === "BREACHED" ||
    value === "CLOSED_BREACHED"
  ) {
    return "breached";
  }

  if (
    value ===
    "CLOSED_WITHIN_SLA"
  ) {
    return "closed";
  }

  return "healthy";
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
    new Date(value)
  );
}
