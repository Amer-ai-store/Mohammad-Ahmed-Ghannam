# JAWAFFASVR SQL API verification — 2026-10-27

Verified remotely on JAWAFFASVR:
- SQL TCP 1433 reachable locally.
- TRUSTSOFT API TCP 3456 listening.
- GET http://127.0.0.1:3456/api/health returned HTTP 200 and JSON `ok: true`, `message: Connected to SQL Server`, `database: Jawafa_DB`, `user: sa`, `mode: FORENSIC-READ-ONLY`.
- GET http://127.0.0.1:3456/api/tables returned HTTP 200 and `ok: true` with actual SQL table metadata (`Customers.Area`, `Customers.Province`, etc.). This proves SQL metadata SELECT is operational.
- No password contents were read, transferred or committed.

**NOT VERIFIED / SECURITY BLOCKERS**
- The API's read-only banner does not establish that SQL login `sa` is restricted: `sa` is privileged. Migrate to a dedicated read-only SQL principal before production use.
- API was observed listening on 0.0.0.0:3456; verify authentication, authorization, CORS, TLS, and network exposure. Do not expose financial data endpoints publicly.
- Public static AppDeploy frontend is NOT directly connected to this private HTTP API; browsers on HTTPS cannot safely fetch private LAN HTTP endpoints. Use an authenticated HTTPS reverse proxy/private tunnel with access controls and allowlisted endpoints only.
- The GitHub repository must contain code and non-sensitive verification notes only, never SQL passwords or raw accounting records.
- No destructive database commands authorized.
