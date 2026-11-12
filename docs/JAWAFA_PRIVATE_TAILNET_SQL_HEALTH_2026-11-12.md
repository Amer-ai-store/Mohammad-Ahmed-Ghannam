# JAWAFA private Tailnet SQL health integration — 2026-11-12

Status: **PRIVATE_NETWORK_PATH_DEPLOYED / LOCAL_SQL_READ_VERIFIED / FINANCIAL_KPI_PRODUCTION_BLOCKED**.

## Trusted paths
- Approved public/static central dashboard: `https://amer-ai-store.github.io/Mohammad-Ahmed-Ghannam/` (no financial API or credentials).
- Private Tailscale Serve HTTPS (tailnet ACL, not Funnel): existing host :8445 → loopback Node gateway `127.0.0.1:3462`.
- Same exact dashboard code mirrored at **`/central/index.html#jawafa`** and **`/central/index.html#jawafa-2100`** under the private origin. The gateway fetches static assets exclusively from the approved GitHub Pages path; it does **not** forward Firebase tokens to GitHub Pages.
- Owner-gated `GET /api/jawafa/v1/sql-health` on the private HTTPS origin authenticates each request against the existing cryptographically verified owner-only Firebase bridge `127.0.0.1:8788`. It does not trust a claimed UID from query parameters.
- After owner authorization, the backend's Windows service session calls the already-running Windows Integrated Authentication reader `http://127.0.0.1:3467/health`. That API internally connects with the DPAPI-protected `user_read`; the new gateway has no SQL credential and executes no SQL commands itself.
- Status-only JSON: `schema=jawafa.sql-connectivity.v1`, SQL login, roles, TLS state and timestamp. No private finance rows, bank statements, credentials or modification commands.

## Verified live checks
- SQL source `JAWAFFASVR/Jawafa_DB`: `GET /health` with the authorized local Windows identity returned HTTP 200, `login=user_read`, `reader=1`, `writer=0`, `mode=READ_ONLY_LOCAL`, `ok=true`.
- Restricted fixed-query read `GET /api/sales/aug05-08` returned HTTP 200 and `mode=LIVE_READ_ONLY`. Previous local acceptance evidence compared four historical days (4/4). This **does not** validate all financial aggregates.
- SQL TLS: `LOCAL_ENCRYPTED_CERT_CHAIN_NOT_VERIFIED` — NOT production-accepted. SQL listener has `ForceEncryption=0`, no selected certificate, and no suitable Server Authentication certificate present.
- The local reader runs under an interactive Administrator scheduled task. System-scope DPAPI test previously failed; separate service identity is NOT provisioned.
- Existing bridge `8787`: HTTP 503 `OWNER_UID_NOT_CONFIGURED`. Existing owner-authenticated preview `8788`: invalid bearer HTTP 401 `TOKEN_INVALID`. The approved preview was reused rather than bypassing authentication.
- Tests of the independent router on local `3468`: seven Node tests passed. Source-only candidate on `3469`: old root HTTP 200, central mirror HTTP 200, ERP script HTTP 200, export monitor HTTP 200, unauthenticated SQL health HTTP 401, POST HTTP 405, path traversal HTTP 404, invalid owner bearer HTTP 401.
- Live existing private gateway on `3462`: backup created first, syntax and test suite passed, service restarted with existing watchdog and post-restart central mirror HTTP 200.
- Private HTTPS :8445 readback with default certificate verification: central mirror HTTP 200, ERP JS HTTP 200, export monitor HTTP 200, owner-only SQL health HTTP 401 without credentials, existing owner bridge HTTP 401 without credentials.
- No successful authenticated owner JWT request to `/sql-health` has been observed in this run; do not assert full browser E2E or production-financial connectivity.

## Source and rollback
- Router source: `jawafa-private-tailnet/secure-central-router.cjs` in repository. Local installed copy: `C:\ProgramData\Jawafa\SecureCentralPreview\secure-central-router.cjs`.
- Gateway insertion (only for `/central/*` and `/api/jawafa/v1/sql-health`): `C:\Export\jawafa-private-dashboard\gateway.js`, with original root, /api/export-status and /api/jawafa/v1/* routes preserved.
- Pre-change rollback copy: `C:\Export\jawafa-private-dashboard\gateway.js.bak-20261112-pre-sql-health`; prechange SHA256 `7136DA31AFE0FF986544BE2A2EDB092D1CCA83E7D0AD7AB4182B33370118413C`.
- Live gateway postchange source SHA256 `D651D63EFA6E6FBD7FF181E03A3E6C8D2CAAB46AB002C15DC6F8082109BB8B30` (verify against actual file before any rollback).
- No SQL service, database schema, accounting numbers, or Tailscale Serve ACL/ports were changed.

## Remaining acceptance gates
1. Complete SQL certificate trust chain: a valid Server Authentication EKU certificate with correct SAN, legacy provider/KeySpec where required by the SQL Server version, SQL service private-key permission; plan a controlled SQL Server restart/rollback after verified backup. Do not switch production to `TrustServerCertificate=True` to silence the warning.
2. Convert the local SQL reader from interactive Administrator to an independent least-privilege Windows service identity, with securely re-provisioned DPAPI secret for that identity. Do not copy an Administrator DPAPI blob to SYSTEM.
3. Replace broad `db_datareader` table scope with approved SELECT-only views, then test deny INSERT/UPDATE/DELETE in a rollback-protected environment.
4. Obtain an actual owner-signed Firebase JWT session at the private Tailnet origin, verify owner-only `/sql-health` returns 200 and non-owner returns 403; ensure Firebase authorized domain/redirect configuration is correct.
5. Validate SQL KPI view mappings and provenance, finance acceptance/GATE-15, backend production readiness, independent security QA, and browser E2E. Only then allow `/api/jawafa/v1/performance` to return real aggregated numbers.

**No live financial amount is published while these gates remain open.**
