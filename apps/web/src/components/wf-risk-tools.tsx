"use client";

import { RefreshCw } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { CustomerRiskAssessment } from "@/lib/api";
import { plural } from "@/lib/list-utils";
import {
  allOptions,
  distinct,
} from "@/lib/wf-common";
import {
  DEFAULT_RISK_FILTERS,
  RISK_SORTS,
  isDefaultRiskFilters,
  normalizeRiskFilters,
  riskFacetCounts,
  type RiskFilters,
} from "@/lib/wf-risk";

import {
  ExportButton,
  ResetButton,
  ResultCount,
  SavedViews,
  SearchField,
  SelectField,
  Toolbar,
} from "./list-tools";

/**
 * Search, country / profile tier filters, sort, saved views, export
 * and result count. The risk band filter is the summary tiles.
 */
export function RiskTools({
  assessments,
  filters,
  shown,
  loading,
  note,
  onChange,
  onApply,
  onReload,
  onExport,
}: {
  assessments: readonly CustomerRiskAssessment[];
  filters: RiskFilters;
  /** Rows matching the filters. */
  shown: number;
  loading: boolean;
  note?: ReactNode;
  onChange: (patch: Partial<RiskFilters>) => void;
  /** Replaces every filter at once (Reset, saved views). */
  onApply: (filters: RiskFilters) => void;
  onReload: () => void;
  onExport: () => void;
}) {
  const countryCounts = useMemo(
    () => riskFacetCounts(assessments, filters, "country"),
    [assessments, filters]
  );

  const tierCounts = useMemo(
    () => riskFacetCounts(assessments, filters, "tier"),
    [assessments, filters]
  );

  const countryOptions = useMemo(
    () =>
      allOptions(
        "All countries",
        distinct(
          assessments.map((item) => item.countryCode)
        ).sort(),
        countryCounts,
        (value) => value
      ),
    [assessments, countryCounts]
  );

  const tierOptions = useMemo(
    () =>
      allOptions(
        "All profile tiers",
        distinct(
          assessments.map((item) => item.customerRiskTier)
        ).sort(),
        tierCounts,
        (value) => value
      ),
    [assessments, tierCounts]
  );

  const isFiltered = !isDefaultRiskFilters(filters);

  return (
    <>
      <Toolbar label="Filter customer risk assessments">
        <SearchField
          label="Search customers"
          placeholder="Search name, country or tier..."
          value={filters.q}
          onChange={(q) => onChange({ q })}
        />

        <SelectField
          label="Filter by country"
          value={filters.country}
          options={countryOptions}
          onChange={(country) => onChange({ country })}
        />

        <SelectField
          label="Filter by profile tier"
          value={filters.tier}
          options={tierOptions}
          onChange={(tier) => onChange({ tier })}
        />

        <SelectField
          label="Sort customers"
          value={filters.sort}
          options={RISK_SORTS}
          onChange={(sort) => onChange({ sort })}
        />

        <span className="ui-tools-spacer" />

        <ResetButton
          disabled={!isFiltered}
          onClick={() => onApply(DEFAULT_RISK_FILTERS)}
        />

        <button
          type="button"
          className="ui-icon-text-button"
          disabled={loading}
          onClick={onReload}
        >
          <RefreshCw
            size={14}
            className={loading ? "ui-spin" : undefined}
            aria-hidden="true"
          />
          Refresh
        </button>

        <ExportButton disabled={shown === 0} onExport={onExport} />
      </Toolbar>

      <SavedViews
        storageKey="fcg.views.customer-risk"
        current={filters}
        canSave={isFiltered}
        onApply={(view) => onApply(normalizeRiskFilters(view))}
      />

      <div className="ui-wf-count-row">
        <ResultCount
          shown={shown}
          total={assessments.length}
          noun={plural(assessments.length, "customer")}
          filtered={isFiltered}
        />

        {note}
      </div>
    </>
  );
}
