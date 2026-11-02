# AUDIT-111 — Integration contract and acceptance tests

Status: **NON-PRODUCTION DRAFT**. Follows Issues #102 (freeze), #91 (private HTTPS/least privilege), #57 (GATE-15). Do **not** merge or deploy until private gateway, IAM and E2E acceptances are independently verified.

## Sources and precedence
1. TrustSoft native history source `dbo.InvPurchaseVouchersTransactionHistory`: inspect its exact exported `TransNo`, `TransSeqNo`, `TransDate`, `TransTime`, `ReceiptNo`, `BranchNo`, `UserId`, `ComputerName`, `WindowsLoginName`, `TypeNo`, `TransactionDesc`, `OldValue`, `NewValue`, `OldValueNo`, `NewValueNo`, `RecLineNo`. Some events may be creations or item-level actions and are not confirmed modifications.
2. Generic `dbo.TransactionHistory` can provide operation-to-module context after explicitly verifying identifiers and completeness.
3. Supplier invoice and purchase-return masters, journals, cheque payments and deposits require schema and document ID mapping; no fabricated joins.
4. `dbo.USER` lookup: take ONLY `Uno`, `Una`, `Ufullna`. NEVER import `Upass` or contact fields; an account name is not verified human identity.
5. Export manifest must match SHA256 and byte length before ingest; append new source snapshot, never overwrite old history. Distinguish event timestamp from discovery timestamp and observed history from absence of logs.

## Private storage
Run `tools/audit111/import-history.mjs EXPORT_DIR PRIVATE_DIR` only on authorized JAWAFFASVR, with private directory ACL and no database production modifications. Source SQL is not queried by this importer. `link-users.mjs` optionally maps historical numeric system-account IDs, without importing passwords. `verify-archive.mjs` checks SHA256 provenance, SQLite integrity, ID uniqueness and append-only chain. Store real `.sqlite` and records **only** on a private encrypted-at-rest host after encryption/access verification, NEVER in this repository. The initial archive is ACL-restricted; encryption-at-rest has **not** been independently verified.

Archive is versioned append-only with immutable SQLite triggers. Do not assume a SQLite trigger withstands administrator tampering: secure external backup, hash receipt, privileged action log and periodic independent hash verification remain acceptance requirements.

## Dashboard integration
- Central dashboard path: `#jawafa-audit111`, already within existing `dashboard/index.html` navigation. No separate public app.
- UI never directly connects to SQL; only authenticated owner route `GET /api/jawafa/v1/audit/111?limit=500` when an approved PRIVATE gateway actually exists.
- Backend does **not** exist yet. On GitHub Pages this endpoint must fail **closed** with `NOT_CONNECTED` / `NOT_AUTHENTICATED`; no false data, fabricated green state or localStorage copies.
- Envelope `jawafa.audit111.v1` with `classification=PRIVATE_FINANCIAL_AUDIT`, `private_access_verified=true`, `source_integrity_verified=true`, `snapshot_id`, `verified_at`, up to 500 `events`, each containing typed ID, source SHA, provenance, severity and evidence grade. Validate authorization, identity and source integrity server-side; client fields cannot independently establish trust.
- For account mapping return `system_user` and `actor_verified=false` until device logs + session receipts + approvals corroborate identity. Do not claim human responsibility from a shared Windows or TrustSoft account.
- HTTPS/TLS and auth E2E, 401/403 tests, source SHA/hash-chain readback, clock source validation, data retention and off-host backup must pass before any private finance UI is accepted.
- Risk P0/P1/P2 means **triage only**, not proven tampering. Diff-only detections must not be promoted to VERIFIED.
- Controlling read-only data source and administrator access must be independently proven before adding server-side audit endpoints.

## Test receipt
`node --test dashboard/tests/audit111.test.mjs` — 8/8 synthetic privacy, error, schema, hash, attribution and filter tests passed on JAWAFFASVR using Node 24; `node --check dashboard/audit111-ui.mjs` passed. This does **not** satisfy private API / live dashboard / mobile E2E.

## Done criteria
- [x] Immutable isolated historical importer and source manifest comparison code
- [x] Private archive verification code
- [x] Restricted user ID label lookup code (no passwords)
- [x] Dashboard native view and code-level navigation
- [x] Synthetic model checks
- [ ] Private authenticated API and server-side response validation
- [ ] Signed immutable/off-host audit receipts and storage encryption evidence
- [ ] Correct historical document joins, operation classification and clock verification
- [ ] Acceptance tests with real authenticated access; release freeze cleared

## 02 Nov 2026 — additional independent execution evidence (PRIVATE CASE DATA NOT PUBLISHED)

- Imported the source-verified native TrustSoft operation dictionary into a **separate immutable policy table**. Risk labels now derive from `TypeNo` rather than the earlier text-diff-only heuristic. These are triage flags, not findings of wrongdoing.
- Independently rechecked every classification against the manifest-verified dictionary; classified event counts and original source chain reconcile with the private archive receipt.
- Compared audit history document keys with manifest-verified `Receipt`, `InvoiceMain`, `ARPReturns` and `Journal_GL`. Exact identifiers are only candidate joins until fiscal period/branch/type validations are complete.
- Appended separate source-hash-verified purchase-invoice **note-change** history, with before/after note fields and a new independently verified immutable hash chain. This older note source does **not** establish purchase-return modifications.
- Scanned the general `TransactionHistory` historical CSV in a bounded-memory reader, compared candidate IDs with return masters, and checked SHA256 against export manifest. A matching transaction key does not show a return amount before/after or prove a human modification.
- Added `AUDIT-111` as one new `IN PROGRESS` task in the isolated operational task registry; it is separate from the 97 historical AppDeploy reference tasks and remains blocked by the release/private HTTPS/E2E gate.
- Existing `jawafa-command-bridge/server.cjs` now has a staged GET `/api/jawafa/v1/audit/111` handler using the authenticated owner scope. **Default disabled** unless the review-only instance is explicitly injected with the reader and independent release switch. The public GitHub Pages deployment still has no real private API.
- Tests: command bridge plus private audit route 9/9 PASS using synthetic QA identities, direct read-only historical archive reader QA PASS with original SHA/chain checks, and immutable note-source verifier PASS. None constitutes public HTTPS/mobile E2E or permission to deploy under #102.
- Source SQL stays unchanged. The Windows integrated SQL login was refused by SQL Server in an earlier read-only connection check; `sa` access was not demonstrated. No secrets, staff names, financial amounts, raw note contents or archive `.sqlite` files are committed.
