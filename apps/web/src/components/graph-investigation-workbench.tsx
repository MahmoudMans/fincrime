"use client";

import cytoscape from "cytoscape";
import {
  AlertTriangle,
  CircleDotDashed,
  GitCompareArrows,
  LocateFixed,
  Maximize2,
  Network,
  Radar,
  RefreshCw,
  RotateCcw,
  Route,
  ScanSearch,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { GraphResultDetails } from "@/components/gx-graph-result-details";
import {
  ErrorState,
  LoadingState,
} from "@/components/state-card";
import {
  fetchAccountNeighborhood,
  fetchCircularFlowGraph,
  fetchGraphInvestigationAccounts,
  fetchGraphInvestigationSummary,
  fetchMoneyFlowPath,
  type GraphAccountOption,
  type InvestigationGraph,
} from "@/lib/api";
import {
  describeGraph,
  investigationModel,
  layoutKey,
  transferCounts,
} from "@/lib/gx-graph";
import { useLoad } from "@/lib/use-load";

type RunKind = "path" | "neighborhood" | "cycles";

const FAILURES: Record<RunKind, string> = {
  path: "Unable to investigate path.",
  neighborhood: "Unable to expand account neighborhood.",
  cycles: "Unable to discover circular flows.",
};

const NO_ACCOUNTS: GraphAccountOption[] = [];

export function GraphInvestigationWorkbench() {
  const graphContainerRef =
    useRef<HTMLDivElement | null>(null);

  const graphRef =
    useRef<cytoscape.Core | null>(null);

  /** The shape the current layout was computed for. */
  const laidOutRef = useRef<string | null>(null);

  /** Marks the action in flight; its answer is dropped if this changed. */
  const activeRun = useRef<object | null>(null);

  const loadSetup = useCallback(
    async (signal: AbortSignal) => {
      const [accountOptions, investigationSummary] =
        await Promise.all([
          fetchGraphInvestigationAccounts(signal),
          fetchGraphInvestigationSummary(signal),
        ]);

      return { accountOptions, investigationSummary };
    },
    []
  );

  const setup = useLoad(
    loadSetup,
    "Unable to load graph investigation data."
  );

  const accounts =
    setup.data?.accountOptions ?? NO_ACCOUNTS;

  const summary =
    setup.data?.investigationSummary ?? null;

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

  /** Changes with every finished action, so the details table starts afresh. */
  const [runId, setRunId] = useState(0);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [busy, setBusy] =
    useState<RunKind | null>(null);

  const [error, setError] = useState<{
    kind: RunKind;
    message: string;
  } | null>(null);

  // The pick lists default to the first account and to the demo
  // target when nothing valid has been chosen yet.
  const sourceValue = accounts.some(
    (account) => account.accountNumber === source
  )
    ? source
    : (accounts[0]?.accountNumber ?? "");

  const targetValue = accounts.some(
    (account) => account.accountNumber === target
  )
    ? target
    : ((
        accounts.find(
          (account) =>
            account.accountNumber === "FCG-100006"
        ) ?? accounts[1]
      )?.accountNumber ?? "");

  const loading = busy !== null;

  /** The pick lists and actions wait for the account list. */
  const ready = setup.data !== null && setup.error === null;

  const model = useMemo(
    () => investigationModel(result),
    [result]
  );

  const elements = model.elements;

  const shapeKey = useMemo(
    () => layoutKey(model),
    [model]
  );

  const hasNodes = model.nodeCount > 0;

  const visibleSelectedNode =
    result?.nodes.find(
      (node) => node.id === selectedId
    ) ?? null;

  useEffect(
    () => () => {
      activeRun.current = null;
    },
    []
  );

  // One cytoscape instance for the life of the screen; results are
  // swapped in place (see the next effect).
  useEffect(() => {
    const container = graphContainerRef.current;

    if (!container) {
      return;
    }

    const graph = cytoscape({
      container,

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
    });

    graphRef.current = graph;

    graph.on(
      "tap",
      "node",
      (event: cytoscape.EventObject) => {
        setSelectedId(String(event.target.id()));
      }
    );

    graph.on(
      "tap",
      (event: cytoscape.EventObject) => {
        if (event.target === graph) {
          setSelectedId(null);
        }
      }
    );

    return () => {
      graph.destroy();
      graphRef.current = null;
      laidOutRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    graph.json({ elements });

    if (elements.length === 0) {
      laidOutRef.current = null;
      return;
    }

    if (laidOutRef.current !== shapeKey) {
      laidOutRef.current = shapeKey;

      graph
        .layout({
          name: "cose",
          animate: false,
          fit: true,
          padding: 55,
          idealEdgeLength: 125,
          nodeRepulsion: 7200,
        })
        .run();
    }
  }, [elements, shapeKey]);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    graph.elements().unselect();

    if (selectedId) {
      graph.getElementById(selectedId).select();
    }
  }, [selectedId, elements]);

  async function run(kind: RunKind) {
    if (activeRun.current !== null) {
      return;
    }

    if (
      (kind === "path" &&
        (!sourceValue ||
          !targetValue ||
          sourceValue === targetValue)) ||
      (kind === "neighborhood" && !sourceValue)
    ) {
      return;
    }

    const token = {};

    activeRun.current = token;

    setBusy(kind);
    setError(null);

    try {
      const graph =
        kind === "path"
          ? await fetchMoneyFlowPath(
              sourceValue,
              targetValue,
              maxHops
            )
          : kind === "neighborhood"
            ? await fetchAccountNeighborhood(
                sourceValue,
                depth
              )
            : await fetchCircularFlowGraph();

      if (activeRun.current !== token) {
        return;
      }

      setSelectedId(null);
      setResult(graph);
      setRunId((current) => current + 1);
    } catch (actionError) {
      if (activeRun.current !== token) {
        return;
      }

      setError({
        kind,
        message:
          actionError instanceof Error &&
          actionError.message
            ? actionError.message
            : FAILURES[kind],
      });
    } finally {
      if (activeRun.current === token) {
        activeRun.current = null;
        setBusy(null);
      }
    }
  }

  function fitGraph() {
    graphRef.current?.fit(undefined, 45);
  }

  function zoomBy(factor: number) {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    graph.zoom({
      level: graph.zoom() * factor,
      renderedPosition: {
        x: graph.width() / 2,
        y: graph.height() / 2,
      },
    });
  }

  function relayout() {
    const graph = graphRef.current;

    if (!graph || elements.length === 0) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    graph
      .layout({
        name: "cose",
        animate: !reduceMotion,
        animationDuration: 450,
        fit: true,
        padding: 55,
        idealEdgeLength: 125,
        nodeRepulsion: 7200,
      })
      .run();
  }

  /** Selects an account (from the table) and brings it to the middle of the canvas. */
  function chooseNode(id: string) {
    setSelectedId(id);

    const graph = graphRef.current;

    if (graph) {
      graph.center(graph.getElementById(id));
    }
  }

  const counts = visibleSelectedNode
    ? transferCounts(
        result?.edges ?? [],
        visibleSelectedNode.id
      )
    : null;

  const pathBlocked =
    !sourceValue ||
    !targetValue ||
    sourceValue === targetValue;

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
          <Network size={14} aria-hidden="true" />
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

      {setup.error !== null && (
        <ErrorState
          compact
          title="Unable to load the investigation tools"
          message={setup.error}
          onRetry={setup.reload}
        />
      )}

      {setup.error === null &&
        setup.data === null && (
          <LoadingState
            compact
            label="Loading accounts"
          />
        )}

      {setup.data !== null &&
        setup.error === null &&
        accounts.length === 0 && (
          <p className="ui-notice" role="status">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>
              The graph has no accounts yet, so a
              path or neighborhood cannot be traced.
              Circular flow discovery still works.
            </span>
          </p>
        )}

      <div className="investigation-controls">
        <div className="investigation-control">
          <label htmlFor="graph-source">
            Source account
          </label>

          <select
            id="graph-source"
            value={sourceValue}
            disabled={loading || !ready}
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
            value={targetValue}
            disabled={loading || !ready}
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
            disabled={loading || !ready}
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
          disabled={loading || !ready || pathBlocked}
          aria-busy={busy === "path"}
          aria-describedby={
            sourceValue !== "" &&
            sourceValue === targetValue
              ? "graph-path-hint"
              : undefined
          }
          onClick={() =>
            void run("path")
          }
        >
          {busy === "path" ? (
            <RefreshCw
              size={15}
              className="ui-spin"
              aria-hidden="true"
            />
          ) : (
            <Route size={15} aria-hidden="true" />
          )}
          {busy === "path"
            ? "Finding path..."
            : "Find money path"}
        </button>
      </div>

      {sourceValue !== "" &&
        sourceValue === targetValue && (
          <p
            id="graph-path-hint"
            className="ui-gx-hint"
          >
            Choose two different accounts to trace a
            money path.
          </p>
        )}

      <div className="investigation-secondary-controls">
        <div className="depth-control">
          <label htmlFor="graph-depth">
            Neighborhood depth
          </label>

          <select
            id="graph-depth"
            value={depth}
            disabled={loading || !ready}
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
            !sourceValue
          }
          aria-busy={busy === "neighborhood"}
          onClick={() =>
            void run("neighborhood")
          }
        >
          {busy === "neighborhood" ? (
            <RefreshCw
              size={14}
              className="ui-spin"
              aria-hidden="true"
            />
          ) : (
            <LocateFixed
              size={14}
              aria-hidden="true"
            />
          )}
          {busy === "neighborhood"
            ? "Expanding..."
            : "Expand neighborhood"}
        </button>

        <button
          type="button"
          className="secondary-button graph-tool-button"
          disabled={loading || !ready}
          aria-busy={busy === "cycles"}
          onClick={() =>
            void run("cycles")
          }
        >
          {busy === "cycles" ? (
            <RefreshCw
              size={14}
              className="ui-spin"
              aria-hidden="true"
            />
          ) : (
            <CircleDotDashed
              size={14}
              aria-hidden="true"
            />
          )}
          {busy === "cycles"
            ? "Searching..."
            : "Find circular flows"}
        </button>
      </div>

      {error && (
        <div
          className="graph-investigation-error"
          role="alert"
        >
          <AlertTriangle size={15} aria-hidden="true" />

          <span>{error.message}</span>

          <button
            type="button"
            className="secondary-button ui-gx-error-action"
            disabled={loading}
            onClick={() => void run(error.kind)}
          >
            <RefreshCw size={13} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      <div
        className={
          !result ||
          result.nodes.length === 0
            ? "investigation-result investigation-result-empty-state"
            : visibleSelectedNode
              ? "investigation-result investigation-result-with-inspector"
              : "investigation-result investigation-result-full-width"
        }
        aria-busy={loading}
      >
        <div className="investigation-result-main">
          <div className="investigation-result-heading">
            <div role="status">
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
            className="ui-gx-canvas-tools"
            role="group"
            aria-label="Graph view controls"
          >
            <button
              type="button"
              className="secondary-button"
              disabled={!hasNodes}
              onClick={fitGraph}
            >
              <Maximize2 size={13} aria-hidden="true" />
              Fit to view
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={!hasNodes}
              onClick={() => zoomBy(1.25)}
            >
              <ZoomIn size={13} aria-hidden="true" />
              Zoom in
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={!hasNodes}
              onClick={() => zoomBy(0.8)}
            >
              <ZoomOut size={13} aria-hidden="true" />
              Zoom out
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={!hasNodes}
              onClick={relayout}
            >
              <RotateCcw size={13} aria-hidden="true" />
              Re-run layout
            </button>
          </div>

          <div className="ui-gx-canvas-wrap">
            <div
              ref={graphContainerRef}
              role="img"
              aria-label={
                result && hasNodes
                  ? `Graph of ${describeGraph(result)}. The accounts and transfers are listed in the result details table below.`
                  : "Empty graph canvas. Run an investigation to draw a graph."
              }
              className={
                !result ||
                result.nodes.length === 0
                  ? "investigation-graph-canvas investigation-graph-canvas-empty"
                  : "investigation-graph-canvas"
              }
            />

            {!loading && !result && (
              <div className="investigation-graph-placeholder">
                <ScanSearch size={31} aria-hidden="true" />

                <strong>
                  Graph ready
                </strong>

                <span>
                  Find a money path, expand an account
                  neighborhood, or identify circular flows
                  using the controls above.
                </span>
              </div>
            )}

            {!loading &&
              result &&
              result.nodes.length === 0 && (
                <div className="investigation-graph-placeholder">
                  <ScanSearch size={31} aria-hidden="true" />

                  <strong>
                    Nothing to draw
                  </strong>

                  <span>
                    This investigation returned no
                    accounts. Try other accounts, a larger
                    depth or more hops.
                  </span>
                </div>
              )}

            {loading && (
              <div className="ui-gx-overlay">
                <div className="spinner" aria-hidden="true" />
                <strong>Analyzing graph...</strong>
              </div>
            )}
          </div>
        </div>

        <aside
          className="investigation-inspector"
          aria-live="polite"
          aria-label="Selected account"
        >
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

              {counts && (
                <>
                  <InspectorRow
                    label="Outgoing transfers"
                    value={String(counts.outgoing)}
                  />

                  <InspectorRow
                    label="Incoming transfers"
                    value={String(counts.incoming)}
                  />
                </>
              )}
            </>
          ) : (
            <div className="investigation-inspector-empty">
              <Network size={25} aria-hidden="true" />

              <strong>
                Inspect an account
              </strong>

              <span>
                Click a graph node, or choose an
                account in the result details table.
              </span>
            </div>
          )}
        </aside>
      </div>

      {result && result.nodes.length > 0 && (
        <GraphResultDetails
          key={runId}
          graph={result}
          selectedId={visibleSelectedNode?.id ?? null}
          onSelect={chooseNode}
        />
      )}
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
