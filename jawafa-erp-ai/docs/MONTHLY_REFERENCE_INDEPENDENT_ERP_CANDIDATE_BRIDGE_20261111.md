# M03: candidate-only comparison — owner monthly report vs independently projected ERP movements

**Date:** 2026-11-11. **Scope:** draft PR #231, isolated source-only development.

The new independent daily ERP event report `api/src/independent_daily_movement.mjs`
does **not** read the owner-uploaded TrustSoft monthly source. It calculates
seven money/quantity/stock components and one profit component from a separate
set of **posted** transaction events supplied by an authorized ERP caller.
There is no production event source in this implementation.

## Practical report-to-report candidate crosswalk

The private comparator `tools/compare_owner_daily_erp_candidates.py`
accepts two independent CSV files (owner October report, new ERP daily event
export), **both with SHA256-pinned bytes**, then attempts this *hypothetical*
scale conversion for four columns only:

| Owner-uploaded report field | Independent ERP event field | Candidate conversion | Reference business formula verified? |
|---|---|---|---|
| `Sales_Qty` | `sales_qty_milli` | decimal_3 × 1000 | NO |
| `Net_Sales_Before_Tax` | `sales_before_tax_fils` | decimal_3 × 1000 | NO |
| `Net_Sales_Cost` | `sales_cost_fils` | decimal_3 × 1000 | NO |
| `Net_Profit` | `sales_profit_fils` | decimal_3 × 1000 | NO |

**Why this is only a hypothesis:** currency scale, account group,
discounts/returns, transaction completeness, cost and tax rules, initial
balances, TrustSoft report filters and source tenant/branch provenance are
not independently attested. Equal numbers do not establish similar software
behavior. The report has **43 named columns plus one empty extra cell**;
this tool compares only **4 of 43 named fields** and cannot grant 90% parity.
The separately exported `dbo.MonthlyMovementSummaryReport` TABLE has
44 **named** columns, a different schema.

Matching keys are date + item code. The comparator detects duplicate keys
in either file, missing rows on either side, differences in the four
candidate fields, schema drift, altered hashes, non-numeric scale input,
out-of-period records and absent operator acknowledgement. It **never**
converts invalid strings such as `,0.000` into `0.000`, never rewrites
input files and reports **only counts and hash IDs**. No source row, amount,
item code or supplier identity is returned.

## Operating sequence — private machine only

1. Generate a read-only export **from actual new ERP posted event records**,
   from a verified tenant and branch under the same date/sku scope as the
   owner TrustSoft report.
2. Preserve the owner report and independent ERP export on a private,
   authenticated local device, recording both SHA256 values and a private
   source/filter authorization record.
3. Run (replacing the *illustrative* paths and hashes):
   `python tools/compare_owner_daily_erp_candidates.py --reference-csv owner.csv --independent-erp-csv erp_daily.csv --reference-sha256 <actual 64-hex> --independent-sha256 <actual 64-hex> --from-date 2026-10-01 --to-date 2026-10-31 --operator-scope-ref APPROVED-PRIVATE-REF --acknowledge-candidate-only`.
4. Read mismatch counts; resolve key coverage first, followed by each
   candidate formula and reference output with authorized subject experts.
5. Do **not** elevate candidate output to certified TrustSoft parity, even
   when all compared numbers agree. Print, role restriction, item mappings,
   all report fields and independent financial acceptance remain outstanding.

## Implementation status and tests

- The comparator and its ten regression tests are tracked in PR #231.
- CI uses strictly synthetic CSV data and `python3 -m unittest discover`.
- The user's 35,552 owner-report records were already checked for lossless
  TXT->CSV conversion, but **no actual independent new-ERP financial
  event-source CSV exists in the project evidence yet**. Therefore no true
  old/new report numerical comparison has been executed here.
- `owner_report_parity_accepted=false` and `functional_parity_percent=null`
  are hard-coded fail-closed outcomes.
- Production DB `Jawafa_DB`, original vendor financial/numeric values,
  installed applications, tax postings and public dashboards were untouched.

**Release gate:** all reports the owner uses, all critical workflows, and
>=90% independently accepted weighted reference features remain
**UNMEASURED/BLOCKED**.
