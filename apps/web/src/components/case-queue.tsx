"use client";

import {
  BriefcaseBusiness,
  ChevronRight,
  Radar,
} from "lucide-react";
import { useState } from "react";

import type {
  DetectionRun,
  InvestigationCase,
} from "@/lib/api";
import { exportRowsAsCsv, type CsvColumn } from "@/lib/csv";
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  DEFAULT_CASE_FILTERS,
  countCases,
  filterCases,
  isDefaultCaseFilters,
  normalizeCaseFilters,
  type CaseFilters,
} from "@/lib/cq-cases";
import { assigneeInitials } from "@/lib/cw-assignee";
import { formatDateTime, humanize } from "@/lib/format";
import { clampPage, paginate } from "@/lib/list-utils";

import { useAuth } from "./auth-context";
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
import { EmptyState } from "./state-card";

const PAGE_SIZE = 8;

const CASE_COLUMNS: CsvColumn<InvestigationCase>[] = [
  { header: "Case number", value: (item) => item.caseNumber },
  { header: "Title", value: (item) => item.title },
  { header: "Status", value: (item) => item.status },
  { header: "Priority", value: (item) => item.priority },
  { header: "Alert risk score", value: (item) => item.alertRiskScore },
  { header: "Alert code", value: (item) => item.primaryAlertCode },
  { header: "Assigned to", value: (item) => item.assignedTo },
  { header: "Created (UTC)", value: (item) => item.createdAt },
  { header: "Updated (UTC)", value: (item) => item.updatedAt },
  { header: "Summary", value: (item) => item.summary },
];

function CaseItem({
  item,
  busy,
  onAdvance,
  onOpenCase,
}: {
  item: InvestigationCase;
  busy: boolean;
  onAdvance: (caseId: string) => Promise<void>;
  onOpenCase?: (caseId: string) => void;
}) {
  return (
    <article className="case-item">
      <div className="case-main">
        <div className="case-title-row">
          <span
            className={`case-priority priority-${item.priority.toLowerCase()}`}
          >
            {item.priority}
          </span>

          <strong>{item.title}</strong>
        </div>

        <div className="case-meta">
          <span>{item.caseNumber}</span>

          <span>Alert {item.primaryAlertCode}</span>

          <span>Risk {item.alertRiskScore}</span>

          <span title={formatDateTime(item.updatedAt)}>
            Updated {formatDateTime(item.updatedAt)}
          </span>

          {item.assignedTo ? (
            <span
              className="ui-owner"
              title={item.assignedTo}
            >
              <span
                className="ui-owner-avatar"
                aria-hidden="true"
              >
                {assigneeInitials(item.assignedTo)}
              </span>
              Owner: {item.assignedTo}
            </span>
          ) : (
            <span>Unassigned</span>
          )}
        </div>
      </div>

      <div className="case-actions">
        <span
          className={`case-status case-status-${item.status.toLowerCase()}`}
        >
          {humanize(item.status)}
        </span>

        {onOpenCase && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => onOpenCase(item.id)}
          >
            {item.status === "IN_REVIEW"
              ? "Resolve case"
              : "Open workspace"}
          </button>
        )}

        {item.status === "OPEN" && (
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => void onAdvance(item.id)}
          >
            <ChevronRight size={13} aria-hidden="true" />

            {busy ? "Updating..." : "Start review"}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Investigation cases with search, status / priority / owner
 * filters, sorting, paging, saved views and CSV export. The
 * controls appear once there are enough cases to need them.
 */
export function CaseQueue({
  cases,
  latestRun,
  busyCaseId,
  onAdvance,
  onOpenCase,
}: {
  cases: InvestigationCase[];
  latestRun: DetectionRun | null;
  busyCaseId: string | null;
  onAdvance: (caseId: string) => Promise<void>;
  /** Opens the case workspace for a case. */
  onOpenCase?: (caseId: string) => void;
}) {
  const { session } = useAuth();

  const [filters, setFilters] = useState<CaseFilters>(
    DEFAULT_CASE_FILTERS
  );

  const [page, setPage] = useState(0);

  const user = {
    displayName: session.displayName,
    username: session.username,
  };

  const matching = filterCases(cases, filters, user);

  const safePage = clampPage(page, matching.length, PAGE_SIZE);

  const visible = paginate(matching, safePage, PAGE_SIZE);

  const filtered = !isDefaultCaseFilters(filters);

  const showTools = cases.length > 4 || filtered;

  const statusCounts = countCases(cases, "status");

  const priorityCounts = countCases(cases, "priority");

  function update(patch: Partial<CaseFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  return (
    <section className="panel cases-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Case queue</div>

          <h2>Investigation cases</h2>

          <p>
            Cases opened directly from suspicious activity
            alerts.
          </p>
        </div>

        <div className="ui-heading-actions">
          {latestRun && (
            <div className="detection-run-summary">
              <Radar size={15} aria-hidden="true" />

              <div>
                <strong>{latestRun.candidatesFound}</strong>

                <span>
                  signals · {latestRun.rulesExecuted} rules
                </span>
              </div>
            </div>
          )}

          {cases.length > 0 && (
            <ExportButton
              disabled={matching.length === 0}
              onExport={() =>
                exportRowsAsCsv(
                  "cases",
                  matching,
                  CASE_COLUMNS
                )
              }
            />
          )}
        </div>
      </div>

      {showTools && (
        <>
          <Toolbar label="Filter cases">
            <SearchField
              label="Search cases"
              placeholder="Search title, case number, alert or owner..."
              value={filters.q}
              onChange={(q) => update({ q })}
            />

            <SelectField
              label="Filter by owner"
              value={filters.owner}
              onChange={(owner) => update({ owner })}
              options={[
                { value: "ALL", label: "All owners" },
                { value: "MINE", label: "Assigned to me" },
                { value: "UNASSIGNED", label: "Unassigned" },
              ]}
            />

            <SelectField
              label="Sort cases"
              value={filters.sort}
              onChange={(sort) => update({ sort })}
              options={[
                { value: "DEFAULT", label: "Default order" },
                { value: "PRIORITY", label: "Highest priority" },
                { value: "RISK", label: "Highest risk" },
                { value: "UPDATED", label: "Recently updated" },
                { value: "NEWEST", label: "Newest first" },
              ]}
            />

            <ResetButton
              disabled={!filtered}
              onClick={() => {
                setFilters(DEFAULT_CASE_FILTERS);
                setPage(0);
              }}
            />
          </Toolbar>

          <SavedViews<CaseFilters>
            storageKey="fcg.views.cases"
            current={filters}
            canSave={filtered}
            onApply={(value) => {
              setFilters(normalizeCaseFilters(value));
              setPage(0);
            }}
          />

          <div className="ui-chips-row ui-tools-bar">
            <ChipGroup
              label="Filter by status"
              value={filters.status}
              onChange={(status) => update({ status })}
              options={[
                {
                  value: "ALL",
                  label: "All",
                  count: cases.length,
                },
                ...CASE_STATUSES.map((status) => ({
                  value: status as string,
                  label: humanize(status),
                  count: statusCounts[status] ?? 0,
                })),
              ]}
            />

            <ChipGroup
              label="Filter by priority"
              value={filters.priority}
              onChange={(priority) => update({ priority })}
              options={[
                { value: "ALL", label: "Any priority" },
                ...CASE_PRIORITIES.map((priority) => ({
                  value: priority as string,
                  label: humanize(priority),
                  count: priorityCounts[priority] ?? 0,
                  tone:
                    priority === "CRITICAL" ||
                    priority === "HIGH"
                      ? ("danger" as const)
                      : priority === "MEDIUM"
                        ? ("warning" as const)
                        : ("ok" as const),
                })),
              ]}
            />
          </div>

          <ResultCount
            shown={matching.length}
            total={cases.length}
            noun={cases.length === 1 ? "case" : "cases"}
            filtered={filtered}
          />
        </>
      )}

      {cases.length === 0 ? (
        <div className="case-empty">
          <BriefcaseBusiness size={25} aria-hidden="true" />

          <strong>No investigation cases yet</strong>

          <span>
            Open a case from a priority alert to start
            analyst review.
          </span>
        </div>
      ) : matching.length === 0 ? (
        <EmptyState
          compact
          icon={
            <BriefcaseBusiness size={24} aria-hidden="true" />
          }
          title="No cases match these filters"
          message="Try a different search or clear the filters."
          action={
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setFilters(DEFAULT_CASE_FILTERS);
                setPage(0);
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <div className="case-list">
            {visible.map((item) => (
              <CaseItem
                key={item.id}
                item={item}
                busy={busyCaseId === item.id}
                onAdvance={onAdvance}
                onOpenCase={onOpenCase}
              />
            ))}
          </div>

          <Pager
            label="Case pages"
            page={safePage}
            pageSize={PAGE_SIZE}
            total={matching.length}
            onPage={setPage}
          />
        </>
      )}
    </section>
  );
}
