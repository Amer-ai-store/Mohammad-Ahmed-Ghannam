# TrustSoft monthly movement — verified reference report capture procedure
**Date:** 2026-11-10 | **Project:** independent JAWAFA ERP AI | **Source mode:** read-only, authorized operator UI.

## What was actually checked

The authorized server was online, and file search of the normal report/export
directories found **no authentic TrustSoft UI-exported CSV/PDF/XLSX file** for
the target monthly movement report. The guest interactive Windows console was
active, but there was **no running TrustSoft main application process in an
accessible authenticated application session**. Launching under a different
user identity, bypassing a password, invoking financial posting or inventing
a source report is forbidden. Accordingly, **no actual TrustSoft reference
output was captured and no old/new report value comparison has run**.

The 2026-11-09 exported table `dbo.MonthlyMovementSummaryReport` is NOT the
same as a file exported by a running report screen. It has 44 columns, 97
indexed export rows in the selected snapshot and an observed header digest
`4813d30898f9097fc39ac999aa84363b02e2d268d9127c80fe78ce2ae2ec68a9`.
These are structural findings, not official UI report output or its formulas.

## Screen references to inspect in an authenticated TrustSoft session

- Source screen candidate `Screen_No=135`: **Monthly Movement Report \\ Date**.
- Source screen candidate `Screen_No=136`: **Monthly Movement Report \\ Information**.

The screen numbers and labels were read from exported screen definitions. They
have NOT been checked as actual routes, menu visibility or report UI actions.

## Exact capture procedure (authorized operator only)

1. Sign in to the genuine TrustSoft application with an approved, non-admin
   report-viewing identity. Record vendor application/version/build from its
   own **About** screen, not from its Windows EXE file-version field.
2. Navigate through the actual report menu and confirm the visible report
   screen, screen name, report ID if displayed, and available filters.
3. Select one approved test company/branch and a **known, non-sensitive**
   transaction set and record **every** UI parameter: date interval,
   item/family/supplier filters, include-zero/opening-stock rules,
   sale/purchase/return switches, tax treatment, grouping, sorting and
   report presentation variant as available.
4. Generate and **export to CSV if supported** into a private approved
   report-output folder. Do not change any TrustSoft source business record.
   Preserve the original CSV bytes, and do not copy them into GitHub or
   public CI. If CSV is unavailable, preserve a PDF/print export privately;
   the existing CSV comparator cannot certify PDF equivalence.
5. Locally create a filters JSON with exact recorded UI parameter names and
   literal values (using approved test identifiers only). Run the tool below
   **only after confirming it is a genuine UI-generated CSV**.
6. Save the private capture manifest in a separate private evidence folder;
   an independent reviewer must attest to the app screen, source version,
   permissions, parameter snapshot and file provenance.
7. Obtain an independently generated JAWAFA ERP AI report for the same
   approved dataset/parameters. The comparison manifest must explicitly
   describe every column with its confirmed type and include the two
   independently calculated SHA256 fingerprints.
8. Run `tools/compare_report_exports.py` against the original and ERP CSVs
   on the private approved device; review column order, row order, totals,
   tax behavior, opening balances and all filter variants, then separately
   compare print/layout and role restrictions.
9. Mark `ACCEPTED` only after independent behavioral and security review
   and complete catalog checks. A passing CSV digest/row equality cannot
   on its own approve a TrustSoft report or 90% parity.

## Safe reference capture CLI

Run on an authorized machine after generating the report in the UI, with
the sample paths and IDs replaced by **real local, authorized values**:

```powershell
py -3 jawafa-erp-ai/tools/intake_trustsoft_report_export.py `
  --approved-export-dir "D:\PrivateReferenceExports" `
  --source-csv "D:\PrivateReferenceExports\monthly_from_trustsoft.csv" `
  --private-manifest "D:\PrivateEvidence\monthly_capture_135.json" `
  --screen-id 135 `
  --reference-build "VERIFIED-VENDOR-BUILD" `
  --operator-capture-ref "APPROVED-TICKET-123" `
  --tenant-scope "APPROVED-TEST-TENANT" `
  --branch-scope "APPROVED-TEST-BRANCH" `
  --filters-json "D:\PrivateEvidence\exact_ui_filters.json" `
  --confirm-ui-export
```

**Important:** these values are examples only. The operator-provided capture
flag is **not equivalent to an independent reviewer signature**. The saved
manifest remains `PRIVATE_UI_CSV_CAPTURE_PENDING_REVIEW`, with
`trustsoft_parity_accepted=false`. A missing export or invalid provenance
must not be disguised using the old database export.

## Programmatic protections already implemented

The independent `intake_trustsoft_report_export.py` script rejects missing
operator UI attestation, unrecognized screen numbers, a source path outside
the approved export directory (including symlinks), non-CSV inputs, corrupt
or duplicated headers, invalid filters, oversized files, and attempts to
overwrite existing evidence or write manifests inside the source directory.
It only hashes the original and inspects its first CSV header line (no source
data rows are parsed or logged); private output is atomically created.

Its regression suite runs in `jawafa-erp-ai-parity.yml`. The CI suite uses
**synthetic values** and verifies source files are not modified.

**Status:** CAPTURE TOOL READY / REFERENCE RUNTIME EXPORT NOT YET OBTAINED /
SOURCE REPORT FORMULAS UNVERIFIED / RELEASE PARITY BLOCKED. The owner requires
100% of owner-used TrustSoft reports, 100% essential/security workflows, and
>=90% independently verified overall functional parity.
