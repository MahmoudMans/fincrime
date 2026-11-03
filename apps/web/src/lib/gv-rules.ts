import type {
  DetectionRule,
  DetectionRuleChange,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { matchesQuery } from "@/lib/list-utils";

import { ALL } from "./gv-common";

export interface RuleFilters {
  q: string;
  /** ALL, ENABLED or DISABLED. */
  status: string;
  severity: string;
  /** name, risk or updated. */
  sort: string;
}

export const DEFAULT_RULE_FILTERS: RuleFilters = {
  q: "",
  status: ALL,
  severity: ALL,
  sort: "name",
};

export const SEVERITY_ORDER = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

export const RULE_STATUS_ORDER = ["ENABLED", "DISABLED"] as const;

export function ruleStatus(rule: DetectionRule) {
  return rule.enabled ? "ENABLED" : "DISABLED";
}

function time(value: string) {
  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareRules(sort: string) {
  return (a: DetectionRule, b: DetectionRule) => {
    if (sort === "risk") {
      return (
        b.riskScore - a.riskScore ||
        a.displayName.localeCompare(b.displayName)
      );
    }

    if (sort === "updated") {
      return (
        time(b.updatedAt) - time(a.updatedAt) ||
        a.displayName.localeCompare(b.displayName)
      );
    }

    return a.displayName.localeCompare(b.displayName);
  };
}

export function filterRules(
  rules: readonly DetectionRule[],
  filters: RuleFilters
): DetectionRule[] {
  return rules
    .filter(
      (rule) =>
        (filters.status === ALL ||
          ruleStatus(rule) === filters.status) &&
        (filters.severity === ALL ||
          rule.severity === filters.severity) &&
        matchesQuery(filters.q, [
          rule.displayName,
          rule.ruleKey,
          rule.description,
          rule.severity,
          rule.updatedBy,
        ])
    )
    .sort(compareRules(filters.sort));
}

export const RULE_COLUMNS: readonly CsvColumn<DetectionRule>[] = [
  { header: "Rule key", value: (rule) => rule.ruleKey },
  { header: "Name", value: (rule) => rule.displayName },
  { header: "Description", value: (rule) => rule.description },
  { header: "Enabled", value: (rule) => (rule.enabled ? "Yes" : "No") },
  { header: "Severity", value: (rule) => rule.severity },
  { header: "Risk score", value: (rule) => rule.riskScore },
  {
    header: "Primary threshold",
    value: (rule) => rule.primaryAmountThreshold,
  },
  {
    header: "Upper threshold",
    value: (rule) => rule.secondaryAmountThreshold,
  },
  {
    header: "Aggregate threshold",
    value: (rule) => rule.aggregateAmountThreshold,
  },
  {
    header: "Minimum occurrences",
    value: (rule) => rule.minimumOccurrences,
  },
  { header: "Window (minutes)", value: (rule) => rule.windowMinutes },
  { header: "Version", value: (rule) => rule.version },
  { header: "Updated by", value: (rule) => rule.updatedBy },
  { header: "Updated at (UTC)", value: (rule) => rule.updatedAt },
];

export const HISTORY_COLUMNS: readonly CsvColumn<DetectionRuleChange>[] = [
  { header: "Rule key", value: (change) => change.ruleKey },
  { header: "Version", value: (change) => change.version },
  { header: "Changed at (UTC)", value: (change) => change.changedAt },
  { header: "Changed by", value: (change) => change.changedBy },
  { header: "Change summary", value: (change) => change.changeSummary },
  {
    header: "Enabled",
    value: (change) => (change.enabled ? "Yes" : "No"),
  },
  { header: "Severity", value: (change) => change.severity },
  { header: "Risk score", value: (change) => change.riskScore },
  {
    header: "Primary threshold",
    value: (change) => change.primaryAmountThreshold,
  },
  {
    header: "Upper threshold",
    value: (change) => change.secondaryAmountThreshold,
  },
  {
    header: "Aggregate threshold",
    value: (change) => change.aggregateAmountThreshold,
  },
  {
    header: "Minimum occurrences",
    value: (change) => change.minimumOccurrences,
  },
  {
    header: "Window (minutes)",
    value: (change) => change.windowMinutes,
  },
];
