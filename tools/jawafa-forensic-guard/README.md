# Jawafa Forensic Guard

Standalone **read-only** Windows auditing companion for Jawafa. Independent code; not a replacement for licensed TrustSoft ERP.

Build `Program.cs` on Windows using .NET Framework `csc.exe` and `System.Web.Extensions.dll`. Commands: `self-test`, `health`, `inventory` (see `--help`).

## Security and exit codes

- `self-test` (exit 0 when successful) verifies the **application-only** operation allowlist, strict CSV parsing, and HTTP authorization-response classification. It **does not** inspect actual SQL Server GRANT/REVOKE privileges.
- `health http://127.0.0.1:3456` probes only the local bridge. It regards *any* HTTP 2xx response to unauthenticated `/api/tables` as exposed, HTTP 401/403 as access denied, and network errors, redirects, 404 and other outcomes as **unknown** (fail closed).
- `health` returns **2** for an observed critical or unknown risk, **4** when bridge indicators look acceptable but independent SQL least-privilege verification is still missing, and **3** if command execution fails. It cannot return an unqualified production security approval.
- `inventory` compares inferred historical metadata counts with strict logical CSV record counts and writes a separate JSON report plus a SHA-256 for that report. Mismatches return 2; execution errors return 3. **Historical inferred counts are not live database counts.**
- Neither the status response nor a GitHub Actions green check proves secure SQL permissions, encrypted recovery, real-time financial reconciliation, or production deployment.

Keep input exports and generated reports in an authorized restricted local folder. Do not publish CSV originals, credentials, raw financial data, or secrets in GitHub. Never execute SQL mutations or change TrustSoft binaries. Complete independent SQL login/permission and live bridge access-control verification before accepting the security gate.

Historical snapshot differences cannot reconstruct missing prior values; a separately authorized source audit mechanism is required for historical attribution.
