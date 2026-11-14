# TrustSoft POS report template references — read-only static binary evidence

**Scope:** authorized JAWAFA ERP AI reference study only. These observations
are not a source-code import, program decompilation or a certified screen report
comparison. No original executable, report template, financial record or
settings file was changed.

## Verified installation and hash evidence

File version resources observed in the installed executables:
- `Account/Trustsoft.exe`: Windows FileVersion **1.00**;
  SHA256 `da74f9b24a326bed65228b1e3ec9dde5f7f2a5eb16db418e6cbadbd8c728d32f`.
- `POS/Trust POS.exe`: Windows FileVersion **2.00**;
  SHA256 `67d35c2a37f1aa2a34c565c2da6cba61dbb1f21f9b71b35c89b5f6b059d234fd`.

These are **Windows file-version resource strings**, not verified vendor
commercial product release/build identifiers. Both binaries had 2026-03-26
last-write timestamps in the server installation.

A **static, read-only scan of candidate ASCII and UTF-16 text** found:
- In `Trust POS.exe`: **12 unique reference strings ending in .rpt** and
  **12 matching installed report-template filenames** from the private
  188-template inventory.
- **All 12 matched templates are in the physical `POS/Reports` directory**;
  zero matches were to the 176 `Account/Reports` templates.
- In `Trustsoft.exe`: **zero extractable .rpt filename references** via
  this limited direct string scan. This does NOT prove no report links exist:
  name construction, resources, lookup tables or other encoding may be used.
- Private, independently saved reference-to-file hash mapping SHA256:
  `737142b370188a430a15cc0e15c8691a0f5e1a7b59e3f9fe4edd3690bdc94636`.

**Evidence level:** static binary filename reference -> physical report
template match **DISCOVERED**. No menu action, permission, runtime query,
filter, computed field, report output, print layout or module acceptance
verified. Private names/paths and vendor binaries remain off GitHub.

The two selected TrustSoft report-template folders contained **zero
existing CSV/PDF/XLS/XLSX report output files** at the time of inspection.
That does not establish no TrustSoft report outputs exist elsewhere.

## First monthly inventory schema mapping (separate exported data table)

The CSV **header only** of source table
`dbo.MonthlyMovementSummaryReport` has **44 columns** in the authorized
2026-11-09 export. Selected source columns include:

`MonthYear`, `ItemCode`, `Sales_Qty`, `Receipt_Qty`,
`Stock_Net_Qty`, `Net_Sales_Before_Tax`,
`Net_Sales_After_Tax`, `Net_Purchase_Before_Tax`,
`Net_Purchase_After_Tax`, `Sales_Cost`, `Net_Profit`,
`Receipt_Value`, `Withdrawals_Qty`, `Damage_from_Sales_Cost_Per`,
`Family_Code`, `Supplier_Code`.

**NOT equivalent to a reference printout:** this is an exported database
table's column header, not TrustSoft's approved report UI/print definition.
Its value types, formulas, source parameters and total semantics remain
unverified. The new synthetic item-movement kernel currently emits only
**7 columns** and has no confirmed source field-level equivalence. In
particular, `Receipt_Qty` is not automatically the same concept as all
purchase quantities; `Stock_Net_Qty` can have opening balances, transfers,
damage and other adjustments absent from the demo.

## Real report comparison adapter

The new `tools/compare_report_exports.py` compares two **authorized,
independently captured** UTF-8 CSV reports with exact SHA256 checks and
a report-specific, reviewer-approved manifest. It checks scoped parameters,
column ordering, row ordering, date/numeric types and value differences.
The public result includes only match status, row totals and mismatch counts
by field, **not transaction values**.

The CLI never declares TrustSoft parity accepted, even for exact CSV data
equality; PDF/Excel/printed layout, hidden filters, printer/device behavior
and permissions require separate proof. No real TrustSoft reference CSV
export matching this newly developed kernel was found in the two inspected
template folders; hence no genuine old/new numeric comparison was claimed.

**Current release result: BLOCKED.** The owner requires >=90% verified
functional parity plus 100% of used reports and critical workflows. All
source business reports continue to count as `UNMEASURED` until authorized
runtime reference capture and independent approval.
