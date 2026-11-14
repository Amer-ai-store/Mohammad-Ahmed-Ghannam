# JAWAFA ERP AI — personnel, permissions and settings reference mapping

**Status (2026-11-09): ISOLATED PROTOTYPE / TRUSTSOFT FUNCTIONAL PARITY NOT MEASURED.**

This document belongs exclusively to the NEW independent JAWAFA ERP AI project
(PR #216). Neither JAWAFA ONE nor the central dashboard is modified by this
scope. TrustSoft/Jawafa_DB remains a read-only reference. Every table name below
prefixed `erp.` belongs to the NEW PostgreSQL schema, **not** to TrustSoft.

## Implemented with synthetic fixtures

| New ERP entity | Current fields/behavior | Boundaries |
|---|---|---|
| `erp.personnel_directory` | tenant ID, employee code, display name, department code, broad status; composite tenant-unique employee code | No contract, attendance, identity data, payroll, benefits or employee change commands |
| `erp.role_permissions` | tenant/role/resource/read/allowed; missing or denied permission fails closed | Grants are synthetic, immutable and not a production role-admin console |
| `erp.setting_revisions` | append-only non-secret, allowlisted settings with strictly positive revision numbers | No DB passwords, keys, tokens, device credentials, fiscal-rule overrides or production configuration writes |
| `erp.current_system_settings` | security-invoker latest revision view | Not a TrustSoft settings dictionary |
| API `/v1/personnel` | minimum employee directory, tenant and permission gated, GET only | No HR transaction posting or sensitive data export |
| API `/v1/permissions`, `/v1/settings` | scoped non-secret read-only views | No permission assignment or setting edit |
| Flutter | separate RTL personnel, permissions and settings read-only screens | Explicitly disconnected without approved login provider |

**Evidence:** disposable PostgreSQL/Node/Flutter integration tests in this branch
and the latest corresponding GitHub Actions runs. Passing tests does not mean
the original TrustSoft behavior was observed or matched.

## TrustSoft/Jawafa_DB discovery matrix required next (read only)

For each *actually observed* source screen, maintain a private versioned record:

- Exact TrustSoft module/menu/screen identifier, software/version/build and
  visible action IDs (view, add, edit, approve, disable, print, export, delete).
- Authorized SQL metadata: schema/table/view names; column names and types;
  candidate PK/FK/unique constraints; documented stored procedures/functions,
  triggers and job dependencies **only when access rights permit**.
- Complete field/constant dictionary: code and label pairs, defaults, active
  flags, validation rules, status transitions, approval sequence, effective dates,
  company/branch scope and whether configuration changes are auditable.
- Personnel: employee code uniqueness, department hierarchy, employment
  lifecycle, attendance/clock/shift sources, leave, payroll lifecycle,
  allowances/deductions and ledger interaction **only if present in TrustSoft**.
- Permission matrix: actual user roles, inheritance and explicit denies,
  menu/screen action rights, company/branch isolation, maker/checker constraints,
  authentication settings, session termination and historical permission grants.
- Settings and peripherals: actual printers, receipt layout, POS, barcode
  readers, scales, terminals, document sequences, tax/currency settings and
  branch device assignments; never include passwords or personal secrets.
- For each join: keys and normalization rules, one-to-many cardinalities,
  null/default semantics, orphan checks, event ordering and sample **synthetic**
  input/output test cases. A matching header name alone does not prove a join.
- Reference comparison: observed TrustSoft response and negative behavior;
  equivalent new ERP test; evidence hash; reviewer ID; all deviations explicit.

**Unknown source field names are NOT replaced by guessed names.** The table
inventory and SQL export count are not a measure of screen/function matching.

## Acceptance tests to build after source verification

1. Same employee number under same versus different company/branch according to
   the **verified** reference uniqueness semantics.
2. Employee lifecycle and HR/payroll edge cases proven against the reference.
3. Explicit denial for a user with the wrong role, company, branch or action.
4. Privilege revocation, inheritance and separation-of-duties behavior; no
   user can self-elevate through a client-supplied role/company identifier.
5. Settings changes produce durable before/after and actor audit, with
   effective-date and historic report consistency.
6. Device/peripheral integrations tested on real approved hardware or
   reproducible emulators, including offline/retry/idempotency.
7. Error cases, business documents, reports and UI outcomes compared
   side-by-side, including legal/vendor-supported behavior differences.

**Parity gate:** only a frozen and independently approved complete weighted
reference feature catalog can produce an accepted percentage. The catalog now
marks `personnel` and `permissions_settings` mandatory, and the Python gate
enforces the owner's minimum module set even if JSON is accidentally edited.
Actual TrustSoft equivalence is **UNMEASURED**.
