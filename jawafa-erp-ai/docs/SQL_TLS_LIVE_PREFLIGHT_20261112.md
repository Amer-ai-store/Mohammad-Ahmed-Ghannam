# SQL TLS remediation — live preflight, 2026-11-12

## Verified on JAWAFFASVR
- SQL Server 2017 instance MSSQL14.MSSQLSERVER is running as NT Service\MSSQLSERVER.
- Workgroup host, not joined to an Active Directory domain.
- DPAPI import succeeded locally; no password or key was returned.
- Commit fa55ee8f9187a67b4c3ed7afed461db8f9677f11 fixes mutable SecureString rejection; full synthetic self-test passed on the server.
- A strict encrypted connection using user_read failed before SQL login: SQL error -2146893019 (untrusted certificate authority).
- SQL startup ERRORLOG confirms a self-generated fallback certificate was loaded.
- SQL Certificate registry value is empty; ForceEncryption is 0. This does NOT mean an Encrypt=True client session would be unencrypted.
- Existing LocalMachine/My certificate is self-signed, locally chain-trusted, has a private RSA SChannel exchange key, but its reported DNS name is only the server IP and its EKU list is empty. It is not established as suitable for the requested hostname or selected by SQL.
- At observation: 13 established TCP/1433 connections from 4 addresses. No session was terminated.
- No SQL writes, permission changes, trust-store changes, service restart, certificate binding, or production deployment performed.

## Concrete activation plan (requires maintenance window)
1. Confirm affected cashiers have completed work and applications have stopped submitting transactions. Recheck live connections immediately before activation; a previous zero/nonzero count is not sufficient.
2. Back up existing SuperSocketNetLib registry settings and record SQL/SQL Agent service states, certificate identities and key ACLs locally. Preserve the backup; never export private keys or DPAPI credentials.
3. Create a dedicated RSA/SHA256 server-authentication certificate with CN/SAN JAWAFFASVR, KeySpec KeyExchange, Microsoft RSA SChannel Cryptographic Provider, a non-exportable machine private key and bounded expiry. Include other DNS names only when actually used and validated.
4. Validate server-authentication EKU, hostname, expiry and private-key availability. Give only NT Service\MSSQLSERVER read access to this certificate's private key, preserving existing key ACL entries.
5. Since this is a workgroup/private runtime, explicitly trust the exact locally generated public certificate on the authorized backend host after matching its thumbprint. This is a locally managed trust arrangement, not a publicly CA-issued certificate. Never export its private key. Other clients require their own tested trust configuration before a global encryption mandate.
6. Bind the validated certificate to this instance. Preserve ForceEncryption=0 for this compatibility stage; the new backend MUST continue Encrypt=True;TrustServerCertificate=False. A server-wide ForceEncryption change is a separate compatibility-tested change.
7. Restart SQL in the agreed outage window and restore previously running dependent services. Confirm SQL startup loaded the intended certificate. Do not restart while cashier activity is ongoing.
8. Run the existing verification probe locally using the DPAPI credential, unchanged strict TLS settings and metadata-only SELECTs. Capture identity, trusted connection outcome and effective permissions without secrets or financial rows.
9. Verify the central dashboard backend uses the same strict connection policy. The public GitHub Pages dashboard must never receive SQL credentials.
10. If SQL fails to start or certificate loading fails, restore the prior certificate binding and original service state from the backup, restart, and report rollback. Keep new certificates and evidence for review; no deletion is required.

## Acceptance remains separate
A successful TLS/login test does not establish least privilege, approved view coverage, financial reconciliation, OIDC tenant isolation, or production acceptance. Do not label the gate complete until those are verified. Never use TrustServerCertificate=True or disable Encrypt to turn a failed test green.

Reference: https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/configure-sql-server-encryption
