# TrustSoft monthly movement — private statistical formula-candidate audit
**Date:** 2026-11-10 | **New ERP branch:** `feature/jawafa-erp-report-inventory-20261110` | **Scope:** JAWAFA ERP AI only.

## Provenance and execution
The authorized server was connected, and the **existing archived export** `dbo.MonthlyMovementSummaryReport.csv` from snapshot `20261109-0100` was read **without modification** using the independent script `tools/profile_monthly_movement_formulas.py`.

**Exact source-file SHA256:** `8ca04874da208c3e28c67e9943ef3501e587f48a17026a54567d975394ee0c38` (private, no raw financial values committed).
**Canonical 44-column source-header SHA256:** `4813d30898f9097fc39ac999aa84363b02e2d268d9127c80fe78ce2ae2ec68a9`.
**Private aggregate evidence SHA256:** `2d5ad2b5944b3a2caeb106f82bdc5f8a5b62eab237a1eb491ffd53b0ec035f4b`. The aggregate JSON is retained privately, not copied into GitHub. The source CSV was read only.

### Source-data profile (one historic export snapshot)
- **97 total source rows**, **44 source columns**.
- **0 duplicate extra rows** under the *candidate* (`MonthYear`, `ItemCode`) grain. Actual table SQL keys and grouping are still **unknown**.
- **1 distinct nonempty MonthYear value** and **97 distinct ItemCode values** across the 97 rows. This sample covers only **one monthly period**; it cannot establish stability across seasons, years, branches, tax statuses or source-version changes.
- For the **11 numeric fields used by the candidate formulas**, there were **0 empty/unparseable values** in this export.
- An additional header/data-format spot check found **36 numeric-looking columns**, but this count includes numeric-looking identifiers (`ItemCode`, `Main_Barcode`, etc.) and is not a count of financial measures. `Type_Desc`, `Country_Desc`, and `Volume_Desc` were blank in the entire 97-row snapshot; this does not establish their intended null policy or their values in other periods.

## Candidate calculations — observed count, not a verified TrustSoft formula

Each test excludes rows whose compared operands are all zero, requires valid Decimals, and reports the count of *nontrivial* usable rows. Values/identifiers were not printed. For currency candidates, numerical tolerance was **0.015 source units**; for ratios, **0.05 percentage points**. The tolerances are explicitly **analysis choices**, not proven TrustSoft rounding rules.

| Hypothesis based on column names | Source rows tested | Rows consistent | Rows contradicting |
|---|---:|---:|---:|
| `Net_Profit = Net_Sales_Before_Tax - Net_Sales_Cost` | 27 | **27** | 0 |
| `Net_Profit = Net_Sales_Before_Tax - Sales_Cost` | 27 | **27** | 0 |
| `Net_Profit = Net_Sales_After_Tax - Net_Sales_Cost` | 27 | 0 | **27** |
| `Net_Profit_Margin_Per = Net_Profit / Net_Sales_Before_Tax * 100` | 27 | **27** | 0 |
| `Net_Profit_Margin_Per = Net_Profit / Net_Sales_After_Tax * 100` | 27 | 7 | 20 |
| `Net_Profit_Markup_Per = Net_Profit / Net_Sales_Cost * 100` | 27 | **27** | 0 |
| `Sales_Cost = Net_Sales_Cost` | 27 | **27** | 0 |
| `Net_Sales_After_Tax = Net_Sales_Before_Tax * 1.16` | 27 | 1 | 26 |
| `Net_Sales_Before_Tax = Net_Sales_After_Tax * 1.16` | 27 | 0 | 27 |
| `Net_Purchase_After_Tax = Net_Purchase_Before_Tax * 1.16` | 34 | 1 | 33 |
| `Net_Purchase_Before_Tax = Net_Purchase_After_Tax * 1.16` | 34 | 0 | 34 |

**Critical ambiguity:** `Sales_Cost` and `Net_Sales_Cost` were identical for the 27 active rows in the tested subset, so even full agreement with both profit candidates **does not distinguish which cost field is the actual implementation input**. Only reference code/API behavior or independent tests spanning discounts/returns/cost adjustments can resolve this.

**Tax caution:** the failure of uniform `1.16` ratios in this snapshot is not a proof of incorrect TrustSoft VAT calculation, fraud, or a tax-law issue. Gross/net labels, mixed rates, tax exemptions, returns, inclusive/exclusive prices, discount allocation, record rounding and report-grain differences may all affect that comparison. The real formula requires verified reference controls and original report execution.

## Status and required next proof

- Classification: **CONSISTENT_IN_SOURCE_SNAPSHOT** / **CONTRADICTED_IN_SOURCE_SNAPSHOT**; **no original formula independently verified**.
- Source-to-ERP mapping for the new 7-column synthetic engine: **still UNVERIFIED**. Results do **not** authorize copying any observed source financial values, adjusting Jawafa_DB or marking a TrustSoft workflow accepted.
- TrustSoft screens 135 and 136 are **candidate UI IDs**. An authorized UI-generated report, including its exact filters and provenance, is still missing and **was not constructed from the table export**.
- The mandatory 100% owner-used report coverage and >=90% functional parity requirements remain **BLOCKED/UNMEASURED**.

**Practical next experiment:** an approved nonproduction reference dataset with nonzero cost adjustments, taxable/exempt items, purchase/sales returns and discount scenarios, exported from the *actual TrustSoft UI*, then independently compare the new ERP result, history, permissions and print/export layout.
