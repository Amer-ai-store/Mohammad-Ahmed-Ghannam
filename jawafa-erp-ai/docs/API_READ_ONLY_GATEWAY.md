# JAWAFA ERP AI — OIDC read-only gateway (phase 1)

**Status:** Implemented and integration-tested on disposable PostgreSQL using synthetic tenants and signed test JWTs. **NOT DEPLOYED, NOT CONNECTED TO Jawafa_DB, NO PRODUCTION USER LOGIN**.

## New architecture

```text
JAWAFA ERP AI Flutter Windows/Android/iOS
  [future authenticated OIDC login obtains short-lived API access token]
       |
       | TLS HTTPS + Bearer JWT + x-erp-tenant-id
       v
Node.js ERP API — verifies JWKS (RS256), issuer, audience, expiry, subject
       |
       | checks requested tenant membership using verified subject
       | checks accounting/auditor/supervisor read permissions
       v
PostgreSQL erp_api_reader (NOLOGIN role; approved reader login inherits)
       | BEGIN READ ONLY; transaction-local tenant context
       v
NEW PostgreSQL erp schema: membership RLS, cheque_current_state, events,
       journal_draft_balance. No write grants. No sa.
```

## Endpoints, all read-only

| Method | Path | Security |
|---|---|---|
| GET | `/health/live` | No DB readiness claim |
| GET | `/v1/cheques` | Valid access JWT + tenant membership + authorized role |
| GET | `/v1/cheques/:uuid` | Same + tenant-scoped cheque |
| GET | `/v1/cheques/:uuid/events` | Same; returns only status and times, not raw notes |
| GET | `/v1/journals/draft-balances` | Same; read-only balance preview |

`POST`, `PUT`, `PATCH`, `DELETE` are intentionally rejected (405). Cheque transitions and real accounting postings are **not enabled** on this gateway.

## Schema and CI evidence

- `backend/migrations/0004_api_tenant_memberships.sql`: read-only login grants and company membership under RLS.
- `api/src/auth.mjs`: cryptographic OIDC verification via remote JWKS (issuer, audience, expiration, RS256).
- `api/src/server.mjs`: parameterized SQL and transaction-scoped tenant context, forbidden DB writes.
- `api/test/ci_seed.sql`: fictional tenants, account roles and financial examples in ephemeral Postgres.
- `api/test/integration.test.mjs`: valid/invalid signed JWT, role denial, cross-company denial, no-write SQL role, read-only cheque event redaction, exact-fils journal output.
- `.github/workflows/jawafa-erp-ai-api.yml` and `.github/workflows/jawafa-erp-ai-database.yml`: full synthetic Postgres test environments.

**A successful CI test is NOT equivalent to production authorization or TLS acceptance.**

## Required private production setup — not performed

1. Provision a dedicated **NEW** PostgreSQL 16+ ERP instance, isolated from Jawafa_DB.
2. Apply migrations 0001–0004 only there using a private migration role. Confirm audit/event immutability and rollback in staging.
3. Provision a **distinct non-owner SQL login**; grant only role `erp_api_reader`. Prevent `SUPERUSER`, `BYPASSRLS`, role grants to migrators and direct SQL access by Flutter clients.
4. Configure a real trusted OIDC issuer; configure API-specific audience, token validation, JWKS rotation, user logout/revocation, and owner-approved company memberships. **Do not accept a company identifier solely from the client.**
5. Deploy API behind authenticated HTTPS ingress, restrict network origins and database connectivity, and store secret values in the deployment provider secret manager.
6. Configure **private environment variables** (never publish actual values):
   - `ERP_DATABASE_URL`
   - `ERP_OIDC_ISSUER`
   - `ERP_OIDC_AUDIENCE`
   - `ERP_OIDC_JWKS_URL`
   - `ERP_CORS_ALLOWED_ORIGINS`
   - `ERP_BIND_HOST` and `PORT`
7. Add persistent, independently protected read-access audit trail, rate limits, secure service observability, backup/restore, offline security review, pen test, and access revocation tests before production.
8. Wire **real login** to the Flutter `ErpGatewayClient` token provider; never persist JWTs or use hard-coded tokens in EXE/APK/iOS. By default, app displays `API غير مفعل`.
9. Verify live connectivity using a test-only nonfinancial record in the **NEW** ERP database, inspect permitted reads and rejected writes. No original financial amount, bank details, cheque, or tax record may be modified.

## Financial boundaries

`Jawafa_DB` and TrustSoft exports are only **study/reference data**. The new ERP API neither connects to them nor modifies them. The reader gateway does not create users, make bank payments, post journals, or change cheque states. A future write-side ERP service must be independently designed, with server-side maker/checker authorization, idempotency keys, append-only logs, dual control and legal/accounting acceptance.

## Security caveat

The API proves role membership from a cryptographically verified OIDC `sub` via `erp.api_memberships`; the client-supplied tenant ID is used for a transaction-local RLS filter **and validated** by the member lookup. RLS by itself does not prove user identity. The API runtime must not use the database owner/superuser. A malicious privileged database owner can still alter the underlying schema, so operational separation, backups and independent audit protection remain mandatory.
