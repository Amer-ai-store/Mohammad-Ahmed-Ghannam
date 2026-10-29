# GATE-15 execution evidence — 29 October 2026

Status: NOT ACCEPTED. No production release or accounting-data mutation.

## Code and CI

PR #70 adds fail-closed artifact verification before VERIFIED and strict numeric Firebase time claims. Eighteen local tests passed. GitHub run 40903342114 passed bridge, native integration and browser smoke steps; runs 40903342136 and 40903341976 also passed. These are isolated checks, not owner-authenticated server E2E.

## Live checks (server clock is not trusted)

- Existing local bridge health succeeded, but uses a privileged SQL login. Its application-level read-only label is not least-privilege enforcement.
- Created a separate SQL login/user for a candidate connection. Only connection/security metadata changed; no accounting row, amount, quantity or source file changed.
- Independently connected as the candidate: SELECT allowed; INSERT, UPDATE, DELETE, ALTER and EXECUTE permissions all zero; sysadmin zero. A bounded branch count read succeeded. No write was attempted against accounting tables.
- A temporary loopback-only candidate bridge authenticated with this account and returned 1,024 table metadata entries. The existing bridge was not replaced; no service recovery or startup reliability is claimed.
- Credential is DPAPI-protected under a restricted local directory. It is tied to the provisioning identity; provisioning a different service identity still needs its own secret binding. No credential is stored in Git.
- Permission evidence SHA256: 1BE7717A5214A67CF86B0CA149ECBD18EADBCA2B449A2875AE960135607F6A94.
- Candidate health/catalog evidence SHA256: C535FA795661E2FAD405AEFD94DA4959FC9CB0A911FD25A56D655F0AD261E1F7.
- A first candidate-port attempt failed because the port was occupied. Its response belonged to the existing privileged bridge and is not candidate acceptance evidence. The independently checked alternate port produced the evidence above.

## Unclosed acceptance

Private same-origin HTTPS, owner session, independent artifact-verifier integration, server-agent E2E, historical difference causality, newest daily off-host restore, and signed gate acceptance remain unproven. The available October 28 restore receipt is historical and on-host; newer October 29 backup files exist, but their restoration was not verified here. Server timestamps must remain labeled as server-clock observations because a prior clock-offset warning exists.

The candidate SQL account does not grant production operational powers. Operational commands must remain separately authorized and cannot mutate original financial or quantity data. A future production cutover must validate consumer dependencies and rollback before switching the existing connection.
