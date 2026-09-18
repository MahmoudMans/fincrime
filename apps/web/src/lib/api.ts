const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

let apiAccessToken: string | null = null;

export function setApiAccessToken(
  token: string | null
) {
  apiAccessToken = token;
}

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
      ...(apiAccessToken
        ? {
            Authorization:
              `Bearer ${apiAccessToken}`,
          }
        : {}),
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

export interface CustomerSummary {
  id: string;
  externalId: string;
  fullName: string;
  countryCode: string;
  riskTier: string;
  accountCount: number;
  transactionCount: number;
  openAlerts: number;
  totalInbound: number;
  totalOutbound: number;
  createdAt: string;
}

export interface AccountSummary {
  id: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  balance: number;
  status: string;
  customerId: string;
  customerName: string;
  customerRiskTier: string;
  transactionCount: number;
  openAlerts: number;
  totalInbound: number;
  totalOutbound: number;
  createdAt: string;
}

export interface CounterpartyView {
  customerId: string;
  fullName: string;
  countryCode: string;
  riskTier: string;
  transactionCount: number;
  volume: number;
}

export interface AlertSnapshot {
  id: string;
  code: string;
  type: string;
  severity: string;
  riskScore: number;
  status: string;
  title: string;
  createdAt: string;
}

export interface TransactionExplorerItem {
  id: string;
  reference: string;
  sourceAccountId: string;
  sourceAccount: string;
  sourceCustomer: string;
  destinationAccountId: string;
  destinationAccount: string;
  destinationCustomer: string;
  amount: number;
  currency: string;
  occurredAt: string;
  channel: string;
  destinationCountry: string;
  status: string;
  riskScore: number;
  riskReasons: string[];
}

export interface Customer360 {
  summary: CustomerSummary;
  accounts: AccountSummary[];
  counterparties: CounterpartyView[];
  recentTransactions: TransactionExplorerItem[];
  alerts: AlertSnapshot[];
}

export interface AccountOwner {
  id: string;
  externalId: string;
  fullName: string;
  countryCode: string;
  riskTier: string;
}

export interface Account360 {
  summary: AccountSummary;
  owner: AccountOwner;
  counterparties: CounterpartyView[];
  recentTransactions: TransactionExplorerItem[];
  alerts: AlertSnapshot[];
}

function buildQuery(
  values: Record<string, string | number | undefined>
) {
  const parameters = new URLSearchParams();

  Object.entries(values).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== ""
      ) {
        parameters.set(
          key,
          String(value)
        );
      }
    }
  );

  const result = parameters.toString();

  return result
    ? `?${result}`
    : "";
}

export function fetchCustomers(
  query = "",
  signal?: AbortSignal
): Promise<CustomerSummary[]> {
  return request<CustomerSummary[]>(
    `/api/v1/intelligence/customers${buildQuery({
      query,
    })}`,
    {
      signal,
    }
  );
}

export function fetchCustomer360(
  customerId: string,
  signal?: AbortSignal
): Promise<Customer360> {
  return request<Customer360>(
    `/api/v1/intelligence/customers/${customerId}`,
    {
      signal,
    }
  );
}

export function fetchAccounts(
  query = "",
  signal?: AbortSignal
): Promise<AccountSummary[]> {
  return request<AccountSummary[]>(
    `/api/v1/intelligence/accounts${buildQuery({
      query,
    })}`,
    {
      signal,
    }
  );
}

export function fetchAccount360(
  accountId: string,
  signal?: AbortSignal
): Promise<Account360> {
  return request<Account360>(
    `/api/v1/intelligence/accounts/${accountId}`,
    {
      signal,
    }
  );
}

export function fetchTransactionExplorer(
  filters: {
    query?: string;
    channel?: string;
    status?: string;
    minAmount?: string;
    maxAmount?: string;
  },
  signal?: AbortSignal
): Promise<TransactionExplorerItem[]> {
  return request<TransactionExplorerItem[]>(
    `/api/v1/intelligence/transactions${buildQuery(
      filters
    )}`,
    {
      signal,
    }
  );
}

export interface GraphInvestigationSummary {
  accounts: number;
  transferRelationships: number;
  highRiskAccounts: number;
  crossBorderTransfers: number;
  circularFlows: number;
}

export interface GraphAccountOption {
  accountNumber: string;
  ownerName: string;
  countryCode: string;
  riskTier: string;
  status: string;
}

export interface InvestigationGraphNode {
  id: string;
  accountNumber: string;
  riskTier: string;
  ownerName: string;
  countryCode: string;
  status: string;
}

export interface InvestigationGraphEdge {
  id: string;
  source: string;
  target: string;
  reference: string;
  amount: number;
  currency: string;
}

export interface InvestigationGraph {
  mode: string;
  headline: string;
  description: string;
  found: boolean;
  hopCount: number;
  cycleCount: number;
  nodes: InvestigationGraphNode[];
  edges: InvestigationGraphEdge[];
}

export function fetchGraphInvestigationSummary(
  signal?: AbortSignal
): Promise<GraphInvestigationSummary> {
  return request<GraphInvestigationSummary>(
    "/api/v1/graph-investigation/summary",
    {
      signal,
    }
  );
}

export function fetchGraphInvestigationAccounts(
  signal?: AbortSignal
): Promise<GraphAccountOption[]> {
  return request<GraphAccountOption[]>(
    "/api/v1/graph-investigation/accounts",
    {
      signal,
    }
  );
}

export function fetchMoneyFlowPath(
  source: string,
  target: string,
  maxHops: number
): Promise<InvestigationGraph> {
  return request<InvestigationGraph>(
    `/api/v1/graph-investigation/path${buildQuery({
      source,
      target,
      maxHops,
    })}`
  );
}

export function fetchAccountNeighborhood(
  account: string,
  depth: number
): Promise<InvestigationGraph> {
  return request<InvestigationGraph>(
    `/api/v1/graph-investigation/neighborhood${buildQuery({
      account,
      depth,
    })}`
  );
}

export function fetchCircularFlowGraph():
Promise<InvestigationGraph> {
  return request<InvestigationGraph>(
    "/api/v1/graph-investigation/cycles"
  );
}

export interface CaseWorkspacePrimaryAlert {
  id: string;
  code: string;
  type: string;
  severity: string;
  riskScore: number;
  status: string;
  title: string;
  accountNumber: string | null;
  transactionReference: string | null;
}

export interface CaseWorkspaceNote {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CaseWorkspaceEvidence {
  id: string;
  evidenceType: string;
  referenceType: string;
  referenceId: string;
  title: string;
  description: string;
  snapshotText: string;
  createdAt: string;
}

export interface CaseWorkspaceEvent {
  id: string;
  eventType: string;
  description: string;
  actorName: string;
  createdAt: string;
}

export interface CaseWorkspaceView {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  priority: string;
  summary: string;
  assignedTo: string | null;
  disposition: string | null;
  resolutionSummary: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  primaryAlert: CaseWorkspacePrimaryAlert;
  notes: CaseWorkspaceNote[];
  evidence: CaseWorkspaceEvidence[];
  timeline: CaseWorkspaceEvent[];
}

export function fetchCaseWorkspace(
  caseId: string,
  signal?: AbortSignal
): Promise<CaseWorkspaceView> {
  return request<CaseWorkspaceView>(
    `/api/v1/case-workspace/${caseId}`,
    {
      signal,
    }
  );
}

export function addCaseNote(
  caseId: string,
  author: string,
  body: string
): Promise<CaseWorkspaceView> {
  return request<CaseWorkspaceView>(
    `/api/v1/case-workspace/${caseId}/notes${buildQuery({
      author,
      body,
    })}`,
    {
      method: "POST",
    }
  );
}

export function assignCase(
  caseId: string,
  assignee: string,
  actor: string
): Promise<CaseWorkspaceView> {
  return request<CaseWorkspaceView>(
    `/api/v1/case-workspace/${caseId}/assign${buildQuery({
      assignee,
      actor,
    })}`,
    {
      method: "POST",
    }
  );
}

export function attachCaseAlertEvidence(
  caseId: string,
  alertId: string,
  actor: string
): Promise<CaseWorkspaceView> {
  return request<CaseWorkspaceView>(
    `/api/v1/case-workspace/${caseId}/evidence/alerts/${alertId}${buildQuery({
      actor,
    })}`,
    {
      method: "POST",
    }
  );
}

export function attachCaseTransactionEvidence(
  caseId: string,
  reference: string,
  actor: string
): Promise<CaseWorkspaceView> {
  return request<CaseWorkspaceView>(
    `/api/v1/case-workspace/${caseId}/evidence/transactions/${reference}${buildQuery({
      actor,
    })}`,
    {
      method: "POST",
    }
  );
}

export function attachCaseCircularGraphEvidence(
  caseId: string,
  actor: string
): Promise<CaseWorkspaceView> {
  return request<CaseWorkspaceView>(
    `/api/v1/case-workspace/${caseId}/evidence/graph/circular-flows${buildQuery({
      actor,
    })}`,
    {
      method: "POST",
    }
  );
}

export function resolveCaseWorkspace(
  caseId: string,
  disposition: string,
  summary: string,
  actor: string
): Promise<CaseWorkspaceView> {
  return request<CaseWorkspaceView>(
    `/api/v1/case-workspace/${caseId}/resolve${buildQuery({
      disposition,
      summary,
      actor,
    })}`,
    {
      method: "POST",
    }
  );
}

export interface AuthLoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  username: string;
  displayName: string;
  roles: string[];
}

export interface AuthUser {
  username: string;
  displayName: string;
  roles: string[];
  expiresAt: string;
}

export interface SecurityAuditEvent {
  id: string;
  username: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  detail: string;
  occurredAt: string;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<AuthLoginResponse> {
  const body =
    new URLSearchParams({
      username,
      password,
    });

  const response = await fetch(
    `${API_BASE_URL}/api/v1/auth/login`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Invalid username or password."
        : `Authentication failed: ${response.status}`
    );
  }

  return response.json() as Promise<AuthLoginResponse>;
}

export function fetchCurrentUser(
  signal?: AbortSignal
): Promise<AuthUser> {
  return request<AuthUser>(
    "/api/v1/auth/me",
    {
      signal,
    }
  );
}

export function fetchSecurityAudit(
  signal?: AbortSignal
): Promise<SecurityAuditEvent[]> {
  return request<SecurityAuditEvent[]>(
    "/api/v1/security/audit",
    {
      signal,
    }
  );
}

export interface DetectionRule {
  id: string;
  ruleKey: string;
  displayName: string;
  description: string;
  enabled: boolean;
  severity: string;
  riskScore: number;
  primaryAmountThreshold: number | null;
  secondaryAmountThreshold: number | null;
  aggregateAmountThreshold: number | null;
  minimumOccurrences: number | null;
  windowMinutes: number | null;
  version: number;
  updatedBy: string;
  updatedAt: string;
}

export interface DetectionRuleChange {
  id: string;
  ruleKey: string;
  version: number;
  changedBy: string;
  changeSummary: string;
  enabled: boolean;
  severity: string;
  riskScore: number;
  primaryAmountThreshold: number | null;
  secondaryAmountThreshold: number | null;
  aggregateAmountThreshold: number | null;
  minimumOccurrences: number | null;
  windowMinutes: number | null;
  changedAt: string;
}

export function fetchDetectionRules(
  signal?: AbortSignal
): Promise<DetectionRule[]> {
  return request<DetectionRule[]>(
    "/api/v1/detection-rules",
    {
      signal,
    }
  );
}

export function fetchDetectionRuleHistory(
  ruleKey: string,
  signal?: AbortSignal
): Promise<DetectionRuleChange[]> {
  return request<DetectionRuleChange[]>(
    `/api/v1/detection-rules/${encodeURIComponent(
      ruleKey
    )}/history`,
    {
      signal,
    }
  );
}

export function updateDetectionRule(
  ruleKey: string,
  values: {
    enabled: boolean;
    severity: string;
    riskScore: number;
    primaryAmountThreshold?: number | null;
    secondaryAmountThreshold?: number | null;
    aggregateAmountThreshold?: number | null;
    minimumOccurrences?: number | null;
    windowMinutes?: number | null;
    changeSummary: string;
  }
): Promise<DetectionRule> {
  return request<DetectionRule>(
    `/api/v1/detection-rules/${encodeURIComponent(
      ruleKey
    )}${buildQuery({
      enabled: String(values.enabled),
      severity: values.severity,
      riskScore: values.riskScore,
      primaryAmountThreshold:
        values.primaryAmountThreshold ??
        undefined,
      secondaryAmountThreshold:
        values.secondaryAmountThreshold ??
        undefined,
      aggregateAmountThreshold:
        values.aggregateAmountThreshold ??
        undefined,
      minimumOccurrences:
        values.minimumOccurrences ??
        undefined,
      windowMinutes:
        values.windowMinutes ??
        undefined,
      changeSummary:
        values.changeSummary,
    })}`,
    {
      method: "POST",
    }
  );
}

export interface CaseReportDownload {
  blob: Blob;
  filename: string;
}

export async function downloadCaseReport(
  caseId: string
): Promise<CaseReportDownload> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/case-reports/${encodeURIComponent(
      caseId
    )}.pdf`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/pdf",
        ...(apiAccessToken
          ? {
              Authorization:
                `Bearer ${apiAccessToken}`,
            }
          : {}),
      },
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Senior Analyst or Administrator access is required to export investigation reports."
      );
    }

    if (response.status === 401) {
      throw new Error(
        "Authentication is required to export investigation reports."
      );
    }

    throw new Error(
      `Case report export failed: ${response.status}`
    );
  }

  const disposition =
    response.headers.get(
      "Content-Disposition"
    ) ?? "";

  const match =
    /filename="?([^";]+)"?/i.exec(
      disposition
    );

  return {
    blob: await response.blob(),
    filename:
      match?.[1] ??
      `fincrime-case-${caseId}.pdf`,
  };
}

export interface WatchlistEntry {
  id: string;
  listKey: string;
  fullName: string;
  aliases: string;
  countryCode: string | null;
  category: string;
  riskLevel: string;
  sourceName: string;
  sourceReference: string;
  active: boolean;
  updatedAt: string;
}

export interface WatchlistScreeningRun {
  id: string;
  status: string;
  customersScanned: number;
  entriesScanned: number;
  hitsFound: number;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
}

export interface WatchlistScreeningHit {
  id: string;
  runId: string;
  customerId: string;
  customerName: string;
  customerCountryCode: string;
  customerRiskTier: string;
  watchlistEntryId: string;
  listKey: string;
  watchlistName: string;
  watchlistCountryCode: string | null;
  category: string;
  watchlistRiskLevel: string;
  sourceName: string;
  sourceReference: string;
  matchedName: string;
  nameScore: number;
  countryMatch: boolean;
  matchScore: number;
  status: string;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export function fetchWatchlistEntries(
  signal?: AbortSignal
): Promise<WatchlistEntry[]> {
  return request<WatchlistEntry[]>(
    "/api/v1/watchlist/entries",
    {
      signal,
    }
  );
}

export function fetchWatchlistRuns(
  signal?: AbortSignal
): Promise<WatchlistScreeningRun[]> {
  return request<WatchlistScreeningRun[]>(
    "/api/v1/watchlist/runs",
    {
      signal,
    }
  );
}

export function fetchWatchlistHits(
  runId: string,
  signal?: AbortSignal
): Promise<WatchlistScreeningHit[]> {
  return request<WatchlistScreeningHit[]>(
    `/api/v1/watchlist/runs/${encodeURIComponent(
      runId
    )}/hits`,
    {
      signal,
    }
  );
}

export function runWatchlistScreening():
Promise<WatchlistScreeningRun> {
  return request<WatchlistScreeningRun>(
    "/api/v1/watchlist/runs",
    {
      method: "POST",
    }
  );
}

export function reviewWatchlistHit(
  hitId: string,
  decision: "CLEARED" | "ESCALATED",
  note: string
): Promise<WatchlistScreeningHit> {
  const body =
    new URLSearchParams({
      decision,
      note,
    });

  return request<WatchlistScreeningHit>(
    `/api/v1/watchlist/hits/${encodeURIComponent(
      hitId
    )}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );
}

export interface CustomerRiskAssessment {
  id: string;
  batchId: string;
  customerId: string;
  customerName: string;
  countryCode: string;
  customerRiskTier: string;
  score: number;
  riskBand: string;
  modelVersion: string;
  generatedBy: string;
  generatedAt: string;
}

export interface CustomerRiskFactor {
  id: string;
  factorKey: string;
  label: string;
  rawValue: string;
  contribution: number;
  explanation: string;
}

export interface CustomerRiskBatch {
  batchId: string;
  modelVersion: string;
  generatedAt: string;
  customerCount: number;
  lowCount: number;
  mediumCount: number;
  highCount: number;
  criticalCount: number;
  assessments: CustomerRiskAssessment[];
}

export function fetchCustomerRiskAssessments(
  signal?: AbortSignal
): Promise<CustomerRiskAssessment[]> {
  return request<CustomerRiskAssessment[]>(
    "/api/v1/customer-risk/assessments",
    {
      signal,
    }
  );
}

export function fetchCustomerRiskFactors(
  assessmentId: string,
  signal?: AbortSignal
): Promise<CustomerRiskFactor[]> {
  return request<CustomerRiskFactor[]>(
    `/api/v1/customer-risk/assessments/${encodeURIComponent(
      assessmentId
    )}/factors`,
    {
      signal,
    }
  );
}

export function fetchCustomerRiskHistory(
  customerId: string,
  signal?: AbortSignal
): Promise<CustomerRiskAssessment[]> {
  return request<CustomerRiskAssessment[]>(
    `/api/v1/customer-risk/customers/${encodeURIComponent(
      customerId
    )}/history`,
    {
      signal,
    }
  );
}

export function recalculateCustomerRisk():
Promise<CustomerRiskBatch> {
  return request<CustomerRiskBatch>(
    "/api/v1/customer-risk/recalculate",
    {
      method: "POST",
    }
  );
}

export interface ComplianceOverview {
  totalAlerts: number;
  activeAlerts: number;
  totalCases: number;
  openCases: number;
  pendingWatchlistHits: number;
  enabledAmlRules: number;
  criticalRiskCustomers: number;
  highRiskCustomers: number;
  slaBreaches: number;
  reportsExported: number;
  alertSeverityDistribution: Record<string, number>;
  casePriorityDistribution: Record<string, number>;
  riskBandDistribution: Record<string, number>;
  watchlistStatusDistribution: Record<string, number>;
}

export interface ComplianceSlaPolicy {
  priority: string;
  targetHours: number;
  active: boolean;
  description: string;
  updatedAt: string;
}

export interface ComplianceCaseSla {
  id: string;
  caseId: string;
  caseNumber: string;
  priority: string;
  caseStatus: string;
  targetHours: number;
  elapsedHours: number;
  breachHours: number;
  slaState: string;
  calculatedAt: string;
}

export interface ComplianceSlaRecalculation {
  calculatedAt: string;
  casesEvaluated: number;
  withinSlaCount: number;
  breachCount: number;
  closedCount: number;
}

export interface ComplianceActivity {
  id: string;
  username: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  createdAt: string;
}

export function fetchComplianceOverview(
  signal?: AbortSignal
): Promise<ComplianceOverview> {
  return request<ComplianceOverview>(
    "/api/v1/compliance/overview",
    {
      signal,
    }
  );
}

export function fetchComplianceSlaPolicies(
  signal?: AbortSignal
): Promise<ComplianceSlaPolicy[]> {
  return request<ComplianceSlaPolicy[]>(
    "/api/v1/compliance/sla/policies",
    {
      signal,
    }
  );
}

export function fetchComplianceCaseSla(
  signal?: AbortSignal
): Promise<ComplianceCaseSla[]> {
  return request<ComplianceCaseSla[]>(
    "/api/v1/compliance/sla/cases",
    {
      signal,
    }
  );
}

export function fetchComplianceActivity(
  signal?: AbortSignal
): Promise<ComplianceActivity[]> {
  return request<ComplianceActivity[]>(
    "/api/v1/compliance/activity",
    {
      signal,
    }
  );
}

export function recalculateComplianceSla():
Promise<ComplianceSlaRecalculation> {
  return request<ComplianceSlaRecalculation>(
    "/api/v1/compliance/sla/recalculate",
    {
      method: "POST",
    }
  );
}

export interface SecurityAuditLedgerStatus {
  sourceEventCount: number;
  ledgerEntryCount: number;
  uncoveredEventCount: number;
  chainValid: boolean;
  complete: boolean;
  integrityValid: boolean;
  rootHash: string;
  verifiedAt: string;
}

export interface SecurityAuditLedgerRefresh {
  appendedCount: number;
  status: SecurityAuditLedgerStatus;
}

export interface SecurityAuditLedgerVerification {
  id: string;
  verifiedAt: string;
  sourceEventCount: number;
  ledgerEntryCount: number;
  uncoveredEventCount: number;
  appendedCount: number;
  chainValid: boolean;
  complete: boolean;
  integrityValid: boolean;
  rootHash: string;
  detail: string;
}

export function fetchSecurityAuditLedgerStatus(
  signal?: AbortSignal
): Promise<SecurityAuditLedgerStatus> {
  return request<SecurityAuditLedgerStatus>(
    "/api/v1/security-ledger/status",
    {
      signal,
    }
  );
}

export function fetchSecurityAuditLedgerHistory(
  signal?: AbortSignal
): Promise<SecurityAuditLedgerVerification[]> {
  return request<SecurityAuditLedgerVerification[]>(
    "/api/v1/security-ledger/history",
    {
      signal,
    }
  );
}

export function refreshSecurityAuditLedger():
Promise<SecurityAuditLedgerRefresh> {
  return request<SecurityAuditLedgerRefresh>(
    "/api/v1/security-ledger/refresh",
    {
      method: "POST",
    }
  );
}

export interface InvestigationTriageQueueItem {
  id: string;
  runId: string;
  caseId: string;
  caseNumber: string;
  casePriority: string;
  caseStatus: string;
  triageScore: number;
  triageBand: string;
  priorityPoints: number;
  slaPoints: number;
  agePoints: number;
  statusPoints: number;
  explanation: string;
  calculatedAt: string;
  ownerUsername: string | null;
  assignedBy: string | null;
  assignmentNote: string | null;
  assignedAt: string | null;
}

export interface InvestigationTriageRun {
  id: string;
  calculatedBy: string;
  calculatedAt: string;
  caseCount: number;
  urgentCount: number;
  highCount: number;
  mediumCount: number;
  routineCount: number;
  queue: InvestigationTriageQueueItem[];
}

export interface InvestigationTriageRunSummary {
  id: string;
  calculatedBy: string;
  calculatedAt: string;
  caseCount: number;
  urgentCount: number;
  highCount: number;
  mediumCount: number;
  routineCount: number;
}

export interface InvestigationQueueOwnership {
  caseId: string;
  ownerUsername: string;
  assignedBy: string;
  assignmentNote: string;
  assignedAt: string;
}

export function fetchInvestigationTriageQueue(
  signal?: AbortSignal
): Promise<InvestigationTriageQueueItem[]> {
  return request<InvestigationTriageQueueItem[]>(
    "/api/v1/investigation-triage/queue",
    {
      signal,
    }
  );
}

export function fetchInvestigationTriageRuns(
  signal?: AbortSignal
): Promise<InvestigationTriageRunSummary[]> {
  return request<InvestigationTriageRunSummary[]>(
    "/api/v1/investigation-triage/runs",
    {
      signal,
    }
  );
}

export function recalculateInvestigationTriage():
Promise<InvestigationTriageRun> {
  return request<InvestigationTriageRun>(
    "/api/v1/investigation-triage/recalculate",
    {
      method: "POST",
    }
  );
}

export function assignInvestigationQueueOwner(
  caseId: string,
  ownerUsername: string,
  assignmentNote: string
): Promise<InvestigationQueueOwnership> {
  const body =
    new URLSearchParams();

  body.set(
    "ownerUsername",
    ownerUsername
  );

  body.set(
    "assignmentNote",
    assignmentNote
  );

  return request<InvestigationQueueOwnership>(
    `/api/v1/investigation-triage/cases/${encodeURIComponent(
      caseId
    )}/owner`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );
}

export interface CaseDecisionProposal {
  id: string;
  caseId: string;
  caseNumber: string;
  casePriority: string;
  caseStatus: string;
  version: number;
  recommendation: string;
  rationale: string;
  status: string;
  proposedBy: string;
  proposedAt: string;
  reviewId: string | null;
  decision: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export function fetchDecisionProposals(
  signal?: AbortSignal
): Promise<CaseDecisionProposal[]> {
  return request<CaseDecisionProposal[]>(
    "/api/v1/decision-governance/proposals",
    {
      signal,
    }
  );
}

export function submitCaseDecisionProposal(
  caseId: string,
  recommendation: string,
  rationale: string
): Promise<CaseDecisionProposal> {
  const body = new URLSearchParams();

  body.set(
    "recommendation",
    recommendation
  );

  body.set(
    "rationale",
    rationale
  );

  return request<CaseDecisionProposal>(
    `/api/v1/decision-governance/cases/${encodeURIComponent(
      caseId
    )}/proposals`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );
}

export function reviewCaseDecisionProposal(
  proposalId: string,
  decision: string,
  reviewNote: string
): Promise<CaseDecisionProposal> {
  const body = new URLSearchParams();

  body.set(
    "decision",
    decision
  );

  body.set(
    "reviewNote",
    reviewNote
  );

  return request<CaseDecisionProposal>(
    `/api/v1/decision-governance/proposals/${encodeURIComponent(
      proposalId
    )}/review`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );
}

export interface CaseDecisionExecution {
  id: string;
  proposalId: string;
  caseId: string;
  caseNumber: string;
  casePriority: string;
  caseStatus: string;
  decisionVersion: number;
  sourceRecommendation: string;
  governedOutcome: string;
  sourceProposedBy: string;
  sourceReviewedBy: string;
  executionNote: string;
  executedBy: string;
  executedAt: string;
}

export interface GovernedCaseOutcome {
  caseId: string;
  caseNumber: string;
  casePriority: string;
  caseStatus: string;
  executionId: string;
  proposalId: string;
  decisionVersion: number;
  governedOutcome: string;
  effectiveAt: string;
  lastUpdatedBy: string;
}

export function fetchDecisionExecutions(
  signal?: AbortSignal
): Promise<CaseDecisionExecution[]> {
  return request<CaseDecisionExecution[]>(
    "/api/v1/decision-execution/executions",
    {
      signal,
    }
  );
}

export function fetchGovernedCaseOutcomes(
  signal?: AbortSignal
): Promise<GovernedCaseOutcome[]> {
  return request<GovernedCaseOutcome[]>(
    "/api/v1/decision-execution/outcomes",
    {
      signal,
    }
  );
}

export function executeCaseDecision(
  proposalId: string,
  executionNote: string
): Promise<CaseDecisionExecution> {
  const body =
    new URLSearchParams();

  body.set(
    "executionNote",
    executionNote
  );

  return request<CaseDecisionExecution>(
    `/api/v1/decision-execution/proposals/${encodeURIComponent(
      proposalId
    )}/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );
}
