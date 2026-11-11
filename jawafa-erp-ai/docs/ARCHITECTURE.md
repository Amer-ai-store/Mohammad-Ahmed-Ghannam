# Independent ERP architecture — design decision A-001

**Decision:** NEW Flutter client + NEW audited ERP backend + NEW isolated PostgreSQL database. TrustSoft/Jawafa_DB stays an unchanged **read-only historical reference**. Previous JAWAFA ONE is not a base or runtime dependency.

```text
Windows / Android / iOS   [untrusted client, no SQL secrets]
            |
            v
       HTTPS API gateway     <-- OIDC, tenant membership, rate limits, audit
           /  \
          v    v
 ERP service   Legacy reader adapter [SELECT-only, approved views]
  (server-side)            |
          |                +--> Jawafa_DB / TrustSoft (NEVER mutated)
          v
NEW erp database
 Postgres transaction + RLS + append-only events + backups + reconciliation
```

## Core design invariants

1. No financial record may be silently overwritten, backdated, or deleted.
2. The source Jawafa_DB is never used as the ERP write-side database.
3. Every real posting must be atomic: header + lines + event log + status in a single transaction, with idempotency keys and a durable outbox.
4. Integer fils, not binary floating-point money.
5. Dual authorization for sensitive cheque/accounting actions, separated from the maker.
6. Strong OIDC tenant isolation; **never** trust tenant IDs supplied by a Flutter client without backend-side membership checks.
7. Every domain command is revalidated on the backend; Flutter validation only improves UX.
8. Financial history is append-only and independently backed up. Corrections are explicit reversals.
9. Protected administrator privileges and database role separation: reader, application writer, migrator; no `sa` or superuser in routine work.
10. Every success claim requires a reproducible test run and source identifier.

## Implementation phases

- P0 (this PR): New Flutter app source, cheque simulation, exact journal validator, tentative storage schema, multi-target CI.
- P1: Real user authentication, backend gateway, secure secrets, RLS tenant tests, production-grade event storage. **No posting until security acceptance**.
- P2: Source-guided TrustSoft cheque lifecycle catalog; baseline vs reimplementation E2E including exceptional flows and bank statement matching.
- P3: General ledger + receivables/payables with immutable corrections, reconciliation, journal post transaction.
- P4: Procurement → receiving → inventory → return → tax → cost allocation.
- P5: Sales/POS, cashier settlement, adjustments and POS audit, branch isolation.
- P6: Remaining original TrustSoft modules by weighted coverage, plus AI features behind read-only recommendation boundary.
- P7: Backup/restore, internal and independent security review, staging-to-production release.

## Current evidence constraints

The 2026-11-09 export inventory contains **1,024 source table entries** across schemas. 1,023 files were exported in that v5 cycle: 1,009 FULL; 14 DELTA; and `dbo.ItemSalesSummary` reference-only. The historical 15 difficult tables are now present (7 FULL, 8 DELTA) with matching SHA256 manifests. These are export facts, **not official SQL foreign key metadata or ERP functional acceptance**.

## Not implemented

No runtime gateway, no production database, no encryption secret management, no user authentication, no signed distributions, no verified bank integrations, and **no 90% functional parity claim**.

## Implementation safety

Do not run the migration against the original MSSQL/Jawafa_DB. The PostgreSQL script is an architectural baseline for a NEW database only; SQL role grants and write-side server procedures remain intentionally unspecified until reviewed. SQL RLS is not a substitute for access controls when a privileged user can set session variables or bypass RLS.
