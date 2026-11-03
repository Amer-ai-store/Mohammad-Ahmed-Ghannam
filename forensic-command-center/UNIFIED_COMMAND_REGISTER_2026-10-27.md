# Jawafa Audit Command Center — Unified Command Register
Updated 2026-10-27 | Primary command conversation | Deadline 2026-10-31 | Delivery 2026-11-01

## Governing constraints
- JAWAFFASVR Windows Server and SQL Server must NOT be restarted; no outage-inducing tests.
- Accounting source data are read-only: never INSERT, UPDATE, DELETE, ALTER or DROP original accounting data.
- Preserve original Windows/SQL/firewall/security settings and forensic logs. No public sensitive exports or secrets.
- NO EVIDENCE = NO DONE. This public GitHub repository stores only sanitized status, code, tests, and references to separately secured evidence.
- Do not count plans, simulations, prior chat claims, or UI labels as production proof.

## Single source of truth
Repository: Mohammadzxzx1991/Mohammad-Ahmed-Ghannam
Proposed product name: Jawafa Audit Command Center
Existing published UI: https://guava-forensic-command-center-dhv9z9.v2.appdeploy.ai/ (deployment ready, live data NOT connected).
Prior recovery evidence: forensic-command-center/RECOVERY_VALIDATION_2026-10-27.md
Prior SQL/API evidence: forensic-command-center/SQL_API_VERIFICATION_2026-10-27.md
Prior failover evidence: forensic-command-center/FAILOVER_VERIFICATION_2026-10-27.md
Do not duplicate previous completed test work.

## Master task register
| ID | Workstream | Status | Acceptance / evidence required | Target |
|---|---|---|---|---|
| JAW-001 | Host, SQL API and local proxy availability | VERIFIED | 2026-10-27 live host online, /api/health ok:true, Jawafa_DB, tasks running; GET /api/tables HTTP 200, 1024 table metadata records in previous live check | 27 Oct |
| JAW-002 | Process failure and auto-recovery | VERIFIED for proxy process only | Real controlled proxy-process stop, watchdog restart, recovered:true, Jawafa_DB, exit code 0; no host restart | 27 Oct |
| JAW-003 | SQL least privilege / actual read-only enforcement | NOT VERIFIED | Demonstrate dedicated SELECT-only credential, denied write in safe disposable test environment; never attempt mutation on production | 28 Oct |
| JAW-004 | Authenticated private live connection to published dashboard | NOT STARTED | Secure authenticated gateway, end-to-end live data and unauthorized-access denial test | 28-30 Oct |
| JAW-005 | Instant refresh, health-check and bridge recovery controls | NOT VERIFIED | Buttons with audited server-side actions, authorization, response receipts, UI E2E tests; no SQL writes | 28-30 Oct |
| JAW-006 | Daily 06:25 Asia/Amman true data freshness | NOT VERIFIED | Identify actual source tables/date fields, MAX actual business transaction/update timestamps, compute age and today status; do not substitute bridge health timestamp | 28-29 Oct |
| JAW-007 | Progress, subtasks, evidence, deviation and alerts | PLANNED | Live task records, weighted completion tied to passing acceptance gates, ETA/deviation, alerts | 29-30 Oct |
| JAW-008 | Independent off-host encrypted recovery route | NOT STARTED | Independent host/network, encrypted read-only snapshot, verified restore and RPO/RTO; never claim failover for full host outage until tested | 29-31 Oct |
| JAW-009 | Financial investigation and reconciliations | PARTIAL HISTORICAL / CURRENT NOT VERIFIED | Read-only validated datasets, ledger/check/bank/POS evidence joins, exception classification and reproducible calculations | 29-31 Oct |
| JAW-010 | Identity/device/time and forensic evidence | PARTIAL HISTORICAL / CURRENT NOT VERIFIED | Preserve original logs, correlate IP/device/user/action/time, hashes, chain of custody; do not attribute guilt without evidence | 29-31 Oct |
| JAW-011 | Jawafa Internal Control 360 | PLANNED | Verified weaknesses separated from hypotheses, control owners, detection, acceptance tests | 30-31 Oct |
| JAW-012 | Executive report, detailed report, Excel, PDF, PPTX, evidence ledger | PLANNED | Consistent reconciled figures, cited source hashes, reviewed final artifacts | 31 Oct |
| JAW-013 | Windows reboot survival | BLOCKED BY OWNER PROHIBITION | Only non-disruptive inspection of startup triggers; do not reboot | EXCLUDED |

## Daily milestones
- 27 Oct: reconcile evidence, validate existing local bridge, create this canonical register.
- 28 Oct: source-table timestamp profiling (read-only), 06:25 job, gateway architecture and credential boundaries.
- 29 Oct: secure live dashboard connection, verified refresh controls, independent recovery infrastructure discovery.
- 30 Oct: task/progress/alerts and read-only forensic analysis, non-disruptive recovery acceptance.
- 31 Oct: final evidence-led QA, Internal Control 360, reports and unresolved blocker register.
- 1 Nov: delivery and transparent open items; never auto-close unverified work.

## Financial analysis scope
Separate Markets, Bakery and Restaurant entities; match intercompany transfers and cheques; investigate reversed/reposted entries, bank reconciliations, POS sales, purchasing, expenses, custody, users and device/time evidence. Classification: CLEAR / NEEDS EXPLANATION / VERIFIED POLICY VIOLATION / MANIPULATION INDICATOR. A manipulation indicator is not a legal finding; requires evidence, provenance and human review.

## Acceptance evidence ledger (public-safe)
| Evidence ID | Test | Result | Boundary |
|---|---|---|---|
| EV-001 | Live Remote Desktop Commander device listing, 2026-10-27 | JAWAFFASVR Online | Does not prove permanent connectivity |
| EV-002 | GET local proxy /api/health, 2026-10-27 | ok:true; database Jawafa_DB | Not proof of least-privilege SQL login |
| EV-003 | GET /api/tables via local proxy, 2026-10-27 | HTTP 200; 1024 table metadata entries; primary route | Metadata, not transaction freshness |
| EV-004 | Controlled proxy process recovery, 2026-10-27 | PASS, process restarted, /api/health recovered | Not host outage/reboot test |
| EV-005 | Scheduled task inspection | Fallback and proxy Running; auto-recover Ready | Does not demonstrate scheduled end-to-end after reboot |

## Risk and open decisions
- Existing API's SQL account may be highly privileged; read-only branding does not enforce permissions.
- Public UI has no authenticated private bridge to localhost API.
- Local fallback shares same host, power, SQL and network; not an independent DR route.
- Daily freshness requires verified business-event timestamps; 06:25 automation must be implemented and tested.
- Public repo must never receive original accounting records, credentials, personally identifiable audit evidence, or private IP/user audit logs.
- Evidence and deliverables requiring sensitive source records belong in approved restricted storage, not this public repository.
