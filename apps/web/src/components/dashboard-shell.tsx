"use client";

import {
  Activity,
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  CircleDollarSign,
  FileSearch,
  GitBranch,
  Landmark,
  LayoutDashboard,
  Network,
  Play,
  Radar,
  Search,
  ShieldAlert,
  Users,
  WalletCards,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  advanceCase,
  fetchCases,
  fetchDashboardOverview,
  fetchDetectionRuns,
  fetchGraphNetwork,
  openCaseFromAlert,
  runAmlDetection,
  type AlertView,
  type DashboardOverview,
  type DetectionRun,
  type GraphNetwork,
  type InvestigationCase,
  type TransactionView,
} from "@/lib/api";

import { GraphExplorer } from "./graph-explorer";
import { GraphInvestigationWorkbench } from "./graph-investigation-workbench";
import { IntelligenceExplorer } from "./intelligence-explorer";

const navItems = [
  {
    name: "Overview",
    icon: LayoutDashboard,
    active: true,
  },
  {
    name: "Investigations",
    icon: FileSearch,
  },
  {
    name: "Network",
    icon: GitBranch,
  },
  {
    name: "Transactions",
    icon: CircleDollarSign,
  },
  {
    name: "Entities",
    icon: Building2,
  },
  {
    name: "Alerts",
    icon: ShieldAlert,
  },
];

export function DashboardShell() {
  const [overview, setOverview] =
    useState<DashboardOverview | null>(null);

  const [network, setNetwork] =
    useState<GraphNetwork | null>(null);

  const [cases, setCases] =
    useState<InvestigationCase[]>([]);

  const [detectionRuns, setDetectionRuns] =
    useState<DetectionRun[]>([]);

  const [error, setError] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [detecting, setDetecting] =
    useState(false);

  const [caseActionId, setCaseActionId] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [
          overviewData,
          graphData,
          caseData,
          runData,
        ] = await Promise.all([
          fetchDashboardOverview(controller.signal),
          fetchGraphNetwork(controller.signal),
          fetchCases(controller.signal),
          fetchDetectionRuns(controller.signal),
        ]);

        setOverview(overviewData);
        setNetwork(graphData);
        setCases(caseData);
        setDetectionRuns(runData);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load FinCrime Graph."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  async function refreshOperationalData() {
    const [
      overviewData,
      caseData,
      runData,
    ] = await Promise.all([
      fetchDashboardOverview(),
      fetchCases(),
      fetchDetectionRuns(),
    ]);

    setOverview(overviewData);
    setCases(caseData);
    setDetectionRuns(runData);
  }

  async function handleRunDetection() {
    try {
      setDetecting(true);
      setActionError(null);

      await runAmlDetection();
      await refreshOperationalData();
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : "AML detection failed."
      );
    } finally {
      setDetecting(false);
    }
  }

  async function handleOpenCase(
    alertId: string
  ) {
    try {
      setCaseActionId(alertId);
      setActionError(null);

      await openCaseFromAlert(alertId);

      setCases(
        await fetchCases()
      );
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : "Unable to open investigation case."
      );
    } finally {
      setCaseActionId(null);
    }
  }

  async function handleAdvanceCase(
    caseId: string
  ) {
    try {
      setCaseActionId(caseId);
      setActionError(null);

      await advanceCase(caseId);

      setCases(
        await fetchCases()
      );
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : "Unable to update case."
      );
    } finally {
      setCaseActionId(null);
    }
  }

  const criticalAlerts = useMemo(
    () =>
      overview?.alerts.filter(
        (alert) =>
          alert.severity === "CRITICAL" ||
          alert.severity === "HIGH"
      ).length ?? 0,
    [overview]
  );

  const caseAlertIds = useMemo(
    () =>
      new Set(
        cases.map(
          (investigationCase) =>
            investigationCase.primaryAlertId
        )
      ),
    [cases]
  );

  const latestRun =
    detectionRuns.length > 0
      ? detectionRuns[0]
      : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Network size={22} />
          </div>

          <div>
            <strong>FinCrime</strong>
            <span>Graph Intelligence</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Workspace</div>

          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                type="button"
                className={
                  item.active
                    ? "nav-item active"
                    : "nav-item"
                }
                key={item.name}
              >
                <Icon size={18} />
                <span>{item.name}</span>

                {item.active && (
                  <span className="active-indicator" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-indicator" />

            <div>
              <strong>Monitoring online</strong>
              <span>
                Local investigation environment
              </span>
            </div>
          </div>

          <div className="analyst-card">
            <div className="avatar">AM</div>

            <div>
              <strong>AML Analyst</strong>
              <span>Investigation workspace</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="search-box">
            <Search size={17} />

            <input
              aria-label="Search"
              placeholder="Search accounts, customers, transactions..."
            />
          </div>

          <div className="topbar-actions">
            <div className="environment-pill">
              <span />
              Synthetic data
            </div>

            <button
              className="icon-button notification-button"
              type="button"
              aria-label="Notifications"
            >
              <Bell size={18} />

              {criticalAlerts > 0 && (
                <span className="notification-count">
                  {criticalAlerts}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="dashboard">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                Financial intelligence workspace
              </div>

              <h1>Investigation overview</h1>

              <p>
                Detect suspicious money movement,
                investigate connected entities, and
                manage analyst cases.
              </p>
            </div>

            <div className="page-actions">
              {latestRun && (
                <div className="detection-pill">
                  <Radar size={14} />

                  <span>
                    {latestRun.candidatesFound} signals
                  </span>

                  <small>
                    {latestRun.status}
                  </small>
                </div>
              )}

              <button
                className="primary-button"
                type="button"
                disabled={detecting}
                onClick={() =>
                  void handleRunDetection()
                }
              >
                <Play size={16} />

                {detecting
                  ? "Scanning..."
                  : "Run AML detection"}
              </button>
            </div>
          </section>

          {actionError && (
            <div className="action-error">
              <AlertTriangle size={16} />
              <span>{actionError}</span>
            </div>
          )}

          {loading && (
            <div className="state-card">
              <div className="spinner" />

              <strong>
                Loading investigation data
              </strong>

              <span>
                Connecting PostgreSQL and Neo4j
                intelligence...
              </span>
            </div>
          )}

          {error && (
            <div className="state-card error-state">
              <AlertTriangle size={28} />

              <strong>
                Unable to reach the backend
              </strong>

              <span>{error}</span>

              <code>
                cd apps/backend &&
                mvn spring-boot:run
              </code>
            </div>
          )}

          {!loading &&
            !error &&
            overview &&
            network && (
              <>
                <Metrics overview={overview} />

                <div className="workspace-grid">
                  <GraphExplorer network={network} />

                  <AlertPanel
                    alerts={overview.alerts}
                    caseAlertIds={caseAlertIds}
                    busyAlertId={caseActionId}
                    onOpenCase={handleOpenCase}
                  />
                </div>

                <GraphInvestigationWorkbench />

                <InvestigationPanel
                  cases={cases}
                  latestRun={latestRun}
                  busyCaseId={caseActionId}
                  onAdvance={handleAdvanceCase}
                />

                <IntelligenceExplorer />

                <TransactionTable
                  transactions={
                    overview.recentTransactions
                  }
                />
              </>
            )}
        </div>
      </main>
    </div>
  );
}

function Metrics({
  overview,
}: {
  overview: DashboardOverview;
}) {
  const summary = overview.summary;

  const cards = [
    {
      label: "Monitored customers",
      value: summary.customers.toLocaleString(),
      meta: `${summary.highRiskCustomers} elevated-risk`,
      icon: Users,
      tone: "blue",
    },
    {
      label: "Monitored accounts",
      value: summary.accounts.toLocaleString(),
      meta: "Ownership mapped",
      icon: WalletCards,
      tone: "violet",
    },
    {
      label: "Transaction volume",
      value: formatCurrency(
        summary.transactionVolume,
        "EUR"
      ),
      meta: `${summary.transactions} transfers`,
      icon: Landmark,
      tone: "green",
    },
    {
      label: "Open alerts",
      value: summary.openAlerts.toLocaleString(),
      meta: "Requires analyst review",
      icon: ShieldAlert,
      tone: "red",
    },
  ];

  return (
    <section className="metrics-grid">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            className="metric-card"
            key={card.label}
          >
            <div
              className={
                `metric-icon metric-${card.tone}`
              }
            >
              <Icon size={20} />
            </div>

            <div className="metric-copy">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.meta}</small>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function AlertPanel({
  alerts,
  caseAlertIds,
  busyAlertId,
  onOpenCase,
}: {
  alerts: AlertView[];
  caseAlertIds: Set<string>;
  busyAlertId: string | null;
  onOpenCase: (
    alertId: string
  ) => Promise<void>;
}) {
  return (
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">
            Risk queue
          </div>

          <h2>Priority alerts</h2>

          <p>
            Highest-scoring activity requiring
            analyst review.
          </p>
        </div>

        <span className="live-label">
          <Radar size={14} />
          Rule engine
        </span>
      </div>

      <div className="alert-list">
        {alerts.map((alert) => {
          const hasCase =
            caseAlertIds.has(alert.id);

          return (
            <article
              className="alert-item"
              key={alert.id}
            >
              <div
                className={
                  `risk-score risk-score-${alert.severity.toLowerCase()}`
                }
              >
                {alert.riskScore}
              </div>

              <div className="alert-content">
                <div className="alert-title-row">
                  <strong>
                    {alert.title}
                  </strong>

                  <span
                    className={
                      `severity severity-${alert.severity.toLowerCase()}`
                    }
                  >
                    {alert.severity}
                  </span>
                </div>

                <p>{alert.description}</p>

                <div className="alert-meta">
                  <span>{alert.code}</span>

                  {alert.accountNumber && (
                    <span>
                      {alert.accountNumber}
                    </span>
                  )}

                  <span>
                    {formatRelativeTime(
                      alert.createdAt
                    )}
                  </span>
                </div>

                <div className="alert-actions">
                  <button
                    type="button"
                    className="mini-button"
                    disabled={
                      hasCase ||
                      busyAlertId === alert.id
                    }
                    onClick={() =>
                      void onOpenCase(alert.id)
                    }
                  >
                    <BriefcaseBusiness
                      size={12}
                    />

                    {hasCase
                      ? "Case opened"
                      : busyAlertId === alert.id
                        ? "Opening..."
                        : "Open case"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InvestigationPanel({
  cases,
  latestRun,
  busyCaseId,
  onAdvance,
}: {
  cases: InvestigationCase[];
  latestRun: DetectionRun | null;
  busyCaseId: string | null;
  onAdvance: (
    caseId: string
  ) => Promise<void>;
}) {
  return (
    <section className="panel cases-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">
            Analyst workflow
          </div>

          <h2>Investigation cases</h2>

          <p>
            Cases opened directly from suspicious
            activity alerts.
          </p>
        </div>

        {latestRun && (
          <div className="detection-run-summary">
            <Radar size={15} />

            <div>
              <strong>
                {latestRun.candidatesFound}
              </strong>

              <span>
                signals · {latestRun.rulesExecuted}
                {" "}rules
              </span>
            </div>
          </div>
        )}
      </div>

      {cases.length === 0 ? (
        <div className="case-empty">
          <BriefcaseBusiness size={25} />

          <strong>No investigation cases yet</strong>

          <span>
            Open a case from a priority alert to
            start analyst review.
          </span>
        </div>
      ) : (
        <div className="case-list">
          {cases.map(
            (investigationCase) => (
              <article
                className="case-item"
                key={investigationCase.id}
              >
                <div className="case-main">
                  <div className="case-title-row">
                    <span
                      className={
                        `case-priority priority-${investigationCase.priority.toLowerCase()}`
                      }
                    >
                      {investigationCase.priority}
                    </span>

                    <strong>
                      {investigationCase.title}
                    </strong>
                  </div>

                  <div className="case-meta">
                    <span>
                      {investigationCase.caseNumber}
                    </span>

                    <span>
                      Alert{" "}
                      {
                        investigationCase
                          .primaryAlertCode
                      }
                    </span>

                    <span>
                      Risk{" "}
                      {
                        investigationCase
                          .alertRiskScore
                      }
                    </span>
                  </div>
                </div>

                <div className="case-actions">
                  <span
                    className={
                      `case-status case-status-${investigationCase.status.toLowerCase()}`
                    }
                  >
                    {humanize(
                      investigationCase.status
                    )}
                  </span>

                  {investigationCase.status !==
                    "CLOSED" && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        busyCaseId ===
                        investigationCase.id
                      }
                      onClick={() =>
                        void onAdvance(
                          investigationCase.id
                        )
                      }
                    >
                      <ChevronRight size={13} />

                      {busyCaseId ===
                      investigationCase.id
                        ? "Updating..."
                        : investigationCase.status ===
                            "OPEN"
                          ? "Start review"
                          : "Close case"}
                    </button>
                  )}
                </div>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}

function TransactionTable({
  transactions,
}: {
  transactions: TransactionView[];
}) {
  return (
    <section className="panel transactions-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">
            Money movement
          </div>

          <h2>Recent transactions</h2>

          <p>
            Latest transfers across monitored
            accounts.
          </p>
        </div>

        <div className="live-label">
          <Activity size={15} />
          Live dataset
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Channel</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map(
              (transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <span className="transaction-reference">
                      {transaction.reference}
                    </span>
                  </td>

                  <td>
                    <div className="party-cell">
                      <strong>
                        {
                          transaction
                            .sourceCustomer
                        }
                      </strong>

                      <span>
                        {
                          transaction
                            .sourceAccount
                        }
                      </span>
                    </div>
                  </td>

                  <td>
                    <div className="party-cell">
                      <strong>
                        {
                          transaction
                            .destinationCustomer
                        }
                      </strong>

                      <span>
                        {
                          transaction
                            .destinationAccount
                        }
                      </span>
                    </div>
                  </td>

                  <td>
                    <span className="channel-pill">
                      {humanize(
                        transaction.channel
                      )}
                    </span>
                  </td>

                  <td className="amount-cell">
                    {formatCurrency(
                      transaction.amount,
                      transaction.currency
                    )}
                  </td>

                  <td>
                    <span
                      className={
                        `transaction-status status-${transaction.status.toLowerCase()}`
                      }
                    >
                      {humanize(
                        transaction.status
                      )}
                    </span>
                  </td>

                  <td className="time-cell">
                    {formatRelativeTime(
                      transaction.occurredAt
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatCurrency(
  amount: number,
  currency: string
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }
  ).format(amount);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatRelativeTime(
  value: string
) {
  const timestamp =
    new Date(value).getTime();

  const diffMinutes =
    Math.max(
      0,
      Math.round(
        (Date.now() - timestamp) /
          60000
      )
    );

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const hours =
    Math.floor(diffMinutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(hours / 24);

  return `${days}d ago`;
}
