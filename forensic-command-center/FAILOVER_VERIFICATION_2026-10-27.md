# Verified local API failover on JAWAFFASVR — 2026-10-27

Original API unchanged on port 3456. A second Node API `server-fallback.js` runs on 127.0.0.1:3457 and reports `ok:true`, database `Jawafa_DB`. A local-only failover proxy listens at 127.0.0.1:3458 and allows GET `/api/health` and `/api/tables`, preferring primary 3456 then fallback 3457 on primary failure. Windows scheduled tasks `GuavaFallbackAPI` and `GuavaFailoverProxy` run as SYSTEM at startup. Existing `GuavaBridgeHealthMonitor` checks health every 5 minutes.

**Actual verification:** `http://127.0.0.1:3458/api/health` returned HTTP 200. A non-disruptive simulated primary failure using test proxy on port 3459 (primary target deliberately unavailable, fallback 3457) returned HTTP 200, `X-Guava-Route: fallback`, `ok:true`, `database:Jawafa_DB`.

**Limitations:** No external HTTPS dashboard integration; proxy only localhost. No tested server power-off/reboot scenario; startup tasks configured but reboot persistence not yet verified. Both APIs share the same SQL Server, host, filesystem and password source; this is API-process failover, not independent server/SQL disaster recovery. SQL login `sa` remains privileged. No Windows firewall/security/SQL configuration changes were made. Do not treat as guaranteed uninterrupted connectivity or a forensic finding.
