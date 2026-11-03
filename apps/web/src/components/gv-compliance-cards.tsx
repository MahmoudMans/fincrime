"use client";

import { Activity, Clock3 } from "lucide-react";
import { useMemo } from "react";

import type {
  ComplianceActivity,
  ComplianceCaseSla,
  ComplianceSlaPolicy,
} from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import { formatDateTime, humanize } from "@/lib/format";
import {
  ALL,
  PRIORITY_ORDER,
  countOptions,
  useFilterState,
} from "@/lib/gv-common";
import {
  ACTIVITY_COLUMNS,
  DEFAULT_ACTIVITY_FILTERS,
  DEFAULT_SLA_FILTERS,
  SLA_COLUMNS,
  SLA_PAGE_SIZE,
  SLA_STATE_ORDER,
  filterActivity,
  filterSla,
  slaClass,
  slaLabel,
  slaRemaining,
  type SlaFilters,
} from "@/lib/gv-compliance";
import {
  clampPage,
  paginate,
  plural,
} from "@/lib/list-utils";

import { StatusPill } from "./gv-parts";
import {
  ChipGroup,
  ExportButton,
  Pager,
  ResetButton,
  ResultCount,
  SavedViews,
  SearchField,
  SelectField,
  Toolbar,
} from "./list-tools";
import { StackedBar } from "./mini-charts";
import { EmptyState } from "./state-card";

const STATE_TONES = {
  BREACHED: "danger",
  CLOSED_BREACHED: "danger",
  WITHIN_SLA: "ok",
  CLOSED_WITHIN_SLA: "info",
} as const;

export function SlaPortfolioCard({
  items,
  policies,
}: {
  items: ComplianceCaseSla[];
  policies: ComplianceSlaPolicy[];
}) {
  const {
    filters,
    current,
    hasFilters,
    update,
    setPage,
    reset,
    apply,
  } = useFilterState<SlaFilters>(DEFAULT_SLA_FILTERS);

  const filtered = useMemo(
    () => filterSla(items, filters),
    [items, filters]
  );

  const stateOptions = useMemo(
    () =>
      countOptions(
        filterSla(items, { ...filters, state: ALL }).map(
          (item) => item.slaState
        ),
        "All",
        {
          order: SLA_STATE_ORDER,
          always: SLA_STATE_ORDER,
          keep: filters.state,
          tones: STATE_TONES,
          label: slaLabel,
        }
      ),
    [items, filters]
  );

  const priorityOptions = useMemo(
    () =>
      countOptions(
        filterSla(items, { ...filters, priority: ALL }).map(
          (item) => item.priority
        ),
        "All priorities",
        {
          order: PRIORITY_ORDER,
          keep: filters.priority,
          label: (value) => value,
        }
      ),
    [items, filters]
  );

  const statusOptions = useMemo(
    () =>
      countOptions(
        filterSla(items, { ...filters, status: ALL }).map(
          (item) => item.caseStatus
        ),
        "All case statuses",
        { keep: filters.status }
      ),
    [items, filters]
  );

  const segments = useMemo(
    () =>
      SLA_STATE_ORDER.map((state) => ({
        key: state,
        label: slaLabel(state),
        value: items.filter((item) => item.slaState === state).length,
        tone:
          state === "CLOSED_BREACHED"
            ? ("warning" as const)
            : STATE_TONES[state],
      })),
    [items]
  );

  const page = clampPage(
    filters.page,
    filtered.length,
    SLA_PAGE_SIZE
  );

  const visible = paginate(filtered, page, SLA_PAGE_SIZE);

  return (
    <div className="compliance-card ui-gv-sla">
      <div className="compliance-card-heading">
        <div>
          <Clock3 size={14} aria-hidden="true" />

          <strong>Case SLA portfolio</strong>
        </div>

        <span>
          {items.length}
          {" tracked"}
        </span>
      </div>

      <div className="compliance-policy-row">
        {policies.map((policy) => (
          <div
            key={policy.priority}
            className="compliance-policy"
            title={policy.description}
          >
            <span>
              {policy.priority}
              {policy.active ? "" : " (inactive)"}
            </span>

            <strong>
              {policy.targetHours}
              h
            </strong>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={<Clock3 size={22} aria-hidden="true" />}
          title="SLA snapshot not generated"
          message="Recalculate SLA to populate current case timing."
        />
      ) : (
        <>
          <div className="ui-gv-summary">
            <StackedBar
              segments={segments}
              label="Cases by SLA state"
            />
          </div>

          <Toolbar label="Filter SLA cases">
            <SearchField
              label="Search SLA cases"
              placeholder="Search case number, priority or status..."
              value={filters.q}
              onChange={(q) => update({ q })}
            />

            <SelectField
              label="Filter by priority"
              value={filters.priority}
              options={priorityOptions}
              onChange={(priority) => update({ priority })}
            />

            <SelectField
              label="Filter by case status"
              value={filters.status}
              options={statusOptions}
              onChange={(status) => update({ status })}
            />

            <ResetButton disabled={!hasFilters} onClick={reset} />

            <ExportButton
              disabled={filtered.length === 0}
              onExport={() =>
                exportRowsAsCsv(
                  "compliance-sla-cases",
                  filtered,
                  SLA_COLUMNS
                )
              }
            />
          </Toolbar>

          <div className="ui-chips-row">
            <ChipGroup
              label="Filter by SLA state"
              value={filters.state}
              options={stateOptions}
              onChange={(state) => update({ state })}
            />
          </div>

          <SavedViews<SlaFilters>
            storageKey="fcg.views.compliance"
            current={current}
            canSave={hasFilters}
            onApply={apply}
          />

          <ResultCount
            shown={filtered.length}
            total={items.length}
            noun={plural(items.length, "case")}
            filtered={hasFilters}
          />

          {filtered.length === 0 ? (
            <EmptyState
              compact
              title="No cases match these filters"
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
          ) : (
            <div className="sla-case-list">
              {visible.map((item) => {
                const remaining = slaRemaining(item);

                return (
                  <article key={item.id} className="sla-case-row">
                    <div
                      className={`sla-state-dot sla-state-${slaClass(
                        item.slaState
                      )}`}
                      aria-hidden="true"
                    />

                    <div className="sla-case-copy">
                      <strong>{item.caseNumber}</strong>

                      <span>
                        {item.priority}
                        {" · "}
                        {humanize(item.caseStatus)}
                      </span>
                    </div>

                    <div className="sla-case-hours">
                      <strong>
                        {item.elapsedHours}
                        h
                      </strong>

                      <span>
                        {"target "}
                        {item.targetHours}
                        {"h"}
                        {remaining ? ` · ${remaining}` : ""}
                      </span>
                    </div>

                    <div
                      className={`sla-state-label sla-state-${slaClass(
                        item.slaState
                      )}`}
                    >
                      {slaLabel(item.slaState)}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <Pager
            label="SLA case pages"
            page={page}
            pageSize={SLA_PAGE_SIZE}
            total={filtered.length}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

export function ActivityCard({
  events,
}: {
  events: ComplianceActivity[];
}) {
  const { filters, hasFilters, update, reset } = useFilterState(
    DEFAULT_ACTIVITY_FILTERS
  );

  const filtered = useMemo(
    () => filterActivity(events, filters),
    [events, filters]
  );

  const outcomeOptions = useMemo(
    () =>
      countOptions(
        events.map((event) => event.outcome),
        "All outcomes",
        { order: ["SUCCESS"], keep: filters.outcome }
      ),
    [events, filters.outcome]
  );

  return (
    <div className="compliance-card ui-gv-activity">
      <div className="compliance-card-heading">
        <div>
          <Activity size={14} aria-hidden="true" />

          <strong>Recent controlled activity</strong>
        </div>

        <span>
          {events.length}
          {" events"}
        </span>
      </div>

      {events.length === 0 ? (
        <EmptyState
          compact
          icon={<Activity size={22} aria-hidden="true" />}
          title="No recorded activity"
          message="Controlled actions appear here once they happen."
        />
      ) : (
        <>
          <Toolbar label="Filter activity">
            <SearchField
              label="Search activity"
              placeholder="Search user, action or resource..."
              value={filters.q}
              onChange={(q) => update({ q })}
            />

            <SelectField
              label="Filter by outcome"
              value={filters.outcome}
              options={outcomeOptions}
              onChange={(outcome) => update({ outcome })}
            />

            <ResetButton disabled={!hasFilters} onClick={reset} />

            <ExportButton
              disabled={filtered.length === 0}
              onExport={() =>
                exportRowsAsCsv(
                  "compliance-activity",
                  filtered,
                  ACTIVITY_COLUMNS
                )
              }
            />
          </Toolbar>

          <ResultCount
            shown={filtered.length}
            total={events.length}
            noun={plural(events.length, "event")}
            filtered={hasFilters}
          />

          {filtered.length === 0 ? (
            <EmptyState
              compact
              title="No events match these filters"
              message="Try a different search or clear the filters."
            />
          ) : (
            <div className="compliance-activity-list">
              {filtered.map((event) => (
                <article
                  key={event.id}
                  className="compliance-activity-row"
                >
                  <div
                    className={
                      event.outcome === "SUCCESS"
                        ? "activity-status success"
                        : "activity-status"
                    }
                    aria-hidden="true"
                  />

                  <div>
                    <strong>
                      {slaLabel(event.action)}

                      <StatusPill
                        tone={
                          event.outcome === "SUCCESS"
                            ? "ok"
                            : "danger"
                        }
                      >
                        {humanize(event.outcome)}
                      </StatusPill>
                    </strong>

                    <span>
                      {event.username}
                      {" · "}
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
