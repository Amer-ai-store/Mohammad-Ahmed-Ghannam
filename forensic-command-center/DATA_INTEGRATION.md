# Guava Forensic Command Center — secure data integration

Status: JAWAFFASVR is the selected free interim data source; Firebase is deferred. Server online and CSV read-only access verified. Dashboard live backend integration NOT YET verified.

## Data flow
JAWAFFASVR (read-only CSV exports) -> local validation and analysis worker -> private authenticated read-only API -> authenticated dashboard. GitHub stores source code and CI only, never financial exports or credentials. Firebase deferred.

## Import inventory
Observed on server 2026-10-27: 786 CSV files in C:\\Export\\hourly\\20261026-1640\\data (point-in-time count, not a guarantee of complete exports). SQL table inventory was previously 1024; these numbers are not interchangeable.

Core sources:
- dbo.Journal_GL.csv: JournalNo, JournalDate, ReceiptNo, Total, UserId, post
- dbo.CheqMovement.csv: SeqId, CheqId, MoveDate, TransNo, VoucherNo
- dbo.InvPurchaseVouchersTransactionHistory.csv: TransNo, TransDate, TransTime, UserId, ComputerName, OldValue, NewValue
- dbo.Cash.csv: cashno, userID, tDate, Net, RealCash, Deffirence

## Logical records for private API (proposal)
- import_runs/{runId}: source path alias, observedAt, fileCount, validation state, sha256 manifest reference
- table_catalog/{tableId}: source table, row count, schema hash, last verified import
- audit_findings/{findingId}: evidence references, rule version, confidence, review status
- command_jobs/{jobId}: requestedBy, allowlisted read-only query ID, status, result reference

Security requirements: deny-by-default authentication and authorization at the private API; least-privilege worker account; no anonymous financial reads; do not put database credentials or service-account JSON in GitHub, frontend, or Firestore; do not open SQL Server to public internet; preserve original CSVs and evidence hashes. Dashboard must distinguish live, snapshot, stale, and disconnected data. All imports and jobs must be idempotent, logged, and restricted to read-only source access.

## Acceptance gates
1. Confirm JAWAFFASVR export paths and run tools/inventory_exports.py locally; verify metadata without exposing records.
2. Provision a private local worker and configure secrets in a secure secrets manager.
3. Verify access to a sanitized sample via authenticated private API.
4. Import CSV metadata and row counts, validate integrity and reconcile source counts.
5. Implement dashboard API and verify actual authenticated read.
6. Enable monitored scheduled import with failure alerts; publish receipt with run ID, timestamp, source hash, row counts, and QA evidence.

Do not mark integration complete until all gates pass.
