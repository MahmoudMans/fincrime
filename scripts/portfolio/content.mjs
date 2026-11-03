// The words that go with the pictures. Edit freely: the numbers (lines of code,
// tests, endpoints, versions...) are measured from the code by facts.mjs, so
// this file only holds the story, not figures that could go stale.

export const PROJECT = {
  name: "FinCrime Graph",
  tagline: "Graph-powered anti-money-laundering investigation platform",

  pitch: {
    short:
      "A full-stack AML investigation workspace: it spots suspicious money movement, maps it as a graph, and takes each case from first alert to a sealed, auditable conclusion.",
    medium:
      "FinCrime Graph helps financial-crime analysts find and explain suspicious money movement. Rules raise alerts on transactions, a Neo4j graph reveals circular flows and hidden links, and every case moves through evidence, review, decision and release steps with a tamper-evident audit trail.",
    long:
      "Financial-crime teams drown in alerts that live in separate tools, and the patterns that matter (money looping back to its origin, funds split below reporting limits) are hard to see in rows of transactions. FinCrime Graph puts the whole workflow in one place. Detection rules raise alerts, a graph database shows how accounts are connected, and customer risk scoring and watchlist screening add context. An analyst opens a case, attaches evidence, and the case then passes through independent review, a maker-checker decision, controlled execution and a sealed outcome, with every step written to a hash-chained audit ledger.",
  },

  problem: [
    "Alerts, customer data and case notes sit in different tools, so analysts spend their time copying context instead of investigating.",
    "Laundering patterns such as circular flows are structural: they are easy to see on a graph and almost invisible in a transaction table.",
    "Regulators and auditors ask who decided what, on which evidence, and whether that evidence was changed afterwards. Spreadsheets and email cannot answer that reliably.",
  ],

  solution: [
    "One workspace for the whole path: signal, alert, case, evidence, finding, decision, outcome.",
    "Rule-based detection for five typologies, backed by a graph database for path and cycle queries.",
    "Governance built into the workflow: four-eyes review, role-gated execution, integrity hashes and a hash-chained audit ledger.",
  ],

  // Grouped like the sidebar in the app.
  features: [
    {
      area: "Monitor",
      items: [
        "Investigation overview with panels that load independently, so one failing data source does not blank the dashboard.",
        "Alert queue with server-side search, severity and status filters with live counts, paging and deep links to a single alert.",
        "Detection of five typologies: circular flow, structuring, large cross-border transfers, high-risk counterparties and velocity anomalies.",
        "Transactions view with search and filters across all monitored accounts.",
      ],
    },
    {
      area: "Investigate",
      items: [
        "Case workspace with notes, evidence (alerts, transactions and circular-flow graph evidence), assignment and unassignment, a searchable activity timeline, resolution, and a case report that exports as a PDF.",
        "Triage queue that scores and orders open cases and shows who owns them.",
        "Network investigation on a Neo4j graph: trace money paths, expand an account's neighbourhood and find circular structures.",
        "Entity explorer for customers, accounts and transactions with their linked alerts.",
      ],
    },
    {
      area: "Risk and compliance",
      items: [
        "Customer risk scoring from six factors (customer profile, watchlist matches, transaction volume, cross-border activity, high-risk counterparties and circular flow), with the contributing factors shown.",
        "Watchlist screening with fuzzy name matching (Levenshtein similarity, aliases included, 80 percent threshold) and a clear/escalate review step.",
        "Compliance command centre with SLA clocks, breaches and recent activity.",
      ],
    },
    {
      area: "Evidence and decisions",
      items: [
        "Chain of custody: a tamper-evident log for every item of case evidence, using SHA-256 integrity hashes.",
        "A four-eyes rule at every checkpoint: the evidence reviewer must differ from the custodian, the finding reviewer from the submitter, the decision reviewer from the proposer and the release reviewer from the preparer.",
        "Findings that can only rest on integrity-verified, accepted evidence.",
        "Role-gated decision execution, sealed outcome attestations and a controlled conclusion release with a release fingerprint.",
      ],
    },
    {
      area: "Administration",
      items: [
        "Detection rule governance: change a rule's thresholds with a written reason and keep the full change history.",
        "Security audit ledger: security events can be searched by date range, and a hash chain makes tampering detectable.",
        "Data ingestion centre: validate and preview CSV or JSON datasets before importing them and re-syncing the graph.",
      ],
    },
    {
      area: "Everywhere",
      items: [
        "Command palette (Ctrl or Cmd + K) to jump to any module or search alerts, cases and transactions.",
        "Every screen has its own URL, so refresh, back and forward, and shared links all work.",
        "Notification bell, filters with saved views and CSV export on the main lists, and a responsive layout with an off-canvas menu on phones.",
        "Per-screen error boundaries, session expiry handling and keyboard and screen-reader support.",
      ],
    },
  ],

  architecture: {
    diagram: [
      "  Browser (Next.js {next} + React {react}, TypeScript, Cytoscape)",
      "        |  JSON over HTTPS, JWT bearer token",
      "        v",
      "  Spring Boot {boot} REST API (Java {java})",
      "   |- security: JWT (HS256), roles, sign-in lockout, audit",
      "   |- services: detection, cases, risk, watchlist, governance",
      "   |",
      "   |--> PostgreSQL {postgres}  (system of record, Flyway migrations)",
      "   '--> Neo4j         (money-flow graph: accounts and TRANSFERRED_TO links)",
    ],
    notes: [
      "PostgreSQL is the system of record for customers, accounts, transactions, alerts, cases, evidence and the audit trail. Schema changes are versioned Flyway migrations.",
      "Neo4j holds a projection of accounts and transfers (TRANSFERRED_TO relationships) so path, neighbourhood and cycle questions are one Cypher query instead of many joins. It is rebuilt from PostgreSQL in a single transaction, so readers never see a half-built graph.",
      "The API is stateless. A signed JWT (8 hours by default) carries the user and role, and method-level security decides who may do what.",
      "The web app is a single-page workspace. Navigation lives in the URL hash, and each module sits in its own error boundary.",
    ],
  },

  decisions: [
    {
      title: "Two databases, one source of truth",
      text: "Relational data stays in PostgreSQL and the graph is a rebuildable projection in Neo4j. Graph questions are fast and natural, and a graph problem can never corrupt the records of the case.",
    },
    {
      title: "Governance as code, not as a policy document",
      text: "Maker-checker review, role gates, integrity hashes and a hash-chained audit ledger are enforced by the services themselves, so an analyst cannot skip a step by accident.",
    },
    {
      title: "Identity comes from the token",
      text: "Case notes and audit entries are attributed to the signed-in user taken from the JWT. Request parameters that claim to say who acted are ignored, so nobody can write under another name.",
    },
    {
      title: "Safe by default",
      text: "A guard refuses to start the production profile while the demo secret or demo passwords are still in use. Sign-in is rate limited per user name, audit text is clipped to its column width, and free text is sent in the request body instead of the URL so it stays out of access logs.",
    },
    {
      title: "Degrade, do not fail",
      text: "Overview data is loaded with Promise.allSettled, every module has its own error boundary and a 401 returns the user to sign-in with a clear message. One broken dependency costs one panel, not the whole screen.",
    },
  ],

  challenges: [
    "Keeping a graph and a relational database consistent: solved by treating the graph as a projection that is rebuilt in one transaction, in batches.",
    "Making a very wide product (twenty modules) feel like one product: grouped navigation, one command palette, shared list tools and a shared design layer.",
    "Proving that evidence was not altered: integrity hashes at each stage, and an audit ledger whose entries are chained to the one before.",
    "Testing a UI without a backend at hand: browser tests against a mock API, plus unit tests for the rules that carry the risk (lockout, audit range, assignment).",
  ],

  learnings: [
    "Modelling workflow states explicitly makes governance rules easy to test.",
    "Server-side paging, filtering and counts matter early; in-memory filtering only works while the data is small.",
    "Accessibility work (focus management, combobox semantics, reduced motion) is cheaper when it is part of the first build of a component.",
  ],

  limitations: [
    "All data is synthetic, seeded for development.",
    "Users are three accounts configured by properties; a real user store with password hashing is the next step before real use.",
    "The sign-in lockout is held in memory per instance.",
    "The access token is kept in sessionStorage; an httpOnly cookie would be safer.",
    "Backend integration tests with Testcontainers would complement the existing unit tests.",
  ],

  roadmap: [
    "Real user store and an httpOnly cookie session.",
    "Paged analytics lists and a bounded graph query for large data.",
    "Integration tests against real PostgreSQL and Neo4j containers, and CI.",
    "Local-time display and user preferences.",
  ],

  keywords: [
    "Anti-money laundering (AML)", "Financial crime", "Graph database", "Neo4j", "Cypher",
    "Spring Boot", "Java 21", "PostgreSQL", "Flyway", "Spring Security", "JWT",
    "Next.js", "React", "TypeScript", "Cytoscape.js", "Role-based access control",
    "Audit logging", "Maker-checker", "REST API",
  ],

  // Plain-English lines for a CV or LinkedIn. {placeholders} are filled in from the code.
  resumeBullets: [
    "Built FinCrime Graph, a full-stack AML investigation platform (Spring Boot {boot}, Java {java}, PostgreSQL, Neo4j, Next.js {next}, React {react}, TypeScript) with {modules} modules covering detection, case management, risk scoring, watchlist screening and decision governance.",
    "Modelled money flows as a Neo4j graph to surface circular transfers and multi-hop paths with Cypher, while keeping PostgreSQL as the system of record.",
    "Designed a governed investigation workflow: four-eyes review, role-gated execution, SHA-256 integrity hashes and a hash-chained audit ledger.",
    "Delivered {endpoints} REST endpoints across {controllers} controllers, {migrations} Flyway migrations and {tests} automated tests.",
    "Hardened authentication with JWT, role-based method security, per-user sign-in lockout and an insecure-defaults guard for production.",
  ],
};

// One entry per picture. kind: login | view | case | palette | mobile.
//  label : the sidebar label, used to check the right screen opened
//  alt   : short description for the image's alt text
//  title : heading for the picture
//  caption: one sentence for a gallery
//  description: a short paragraph, for the portfolio text beside the picture
//  points: what to say about it in an interview or a walkthrough
//  click : (optional) button name, or a list of them, to press before the picture is taken
//  scrollTo: (optional) exact text of a heading to scroll to first
//  height: (optional) taller window for this picture, in px (default 900)
//  settleMs: (optional) extra wait before the picture, in ms (default 600)
export const SHOTS = [
  {
    id: "login", kind: "login", title: "Sign-in",
    alt: "FinCrime Graph sign-in screen with a choice of local demo identities",
    caption: "Sign-in with role-based demo identities.",
    description: "The entry point. Three demo identities (analyst, senior analyst and administrator) show how the same application changes with the role. Sessions use signed JWTs, and five failed attempts for one user name lock that name for five minutes.",
    points: ["Role-based access from the very first screen.", "Sign-in lockout with a Retry-After wait shown to the user.", "A guard refuses to start the production profile with demo secrets."],
    height: 1050,
  },
  {
    id: "overview", kind: "view", view: "overview", label: "Overview", title: "Investigation overview",
    alt: "Overview dashboard with alert, case and transaction summaries",
    caption: "What needs attention now, on one screen.",
    description: "The analyst's home page: new signals, unassigned cases and the state of the money-movement network. Each panel loads on its own, so a failing data source shows an inline message instead of blanking the page.",
    points: ["Panels load independently with Promise.allSettled.", "The last good data is kept if a refresh fails.", "The notification bell lists severe open alerts and unassigned cases."],
  },
  {
    id: "alerts", kind: "view", view: "alerts", label: "Alerts", title: "Alert queue",
    alt: "Alert queue with severity and status filters and a list of alerts",
    caption: "Every alert, searchable and filterable on the server.",
    description: "All alerts raised by the detection rules, with search, severity and status filters that show live counts, paging and a link to each alert. An analyst can open an investigation case straight from an alert.",
    points: ["Five detection typologies: circular flow, structuring, large cross-border, high-risk counterparty, velocity anomaly.", "Search and filters run in the database; user text is always a bound parameter.", "Saved filter views and CSV export."],
  },
  {
    id: "transactions", kind: "view", view: "transactions", label: "Transactions", title: "Transactions",
    alt: "Transactions list with search and filters",
    caption: "Recent transfers across all monitored accounts.",
    description: "A searchable, filterable list of the transfers that the detection rules and the graph work on.",
    points: ["Deep links to one transaction by reference.", "Reachable from the command palette."],
  },
  {
    id: "cases", kind: "view", view: "cases", label: "Cases", title: "Investigation cases",
    alt: "Investigation case queue with status and priority",
    caption: "The case queue, ordered by what matters.",
    description: "Every investigation case with its status, priority, owner and risk score. Cases are opened from alerts and worked end to end in the case workspace.",
    points: ["Case lifecycle: open, in review, closed.", "Closing a case needs a disposition (no action, false positive, escalated or SAR recommended) and a written summary."],
  },
  {
    id: "case-workspace", kind: "case", label: "Cases", title: "Case workspace",
    alt: "Case workspace showing notes, evidence, assignment and timeline",
    caption: "Notes, evidence, owner and timeline for one case.",
    description: "Where the investigation happens. The analyst attaches alerts, transactions and circular-flow graph evidence, assigns or unassigns the case, and resolves it with a disposition. The investigation report, with evidence fingerprints, notes and the audit timeline, exports as a PDF.",
    points: ["Notes and audit entries are attributed from the JWT, not from the request.", "Unassigning is idempotent and recorded on the timeline.", "Free text travels in the request body, not the URL."],
    scrollTo: "Case evidence workspace", height: 1300,
  },
  {
    id: "case-timeline", kind: "case", label: "Cases", title: "Case notes and timeline",
    alt: "Analyst notes and the activity timeline of a case",
    caption: "Analyst notes and a day-by-day activity timeline.",
    description: "Notes are saved with Ctrl or Cmd + Enter and signed with the analyst's identity. Every action on the case lands on an activity timeline that is grouped by day, shown in UTC, and can be searched, filtered by event type and exported to CSV.",
    points: ["Every change to a case is a timeline event.", "Search, filter chips and CSV export on the timeline.", "Times are shown in UTC with the exact timestamp on hover."],
    scrollTo: "Analyst notes", height: 1300,
  },
  {
    id: "triage", kind: "view", view: "triage", label: "Triage queue", title: "Investigation triage",
    alt: "Triage queue with scoring and ownership",
    caption: "A prioritised work queue with scores and owners.",
    description: "Open cases scored and ordered so the most urgent work comes first, with ownership and a recalculate action that records each run.",
    points: ["Each scoring run is stored, so the order can be explained later.", "Ownership can be assigned from the queue."],
  },
  {
    id: "network", kind: "view", view: "network", label: "Network", title: "Network investigation",
    alt: "Interactive money-flow network graph",
    caption: "Money paths and circular flows on a Neo4j graph.",
    description: "The graph investigation workbench on Neo4j, here after pressing Find circular flows. Money that leaves an account and returns to it through intermediaries shows up as a loop. Analysts can also trace a path between two accounts and expand an account's neighbourhood.",
    points: ["TRANSFERRED_TO relationships rebuilt from PostgreSQL in one transaction.", "Circular flows can be attached to a case as evidence.", "Rendered with Cytoscape.js."],
    click: ["Find circular flows", "Fit to view"], height: 1300, settleMs: 2500,
  },
  {
    id: "network-path", kind: "view", view: "network", label: "Network", title: "Money path between two accounts",
    alt: "Graph showing the money path between two accounts",
    caption: "How money got from one account to another.",
    description: "Pick a source and a target account and a hop limit, and the workbench traces the directed path the money took through intermediary accounts.",
    points: ["A directed path query in Cypher, bounded by a maximum number of hops.", "Each hop is a real transfer that can be opened and attached to a case."],
    click: ["Find money path", "Fit to view"], height: 1300, settleMs: 2500,
  },
  {
    id: "entities", kind: "view", view: "entities", label: "Entities", title: "Entities",
    alt: "Customer and account explorer",
    caption: "Customer and account 360.",
    description: "Customers and accounts with their counterparties, flows and linked alerts, so an analyst sees who they are dealing with without leaving the platform.",
    points: ["Search that tolerates a failing API instead of throwing.", "Pre-filled from the command palette."],
  },
  {
    id: "customer-risk", kind: "view", view: "customer-risk", label: "Customer risk", title: "Customer risk assessment",
    alt: "Customer risk scores with contributing factors",
    caption: "Explainable customer risk scores.",
    description: "Each customer's risk score is built from six factors: customer profile, watchlist matches, transaction volume, cross-border activity, high-risk counterparties and circular flow. The factors are shown, so the number can be defended.",
    points: ["Explainability over a black-box score.", "Assessments are kept as history."],
  },
  {
    id: "watchlist", kind: "view", view: "watchlist", label: "Watchlist screening", title: "Watchlist screening",
    alt: "Watchlist screening results with potential matches",
    caption: "Fuzzy name screening against watchlists.",
    description: "Customers are screened against watchlist entries with Levenshtein similarity, aliases included, and a match threshold of 80. Potential matches are cleared or escalated by an analyst with a note.",
    points: ["Aliases are matched as well as primary names.", "A review decision is recorded with a note."],
  },
  {
    id: "compliance", kind: "view", view: "compliance", label: "Compliance SLAs", title: "Compliance operations",
    alt: "Compliance command centre with SLA status",
    caption: "SLA clocks and the compliance command centre.",
    description: "Policy-driven SLA clocks for open cases, with breaches called out and a feed of recent activity, so a compliance lead sees where the process is slipping.",
    points: ["SLA status is recalculated on demand and recorded.", "Senior analyst or administrator role required to recalculate."],
  },
  {
    id: "custody", kind: "view", view: "custody", label: "Chain of custody", title: "Evidence chain of custody",
    alt: "Evidence chain of custody log",
    caption: "A tamper-evident log for every item of evidence.",
    description: "Each piece of case evidence has a custody log. Integrity hashes (SHA-256) let anyone verify that the evidence is the same as when it was attached.",
    points: ["Hash verification instead of trust.", "CSV export of custody records."],
  },
  {
    id: "evidence-review", kind: "view", view: "evidence-review", label: "Evidence review", title: "Evidence review",
    alt: "Evidence review queue",
    caption: "Independent review before evidence counts.",
    description: "Attached evidence is reviewed before it can support a finding, and the reviewer must be someone other than the evidence's current custodian.",
    points: ["Four-eyes rule enforced by the service, not by convention.", "Review decisions are part of the audit trail."],
  },
  {
    id: "findings", kind: "view", view: "findings", label: "Findings", title: "Investigation findings",
    alt: "Investigation findings linked to evidence",
    caption: "Findings that point back to their evidence.",
    description: "Conclusions are recorded as findings, each tied to evidence that passed integrity verification and was accepted in review, so a decision can always be traced to what supports it. A finding is reviewed by someone other than its submitter.",
    points: ["A finding can only rest on integrity-verified, accepted evidence.", "Feeds the decision step."],
  },
  {
    id: "decisions", kind: "view", view: "decisions", label: "Decisions", title: "Decision governance",
    alt: "Decision proposals awaiting approval",
    caption: "Maker-checker approval of case decisions.",
    description: "Decisions are proposed by one person and reviewed by another. The service rejects a review by the proposer.",
    points: ["Separation of duties enforced in a policy class with unit tests.", "Every transition is recorded."],
  },
  {
    id: "execution", kind: "view", view: "execution", label: "Execution", title: "Controlled decision execution",
    alt: "Decision execution ledger and outcomes",
    caption: "Approved decisions executed under role-gated controls.",
    description: "Only approved decisions can be executed, only by a senior analyst or administrator, and each execution and outcome is written to a ledger.",
    points: ["Role-gated with Spring method-level security.", "Outcomes carry a provenance hash."],
  },
  {
    id: "attestations", kind: "view", view: "attestations", label: "Attestations", title: "Outcome attestations",
    alt: "Outcome attestations and verifications",
    caption: "Integrity attestations that seal a case outcome.",
    description: "The outcome of a case is sealed with an attestation. Later verification shows whether the recorded outcome still matches what was attested.",
    points: ["Seal and verify, with verification history.", "Built on SHA-256 hashing."],
  },
  {
    id: "release", kind: "view", view: "release", label: "Conclusion release", title: "Conclusion release",
    alt: "Conclusion release governance",
    caption: "Controlled release of investigation conclusions.",
    description: "A conclusion leaves the investigation only through a controlled release. The reviewer must differ from whoever prepared the package, and a release fingerprint records exactly what was released.",
    points: ["Release fingerprint (SHA-256) of the released content.", "Fourth four-eyes checkpoint, after evidence, findings and decisions."],
  },
  {
    id: "rules", kind: "view", view: "rules", label: "Detection rules", title: "Detection rule governance",
    alt: "Detection rules with thresholds and change history",
    caption: "Tune detection rules with a full change history.",
    description: "Detection thresholds are not hard-coded. A senior analyst or administrator can change a rule with a written change summary, and every change is kept in the history.",
    points: ["Change summaries are sent in the request body, not the URL.", "Role-gated: an analyst cannot retune a rule."],
  },
  {
    id: "audit", kind: "view", view: "audit", label: "Audit ledger", title: "Security audit ledger",
    alt: "Security audit ledger with events and hash chain status",
    caption: "A hash-chained record of security-relevant events.",
    description: "Administrators can search security events by date range and check the ledger's hash chain. Each entry is chained to the one before, so removing or editing history is detectable.",
    points: ["Server-side date-range search with a total count.", "Refresh extends the chain; verification reports whether it is valid."],
  },
  {
    id: "ingestion", kind: "view", view: "ingestion", label: "Data ingestion", title: "Data ingestion",
    alt: "Data ingestion centre with dataset validation and import jobs",
    caption: "Validate and import customer, account and transaction data.",
    description: "Upload CSV or JSON datasets, preview and validate them against a schema, import them and re-synchronise the graph. Each import is hashed and logged.",
    points: ["Preview before import.", "Import jobs keep a log.", "The graph is re-synchronised from PostgreSQL afterwards."],
  },
  {
    id: "command-palette", kind: "palette", title: "Command palette",
    alt: "Command palette searching modules, alerts, cases and transactions",
    caption: "Jump anywhere, or search alerts, cases and transactions.",
    description: "Press Ctrl or Cmd + K (or the slash key) from any screen to jump to a module or search alerts, cases and transactions by code, reference, account or name.",
    points: ["Proper combobox and listbox semantics, fully keyboard driven.", "Every result is a deep link."],
  },
  {
    id: "mobile-login", kind: "mobile", mobile: "login", title: "Sign-in on a phone",
    alt: "Sign-in screen on a phone",
    caption: "The sign-in screen on a phone.",
    description: "The same sign-in, laid out for a narrow screen.",
    points: ["Same form, same demo identities, laid out for a narrow screen."],
    scrollTo: "Sign in to FinCrime Graph",
  },
  {
    id: "mobile-overview", kind: "mobile", mobile: "overview", label: "Overview", title: "Overview on a phone",
    alt: "Overview dashboard on a phone",
    caption: "The overview on a phone.",
    description: "Panels stack into a single column and the sidebar becomes an off-canvas menu.",
    points: ["Breakpoints at 1180, 1024, 850, 780 and 480 px.", "Comfortable touch targets."],
  },
  {
    id: "mobile-menu", kind: "mobile", mobile: "menu", label: "Overview", title: "Navigation menu on a phone",
    alt: "Off-canvas navigation menu on a phone",
    caption: "The grouped navigation as an off-canvas menu.",
    description: "On screens up to 850 px the sidebar turns into a drawer with the same five groups, instead of an icon rail without labels.",
    points: ["Focus is managed when the drawer opens and closes."],
  },
  {
    id: "mobile-alerts", kind: "mobile", mobile: "alerts", label: "Alerts", title: "Alerts on a phone",
    alt: "Alert queue on a phone",
    caption: "The alert queue on a phone.",
    description: "Filters and the alert list reflow for one-handed use.",
    points: ["Same server-side search and filters as on the desktop."],
  },
];
