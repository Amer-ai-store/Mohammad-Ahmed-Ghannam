# Monthly item movement candidate table lineage — sample-coverage caveat

**Date:** 2026-11-10 | **New ERP branch:** PR #231.
**Source evidence:** metadata and key-only aggregate checks over an earlier,
authorized, READ-ONLY 2026-11-09 local TrustSoft export. No original financial
values, employee identifiers, accounts or source data were mutated or uploaded.

## Exact available export sizes, NOT true company table sizes

| Exported source | Rows in this local export | Candidate join columns from observed source headers |
|---|---:|---|
| `dbo.Items` | 243 | `ItemCode`, `FamCode` |
| `dbo.Families` | 847 | `FamCode` |
| `dbo.BranchLine` | Count not established in this audit (49 MB CSV) | `ItemCode`, `BranchNo` |
| `dbo.MonthlyMovementSummaryReport` | 97 | `MonthYear`, `ItemCode`, `Family_Code`, `Supplier_Code` |

Field name overlap indicates **candidate links**, not verified FK constraints.

## Actual aggregation from exported key values only

- `Items`: 243 rows, 243 distinct nonempty `ItemCode` values,
  **0 duplicate code occurrences** in the exported subset.
- `Families`: 847 rows, 847 distinct `FamCode` values.
- `Items.FamCode` → `Families.FamCode`: **0 unresolved nonempty
  family codes in the exported subset**. This suggests candidate value
  coverage but does not establish data types, approved unique constraints
  or all-family relationship semantics.
- `MonthlyMovementSummaryReport.ItemCode` → `Items.ItemCode`:
  **97/97 exported monthly rows had item IDs absent from the exported
  243-row Items subset**. This is **NOT** evidence of intentional deletion
  or corruption. The company has at least 4,489 distinct item codes in
  the independently supplied October 2026 TXT, so the 243-row Items export
  cannot be used as the full population for source integrity validation.
- `BranchLine` data rows were **not** scanned; only field headers and
  file size observed, avoiding unnecessary production-host load.
- Supplier source-table path is not established, and no join is invented.

**Critical consequence:** the existing source CSV export has inadequate/
possibly filtered coverage for the report’s 4,489-item universe. No
cross-module relational parity score may be computed from partial table
samples. Full metadata (keys/foreign keys/indexes), approved table export
scope/completeness proof, and controlled key-cardinality checks are required
before a join is accepted.

## Original TXT vs reference DB export: do not conflate

The owner-uploaded **35,552-row / 43-named-column** TXT converted and
row-by-row verified privately is a report-like output from the user. The
older **97-row / 44-named-column** `dbo.MonthlyMovementSummaryReport`
CSV is a separate table snapshot. Its `Main_Barcode` field is absent in
the owner TXT. Differences are **structural/source-coverage gaps**, not
established business anomalies.

**Current label:** DISCOVERED, JOIN_CANDIDATE, SAMPLE_COVERAGE_INADEQUATE.
**Not:** MATCHED, ACCEPTED, or 90%-parity-proven.
