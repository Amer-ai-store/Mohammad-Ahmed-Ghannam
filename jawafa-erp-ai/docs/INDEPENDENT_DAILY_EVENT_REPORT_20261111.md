# Independent daily movement from ERP events — 2026-11-11

**Status:** IMPLEMENTED IN ISOLATED PR #231 / TESTED WITH SYNTHETIC EVENTS /
**NOT COMPARABLE TO TRUSTSOFT YET**.

## Why this module exists

The uploaded owner TrustSoft `MonthlyMovement.txt` had 35,552 October 2026
records (43 named data fields and one empty trailing field) and was preserved
in a private CSV. The earlier local M02 HTML screen displayed **source-derived**
rows and 7 directly summed source columns; displaying the reference is not
an independent ERP calculation.

The new `api/src/independent_daily_movement.mjs` implements a **separate**
new-ERP event projection with **11 output fields**. It accepts only
caller-authorized event rows; it does **not** read TrustSoft, the uploaded
monthly TXT, original financial records, live SQL, or source vendor code.
It does not create or modify any record.

## Inputs, monetary units, grain and status

Input event keys: `eventId`, `tenantId`, `branchId`, `date`,
`itemCode`, `familyCode`, `supplierCode`, `kind`, `status`,
`quantityMilli`, `netAmountFils`, `taxFils`, `costFils`;
returns also require `referenceEventId`.

The caller **MUST** enforce authentic OIDC authentication and PostgreSQL RLS
before supplying events. The projector re-filters tenant, branch, period,
exact optional item/family/supplier codes, and accepts only `POSTED`
events. `VOIDED` events are ignored and counted; unknown status is rejected.
Duplicate event IDs are rejected inside the selected scope. Returns require
source event ID syntax, but **their linkage to a historical original record
is not independently proven** by this pure function; it is a separate
database-auditing acceptance gate.

Events are grouped at **day + itemCode**, not the original monthly source
table's month+item grain. A report row can aggregate multiple posted source
events. The source owner-uploaded report also appears day+item-level, but
this fact alone does not prove matching report semantics or filters.

Integer `fils` and integer `milli` avoid floating-point silent drift.
All event amounts and quantities are nonnegative, but signed net report
totals may be negative after returns or when costs exceed revenue.
No cost, tax, exchange-rate, unit conversion, missing family name or
supplier name is inferred. Sales require caller-provided explicit
`costFils`; stock adjustments must contain zero money in this version,
so **stock valuation is NOT supported**.

Output columns in order:
1. `day`
2. `item_code`
3. `purchase_qty_milli`
4. `sales_qty_milli`
5. `stock_delta_qty_milli`
6. `purchases_before_tax_fils`
7. `purchase_tax_fils`
8. `sales_before_tax_fils`
9. `sales_tax_fils`
10. `sales_cost_fils`
11. `sales_profit_fils`

Rows are chronologically ordered, then sorted by item code. An optional
CSV export is produced with fixed field order and escaped values, with
`referenceStatus=NOT_MATCHED_WITH_TRUSTSOFT` in the report metadata.

## Exact implementation caveats and acceptance plan

This is an **independent ERP mathematical projection** using openly declared
event rules, not a reverse-engineered TrustSoft vendor formula. It does not
yet include opening balances, costing method and lots, purchasing/stock
accounting entries, supplier investment agreements, tax code authority,
POS/GL/bank settlement or monthly vendor-specific deduction logic.

To compare against the private owner-uploaded report, an independent reviewer
must first certify branch and period scope, event completeness, transaction
posting statuses, invoice/return lineage, decimal scale and the business
definition of each mapped monthly field. Only then can the full report
comparison run on matching grain, schema, data and filters. No source report
row or private financial value should be committed to GitHub.

**Verification path:** `api/test/independent_daily_movement.test.mjs`
contains 15 synthetic regressions for purchase/sale/returns, stock deltas,
isolation, date/item/family/supplier filters, de-duplication, statuses,
negative margins, arithmetic overflow, CSV output and safe empty output.
The existing API CI test runner uses `node --test test/*.test.mjs` and the
syntax check explicitly includes both module and tests.

This code is **NOT exposed as a public read endpoint**, because authentic
OIDC, tenant RLS and reference event-source provenance have not been
independently accepted. It cannot update `Jawafa_DB` or the TrustSoft app.

## Release gate

TrustSoft feature parity: **UNMEASURED**.
Owner-used report coverage: **UNMEASURED**.
Critical workflows and SQL security: **NOT independently accepted**.
Production merge / release: **BLOCKED** pending audited >=90% weighted
functionality, 100% owner-used reports and critical workflows.
