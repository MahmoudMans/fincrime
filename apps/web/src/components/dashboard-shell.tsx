"use client";

import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  ChevronRight,
  CircleDollarSign,
  FileSearch,
  GitBranch,
  Landmark,
  LayoutDashboard,
  Network,
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
  fetchDashboardOverview,
  fetchGraphNetwork,
  type AlertView,
  type DashboardOverview,
  type GraphNetwork,
  type TransactionView,
} from "@/lib/api";

import { GraphExplorer } from "./graph-explorer";

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

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [overviewData, graphData] =
          await Promise.all([
            fetchDashboardOverview(controller.signal),
            fetchGraphNetwork(controller.signal),
          ]);

        setOverview(overviewData);
        setNetwork(graphData);
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

  const criticalAlerts = useMemo(
    () =>
      overview?.alerts.filter(
        (alert) =>
          alert.severity === "CRITICAL" ||
          alert.severity === "HIGH"
      ).length ?? 0,
    [overview]
  );

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
              <span>Local investigation environment</span>
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
                Detect suspicious money movement, investigate
                connected entities, and prioritize alerts.
              </p>
            </div>

            <button
              className="primary-button"
              type="button"
            >
              <FileSearch size={17} />
              New investigation
            </button>
          </section>

          {loading && (
            <div className="state-card">
              <div className="spinner" />
              <strong>Loading investigation data</strong>
              <span>
                Connecting PostgreSQL and Neo4j intelligence...
              </span>
            </div>
          )}

          {error && (
            <div className="state-card error-state">
              <AlertTriangle size={28} />
              <strong>Unable to reach the backend</strong>
              <span>{error}</span>
              <code>
                cd apps/backend && mvn spring-boot:run
              </code>
            </div>
          )}

          {!loading && !error && overview && network && (
            <>
              <Metrics overview={overview} />

              <div className="workspace-grid">
                <GraphExplorer network={network} />

                <AlertPanel alerts={overview.alerts} />
              </div>

              <TransactionTable
                transactions={overview.recentTransactions}
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
          <article className="metric-card" key={card.label}>
            <div
              className={`metric-icon metric-${card.tone}`}
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
}: {
  alerts: AlertView[];
}) {
  return (
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Risk queue</div>
          <h2>Priority alerts</h2>
          <p>Highest-scoring activity requiring review.</p>
        </div>

        <button
          className="text-button"
          type="button"
        >
          View all
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="alert-list">
        {alerts.map((alert) => (
          <article
            className="alert-item"
            key={alert.id}
          >
            <div
              className={`risk-score risk-score-${alert.severity.toLowerCase()}`}
            >
              {alert.riskScore}
            </div>

            <div className="alert-content">
              <div className="alert-title-row">
                <strong>{alert.title}</strong>

                <span
                  className={`severity severity-${alert.severity.toLowerCase()}`}
                >
                  {alert.severity}
                </span>
              </div>

              <p>{alert.description}</p>

              <div className="alert-meta">
                <span>{alert.code}</span>

                {alert.accountNumber && (
                  <span>{alert.accountNumber}</span>
                )}

                <span>
                  {formatRelativeTime(alert.createdAt)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
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
          <div className="eyebrow">Money movement</div>
          <h2>Recent transactions</h2>
          <p>
            Latest transfers across monitored accounts.
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
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>
                  <span className="transaction-reference">
                    {transaction.reference}
                  </span>
                </td>

                <td>
                  <div className="party-cell">
                    <strong>
                      {transaction.sourceCustomer}
                    </strong>

                    <span>
                      {transaction.sourceAccount}
                    </span>
                  </div>
                </td>

                <td>
                  <div className="party-cell">
                    <strong>
                      {transaction.destinationCustomer}
                    </strong>

                    <span>
                      {transaction.destinationAccount}
                    </span>
                  </div>
                </td>

                <td>
                  <span className="channel-pill">
                    {humanize(transaction.channel)}
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
                    className={`transaction-status status-${transaction.status.toLowerCase()}`}
                  >
                    {humanize(transaction.status)}
                  </span>
                </td>

                <td className="time-cell">
                  {formatRelativeTime(
                    transaction.occurredAt
                  )}
                </td>
              </tr>
            ))}
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
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - timestamp) / 60000)
  );

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const hours = Math.floor(diffMinutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
}
