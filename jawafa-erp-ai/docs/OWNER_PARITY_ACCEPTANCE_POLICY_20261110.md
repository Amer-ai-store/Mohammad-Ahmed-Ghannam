# JAWAFA ERP AI — owner acceptance criteria, 2026-11-10

**Status:** owner requirement adopted in the NEW, independent JAWAFA ERP AI development branch; not an assertion of achieved parity.

## Non-negotiable product outcome

The owner accepts a long, iterative implementation process. Completion is determined by **verified functional fidelity to TrustSoft**, not by deadline, number of screens, number of tables, CI green checks, marketing screenshots, or a nominal completion percentage.

- **100% of TrustSoft reports used and accessible in the approved owner workflow must be present and demonstrably equivalent.** Include filter parameters, totals, grouping, field definitions, ordering, tax/currency/precision, historical/as-of results, branching, role-specific visibility, print/export layouts (PDF/Excel/printers where supported), and error/no-result cases.
- **100% of owner-critical workflows and safety/security controls must be accepted**, including journal/payment/receipt/cheque posting, purchasing, return, inventory receiving/issue/stocktake, sales/POS/shift, payroll/HR, approvals, source-data security, authorization and immutable audit. Only include verified reference behavior; do not recreate a TrustSoft vulnerability.
- **At least 90% independently accepted weighted functional parity across the complete, frozen reference catalog**—including the remaining optional workflows not flagged above. Parity is a **floor**, not an instruction to omit 10% of used reports or critical functions.
- **Independent additions are separate:** AI agents by primary department, immutable historical ledger, stronger authorization, anomaly detection, automation, historical comparisons and analytics. Improvements do **not** falsely inflate the denominator of TrustSoft feature parity.
- The owner-approved dark-blue five-department Windows/Android/iOS experience remains the design target. It is not evidence of successful workflows.

## Five primary owner-approved groups

1. **Accounting**: journals, receipt/payment vouchers, cheques/banks, posting screens, fiscal reports, source accounting settings and cross-module postings; associated AI financial manager.
2. **Purchasing + Inventory (one combined group)**: items/families, invoices/returns, receiving/issue/stocktake, vendor and item ledgers, change history and the full report set; associated AI purchasing/material control manager.
3. **Sales/POS**: sales/returns, cashier-specific rights, POS and cashier close, taxes, sales reports, device-specific workflows; associated AI sales/development manager.
4. **Personnel/HR**: employee lifecycle, attendance/biometrics with consent, pay/social security/deductions/loans/leave and HR posting; associated AI personnel manager.
5. **Shared settings / enterprise authorization**: identities, company/branch mapping, tax dictionaries, device definitions, screen/action permissions, access audits, per-module settings. Cashier rights remain within Sales/POS.

## Evidence collection route for reports

Every report must be discovered from **actual reference screens, source-supported menus/templates, or authorized vendor documentation**, then entered with a stable id, source menu path, exact reference name, module, supported parameters, access roles, printable/export formats, data source and observed normal/error cases.

The presence of `dbo.List_Report` **does not prove its rows are individual reports**. The approved 2026-11-09 metadata snapshot showed 3,846 user/form-config rows but 9 distinct report numbers; it is **not** the report-universe denominator. The owner's estimate of 300–400 reports is a planning hypothesis, not a verified tally.

A report is ACCEPTED only with a reproducible approved source sample, new program output, positive + negative behavioral tests, output-difference review, evidence hashes, and independent reviewer signoff. Any in-scope missing report blocks the **100% report gate**.

## Release criteria and automated controls

- `docs/trustsoft_report_catalog.json` starts **unfrozen / empty intentionally**; the independent reference menu/report discovery and owner approval must be complete before it may be frozen. `tools/report_gate.py` rejects incomplete report evidence and blocks release unless all cataloged reports are accepted.
- `docs/trustsoft_parity_catalog.json` remains **unfrozen**. `tools/parity_gate.py` requires reference workflow inventory completeness and owner signoff before freeze, and an explicit owner-required + security-critical classification for every workflow. It blocks approval of any owner-required/safety-critical workflow below ACCEPTED even if the weighted sum is 90%.
- `parity_gate.py --require-90 --reports-manifest docs/trustsoft_report_catalog.json` is the **combined release-metadata gate**; it requires both 90% workflow parity and 100% accepted owner-used reports. Passing metadata checks does **not** substitute for independent behavioral verification or security audit.
- Any untested original screen or report stays DISCOVERED/UNMEASURED, never marked MATCHED or ACCEPTED by assumption. Actual user-facing percent may be displayed only after independent frozen-catalog evaluation.
- TrustSoft/Jawafa_DB financial, numeric and personal source rows must not be altered, and no SQL credentials/vendor confidential code or employee data may be pushed to GitHub.
- Build artifacts are preview-only until approved functional, report, security, signing, deployment and live E2E gates pass.

## Next sequence (current, not scheduled automatically)

1. Complete reference menus/screens/report metadata inventory using permitted read-only exports and authorized TrustSoft observations, including module report IDs, variants, printable templates, and permission dependence.
2. Freeze the inventory only after owner and independent reviewers verify **completeness**, version, source evidence, and priority classification.
3. Execute side-by-side tests for the highest-use reports and operation chains, beginning with journal/cheque, purchasing-inventory, sales/POS, HR, and shared configuration.
4. Implement new ERP adapters and reporting engine incrementally, preserving before/after audit, permissions and correct operations.
5. Re-run CI and separate metadata/behavior/security/release validations; no 90% claim before evidence is complete.

**Current user-facing status:** parity remains UNMEASURED. No source modifications, production rollout or actual 90% proof is implied by this policy.
