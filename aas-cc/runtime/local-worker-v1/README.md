# ERP local-only worker v1 — fail-closed pilot

Scope: **isolated local deterministic inventory arithmetic only**, not a replacement for an authenticated production SQL/API bridge. No SQL, HTTP, Supabase, Neon, private accounts, financial postings, or connection to the Jawafa_DB/TrustSoft original. Treat all inputs as untrusted.

## Operation

Run with Node.js 20+ from an **access-controlled** directory containing `queue.cjs` and the separately reviewed `runner.cjs` on Windows. Local administrators may submit a file `inbox/<jobid>.json`:

```json
{"id":"stock-example-001","kind":"INVENTORY_CHECK","values":{"opening":10,"received":5,"sold":4,"returned":2}}
```

The queue accepts only `INVENTORY_CHECK`, exact field names, nonnegative safe integers not greater than 1 billion, filenames matching the job ID, at most 25 jobs and 2 KB per input. It invokes a fixed Node.js runner script, checks the receipt's type/state/ID/digests and quarantines invalid input. It writes synthetic-only receipts to `results/`, moves processed requests to `archive/`, rejects conflicts in `rejected/`, and writes a local-only `status.json`. Do not expose these folders on the public web.

The standalone runner has stronger additional guards, including lock and replay checks. This wrapper is **not** proof of complete durability against sudden power loss, a replacement for an enterprise message queue, financial reconciliation, or authenticated remote command handling.

## Live evidence (synthetic, 2026-11-25, Asia/Amman)

JAWAFFASVR QA: 11/11 isolated cases passed (valid result 13, replay, unchanged receipt, invalid kind, excessive value, conflicting payload, no residual lock). Report is private on owner host: `C:\AAS\erp-local-worker-v1-qa-20261125\qa-evidence.json` with SHA256 `EAE9FE0C94DEBB8CB0B11F6DD6BC28FF9F103F624F2CDA5F51071818B71EE727`. The restricted `LOCAL SERVICE` scheduled task `AAS-ERP-LOCAL-READONLY-WORKER-V1` ran with Task Scheduler result 0; no public-users ACL on the checked directories and files. Worker wrapper SHA256 `6446C851882541998A165BB0ED198CA7E3C5BBF841183BBF55937C19533A38C0`. Runner source SHA256 `C9B16DE46FFEF2092D32A59A65C124D274FE3486D66AD851C94B1CEC5126C280`.


## 2026-11-26 deployed integrity update (synthetic only)

The live local worker now verifies the exact SHA256 of its deterministic
`runner.cjs` **before** opening the queue lock or consuming any work. A mismatch
returns exit code 5 and `RUNNER_INTEGRITY_FAILURE` without moving pending
requests, while a known-hash runner producing an invalid receipt remains a
separate fail-closed rejection.

- Updated `queue.cjs` SHA256: `20BC87AEB5BD5872A6DD3A8BFD8C91433C2BD4DCDEDEDE2C2627576D45122FDF`.
- Trusted `runner.cjs` SHA256 unchanged: `C9B16DE46FFEF2092D32A59A65C124D274FE3486D66AD851C94B1CEC5126C280`.
- Isolated live-host source tests: **7/7** after correcting the distinction
  between integrity failure and bad receipt; original source unchanged during QA.
- A separate backup of previous queue code was saved before enabling the
  updated local-only scheduled worker; post-deployment Task Scheduler exit
  **0** and status **OK** were independently read back.
- Service account `LOCAL SERVICE` can read and execute `queue.cjs`,
  `runner.cjs` and `launch.ps1`, but has no direct Modify ACE on these
  three code files. It retains Modify rights only on the local workflow
  directories and status outputs needed by the queue. Files still have the
  service account as owner; an independent privileged ownership hardening
  review is required before treating this as fully tamper-resistant.
- SHA256 digests are **integrity checks, not cryptographic signatures or
  authorization**. The worker remains unsuitable for remote commands or
  financial changes until separate authentication and end-to-end gates pass.

## Open production gates

1. Supabase case #263: Postgres remains ECONNREFUSED / previous SQLSTATE 53100; DO NOT delete WAL, reset any DB or weaken signed nonce/replay protection.
2. Strict SQL TLS and the reader identity must be independently verified before any original Jawafa_DB read; the pilot never uses credentials.
3. Provide an authenticated, HTTPS-only private command transport with owner role checks, a signature/nonce and audit E2E before calling this a remote worker.
4. Build/review/approve a complete source, reproducible CI, Windows security and recovery acceptance plan. Do not merge into a publishing production branch or assert 40% overall ERP completion from these synthetic checks alone.

This draft contains no real business figures or identifying data.
