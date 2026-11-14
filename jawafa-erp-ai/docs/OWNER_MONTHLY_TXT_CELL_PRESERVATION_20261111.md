# Owner-supplied monthly movement report — cell preservation evidence
**Date:** 2026-11-11 | **Project:** independent JAWAFA ERP AI | **PR:** #231

## Source and proof level

The user uploaded `MonthlyMovement.txt`, a 24,238,512-byte UTF-16LE
tab-separated report representing October 2026, and a separately converted
UTF-8 BOM `MonthlyMovement_TrustSoft_UTF8.csv`. Both remain **private**.
This is **owner-supplied reference material**. It is not an independently
authenticated live TrustSoft UI report run or an independently accepted
reference business formula.

The source header has **44 tab-separated positions: 43 named fields and one
empty trailing header/column**. The distinct `Main_Barcode` field in the
separately archived, server-side 44-*named*-column
`dbo.MonthlyMovementSummaryReport` export is **not present** in the owner
TXT; consequently these are different source schemas. Do not force a
44-field semantic equivalence from matching slot counts.

## Verified, privacy-safe local results

New code: `tools/verify_monthly_txt_csv_roundtrip.py` and synthetic-only
tests: `tools/test_verify_monthly_txt_csv_roundtrip.py`.

| Check | Observed |
|---|---:|
| TXT source data rows | 35,552 |
| Converted CSV data rows | 35,552 |
| Source fields per row | 44, including empty final slot |
| Different data-row positions | **0** |
| Changed cells | **0** |
| Distinct dates in source data | 31 |
| Distinct item codes | 4,489 |
| Duplicate date+item pairs in this export | 0 |
| Nontrivial profit identity rows | 34,579 |
| Exact `Net_Profit = Net_Sales_Before_Tax - Net_Sales_Cost` | 29,423 |
| Further rows agreeing within amount 0.001 | 5,156 |
| Nontrivial profit identity rows outside 0.001 tolerance | 0 |

The 9 isolated synthetic tests passed locally and cover row deletion,
reordering, financial value mutation, header drift, source/output SHA256
tampering and source encoding errors. A successful verification only
establishes **byte-provenanced preservation of field strings between the
two files**, not functional parity with TrustSoft.

File SHA256 checks (not source contents):
- TXT: `b38ad016c456fd6894da2db6b737c8a7038e968a6cfd6044019d7ad1e8cf7e33`
- Converted CSV: `d821c4b289d2aebf75f71ac559be94f1d32b35a70ccc5a9041717544c2ad50df`

## Flags only, not verified loss, fraud, accounting or tax conclusions

| Classification | Source row count |
|---|---:|
| Negative reported net profit | 2,295 |
| Negative sales-cost field | 52 |
| Nonzero profit with zero pre-tax net sales | 14 |
| Zero net sales cost with 100% profit markup | 7,377 |

All 35,552 source rows contain the **literal string** `,0.000` in
each of three legacy damage-cost text fields. The source value is preserved
as text, **not repaired, treated as zero, or silently rewritten**.

Flags can overlap. Investigate returns, reversal signs, item costing,
tax classification and approved historical transaction chains before
concluding incorrect records or any monetary deficit.

## Release and continuation gate

The monthly TXT provides one owner-supplied report's **tabular values**,
but does not verify originating screen selection (candidates 135/136),
runtime filter parameters, branch/tenant, GUI output/print, authorization or
reproducible engine SQL logic. No independently matched JAWAFA ERP output
exists for the same dataset, filters and permissions.

Report coverage: **UNMEASURED**; TrustSoft weighted functionality parity:
**UNMEASURED**; >=90% project functional gate **BLOCKED**. Keep PR #231
DRAFT and prohibit production merge until accepted independent tests,
least-privilege controls and other mandatory evidence are satisfied.

Private Excel audit workbook is generated locally for the owner, not
committed to public GitHub. Original financial, numeric and historic
records were never modified.
