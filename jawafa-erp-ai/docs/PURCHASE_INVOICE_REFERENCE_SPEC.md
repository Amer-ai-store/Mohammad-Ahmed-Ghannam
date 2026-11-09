# Procurement module — supplier invoice duplicate guard (prototype)

**New program:** JAWAFA ERP AI, NOT TrustSoft modifications. `Jawafa_DB` is read-only reference material. All CI fixtures are synthetic.

## Implemented and tested

- `backend/migrations/0005_supplier_invoice_guards.sql`: new tenant-scoped supplier master, immutable supplier invoices and immutable lines.
- `normalize_supplier_invoice_ref`: trims and removes whitespace, uppercases Latin letters, maps Arabic-Indic and Eastern Arabic-Indic digits to ASCII. Keeps punctuation in place. Raw original number is retained in full for audit.
- `UNIQUE (tenant_id, supplier_id, invoice_number_key)`: stops a duplicate from the **same supplier**, regardless of invoice date, but not across other suppliers or companies.
- Composite tenant-aware foreign keys prevent supplier or invoice lines from being joined across companies.
- Monetary amounts use integer fils; quantities use integer milliunits. No binary floating point in the new financial model.
- `erp.purchase_invoice_draft_checks`: read-only `security_invoker` view checking line totals against invoice header and separately calculating tax. A failed check leaves a draft **unapproved**, and there is no accounting posting implementation.
- Protected invoice and line records reject UPDATE/DELETE via the existing `erp.reject_financial_mutation` safeguard. Future credit notes/reversals will need a separate, reviewed lifecycle.
- SQL role `erp_api_reader` is granted SELECT only. Node API `GET /v1/purchase-invoices` and `GET /v1/suppliers` demand a verified OIDC subject, authorized role and matching company membership. No POST, PATCH or DELETE.
- Flutter has an optional **read-only** procurement screen, displaying line-count and mismatch warnings. Without a real OIDC login the screen explicitly reports disconnected state.
- `backend/tests/erp_supplier_invoice_ci.sql` exercises Arabic/Persian digits, same-supplier duplicates, different suppliers, tenant RLS and incorrect tax/header totals.
- API and Flutter adapter tests use fictional supplier references and amounts.

## Reimplementation vs. functional acceptance

The user reports TrustSoft already prevents duplicate numbers from the same supplier. **This implementation is an independent counterpart**, not a claim of discovering a new TrustSoft vulnerability.

Before marking this ERP feature `MATCHED`, establish how the approved TrustSoft original behaves for: supplier aliases, invoice number punctuation, credit notes, cancellations, invoice type, yearly resets, currency, branch, VAT exemptions, provisional receipts, duplicates under different user roles and date edits.

Possible rule conflict: stripping all whitespace and translating digits may coalesce invoice codes that TrustSoft treats as different. Such cases require actual reference behavior and controlled synthetic comparison before adoption. Do NOT silently weaken uniqueness or change original data to resolve a collision.

## Remaining functionality

**Not yet built:** secure write-side command service, financial posting, vendor due-date calculation, receipt matching, reversal/credit-note workflow, stock costing, purchase VAT accounting, approved role assignment, offline sync and production audit signing. A database constraint alone does not prove a fully operational procurement module.

The 90% TrustSoft functional-parity goal remains **UNMEASURED**. No production financial records were added, modified or deleted.
