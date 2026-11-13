# TrustSoft report and POS user-interface reference mapping — 2026-11-10

**Scope:** New, independent JAWAFA ERP AI. Source inspection was **read-only**
using approved 2026-11-09 source CSV exports and installed executable
filename-reference scanning. No production SQL account, personal/financial
records, executable modifications, vendor source-code copy, or deployment.

## Source-backed UI and POS metadata discovery

| Source table | Relevant columns | Export records | Verified field-based findings |
|---|---|---:|---|
| `dbo.User_Screen_Settings_Name` | `Screen_No`, `ScreenNameA`, `ScreenNameE` | 364 | 364 unique screen IDs; 363 distinct nonempty English names |
| `dbo.MPOSFunction` | `FunctionNo`, `FunctionName`, `FunctionNameA` | 273 | 273 distinct function identifiers |
| `dbo.MPOSFunction_Location` | `Funct_Id`, `Button_Name`, `Location` | 128 | 124 ID-matches to `MPOSFunction.FunctionNo`, representing 31 distinct functions |
| `dbo.MPOSKeyFunction` | `FunctionId`, `Function`, `FunctionArb` | 46 | 46/46 IDs match `MPOSFunction.FunctionNo` |

The four POS location entries without matches have `Funct_Id=0` and
represent **zero/placeholder candidates**, not four confirmed broken foreign
keys or security vulnerabilities. No nonzero unmatched identifier exists in
this selected export snapshot. True relational constraints and whether an
unassigned button is visible/accessible still require SQL metadata and
behavioral verification.

Read-only tool `tools/reference_ui_catalog_audit.py` was executed on the
authorized server against these four exported metadata CSVs and produced a
separately verified **private-only** JSON mapping of screens, POS functions and
button locations with source file hashes.

**Private UI evidence SHA256:**
`64d61c353bea7c05b61a098306cee745c62e86591b6658008ed1a70aa3b32a0d`.

These are screen/function *identifiers*. Importing or reproducing a screen
label is **not** proof of matched business behavior, menu-level permission,
report calculations or stable upstream SQL joins.

## Initial report screen candidates

A **broad** business/report keyword match located 118 English screen labels;
it intentionally includes sales/account/stock actions, so it is **NOT a count
of 118 distinct reports**. A narrower whole-word scan of English labels for
`report(s)`, `statement(s)`, or `summary` yields **11 candidate screen
IDs**. The narrow search necessarily misses reports with other names, modal
dialogs or embedded menu paths; it is not a reference report denominator.

Examples of observed source UI labels (not accepted reports):
- `Account Statements`
- `Financial Statement Screen`
- `Items Information Report`
- `Monthly Movement Report \ Date`
- `Monthly Movement Report \ Information`
- `Consignment Voucher Report`
- `Print Items Report`

The existing export table `dbo.MonthlyMovementSummaryReport` has **44 header
fields**. The independent synthetic reporting engine currently generates
**seven** different output columns and has not demonstrated matching quantity
semantics, opening balances, costs, VAT calculations, item family and supplier
filters, or stock movement formulas. Candidate name correspondence with the
two monthly-movement screens does **not** verify a live reference binding.

## Static POS report-template evidence, not final runtime report mapping

The installed `Trust POS.exe` contains filename references matching all 12
physical `POS/Reports/*.rpt` templates. The separate source `MPOSFunction`
and `MPOSFunction_Location` metadata now provides evidence of where POS
actions can be configured. But **no verified chain yet connects an exact POS
menu/button ID to an exact .rpt filename and the actual report output**.
See `TRUSTSOFT_POS_BINARY_REPORT_LINKS_20261110.md` and its private
binary-to-template hash mapping.

## Actual old/new report acceptance prerequisites

1. An authorized interactive TrustSoft runtime session must capture a
   reference report for each used menu ID, including all filters, access
   rights, date ranges, branch scope and formats. Do not bypass authentication
   to obtain samples.
2. Capture a separately rendered JAWAFA ERP AI report using the same approved
   synthetic/anonymized dataset or an authorized read-only reference dataset.
3. Record both SHA256s, source build and screen ID, approved filter contract
   and a signed sample-comparison manifest.
4. For UTF-8 CSV output, invoke
   `tools/compare_report_exports.py --manifest <private-manifest> --reference-csv <approved-TrustSoft-export> --candidate-csv <approved-ERP-export>`
   on a private authorized machine. Its JSON result contains **only row and
   field-mismatch counts**; it does not publish the financial numbers.
5. Verify printed layout, non-CSV formats, permission denial, embedded reports
   and nondefault filters separately. Even exact CSV equality is marked
   `trustsoft_parity_accepted=false` until an independent reviewer signs the
   complete test matrix and owner report catalog entry.

**Current classification:** Screen IDs DISCOVERED; selected POS function
identifier relationships DISCOVERED; POS binary template references
DISCOVERED; source report runtime executions **NOT CAPTURED**; output parity
**UNMEASURED**. The 100% owner-used report and 90% reference functionality
release gates remain BLOCKED.
