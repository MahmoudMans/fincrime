"use client";

import {
  AlertTriangle,
  Bell,
  LogOut,
  Menu,
  Network,
  Play,
  Radar,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  advanceCase,
  openCaseFromAlert,
  runAmlDetection,
  type AlertView,
  type InvestigationCase,
} from "@/lib/api";
import {
  formatRelativeTime,
  humanize,
  initialsOf,
} from "@/lib/format";
import {
  NAV_GROUPS,
  NAV_ITEMS,
  getNavGroup,
  getNavItem,
  type ViewId,
} from "@/lib/navigation";
import { useHashRoute } from "@/lib/use-hash-route";
import { useOverviewData } from "@/lib/use-overview-data";

import { AlertQueue } from "./alert-queue";
import { useAuth } from "./auth-context";
import { CaseQueue } from "./case-queue";
import { CaseWorkspace } from "./case-workspace";
import { CommandPalette } from "./command-palette";
import { ComplianceOperations } from "./compliance-operations";
import { CustomerRiskDashboard } from "./customer-risk-dashboard";
import { DataIngestionCenter } from "./data-ingestion-center";
import { DecisionExecution } from "./decision-execution";
import { DecisionGovernance } from "./decision-governance";
import { EvidenceChainOfCustody } from "./evidence-chain-of-custody";
import { EvidenceReviewGovernance } from "./evidence-review-governance";
import { GraphExplorer } from "./graph-explorer";
import { GraphInvestigationWorkbench } from "./graph-investigation-workbench";
import { IntelligenceExplorer } from "./intelligence-explorer";
import { InvestigationConclusionRelease } from "./investigation-conclusion-release";
import { InvestigationFindings } from "./investigation-findings";
import { InvestigationTriage } from "./investigation-triage";
import { OutcomeAttestations } from "./outcome-attestations";
import { OverviewInsights } from "./overview-insights";
import {
  AlertPanel,
  AttentionStrip,
  Metrics,
} from "./overview-panels";
import { RuleGovernance } from "./rule-governance";
import { SecurityAuditLedger } from "./security-audit-ledger";
import { ViewErrorBoundary } from "./view-error-boundary";
import { WatchlistScreening } from "./watchlist-screening";

const ENVIRONMENT_LABEL =
  process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ??
  "Synthetic data";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function DashboardShell() {
  const { session, logout, hasAnyRole } = useAuth();

  const { route, navigate } = useHashRoute();

  const data = useOverviewData();

  const {
    overview,
    network,
    cases,
    detectionRuns,
    alertStats,
    errors,
    loading,
  } = data;

  const canRunDetection = hasAnyRole(
    "SENIOR_ANALYST",
    "ADMIN"
  );

  const [actionError, setActionError] = useState<
    string | null
  >(null);

  const [detecting, setDetecting] = useState(false);

  const [caseActionId, setCaseActionId] = useState<
    string | null
  >(null);

  const [alertReloadKey, setAlertReloadKey] =
    useState(0);

  const [paletteOpen, setPaletteOpen] =
    useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [bellOpen, setBellOpen] = useState(false);

  const headingRef = useRef<HTMLHeadingElement | null>(
    null
  );

  const mainRef = useRef<HTMLElement | null>(null);

  const firstRender = useRef(true);

  const activeItem = getNavItem(route.view);

  const activeGroup = getNavGroup(activeItem.group);

  const shortcutLabel = useMemo(
    () =>
      /Mac|iPhone|iPad/.test(navigator.userAgent)
        ? "⌘K"
        : "Ctrl K",
    []
  );

  const go = useCallback(
    (view: ViewId, param?: string | null) => {
      setMenuOpen(false);
      setBellOpen(false);
      navigate(view, param);
    },
    [navigate]
  );

  // Browser tab title follows the active module.
  useEffect(() => {
    document.title = `${activeItem.label} · FinCrime Graph`;
  }, [activeItem.label]);

  // Move focus to the page heading after navigating so keyboard and
  // screen-reader users land at the top of the new view.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    // The hash change can land after the user has already reopened the
    // palette (or another dialog); never pull focus out of a dialog.
    const focused = document.activeElement;

    if (
      focused instanceof HTMLElement &&
      focused.closest('[role="dialog"]')
    ) {
      return;
    }

    headingRef.current?.focus({ preventScroll: true });
  }, [route.view]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setMenuOpen(false);
        setBellOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () =>
      window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleRunDetection() {
    try {
      setDetecting(true);
      setActionError(null);

      await runAmlDetection();
      await data.refresh();

      setAlertReloadKey((key) => key + 1);
    } catch (failure) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : "AML detection failed."
      );
    } finally {
      setDetecting(false);
    }
  }

  async function handleOpenCase(alertId: string) {
    try {
      setCaseActionId(alertId);
      setActionError(null);

      await openCaseFromAlert(alertId);
      await data.refreshCases();
    } catch (failure) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : "Unable to open investigation case."
      );
    } finally {
      setCaseActionId(null);
    }
  }

  async function handleAdvanceCase(caseId: string) {
    try {
      setCaseActionId(caseId);
      setActionError(null);

      await advanceCase(caseId);
      await data.refreshCases();
    } catch (failure) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : "Unable to update case."
      );
    } finally {
      setCaseActionId(null);
    }
  }

  const casesByAlert = useMemo(
    () =>
      new Map<string, string>(
        cases.map((item) => [
          item.primaryAlertId,
          item.id,
        ])
      ),
    [cases]
  );

  const openCaseCount = useMemo(
    () =>
      cases.filter((item) => item.status !== "CLOSED")
        .length,
    [cases]
  );

  const latestRun =
    detectionRuns.length > 0 ? detectionRuns[0] : null;

  const notifications = useMemo(
    () =>
      buildNotifications(overview?.alerts ?? [], cases),
    [overview, cases]
  );

  const roleLabel = humanize(
    session.roles[0] ?? "AML_ANALYST"
  );

  const badgeFor = (view: ViewId): string | null => {
    if (view === "alerts" && overview) {
      return overview.summary.openAlerts > 0
        ? String(overview.summary.openAlerts)
        : null;
    }

    if (view === "cases" && openCaseCount > 0) {
      return String(openCaseCount);
    }

    return null;
  };

  const backendDown = errors.overview !== null && !overview;

  const partialErrors = [
    errors.overview && overview ? errors.overview : null,
    errors.network,
    errors.cases,
    errors.runs,
  ].filter((value): value is string => Boolean(value));

  const showDetectionAction =
    route.view === "overview" || route.view === "alerts";

  return (
    <div className="app-shell">
      <button
        type="button"
        className="ui-skip-link"
        onClick={() => mainRef.current?.focus()}
      >
        Skip to main content
      </button>

      {menuOpen && (
        <div
          className="ui-scrim"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={
          menuOpen ? "sidebar ui-sidebar-open" : "sidebar"
        }
        id="app-sidebar"
      >
        <div className="brand">
          <div className="brand-mark">
            <Network size={22} />
          </div>

          <div>
            <strong>FinCrime</strong>
            <span>Graph Intelligence</span>
          </div>

          <button
            type="button"
            className="ui-sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav
          className="sidebar-nav"
          aria-label="Workspaces"
        >
          {NAV_GROUPS.map((group) => (
            <div className="ui-nav-group" key={group.id}>
              <div className="nav-label">{group.label}</div>

              {NAV_ITEMS.filter(
                (item) => item.group === group.id
              ).map((item) => {
                const Icon = item.icon;

                const isActive = route.view === item.id;

                const badge = badgeFor(item.id);

                return (
                  <button
                    type="button"
                    className={
                      isActive
                        ? "nav-item active"
                        : "nav-item"
                    }
                    key={item.id}
                    aria-current={
                      isActive ? "page" : undefined
                    }
                    onClick={() => go(item.id)}
                  >
                    <Icon size={18} />

                    <span className="ui-nav-label">
                      {item.label}
                    </span>

                    {badge && (
                      <span className="ui-nav-badge">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status" role="status">
            <span
              className={
                backendDown
                  ? "status-indicator status-indicator-down"
                  : "status-indicator"
              }
            />

            <div>
              <strong>
                {backendDown
                  ? "Backend unreachable"
                  : "Backend connected"}
              </strong>

              <span>
                {backendDown
                  ? "Check that the API is running"
                  : latestRun
                    ? `Last detection run ${formatRelativeTime(
                        latestRun.completedAt ??
                          latestRun.startedAt
                      )}`
                    : "No detection run yet"}
              </span>
            </div>
          </div>

          <div className="analyst-card">
            <div className="avatar" aria-hidden="true">
              {initialsOf(session.displayName)}
            </div>

            <div>
              <strong>{session.displayName}</strong>

              <span>{roleLabel}</span>
            </div>
          </div>
        </div>
      </aside>

      <main
        className="main-content"
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
      >
        <header className="topbar">
          <button
            type="button"
            className="icon-button ui-menu-button"
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={18} />
          </button>

          <button
            type="button"
            className="ui-search-trigger"
            onClick={() => setPaletteOpen(true)}
          >
            <Search size={16} aria-hidden="true" />

            <span>Search or jump to...</span>

            <kbd>{shortcutLabel}</kbd>
          </button>

          <div className="topbar-actions">
            {ENVIRONMENT_LABEL && (
              <div className="environment-pill">
                <span />
                {ENVIRONMENT_LABEL}
              </div>
            )}

            <div className="security-session-pill">
              <strong>{session.displayName}</strong>

              <span>{roleLabel}</span>
            </div>

            <div className="ui-bell">
              <button
                className="icon-button notification-button"
                type="button"
                aria-label={
                  notifications.length > 0
                    ? `Notifications, ${notifications.length} need attention`
                    : "Notifications"
                }
                aria-expanded={bellOpen}
                aria-haspopup="true"
                onClick={() => setBellOpen((open) => !open)}
              >
                <Bell size={18} />

                {notifications.length > 0 && (
                  <span className="notification-count">
                    {notifications.length}
                  </span>
                )}
              </button>

              {bellOpen && (
                <NotificationsMenu
                  notifications={notifications}
                  onSelect={(view, param) => go(view, param)}
                  onClose={() => setBellOpen(false)}
                />
              )}
            </div>

            <button
              className="icon-button"
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="dashboard">
          <section className="page-heading workspace-page-heading">
            <div>
              <div className="eyebrow">
                {activeGroup.label}
              </div>

              <h1 ref={headingRef} tabIndex={-1}>
                {activeItem.title}
              </h1>

              <p>{activeItem.description}</p>
            </div>

            {showDetectionAction && (
              <div className="page-actions">
                {latestRun && (
                  <div className="detection-pill">
                    <Radar size={14} />

                    <span>
                      {latestRun.candidatesFound} signals
                    </span>

                    <small>{latestRun.status}</small>
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
                    disabled={detecting || !canRunDetection}
                    title={
                      canRunDetection
                        ? "Run AML detection"
                        : "Senior Analyst or Administrator required"
                    }
                    onClick={() => void handleRunDetection()}
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
            <div className="action-error" role="alert">
              <AlertTriangle size={16} />
              <span>{actionError}</span>

              <button
                type="button"
                className="ui-banner-dismiss"
                aria-label="Dismiss"
                onClick={() => setActionError(null)}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {!backendDown && partialErrors.length > 0 && (
            <div className="action-error" role="status">
              <AlertTriangle size={16} />

              <span>
                Some data could not be refreshed:{" "}
                {partialErrors[0]}
                {partialErrors.length > 1
                  ? ` (+${partialErrors.length - 1} more)`
                  : ""}
              </span>

              <button
                type="button"
                className="ui-banner-dismiss"
                aria-label="Retry loading"
                title="Retry"
                onClick={() => void data.refresh()}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )}

          <ViewErrorBoundary resetKey={route.view}>
            <div
              className={`workspace-view workspace-view-${route.view}`}
            >
              {renderView()}
            </div>
          </ViewErrorBoundary>
        </div>
      </main>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onNavigate={go}
          alerts={overview?.alerts ?? []}
          cases={cases}
          transactions={overview?.recentTransactions ?? []}
        />
      )}
    </div>
  );

  function renderView() {
    switch (route.view) {
      case "overview":
        if (loading && !overview) {
          return (
            <div className="state-card">
              <div className="spinner" />

              <strong>Loading investigation data</strong>

              <span>
                Connecting PostgreSQL and Neo4j
                intelligence...
              </span>
            </div>
          );
        }

        if (!overview) {
          return (
            <div className="state-card error-state">
              <AlertTriangle size={28} />

              <strong>Unable to reach the backend</strong>

              <span>
                {errors.overview ??
                  "The dashboard data did not load."}
              </span>

              <code>
                cd apps/backend && mvn spring-boot:run
              </code>

              <button
                type="button"
                className="secondary-button"
                onClick={() => void data.refresh()}
              >
                <RefreshCw size={13} aria-hidden="true" />
                Try again
              </button>
            </div>
          );
        }

        return (
          <>
            <AttentionStrip
              overview={overview}
              cases={cases}
              latestRun={latestRun}
              onNavigate={(view) => go(view)}
            />

            <Metrics overview={overview} />

            <OverviewInsights
              alertStats={alertStats}
              cases={cases}
              detectionRuns={detectionRuns}
              onOpenAlerts={(severity) =>
                go(
                  "alerts",
                  severity ? `severity:${severity}` : null
                )
              }
              onOpenCases={() => go("cases")}
            />

            <div className="workspace-grid">
              {network ? (
                <GraphExplorer network={network} />
              ) : (
                <section className="panel">
                  <div className="state-card error-state">
                    <AlertTriangle size={26} />

                    <strong>Network graph unavailable</strong>

                    <span>
                      {errors.network ??
                        "The graph did not load. Check that Neo4j is running."}
                    </span>
                  </div>
                </section>
              )}

              <AlertPanel
                alerts={overview.alerts.slice(0, 3)}
                casesByAlert={casesByAlert}
                busyAlertId={caseActionId}
                onOpenCase={handleOpenCase}
                onViewCase={(caseId) => go("cases", caseId)}
                onViewAll={() => go("alerts")}
              />
            </div>

            <CaseQueue
              cases={cases}
              latestRun={latestRun}
              busyCaseId={caseActionId}
              onAdvance={handleAdvanceCase}
              onOpenCase={(caseId) => go("cases", caseId)}
            />
          </>
        );

      case "alerts": {
        const preset = parseAlertPreset(route.param);

        return (
          <AlertQueue
            key={route.param ?? "alerts"}
            fallbackAlerts={overview?.alerts ?? []}
            casesByAlert={casesByAlert}
            busyAlertId={caseActionId}
            initialQuery={preset.query}
            initialSeverity={preset.severity}
            initialStatus={preset.status}
            refreshKey={alertReloadKey}
            onOpenCase={handleOpenCase}
            onViewCase={(caseId) => go("cases", caseId)}
          />
        );
      }

      case "cases":
        return (
          <>
            <CaseQueue
              cases={cases}
              latestRun={latestRun}
              busyCaseId={caseActionId}
              onAdvance={handleAdvanceCase}
              onOpenCase={(caseId) => go("cases", caseId)}
            />

            <CaseWorkspace
              key={route.param ?? "workspace"}
              cases={cases}
              initialCaseId={route.param}
              onCaseChanged={() => void data.refreshCases()}
            />
          </>
        );

      case "transactions":
        return (
          <IntelligenceExplorer
            key={`transactions:${route.param ?? ""}`}
            initialTab="transactions"
            initialQuery={route.param ?? ""}
          />
        );

      case "entities":
        return (
          <IntelligenceExplorer
            key="entities"
            initialTab="customers"
          />
        );

      case "network":
        return <GraphInvestigationWorkbench />;

      case "triage":
        return <InvestigationTriage />;

      case "customer-risk":
        return <CustomerRiskDashboard />;

      case "watchlist":
        return <WatchlistScreening />;

      case "compliance":
        return <ComplianceOperations />;

      case "custody":
        return <EvidenceChainOfCustody />;

      case "evidence-review":
        return <EvidenceReviewGovernance />;

      case "findings":
        return <InvestigationFindings />;

      case "decisions":
        return <DecisionGovernance />;

      case "execution":
        return <DecisionExecution />;

      case "attestations":
        return <OutcomeAttestations />;

      case "release":
        return <InvestigationConclusionRelease />;

      case "rules":
        return <RuleGovernance />;

      case "audit":
        return <SecurityAuditLedger />;

      case "ingestion":
        return <DataIngestionCenter />;
    }
  }
}

/**
 * "#/alerts/severity:HIGH" and "#/alerts/status:OPEN" open the
 * queue with that filter set; anything else is a search text.
 */
function parseAlertPreset(param: string | null) {
  const match = /^(severity|status):([A-Za-z_]+)$/.exec(
    param ?? ""
  );

  if (!match) {
    return {
      query: param ?? "",
      severity: "ALL",
      status: "ALL",
    };
  }

  const value = match[2].toUpperCase();

  return {
    query: "",
    severity: match[1] === "severity" ? value : "ALL",
    status: match[1] === "status" ? value : "ALL",
  };
}

interface AttentionNotification {
  key: string;
  title: string;
  detail: string;
  view: ViewId;
  param: string | null;
  tone: "danger" | "warning";
}

function buildNotifications(
  alerts: AlertView[],
  cases: InvestigationCase[]
): AttentionNotification[] {
  const alertIdsWithCase = new Set(
    cases.map((item) => item.primaryAlertId)
  );

  const severe: AttentionNotification[] = alerts
    .filter(
      (alert) =>
        (alert.severity === "CRITICAL" ||
          alert.severity === "HIGH") &&
        alert.status !== "CLOSED"
    )
    .map((alert) => ({
      key: `alert:${alert.id}`,
      title: alert.title,
      detail: `${humanize(alert.severity)} alert · ${
        alertIdsWithCase.has(alert.id)
          ? "case opened"
          : "no case yet"
      } · ${formatRelativeTime(alert.createdAt)}`,
      view: "alerts",
      param: alert.code,
      tone: "danger",
    }));

  const unassigned: AttentionNotification[] = cases
    .filter(
      (item) =>
        item.status !== "CLOSED" && !item.assignedTo
    )
    .map((item) => ({
      key: `case:${item.id}`,
      title: item.title,
      detail: `${item.caseNumber} · unassigned`,
      view: "cases",
      param: item.id,
      tone: "warning",
    }));

  return [...severe, ...unassigned];
}

function NotificationsMenu({
  notifications,
  onSelect,
  onClose,
}: {
  notifications: AttentionNotification[];
  onSelect: (view: ViewId, param: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (
        ref.current &&
        target instanceof Node &&
        !ref.current.contains(target) &&
        !(
          target instanceof Element &&
          target.closest(".notification-button")
        )
      ) {
        onClose();
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
  }, [onClose]);

  return (
    <div
      className="ui-popover"
      ref={ref}
      role="region"
      aria-label="Notifications"
    >
      <div className="ui-popover-heading">
        <strong>Needs attention</strong>

        <span>{notifications.length}</span>
      </div>

      {notifications.length === 0 ? (
        <p className="ui-popover-empty">
          Nothing needs attention right now.
        </p>
      ) : (
        <ul className="ui-popover-list">
          {notifications.slice(0, 8).map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`ui-popover-item ui-tone-${item.tone}`}
                onClick={() =>
                  onSelect(item.view, item.param)
                }
              >
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
