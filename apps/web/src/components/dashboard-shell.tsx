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
  LogOut,
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

import { useAuth } from "./auth-context";
import { GraphExplorer } from "./graph-explorer";
import { GraphInvestigationWorkbench } from "./graph-investigation-workbench";
import { IntelligenceExplorer } from "./intelligence-explorer";
import { CaseWorkspace } from "./case-workspace";

const navItems = [
  {
    name: "Overview",
    icon: LayoutDashboard,
    target: "overview",
  },
  {
    name: "Investigations",
    icon: FileSearch,
    target: "investigations",
  },
  {
    name: "Network",
    icon: GitBranch,
    target: "network",
  },
  {
    name: "Transactions",
    icon: CircleDollarSign,
    target: "transactions",
  },
  {
    name: "Entities",
    icon: Building2,
    target: "entities",
  },
  {
    name: "Alerts",
    icon: ShieldAlert,
    target: "alerts",
  },
] as const;

type NavigationTarget =
  (typeof navItems)[number]["target"];

import {
  OperationsGovernanceWorkspace,
} from "./operations-governance-workspace";

const workspaceContent:
  Record<
    NavigationTarget,
    {
      eyebrow: string;
      title: string;
      description: string;
    }
  > = {
  overview: {
    eyebrow:
      "Financial intelligence workspace",
    title:
      "Investigation overview",
    description:
      "Detect suspicious money movement, investigate connected entities, and manage analyst cases.",
  },

  investigations: {
    eyebrow:
      "Analyst workflow",
    title:
      "Investigations",
    description:
      "Review active cases, supporting evidence, analyst notes and case decisions.",
  },

  network: {
    eyebrow:
      "Network investigation",
    title:
      "Network investigation",
    description:
      "Trace money paths, expand connected accounts and inspect circular transaction structures.",
  },

  transactions: {
    eyebrow:
      "Money movement",
    title:
      "Transactions",
    description:
      "Review recent transfers across monitored accounts and identify activity requiring further investigation.",
  },

  entities: {
    eyebrow:
      "Financial intelligence",
    title:
      "Entities",
    description:
      "Investigate customers, accounts, counterparties and their connected activity.",
  },

  alerts: {
    eyebrow:
      "Risk queue",
    title:
      "Alerts",
    description:
      "Review suspicious activity detected across monitored accounts and open investigation cases where required.",
  },
};


export function DashboardShell() {
  const {
    session,
    logout,
    hasAnyRole,
  } = useAuth();

  const canRunDetection =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

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

  const [
    activeNavigation,
    setActiveNavigation,
  ] =
    useState<NavigationTarget>(
      "overview"
    );

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

  function handleWorkspaceNavigation(
    target: NavigationTarget
  ) {
    setActiveNavigation(
      target
    );

    const reduceMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    window.scrollTo({
      top: 0,
      behavior:
        reduceMotion
          ? "auto"
          : "smooth",
    });
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

  const workspaceDefinition =
    workspaceContent[
      activeNavigation
    ];

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

            const isActive =
              activeNavigation ===
              item.target;

            return (
              <button
                type="button"
                className={
                  isActive
                    ? "nav-item active"
                    : "nav-item"
                }
                key={item.name}
                aria-current={
                  isActive
                    ? "location"
                    : undefined
                }
                title={item.name}
                onClick={() =>
                  handleWorkspaceNavigation(
                    item.target
                  )
                }
              >
                <Icon size={18} />
                <span>{item.name}</span>

                {isActive && (
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
              <strong>
                {session.displayName}
              </strong>

              <span>
                {humanize(
                  session.roles[0] ??
                    "AML_ANALYST"
                )}
              </span>
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

            <div className="security-session-pill">
              <strong>
                {session.displayName}
              </strong>

              <span>
                {humanize(
                  session.roles[0] ??
                    "AML_ANALYST"
                )}
              </span>
            </div>

            <button
              className="icon-button"
              type="button"
              aria-label="Log out"
              title="Log out"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>

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
          <section
            className="page-heading workspace-page-heading"
          >
            <div>
              <div className="eyebrow">
                {
                  workspaceDefinition
                    .eyebrow
                }
              </div>

              <h1>
                {
                  workspaceDefinition
                    .title
                }
              </h1>

              <p>
                {
                  workspaceDefinition
                    .description
                }
              </p>
            </div>

            {activeNavigation ===
              "overview" && (
              <div className="page-actions">
                {latestRun && (
                  <div className="detection-pill">
                    <Radar size={14} />

                    <span>
                      {
                        latestRun
                          .candidatesFound
                      }{" "}
                      signals
                    </span>

                    <small>
                      {
                        latestRun
                          .status
                      }
                    </small>
                  </div>
                )}

                <div className="detection-action-group">
                  <button
                                    className={
                                    canRunDetection
                                      ? "primary-button"
                                      : "primary-button primary-button-restricted"
                                  }
                                    type="button"
                                  aria-describedby={
                                    canRunDetection
                                      ? undefined
                                      : "aml-detection-permission"
                                  }
                                    disabled={
                                      detecting ||
                                      !canRunDetection
                                    }
                                    title={
                                      canRunDetection
                                        ? "Run AML detection"
                                        : "Senior Analyst or Administrator required"
                                    }
                                    onClick={() =>
                                      void handleRunDetection()
                                    }
                                  >
                                    <Play size={16} />

                                    {detecting
                                      ? "Scanning..."
                                      : "Run AML detection"}
                                  </button>

                  {!canRunDetection && (
                    <span
                      id="aml-detection-permission"
                      className="detection-permission-note"
                    >
                      Senior Analyst or Administrator required
                    </span>
                  )}
                </div>
              </div>
            )}
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
                {activeNavigation ===
                  "overview" && (
                  <div className="workspace-view workspace-view-overview">
                    <Metrics
                      overview={overview}
                    />

                    <div className="workspace-grid">
                      <GraphExplorer
                        network={network}
                      />

                      <AlertPanel
                        alerts={
                          overview.alerts.slice(
                            0,
                            3
                          )
                        }
                        caseAlertIds={
                          caseAlertIds
                        }
                        busyAlertId={
                          caseActionId
                        }
                        onOpenCase={
                          handleOpenCase
                        }
                      />
                    </div>

                    <InvestigationPanel
                      cases={cases}
                      latestRun={
                        latestRun
                      }
                      busyCaseId={
                        caseActionId
                      }
                      onAdvance={
                        handleAdvanceCase
                      }
                      transactions={
                        overview
                          .recentTransactions
                      }
                    />
                  </div>
                )}

                {activeNavigation ===
                  "investigations" && (
                  <div className="workspace-view workspace-view-investigations">
                    <InvestigationPanel
                      cases={cases}
                      latestRun={
                        latestRun
                      }
                      busyCaseId={
                        caseActionId
                      }
                      onAdvance={
                        handleAdvanceCase
                      }
                      transactions={
                        overview
                          .recentTransactions
                      }
                    />

                    <CaseWorkspace
                      cases={cases}
                    />
                  </div>
                )}

                {activeNavigation ===
                  "network" && (
                  <div className="workspace-view workspace-view-network">
                    <GraphInvestigationWorkbench />
                  </div>
                )}

                {activeNavigation ===
                  "transactions" && (
                  <div className="workspace-view workspace-view-transactions">
                    <TransactionTable
                      transactions={
                        overview
                          .recentTransactions
                      }
                    />
                  </div>
                )}

                {activeNavigation ===
                  "entities" && (
                  <div className="workspace-view workspace-view-entities">
                    <IntelligenceExplorer />
                  </div>
                )}

                {activeNavigation ===
                  "alerts" && (
                  <div className="workspace-view workspace-view-alerts">
                    <AlertPanel
                      alerts={
                        overview.alerts
                      }
                      caseAlertIds={
                        caseAlertIds
                      }
                      busyAlertId={
                        caseActionId
                      }
                      onOpenCase={
                        handleOpenCase
                      }
                    />
                  </div>
                )}
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
    <section
      id="workspace-alerts"
      className="panel alerts-panel workspace-nav-anchor"
      tabIndex={-1}
    >
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
  transactions,
  latestRun,
  busyCaseId,
  onAdvance,
}: {
  cases: InvestigationCase[];
  transactions: TransactionView[];
  latestRun: DetectionRun | null;
  busyCaseId: string | null;
  onAdvance: (
    caseId: string
  ) => Promise<void>;
}) {
  return (
    <>
    <div
      id="workspace-investigations"
      className="overview-investigation-cases workspace-nav-anchor"
      tabIndex={-1}
    >
  <section className="panel cases-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">
              Case queue
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
</div>

<OperationsGovernanceWorkspace
  caseWorkspace={
      <CaseWorkspace cases={cases} />
  }
  recentTransactions={
    <TransactionTable
      transactions={transactions}
    />
  }
/>
    </>
  );
}

function TransactionTable({
  transactions,
}: {
  transactions: TransactionView[];
}) {
  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("ALL");

  const [
    channelFilter,
    setChannelFilter,
  ] =
    useState("ALL");

  const statusOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            transactions.map(
              (transaction) =>
                transaction.status
            )
          )
        ).sort(),
      [transactions]
    );

  const channelOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            transactions.map(
              (transaction) =>
                transaction.channel
            )
          )
        ).sort(),
      [transactions]
    );

  const normalizedQuery =
    searchQuery
      .trim()
      .toLowerCase();

  const filteredTransactions =
    useMemo(
      () =>
        transactions.filter(
          (transaction) => {
            const searchableText =
              [
                transaction.reference,
                transaction.sourceCustomer,
                transaction.sourceAccount,
                transaction.destinationCustomer,
                transaction.destinationAccount,
              ]
                .join(" ")
                .toLowerCase();

            const matchesSearch =
              normalizedQuery.length ===
                0 ||
              searchableText.includes(
                normalizedQuery
              );

            const matchesStatus =
              statusFilter === "ALL" ||
              transaction.status ===
                statusFilter;

            const matchesChannel =
              channelFilter === "ALL" ||
              transaction.channel ===
                channelFilter;

            return (
              matchesSearch &&
              matchesStatus &&
              matchesChannel
            );
          }
        ),
      [
        transactions,
        normalizedQuery,
        statusFilter,
        channelFilter,
      ]
    );

  const hasActiveFilters =
    normalizedQuery.length > 0 ||
    statusFilter !== "ALL" ||
    channelFilter !== "ALL";

  const visibleCountLabel =
    hasActiveFilters
      ? `${filteredTransactions.length} of ${transactions.length} transactions`
      : `${transactions.length} transactions shown`;

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("ALL");
    setChannelFilter("ALL");
  }

  return (
    <section className="panel transactions-panel transactions-ledger">
      <div className="panel-heading transactions-ledger-heading">
        <div>
          <div className="eyebrow">
            Transaction ledger
          </div>

          <h2>
            Recent transactions
          </h2>

          <p>
            Latest transfers across monitored
            accounts.
          </p>
        </div>

        <div
          className="live-label transactions-dataset-label"
          title="Synthetic demonstration dataset"
        >
          <Activity size={15} />
          Synthetic dataset
        </div>
      </div>

      <div
        className="transaction-ledger-toolbar"
        aria-label="Transaction filters"
      >
        <label className="transaction-ledger-search">
          <span className="transaction-ledger-visually-hidden">
            Search transactions
          </span>

          <Search
            size={15}
            aria-hidden="true"
          />

          <input
            type="search"
            value={searchQuery}
            placeholder="Search reference, account or customer..."
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
          />
        </label>

        <select
          className="transaction-ledger-filter"
          aria-label="Filter transactions by status"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
        >
          <option value="ALL">
            All statuses
          </option>

          {statusOptions.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {humanize(status)}
              </option>
            )
          )}
        </select>

        <select
          className="transaction-ledger-filter"
          aria-label="Filter transactions by channel"
          value={channelFilter}
          onChange={(event) =>
            setChannelFilter(
              event.target.value
            )
          }
        >
          <option value="ALL">
            All channels
          </option>

          {channelOptions.map(
            (channel) => (
              <option
                key={channel}
                value={channel}
              >
                {humanize(channel)}
              </option>
            )
          )}
        </select>

        <button
          type="button"
          className="transaction-ledger-reset"
          disabled={!hasActiveFilters}
          onClick={resetFilters}
        >
          Reset
        </button>
      </div>

      <div className="transaction-ledger-context">
        <span>
          {visibleCountLabel}
        </span>

        {hasActiveFilters && (
          <span className="transaction-ledger-filter-state">
            Filtered view
          </span>
        )}
      </div>

      <div className="table-scroll">
        <table className="transaction-ledger-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Channel</th>
              <th className="amount-heading">
                Amount
              </th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {filteredTransactions.length ===
            0 ? (
              <tr>
                <td
                  className="transaction-ledger-empty"
                  colSpan={7}
                >
                  {transactions.length === 0
                    ? "No transactions are available."
                    : "No transactions match the current filters."}
                </td>
              </tr>
            ) : (
              filteredTransactions.map(
                (transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <span
                        className="transaction-reference transaction-reference-static"
                        title={`Transaction reference: ${transaction.reference}`}
                      >
                        {
                          transaction
                            .reference
                        }
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

                    <td className="time-cell transaction-time-cell">
                      <time
                        dateTime={
                          transaction
                            .occurredAt
                        }
                        title={
                          transaction
                            .occurredAt
                        }
                      >
                        <span className="transaction-time-exact">
                          {formatTransactionTimestamp(
                            transaction
                              .occurredAt
                          )}
                        </span>

                        <span className="transaction-time-relative">
                          {formatRelativeTime(
                            transaction
                              .occurredAt
                          )}
                        </span>
                      </time>
                    </td>
                  </tr>
                )
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

function formatTransactionTimestamp(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
      timeZoneName: "short",
    }
  ).format(date);
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
