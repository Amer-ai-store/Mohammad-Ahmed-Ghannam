# Jawafa_DB `user_read` — read-only security gate (M14)

**Status:** Source-only verification tooling. A Windows CI self-test is NOT a
successful connection to `Jawafa_DB`. Keep this gate BLOCKED until an approved
operator produces an independently reviewed, in-server live test result.

## Separate source systems

- `Jawafa_DB` is the **original SQL Server reference**. Its login MUST be
  `user_read`, never `sa`, for read-only dashboards, reference matching and agents.
- The **new ERP** uses a separate PostgreSQL schema and OIDC/RLS. Never put
  SQL Server passwords or DPAPI files in the new ERP database, CI, Flutter,
  GitHub, Google Drive, or a browser. A PostgreSQL test is not proof of
  permissions on original SQL Server.
- The central dashboard is publicly hosted; it MUST use a private authenticated
  backend API. Direct database connections from a public page are prohibited.

## Guardrails implemented

`tools/verify_user_read_policy.ps1` performs only identity, database,
role, metadata-permission and allowlisted-view **SELECT** queries. It:

1. Loads an encrypted **PowerShell PSCredential** from the original Windows
   server using DPAPI, in the authorized Windows service identity context.
   The secret pathname is constructed **on that server**, and the password
   remains a SecureString passed to SqlCredential. Credentials are never
   printed or written to a command argument, log or file.
2. Rejects any account other than **exact** `user_read` or database other than
   `Jawafa_DB`; never falls back to `sa` or Windows admin authentication.
3. Uses `Encrypt=True;TrustServerCertificate=False` and refuses to mark a
   failed certificate/SQL connection as successfully verified.
4. Evaluates effective sysadmin, db_owner, db_datawriter, db_ddladmin,
   database/schema/object mutation permissions; does **not** execute a test
   INSERT, UPDATE, DELETE or ALTER against original data.
5. Rejects broad `db_datareader` as **not least privilege** for production:
   that role usually reads every user table, whereas the authorized design
   requires only explicitly approved views/tables. Merely having a
   `user_read` name does not make a connection sufficiently restricted.
6. Requires a DBA-reviewed, explicitly supplied allowlist of approved
   schema-qualified views. Nothing is guessed or authorized automatically.
7. Emits only aggregate counts, boolean verdicts and safe error categories;
   never actual transaction rows, invoices, account IDs, tokens or secrets.

## Synthetic CI — safe to run publicly

`powershell.exe -NoProfile -NonInteractive -File jawafa-erp-ai/tools/verify_user_read_policy.ps1 -SelfTest`

The Windows CI workflow `jawafa-user-read-policy.yml` parses the script and
runs safe synthetic positive/negative cases **without loading secrets or
contacting any database**. It verifies that a wrong SQL identity, broad
reader grant, elevated write role, missing view grants or untrusted TLS
fails closed.

## Conditions before live dashboard integration

- Approved private network route, Windows service identity permitted by
  DPAPI, trusted SQL TLS certificate, and actual live session
  `ORIGINAL_LOGIN() = user_read` against `Jawafa_DB`.
- Independently reviewed permission inventory, removal of blanket reading
  for runtime, **only** approved `SELECT` views, no mutation rights.
- An approved backend service using the read-only login, authenticated OIDC
  user identity and authorized branch/tenant projection; query allowlist,
  bounded response size, private network access, and audit of requests.
- Independent security/finance sign-off, source and report reconciliation
  with TrustSoft; no release based solely on CI or an account file existing.

**Critical:** The existence of the DPAPI file and successful import on the
server prove only *credential-file readiness*. They do **not** prove the
database account can log in or has correct SQL permissions. In-chat live SQL
verification was blocked by tool security; do not bypass that gate.

This file is not a request to change SQL permissions or financially sensitive
data. No production changes are part of this branch.
