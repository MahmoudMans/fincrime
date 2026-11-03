import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  Clock3,
  Database,
  FileCheck2,
  FileLock2,
  FileText,
  Gauge,
  GitBranch,
  History,
  LayoutDashboard,
  PackageCheck,
  PlayCircle,
  Scale,
  ScanSearch,
  Settings2,
  ShieldAlert,
  UserRoundSearch,
} from "lucide-react";
import type { ComponentType } from "react";

export type ViewId =
  | "overview"
  | "alerts"
  | "transactions"
  | "cases"
  | "triage"
  | "network"
  | "entities"
  | "customer-risk"
  | "watchlist"
  | "compliance"
  | "custody"
  | "evidence-review"
  | "findings"
  | "decisions"
  | "execution"
  | "attestations"
  | "release"
  | "rules"
  | "audit"
  | "ingestion";

export type NavGroupId =
  | "monitor"
  | "investigate"
  | "risk"
  | "governance"
  | "admin";

export interface NavGroup {
  id: NavGroupId;
  label: string;
}

export interface NavItem {
  id: ViewId;
  label: string;
  group: NavGroupId;
  icon: ComponentType<{
    size?: number;
    className?: string;
  }>;
  title: string;
  description: string;
  /** Extra words the command palette matches against. */
  keywords: string[];
}

export const DEFAULT_VIEW: ViewId = "overview";

export const NAV_GROUPS: NavGroup[] = [
  { id: "monitor", label: "Monitor" },
  { id: "investigate", label: "Investigate" },
  { id: "risk", label: "Risk & compliance" },
  { id: "governance", label: "Evidence & decisions" },
  { id: "admin", label: "Administration" },
];

export const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    group: "monitor",
    icon: LayoutDashboard,
    title: "Investigation overview",
    description:
      "What needs attention now: new signals, unassigned cases and the state of the money-movement network.",
    keywords: ["home", "dashboard", "summary", "metrics"],
  },
  {
    id: "alerts",
    label: "Alerts",
    group: "monitor",
    icon: ShieldAlert,
    title: "Alert queue",
    description:
      "Search and filter every alert raised by the detection rules, and open investigation cases from them.",
    keywords: ["signals", "detections", "suspicious", "queue"],
  },
  {
    id: "transactions",
    label: "Transactions",
    group: "monitor",
    icon: CircleDollarSign,
    title: "Transactions",
    description:
      "Recent transfers across monitored accounts, with search and filters.",
    keywords: ["transfers", "payments", "money", "ledger"],
  },
  {
    id: "cases",
    label: "Cases",
    group: "investigate",
    icon: BriefcaseBusiness,
    title: "Investigation cases",
    description:
      "Work cases end to end: notes, evidence, assignment, resolution and the case report.",
    keywords: ["investigations", "case workspace", "notes", "evidence"],
  },
  {
    id: "triage",
    label: "Triage queue",
    group: "investigate",
    icon: Gauge,
    title: "Investigation triage",
    description:
      "Prioritised work queue with scoring, ownership and re-calculation.",
    keywords: ["priority", "queue", "owner", "scoring", "workload"],
  },
  {
    id: "network",
    label: "Network",
    group: "investigate",
    icon: GitBranch,
    title: "Network investigation",
    description:
      "Trace money paths, expand connected accounts and inspect circular transaction structures.",
    keywords: ["graph", "neo4j", "paths", "circular", "links"],
  },
  {
    id: "entities",
    label: "Entities",
    group: "investigate",
    icon: Building2,
    title: "Entities",
    description:
      "Customer and account 360: counterparties, flows and linked alerts.",
    keywords: ["customers", "accounts", "counterparties", "360"],
  },
  {
    id: "customer-risk",
    label: "Customer risk",
    group: "risk",
    icon: UserRoundSearch,
    title: "Customer risk assessment",
    description:
      "Explainable customer risk scores, contributing factors and history.",
    keywords: ["kyc", "score", "factors", "assessment"],
  },
  {
    id: "watchlist",
    label: "Watchlist screening",
    group: "risk",
    icon: ScanSearch,
    title: "Watchlist screening",
    description:
      "Screen customers against watchlists and disposition potential matches.",
    keywords: ["sanctions", "pep", "matches", "screening", "hits"],
  },
  {
    id: "compliance",
    label: "Compliance SLAs",
    group: "risk",
    icon: Clock3,
    title: "Compliance operations",
    description:
      "SLA clocks, breaches and the operational command centre.",
    keywords: ["sla", "deadline", "breach", "command center", "operations"],
  },
  {
    id: "custody",
    label: "Chain of custody",
    group: "governance",
    icon: FileLock2,
    title: "Evidence chain of custody",
    description:
      "Tamper-evident custody log for every item of case evidence.",
    keywords: ["evidence", "integrity", "hash", "lineage"],
  },
  {
    id: "evidence-review",
    label: "Evidence review",
    group: "governance",
    icon: FileCheck2,
    title: "Evidence review",
    description:
      "Independent review of attached evidence before it can support findings.",
    keywords: ["reviewer", "approve", "independent", "four eyes"],
  },
  {
    id: "findings",
    label: "Findings",
    group: "governance",
    icon: FileText,
    title: "Investigation findings",
    description:
      "Evidence-backed findings that feed the case decision.",
    keywords: ["conclusions", "analysis", "facts"],
  },
  {
    id: "decisions",
    label: "Decisions",
    group: "governance",
    icon: Scale,
    title: "Decision governance",
    description:
      "Maker-checker approval of proposed case decisions.",
    keywords: ["maker", "checker", "approval", "governance"],
  },
  {
    id: "execution",
    label: "Execution",
    group: "governance",
    icon: PlayCircle,
    title: "Controlled decision execution",
    description:
      "Execute approved decisions under role-gated controls.",
    keywords: ["execute", "apply", "approved", "action"],
  },
  {
    id: "attestations",
    label: "Attestations",
    group: "governance",
    icon: BadgeCheck,
    title: "Outcome attestations",
    description:
      "Integrity attestations that seal a case outcome.",
    keywords: ["seal", "integrity", "provenance", "sign"],
  },
  {
    id: "release",
    label: "Conclusion release",
    group: "governance",
    icon: PackageCheck,
    title: "Investigation conclusion release",
    description:
      "Controlled release of investigation conclusions.",
    keywords: ["publish", "report", "conclusion", "release"],
  },
  {
    id: "rules",
    label: "Detection rules",
    group: "admin",
    icon: Settings2,
    title: "Detection rule governance",
    description:
      "Tune detection rules with a full change history.",
    keywords: ["thresholds", "aml", "configure", "tuning"],
  },
  {
    id: "audit",
    label: "Audit ledger",
    group: "admin",
    icon: History,
    title: "Security audit ledger",
    description:
      "Hash-chained record of security-relevant events.",
    keywords: ["security", "log", "events", "ledger", "who"],
  },
  {
    id: "ingestion",
    label: "Data ingestion",
    group: "admin",
    icon: Database,
    title: "Data ingestion",
    description:
      "Validate and import customer, account and transaction datasets.",
    keywords: ["import", "upload", "csv", "dataset", "load"],
  },
];

const VIEW_IDS = new Set<string>(
  NAV_ITEMS.map((item) => item.id)
);

/** Old sidebar targets that may still be bookmarked. */
const LEGACY_ALIASES: Record<string, ViewId> = {
  investigations: "cases",
};

export function isViewId(value: string): value is ViewId {
  return VIEW_IDS.has(value);
}

export function resolveViewId(
  value: string | null | undefined
): ViewId | null {
  if (!value) {
    return null;
  }

  if (isViewId(value)) {
    return value;
  }

  return LEGACY_ALIASES[value] ?? null;
}

export function getNavItem(id: ViewId): NavItem {
  const item = NAV_ITEMS.find(
    (candidate) => candidate.id === id
  );

  if (!item) {
    throw new Error(`Unknown view: ${id}`);
  }

  return item;
}

export function getNavGroup(id: NavGroupId): NavGroup {
  const group = NAV_GROUPS.find(
    (candidate) => candidate.id === id
  );

  if (!group) {
    throw new Error(`Unknown navigation group: ${id}`);
  }

  return group;
}
