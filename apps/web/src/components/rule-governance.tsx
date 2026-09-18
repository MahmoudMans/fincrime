"use client";

import {
  History,
  LockKeyhole,
  Radar,
  Save,
  Settings2,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchDetectionRuleHistory,
  fetchDetectionRules,
  updateDetectionRule,
  type DetectionRule,
  type DetectionRuleChange,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

export function RuleGovernance() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [rules, setRules] =
    useState<DetectionRule[]>([]);

  const [selectedRuleKey, setSelectedRuleKey] =
    useState<string | null>(
      null
    );

  const [history, setHistory] =
    useState<
      DetectionRuleChange[]
    >([]);

  const [pending, setPending] =
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

    void fetchDetectionRules(
      controller.signal
    )
      .then((items) => {
        setRules(items);

        if (
          items.length > 0
        ) {
          setSelectedRuleKey(
            (current) =>
              current &&
              items.some(
                (item) =>
                  item.ruleKey ===
                  current
              )
                ? current
                : items[0]
                    .ruleKey
          );
        }
      })
      .catch(
        (loadError: unknown) => {
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
              : "Unable to load AML rule configuration."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedRuleKey) {
      return;
    }

    const controller =
      new AbortController();

    void fetchDetectionRuleHistory(
      selectedRuleKey,
      controller.signal
    )
      .then(setHistory)
      .catch(
        () => undefined
      );

    return () =>
      controller.abort();
  }, [
    selectedRuleKey,
  ]);

  const selectedRule =
    useMemo(
      () =>
        rules.find(
          (rule) =>
            rule.ruleKey ===
            selectedRuleKey
        ) ?? null,
      [
        rules,
        selectedRuleKey,
      ]
    );

  async function refresh() {
    const updated =
      await fetchDetectionRules();

    setRules(updated);

    if (selectedRuleKey) {
      setHistory(
        await fetchDetectionRuleHistory(
          selectedRuleKey
        )
      );
    }
  }

  async function toggleRule(
    rule: DetectionRule
  ) {
    if (!canManage) {
      return;
    }

    try {
      setPending(
        rule.ruleKey
      );

      setError(null);

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

      await refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update detection rule."
      );
    } finally {
      setPending(null);
    }
  }

  async function saveRiskScore(
    rule: DetectionRule,
    riskScore: number
  ) {
    if (!canManage) {
      return;
    }

    try {
      setPending(
        rule.ruleKey
      );

      setError(null);

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

      await refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to save rule score."
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="panel rule-governance-panel">
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
            />
          ) : (
            <LockKeyhole
              size={14}
            />
          )}

          {canManage
            ? "Governance access"
            : "Read only"}
        </div>
      </div>

      {error && (
        <div className="rule-error">
          {error}
        </div>
      )}

      <div className="rule-governance-layout">
        <div className="rule-table-wrap">
          <div className="rule-table-header">
            <span>
              {rules.length}
              {" "}rules
            </span>

            <span>
              {
                rules.filter(
                  (rule) =>
                    rule.enabled
                ).length
              }
              {" "}enabled
            </span>
          </div>

          <div className="rule-list">
            {rules.map(
              (rule) => (
                <button
                  type="button"
                  key={
                    rule.ruleKey
                  }
                  className={
                    selectedRuleKey ===
                    rule.ruleKey
                      ? "rule-row selected"
                      : "rule-row"
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
              busy={
                pending ===
                selectedRule.ruleKey
              }
              history={
                history
              }
              onToggle={() =>
                void toggleRule(
                  selectedRule
                )
              }
              onRiskSave={(
                score
              ) =>
                void saveRiskScore(
                  selectedRule,
                  score
                )
              }
            />
          ) : (
            <div className="rule-empty">
              <Settings2
                size={27}
              />

              <strong>
                Rule catalog
              </strong>

              <span>
                Select a rule to inspect
                its governance settings.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RuleDetail({
  rule,
  canManage,
  busy,
  history,
  onToggle,
  onRiskSave,
}: {
  rule: DetectionRule;
  canManage: boolean;
  busy: boolean;
  history: DetectionRuleChange[];
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
      history={history}
      onToggle={onToggle}
      onRiskSave={onRiskSave}
    />
  );
}

function RuleDetailEditor({
  rule,
  canManage,
  busy,
  history,
  onToggle,
  onRiskSave,
}: {
  rule: DetectionRule;
  canManage: boolean;
  busy: boolean;
  history: DetectionRuleChange[];
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
        </div>

        <button
          type="button"
          className={
            rule.enabled
              ? "rule-toggle enabled"
              : "rule-toggle"
          }
          disabled={
            !canManage ||
            busy
          }
          onClick={onToggle}
        >
          {rule.enabled ? (
            <ToggleRight
              size={18}
            />
          ) : (
            <ToggleLeft
              size={18}
            />
          )}

          {rule.enabled
            ? "Enabled"
            : "Disabled"}
        </button>
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

      <div className="rule-history">
        <div className="rule-history-heading">
          <div>
            <History
              size={14}
            />

            <strong>
              Version history
            </strong>
          </div>

          <span>
            {
              history.length
            }
          </span>
        </div>

        {history.length ===
          0 && (
          <div className="rule-history-empty">
            No version history.
          </div>
        )}

        {history.map(
          (change) => (
            <article
              key={
                change.id
              }
              className="rule-history-item"
            >
              <div className="rule-version">
                v
                {
                  change.version
                }
              </div>

              <div>
                <strong>
                  {
                    change
                      .changeSummary
                  }
                </strong>

                <span>
                  {
                    change
                      .changedBy
                  }
                  {" · "}
                  {formatDateTime(
                    change.changedAt
                  )}
                </span>
              </div>
            </article>
          )
        )}
      </div>
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
