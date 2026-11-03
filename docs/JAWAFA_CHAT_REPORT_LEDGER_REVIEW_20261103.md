# Jawafa — ChatGPT conversation reports → existing command dashboard (review only)

**Target:** `dashboard/index.html#jawafa-reports` in the EXISTING unified panel. The current review branch inherits the AUDIT-111 screen from PR #117. No duplicate dashboard, SQL DML, public financial ledger, or production release.

## Privacy and evidence boundary

The private Google Drive master ledger, its subreports, cheque numbers, monetary values, individuals, bank exports, and source evidence MUST stay in owner-controlled Drive or an authenticated private backend. **Never** put report IDs, private Drive document URLs, raw JSON, keys, email identities, bank amounts, or evidence rows in public GitHub, Pages or non-authenticated preview assets.

The implementation now includes an owner-authenticated Node serverless endpoint in a protected Vercel **preview**. It does not claim live production readiness or cross-chat synchronization. It displays `PRIVATE_GATEWAY_REQUIRED` on `*.github.io`, and `NOT_AUTHENTICATED` or a typed failure on an unconfigured private host. No stale records, mock financial values or cached proof may appear as live.

## Contract (implemented in protected preview only — owner E2E NOT VERIFIED)

`GET /api/jawafa/v1/chat-report-ledger` from the **same-origin, private HTTPS gateway**, with the owner's verified Firebase ID token in the Authorization header and credentials `same-origin`. Server MUST verify token issuer, audience, expiry, revocation where available, owner allowlist and `jawafa.reports.read` authorization for **each request**. It MUST NOT trust the JSON `access` flag by itself. Apply rate limits, `Cache-Control: private, no-store`, `Vary: Authorization`, `X-Content-Type-Options: nosniff`, restrictive CORS, auditing of report access with no raw contents, TLS, and disable public Pages routing to the private API.

Example **SYNTHETIC ONLY** (no actual financial or private file identifiers):

```json
{
 "schema":"jawafa.chat-reports.v1",
 "access":{"authenticated":true,"role":"owner","scope":"jawafa.reports.read","gateway":"private"},
 "source":{
  "kind":"google_drive_private","integrity":"verified","time_authority":"independent_utc",
  "snapshot_id":"synthetic-demo","verified_at":"2026-11-03T00:00:00Z",
  "expires_at":"2026-11-03T01:00:00Z",
  "source_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 },
 "reports":[{
  "id":"synthetic-report","title":"تقرير اختباري","category":"موجز",
  "state":"PARTIAL","evidence_status":"DIFF_ONLY",
  "evidence_id":"synthetic-proof","as_of":"2026-11-02T22:00:00Z",
  "summary":"محتوى اصطناعي؛ لا بيانات مالية أو أسماء حقيقية",
  "url":"https://docs.google.com/document/d/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/edit"
 }]
}
```

The backend MUST read the owner-only master report and latest dated evidence reports; build an append-only versioned ledger with source hash, source cutoff, verified timestamp from an independent UTC clock, classification (VERIFIED/PARTIAL/DIFF_ONLY/UNVERIFIED/NOT_ACCEPTED/BLOCKED), report and evidence IDs, count, and owner-only document URL. Do not replace historical revisions. An absent source or failed verification yields `503` or an explicit BLOCKED record; NEVER a fabricated success. Verify document metadata & owner-only sharing, SHA256 or equivalent source signature, access history, and pagination. A document's existence does not prove every cheque or user claim.

No direct ChatGPT cross-conversation API or automatic import is proven. Only **verified reports that were actually written to private Drive** become eligible sources; each source must have a receipt ID/time/hash. Agent summaries cannot self-attest final acceptance. The master report, per-report state, source ID, and `evidence_status` are distinct concepts.

## Acceptance test gates before any release

1. `node --test dashboard/tests/jawafa-chat-reports.test.mjs` → successful isolated positive and negative tests.
2. Inspect `dashboard/index.html` for a **single** existing `jawafa-reports` screen and its added sibling panel; ensure `jawafa-integration.js` dynamic pane does not destroy the ledger UI. Preserve AUDIT-111 and existing navigation.
3. On public GitHub Pages confirm no private fetch, no private URLs in HTML/source, status `PRIVATE_GATEWAY_REQUIRED`.
4. Private authenticated browser (owner): validated fresh envelope, report filter and owner-only Drive links open; unauthorized and expired sessions get 401/403; access denied does not leak any title/link.
5. Negative E2E: invalid schema, stale snapshot, duplicate IDs, source hash missing, malicious URL, non-JSON response, network timeout, public origin, logout, expired token -> fail-closed and clear prior view.
6. Independent QA/Security, private gateway HTTPS, account least privilege, and #102 deployment freeze sign-off; no production merge or deployment before those acceptance receipts.

**Current state (2026-11-03):** Protected Vercel preview deployment `dpl_GCn1PWjn7XAKF5E9bx4RPkAd6qUP` is READY on non-production branch. GitHub CI has 18/18 unit/negative tests passing (`41559782051`; later run `41560689264` successful). Anonymous checks of both the HTML and API return `login_required` at Vercel SSO. The owner mobile OAuth grant, actual Google Docs read returning 10 private reports, and full 401/403 E2E remain UNVERIFIED. Provider-driven token refresh, Firebase preview authorized domain, Google OAuth consent scope and Docs API enablement may need administrative actions; Firebase connector is not connected. The backend uses in-memory user-delegated `documents.readonly` OAuth and Google userinfo identity confirmation; it does not store service account credentials. OAuth tokens are not written to logs or storage. Source integrity uses a SHA-256 digest computed from the freshly fetched private registry document; it is not an independently signed financial proof. Preserve #57/#91/#102/#116 and never merge/deploy to production until independent acceptance. No report or accounting source has been modified.
