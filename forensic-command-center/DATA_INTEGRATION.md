# Guava Forensic Command Center — secure data integration

Status: IMPLEMENTATION PLAN ONLY. No Firebase project or live database connector has been verified.

## Data flow
JAWAFFASVR (read-only CSV exports) -> private ingestion worker -> validation and redaction -> Firebase Firestore -> authenticated dashboard. GitHub stores source code and CI only, never financial exports or credentials.

## Import inventory
Observed on server 2026-10-27: 786 CSV files in C:\\Export\\hourly\\20261026-1640\\data (point-in-time count, not a guarantee of complete exports). SQL table inventory was previously 1024; these numbers are not interchangeable.

Core sources:
- dbo.Journal_GL.csv: JournalNo, JournalDate, ReceiptNo, Total, UserId, post
- dbo.CheqMovement.csv: SeqId, CheqId, MoveDate, TransNo, VoucherNo
- dbo.InvPurchaseVouchersTransactionHistory.csv: TransNo, TransDate, TransTime, UserId, ComputerName, OldValue, NewValue
- dbo.Cash.csv: cashno, userID, tDate, Net, RealCash, Deffirence

## Firestore collections (proposal)
- import_runs/{runId}: source path alias, observedAt, fileCount, validation state, sha256 manifest reference
- table_catalog/{tableId}: source table, row count, schema hash, last verified import
- audit_findings/{findingId}: evidence references, rule version, confidence, review status
- command_jobs/{jobId}: requestedBy, allowlisted read-only query ID, status, result reference

Security requirements: Firebase Authentication and deny-by-default Firestore rules; backend service account with minimum permissions; no anonymous financial reads; do not put database credentials or service-account JSON in GitHub, frontend, or Firestore; do not open SQL Server to public internet; preserve original CSVs and evidence hashes. Dashboard must distinguish live, snapshot, stale, and disconnected data. All imports and jobs must be idempotent, logged, and restricted to read-only source access.

## Acceptance gates
1. Connect Firebase project under authorized account.
2. Provision private worker and configure secrets in a secure secrets manager.
3. Verify access to a single sanitized sample with Firebase Authentication.
4. Import CSV metadata and row counts, validate integrity and reconcile source counts.
5. Implement dashboard API and verify actual authenticated read.
6. Enable monitored scheduled import with failure alerts; publish receipt with run ID, timestamp, source hash, row counts, and QA evidence.

Do not mark integration complete until all gates pass.
