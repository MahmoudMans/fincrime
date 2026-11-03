"use client";

import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Landmark,
  Radar,
  ShieldAlert,
  Users,
  WalletCards,
} from "lucide-react";

import type {
  AlertView,
  DashboardOverview,
  DetectionRun,
  InvestigationCase,
} from "@/lib/api";
import {
  formatCurrency,
  formatRelativeTime,
  humanize,
} from "@/lib/format";
import type { ViewId } from "@/lib/navigation";

export function Metrics({
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
    <section
      className="metrics-grid"
      aria-label="Key figures"
    >
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            className="metric-card"
            key={card.label}
          >
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

interface AttentionItem {
  key: string;
  tone: "danger" | "warning" | "info" | "ok";
  label: string;
  detail: string;
  target: ViewId;
}

/**
 * "What needs me right now" strip. Derived only from data the shell
 * already holds, so it costs no extra requests.
 */
export function AttentionStrip({
  overview,
  cases,
  latestRun,
  onNavigate,
}: {
  overview: DashboardOverview;
  cases: InvestigationCase[];
  latestRun: DetectionRun | null;
  onNavigate: (view: ViewId) => void;
}) {
  const alertIdsWithCase = new Set(
    cases.map((item) => item.primaryAlertId)
  );

  const uncasedSevere = overview.alerts.filter(
    (alert) =>
      (alert.severity === "CRITICAL" ||
        alert.severity === "HIGH") &&
      alert.status !== "CLOSED" &&
      !alertIdsWithCase.has(alert.id)
  ).length;

  const unassigned = cases.filter(
    (item) =>
      item.status !== "CLOSED" && !item.assignedTo
  ).length;

  const inReview = cases.filter(
    (item) => item.status === "IN_REVIEW"
  ).length;

  const items: AttentionItem[] = [];

  if (uncasedSevere > 0) {
    items.push({
      key: "severe",
      tone: "danger",
      label: `${uncasedSevere} high-severity alert${
        uncasedSevere === 1 ? "" : "s"
      } without a case`,
      detail: "Among the top-scoring alerts",
      target: "alerts",
    });
  }

  if (unassigned > 0) {
    items.push({
      key: "unassigned",
      tone: "warning",
      label: `${unassigned} open case${
        unassigned === 1 ? " is" : "s are"
      } unassigned`,
      detail: "Assign an owner so work starts",
      target: "cases",
    });
  }

  if (inReview > 0) {
    items.push({
      key: "review",
      tone: "info",
      label: `${inReview} case${
        inReview === 1 ? "" : "s"
      } in review`,
      detail: "Waiting on an analyst decision",
      target: "cases",
    });
  }

  items.push(
    latestRun
      ? {
          key: "run",
          tone: "ok",
          label: `Last detection run ${formatRelativeTime(
            latestRun.completedAt ?? latestRun.startedAt
          )}`,
          detail: `${latestRun.candidatesFound} signals · ${latestRun.alertsCreated} new alerts`,
          target: "alerts",
        }
      : {
          key: "run",
          tone: "warning",
          label: "Detection has not run yet",
          detail: "Run AML detection to generate alerts",
          target: "overview",
        }
  );

  const allClear =
    uncasedSevere === 0 &&
    unassigned === 0 &&
    inReview === 0;

  return (
    <section
      className="ui-attention"
      aria-label="Needs attention"
    >
      {allClear && (
        <div className="ui-attention-clear">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>
            Nothing is waiting on you among the top alerts and
            cases.
          </span>
        </div>
      )}

      <ul className="ui-attention-list">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`ui-attention-item ui-tone-${item.tone}`}
              onClick={() => onNavigate(item.target)}
            >
              <span className="ui-attention-icon">
                {item.tone === "ok" ? (
                  <Clock3 size={15} aria-hidden="true" />
                ) : (
                  <AlertTriangle
                    size={15}
                    aria-hidden="true"
                  />
                )}
              </span>

              <span className="ui-attention-copy">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>

              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AlertRow({
  alert,
  caseId,
  busy,
  onOpenCase,
  onViewCase,
}: {
  alert: AlertView;
  /** Id of the case already opened from this alert, if any. */
  caseId: string | null;
  busy: boolean;
  onOpenCase: (alertId: string) => Promise<void>;
  onViewCase: (caseId: string) => void;
}) {
  return (
    <article className="alert-item">
      <div
        className={`risk-score risk-score-${alert.severity.toLowerCase()}`}
        title={`Risk score ${alert.riskScore}`}
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

          <span>{humanize(alert.status)}</span>

          <span>{formatRelativeTime(alert.createdAt)}</span>
        </div>

        <div className="alert-actions">
          {caseId ? (
            <button
              type="button"
              className="mini-button"
              onClick={() => onViewCase(caseId)}
            >
              <BriefcaseBusiness size={12} />
              View case
            </button>
          ) : (
            <button
              type="button"
              className="mini-button"
              disabled={busy}
              onClick={() => void onOpenCase(alert.id)}
            >
              <BriefcaseBusiness size={12} />

              {busy ? "Opening..." : "Open case"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function AlertPanel({
  alerts,
  casesByAlert,
  busyAlertId,
  onOpenCase,
  onViewCase,
  onViewAll,
}: {
  alerts: AlertView[];
  casesByAlert: Map<string, string>;
  busyAlertId: string | null;
  onOpenCase: (alertId: string) => Promise<void>;
  onViewCase: (caseId: string) => void;
  /** When set, shows a link to the full alert queue. */
  onViewAll?: () => void;
}) {
  return (
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Risk queue</div>

          <h2>Priority alerts</h2>

          <p>
            Highest-scoring activity requiring analyst
            review.
          </p>
        </div>

        <span className="live-label">
          <Radar size={14} />
          Rule engine
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="case-empty">
          <ShieldAlert size={25} />

          <strong>No alerts yet</strong>

          <span>
            Run AML detection to generate alerts from the
            monitored transactions.
          </span>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              caseId={casesByAlert.get(alert.id) ?? null}
              busy={busyAlertId === alert.id}
              onOpenCase={onOpenCase}
              onViewCase={onViewCase}
            />
          ))}
        </div>
      )}

      {onViewAll && (
        <button
          type="button"
          className="ui-panel-link"
          onClick={onViewAll}
        >
          Open the full alert queue
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
