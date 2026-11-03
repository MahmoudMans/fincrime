"use client";

import { useMemo, useState } from "react";

import {
  ChipGroup,
  ExportButton,
  Pager,
  ResetButton,
  ResultCount,
  SearchField,
  Toolbar,
  type Option,
} from "@/components/list-tools";
import { EmptyState } from "@/components/state-card";
import type { InvestigationGraph } from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import { ALL, type RiskFilter } from "@/lib/gx-explorer";
import {
  GRAPH_NODE_COLUMNS,
  accountLabels,
  filterGraphEdges,
  filterGraphNodes,
  graphEdgeColumns,
} from "@/lib/gx-graph";
import {
  clampPage,
  countBy,
  paginate,
} from "@/lib/list-utils";

const PAGE_SIZE = 10;

type DetailView = "nodes" | "edges";

/**
 * The text twin of a graph result: every account and transfer in a
 * searchable, exportable table. It is the keyboard and screen reader
 * way into the canvas: choosing a row selects that account on it.
 */
export function GraphResultDetails({
  graph,
  selectedId,
  onSelect,
}: {
  graph: InvestigationGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [view, setView] = useState<DetailView>("nodes");
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<RiskFilter>(ALL);
  const [page, setPage] = useState(0);

  const labels = useMemo(
    () => accountLabels(graph.nodes),
    [graph.nodes]
  );

  const nodeFacet = useMemo(
    () => filterGraphNodes(graph.nodes, query, ALL),
    [graph.nodes, query]
  );

  const riskCounts = useMemo(
    () =>
      countBy(nodeFacet, (node) =>
        node.riskTier.toUpperCase()
      ),
    [nodeFacet]
  );

  const nodes = useMemo(
    () => filterGraphNodes(graph.nodes, query, risk),
    [graph.nodes, query, risk]
  );

  const edges = useMemo(
    () => filterGraphEdges(graph.edges, labels, query),
    [graph.edges, labels, query]
  );

  const edgeColumns = useMemo(
    () => graphEdgeColumns(labels),
    [labels]
  );

  const rowCount =
    view === "nodes" ? nodes.length : edges.length;

  const safePage = clampPage(page, rowCount, PAGE_SIZE);

  const hasFilters =
    query !== "" || (view === "nodes" && risk !== ALL);

  const viewOptions: Option<DetailView>[] = [
    {
      value: "nodes",
      label: "Accounts",
      count: graph.nodes.length,
    },
    {
      value: "edges",
      label: "Transfers",
      count: graph.edges.length,
    },
  ];

  const riskOptions: Option<RiskFilter>[] = [
    { value: ALL, label: "All risk", count: nodeFacet.length },
    {
      value: "HIGH",
      label: "High",
      tone: "danger",
      count: riskCounts.HIGH ?? 0,
    },
    {
      value: "MEDIUM",
      label: "Medium",
      tone: "warning",
      count: riskCounts.MEDIUM ?? 0,
    },
    {
      value: "LOW",
      label: "Low",
      tone: "ok",
      count: riskCounts.LOW ?? 0,
    },
  ];

  function reset() {
    setQuery("");
    setRisk(ALL);
    setPage(0);
  }

  function exportRows() {
    if (view === "nodes") {
      exportRowsAsCsv(
        `Graph ${graph.mode} accounts`,
        nodes,
        GRAPH_NODE_COLUMNS
      );
    } else {
      exportRowsAsCsv(
        `Graph ${graph.mode} transfers`,
        edges,
        edgeColumns
      );
    }
  }

  return (
    <section
      className="ui-gx-details"
      aria-label="Accounts and transfers in this result"
    >
      <div className="ui-gx-details-head">
        <div>
          <div className="eyebrow">Result details</div>

          <p>
            The same data as the graph, as a table you can
            search, read with a screen reader and export.
          </p>
        </div>

        <ChipGroup
          label="Show"
          value={view}
          options={viewOptions}
          onChange={(next) => {
            setView(next);
            setQuery("");
            setRisk(ALL);
            setPage(0);
          }}
        />
      </div>

      <Toolbar
        label={
          view === "nodes"
            ? "Filter accounts in the result"
            : "Filter transfers in the result"
        }
      >
        <SearchField
          label={
            view === "nodes"
              ? "Find an account in this result"
              : "Find a transfer in this result"
          }
          placeholder={
            view === "nodes"
              ? "Account, owner, country, risk..."
              : "Reference, account or amount..."
          }
          value={query}
          onChange={(next) => {
            setQuery(next);
            setPage(0);
          }}
        />

        <ResetButton disabled={!hasFilters} onClick={reset} />

        <ExportButton
          label={
            view === "nodes"
              ? "Export accounts"
              : "Export transfers"
          }
          disabled={rowCount === 0}
          onExport={exportRows}
        />
      </Toolbar>

      {view === "nodes" && (
        <div className="ui-chips-row">
          <ChipGroup
            label="Filter accounts by risk tier"
            value={risk}
            options={riskOptions}
            onChange={(next) => {
              setRisk(next);
              setPage(0);
            }}
          />
        </div>
      )}

      <ResultCount
        shown={rowCount}
        total={
          view === "nodes"
            ? graph.nodes.length
            : graph.edges.length
        }
        noun={view === "nodes" ? "accounts" : "transfers"}
        filtered={hasFilters}
      />

      {rowCount === 0 ? (
        <EmptyState
          compact
          title={
            view === "nodes"
              ? "No accounts match"
              : "No transfers match"
          }
          message="Try a different search or reset the filters."
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
        <div className="table-scroll">
          {view === "nodes" ? (
            <table className="ui-gx-table">
              <caption className="ui-visually-hidden">
                Accounts in the investigation result
              </caption>

              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Country</th>
                  <th scope="col">Risk tier</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>

              <tbody>
                {paginate(nodes, safePage, PAGE_SIZE).map(
                  (node) => (
                    <tr
                      key={node.id}
                      className={
                        node.id === selectedId
                          ? "ui-gx-row-selected"
                          : undefined
                      }
                    >
                      <th scope="row">
                        <button
                          type="button"
                          className="ui-gx-link"
                          aria-pressed={node.id === selectedId}
                          title="Show this account on the graph"
                          onClick={() => onSelect(node.id)}
                        >
                          {node.accountNumber}
                        </button>
                      </th>

                      <td>{node.ownerName}</td>

                      <td>{node.countryCode}</td>

                      <td>
                        <span
                          className={`risk-text risk-${node.riskTier.toLowerCase()}`}
                        >
                          {node.riskTier}
                        </span>
                      </td>

                      <td>{node.status}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          ) : (
            <table className="ui-gx-table">
              <caption className="ui-visually-hidden">
                Transfers in the investigation result
              </caption>

              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>

              <tbody>
                {paginate(edges, safePage, PAGE_SIZE).map(
                  (edge) => (
                    <tr key={edge.id}>
                      <th scope="row">{edge.reference}</th>

                      <td>
                        <button
                          type="button"
                          className="ui-gx-link"
                          title="Show this account on the graph"
                          onClick={() => onSelect(edge.source)}
                        >
                          {labels.get(edge.source) ?? edge.source}
                        </button>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="ui-gx-link"
                          title="Show this account on the graph"
                          onClick={() => onSelect(edge.target)}
                        >
                          {labels.get(edge.target) ?? edge.target}
                        </button>
                      </td>

                      <td className="amount-cell">
                        {edge.amount.toLocaleString()}{" "}
                        {edge.currency}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Pager
        page={safePage}
        pageSize={PAGE_SIZE}
        total={rowCount}
        onPage={setPage}
        label={
          view === "nodes"
            ? "Account pages"
            : "Transfer pages"
        }
      />
    </section>
  );
}
