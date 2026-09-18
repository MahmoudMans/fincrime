"use client";

import cytoscape from "cytoscape";
import {
  AlertTriangle,
  CircleDotDashed,
  GitCompareArrows,
  LocateFixed,
  Network,
  Radar,
  Route,
  ScanSearch,
  ShieldAlert,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  fetchAccountNeighborhood,
  fetchCircularFlowGraph,
  fetchGraphInvestigationAccounts,
  fetchGraphInvestigationSummary,
  fetchMoneyFlowPath,
  type GraphAccountOption,
  type GraphInvestigationSummary,
  type InvestigationGraph,
  type InvestigationGraphNode,
} from "@/lib/api";

export function GraphInvestigationWorkbench() {
  const graphContainerRef =
    useRef<HTMLDivElement | null>(null);

  const graphRef =
    useRef<cytoscape.Core | null>(null);

  const [accounts, setAccounts] =
    useState<GraphAccountOption[]>([]);

  const [summary, setSummary] =
    useState<GraphInvestigationSummary | null>(
      null
    );

  const [source, setSource] =
    useState("");

  const [target, setTarget] =
    useState("");

  const [maxHops, setMaxHops] =
    useState(4);

  const [depth, setDepth] =
    useState(2);

  const [result, setResult] =
    useState<InvestigationGraph | null>(
      null
    );

  const [selectedNode, setSelectedNode] =
    useState<InvestigationGraphNode | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.all([
      fetchGraphInvestigationAccounts(
        controller.signal
      ),
      fetchGraphInvestigationSummary(
        controller.signal
      ),
    ])
      .then(
        ([
          accountOptions,
          investigationSummary,
        ]) => {
          setAccounts(accountOptions);
          setSummary(
            investigationSummary
          );

          if (
            accountOptions.length > 0
          ) {
            setSource(
              accountOptions[0]
                .accountNumber
            );
          }

          if (
            accountOptions.length > 1
          ) {
            const preferred =
              accountOptions.find(
                (account) =>
                  account.accountNumber ===
                  "FCG-100006"
              );

            setTarget(
              preferred?.accountNumber ??
                accountOptions[1]
                  .accountNumber
            );
          }
        }
      )
      .catch(
        (loadError: unknown) => {
          if (
            loadError instanceof DOMException &&
            loadError.name === "AbortError"
          ) {
            return;
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load graph investigation data."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  useEffect(() => {
    if (
      !graphContainerRef.current
    ) {
      return;
    }

    graphRef.current?.destroy();

    if (
      !result ||
      result.nodes.length === 0
    ) {
      graphRef.current = null;
      return;
    }

    const elements = [
      ...result.nodes.map(
        (node) => ({
          data: {
            ...node,
            label:
              node.accountNumber,
          },
        })
      ),
      ...result.edges.map(
        (edge) => ({
          data: {
            ...edge,
            amountLabel:
              `${edge.amount.toLocaleString()} ${edge.currency}`,
          },
        })
      ),
    ];

    const graph = cytoscape({
      container:
        graphContainerRef.current,

      elements,

      minZoom: 0.4,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,

      style: [
        {
          selector: "node",
          style: {
            width: 58,
            height: 58,
            label: "data(label)",
            "font-size": 9,
            "font-weight": 600,
            color: "#dbe7f6",
            "text-valign": "bottom",
            "text-margin-y": 8,
            "text-wrap": "wrap",
            "text-max-width": "95px",
            "background-color": "#2878ff",
            "border-width": 2,
            "border-color": "#0b1523",
            "overlay-opacity": 0,
          },
        },
        {
          selector:
            "node[riskTier = 'HIGH']",
          style: {
            "background-color":
              "#d54c5b",
            "border-color":
              "#ff8791",
            "border-width": 4,
          },
        },
        {
          selector:
            "node[riskTier = 'MEDIUM']",
          style: {
            "background-color":
              "#b78337",
            "border-color":
              "#f4c166",
            "border-width": 3,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color":
              "#ffffff",
            "border-width": 5,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2.5,
            "line-color":
              "#29bdb3",
            "target-arrow-color":
              "#29bdb3",
            "target-arrow-shape":
              "triangle",
            "curve-style":
              "bezier",
            "arrow-scale": 0.8,
            label:
              "data(amountLabel)",
            "font-size": 7,
            color: "#7f95ad",
            "text-rotation":
              "autorotate",
            "text-background-color":
              "#09111d",
            "text-background-opacity":
              0.85,
            "text-background-padding":
              "3px",
          },
        },
      ],

      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 55,
        idealEdgeLength: 125,
        nodeRepulsion: 7200,
      },
    });

    graphRef.current = graph;

    graph.on(
      "tap",
      "node",
      (event) => {
        setSelectedNode(
          event.target.data() as
            InvestigationGraphNode
        );
      }
    );

    return () => {
      graph.destroy();

      if (
        graphRef.current === graph
      ) {
        graphRef.current = null;
      }
    };
  }, [result]);

  const visibleSelectedNode =
    selectedNode &&
    result?.nodes.some(
      (node) =>
        node.id ===
        selectedNode.id
    )
      ? selectedNode
      : null;

  async function runPath() {
    if (
      !source ||
      !target
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const graph =
        await fetchMoneyFlowPath(
          source,
          target,
          maxHops
        );

      setSelectedNode(null);
      setResult(graph);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to investigate path."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runNeighborhood() {
    if (!source) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const graph =
        await fetchAccountNeighborhood(
          source,
          depth
        );

      setSelectedNode(null);
      setResult(graph);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to expand account neighborhood."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runCycles() {
    try {
      setLoading(true);
      setError(null);

      const graph =
        await fetchCircularFlowGraph();

      setSelectedNode(null);
      setResult(graph);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to discover circular flows."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel investigation-workbench">
      <div className="panel-heading investigation-workbench-heading">
        <div>
          <div className="eyebrow">
            Neo4j investigations
          </div>

          <h2>
            Graph investigation workbench
          </h2>

          <p>
            Trace directed money flows,
            expand connected accounts and
            expose circular transaction
            structures.
          </p>
        </div>

        <div className="graph-engine-badge">
          <Network size={14} />
          Neo4j graph analytics
        </div>
      </div>

      {summary && (
        <div className="graph-summary-grid">
          <GraphSummaryCard
            icon={Network}
            label="Accounts"
            value={summary.accounts}
          />

          <GraphSummaryCard
            icon={GitCompareArrows}
            label="Transfers"
            value={
              summary
                .transferRelationships
            }
          />

          <GraphSummaryCard
            icon={ShieldAlert}
            label="High-risk accounts"
            value={
              summary.highRiskAccounts
            }
          />

          <GraphSummaryCard
            icon={Radar}
            label="Cross-border"
            value={
              summary.crossBorderTransfers
            }
          />

          <GraphSummaryCard
            icon={CircleDotDashed}
            label="Circular flows"
            value={
              summary.circularFlows
            }
          />
        </div>
      )}

      <div className="investigation-controls">
        <div className="investigation-control">
          <label htmlFor="graph-source">
            Source account
          </label>

          <select
            id="graph-source"
            value={source}
            onChange={(event) =>
              setSource(
                event.target.value
              )
            }
          >
            {accounts.map(
              (account) => (
                <option
                  key={
                    account.accountNumber
                  }
                  value={
                    account.accountNumber
                  }
                >
                  {
                    account.accountNumber
                  }
                  {" · "}
                  {account.ownerName}
                </option>
              )
            )}
          </select>
        </div>

        <div className="investigation-control">
          <label htmlFor="graph-target">
            Target account
          </label>

          <select
            id="graph-target"
            value={target}
            onChange={(event) =>
              setTarget(
                event.target.value
              )
            }
          >
            {accounts.map(
              (account) => (
                <option
                  key={
                    account.accountNumber
                  }
                  value={
                    account.accountNumber
                  }
                >
                  {
                    account.accountNumber
                  }
                  {" · "}
                  {account.ownerName}
                </option>
              )
            )}
          </select>
        </div>

        <div className="investigation-control compact">
          <label htmlFor="graph-hops">
            Max hops
          </label>

          <select
            id="graph-hops"
            value={maxHops}
            onChange={(event) =>
              setMaxHops(
                Number(
                  event.target.value
                )
              )
            }
          >
            {[1, 2, 3, 4, 5].map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          className="primary-button investigation-action"
          disabled={
            loading ||
            !source ||
            !target ||
            source === target
          }
          onClick={() =>
            void runPath()
          }
        >
          <Route size={15} />
          Find money path
        </button>
      </div>

      <div className="investigation-secondary-controls">
        <div className="depth-control">
          <label htmlFor="graph-depth">
            Neighborhood depth
          </label>

          <select
            id="graph-depth"
            value={depth}
            onChange={(event) =>
              setDepth(
                Number(
                  event.target.value
                )
              )
            }
          >
            {[1, 2, 3, 4].map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          className="secondary-button graph-tool-button"
          disabled={
            loading ||
            !source
          }
          onClick={() =>
            void runNeighborhood()
          }
        >
          <LocateFixed size={14} />
          Expand neighborhood
        </button>

        <button
          type="button"
          className="secondary-button graph-tool-button"
          disabled={loading}
          onClick={() =>
            void runCycles()
          }
        >
          <CircleDotDashed
            size={14}
          />
          Find circular flows
        </button>
      </div>

      {error && (
        <div className="graph-investigation-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      <div className="investigation-result">
        <div className="investigation-result-main">
          <div className="investigation-result-heading">
            <div>
              <div className="eyebrow">
                Investigation result
              </div>

              <h3>
                {loading
                  ? "Analyzing graph..."
                  : result?.headline ??
                    "Choose an investigation"}
              </h3>

              <p>
                {loading
                  ? "Querying Neo4j relationships and transaction paths."
                  : result?.description ??
                    "Trace a payment path, inspect an account neighborhood, or discover circular flows."}
              </p>
            </div>

            {result && (
              <div className="investigation-result-stats">
                <span>
                  {
                    result.nodes
                      .length
                  }
                  {" "}nodes
                </span>

                <span>
                  {
                    result.edges
                      .length
                  }
                  {" "}transfers
                </span>

                {result.hopCount >
                  0 && (
                  <span>
                    {
                      result.hopCount
                    }
                    {" "}hops
                  </span>
                )}

                {result.cycleCount >
                  0 && (
                  <span>
                    {
                      result.cycleCount
                    }
                    {" "}cycles
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            ref={graphContainerRef}
            className="investigation-graph-canvas"
          >
            {(!result ||
              result.nodes.length ===
                0) &&
              !loading && (
                <div className="investigation-graph-placeholder">
                  <ScanSearch size={31} />

                  <strong>
                    Graph ready
                  </strong>

                  <span>
                    Select an investigation
                    operation above.
                  </span>
                </div>
              )}
          </div>
        </div>

        <aside className="investigation-inspector">
          {visibleSelectedNode ? (
            <>
              <div className="eyebrow">
                Selected account
              </div>

              <h3>
                {
                  visibleSelectedNode
                    .accountNumber
                }
              </h3>

              <p>
                {
                  visibleSelectedNode
                    .ownerName
                }
              </p>

              <InspectorRow
                label="Risk tier"
                value={
                  visibleSelectedNode
                    .riskTier
                }
                risk={
                  visibleSelectedNode
                    .riskTier
                }
              />

              <InspectorRow
                label="Jurisdiction"
                value={
                  visibleSelectedNode
                    .countryCode
                }
              />

              <InspectorRow
                label="Account status"
                value={
                  visibleSelectedNode
                    .status
                }
              />
            </>
          ) : (
            <div className="investigation-inspector-empty">
              <Network size={25} />

              <strong>
                Inspect an account
              </strong>

              <span>
                Click a graph node for
                account context.
              </span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function GraphSummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Network;
  label: string;
  value: number;
}) {
  return (
    <div className="graph-summary-card">
      <Icon size={15} />

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function InspectorRow({
  label,
  value,
  risk,
}: {
  label: string;
  value: string;
  risk?: string;
}) {
  return (
    <div className="investigation-inspector-row">
      <span>{label}</span>

      <strong
        className={
          risk
            ? `risk-text risk-${risk.toLowerCase()}`
            : undefined
        }
      >
        {value}
      </strong>
    </div>
  );
}
