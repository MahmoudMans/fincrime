# Portfolio kit: FinCrime Graph

Generated on 2026-10-09 by `scripts/portfolio`. Everything here comes from your running app and your code, so run the script again after you change the project.

## What is in this folder

| Path | What it is |
|---|---|
| `screenshots/` | One PNG per screen, plus a `.md` note with the caption, description and talking points for each |
| `screenshots.md` | All pictures with their text in one page, ready to copy from |
| `screenshots.json` | The same information for a script or a portfolio site |
| `project.md` | The project in full: pitch, features, architecture, stack, numbers, decisions, CV bullets |
| `project.json` | The same, as data |
| `case-study.md` | A readable write-up with the key pictures embedded |

## Pictures

| # | Picture | Caption |
|---:|---|---|
| 01 | [Sign-in](screenshots/01-login.png) | Sign-in with role-based demo identities. |
| 02 | [Investigation overview](screenshots/02-overview.png) | What needs attention now, on one screen. |
| 03 | [Alert queue](screenshots/03-alerts.png) | Every alert, searchable and filterable on the server. |
| 04 | [Transactions](screenshots/04-transactions.png) | Recent transfers across all monitored accounts. |
| 05 | [Investigation cases](screenshots/05-cases.png) | The case queue, ordered by what matters. |
| 06 | [Case workspace](screenshots/06-case-workspace.png) | Notes, evidence, owner and timeline for one case. |
| 07 | [Case notes and timeline](screenshots/07-case-timeline.png) | Analyst notes and a day-by-day activity timeline. |
| 08 | [Investigation triage](screenshots/08-triage.png) | A prioritised work queue with scores and owners. |
| 09 | [Network investigation](screenshots/09-network.png) | Money paths and circular flows on a Neo4j graph. |
| 10 | [Money path between two accounts](screenshots/10-network-path.png) | How money got from one account to another. |
| 11 | [Entities](screenshots/11-entities.png) | Customer and account 360. |
| 12 | [Customer risk assessment](screenshots/12-customer-risk.png) | Explainable customer risk scores. |
| 13 | [Watchlist screening](screenshots/13-watchlist.png) | Fuzzy name screening against watchlists. |
| 14 | [Compliance operations](screenshots/14-compliance.png) | SLA clocks and the compliance command centre. |
| 15 | [Evidence chain of custody](screenshots/15-custody.png) | A tamper-evident log for every item of evidence. |
| 16 | [Evidence review](screenshots/16-evidence-review.png) | Independent review before evidence counts. |
| 17 | [Investigation findings](screenshots/17-findings.png) | Findings that point back to their evidence. |
| 18 | [Decision governance](screenshots/18-decisions.png) | Maker-checker approval of case decisions. |
| 19 | [Controlled decision execution](screenshots/19-execution.png) | Approved decisions executed under role-gated controls. |
| 20 | [Outcome attestations](screenshots/20-attestations.png) | Integrity attestations that seal a case outcome. |
| 21 | [Conclusion release](screenshots/21-release.png) | Controlled release of investigation conclusions. |
| 22 | [Detection rule governance](screenshots/22-rules.png) | Tune detection rules with a full change history. |
| 23 | [Security audit ledger](screenshots/23-audit.png) | A hash-chained record of security-relevant events. |
| 24 | [Data ingestion](screenshots/24-ingestion.png) | Validate and import customer, account and transaction data. |
| 25 | [Command palette](screenshots/25-command-palette.png) | Jump anywhere, or search alerts, cases and transactions. |
| 26 | [Sign-in on a phone](screenshots/26-mobile-login.png) | The sign-in screen on a phone. |
| 27 | [Overview on a phone](screenshots/27-mobile-overview.png) | The overview on a phone. |
| 28 | [Navigation menu on a phone](screenshots/28-mobile-menu.png) | The grouped navigation as an off-canvas menu. |
| 29 | [Alerts on a phone](screenshots/29-mobile-alerts.png) | The alert queue on a phone. |

## Before you publish

- Fill in your role, timeline and links in `scripts/portfolio/profile.json`, then run the script again so `project.md` and `case-study.md` pick them up.
- Look at every picture once. The data is synthetic, but check that nothing unexpected is on screen.
- Pick three to five pictures for the portfolio page: usually the overview, the network graph, the case workspace and one governance screen.
- Pictures are 2x resolution. Resize or convert them to WebP if your portfolio site wants smaller files.

## Take the pictures again

```bash
cd scripts/portfolio
node capture.mjs                 # everything
node capture.mjs --only network  # just one or more pictures (comma separated ids)
node capture.mjs --help          # all options
```
