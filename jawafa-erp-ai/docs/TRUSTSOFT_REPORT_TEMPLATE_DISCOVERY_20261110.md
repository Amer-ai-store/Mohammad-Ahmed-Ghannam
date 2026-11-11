# TrustSoft report-template discovery — 2026-11-10

**Project:** independent JAWAFA ERP AI; reference source remains read-only.
**Evidence class:** local binary template *file metadata only*, NOT report output comparison, not functional parity, not vendor source-code import.
**Private evidence:** retained on the authorized server, not published in GitHub.

## Verified observations

- The authorized, installed TrustSoft application folder contains **188 files with extension `.rpt`** across the selected installation directory.
- Their case-insensitive filenames are **188 distinct values**.
- SHA256 content hashing finds **187 distinct file contents** among the 188 files; **one duplicated-content pair** is present.
- Combined size of the 188 files: **36,256,876 bytes**.
- **Private manifest SHA256:** `a7a32e553c02de281af453da7312309761335281c3903315d444f3adeee718e3`.
- A second pass verified the private manifest has 188 entries and 187 distinct hashes. The original vendor files and financial/employee data were not modified.

Do not infer that the application offers exactly 188 reports. Some templates may be historical, customized, unreferenced, obsolete, permission-gated, or multiple designs for one report; other reports may be embedded or dynamically generated and have no standalone `.rpt` file.

## Contrast with earlier reference export metadata

The separate `List_Report` source table snapshot holds 3,846 user/form preference rows and only 9 distinct `ReportNo` values. It is **not a complete report menu** and cannot be equated to the 188 template files or used to claim full report coverage. The owner's approximate 300–400 reports remains unverified until UI/menu/template/report execution mapping.

## Safe next steps for comprehensive report inventory

1. Privately correlate the **188 template file hashes/names** with authorized TrustSoft menus, UI report IDs, module/branch access rights, and source table/query metadata, without distributing vendor binary templates.
2. Identify reports with no external template and orphan templates never reachable from any current screen.
3. For each reachable owner-used report, record its source module, exact menu path, reference version, filters, output columns and types, totals, taxes, report variations, print/export modes and authorized viewing roles.
4. Recreate the business/report semantics independently in the new ERP report engine, using approved non-sensitive fixtures.
5. Compare old/new output side-by-side including positive/negative tests, pagination, localized formatting, decimals/rounding, past-date behavior and permissions. Require independent signoff and hashes.
6. Feed only independently verified report metadata into `docs/trustsoft_report_catalog.json`. The owner-approved release criterion is **100% accepted reports** in addition to **>=90% weighted verified TrustSoft functionality and 100% owner-critical workflows**.

**Current certification:** report catalog remains UNFROZEN/EMPTY until these steps are complete. Report parity is **UNMEASURED**, not 188 of 400 or 9 of 400. The safe inventory does not confirm business correctness or absence of application vulnerabilities.
