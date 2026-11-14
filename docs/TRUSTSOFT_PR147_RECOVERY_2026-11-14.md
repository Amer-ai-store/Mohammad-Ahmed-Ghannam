# TrustSoft recovery of closed PR #147 (source-only proposal)
Date: 2026-11-14

## Why this change exists
PR #147 was closed unmerged on 2026-11-12. The source-only fixes validated on 2026-11-04 did not reach main. This proposal is based on main commit `9b0d55a7a2e8a830902892002bb5c7086a256296`, not a rebase or merge of the obsolete branch.

## Scoped changes
- Replace only the TrustSoft iframe section in the existing central dashboard, leaving unrelated central dashboard views untouched.
- Reuse the same 12-screen application in an in-page ShadowRoot and the standalone view.
- Give viewers explicit /api/login with viewer default in the embedded panel; preserve explicit admin /api/admin/login.
- Reject responses from closed login generations, clear in-memory session on leaving the section and avoid mistaking empty/unknown SQL data for authenticated evidence.
- Restore deterministic sample coverage analysis without inferring account totals.
- Restore *offline-only* immutable manifest SHA256 builder and verifier with tamper and symlink regression tests.
- Run these tests in existing PR/Pages QA. No SQL, cloud archive, worker or deployment changes are part of the proposal.

## Acceptance NOT established by tests
Effective JAWAFFASVR SQL SELECT-only principal (not sa), private HTTPS/Cloudflare owner + viewer E2E, role claims and expiry, real mobile auth, per-screen database mapping, encrypted/immutable Drive snapshots, independent off-site restore, Firebase/Firestore access, accounting reconciliation/GATE-15, release-route protection and independent security sign-off.

## Prohibited claims
A green CI run is not production readiness. A SHA256 manifest is not a backup. A connected backend with bounded rows is not a financial accounting total. There is no automated merge, publishing or live financial data movement in this change. Issue #102 remains the independent acceptance tracker.
