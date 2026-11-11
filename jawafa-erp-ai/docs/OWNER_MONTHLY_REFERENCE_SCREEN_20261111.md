# Owner-uploaded monthly movement — first private reference-view screen (M02)

**Project**: independent JAWAFA ERP AI; **evidence class**:
`PRIVATE_REFERENCE_SCREEN_CREATED_NOT_ERP_PARITY`. No release, production query,
data update, report acceptance or TrustSoft source-code copying.

## Actual execution on owner's privately supplied October 2026 CSV

Built `tools/render_owner_monthly_movement.py` to display a standalone,
offline, Arabic **reference** screen. It is an inspectable report view from
previously uploaded data, **not** a live ERP report engine, not a web-hosted
dashboard and not a replacement for the original TrustSoft UI.

The original October owner TXT was UTF-16 TSV with one trailing empty field.
The verified UTF-8-BOM CSV preserves literal values. This new tool checks
**exact source SHA256** before generating the private output and verifies
the **43 expected named fields plus the trailing empty cell** against an
explicit allowlisted ordered schema. This differs from the separate
server-export source TABLE with 44 named fields.

Execution using only the owner's **locally mounted** CSV and October date
range returned:
- **35,552** source records; **35,552** date-selected records.
- **150** displayed sample records, while the summary includes **all 35,552**.
- Date, item, supplier, and family filtering implemented, and every visible
  row offers all 43 original named fields.
- Seven summary fields are added using Python `Decimal` (no floating-point
  recomputation): `Net_Sales_Before_Tax`,
  `Net_Sales_After_Tax`, `Net_Purchase_Before_Tax`,
  `Net_Purchase_After_Tax`, `Net_Sales_Cost`,
  `Net_Profit`, `Sales_Qty`. Other fields remain literal strings.
- Legacy `,0.000` damage-cost text is **preserved**, never silently converted
  to an accounting zero.
- Exact original source rows/financial totals and supplier/item identities
  remain inside the **private HTML**, never in GitHub, CLI logs or CI.

The local script has 13 synthetic-only unit tests which cover row filters,
date handling, nonempty and empty selections, group-total independence from
visible-row pagination, source SHA256 drift, scope attestation, overwrites,
malformed selected numeric fields, source-header drift, HTML escaping and
CLI output confidentiality.

The local output is intentionally standalone with *no external resources*,
CSP restricting scripts, and print CSS. It is **not** interactive browsing,
a live SQL-connected screen, or server-side authorization. The operator input
scope `OWNER-UPLOADED / UNVERIFIED` is a **label**, not verified tenant/branch
authorization. Never publish this private HTML to GitHub Pages or elsewhere.

## Remaining ERP report acceptance gates

1. Identify the matching source UI report screen and capture TrustSoft
   executable report parameters/branch/tenant and authenticated output.
2. Independently generate JAWAFA ERP monthly report from correct source
   business events under the **same** parameters and read-only permissions.
3. Run field/formula, tax, balance, returns, unit, print/export and user-role
   denial comparisons. Keep original report data private.
4. Establish the complete owner-used report denominator, freeze the weights
   and independently approve report-by-report functionality.
5. Maintain **100% owner-used reports**, **100% critical workflows**, and
   **>=90% accepted weighted TrustSoft functionality** as BLOCKED/UNMEASURED
   until independent acceptance. Source import parity is not business parity.

File references in GitHub:
`jawafa-erp-ai/tools/render_owner_monthly_movement.py`,
`jawafa-erp-ai/tools/test_render_owner_monthly_movement.py`,
`.github/workflows/jawafa-erp-ai-parity.yml`.

The target for the next actual ERP increment is to render the same approved
monthly movement **from independent ERP event logic** and compare its results,
not merely copy/reformat values from the TrustSoft owner-uploaded report.
