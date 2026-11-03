import type {
  AccountSummary,
  CustomerSummary,
  TransactionExplorerItem,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { humanize } from "@/lib/format";

/**
 * Filter, sort and export rules of the entity and transaction
 * explorer. Plain functions so that they can be tested without React.
 * The text search (and the transaction channel, status and amount
 * range) is answered by the backend; everything else runs here on the
 * rows that were loaded.
 */

export const ALL = "ALL";

export const RISK_FILTERS = [
  ALL,
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

export type RiskFilter = (typeof RISK_FILTERS)[number];

export const ALERT_FILTERS = [
  "ANY",
  "WITH",
  "NONE",
] as const;

export type AlertFilter = (typeof ALERT_FILTERS)[number];

export const ALERT_FILTER_OPTIONS = [
  { value: "ANY", label: "Any alert count" },
  { value: "WITH", label: "With open alerts" },
  { value: "NONE", label: "No open alerts" },
] as const;

/** Same bands the table colours use: 70 and up high, 40 and up medium. */
export function riskBand(
  score: number
): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 70) {
    return "HIGH";
  }

  return score >= 40 ? "MEDIUM" : "LOW";
}

function tierRank(tier: string) {
  switch (tier.toUpperCase()) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.find((entry) => entry === value) ?? fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/** True when any filter differs from its default. */
export function filtersChanged<T extends object>(
  current: T,
  defaults: T
): boolean {
  return (Object.keys(defaults) as (keyof T)[]).some(
    (key) => current[key] !== defaults[key]
  );
}

/** "ALL" first, then the distinct codes; the current choice stays listed. */
export function codeOptions(
  codes: readonly string[],
  current: string,
  allLabel: string
): { value: string; label: string }[] {
  const distinct = Array.from(
    new Set(
      codes.filter((code) => code !== "").concat(
        current === ALL || current === "" ? [] : [current]
      )
    )
  ).sort();

  return [
    { value: ALL, label: allLabel },
    ...distinct.map((code) => ({ value: code, label: code })),
  ];
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "en", {
    sensitivity: "base",
  });
}

function timeOf(value: string) {
  const time = Date.parse(value);

  return Number.isNaN(time) ? 0 : time;
}

/* ---------- customers ---------- */

export const CUSTOMER_SORTS = [
  { value: "alerts", label: "Most open alerts" },
  { value: "name", label: "Name A to Z" },
  { value: "risk", label: "Highest risk tier" },
  { value: "activity", label: "Most transactions" },
  { value: "volume", label: "Highest volume" },
  { value: "newest", label: "Newest customers" },
] as const;

export type CustomerSort =
  (typeof CUSTOMER_SORTS)[number]["value"];

export interface CustomerFilters {
  q: string;
  risk: RiskFilter;
  country: string;
  alerts: AlertFilter;
  sort: CustomerSort;
}

export const CUSTOMER_DEFAULTS: CustomerFilters = {
  q: "",
  risk: ALL,
  country: ALL,
  alerts: "ANY",
  sort: "alerts",
};

export function normalizeCustomerFilters(
  value: unknown
): CustomerFilters {
  const raw = asRecord(value);

  return {
    q: text(raw.q),
    risk: pick(raw.risk, RISK_FILTERS, ALL),
    country: text(raw.country, ALL) || ALL,
    alerts: pick(raw.alerts, ALERT_FILTERS, "ANY"),
    sort: pick(
      raw.sort,
      CUSTOMER_SORTS.map((entry) => entry.value),
      "alerts"
    ),
  };
}

export function filterCustomers(
  items: readonly CustomerSummary[],
  filters: CustomerFilters
): CustomerSummary[] {
  return items.filter(
    (customer) =>
      (filters.risk === ALL ||
        customer.riskTier.toUpperCase() === filters.risk) &&
      (filters.country === ALL ||
        customer.countryCode === filters.country) &&
      matchesAlerts(customer.openAlerts, filters.alerts)
  );
}

function matchesAlerts(count: number, filter: AlertFilter) {
  if (filter === "WITH") {
    return count > 0;
  }

  return filter === "NONE" ? count === 0 : true;
}

export function sortCustomers(
  items: readonly CustomerSummary[],
  sort: CustomerSort
): CustomerSummary[] {
  const byName = (
    left: CustomerSummary,
    right: CustomerSummary
  ) => compareText(left.fullName, right.fullName);

  return [...items].sort((left, right) => {
    switch (sort) {
      case "name":
        return byName(left, right);
      case "risk":
        return (
          tierRank(right.riskTier) -
            tierRank(left.riskTier) ||
          right.openAlerts - left.openAlerts ||
          byName(left, right)
        );
      case "activity":
        return (
          right.transactionCount - left.transactionCount ||
          byName(left, right)
        );
      case "volume":
        return (
          right.totalInbound +
            right.totalOutbound -
            (left.totalInbound + left.totalOutbound) ||
          byName(left, right)
        );
      case "newest":
        return (
          timeOf(right.createdAt) - timeOf(left.createdAt) ||
          byName(left, right)
        );
      default:
        return (
          right.openAlerts - left.openAlerts ||
          byName(left, right)
        );
    }
  });
}

export const CUSTOMER_COLUMNS: readonly CsvColumn<CustomerSummary>[] =
  [
    { header: "Customer ID", value: (row) => row.externalId },
    { header: "Name", value: (row) => row.fullName },
    { header: "Country", value: (row) => row.countryCode },
    { header: "Risk tier", value: (row) => row.riskTier },
    { header: "Accounts", value: (row) => row.accountCount },
    {
      header: "Transactions",
      value: (row) => row.transactionCount,
    },
    { header: "Open alerts", value: (row) => row.openAlerts },
    {
      header: "Total inbound (EUR)",
      value: (row) => row.totalInbound,
    },
    {
      header: "Total outbound (EUR)",
      value: (row) => row.totalOutbound,
    },
    { header: "Onboarded", value: (row) => row.createdAt },
    { header: "Record ID", value: (row) => row.id },
  ];

/* ---------- accounts ---------- */

export const ACCOUNT_SORTS = [
  { value: "alerts", label: "Most open alerts" },
  { value: "number", label: "Account number" },
  { value: "owner", label: "Customer name" },
  { value: "balance", label: "Highest balance" },
  { value: "activity", label: "Most transactions" },
  { value: "newest", label: "Newest accounts" },
] as const;

export type AccountSort =
  (typeof ACCOUNT_SORTS)[number]["value"];

export interface AccountFilters {
  q: string;
  status: string;
  type: string;
  currency: string;
  risk: RiskFilter;
  alerts: AlertFilter;
  sort: AccountSort;
}

export const ACCOUNT_DEFAULTS: AccountFilters = {
  q: "",
  status: ALL,
  type: ALL,
  currency: ALL,
  risk: ALL,
  alerts: "ANY",
  sort: "alerts",
};

export const ACCOUNT_STATUSES = [
  "ACTIVE",
  "REVIEW",
  "FROZEN",
] as const;

export const ACCOUNT_TYPES = [
  "CHECKING",
  "SAVINGS",
  "BUSINESS",
] as const;

export function normalizeAccountFilters(
  value: unknown
): AccountFilters {
  const raw = asRecord(value);

  return {
    q: text(raw.q),
    status: text(raw.status, ALL) || ALL,
    type: text(raw.type, ALL) || ALL,
    currency: text(raw.currency, ALL) || ALL,
    risk: pick(raw.risk, RISK_FILTERS, ALL),
    alerts: pick(raw.alerts, ALERT_FILTERS, "ANY"),
    sort: pick(
      raw.sort,
      ACCOUNT_SORTS.map((entry) => entry.value),
      "alerts"
    ),
  };
}

export function filterAccounts(
  items: readonly AccountSummary[],
  filters: AccountFilters
): AccountSummary[] {
  return items.filter(
    (account) =>
      (filters.status === ALL ||
        account.status.toUpperCase() === filters.status) &&
      (filters.type === ALL ||
        account.accountType.toUpperCase() === filters.type) &&
      (filters.currency === ALL ||
        account.currency === filters.currency) &&
      (filters.risk === ALL ||
        account.customerRiskTier.toUpperCase() ===
          filters.risk) &&
      matchesAlerts(account.openAlerts, filters.alerts)
  );
}

export function sortAccounts(
  items: readonly AccountSummary[],
  sort: AccountSort
): AccountSummary[] {
  const byNumber = (
    left: AccountSummary,
    right: AccountSummary
  ) => compareText(left.accountNumber, right.accountNumber);

  return [...items].sort((left, right) => {
    switch (sort) {
      case "number":
        return byNumber(left, right);
      case "owner":
        return (
          compareText(left.customerName, right.customerName) ||
          byNumber(left, right)
        );
      case "balance":
        return (
          right.balance - left.balance || byNumber(left, right)
        );
      case "activity":
        return (
          right.transactionCount - left.transactionCount ||
          byNumber(left, right)
        );
      case "newest":
        return (
          timeOf(right.createdAt) - timeOf(left.createdAt) ||
          byNumber(left, right)
        );
      default:
        return (
          right.openAlerts - left.openAlerts ||
          compareText(left.customerName, right.customerName) ||
          byNumber(left, right)
        );
    }
  });
}

export const ACCOUNT_COLUMNS: readonly CsvColumn<AccountSummary>[] =
  [
    {
      header: "Account number",
      value: (row) => row.accountNumber,
    },
    { header: "Type", value: (row) => row.accountType },
    { header: "Currency", value: (row) => row.currency },
    { header: "Balance", value: (row) => row.balance },
    { header: "Status", value: (row) => row.status },
    { header: "Customer", value: (row) => row.customerName },
    {
      header: "Customer risk tier",
      value: (row) => row.customerRiskTier,
    },
    {
      header: "Transactions",
      value: (row) => row.transactionCount,
    },
    { header: "Open alerts", value: (row) => row.openAlerts },
    {
      header: "Total inbound",
      value: (row) => row.totalInbound,
    },
    {
      header: "Total outbound",
      value: (row) => row.totalOutbound,
    },
    { header: "Opened", value: (row) => row.createdAt },
    { header: "Record ID", value: (row) => row.id },
    {
      header: "Customer record ID",
      value: (row) => row.customerId,
    },
  ];

/* ---------- transactions ---------- */

export const TRANSACTION_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount-high", label: "Largest amount" },
  { value: "amount-low", label: "Smallest amount" },
  { value: "risk", label: "Highest risk" },
] as const;

export type TransactionSort =
  (typeof TRANSACTION_SORTS)[number]["value"];

export const TRANSACTION_CHANNELS = [
  "WIRE",
  "BANK_TRANSFER",
  "CARD",
  "CASH_DEPOSIT",
] as const;

export const TRANSACTION_STATUSES = [
  "SETTLED",
  "REVIEW",
  "PENDING",
] as const;

export interface TransactionFilters {
  /** Sent to the backend. */
  q: string;
  /** Sent to the backend. */
  channel: string;
  /** Sent to the backend. */
  status: string;
  /** Sent to the backend. */
  min: string;
  /** Sent to the backend. */
  max: string;
  risk: RiskFilter;
  country: string;
  sort: TransactionSort;
}

export const TRANSACTION_DEFAULTS: TransactionFilters = {
  q: "",
  channel: ALL,
  status: ALL,
  min: "",
  max: "",
  risk: ALL,
  country: ALL,
  sort: "newest",
};

export function normalizeTransactionFilters(
  value: unknown
): TransactionFilters {
  const raw = asRecord(value);

  return {
    q: text(raw.q),
    channel: text(raw.channel, ALL) || ALL,
    status: text(raw.status, ALL) || ALL,
    min: text(raw.min),
    max: text(raw.max),
    risk: pick(raw.risk, RISK_FILTERS, ALL),
    country: text(raw.country, ALL) || ALL,
    sort: pick(
      raw.sort,
      TRANSACTION_SORTS.map((entry) => entry.value),
      "newest"
    ),
  };
}

/** The part of the filters the backend answers. */
export interface TransactionServerQuery {
  query: string;
  channel: string;
  status: string;
  minAmount: string;
  maxAmount: string;
}

export function transactionServerQuery(
  filters: Pick<
    TransactionFilters,
    "q" | "channel" | "status" | "min" | "max"
  >
): TransactionServerQuery {
  return {
    query: filters.q.trim(),
    channel: filters.channel === ALL ? "" : filters.channel,
    status: filters.status === ALL ? "" : filters.status,
    minAmount: filters.min.trim(),
    maxAmount: filters.max.trim(),
  };
}

/** A message when the amount range can never match, else null. */
export function amountRangeProblem(
  min: string,
  max: string
): string | null {
  const low = min.trim() === "" ? NaN : Number(min);
  const high = max.trim() === "" ? NaN : Number(max);

  if (!Number.isNaN(low) && !Number.isNaN(high) && low > high) {
    return "The minimum amount is higher than the maximum, so nothing can match.";
  }

  return null;
}

export function filterTransactions(
  items: readonly TransactionExplorerItem[],
  filters: Pick<TransactionFilters, "risk" | "country">
): TransactionExplorerItem[] {
  return items.filter(
    (transaction) =>
      (filters.risk === ALL ||
        riskBand(transaction.riskScore) === filters.risk) &&
      (filters.country === ALL ||
        transaction.destinationCountry === filters.country)
  );
}

export function sortTransactions(
  items: readonly TransactionExplorerItem[],
  sort: TransactionSort
): TransactionExplorerItem[] {
  return [...items].sort((left, right) => {
    switch (sort) {
      case "oldest":
        return (
          timeOf(left.occurredAt) - timeOf(right.occurredAt)
        );
      case "amount-high":
        return right.amount - left.amount;
      case "amount-low":
        return left.amount - right.amount;
      case "risk":
        return (
          right.riskScore - left.riskScore ||
          timeOf(right.occurredAt) - timeOf(left.occurredAt)
        );
      default:
        return (
          timeOf(right.occurredAt) - timeOf(left.occurredAt)
        );
    }
  });
}

export const TRANSACTION_COLUMNS: readonly CsvColumn<TransactionExplorerItem>[] =
  [
    { header: "Reference", value: (row) => row.reference },
    { header: "Occurred at", value: (row) => row.occurredAt },
    {
      header: "Source customer",
      value: (row) => row.sourceCustomer,
    },
    {
      header: "Source account",
      value: (row) => row.sourceAccount,
    },
    {
      header: "Destination customer",
      value: (row) => row.destinationCustomer,
    },
    {
      header: "Destination account",
      value: (row) => row.destinationAccount,
    },
    {
      header: "Destination country",
      value: (row) => row.destinationCountry,
    },
    { header: "Amount", value: (row) => row.amount },
    { header: "Currency", value: (row) => row.currency },
    {
      header: "Channel",
      value: (row) => humanize(row.channel),
    },
    { header: "Status", value: (row) => row.status },
    { header: "Risk score", value: (row) => row.riskScore },
    {
      header: "Risk band",
      value: (row) => riskBand(row.riskScore),
    },
    {
      header: "Risk reasons",
      value: (row) => row.riskReasons.join("; "),
    },
    { header: "Record ID", value: (row) => row.id },
  ];

/**
 * Direction of a transaction as seen from one entity, given the ids
 * of the accounts that entity owns.
 */
export function transactionDirection(
  transaction: Pick<
    TransactionExplorerItem,
    "sourceAccountId" | "destinationAccountId"
  >,
  ownAccountIds: ReadonlySet<string>
): "OUT" | "IN" | "INTERNAL" | "UNKNOWN" {
  const fromOwn = ownAccountIds.has(transaction.sourceAccountId);
  const toOwn = ownAccountIds.has(
    transaction.destinationAccountId
  );

  if (fromOwn && toOwn) {
    return "INTERNAL";
  }

  if (fromOwn) {
    return "OUT";
  }

  return toOwn ? "IN" : "UNKNOWN";
}
