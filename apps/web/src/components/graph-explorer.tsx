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

import type {
  GraphNetwork,
  GraphNode,
} from "@/lib/api";

interface GraphExplorerProps {
  network: GraphNetwork;
}

export function GraphExplorer({
  network,
}: GraphExplorerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cytoscapeRef = useRef<cytoscape.Core | null>(null);

  const [selectedNode, setSelectedNode] =
    useState<GraphNode | null>(null);

  const elements = useMemo(
    () => [
      ...network.nodes.map((node) => ({
        data: {
          ...node,
        },
      })),
      ...network.edges.map((edge) => ({
        data: {
          ...edge,
          amountLabel:
            edge.kind === "TRANSFER" && edge.amount !== null
              ? `${edge.amount.toLocaleString()} ${edge.currency ?? ""}`
              : "",
        },
      })),
    ],
    [network]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
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
      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 50,
        idealEdgeLength: 105,
        nodeRepulsion: 7000,
      },
    });

    cytoscapeRef.current = cy;

    cy.on("tap", "node", (event) => {
      const data = event.target.data() as GraphNode;
      setSelectedNode(data);
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        setSelectedNode(null);
      }
    });

    return () => {
      cy.destroy();
      cytoscapeRef.current = null;
    };
  }, [elements]);

  function fitGraph() {
    cytoscapeRef.current?.fit(undefined, 45);
  }

  function resetLayout() {
    const cy = cytoscapeRef.current;

    if (!cy) {
      return;
    }

    cy.layout({
      name: "cose",
      animate: true,
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

        <div className="graph-actions">
          <button
            className="icon-button"
            type="button"
            onClick={focusHighRisk}
            title="Focus high-risk nodes"
          >
            <Focus size={17} />
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={resetLayout}
            title="Reset layout"
          >
            <RotateCcw size={17} />
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={fitGraph}
            title="Fit graph"
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>

      <div className="graph-stats">
        <span>
          <Network size={14} />
          {network.nodes.length} nodes
        </span>
        <span>{network.edges.length} relationships</span>
      </div>

      <div className="graph-layout">
        <div
          ref={containerRef}
          className="graph-canvas"
          aria-label="Financial investigation network"
        />

        <aside className="graph-inspector">
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
              <Network size={26} />
              <strong>Select a node</strong>
              <span>
                Click a customer or account to inspect it.
              </span>
            </div>
          )}
        </aside>
      </div>

      <div className="graph-legend">
        <span>
          <i className="legend-dot customer-dot" />
          Customer
        </span>

        <span>
          <i className="legend-dot account-dot" />
          Account
        </span>

        <span>
          <i className="legend-line transfer-line" />
          Transfer
        </span>

        <span>
          <i className="legend-line ownership-line" />
          Ownership
        </span>
      </div>
    </section>
  );
}
