"use client";

import { History } from "lucide-react";
import { useMemo, useState } from "react";

import type { DetectionRuleChange } from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { HISTORY_COLUMNS } from "@/lib/gv-rules";
import { clampPage, paginate } from "@/lib/list-utils";

import { ExportButton, Pager } from "./list-tools";
import { ErrorState, LoadingState } from "./state-card";

const HISTORY_PAGE_SIZE = 6;

/**
 * Version history of one rule. `history` is null until the history of
 * this very rule has arrived, so another rule's history is never shown
 * under the wrong heading.
 */
export function RuleHistory({
  ruleKey,
  history,
  error,
  onRetry,
}: {
  ruleKey: string;
  history: DetectionRuleChange[] | null;
  error: string | null;
  onRetry: () => void;
}) {
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () =>
      [...(history ?? [])].sort((a, b) => b.version - a.version),
    [history]
  );

  const safePage = clampPage(page, sorted.length, HISTORY_PAGE_SIZE);

  const visible = paginate(sorted, safePage, HISTORY_PAGE_SIZE);

  return (
    <div className="rule-history">
      <div className="rule-history-heading">
        <div>
          <History size={14} aria-hidden="true" />

          <strong>Version history</strong>
        </div>

        <span className="ui-gv-inline-actions">
          {sorted.length}

          <ExportButton
            label="Export history"
            disabled={sorted.length === 0}
            onExport={() =>
              exportRowsAsCsv(
                `rule-${ruleKey}-history`,
                sorted,
                HISTORY_COLUMNS
              )
            }
          />
        </span>
      </div>

      {error && (
        <ErrorState
          compact
          title="Unable to load version history"
          message={error}
          onRetry={onRetry}
        />
      )}

      {!error && history === null && (
        <LoadingState compact label="Loading version history" />
      )}

      {!error && history !== null && history.length === 0 && (
        <div className="rule-history-empty">No version history.</div>
      )}

      {visible.map((change) => (
        <article key={change.id} className="rule-history-item">
          <div className="rule-version">
            v
            {change.version}
          </div>

          <div>
            <strong>{change.changeSummary}</strong>

            <span>
              {change.changedBy}
              {" · "}
              {formatDateTime(change.changedAt)}
            </span>
          </div>
        </article>
      ))}

      <Pager
        label="Version history pages"
        page={safePage}
        pageSize={HISTORY_PAGE_SIZE}
        total={sorted.length}
        onPage={setPage}
      />
    </div>
  );
}
