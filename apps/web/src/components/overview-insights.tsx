import { Radar } from "lucide-react";

import type { DetectionRun, InvestigationCase } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import type { AlertStats } from "@/lib/use-overview-data";

import {
  BarList,
  Sparkline,
  StackedBar,
  type ChartTone,
} from "./mini-charts";
import { EmptyState } from "./state-card";

const SEVERITIES: ReadonlyArray<
  readonly [string, string, ChartTone]
> = [
  ["CRITICAL", "Critical", "danger"],
  ["HIGH", "High", "danger"],
  ["MEDIUM", "Medium", "warning"],
  ["LOW", "Low", "ok"],
];

const CASE_STATUSES: ReadonlyArray<
  readonly [string, string, ChartTone]
> = [
  ["OPEN", "Open", "info"],
  ["IN_REVIEW", "In review", "warning"],
  ["CLOSED", "Closed", "ok"],
];

const MAX_RUNS = 12;

function countOf(
  counts: Record<string, number>,
  key: string
) {
  return counts[key] ?? 0;
}

/** Oldest first, newest last, at most MAX_RUNS of them. */
function runsForTrend(runs: readonly DetectionRun[]) {
  return [...runs]
    .sort(
      (a, b) =>
        Date.parse(a.startedAt) - Date.parse(b.startedAt)
    )
    .slice(-MAX_RUNS);
}

/**
 * Three small panels under the key figures: alerts by severity,
 * the case pipeline and the detection-run trend. Everything comes
 * from data the dashboard already holds.
 */
export function OverviewInsights({
  alertStats,
  cases,
  detectionRuns,
  onOpenAlerts,
  onOpenCases,
}: {
  /** Null when the backend has no alert search API yet. */
  alertStats: AlertStats | null;
  cases: InvestigationCase[];
  detectionRuns: DetectionRun[];
  /** Opens the alert queue, optionally for one severity (e.g. "HIGH"). */
  onOpenAlerts: (severity?: string) => void;
  onOpenCases: () => void;
}) {
  const caseCounts: Record<string, number> = {};

  const activePriorities: Record<string, number> = {};

  let unassigned = 0;

  for (const item of cases) {
    caseCounts[item.status] =
      (caseCounts[item.status] ?? 0) + 1;

    if (item.status !== "CLOSED") {
      activePriorities[item.priority] =
        (activePriorities[item.priority] ?? 0) + 1;

      if (!item.assignedTo) {
        unassigned += 1;
      }
    }
  }

  const trend = runsForTrend(detectionRuns);

  const latest =
    trend.length > 0 ? trend[trend.length - 1] : null;

  return (
    <section
      className="ui-insights"
      aria-label="Operational insights"
    >
      {alertStats && (
        <article className="panel ui-insight">
          <header className="ui-insight-head">
            <div className="eyebrow">Alerts</div>

            <h2>By severity</h2>

            <p>
              {alertStats.total.toLocaleString()} alerts in
              total. Select a bar to open that slice.
            </p>
          </header>

          <div className="ui-insight-body">
            <BarList
              label="Alerts by severity"
              onSelect={(key) => onOpenAlerts(key)}
              items={SEVERITIES.map(
                ([key, label, tone]) => ({
                  key,
                  label,
                  tone,
                  value: countOf(
                    alertStats.severity,
                    key
                  ),
                })
              )}
            />

            <StackedBar
              label="Alerts by status"
              segments={[
                ["OPEN", "Open", "danger"],
                ["IN_REVIEW", "In review", "warning"],
                ["CLOSED", "Closed", "ok"],
              ].map(([key, label, tone]) => ({
                key,
                label,
                tone: tone as ChartTone,
                value: countOf(alertStats.status, key),
              }))}
            />
          </div>
        </article>
      )}

      <article className="panel ui-insight">
        <header className="ui-insight-head">
          <div className="eyebrow">Cases</div>

          <h2>Investigation pipeline</h2>

          <p>
            {cases.length === 0
              ? "No cases opened yet."
              : unassigned > 0
                ? `${unassigned} active ${
                    unassigned === 1 ? "case is" : "cases are"
                  } unassigned.`
                : "Every active case has an owner."}
          </p>
        </header>

        {cases.length === 0 ? (
          <EmptyState
            compact
            title="No cases yet"
            message="Open a case from a priority alert."
          />
        ) : (
          <div className="ui-insight-body">
            <StackedBar
              label="Cases by status"
              segments={CASE_STATUSES.map(
                ([key, label, tone]) => ({
                  key,
                  label,
                  tone,
                  value: countOf(caseCounts, key),
                })
              )}
            />

            <BarList
              label="Active cases by priority"
              onSelect={() => onOpenCases()}
              items={SEVERITIES.map(
                ([key, label, tone]) => ({
                  key,
                  label,
                  tone,
                  value: countOf(activePriorities, key),
                })
              )}
            />
          </div>
        )}
      </article>

      <article className="panel ui-insight">
        <header className="ui-insight-head">
          <div className="eyebrow">Detection</div>

          <h2>New alerts per run</h2>

          <p>
            {latest
              ? `Latest run ${formatRelativeTime(
                  latest.completedAt ?? latest.startedAt
                )}.`
              : "Detection has not run yet."}
          </p>
        </header>

        {!latest ? (
          <EmptyState
            compact
            icon={<Radar size={24} aria-hidden="true" />}
            title="No detection runs yet"
            message="Run AML detection from the top bar to generate alerts."
          />
        ) : (
          <div className="ui-insight-body">
            <Sparkline
              label={`New alerts over the last ${trend.length} detection runs, from ${trend[0].alertsCreated} to ${latest.alertsCreated}`}
              values={trend.map((run) => run.alertsCreated)}
              tone="violet"
              width={280}
              height={56}
            />

            <dl className="ui-insight-stats">
              <div>
                <dt>Signals</dt>

                <dd>{latest.candidatesFound}</dd>
              </div>

              <div>
                <dt>New alerts</dt>

                <dd>{latest.alertsCreated}</dd>
              </div>

              <div>
                <dt>Already known</dt>

                <dd>{latest.alertsExisting}</dd>
              </div>

              <div>
                <dt>Rules run</dt>

                <dd>{latest.rulesExecuted}</dd>
              </div>
            </dl>
          </div>
        )}
      </article>
    </section>
  );
}
