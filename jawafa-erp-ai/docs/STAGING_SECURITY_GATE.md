# Staging database security status — verified 2026-11-09

**Project:** `jawafa-erp-ai-staging-private` · Neon project ID `calm-heart-46005051` · PostgreSQL 16 · Frankfurt (`aws-eu-central-1`). This is **a separate NEW empty ERP staging resource**, not Jawafa_DB and not the original TrustSoft database.

## Provider-verified controls

- `settings.block_public_connections = true`: **VERIFIED** by read-back from Neon project settings after a successful minimal update.
- Consumption limits: `active_time_seconds=7200`, `compute_time_seconds=3600`, `written_data_bytes=100000000`, `data_transfer_bytes=100000000`, `logical_size_bytes=100000000`: **VERIFIED** by provider read-back. Limits are not estimates of cost.
- Public SQL network connection attempt from the available Neon SQL connector returned `This connection is trying to access this endpoint from a blocked network`: **BLOCKED, AS INTENDED**. Do not temporarily disable `block_public_connections` to apply migrations.
- Setting `audit_log_level=extended` via the provider currently fails with an organization/HIPAA configuration error. **UNRESOLVED**; do not claim full access-query auditing.
- No migrations, source table data, credentials or financial records from Jawafa_DB were applied to this project by this task.

## Secure next steps

1. Provision an approved private/VPC route or authorized allowlisted administrative path compatible with this project's network controls; prove the allowed network before connecting.
2. From that private path, apply the NEW ERP migrations in a disposable staging branch; verify roles and RLS, audit capture, backup/restore and TLS.
3. Create scoped non-owner roles; secrets belong exclusively in a provider secret manager and must never be placed in GitHub files or public logs.
4. Set up real owner-approved OIDC issuer, tenant assignments, revocation and service access audit.
5. Run isolated live API GET and rejected write attempts using **synthetic** records first; obtain independent security approval before any production use.
6. Never open Jawafa_DB to this ERP staging instance without a separate, explicitly authorized SELECT-only gateway and a completed security review.

**Production gate: BLOCKED.** PostgreSQL and API integration tests presently pass only against ephemeral GitHub Actions databases.
