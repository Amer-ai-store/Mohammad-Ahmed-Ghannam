# JAWAFA ERP AI — M04 private ERP event-to-reference bridge

**Date:** 2026-11-11 · **PR:** #231 · **Status:** isolated development /
**NO production DB access or TrustSoft parity certification**.

## Working technical chain

1. An authorized operator obtains an immutable, consented **new JAWAFA
   ERP** *read-only* event snapshot (not a TrustSoft/financial source rewrite)
   in JSON, with a specific tenant/branch/date range and capture,
   authorization reference.
2. `api/tools/export_private_daily_report.mjs` validates
   `NEW_ERP_EVENT_EXPORT_READ_ONLY`, enforces source SHA256, rejects sources
   outside an approved local private directory, and runs
   `api/src/independent_daily_movement.mjs`.
3. That projector includes only correctly scoped `POSTED` movements,
   excludes `VOIDED` records, rejects duplicate event IDs, unsupported
   statuses, and numeric overflow; it returns **11 fields** at day+item
   grain from independent integer fils/milli event rules.
4. It writes the independent ERP CSV and a hash-bound JSON manifest as
   separate private, **non-overwriting** files with restrictive file
   permissions and count-only CLI logs. If the manifest cannot be created,
   a newly created CSV is discarded; pre-existing files are never altered.
5. `tools/compare_owner_daily_erp_candidates.py` compares four explicitly
   hypothetical owner-report-to-ERP columns after verifying both file hashes,
   period, schema and day/item keys, and returns **counts only**.
6. `tools/test_private_erp_bridge_end_to_end.py` executes the entire
   Node exporter -> private CSV -> Python crosswalk using **synthetic
   data only**, verifying a matching example and a deliberately changed
   financial cell detection. It cannot certify TrustSoft calculations.

### Private-only command template

Place a new-ERP *authorized event export* named `events.json` inside an
approved and access-restricted local directory `/private/erp-evidence`.
This directory name is an **example** only: use the real secure path.
The snapshot must contain:

```json
{
  "schemaVersion": 1,
  "sourceKind": "NEW_ERP_EVENT_EXPORT_READ_ONLY",
  "provenance": {
    "captureRef": "APPROVED-CAPTURE-REFERENCE",
    "authorizationRef": "APPROVED-AUTH-REFERENCE",
    "tenantId": "APPROVED-TENANT",
    "branchId": "APPROVED-BRANCH",
    "fromDate": "2026-10-01",
    "toDate": "2026-10-31"
  },
  "events": []
}
```

**The `events: []` shown above is merely the schema example; it is not
a real financial event export or a claim of zero movements.** To run:

```sh
node api/tools/export_private_daily_report.mjs \
  --events-json /private/erp-evidence/events.json \
  --expected-source-sha256 "<actual sha256>" \
  --approved-private-dir /private/erp-evidence \
  --output-csv /private/erp-evidence/new-erp-october.csv \
  --output-manifest /private/erp-evidence/new-erp-october.json \
  --attest-private-output
```

A flag attests that the **output directory is private**; it does not
independently prove source authentication, accurate branch selection,
accounting correctness, ownership or report parity.

Run the comparator only after independently verifying that the ERP event
export covers the same scope as the authenticated TrustSoft report:

```sh
python tools/compare_owner_daily_erp_candidates.py \
  --reference-csv /private/erp-evidence/owner-reference.csv \
  --independent-erp-csv /private/erp-evidence/new-erp-october.csv \
  --reference-sha256 "<actual reference sha256>" \
  --independent-sha256 "<actual ERP csv sha256>" \
  --from-date 2026-10-01 --to-date 2026-10-31 \
  --operator-scope-ref APPROVED-PRIVATE-REFERENCE \
  --acknowledge-candidate-only
```

`compare_owner_daily_erp_candidates.py` has *no power* to infer
real tax/accounting semantics; 4 values coinciding is not an accepted
TrustSoft report.

## Every source field tracked, none secretly omitted

`docs/owner_monthly_field_registry_20261111.json` lists all **43
named fields** from the owner-uploaded TXT (plus the **one empty source
trailing field**), preserves exact ordinal order, and separates:

- 2 unverified date/item join key candidates.
- 4 unverified numeric comparison candidates.
- **37 additional named fields** with NO inferred ERP equivalents.
- **0 independently certified business formulas**, **0 accepted fields**.

The registry is checked in CI by
`tools/test_owner_monthly_field_registry.py`; no unmapped field
is silently treated as complete.

## Explicit non-production limits

- The input export is **new ERP**-owned data, never an export silently
  rebranded from `Jawafa_DB` or TrustSoft. No authorized real new ERP
  posted-event file has been established to date.
- No original vendor program, accounting data, financial figure, stock
  quantity, deleted record, historic timeline or bank account is changed.
- Even if synthetic end-to-end tests pass, source authorization, event
  completeness, cost method, returns lineage, VAT rule, user permission
  denials, branch isolation, month-end rounding, 43 field-level
  values/print and 100% owner-used report inventory require independent
  proof.
- **TrustSoft functional parity: UNMEASURED**, never 90% by extrapolating
  a 4-field candidate. **Production release: BLOCKED** pending
  independent accounting/security/owner review and all mandatory gates.

## Test evidence links

The exact GitHub run and SHA on the final commit must be verified before
declaring tests passed. The prior M03 head already passed 9/9 GitHub
workflows, 114/114 synthetic Python and 37/37 Node API tests;
M04 introduces additional tests and requires its own run result.
