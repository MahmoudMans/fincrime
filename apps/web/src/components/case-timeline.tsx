"use client";

import { FileClock } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type { CaseWorkspaceEvent } from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  DEFAULT_TIMELINE_FILTERS,
  countEventTypes,
  eventTypesOf,
  filterEvents,
  formatClock,
  formatDayHeading,
  formatExactTime,
  groupByDay,
  relativeDayLabel,
  sortEvents,
  timelineCsvColumns,
  type TimelineFilters,
  type TimelineOrder,
} from "@/lib/cw-timeline";
import {
  formatRelativeTime,
  humanize,
} from "@/lib/format";
import {
  clampPage,
  paginate,
} from "@/lib/list-utils";

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
  type Option,
} from "./list-tools";
import { EmptyState } from "./state-card";

const PAGE_SIZE = 20;

const ORDER_OPTIONS: Option<TimelineOrder>[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

/** Keeps a preset saved by an older version or edited by hand usable. */
function sanitizeFilters(value: TimelineFilters): TimelineFilters {
  return {
    q: typeof value.q === "string" ? value.q : "",
    type: typeof value.type === "string" ? value.type : "ALL",
    order: value.order === "oldest" ? "oldest" : "newest",
  };
}

/**
 * The activity timeline of one case: events grouped by day with
 * search, a filter per event type, a newest/oldest switch, paging and
 * a CSV export of what is on screen. All times are UTC, like the rest
 * of the app.
 */
export function CaseTimeline({
  events,
  caseNumber,
}: {
  events: readonly CaseWorkspaceEvent[];
  caseNumber: string;
}) {
  const [filters, setFilters] = useState<TimelineFilters>(
    DEFAULT_TIMELINE_FILTERS
  );

  const [page, setPage] = useState(0);

  // Day headings say "Today" / "Yesterday". The clock is read in a
  // timer, not during render, and ticks so the labels stay right.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());

    const first = window.setTimeout(tick, 0);

    const interval = window.setInterval(tick, 60_000);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  const types = useMemo(() => eventTypesOf(events), [events]);

  // A type that vanished from the data (after a reload) falls back to all.
  const type = types.includes(filters.type) ? filters.type : "ALL";

  const counts = useMemo(
    () => countEventTypes(events, filters.q),
    [events, filters.q]
  );

  const visible = useMemo(
    () =>
      sortEvents(
        filterEvents(events, { q: filters.q, type }),
        filters.order
      ),
    [events, filters.q, filters.order, type]
  );

  const filtered = filters.q.trim() !== "" || type !== "ALL";

  const changed =
    filtered || filters.order !== DEFAULT_TIMELINE_FILTERS.order;

  const safePage = clampPage(page, visible.length, PAGE_SIZE);

  const groups = groupByDay(
    paginate(visible, safePage, PAGE_SIZE)
  );

  const typeOptions: Option<string>[] = [
    {
      value: "ALL",
      label: "All",
      count: Object.values(counts).reduce(
        (sum, value) => sum + value,
        0
      ),
    },
    ...types.map((value) => ({
      value,
      label: humanize(value),
      count: counts[value] ?? 0,
    })),
  ];

  function update(patch: Partial<TimelineFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  function reset() {
    setFilters(DEFAULT_TIMELINE_FILTERS);
    setPage(0);
  }

  return (
    <section
      className="case-workspace-block ui-cw-timeline"
      aria-label="Activity timeline"
    >
      <div className="case-block-heading">
        <div>
          <FileClock size={15} aria-hidden="true" />

          <strong>Activity timeline</strong>
        </div>

        <span>{events.length}</span>
      </div>

      {events.length === 0 ? (
        <EmptyState
          compact
          title="No workspace activity yet"
          message="Notes, evidence, assignment changes and the resolution are recorded here as they happen."
        />
      ) : (
        <>
          <Toolbar label="Filter the case timeline">
            <SearchField
              label="Search the timeline"
              placeholder="Search event, description or person..."
              value={filters.q}
              onChange={(q) => update({ q })}
            />

            <SelectField<TimelineOrder>
              label="Order events"
              value={filters.order}
              options={ORDER_OPTIONS}
              onChange={(order) => update({ order })}
            />

            <ResetButton disabled={!changed} onClick={reset} />

            <ExportButton
              disabled={visible.length === 0}
              onExport={() =>
                exportRowsAsCsv(
                  `${caseNumber} timeline`,
                  visible,
                  timelineCsvColumns(caseNumber)
                )
              }
            />
          </Toolbar>

          {types.length > 1 && (
            <div className="ui-chips-row">
              <ChipGroup
                label="Filter by event type"
                value={type}
                options={typeOptions}
                onChange={(value) => update({ type: value })}
              />
            </div>
          )}

          <SavedViews<TimelineFilters>
            storageKey="fcg.views.case-timeline"
            current={{ q: filters.q, type, order: filters.order }}
            canSave={changed}
            onApply={(value) => {
              setFilters(sanitizeFilters(value));
              setPage(0);
            }}
          />

          <ResultCount
            shown={visible.length}
            total={events.length}
            noun="events"
            filtered={filtered}
          />

          <p className="ui-cw-note">
            Times are UTC. Point at a time to see the exact timestamp.
          </p>

          {visible.length === 0 ? (
            <EmptyState
              compact
              title="No events match these filters"
              message="Try a different search or clear the filters."
              action={
                <button
                  type="button"
                  className="secondary-button"
                  onClick={reset}
                >
                  Reset filters
                </button>
              }
            />
          ) : (
            <ol className="ui-cw-days">
              {groups.map((group) => {
                const relative =
                  nowMs === null
                    ? null
                    : relativeDayLabel(group.key, nowMs);

                return (
                  <li key={group.key} className="ui-cw-day">
                    <h3 className="ui-cw-day-heading">
                      <span>{formatDayHeading(group.key)}</span>

                      {relative && (
                        <span className="ui-cw-day-relative">
                          {relative}
                        </span>
                      )}

                      <span className="ui-cw-day-count">
                        {group.events.length}
                      </span>
                    </h3>

                    <ol className="ui-cw-events">
                      {group.events.map((event) => (
                        <li
                          key={event.id}
                          className="ui-cw-event"
                          data-event={event.eventType}
                        >
                          <span
                            className="ui-cw-event-dot"
                            aria-hidden="true"
                          />

                          <div className="ui-cw-event-body">
                            <div className="ui-cw-event-head">
                              <strong>{humanize(event.eventType)}</strong>

                              <time
                                dateTime={event.createdAt}
                                title={formatExactTime(event.createdAt)}
                              >
                                {formatClock(event.createdAt)} UTC
                                {" · "}
                                {formatRelativeTime(event.createdAt)}
                              </time>
                            </div>

                            <p>{event.description}</p>

                            <small>{event.actorName}</small>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </li>
                );
              })}
            </ol>
          )}

          <Pager
            label="Timeline pages"
            page={safePage}
            pageSize={PAGE_SIZE}
            total={visible.length}
            onPage={setPage}
          />
        </>
      )}
    </section>
  );
}
