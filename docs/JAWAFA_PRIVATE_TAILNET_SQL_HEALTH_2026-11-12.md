# JAWAFA ERP AI — protected read-only integration status

## Public release boundary
This public repository contains **no SQL credentials, private financial records, sensitive evidence URLs or private hostnames**.

The single approved JAWAFA central dashboard is deployed on GitHub Pages. Public GitHub Pages is a static host and does **not** directly connect to SQL Server or proxy protected database requests.

## Private integration contract
- The private dashboard mirrors the approved central UI without maintaining an independent financial application.
- A status-only route `GET /api/jawafa/v1/sql-health` must verify an authorized owner identity before checking a pre-existing local Windows-authenticated SQL reader.
- It may return only SQL source identity, reader/writer privilege status, TLS acceptance state and a verification timestamp. No financial rows, credentials or statements are allowed.
- SQL `user_read` remains read-only. No INSERT, UPDATE, DELETE or accounting modifications.
- Neither frontend may accept live financial KPI data before trusted SQL TLS, approved SELECT-only views, restricted service identity, independently verified authorization and reconciliation evidence.
- The public dashboard must not send owner bearer tokens to GitHub Pages API paths. Private access is restricted to an authenticated network and private backend.

## Verification classification
- Unit tests and local status-only connectivity checks: **verified in isolated and authorized private environments**.
- Trusted private HTTPS static route: **verified**.
- Complete owner-signed private-browser acceptance: **not yet verified**.
- SQL certificate chain and independent least-privilege service identity: **not yet accepted**.
- Production live financial KPI integration: **blocked, not claimed**.

Detailed server paths, rollback hashes, service internals and connection evidence are stored **privately on the authorized Jawafa server**, not in this repository.
