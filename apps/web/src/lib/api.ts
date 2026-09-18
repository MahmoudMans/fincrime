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

export interface DetectionRun {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  rulesExecuted: number;
  candidatesFound: number;
  alertsCreated: number;
  alertsExisting: number;
}

export interface InvestigationCase {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  priority: string;
  summary: string;
  assignedTo: string | null;
  primaryAlertId: string;
  primaryAlertCode: string;
  alertRiskScore: number;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options?.headers ?? {}),
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
    {
      signal,
    }
  );
}

export function fetchGraphNetwork(
  signal?: AbortSignal
): Promise<GraphNetwork> {
  return request<GraphNetwork>(
    "/api/v1/graph/network",
    {
      signal,
    }
  );
}

export function fetchDetectionRuns(
  signal?: AbortSignal
): Promise<DetectionRun[]> {
  return request<DetectionRun[]>(
    "/api/v1/detection-runs",
    {
      signal,
    }
  );
}

export function runAmlDetection(): Promise<DetectionRun> {
  return request<DetectionRun>(
    "/api/v1/detection-runs/run",
    {
      method: "POST",
    }
  );
}

export function fetchCases(
  signal?: AbortSignal
): Promise<InvestigationCase[]> {
  return request<InvestigationCase[]>(
    "/api/v1/cases",
    {
      signal,
    }
  );
}

export function openCaseFromAlert(
  alertId: string
): Promise<InvestigationCase> {
  return request<InvestigationCase>(
    `/api/v1/cases/from-alert/${alertId}`,
    {
      method: "POST",
    }
  );
}

export function advanceCase(
  caseId: string
): Promise<InvestigationCase> {
  return request<InvestigationCase>(
    `/api/v1/cases/${caseId}/advance`,
    {
      method: "POST",
    }
  );
}
