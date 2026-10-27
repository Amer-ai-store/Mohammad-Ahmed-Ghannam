# JAWAFFASVR monitoring integration — security contract

Status: **NOT DEPLOYED**. The public GitHub Pages dashboard is a frontend only.

## Required private gateway

Host the gateway on a private HTTPS origin, protected by identity-aware access (MFA), with session cookies scoped to the gateway, CSRF protection on POST, restrictive CORS to the dashboard origin, rate limiting, and audited requests. Never embed API keys or passwords in this public repository. Do not expose SQL Server to the Internet.

Allowlisted routes:
- GET /health — server and remote-agent status.
- GET /database/health — a SELECT-only query under a dedicated SQL login with db_datareader or narrower SELECT permissions. Do not use sysadmin, db_owner, or the disabled Windows Administrator login.
- GET /backups/status — metadata only, without exposing backup content or filesystem paths.
- GET /exports/status — scheduled-task result and verified output-file metadata.
- POST /connection/recover — restart only the existing Desktop Commander keepalive task after an authorized, logged request. Never restart SQL Server, change SQL permissions, or modify accounting rows.

All endpoints return JSON and must use Cache-Control: no-store. If identity, network, database permission, or monitoring agent is unavailable, return an explicit failure; never fabricate a green status.

## Verification gates

1. Verify private gateway identity and MFA and deny unauthenticated requests.
2. Confirm that all five dashboard buttons receive real responses from the private gateway.
3. Verify SQL identity with SELECT only and prove INSERT/UPDATE/DELETE are denied in an isolated test database, not production.
4. Verify the latest export artifact timestamp and hash, not only Task Scheduler result 0.
5. Simulate loss of the primary agent in a controlled maintenance window, then verify recovery using a separate, independent channel.
6. Record request IDs, UTC timestamps, response status, and reviewer sign-off.

Until all gates pass, keep PR in draft and do not claim operational recovery.
