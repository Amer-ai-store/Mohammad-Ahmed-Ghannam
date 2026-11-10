# TrustSoft monthly movement schema — live read-only header verification (2026-11-10)

**Independent project:** JAWAFA ERP AI; **PR:** #231. This is NOT an
approval to change the original TrustSoft program, Jawafa_DB financial
records, employee records, or POS settings.

## Actual verification on the authorized TrustSoft server

The source CSV **header line only** was inspected from the previously created
2026-11-09 authorized export:
`data/dbo.MonthlyMovementSummaryReport.csv`. The metadata contract is kept
in `docs/reference_monthly_movement_schema_20261110.json`.

New deterministic, zero-dependency gate:
`tools/monthly_reference_schema_gate.py`.

It was copied to a separate private evidence directory on the authorized
server, together with the independent public metadata manifest, then
executed against the **actual exported header**, using the option
`--source-export-header-from`. Execution returned **exit code 0**,
`source_header_verified_against_export=true`, and both source and manifest
remained intact.

| Check | Verified output |
|---|---|
| Source table identifier | `dbo.MonthlyMovementSummaryReport` |
| Column count and exact ordinal positions | **44** |
| Canonical SHA256 over column names joined with LF | `4813d30898f9097fc39ac999aa84363b02e2d268d9127c80fe78ce2ae2ec68a9` |
| New synthetic ERP item-movement engine columns | **7** |
| Independently confirmed source-to-new-column mappings | **0** |
| Formula/meaning validations for the 44 source fields | **0** |
| Reference report output captured from TrustSoft runtime | **No** |
| Actual side-by-side output comparison | **Not executed** |
| Owner report parity accepted | **No** |

The field names `MonthYear`, `ItemCode`, `Net_Sales_After_Tax`,
`Receipt_Qty`, `Stock_Net_Qty`, `Total_Damage_Cost`,
`Family_Code`, and `Supplier_Code` are source headers, not proven
report formulas. The exact 44-column manifest includes names with spaces
such as `Cost_Installation Damage` and `Qty_Maintenance Damage` and
must not silently normalize/remove them.

A **passing header test** is only evidence of a consistent source table
export. It does not prove the UI report uses the table, a printed report
displays all 44 fields, the source field types, historical carry-forward,
stock costing, rounding, tax logic, print layout, or business equality.
The report parity percentage remains **UNMEASURED**, never 7/44.

## Candidate source UI screens

The separately verified `dbo.User_Screen_Settings_Name` metadata contains:

- `Screen_No=135`, label `Monthly Movement Report \\ Date`.
- `Screen_No=136`, label `Monthly Movement Report \\ Information`.

These are **observed reference screen identifiers**, not proven source
report-to-table or runtime query bindings. Neither appears in the eight
distinct `List_Report.FORM_No` values in the inspected export. No
cross-table equality is inferred because those identifiers can use
independent numbering domains. The original runtime screen/menu and
printed/exported values are still required.

## Cashier POS permission relation — count-only source audit

Additional read-only aggregate check on export
`dbo.MPOSRelationUserAndFunction`, joined by **candidate identical key
value** to `dbo.MPOSFunction.FunctionNo`:

| Evidence | Observed |
|---|---:|
| User/function relation rows | **11,023** |
| Distinct referenced POS function IDs | **244** |
| Distinct user IDs (count only) | **114** |
| Function references absent from the 273 function definitions | **0** |
| Duplicated user/function relation pairs | **0** |

No individual user IDs or permissions were included in the public evidence.
These aggregates cannot establish whether each user is authorized for each
function, how group roles inherit rights, or how a terminal enforces action
denials. **Cashier rights stay in the Sales/POS module**, as approved by
the owner, and are not confused with enterprise administration rights.

## Acceptance and next direct evidence

1. Obtain an **authorized TrustSoft session** to demonstrate the menu
   actions for screens `135` and `136`, and identify the correct
   source-to-runtime report definition.
2. Capture a report for known approved **non-sensitive** input parameters,
   including branch, item range, dates, tax basis, opening balance and
   sorting; secure a reference CSV/PDF output with immutable hash.
3. Run the new ERP implementation on independently approved matching
   inputs and use `tools/compare_report_exports.py` for field-level
   difference counts and row-order checks.
4. Independently verify report formatting and printer/export output,
   authorization denial, negative cases, and historical consistency;
   capture signed acceptance evidence for `docs/trustsoft_report_catalog.json`.
5. Repeat for every owner-used report; the **100% owner report gate** and
   **>=90% total functional parity gate** stay CLOSED until established.

No confidential TrustSoft binaries, source rows, proprietary templates,
credentials, employee identities or accounting values were committed.
