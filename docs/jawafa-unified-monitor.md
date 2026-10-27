# Unified Jawafa monitor — private API contract

The existing `dashboard/index.html#jawafa-monitor` now contains the single integrated monitoring screen. It never connects to the SQL Server directly, and it does not embed credentials.

## Required private service

An authenticated HTTPS service, reachable only through a private gateway, must implement `GET /snapshot` and respond with:

```json
{
  "mode": "FORENSIC-READ-ONLY",
  "generatedAt": "2026-10-28T00:00:00+03:00",
  "serverStatus": "online",
  "trustsoftEvents": [
    {"device":"PC05","windowsUser":"user","trustsoftUser":"29","time":"2026-10-28T00:00:00+03:00","operation":"FunctionId:123","voucher":"voucher number","evidenceId":"TransactionHistory:stable-key"}
  ],
  "sessions": [
    {"device":"JAWAFFASVR","account":"Administrator","time":"2026-10-28T00:00:00+03:00","event":"Windows Security EventRecordID:123"}
  ],
  "alerts": [
    {"time":"2026-10-28T00:00:00+03:00","source":"Windows / SQL / OpenAI email","message":"Verified alert"}
  ]
}
```

## Acceptance / forensic controls

- Poll every 10 or 15 seconds, from the **private gateway**; only one request in flight.
- Use indexed keyset/watermark queries over `dbo.TransactionHistory` and `dbo.InvPurchaseVouchersTransactionHistory`; do not use unordered OFFSET pagination or repeatedly scan the entire history.
- Preserve device/Windows login as primary grouping, and distinguish TrustSoft activity events from actual Windows/SQL login sessions.
- Do not claim complete SQL/Windows audit without configured and retained source audit logs.
- Bind only to localhost or a protected private interface; require authentication, restrict CORS, rate-limit, and enforce read-only SQL permissions.
- Do not deploy the existing unrestricted TrustSoft bridge publicly: it currently allows broad CORS and uses a shared `sa` credential.
- The front-end intentionally **refuses non-HTTPS endpoints**; no localhost HTTP mixed-content bypasses.
- No fake fallback data. All displayed values must come from a validated source.
- Before enabling remote access, complete authenticated private HTTPS gateway + real end-to-end tests + independent security review.
- Financial and quantity data are never written or corrected by this monitoring system.

## Status

Front-end integrated in the dashboard on a feature branch. **Not production ready** until the private API is deployed and its authentication, query load, and event provenance are tested.
