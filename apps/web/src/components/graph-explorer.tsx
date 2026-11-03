"use client";

import cytoscape from "cytoscape";
import {
  Focus,
  Maximize2,
  Network,
  RotateCcw,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { EmptyState } from "@/components/state-card";
import type { GraphNetwork } from "@/lib/api";
import {
  layoutKey,
  modelNodes,
  networkModel,
  type GraphModel,
} from "@/lib/gx-graph";
import { plural } from "@/lib/list-utils";

interface GraphExplorerProps {
  network: GraphNetwork;
}

export function GraphExplorer({
  network,
}: GraphExplorerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cytoscapeRef = useRef<cytoscape.Core | null>(null);
  /** The shape the current layout was computed for. */
  const laidOutRef = useRef<string | null>(null);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  // The dashboard refreshes in the background and hands over a new
  // network object every time. The graph is compared by content, so
  // an unchanged network keeps the same instance, layout, zoom and
  // selection.
  const modelJson = useMemo(
    () => JSON.stringify(networkModel(network)),
    [network]
  );

  const model = useMemo(
    () => JSON.parse(modelJson) as GraphModel,
    [modelJson]
  );

  const elements = model.elements;

  const shapeKey = useMemo(
    () => layoutKey(model),
    [model]
  );

  const nodes = useMemo(
    () => modelNodes(network),
    [network]
  );

  const hasGraph = model.nodeCount > 0;

  const selectedNode =
    nodes.find((node) => node.id === selectedId) ??
    null;

  const highRiskCount = nodes.filter(
    (node) => node.risk === "HIGH"
  ).length;

  // Created once while there is something to draw, destroyed on
  // unmount (or when the network becomes empty).
  useEffect(() => {
    const container = containerRef.current;

    if (!hasGraph || !container) {
      return;
    }

    const cy = cytoscape({
      container,
      minZoom: 0.35,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: "node",
          style: {
            width: 52,
            height: 52,
            label: "data(label)",
            "font-size": 9,
            "font-weight": 600,
            color: "#dbe7f6",
            "text-valign": "bottom",
            "text-margin-y": 8,
            "text-wrap": "wrap",
            "text-max-width": "100px",
            "background-color": "#2878ff",
            "border-width": 2,
            "border-color": "#0b1523",
            "overlay-opacity": 0,
          },
        },
        {
          selector: "node[kind = 'CUSTOMER']",
          style: {
            shape: "diamond",
            width: 60,
            height: 60,
            "background-color": "#8d6bff",
          },
        },
        {
          selector: "node[kind = 'ACCOUNT']",
          style: {
            shape: "ellipse",
          },
        },
        {
          selector: "node[risk = 'HIGH']",
          style: {
            "border-color": "#ff5d6c",
            "border-width": 4,
          },
        },
        {
          selector: "node[risk = 'MEDIUM']",
          style: {
            "border-color": "#f6b84a",
            "border-width": 3,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#ffffff",
            "border-width": 5,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#33465f",
            "target-arrow-color": "#33465f",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.75,
            opacity: 0.7,
          },
        },
        {
          selector: "edge[kind = 'TRANSFER']",
          style: {
            width: 2.4,
            "line-color": "#23c4b8",
            "target-arrow-color": "#23c4b8",
            label: "data(amountLabel)",
            "font-size": 7,
            color: "#7f95ad",
            "text-rotation": "autorotate",
            "text-background-color": "#09111d",
            "text-background-opacity": 0.8,
            "text-background-padding": "3px",
          },
        },
        {
          selector: "edge[kind = 'OWNS']",
          style: {
            "line-style": "dashed",
            opacity: 0.42,
          },
        },
      ],
    });

    cytoscapeRef.current = cy;

    cy.on("tap", "node", (event: cytoscape.EventObject) => {
      setSelectedId(String(event.target.id()));
    });

    cy.on("tap", (event: cytoscape.EventObject) => {
      if (event.target === cy) {
        setSelectedId(null);
      }
    });

    return () => {
      cy.destroy();
      cytoscapeRef.current = null;
      laidOutRef.current = null;
    };
  }, [hasGraph]);

  // New and changed entities are applied in place; only a different
  // set of nodes and edges gets a fresh layout.
  useEffect(() => {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    cy.json({ elements });

    if (laidOutRef.current !== shapeKey) {
      laidOutRef.current = shapeKey;

      cy.layout({
        name: "cose",
        animate: false,
        fit: true,
        padding: 50,
        idealEdgeLength: 105,
        nodeRepulsion: 7000,
      }).run();
    }
  }, [elements, shapeKey, hasGraph]);

  useEffect(() => {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    cy.elements().unselect();

    if (selectedId) {
      cy.getElementById(selectedId).select();
    }
  }, [selectedId, elements, hasGraph]);

  function fitGraph() {
    cytoscapeRef.current?.fit(undefined, 45);
  }

  function resetLayout() {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    cy.layout({
      name: "cose",
      animate: !reduceMotion,
      animationDuration: 450,
      fit: true,
      padding: 50,
      idealEdgeLength: 105,
      nodeRepulsion: 7000,
    }).run();
  }

  function focusHighRisk() {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    const highRiskNodes = cy.nodes("[risk = 'HIGH']");

    if (highRiskNodes.length > 0) {
      cy.fit(highRiskNodes, 90);
    }
  }

  /** Keyboard route to a node: select it, show it and centre the canvas on it. */
  function chooseNode(id: string) {
    setSelectedId(id === "" ? null : id);

    const cy = cytoscapeRef.current;

    if (cy && id !== "") {
      cy.center(cy.getElementById(id));
    }
  }

  return (
    <section className="panel graph-panel">
      <div className="panel-heading graph-heading">
        <div>
          <div className="eyebrow">
            Network intelligence
          </div>
          <h2>Transaction graph</h2>
          <p>
            Explore customer ownership and money movement
            relationships.
          </p>
        </div>

        <div
          className="graph-actions"
          role="group"
          aria-label="Graph view controls"
        >
          <button
            className="icon-button"
            type="button"
            onClick={focusHighRisk}
            disabled={!hasGraph || highRiskCount === 0}
            aria-label="Focus high-risk nodes"
            title={
              highRiskCount === 0
                ? "No high-risk nodes in this graph"
                : "Focus high-risk nodes"
            }
          >
            <Focus size={17} aria-hidden="true" />
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={resetLayout}
            disabled={!hasGraph}
            aria-label="Reset layout"
            title="Reset layout"
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={fitGraph}
            disabled={!hasGraph}
            aria-label="Fit graph to view"
            title="Fit graph"
          >
            <Maximize2 size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="graph-stats">
        <span>
          <Network size={14} aria-hidden="true" />
          {model.nodeCount}{" "}
          {plural(model.nodeCount, "node")}
        </span>
        <span>
          {model.edgeCount}{" "}
          {plural(
            model.edgeCount,
            "relationship"
          )}
        </span>

        {model.skipped > 0 && (
          <span
            title="Duplicate entries and relationships that point at missing entities are not drawn."
          >
            {model.skipped}{" "}
            {plural(model.skipped, "entry", "entries")}{" "}
            not drawn
          </span>
        )}

        {hasGraph && (
          <label className="ui-gx-picker">
            <span className="ui-visually-hidden">
              Inspect an entity
            </span>

            <select
              className="ui-select"
              value={selectedNode?.id ?? ""}
              onChange={(event) =>
                chooseNode(event.target.value)
              }
            >
              <option value="">
                Inspect an entity...
              </option>

              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                  {" · "}
                  {node.kind === "CUSTOMER"
                    ? "Customer"
                    : "Account"}
                  {" · "}
                  {node.risk} risk
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {hasGraph ? (
        <div className="graph-layout">
          <div
            ref={containerRef}
            className="graph-canvas"
            role="img"
            aria-label={`Financial investigation network with ${model.nodeCount} ${plural(model.nodeCount, "node")} and ${model.edgeCount} ${plural(model.edgeCount, "relationship")}. Use the Inspect an entity list to read about a node without the mouse.`}
          />

          <aside
            className={selectedNode ? "graph-inspector" : "graph-inspector graph-inspector-collapsed"}
            aria-live="polite"
            aria-label="Selected entity"
          >
            {selectedNode ? (
              <>
                <div className="eyebrow">Selected entity</div>

                <div className="entity-kind">
                  {selectedNode.kind}
                </div>

                <h3>{selectedNode.label}</h3>

                <p>{selectedNode.subtitle}</p>

                <div className="inspector-row">
                  <span>Risk tier</span>
                  <strong
                    className={`risk-text risk-${selectedNode.risk.toLowerCase()}`}
                  >
                    {selectedNode.risk}
                  </strong>
                </div>

                <div className="inspector-row">
                  <span>Graph ID</span>
                  <strong className="mono truncate">
                    {selectedNode.id}
                  </strong>
                </div>
              </>
            ) : (
              <div className="inspector-empty">
                <Network size={26} aria-hidden="true" />
                <strong>Select a node</strong>
                <span>
                  Click a customer or account to inspect it,
                  or pick one from the list above.
                </span>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <EmptyState
          icon={
            <Network size={24} aria-hidden="true" />
          }
          title="The network graph is empty"
          message="There are no customers or accounts to draw yet. Ingest data or run detection, then refresh the dashboard."
        />
      )}

      <div className="graph-legend">
        <span>
          <i className="legend-dot customer-dot" />
          Customer (diamond)
        </span>

        <span>
          <i className="legend-dot account-dot" />
          Account (circle)
        </span>

        <span>
          <i className="legend-line transfer-line" />
          Transfer
        </span>

        <span>
          <i className="legend-line ownership-line" />
          Ownership
        </span>

        <span>Red outline: high risk</span>

        <span>Amber outline: medium risk</span>
      </div>
    </section>
  );
}
