# FinCrime Graph

**Graph-powered anti-money-laundering investigation platform**

| | |
|---|---|
| Project | FinCrime Graph |
| Type | Full-stack web application |
| Author | MahmoudMans |
| Role | _not set yet (edit scripts/portfolio/profile.json)_ |
| Team | _not set yet (edit scripts/portfolio/profile.json)_ |
| Timeline | _not set yet (edit scripts/portfolio/profile.json)_ |
| Status | Working prototype on synthetic data |
| Source code | https://github.com/MahmoudMans/fincrime |
| Live demo | _not set yet (edit scripts/portfolio/profile.json)_ |

## Pitch

**One sentence.** A full-stack AML investigation workspace: it spots suspicious money movement, maps it as a graph, and takes each case from first alert to a sealed, auditable conclusion.

**Short paragraph.** FinCrime Graph helps financial-crime analysts find and explain suspicious money movement. Rules raise alerts on transactions, a Neo4j graph reveals circular flows and hidden links, and every case moves through evidence, review, decision and release steps with a tamper-evident audit trail.

**Full paragraph.** Financial-crime teams drown in alerts that live in separate tools, and the patterns that matter (money looping back to its origin, funds split below reporting limits) are hard to see in rows of transactions. FinCrime Graph puts the whole workflow in one place. Detection rules raise alerts, a graph database shows how accounts are connected, and customer risk scoring and watchlist screening add context. An analyst opens a case, attaches evidence, and the case then passes through independent review, a maker-checker decision, controlled execution and a sealed outcome, with every step written to a hash-chained audit ledger.

## The problem

- Alerts, customer data and case notes sit in different tools, so analysts spend their time copying context instead of investigating.
- Laundering patterns such as circular flows are structural: they are easy to see on a graph and almost invisible in a transaction table.
- Regulators and auditors ask who decided what, on which evidence, and whether that evidence was changed afterwards. Spreadsheets and email cannot answer that reliably.

## The solution

- One workspace for the whole path: signal, alert, case, evidence, finding, decision, outcome.
- Rule-based detection for five typologies, backed by a graph database for path and cycle queries.
- Governance built into the workflow: four-eyes review, role-gated execution, integrity hashes and a hash-chained audit ledger.

## Features

### Monitor

- Investigation overview with panels that load independently, so one failing data source does not blank the dashboard.
- Alert queue with server-side search, severity and status filters with live counts, paging and deep links to a single alert.
- Detection of five typologies: circular flow, structuring, large cross-border transfers, high-risk counterparties and velocity anomalies.
- Transactions view with search and filters across all monitored accounts.

### Investigate

- Case workspace with notes, evidence (alerts, transactions and circular-flow graph evidence), assignment and unassignment, a searchable activity timeline, resolution, and a case report that exports as a PDF.
- Triage queue that scores and orders open cases and shows who owns them.
- Network investigation on a Neo4j graph: trace money paths, expand an account's neighbourhood and find circular structures.
- Entity explorer for customers, accounts and transactions with their linked alerts.

### Risk and compliance

- Customer risk scoring from six factors (customer profile, watchlist matches, transaction volume, cross-border activity, high-risk counterparties and circular flow), with the contributing factors shown.
- Watchlist screening with fuzzy name matching (Levenshtein similarity, aliases included, 80 percent threshold) and a clear/escalate review step.
- Compliance command centre with SLA clocks, breaches and recent activity.

### Evidence and decisions

- Chain of custody: a tamper-evident log for every item of case evidence, using SHA-256 integrity hashes.
- A four-eyes rule at every checkpoint: the evidence reviewer must differ from the custodian, the finding reviewer from the submitter, the decision reviewer from the proposer and the release reviewer from the preparer.
- Findings that can only rest on integrity-verified, accepted evidence.
- Role-gated decision execution, sealed outcome attestations and a controlled conclusion release with a release fingerprint.

### Administration

- Detection rule governance: change a rule's thresholds with a written reason and keep the full change history.
- Security audit ledger: security events can be searched by date range, and a hash chain makes tampering detectable.
- Data ingestion centre: validate and preview CSV or JSON datasets before importing them and re-syncing the graph.

### Everywhere

- Command palette (Ctrl or Cmd + K) to jump to any module or search alerts, cases and transactions.
- Every screen has its own URL, so refresh, back and forward, and shared links all work.
- Notification bell, filters with saved views and CSV export on the main lists, and a responsive layout with an off-canvas menu on phones.
- Per-screen error boundaries, session expiry handling and keyboard and screen-reader support.

## By the numbers

_Measured from the code when this folder was generated._

- 20 modules in the app, grouped into five areas
- 91 REST endpoints in 26 controllers
- 29,523 lines of Java in 114 files, with 97 unit tests in 29 test files
- 41,721 lines of TypeScript in 90 files, plus 19,293 lines of CSS
- 39 database tables created by 18 Flyway migrations, 19 JPA entities
- 32 commits, from 2026-09-18 to 2026-10-04
- 29 screenshots in this folder

## Architecture

```text
  Browser (Next.js 16 + React 19, TypeScript, Cytoscape)
        |  JSON over HTTPS, JWT bearer token
        v
  Spring Boot 4 REST API (Java 21)
   |- security: JWT (HS256), roles, sign-in lockout, audit
   |- services: detection, cases, risk, watchlist, governance
   |
   |--> PostgreSQL 17  (system of record, Flyway migrations)
   '--> Neo4j         (money-flow graph: accounts and TRANSFERRED_TO links)
```

- PostgreSQL is the system of record for customers, accounts, transactions, alerts, cases, evidence and the audit trail. Schema changes are versioned Flyway migrations.
- Neo4j holds a projection of accounts and transfers (TRANSFERRED_TO relationships) so path, neighbourhood and cycle questions are one Cypher query instead of many joins. It is rebuilt from PostgreSQL in a single transaction, so readers never see a half-built graph.
- The API is stateless. A signed JWT (8 hours by default) carries the user and role, and method-level security decides who may do what.
- The web app is a single-page workspace. Navigation lives in the URL hash, and each module sits in its own error boundary.

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Backend | Spring Boot | 4.1.1 |
| Backend | Java | 21 |
| Backend | Spring Security, JWT (HS256), Spring Data JPA, Spring Data Neo4j, Flyway |  |
| Data | PostgreSQL | 17-alpine |
| Data | Neo4j (graph) | 2026.08.1-community |
| Frontend | Next.js | 16.3.3 |
| Frontend | React | 19.2 |
| Frontend | TypeScript | 5.9 |
| Frontend | Cytoscape.js (network graph) | 3.34.3 |
| Tooling | Docker Compose, Maven, npm, ESLint |  |

## API surface

91 endpoints in 26 controllers. Roles: ADMIN, AML_ANALYST, SENIOR_ANALYST.

| Area | Base path | Endpoints |
|---|---|---:|
| Case Workspace | `/api/v1/case-workspace` | 8 |
| Data Import | `/api/v1/data-imports` | 6 |
| Compliance Operations | `/api/v1/compliance` | 5 |
| Decision Governance | `/api/v1/decision-governance` | 5 |
| Evidence Chain Of Custody | `/api/v1/evidence-custody` | 5 |
| Financial Intelligence | `/api/v1/intelligence` | 5 |
| Graph Investigation | `/api/v1/graph-investigation` | 5 |
| Watchlist Screening | `/api/v1/watchlist` | 5 |
| Case Outcome Attestation | `/api/v1/outcome-attestations` | 4 |
| Customer Risk | `/api/v1/customer-risk` | 4 |
| Decision Execution | `/api/v1/decision-execution` | 4 |
| Investigation Conclusion Release | `/api/v1/conclusion-releases` | 4 |
| Investigation Finding | `/api/v1/investigation-findings` | 4 |
| Investigation Triage | `/api/v1/investigation-triage` | 4 |
| Detection Rule | `/api/v1/detection-rules` | 3 |
| Evidence Review | `/api/v1/evidence-reviews` | 3 |
| Investigation Case | `/api/v1/cases` | 3 |
| Security Audit Ledger | `/api/v1/security-ledger` | 3 |
| Aml Detection | `/api/v1/detection-runs` | 2 |
| Auth | `/api/v1/auth` | 2 |
| Security Audit | `/api/v1/security` | 2 |
| Alert | `/api/v1/alerts` | 1 |
| Case Report | `/api/v1/case-reports` | 1 |
| Dashboard | `/api/v1/dashboard` | 1 |
| Graph | `/api/v1/graph` | 1 |
| System | `/api/v1/system` | 1 |

## Data model

39 PostgreSQL tables: `accounts`, `alerts`, `case_decision_executions`, `case_decision_proposals`, `case_decision_reviews`, `case_events`, `case_evidence`, `case_notes`, `case_outcome_attestation_verifications`, `case_outcome_attestations`, `case_queue_ownership`, `case_sla_status`, `compliance_sla_policies`, `customer_risk_assessments`, `customer_risk_factors`, `customers`, `data_import_jobs`, `data_import_row_issues`, `detection_rule_changes`, `detection_rules`, `detection_runs`, `financial_transactions`, `governed_case_outcomes`, `investigation_cases`, `investigation_conclusion_packages`, `investigation_conclusion_release_reviews`, `investigation_evidence_custody_events`, `investigation_evidence_registry`, `investigation_evidence_reviews`, `investigation_finding_reviews`, `investigation_findings`, `investigation_triage_runs`, `investigation_triage_snapshots`, `screening_hits`, `screening_runs`, `security_audit_events`, `security_audit_ledger_entries`, `security_audit_ledger_verifications`, `watchlist_entries`.

The Neo4j graph holds accounts and customers as nodes and `TRANSFERRED_TO` relationships for transfers. It is rebuilt from PostgreSQL.

### Migration history

| Version | Change |
|---:|---|
| V1 | Initial FinCrime schema |
| V2 | AML detection and investigation cases |
| V3 | Investigation case workspace |
| V4 | Security audit |
| V5 | Detection rule governance |
| V6 | Watchlist screening |
| V7 | Customer risk assessments |
| V8 | Compliance SLA command center |
| V9 | Security audit ledger |
| V10 | Investigation triage queue |
| V11 | Investigation decision governance |
| V12 | Controlled decision execution |
| V13 | Case outcome integrity attestations |
| V14 | Evidence chain of custody |
| V15 | Evidence review governance |
| V16 | Evidence backed investigation findings |
| V17 | Investigation conclusion release governance |
| V18 | Data ingestion center |

## Engineering decisions

### Two databases, one source of truth

Relational data stays in PostgreSQL and the graph is a rebuildable projection in Neo4j. Graph questions are fast and natural, and a graph problem can never corrupt the records of the case.

### Governance as code, not as a policy document

Maker-checker review, role gates, integrity hashes and a hash-chained audit ledger are enforced by the services themselves, so an analyst cannot skip a step by accident.

### Identity comes from the token

Case notes and audit entries are attributed to the signed-in user taken from the JWT. Request parameters that claim to say who acted are ignored, so nobody can write under another name.

### Safe by default

A guard refuses to start the production profile while the demo secret or demo passwords are still in use. Sign-in is rate limited per user name, audit text is clipped to its column width, and free text is sent in the request body instead of the URL so it stays out of access logs.

### Degrade, do not fail

Overview data is loaded with Promise.allSettled, every module has its own error boundary and a 401 returns the user to sign-in with a clear message. One broken dependency costs one panel, not the whole screen.

## Challenges

- Keeping a graph and a relational database consistent: solved by treating the graph as a projection that is rebuilt in one transaction, in batches.
- Making a very wide product (twenty modules) feel like one product: grouped navigation, one command palette, shared list tools and a shared design layer.
- Proving that evidence was not altered: integrity hashes at each stage, and an audit ledger whose entries are chained to the one before.
- Testing a UI without a backend at hand: browser tests against a mock API, plus unit tests for the rules that carry the risk (lockout, audit range, assignment).

## What I learned

- Modelling workflow states explicitly makes governance rules easy to test.
- Server-side paging, filtering and counts matter early; in-memory filtering only works while the data is small.
- Accessibility work (focus management, combobox semantics, reduced motion) is cheaper when it is part of the first build of a component.

## Known limitations

- All data is synthetic, seeded for development.
- Users are three accounts configured by properties; a real user store with password hashing is the next step before real use.
- The sign-in lockout is held in memory per instance.
- The access token is kept in sessionStorage; an httpOnly cookie would be safer.
- Backend integration tests with Testcontainers would complement the existing unit tests.

## What is next

- Real user store and an httpOnly cookie session.
- Paged analytics lists and a bounded graph query for large data.
- Integration tests against real PostgreSQL and Neo4j containers, and CI.
- Local-time display and user preferences.

## Run it locally

```bash
docker compose up -d                 # PostgreSQL and Neo4j
cd apps/backend && mvn spring-boot:run
cd apps/web && npm install && npm run dev
# open http://localhost:3000
```

Demo identities: `analyst@fincrime.local`, `senior@fincrime.local` and `admin@fincrime.local`. Their passwords are set in `apps/backend/src/main/resources/application.yml` and can be overridden with the `FINCRIME_*_PASSWORD` environment variables.

## Text you can paste

### CV bullets

- Built FinCrime Graph, a full-stack AML investigation platform (Spring Boot 4, Java 21, PostgreSQL, Neo4j, Next.js 16, React 19, TypeScript) with 20 modules covering detection, case management, risk scoring, watchlist screening and decision governance.
- Modelled money flows as a Neo4j graph to surface circular transfers and multi-hop paths with Cypher, while keeping PostgreSQL as the system of record.
- Designed a governed investigation workflow: four-eyes review, role-gated execution, SHA-256 integrity hashes and a hash-chained audit ledger.
- Delivered 91 REST endpoints across 26 controllers, 18 Flyway migrations and 97 automated tests.
- Hardened authentication with JWT, role-based method security, per-user sign-in lockout and an insecure-defaults guard for production.

### Keywords

Anti-money laundering (AML), Financial crime, Graph database, Neo4j, Cypher, Spring Boot, Java 21, PostgreSQL, Flyway, Spring Security, JWT, Next.js, React, TypeScript, Cytoscape.js, Role-based access control, Audit logging, Maker-checker, REST API
