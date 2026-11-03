import type { CaseDecisionExecution } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";

/** The executed decisions as a table. `rows` is one page. */
export function ExecutionTable({
  rows,
}: {
  rows: readonly CaseDecisionExecution[];
}) {
  return (
    <div
      className="ui-gv-table-wrap"
      role="region"
      aria-label="Execution ledger"
      tabIndex={0}
    >
      <table className="ui-gv-table">
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Decision</th>
            <th scope="col">Outcome</th>
            <th scope="col">Maker, checker, executor</th>
            <th scope="col">Executed (UTC)</th>
            <th scope="col">Rationale</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((execution) => (
            <tr key={execution.id}>
              <th scope="row">
                {execution.caseNumber}

                <span>{execution.casePriority}</span>
              </th>

              <td>
                {"v"}
                {execution.decisionVersion}

                <span>
                  {humanize(execution.sourceRecommendation)}
                </span>
              </td>

              <td>{humanize(execution.governedOutcome)}</td>

              <td className="ui-gv-cell-people">
                <span>
                  {"Maker: "}
                  {execution.sourceProposedBy}
                </span>

                <span>
                  {"Checker: "}
                  {execution.sourceReviewedBy}
                </span>

                <span>
                  {"Executor: "}
                  {execution.executedBy}
                </span>
              </td>

              <td>{formatDateTime(execution.executedAt)}</td>

              <td className="ui-gv-cell-note">
                {execution.executionNote}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
