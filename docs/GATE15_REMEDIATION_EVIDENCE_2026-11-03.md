# GATE-15 remediation and evidence gate — 2026-11-03

Status: **BLOCKED / NOT ACCEPTED**. This document is a non-production remediation checklist, not evidence of implementation.

## Immutable safety constraints
- Jawafa_DB and original financial/accounting records remain read-only; no DML, DDL, SQL/Windows restart, production deployment, or secret publication.
- Issue #102 production freeze remains in force until independently proven released by authorized approval.
- No production write-probe: test SQL denial only against an isolated disposable fixture.
- Public artifacts contain only redacted IDs, hashes, timestamps and pass/fail; raw records and credentials remain in restricted evidence storage.

## Gates and executable acceptance checks

| Gate | Required action | Independently verified acceptance evidence | Status |
|---|---|---|---|
| G15-01 SQL privilege | Provision dedicated SELECT-only identity in approved change window; isolate existing privileged credential | Effective SQL grants and denied INSERT/UPDATE/DELETE/DDL against disposable DB fixture; read-back SELECT success | BLOCKED |
| G15-02 Private HTTPS | Deploy authenticated private gateway only after release approval | TLS certificate, authenticated route, unauthorized 401/403, RBAC owner/operator/viewer E2E | BLOCKED |
| G15-03 Bridge | Align documented `/api/jawafa/v1/dashboard` and `/api/jawafa/v1/tasks` with live route mapping; no anonymous access | Correlated gateway request ID, authorized bridge receipt, safe read-only task/health command, UI read-back | BLOCKED |
| G15-04 Host time | Investigate W32Time NoSync and measured offset; agree controlled correction window with accounting/IT | Three independent time sources, before/after signed offsets, monotonic event correlation; no unapproved abrupt time jump | BLOCKED |
| G15-05 Freshness | Identify actual source transaction timestamps | Read-only MAX(event_timestamp) by entity/table at 06:25 Asia/Amman with timezone, row-count and query hashes | BLOCKED |
| G15-06 Recovery | Create off-host encrypted copy and restore into isolated environment | Restore receipt, integrity checks, independent reviewer, measured RPO/RTO | BLOCKED |
| G15-07 Financial | Read-only reconciliations for bank/cheques/ledger/POS | Reproducible queries, source hashes, exception review and sign-off | BLOCKED |
| G15-08 Deliverables | Produce executive/detail/Excel/PDF/PPTX, conversation source index | Artifact IDs, hash manifests, private visibility/deduplication E2E, reviewer sign-off | BLOCKED |

## Recommended non-production verification sequence
1. Record exact Git commit SHA, Vercel deployment ID, host time source and bridge process version.
2. Reproduce documented route 503 and generic commands 404; collect sanitized request IDs and server-side error categories without private payloads.
3. Fix route mapping and authorization on isolated branch/test environment. Run tests for 200 authorized, 401 unauthenticated, 403 wrong role, 503 downstream unavailable; ensure fail-closed.
4. Prove SQL least privilege on isolated fixture. Never mutate production database to test permissions.
5. Prove private HTTPS E2E and command receipts on staging. Confirm no access via public Pages or separate app.
6. Run independent restore and source financial reconciliation acceptance, then secure approvals and only then consider production deployment.

## Evidence schema
`gate_id | source_url | evidence_id | observed_at_utc | observed_at_Asia/Amman | tested_sha | environment | tester | result | independent_verifier | scope | limitation`

No gate may be marked accepted on PR merge, green CI alone, checkboxes, HTTP 200 root page, local health, or export success.
