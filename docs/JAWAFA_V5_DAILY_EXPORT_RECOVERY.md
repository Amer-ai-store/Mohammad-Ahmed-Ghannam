# Jawafa V5 — safe offline verification and return-to-service gates

**State:** Source-only patch; **no** on-host changes, SQL data exports, backup restoration, releases or production approval. Related incident: #265. Supabase bridge incident #263 is independent.

## Fixed in this branch
- The archived V5 layout contains inventory_tables.csv (schema,table,rows,cols), export_results.csv (table,mode,rows,status), manifest_sha256.csv (file,bytes,sha256) and data/*.csv. Previous verifier used nonexistent inventory keys schema_name/table_name.
- The V5 contract has **1,024 inventory/status rows**, but **1,023 exported CSVs**: **1,009 FULL + 14 DELTA**, plus **1 baseline reference** (dbo.ItemSalesSummary), not exported.
- Count equality alone is insufficient. The verifier checks matching **sets** of table keys and files, unique names, mandatory statuses, hashes, and measured byte sizes. Missing/swapped/duplicate/corrupt files fail closed.
- Data files are SHA-256 digested **streamingly** to avoid caching large private financial CSVs in RAM.
- Search is bounded to expected Drive offsite hierarchies and a dated YYYYMMDD-0100 run folder. JAWAFA_EXPECTED_RUN_DATE defaults to today's date in Jordan (+03:00). A stale run fails even if hashes match.
- No financial CSV row is printed to standard output; JSON output is a **private** report. The verifier never changes Jawafa_DB or Google Drive.

## Offline synthetic tests
From repository root:

    python3 -m unittest discover -s tests -p 'test_jawafa_drive_v5_*.py' -v

25 cases cover complete, missing, swapped, duplicate, corrupted data, faulty modes, misidentified baseline, CSV headers/BOM, stale-run selection and digest streaming. Tests do **not** prove the live Drive inventory was downloaded.

## Private runner — only after WIF and owner access is approved
- Use the existing .github/workflows/jawafa-drive-inventory.yml (fails closed if JAWAFA_WIF_PROVIDER or JAWAFA_WIF_SERVICE_ACCOUNT is absent). Credential must have Drive **read-only** scope and folder access.
- Optional JAWAFA_DRIVE_FOLDER is the private Jawafa export **root**. JAWAFA_DRIVE_RUN_FOLDER selects an exact, dated folder. JAWAFA_EXPECTED_RUN_DATE=YYYYMMDD is only for an approved historical-run test; default is **today in Jordan**. Do not set an old date to claim today's backup succeeded.
- verified=true establishes only private **hybrid CSV file integrity** for the named run. It does not prove SQL database backup consistency, full transaction rollback/replay support, native RESTORE test, or newest export retained locally.

## When JAWAFFASVR reconnects
1. Check SentinelX host **online**, scheduled task JawafaDailyV5-ReadinessOnly actual 00:50 result and run receipts. This is **readiness only**, not a backup.
2. Independently inspect local export directories and SQL Agent jobs for newer versions **before** any run/retry. Preserve every old ZIP and metadata file.
3. Use a dedicated approved SELECT-only account, **never** shared LOCAL SERVICE with broad SQL rights or plaintext sa credentials. Recheck 1023 table permissions, workload/space and 01:00 Asia/Amman window.
4. Check output counts (1023 CSV + baseline status), per-file sha256, ZIP integrity, row counts and source-vs-export FULL/DELTA row-counts, historical coverage and an independent restore/replay procedure. READ UNCOMMITTED records are not a transactional backup.
5. Verify actual Google Drive upload with authenticated file IDs and readback; preserve newest locally and transfer older confirmed versions only per retention policy. Do not delete, overwrite or rewrite dated snapshots. Keep private exports out of GitHub and GitHub Pages.
6. Record only verified outcomes in the same MASTER_CONTINUITY.md Drive reference, increment version and reread it. Do not mark #265 resolved just because CI unit tests pass.

**Blocked:** At 2026-11-16 04:04 Asia/Amman SentinelX disconnected. This patch does not reconnect it or create missing daily data.
