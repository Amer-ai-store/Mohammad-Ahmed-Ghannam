# JAWAFA ERP AI — M06: independently scoped event storage and read-only report API

**Status:** implemented on isolated draft PR #231, **tested only on disposable PostgreSQL and synthetic events**. Not the production TrustSoft/Jawafa_DB database and not approved for live financial use.

## New independent ERP storage

New-ERP-only migration: `backend/migrations/0007_independent_item_movement_events.sql`.

- `erp.branches` declares tenant-owned branch identifiers.
- `erp.report_branch_access_events` captures append-only grant/revoke events for an exact OIDC subject + tenant + branch; `erp.current_report_branch_access` selects the newest event per subject and branch (revocation takes effect without destroying history).
- `erp.item_movement_events` stores only separate new-ERP sales, purchase, stock-in/out and return event inputs. A unique tenant+branch+event ID prevents duplicate source event identities.
- PostgreSQL `FORCE ROW LEVEL SECURITY` is enabled for all three tables; access is scoped by the tenant transaction setting. The reader principal receives SELECT only; no INSERT, UPDATE, DELETE or DDL is granted.
- Triggers reject changes and deletions to event and branch access history even by normally privileged roles; a DBA/superuser could still bypass such controls, so production needs a reviewed administrative boundary and audit logs.
- Same-tenant and same-branch foreign keys guard a return's source reference. **The present schema does not yet certify opposite original event type, aggregate return quantity, full source event completeness, inventory valuation, tax policy or cross-period cutoffs.** These remain mandatory acceptance tests before real ERP posting.

The migration is referenced only in disposable PostgreSQL CI workflows. **It was not applied to Jawafa_DB, TrustSoft or any live accounting database.**

## New scoped API

New-ERP route: `GET /v1/reports/daily-movements?from=YYYY-MM-DD&to=YYYY-MM-DD`.

An authenticated caller must submit a valid bearer token, exact tenant UUID header `x-erp-tenant-id`, and branch header `x-erp-branch-id`. Access requires:

1. Valid OIDC signature/issuer/audience.
2. Active tenant membership.
3. Allowed finance role (auditor/accountant/supervisor).
4. An **explicit current per-person branch grant** that has not been revoked.
5. A valid date period of **at most 31 inclusive days**; optional exact `item`, `family`, `supplier` filters.
6. Database `BEGIN READ ONLY`, tenant RLS and fixed, parameterized SQL. The API rejects POST/DELETE/PATCH and invalid scopes.

The API fetches at most **50,000 scoped event records**; a larger result is rejected as an explicit error rather than returning a misleading partial total. All PostgreSQL bigint amounts are checked before conversion to JavaScript safe integers; rounding and overflow are denied.

The result has **11 independent ERP event-derived fields** at day+item grain, including signed quantities and gross margin derived from supplied event costs. `VOIDED` events are excluded. No bank, TrustSoft, or Jawafa_DB source is used.

### Report security and fraud-relevant QA

`api/test/integration.test.mjs` uses signed synthetic OIDC tokens and an isolated PostgreSQL role to prove:

- A permitted user reads only their assigned branch and company.
- Unapproved branch, revoked branch, viewer role, missing identity and wrong tenant are rejected.
- A separate user may read a different branch only when specifically authorized.
- Date, family, supplier, item, size and method filters deny malformed access.
- Tenant RLS separates source rows in SQL.
- SELECT-only login cannot change event amounts or branch access history.
- `backend/tests/erp_daily_movement_ci.sql` probes immutable triggers, revocation precedence, duplicate event rejection, invalid quantities, return references to foreign tenants, and denied write grants.

Only synthetic data are used in these tests. A successful return is **not** an independent check of the vendor's accounting formula.

## Mapping to owner-uploaded TrustSoft report

Owner reference file `MonthlyMovement.txt`: **35,552** data rows, **43 named fields plus one empty trailing field**, 31 report days, 4,489 distinct item codes. It was kept private and converted losslessly into CSV previously.

**Current new ERP report has 11 fields**, not 43 accepted TrustSoft equivalents. The existing private comparator tests exactly **four hypothesis-only field mappings** under unverified scale and filter semantics. There is no real independently sourced new ERP event ledger with the same October transactions to compare, and source-to-source completeness has not been independently attested.

Therefore:

- 43/43 owner reference fields have **inventory metadata**, not implemented or verified field-level parity.
- 4 candidate numeric comparisons remain unapproved.
- Company-wide report scope, correct supplier family relations, historical opening stock, VAT/discounts, cheque/stock/GL postings, print layout and control evidence remain incomplete.
- **TrustSoft functional parity percentage: UNMEASURED.**
- **Production deployment and PR merge: BLOCKED** pending independent finance, security and owner acceptance.

## Follow-up gates

Record the real new ERP PostgreSQL hosting project/connection identity and a genuine `erp_api_reader`/OIDC configuration (the current CI database credentials are never production secrets). Have a security reviewer validate grants and RLS with real dedicated read login and audit records. Obtain authenticated TrustSoft owner report runtime and approved branch/tenant/period semantics; acquire original new ERP posted events independently. Then measure all accepted report fields and workflows, with an owner-frozen denominator and weights, requiring 100% owner-used reports, 100% critical workflows and >=90% independently accepted overall functionality. Never substitute passing synthetic checks for real parity.
