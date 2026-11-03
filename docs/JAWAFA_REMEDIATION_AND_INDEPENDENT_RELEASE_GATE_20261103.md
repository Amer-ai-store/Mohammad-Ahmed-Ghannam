# Jawafa unified command center — dependency-based repair and independent release handoff
Date: 2026-11-03. This is a **source-only, non-production** plan, not an announcement of acceptance or a second dashboard. Do not publish private audit evidence, Google Drive identifiers, tokens, SQL records or Tailscale hostnames in this public repository. Never mutate Jawafa_DB/accounting/inventory originals or reboot JAWAFFASVR/SQL.

## Verified initial constraints
- PR #67 already merged: `ab71487dd23b52fc1d2fc5d7667bde85bb4573b4`. Preserve **existing** `dashboard/index.html`, native navigation, Firebase flow, UI sections, buttons, historical cases and agent IDs; never produce a parallel dashboard or regress to an iframe.
- PRs #53/#65/#66 are historical draft changes with merge conflicts; #68 overlaps the already merged #67. Compare each to current main and extract **only independently tested missing deltas**. Do not resolve by overwriting the newest dashboard.
- PR #117 introduces AUDIT111/AUDIT15 review-only components. PR #123 is stacked on #117, not main: resolve/review #117 first, then #123, preserving owner-only report constraints and private 10-report Drive registry. Synthetic owner tokens and `READY` preview do not establish live acceptance.
- Main already uses `Safe code review CI (no Claude OAuth)` at `.github/workflows/claude.yml`. Old paid-Claude variants must not be merged merely to fix stale OAuth/missing-credit errors. PR #141's three-dot merge-base correction passed four CI jobs, but the automated Codex review could not complete (usage limit): obtain a distinct code/security review before calling it independently accepted.
- Issue #129 records historic 10 conflicts, 10 DCO blocks and CodeQL high findings in #66/#68. **Recheck at exact current SHA and alert file/line**. DCO needs actual contributor sign-off; never forge author certification or disable the gate. Provider billing errors are not code passes.
- Issue #57 remains evidence-gated; #91 lists SQL privilege and source-integrity hazards. Issue #102 release freeze remains controlling. One blocked Vercel attempt proves only that attempt was blocked, not every provider or alias.
- AUDIT15 prior 15/15 SHA/physical-row consistency is partial technical evidence, not financial acceptance. Keep 7 FULL and 8 DELTA distinct; deduplicate TransactionHistory on TransNo. Prove failed export-table recovery, SQL least privilege, source reconciliation and encrypted off-host restore separately.

## Root-cause repair / sequencing matrix

| Priority | Work package | Repair criteria | Independent exit evidence |
| --- | --- | --- | --- |
| P0 | Release isolation | Inventory Pages, Vercel, Railway, Cloudflare, Supabase, app stores, build hooks, aliases, GitHub workflows and provider tokens; add guarded production environments without bypass | Read-only inventory, enforced deny tests and protected approval per route; Issue #102 not closed until independently verified |
| P0 | CI security and review | Choose a single free deterministic Node24 review; fix PR-diff base, original DCO sign-offs, CodeQL high exact source, provider integration failures; do not fake paid AI reviews | Exact-head required CI PASS, CodeQL no new high, independent human/agent security review |
| P0 | Authentication | Verify real Firebase owner token and owner UID private binding; verify trusted issuer/expiry; owner controls Google Docs consent `documents.readonly` | Real 401 anonymous, 403 unauthorized, 200 owner, 405 unsafe POST; no public disclosure and no temporary token logging |
| P0 | Private HTTPS + E2E | Validate authorized private reverse proxy without reusing Windows port 443; test owner Android and desktop; preserve Funnel disabled | TLS chain, real browser screenshots/log evidence, matching exact SHA and private gateway authorization |
| P0 | Command Bridge | Test authenticated same-origin read-only commands, authorized agent claims, idempotent ACK/RUNNING, verifier-bound signed QA receipts; financial writes remain blocked | Independent actual end-to-end receipts, negative role tests and source hashes, no fake VERIFIED |
| P1 | PR integration | Reconcile #53/#65/#66/#68 into #67 without duplicate UI; rebase #117 then #123; fix navigation and user-visible access controls in draft | Full button/agent/page inventory, no lost history, mobile 390x844 and desktop E2E, source IDs and duplicate suppression |
| P1 | GATE15 and SQL | Verify SELECT-only SQL role using a disposable test DB for denied mutation; compare 15 FULL/DELTA exports, failed tables, timestamps, finance exceptions | Independent per-table SHA/count proof, real time authority, approved accounting reconciliation |
| P1 | Disaster recovery | Encrypt off-host copy and restore onto isolated disposable host only; never restore over production | Verified round-trip SHA, separate operator review, RPO/RTO measurements |
| P1 | Deliverables | Build executive, detailed, Excel, PDF, PPTX, provenance/conversation index from private validated sources | Review of all source hashes/IDs, consistent calculations, dashboard visibility/duplicate tests |
| P2 | Independent release | Present only after exact current SHA + all independent evidence + provider route protections + rollback plan | Trusted reviewer-signed manifest, different release operator verification, formal owner/security release permission |

### Independent preflight script — no deployment powers

`tools/release/independent-preflight.mjs` validates a separately stored, signed JSON evidence manifest using a privately pinned independent reviewer's **Ed25519 public key**. It rejects missing gates, stale evidence, altered bytes, wrong SHA, self-approval and duplicate IDs. A cryptographic signature proves key possession and bytes only; the independent reviewer MUST examine source records, test results, artifacts and key identity out of band. The script has no network, SQL or release calls; no secrets, tokens, UID, private links or signed manifest belong in git.

**Reviewer trust anchor (mandatory):** `JAWAFA_TRUSTED_REVIEWER_SPKI_SHA256` must be pre-enrolled by the independent security reviewer in a separately protected execution environment. It is the SHA-256 fingerprint of the approved Ed25519 public key's DER-encoded SPKI bytes. If absent or not matching, the preflight refuses the signature even when the signature is cryptographically valid. The release operator must not select or overwrite this value. Environment ownership/protection and the reviewer's real identity still require out-of-band independent audit; the script cannot prove them alone.

Run locally/privately:
```sh
node --test tools/release/independent-preflight.test.mjs
node tools/release/independent-preflight.mjs --manifest /private/acceptance.json --signature /private/acceptance.sig --reviewer-public-key /private/independent-reviewer.pub --sha <exact-40-character-commit>
```

Fail closed on nonzero exit. A successful structural check does **not** authorize or execute deployment; a new merge SHA requires fresh evidence/signature. After independent approval, the release operator must verify each protected publish route, merge reviewed PRs in dependency order, rerun exact-SHA checks, obtain a final signature for the release SHA, execute approved protected deployment, and perform live HTTPS/owner/phone/Bridge verification. Until then: `BLOCKED_BY_ACCEPTANCE`.

Primary references: [Issue #57](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/57), [#91](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/91), [#102](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/102), [#129](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/129), [PR #67](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/pull/67), [#117](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/pull/117), [#123](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/pull/123), [#126](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/pull/126), [#141](https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/pull/141).
