"use client";

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
} from "@/components/list-tools";
import {
  ACCOUNT_SORTS,
  ACCOUNT_TYPES,
  ALERT_FILTER_OPTIONS,
  ALL,
  CUSTOMER_SORTS,
  TRANSACTION_CHANNELS,
  TRANSACTION_SORTS,
  TRANSACTION_STATUSES,
  amountRangeProblem,
  codeOptions,
  type AccountFilters,
  type CustomerFilters,
  type RiskFilter,
  type TransactionFilters,
} from "@/lib/gx-explorer";
import { humanize } from "@/lib/format";

/** Counts and totals the toolbars print next to the controls. */
export interface ToolbarSummary {
  /** Rows that pass every filter. */
  shown: number;
  /** Rows the backend returned for the current search. */
  total: number;
  hasFilters: boolean;
  /** True until the first rows arrive, so no count is printed yet. */
  pending: boolean;
}

interface CommonProps<F> {
  filters: F;
  onChange: (patch: Partial<F>) => void;
  onReset: () => void;
  onApplyView: (value: F) => void;
  onExport: () => void;
  summary: ToolbarSummary;
  /** Facet counts per risk tier or band, keyed by upper-case value. */
  riskCounts: Record<string, number>;
  riskTotal: number;
}

const ALERT_OPTIONS: readonly Option<
  (typeof ALERT_FILTER_OPTIONS)[number]["value"]
>[] = ALERT_FILTER_OPTIONS;

function tierOptions(
  counts: Record<string, number>,
  total: number,
  allLabel: string
): Option<RiskFilter>[] {
  return [
    { value: ALL, label: allLabel, count: total },
    {
      value: "HIGH",
      label: "High",
      tone: "danger",
      count: counts.HIGH ?? 0,
    },
    {
      value: "MEDIUM",
      label: "Medium",
      tone: "warning",
      count: counts.MEDIUM ?? 0,
    },
    {
      value: "LOW",
      label: "Low",
      tone: "ok",
      count: counts.LOW ?? 0,
    },
  ];
}

function bandOptions(
  counts: Record<string, number>,
  total: number
): Option<RiskFilter>[] {
  return [
    { value: ALL, label: "All scores", count: total },
    {
      value: "HIGH",
      label: "High 70+",
      tone: "danger",
      count: counts.HIGH ?? 0,
    },
    {
      value: "MEDIUM",
      label: "Medium 40-69",
      tone: "warning",
      count: counts.MEDIUM ?? 0,
    },
    {
      value: "LOW",
      label: "Low under 40",
      tone: "ok",
      count: counts.LOW ?? 0,
    },
  ];
}

function enumOptions(
  values: readonly string[],
  counts: Record<string, number> | null,
  current: string,
  allLabel: string
): Option<string>[] {
  const known = values.includes(current) || current === ALL;

  return [
    { value: ALL, label: allLabel },
    ...(known ? values : [...values, current]).map((value) => ({
      value,
      label: humanize(value),
      ...(counts ? { count: counts[value] ?? 0 } : {}),
    })),
  ];
}

function Footer<F>({
  storageKey,
  filters,
  onApplyView,
  summary,
  noun,
}: {
  storageKey: string;
  filters: F;
  onApplyView: (value: F) => void;
  summary: ToolbarSummary;
  noun: string;
}) {
  return (
    <>
      <SavedViews<F>
        storageKey={storageKey}
        current={filters}
        canSave={summary.hasFilters}
        onApply={onApplyView}
      />

      {!summary.pending && (
        <ResultCount
          shown={summary.shown}
          total={summary.total}
          noun={noun}
          filtered={summary.hasFilters}
        />
      )}
    </>
  );
}

export function CustomerToolbar({
  filters,
  onChange,
  onReset,
  onApplyView,
  onExport,
  summary,
  riskCounts,
  riskTotal,
  countries,
}: CommonProps<CustomerFilters> & {
  countries: readonly string[];
}) {
  return (
    <div className="ui-gx-toolbar">
      <Toolbar label="Filter customers">
        <SearchField
          label="Search customers"
          placeholder="Name, ID, country or risk tier..."
          value={filters.q}
          onChange={(q) => onChange({ q })}
        />

        <SelectField
          label="Filter by country"
          value={filters.country}
          options={codeOptions(
            countries,
            filters.country,
            "All countries"
          )}
          onChange={(country) => onChange({ country })}
        />

        <SelectField
          label="Filter by open alerts"
          value={filters.alerts}
          options={ALERT_OPTIONS}
          onChange={(alerts) => onChange({ alerts })}
        />

        <SelectField
          label="Sort customers"
          value={filters.sort}
          options={CUSTOMER_SORTS}
          onChange={(sort) => onChange({ sort })}
        />

        <ResetButton
          disabled={!summary.hasFilters}
          onClick={onReset}
        />

        <ExportButton
          disabled={summary.shown === 0}
          onExport={onExport}
        />
      </Toolbar>

      <div className="ui-chips-row">
        <ChipGroup
          label="Filter by risk tier"
          value={filters.risk}
          options={tierOptions(
            riskCounts,
            riskTotal,
            "All tiers"
          )}
          onChange={(risk) => onChange({ risk })}
        />
      </div>

      <Footer
        storageKey="fcg.views.explorer.customers"
        filters={filters}
        onApplyView={onApplyView}
        summary={summary}
        noun="customers"
      />
    </div>
  );
}

export function AccountToolbar({
  filters,
  onChange,
  onReset,
  onApplyView,
  onExport,
  summary,
  riskCounts,
  riskTotal,
  statusCounts,
  statusTotal,
  currencies,
}: CommonProps<AccountFilters> & {
  statusCounts: Record<string, number>;
  statusTotal: number;
  currencies: readonly string[];
}) {
  const statusOptions: Option<string>[] = [
    { value: ALL, label: "All statuses", count: statusTotal },
    {
      value: "ACTIVE",
      label: "Active",
      tone: "ok",
      count: statusCounts.ACTIVE ?? 0,
    },
    {
      value: "REVIEW",
      label: "In review",
      tone: "warning",
      count: statusCounts.REVIEW ?? 0,
    },
    {
      value: "FROZEN",
      label: "Frozen",
      tone: "danger",
      count: statusCounts.FROZEN ?? 0,
    },
  ];

  return (
    <div className="ui-gx-toolbar">
      <Toolbar label="Filter accounts">
        <SearchField
          label="Search accounts"
          placeholder="Account number, customer or currency..."
          value={filters.q}
          onChange={(q) => onChange({ q })}
        />

        <SelectField
          label="Filter by account type"
          value={filters.type}
          options={enumOptions(
            ACCOUNT_TYPES,
            null,
            filters.type,
            "All types"
          )}
          onChange={(type) => onChange({ type })}
        />

        <SelectField
          label="Filter by currency"
          value={filters.currency}
          options={codeOptions(
            currencies,
            filters.currency,
            "All currencies"
          )}
          onChange={(currency) => onChange({ currency })}
        />

        <SelectField
          label="Filter by customer risk"
          value={filters.risk}
          options={tierOptions(
            riskCounts,
            riskTotal,
            "Any customer risk"
          ).map((option) => ({
            ...option,
            label:
              option.value === ALL
                ? option.label
                : `${option.label} risk`,
          }))}
          onChange={(risk) => onChange({ risk })}
        />

        <SelectField
          label="Filter by open alerts"
          value={filters.alerts}
          options={ALERT_OPTIONS}
          onChange={(alerts) => onChange({ alerts })}
        />

        <SelectField
          label="Sort accounts"
          value={filters.sort}
          options={ACCOUNT_SORTS}
          onChange={(sort) => onChange({ sort })}
        />

        <ResetButton
          disabled={!summary.hasFilters}
          onClick={onReset}
        />

        <ExportButton
          disabled={summary.shown === 0}
          onExport={onExport}
        />
      </Toolbar>

      <div className="ui-chips-row">
        <ChipGroup
          label="Filter by account status"
          value={filters.status}
          options={statusOptions}
          onChange={(status) => onChange({ status })}
        />
      </div>

      <Footer
        storageKey="fcg.views.explorer.accounts"
        filters={filters}
        onApplyView={onApplyView}
        summary={summary}
        noun="accounts"
      />
    </div>
  );
}

export function TransactionToolbar({
  filters,
  onChange,
  onReset,
  onApplyView,
  onExport,
  summary,
  riskCounts,
  riskTotal,
  countries,
}: CommonProps<TransactionFilters> & {
  countries: readonly string[];
}) {
  const rangeProblem = amountRangeProblem(
    filters.min,
    filters.max
  );

  return (
    <div className="ui-gx-toolbar">
      <Toolbar label="Filter transactions">
        <SearchField
          label="Search transactions"
          placeholder="Reference, account, customer, country..."
          value={filters.q}
          onChange={(q) => onChange({ q })}
        />

        <SelectField
          label="Filter by channel"
          value={filters.channel}
          options={enumOptions(
            TRANSACTION_CHANNELS,
            null,
            filters.channel,
            "All channels"
          )}
          onChange={(channel) => onChange({ channel })}
        />

        <SelectField
          label="Filter by status"
          value={filters.status}
          options={enumOptions(
            TRANSACTION_STATUSES,
            null,
            filters.status,
            "All statuses"
          )}
          onChange={(status) => onChange({ status })}
        />

        <label className="ui-gx-amount">
          <span className="ui-visually-hidden">
            Minimum amount
          </span>

          <input
            className="ui-select"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="Min amount"
            value={filters.min}
            aria-invalid={rangeProblem !== null}
            onChange={(event) =>
              onChange({ min: event.target.value })
            }
          />
        </label>

        <label className="ui-gx-amount">
          <span className="ui-visually-hidden">
            Maximum amount
          </span>

          <input
            className="ui-select"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="Max amount"
            value={filters.max}
            aria-invalid={rangeProblem !== null}
            onChange={(event) =>
              onChange({ max: event.target.value })
            }
          />
        </label>

        <SelectField
          label="Filter by destination country"
          value={filters.country}
          options={codeOptions(
            countries,
            filters.country,
            "All countries"
          )}
          onChange={(country) => onChange({ country })}
        />

        <SelectField
          label="Sort transactions"
          value={filters.sort}
          options={TRANSACTION_SORTS}
          onChange={(sort) => onChange({ sort })}
        />

        <ResetButton
          disabled={!summary.hasFilters}
          onClick={onReset}
        />

        <ExportButton
          disabled={summary.shown === 0}
          onExport={onExport}
        />
      </Toolbar>

      <div className="ui-chips-row">
        <ChipGroup
          label="Filter by risk score"
          value={filters.risk}
          options={bandOptions(riskCounts, riskTotal)}
          onChange={(risk) => onChange({ risk })}
        />
      </div>

      {rangeProblem && (
        <p className="ui-gx-note" role="alert">
          {rangeProblem}
        </p>
      )}

      <Footer
        storageKey="fcg.views.explorer.transactions"
        filters={filters}
        onApplyView={onApplyView}
        summary={summary}
        noun="transactions"
      />
    </div>
  );
}
