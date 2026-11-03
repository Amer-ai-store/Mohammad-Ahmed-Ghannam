# TrustSoft / Jawafa unified dashboard + historical archive
Date: 2026-11-03

## Implemented in this proposed change
- Native mounting of the existing 12-screen TrustSoft client in the central dashboard (same client source as standalone); no iframe, link-only substitute, or simulated financial records.
- Cloudflare worker endpoint remains https://trustsoft-control.zxzx-mohammad91.workers.dev with user-supplied ADMIN token in volatile client memory, 15-minute server sessions, and forced cleanup on section leave.
- Deterministic read-only insights (sample counts, stale status, coverage flags). They never claim accounting sums from bounded samples.
- Archive registry and per-screen source map with SQL mappings explicitly unvalidated.

## Historical archive location
Private Google Drive: https://drive.google.com/drive/folders/1HRpt5ZogivEK5H1MKDvLQwd8EyixIuRg
Existing source root: Jawafa_DB_Exports.
Subfolders: catalog, immutable snapshots, incremental deltas, cheques/banks, operations, investors, evidence hashes, AI reports, quarantine.

## Data pipeline (not activated)
1. Server-side agent runs under a dedicated SQL principal with effective SELECT only; block if role is sa/sysadmin or if TLS is untrusted. No browser SQL credentials.
2. Extract each owner-approved mapped physical table in bounded partitions; mark source time and query trace. Do not infer PK.
3. For each partition, write immutable encrypted object to private Drive; record bytes, row count, schema fingerprint, SHA256 and previous-manifest SHA256. Never overwrite old snapshots.
4. Record *metadata only* into private Firestore collections: archive_runs, table_catalog, snapshot_shards, evidence_ledger, reconciliation_findings, analysis_jobs, access_audit. Use compound indexes (table_id, source_utc), (entity_id, document_date), (evidence_state, updated_utc); enforce least-privilege service identity and deny anonymous reads and writes.
5. A server-side AI analyst may consume only scoped validated extracts. It must report facts and hypotheses separately, cite evidence IDs, return numerical formulas and allow independent review. Never authorize DB edits, irreversible actions, or deployment.
6. Verify hash chain, off-site recovery, anonymization/privacy, SQL privilege, Cloudflare auth, mobile E2E and GATE-15 before production sync.

## Blockers
- Firebase account/project connection and access policies are not yet established for this workflow. No Firestore collections created.
- Existing Windows signed worker still points to an obsolete AppDeploy backend (HTTP 402) and needs a separate Cloudflare agent protocol migration.
- Current SQL bridge may use elevated account and therefore does not meet SQL-level SELECT-only evidence. A read-only UI endpoint is not sufficient.
- GitHub issue #102 release freeze requires independent acceptance. Do not auto-merge or publish this branch.
- This change does not store, reveal, or rotate TrustSoft passwords. Use a password manager for the user secret and Cloudflare Workers Secret TRUSTSOFT_ADMIN_TOKEN for verification; never GitHub, Drive or Firestore.
