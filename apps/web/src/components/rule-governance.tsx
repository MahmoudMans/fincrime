"use client";

import {
  LockKeyhole,
  Radar,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  fetchDetectionRuleHistory,
  fetchDetectionRules,
  updateDetectionRule,
  type DetectionRule,
  type DetectionRuleChange,
} from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  ALL,
  countOptions,
  useActionRunner,
  useFilterState,
} from "@/lib/gv-common";
import {
  DEFAULT_RULE_FILTERS,
  RULE_COLUMNS,
  RULE_STATUS_ORDER,
  SEVERITY_ORDER,
  filterRules,
  ruleStatus,
  type RuleFilters,
} from "@/lib/gv-rules";
import { plural } from "@/lib/list-utils";
import { formatDateTime } from "@/lib/format";
import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";
import {
  Banner,
  LoadNotice,
} from "./gv-parts";
import { RuleHistory } from "./gv-rule-history";
import { ConfirmButton } from "./confirm-button";
import {
  ChipGroup,
  ExportButton,
  ResetButton,
  ResultCount,
  SavedViews,
  SearchField,
  SelectField,
  Toolbar,
  type Option,
} from "./list-tools";
import { EmptyState } from "./state-card";

interface HistoryResult {
  ruleKey: string | null;
  items: DetectionRuleChange[];
}

const SORT_OPTIONS: readonly Option<string>[] = [
  { value: "name", label: "Sort by name" },
  { value: "risk", label: "Sort by risk score" },
  { value: "updated", label: "Sort by last update" },
];

const SEVERITY_TONES = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "ok",
} as const;

export function RuleGovernance() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const fetchRules =
    useCallback(
      (signal: AbortSignal) =>
        fetchDetectionRules(
          signal
        ),
      []
    );

  const {
    data: rules,
    error,
    loading,
    reload: reloadRules,
  } = useLoad(
    fetchRules,
    "Unable to load AML rule configuration."
  );

  const {
    filters,
    current,
    hasFilters,
    update,
    reset,
    apply,
  } = useFilterState<RuleFilters>(
    DEFAULT_RULE_FILTERS
  );

  const [selectedRuleKey, setSelectedRuleKey] =
    useState<string | null>(
      null
    );

  const runner =
    useActionRunner();

  const filtered =
    useMemo(
      () =>
        filterRules(
          rules ?? [],
          filters
        ),
      [
        rules,
        filters,
      ]
    );

  // The selection follows the list: a rule hidden by the filters
  // gives way to the first rule that is still shown.
  const selectedRule =
    filtered.find(
      (rule) =>
        rule.ruleKey ===
        selectedRuleKey
    ) ??
    filtered[0] ??
    null;

  const activeRuleKey =
    selectedRule?.ruleKey ??
    null;

  const fetchHistory =
    useCallback(
      async (
        signal: AbortSignal
      ): Promise<HistoryResult> => {
        if (
          activeRuleKey === null
        ) {
          return {
            ruleKey: null,
            items: [],
          };
        }

        return {
          ruleKey:
            activeRuleKey,
          items:
            await fetchDetectionRuleHistory(
              activeRuleKey,
              signal
            ),
        };
      },
      [
        activeRuleKey,
      ]
    );

  const {
    data: historyResult,
    error: historyError,
    reload: reloadHistory,
  } = useLoad(
    fetchHistory,
    "Unable to load version history."
  );

  // Data that belongs to the previously selected rule is not shown.
  const history =
    historyResult !== null &&
    historyResult.ruleKey ===
      activeRuleKey
      ? historyResult.items
      : null;

  const statusOptions =
    useMemo(
      () =>
        countOptions(
          filterRules(
            rules ?? [],
            {
              ...filters,
              status: ALL,
            }
          ).map(ruleStatus),
          "All",
          {
            order: RULE_STATUS_ORDER,
            always: RULE_STATUS_ORDER,
            keep: filters.status,
            tones: {
              ENABLED: "ok",
            },
          }
        ),
      [
        rules,
        filters,
      ]
    );

  const severityOptions =
    useMemo(
      () =>
        countOptions(
          filterRules(
            rules ?? [],
            {
              ...filters,
              severity: ALL,
            }
          ).map(
            (rule) =>
              rule.severity
          ),
          "All severities",
          {
            order: SEVERITY_ORDER,
            always: SEVERITY_ORDER,
            keep: filters.severity,
            tones: SEVERITY_TONES,
          }
        ),
      [
        rules,
        filters,
      ]
    );

  // Nothing may change while a change is being saved or the list is
  // being refreshed: the next save would be built from stale values.
  const busy =
    runner.pending !== null ||
    loading;

  function toggleRule(
    rule: DetectionRule
  ) {
    if (!canManage) {
      return;
    }

    void runner.run(
      `toggle:${rule.ruleKey}`,
      async () => {
        await updateDetectionRule(
          rule.ruleKey,
          {
            enabled:
              !rule.enabled,
            severity:
              rule.severity,
            riskScore:
              rule.riskScore,
            primaryAmountThreshold:
              rule.primaryAmountThreshold,
            secondaryAmountThreshold:
              rule.secondaryAmountThreshold,
            aggregateAmountThreshold:
              rule.aggregateAmountThreshold,
            minimumOccurrences:
              rule.minimumOccurrences,
            windowMinutes:
              rule.windowMinutes,
            changeSummary:
              rule.enabled
                ? "Rule disabled from governance console."
                : "Rule enabled from governance console.",
          }
        );

        reloadRules();
        reloadHistory();

        return `${rule.displayName} is now ${
          rule.enabled
            ? "disabled"
            : "enabled"
        }.`;
      },
      "Unable to update detection rule."
    );
  }

  function saveRiskScore(
    rule: DetectionRule,
    riskScore: number
  ) {
    if (!canManage) {
      return;
    }

    void runner.run(
      `score:${rule.ruleKey}`,
      async () => {
        await updateDetectionRule(
          rule.ruleKey,
          {
            enabled:
              rule.enabled,
            severity:
              rule.severity,
            riskScore,
            primaryAmountThreshold:
              rule.primaryAmountThreshold,
            secondaryAmountThreshold:
              rule.secondaryAmountThreshold,
            aggregateAmountThreshold:
              rule.aggregateAmountThreshold,
            minimumOccurrences:
              rule.minimumOccurrences,
            windowMinutes:
              rule.windowMinutes,
            changeSummary:
              `Risk score changed to ${riskScore}.`,
          }
        );

        reloadRules();
        reloadHistory();

        return `Risk score of ${rule.displayName} saved as ${riskScore}.`;
      },
      "Unable to save rule score."
    );
  }

  return (
    <section
      className="panel rule-governance-panel"
      aria-busy={loading}
    >
      <div className="panel-heading rule-governance-heading">
        <div>
          <div className="eyebrow">
            Detection governance
          </div>

          <h2>
            AML rule configuration
          </h2>

          <p>
            Govern rule activation,
            scoring and monitoring
            thresholds with versioned
            change history.
          </p>
        </div>

        <div
          className={
            canManage
              ? "rule-permission-badge editable"
              : "rule-permission-badge"
          }
        >
          {canManage ? (
            <ShieldCheck
              size={14}
              aria-hidden="true"
            />
          ) : (
            <LockKeyhole
              size={14}
              aria-hidden="true"
            />
          )}

          {canManage
            ? "Governance access"
            : "Read only"}
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
        data={rules}
        error={error}
        onRetry={reloadRules}
        label="Loading AML rules"
        errorTitle="Unable to load AML rules"
      />

      {rules !== null &&
        rules.length === 0 && (
          <EmptyState
            icon={
              <Settings2
                size={24}
                aria-hidden="true"
              />
            }
            title="No detection rules configured"
            message="Rules appear here once the backend has seeded its AML rule catalog."
          />
        )}

      {rules !== null &&
        rules.length > 0 && (
        <>
          <Toolbar label="Filter rules">
            <SearchField
              label="Search rules"
              placeholder="Search name, key or description..."
              value={filters.q}
              onChange={(q) =>
                update({
                  q,
                })
              }
            />

            <SelectField
              label="Sort rules"
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) =>
                update({
                  sort,
                })
              }
            />

            <ResetButton
              disabled={!hasFilters}
              onClick={reset}
            />

            <ExportButton
              label="Export rules"
              disabled={
                filtered.length === 0
              }
              onExport={() =>
                exportRowsAsCsv(
                  "detection-rules",
                  filtered,
                  RULE_COLUMNS
                )
              }
            />

            <button
              type="button"
              className="ui-icon-text-button"
              disabled={loading}
              onClick={reloadRules}
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
          </Toolbar>

          <div className="ui-chips-row">
            <ChipGroup
              label="Filter by status"
              value={filters.status}
              options={statusOptions}
              onChange={(status) =>
                update({
                  status,
                })
              }
            />
          </div>

          <div className="ui-chips-row">
            <ChipGroup
              label="Filter by severity"
              value={filters.severity}
              options={severityOptions}
              onChange={(severity) =>
                update({
                  severity,
                })
              }
            />
          </div>

          <SavedViews<RuleFilters>
            storageKey="fcg.views.rules"
            current={current}
            canSave={hasFilters}
            onApply={apply}
          />

          <ResultCount
            shown={filtered.length}
            total={rules.length}
            noun={plural(
              rules.length,
              "rule"
            )}
            filtered={hasFilters}
          />

          <div className="rule-governance-layout">
            <div className="rule-table-wrap">
              <div className="rule-table-header">
                <span>
                  {
                    filtered.filter(
                      (rule) =>
                        rule.enabled
                    ).length
                  }
                  {" "}enabled
                </span>

                <span>
                  {
                    filtered.filter(
                      (rule) =>
                        !rule.enabled
                    ).length
                  }
                  {" "}disabled
                </span>
              </div>

              {filtered.length === 0 && (
                <EmptyState
                  compact
                  title="No rules match these filters"
                  message="Try a different search or clear the filters."
                  action={
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={reset}
                    >
                      Clear filters
                    </button>
                  }
                />
              )}

              <div className="rule-list">
                {filtered.map(
                  (rule) => (
                    <button
                      type="button"
                      key={
                        rule.ruleKey
                      }
                      className={
                        activeRuleKey ===
                        rule.ruleKey
                          ? "rule-row selected"
                          : "rule-row"
                      }
                      aria-pressed={
                        activeRuleKey ===
                        rule.ruleKey
                      }
                      onClick={() =>
                        setSelectedRuleKey(
                          rule.ruleKey
                        )
                      }
                    >
                      <div className="rule-row-icon">
                        <Radar
                          size={15}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="rule-row-copy">
                        <strong>
                          {
                            rule.displayName
                          }
                        </strong>

                        <span>
                          {
                            rule.ruleKey
                          }
                          {" · v"}
                          {
                            rule.version
                          }
                        </span>
                      </div>

                      <div className="rule-row-state">
                        <span
                          className={
                            rule.enabled
                              ? "rule-state enabled"
                              : "rule-state disabled"
                          }
                        >
                          {rule.enabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>

                        <strong>
                          {
                            rule.riskScore
                          }
                        </strong>
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="rule-detail">
              {selectedRule ? (
                <RuleDetail
                  rule={selectedRule}
                  canManage={
                    canManage
                  }
                  busy={busy}
                  onToggle={() =>
                    toggleRule(
                      selectedRule
                    )
                  }
                  onRiskSave={(
                    score
                  ) =>
                    saveRiskScore(
                      selectedRule,
                      score
                    )
                  }
                  historySlot={
                    <RuleHistory
                      ruleKey={
                        selectedRule.ruleKey
                      }
                      history={
                        history
                      }
                      error={
                        historyError
                      }
                      onRetry={
                        reloadHistory
                      }
                    />
                  }
                />
              ) : (
                <div className="rule-empty">
                  <Settings2
                    size={27}
                    aria-hidden="true"
                  />

                  <strong>
                    Rule catalog
                  </strong>

                  <span>
                    No rule to show.
                    Clear the filters to
                    inspect a rule.
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function RuleDetail({
  rule,
  canManage,
  busy,
  historySlot,
  onToggle,
  onRiskSave,
}: {
  rule: DetectionRule;
  canManage: boolean;
  busy: boolean;
  historySlot: ReactNode;
  onToggle: () => void;
  onRiskSave:
    (score: number) => void;
}) {
  return (
    <RuleDetailEditor
      key={`${rule.ruleKey}:${rule.version}`}
      rule={rule}
      canManage={canManage}
      busy={busy}
      historySlot={historySlot}
      onToggle={onToggle}
      onRiskSave={onRiskSave}
    />
  );
}

function RuleDetailEditor({
  rule,
  canManage,
  busy,
  historySlot,
  onToggle,
  onRiskSave,
}: {
  rule: DetectionRule;
  canManage: boolean;
  busy: boolean;
  historySlot: ReactNode;
  onToggle: () => void;
  onRiskSave:
    (score: number) => void;
}) {
  const [draftRiskScore, setDraftRiskScore] =
    useState(
      rule.riskScore
    );

  return (
    <div>
      <div className="rule-detail-head">
        <div>
          <div className="eyebrow">
            {rule.ruleKey}
          </div>

          <h3>
            {rule.displayName}
          </h3>

          <p>
            {rule.description}
          </p>

          <p className="ui-gv-meta">
            Last updated by
            {" "}
            {rule.updatedBy}
            {" · "}
            {formatDateTime(
              rule.updatedAt
            )}
          </p>
        </div>

        <ConfirmButton
          className={
            rule.enabled
              ? "rule-toggle enabled"
              : "rule-toggle"
          }
          confirmLabel={
            rule.enabled
              ? "Yes, disable rule"
              : "Yes, enable rule"
          }
          disabled={
            !canManage ||
            busy
          }
          onConfirm={onToggle}
        >
          {rule.enabled ? (
            <ToggleRight
              size={18}
              aria-hidden="true"
            />
          ) : (
            <ToggleLeft
              size={18}
              aria-hidden="true"
            />
          )}

          {rule.enabled
            ? "Enabled"
            : "Disabled"}
        </ConfirmButton>
      </div>

      <div className="rule-metrics">
        <RuleMetric
          label="Severity"
          value={
            rule.severity
          }
        />

        <RuleMetric
          label="Version"
          value={
            `v${rule.version}`
          }
        />

        <RuleMetric
          label="Occurrences"
          value={
            rule.minimumOccurrences ??
            "—"
          }
        />

        <RuleMetric
          label="Window"
          value={
            rule.windowMinutes
              ? `${rule.windowMinutes}m`
              : "—"
          }
        />
      </div>

      <div className="rule-threshold-grid">
        <Threshold
          label="Primary threshold"
          value={
            rule.primaryAmountThreshold
          }
        />

        <Threshold
          label="Upper threshold"
          value={
            rule.secondaryAmountThreshold
          }
        />

        <Threshold
          label="Aggregate threshold"
          value={
            rule.aggregateAmountThreshold
          }
        />
      </div>

      <div className="rule-score-editor">
        <div>
          <span>
            Detection risk score
          </span>

          <strong>
            {draftRiskScore}
          </strong>
        </div>

        <input
          aria-label="Detection risk score"
          type="range"
          min="0"
          max="100"
          value={
            draftRiskScore
          }
          disabled={
            !canManage ||
            busy
          }
          onChange={(event) =>
            setDraftRiskScore(
              Number(
                event.target.value
              )
            )
          }
        />

        <button
          type="button"
          className="mini-button"
          disabled={
            !canManage ||
            busy ||
            draftRiskScore ===
              rule.riskScore
          }
          onClick={() =>
            onRiskSave(
              draftRiskScore
            )
          }
        >
          <Save size={12} />
          Save score
        </button>
      </div>

      {historySlot}
    </div>
  );
}

function RuleMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rule-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Threshold({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rule-threshold">
      <span>{label}</span>

      <strong>
        {value === null
          ? "Not used"
          : new Intl.NumberFormat(
              "en-GB",
              {
                maximumFractionDigits:
                  0,
              }
            ).format(value)}
      </strong>
    </div>
  );
}
