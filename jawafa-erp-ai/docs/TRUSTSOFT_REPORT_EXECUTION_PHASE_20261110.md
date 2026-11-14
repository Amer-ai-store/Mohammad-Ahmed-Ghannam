# TrustSoft report parity — second development phase (2026-11-10)

**Branch:** `feature/jawafa-erp-report-inventory-20261110`. **Base:** merged JAWAFA ERP AI source `main`. This work does not repair JAWAFA ONE or the existing central dashboard.

## Goal and the owner acceptance rule

The minimum >=90% weighted, independently verified TrustSoft functional parity is a **floor**. Every report in the verified owner-used TrustSoft universe and every owner-critical operating/security workflow must reach 100% independent acceptance; separate AI/forensic features must not inflate the reference denominator.

## Executed evidence collection (read-only on authorized server)

The local authorized report-template **file metadata** manifest, captured previously under a private evidence directory, was re-audited with `tools/template_inventory_audit.py` executed on the original server. The tool read **only the metadata manifest**, not vendor `.rpt` template contents, financial source rows or SQL.

| Observed metric | Confirmed result |
|---|---:|
| `.rpt` template files | 188 |
| Account/Reports physical folder | 176 |
| POS/Reports physical folder | 12 |
| Distinct relative paths | 188 |
| Distinct file content hashes | 187 |
| Extra content copy from one duplicate-hash pair | 1 |
| Total bytes from original metadata | 36,256,876 |
| Independently matched TrustSoft UI report functions | **Not established** |

Original private source manifest SHA256:
`a7a32e553c02de281af453da7312309761335281c3903315d444f3adeee718e3`.

New private candidate mapping SHA256:
`1c8c0ce2493b477b35e920a156e7492b29002033f233cce3eb8a4a07de16bcf0`.

Both manifests are private on the authorized server; binary `.rpt` files and report names/paths are not copied to the public GitHub project. The mapping records `DISCOVERED_TEMPLATE_ONLY`, no verified screen/menu identifiers, no matched report IDs, and **UNMEASURED** parity. Folder location does not prove a report belongs to a specific ERP module.

## Initial independent reporting-engine implementation

`api/src/report_engine.mjs` implements an explicitly **synthetic-only**, testable monthly item-movement prototype using typed transaction events, exact integer fils and milli-unit quantities. It supports:

- Required tenant and branch scope, safe ISO date range and explicit known movement types.
- Exact quantity/revenue/purchase/tax net arithmetic without floating-point rounding or silently overflowing counters.
- Purchase and sale returns; inventory inward/outward events; export with fixed, escaped CSV columns.
- Negative tests for missing tenant, date errors, wrong type, unauthorized row scope, dangerous item code and overflow.
- An explicit output marker `NOT_MATCHED_WITH_TRUSTSOFT`; no claim of identical TrustSoft tax treatment, unit normalization, rounding, current stock, financial posting or template layout.

It intentionally does **not** have a production ERP API route, SQL data loader, system reports screen or TrustSoft report certification. Authentication and RLS data sourcing must be implemented and verified before any connection to real ERP data.

## Remaining report UI/source evidence

The older `dbo.List_Report` snapshot has 3,846 user/form configuration entries and 9 distinct ReportNo values. These are **not** 3,846 or 9 confirmed business reports. No approved source UI/menu linkage has yet established whether one template maps to one report, several report variants, or an obsolete unused screen. To resolve:

1. Inspect **authorized TrustSoft UI navigation and permissions** using an approved demonstration user, capture reference report menus, IDs, filter combinations, and printed/exported outputs.
2. Privately compare observed menu/screen/template names with 188 candidate file paths/hashes; tag unreachable/obsolete templates separately.
3. Inventory dynamic and embedded reports that have **no standalone .rpt file**.
4. Freeze the full owner-used report set only after review, then implement each report's complete filters, grouping, tax arithmetic, layout and access behavior.
5. Run independent old/new report comparisons with immutable evidence and reviewer acceptance for every report.

**Current release acceptance: BLOCKED.** New source code and synthetic tests are not proof of 90% TrustSoft functional parity, 100% owner report coverage or security acceptance. No private source was mutated.


## Initial UI/report-preference name-correlation attempt

A separate **read-only**, limited aggregation was performed against source
`dbo.List_Report.csv` from the authorized 2026-11-09 metadata export. It
read report preference/configuration columns only, not `User_Id` or financial
transaction records. Nonfinancial aggregate counts:

| Metadata field | Distinct nonempty values | Exact normalized name matches against the 188 .rpt basenames |
|---|---:|---:|
| `ReportNo` | 9 | Not compared (numeric identifiers) |
| `FORM_No` | 8 | Not compared (numeric identifiers) |
| `CTRNAME` | 337 | **0** |
| `ReportName` | 38 | **0** |
| `ReportNameE` | 2 | **0** |

Normalization for name comparison used lowercase and removed non-letter/non-number
characters. These are **zero direct string matches**, NOT proof that no
template is used, that `List_Report` contains all reports, or that any report
has been replicated. The `CTRNAME` values include controls of report UI
forms, not just report names; some report labels in the export have uncertain
character encoding and should not be promoted to names until checked in the
application. Further approved runtime UI/menu inspection and/or vendor
documentation is the next necessary evidence.

This aggregation did not read salaries, personal identities, bank information,
voucher amounts, or modified source records.
