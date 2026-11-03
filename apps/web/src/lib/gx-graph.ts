import type {
  GraphNetwork,
  GraphNode,
  InvestigationGraph,
  InvestigationGraphEdge,
  InvestigationGraphNode,
} from "@/lib/api";
import type { CsvColumn } from "@/lib/csv";
import { plural, matchesQuery } from "@/lib/list-utils";

/**
 * Helpers for the two cytoscape screens: turning API graphs into
 * element lists the library accepts, and the text and CSV views of a
 * graph that keyboard and screen reader users work with.
 */

export interface GraphElement {
  data: {
    id: string;
    [key: string]: string | number | null;
  };
}

export interface GraphModel {
  elements: GraphElement[];
  nodeCount: number;
  edgeCount: number;
  /** Entries left out: duplicate ids and edges to missing nodes. */
  skipped: number;
}

export const EMPTY_MODEL: GraphModel = {
  elements: [],
  nodeCount: 0,
  edgeCount: 0,
  skipped: 0,
};

/**
 * Cytoscape throws on a duplicate id and on an edge whose end point
 * is not in the graph. One bad row would blank the whole view, so
 * those rows are dropped and counted instead.
 */
function assemble(
  nodes: readonly GraphElement[],
  edges: readonly GraphElement[]
): GraphModel {
  const seen = new Set<string>();
  const elements: GraphElement[] = [];
  let skipped = 0;
  let nodeCount = 0;

  for (const node of nodes) {
    if (seen.has(node.data.id)) {
      skipped += 1;
      continue;
    }

    seen.add(node.data.id);
    elements.push(node);
    nodeCount += 1;
  }

  const nodeIds = new Set(seen);
  let edgeCount = 0;

  for (const edge of edges) {
    if (
      seen.has(edge.data.id) ||
      !nodeIds.has(String(edge.data.source)) ||
      !nodeIds.has(String(edge.data.target))
    ) {
      skipped += 1;
      continue;
    }

    seen.add(edge.data.id);
    elements.push(edge);
    edgeCount += 1;
  }

  return { elements, nodeCount, edgeCount, skipped };
}

/** The overview network: customers and accounts, owns and transfer edges. */
export function networkModel(
  network: GraphNetwork
): GraphModel {
  return assemble(
    network.nodes.map((node) => ({
      data: { ...node },
    })),
    network.edges.map((edge) => ({
      data: {
        ...edge,
        amountLabel:
          edge.kind === "TRANSFER" && edge.amount !== null
            ? `${edge.amount.toLocaleString()} ${edge.currency ?? ""}`.trim()
            : "",
      },
    }))
  );
}

/** One result of the graph investigation workbench. */
export function investigationModel(
  graph: InvestigationGraph | null
): GraphModel {
  if (!graph) {
    return EMPTY_MODEL;
  }

  return assemble(
    graph.nodes.map((node) => ({
      data: { ...node, label: node.accountNumber },
    })),
    graph.edges.map((edge) => ({
      data: {
        ...edge,
        amountLabel: `${edge.amount.toLocaleString()} ${edge.currency}`,
      },
    }))
  );
}

/** Identifies the shape of a graph; a new layout is only needed when it changes. */
export function layoutKey(model: GraphModel): string {
  return model.elements
    .map((element) => element.data.id)
    .join("\u0001");
}

/** The nodes of a model, for lists and pickers. */
export function modelNodes(
  network: GraphNetwork
): GraphNode[] {
  const seen = new Set<string>();

  return network.nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }

    seen.add(node.id);

    return true;
  });
}

/** "4 accounts and 3 transfers, 3 hops" for screen readers and captions. */
export function describeGraph(
  graph: Pick<
    InvestigationGraph,
    "nodes" | "edges" | "hopCount" | "cycleCount"
  >
): string {
  const parts = [
    `${graph.nodes.length} ${plural(graph.nodes.length, "account")} and ${graph.edges.length} ${plural(graph.edges.length, "transfer")}`,
  ];

  if (graph.hopCount > 0) {
    parts.push(
      `${graph.hopCount} ${plural(graph.hopCount, "hop")}`
    );
  }

  if (graph.cycleCount > 0) {
    parts.push(
      `${graph.cycleCount} ${plural(graph.cycleCount, "cycle")}`
    );
  }

  return parts.join(", ");
}

/** Node id to account number, so that edges can be read without ids. */
export function accountLabels(
  nodes: readonly InvestigationGraphNode[]
): Map<string, string> {
  return new Map(
    nodes.map((node) => [node.id, node.accountNumber])
  );
}

export function filterGraphNodes(
  nodes: readonly InvestigationGraphNode[],
  query: string,
  risk: string
): InvestigationGraphNode[] {
  return nodes.filter(
    (node) =>
      (risk === "ALL" || node.riskTier.toUpperCase() === risk) &&
      matchesQuery(query, [
        node.accountNumber,
        node.ownerName,
        node.countryCode,
        node.riskTier,
        node.status,
      ])
  );
}

export function filterGraphEdges(
  edges: readonly InvestigationGraphEdge[],
  labels: ReadonlyMap<string, string>,
  query: string
): InvestigationGraphEdge[] {
  return edges.filter((edge) =>
    matchesQuery(query, [
      edge.reference,
      labels.get(edge.source) ?? edge.source,
      labels.get(edge.target) ?? edge.target,
      edge.amount,
      edge.currency,
    ])
  );
}

export const GRAPH_NODE_COLUMNS: readonly CsvColumn<InvestigationGraphNode>[] =
  [
    {
      header: "Account number",
      value: (row) => row.accountNumber,
    },
    { header: "Owner", value: (row) => row.ownerName },
    { header: "Country", value: (row) => row.countryCode },
    { header: "Risk tier", value: (row) => row.riskTier },
    { header: "Status", value: (row) => row.status },
    { header: "Node ID", value: (row) => row.id },
  ];

export function graphEdgeColumns(
  labels: ReadonlyMap<string, string>
): CsvColumn<InvestigationGraphEdge>[] {
  return [
    { header: "Reference", value: (row) => row.reference },
    {
      header: "From account",
      value: (row) => labels.get(row.source) ?? row.source,
    },
    {
      header: "To account",
      value: (row) => labels.get(row.target) ?? row.target,
    },
    { header: "Amount", value: (row) => row.amount },
    { header: "Currency", value: (row) => row.currency },
    { header: "Edge ID", value: (row) => row.id },
    { header: "From node ID", value: (row) => row.source },
    { header: "To node ID", value: (row) => row.target },
  ];
}

/** Counts of transfers into and out of one node of a result. */
export function transferCounts(
  edges: readonly InvestigationGraphEdge[],
  nodeId: string
) {
  return {
    outgoing: edges.filter((edge) => edge.source === nodeId)
      .length,
    incoming: edges.filter((edge) => edge.target === nodeId)
      .length,
  };
}
