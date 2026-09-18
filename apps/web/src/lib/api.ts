const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export interface DashboardSummary {
  customers: number;
  accounts: number;
  transactions: number;
  transactionVolume: number;
  openAlerts: number;
  highRiskCustomers: number;
}

export interface AlertView {
  id: string;
  code: string;
  type: string;
  severity: string;
  riskScore: number;
  status: string;
  title: string;
  description: string;
  accountNumber: string | null;
  transactionReference: string | null;
  createdAt: string;
}

export interface TransactionView {
  id: string;
  reference: string;
  sourceAccount: string;
  sourceCustomer: string;
  destinationAccount: string;
  destinationCustomer: string;
  amount: number;
  currency: string;
  occurredAt: string;
  channel: string;
  destinationCountry: string;
  status: string;
}

export interface DashboardOverview {
  summary: DashboardSummary;
  alerts: AlertView[];
  recentTransactions: TransactionView[];
}

export interface GraphNode {
  id: string;
  label: string;
  kind: "CUSTOMER" | "ACCOUNT";
  risk: "LOW" | "MEDIUM" | "HIGH";
  subtitle: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "OWNS" | "TRANSFER";
  label: string;
  amount: number | null;
  currency: string | null;
}

export interface GraphNetwork {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

async function request<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    cache: "no-store",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export function fetchDashboardOverview(
  signal?: AbortSignal
): Promise<DashboardOverview> {
  return request<DashboardOverview>(
    "/api/v1/dashboard/overview",
    signal
  );
}

export function fetchGraphNetwork(
  signal?: AbortSignal
): Promise<GraphNetwork> {
  return request<GraphNetwork>(
    "/api/v1/graph/network",
    signal
  );
}
