# Owner-supplied MonthlyMovement TXT — JAWAFA ERP AI reference evidence

**Date:** 2026-11-10 | **Security:** owner financial report values stay private/off GitHub.
**Comparison scope:** prospective monthly item movements report within
**Purchasing + Inventory**, linked to accounting and sales, with a dedicated
report-view component under the approved five-department ERP UI.

## Actual uploaded materials inspected

- `MonthlyMovement.txt`: UTF-16LE with BOM; tab-separated with a terminal
  empty tab; **35,552 complete records**, 44 physical cells/row.
- **43 named columns**, followed by one completely unnamed/empty trailing
  column. All 35,552 rows have this exact shape.
- Dates span **2026-10-01 through 2026-10-31** (31 distinct days).
  The source date text is a daily-style label such as `YYYY / M / D`,
  despite the filename and monthly-report heading.
- **4,489 distinct item codes**; **0 duplicate (date, item code) pairs** in
  this owner-uploaded dataset. This does NOT establish invoice uniqueness.
- The corresponding 2026-11-09 SQL TABLE HEADER evidence has **44 *named*
  fields**, including `Main_Barcode`. That field is **absent** from this
  owner's 43-field export. Its trailing empty cell is **not**
  `Main_Barcode`, and the difference must never be silently filled in.
- Three cost fields (`Cost_Damage`, `Cost_Installation Damage`,
  `Cost_Maintenance Damage`) contain the literal text `,0.000` in
  **all 35,552 owner-uploaded rows**. This is a nonstandard numeric
  representation, NOT automatically a numeric zero or an intentional
  negative; a source formatter/parser rule must be independently verified.
- The tentative arithmetic invariant `Net_Profit ==
  Net_Sales_Before_Tax - Net_Sales_Cost` matches **30,396 rows exactly**;
  **5,156 rows** differ by at most 0.001; **0 rows** differ by more than
  0.001. This is a descriptive file check, **not** an independently approved
  accounting rule or forensic accusation. Report calculation semantics,
  intermediate precision and rounding mode remain unknown.
- A complete owner-private UTF-8 CSV of 43 named columns (date standardized
  to ISO but all other cell strings preserved), a 44-column UTF-8 archival
  TSV and a summary Excel workbook with a 500-row preview were produced.
  A row-by-row comparison verified **35,552/35,552 matches** between source
  and transformed CSV, excluding only the documented date change and
  completely empty trailing cell. The values and full report files remain
  private in the user's conversation artifacts and are **NOT in GitHub**.
- Uploaded video is a recording of **ChatGPT project discussion/screens**,
  not an authenticated TrustSoft runtime monthly-report execution. It
  supports product requirement discovery, not independent report provenance.

## What has now been implemented

- `tools/monthly_txt_intake.py`: repeatable, strict read-only converter
  for owner-provided UTF-16LE TSV into private UTF-8 CSV with safe exclusive
  output, date validation, duplicate identity detection, exact financial
  cell-string retention and a privacy-preserving evidence manifest.
- `tools/test_monthly_txt_intake.py`: synthetic tests for BOM, field shape,
  43-vs-44 discrepancy, malformed cost strings, source protection and
  profit-difference classification.
- `lib/src/ui/erp_report_catalog_view.dart`: searchable report registry
  with a dedicated **Monthly Movement** view; 43 observed field labels,
  visible gaps, non-live indicator and disabled print/export until approved
  API evidence exists. It does not ship the owner's financial values.
- Existing `tools/compare_report_exports.py` remains reserved for
  independently authorized TrustSoft-vs-ERP output comparisons. The user's
  TXT file alone cannot prove two separate implementations produce identical
  results.

## Relations — candidates, not verified SQL foreign keys

Candidate lineage from inspected source export headers:
- `MonthlyMovementSummaryReport.ItemCode` ↔ `Items.ItemCode`.
- `Items.FamCode` ↔ `Families.FamCode`.
- `BranchLine.ItemCode` ↔ `Items.ItemCode`, with separate
  `BranchLine.BranchNo` scope to verify.
- `MonthlyMovementSummaryReport.Family_Code` ↔ `Families.FamCode`
  is a **semantic hypothesis**, not an established equality.
- Source `Supplier_Code` lineage is not yet established;
  no arbitrary supplier source table has been invented.

These links require key type, uniqueness, cardinality, date-version and
source-to-source checks. Under no circumstance is the owner's live financial
report bulk-uploaded to public CI or silently posted back into Jawafa_DB.

## Owner-deferred dependency list — batch review only

1. Independent evidence of which TrustSoft runtime screen, vendor build,
   export settings, report filters and branch produced the TXT.
2. Exact accepted transformation semantics for literal `,0.000`
   and the optional/missing `Main_Barcode` field.
3. Approved TrustSoft formula/rounding definitions (including opening
   stock, tax, receipts, returns, cost and movement calculations).
4. A SECOND independently generated report from the new ERP on exactly the
   same authorized test source, followed by field/order/layout/permission
   and independent reviewer acceptance.
5. Remaining verified report menus, definitions, variants, printer routes
   and cross-module role/branch/hardware relationships; complete set required
   to freeze the 100% owner-used report catalog.

**Acceptance:** THIS OWNER FILE HAS BEEN TRANSFORMED AND VERIFIED FOR INTEGRITY.
It has **not** been matched against a second independent system output.
Owner-required 100% reports, critical workflows, and >=90% weighted source
functionality gates remain **CLOSED / UNMEASURED**.
