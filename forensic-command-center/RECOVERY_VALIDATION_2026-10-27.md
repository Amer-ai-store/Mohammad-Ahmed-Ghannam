# Recovery validation — 2026-10-27

## Verified
- JAWAFFASVR Remote Desktop Commander online.
- Original SQL bridge 3456, fallback bridge 3457, and failover proxy 3458 listening.
- `GuavaFallbackAPI` and `GuavaFailoverProxy` scheduled tasks are running; `GuavaAutoRecover` scheduled every minute as SYSTEM.
- Controlled live test: after checking proxy health, the proxy listener process was stopped and recovery watchdog run. Result `proxy:recovered`, then GET 127.0.0.1:3458/api/health returned `ok:true`, `database:Jawafa_DB`; test process exit code 0, ~12 seconds elapsed.
- Fallback startup task `GuavaFallbackAPI` has `At system start up` trigger, SYSTEM identity; task was started manually and API responded.
- External AppDeploy dashboard deployment is `ready` at https://guava-forensic-command-center-dhv9z9.v2.appdeploy.ai/ but its frontend remains static, without an authenticated live SQL tunnel.

## Not verified / outstanding
- Production Windows reboot was NOT performed to avoid interrupting the accounting server; boot persistence not end-to-end verified.
- An external independent disaster-recovery host and off-host encrypted database backups were NOT provisioned. Both local APIs share JAWAFFASVR and Jawafa_DB; host/network/SQL outage affects both.
- The public HTTPS dashboard does NOT have a private authenticated backend to the local proxy. Do not expose unauthenticated SQL API to the internet or publish sensitive financial data.
- No Windows security, firewall, SQL security, or accounting data settings were changed.

## Next acceptance gates
1. Arrange approved maintenance window and verified rollback, then controlled reboot with post-boot SQL/API checks.
2. Provision separate host or managed backup with secure encrypted, read-only snapshot and independent network/power, plus restore drill.
3. Set up authenticated private HTTPS tunnel/gateway for the dashboard; authorize per-user access and test live read-only queries and fallback.
4. Exercise host outage failover to the independent replica and document measured RTO/RPO. Do not claim uninterrupted connectivity until these pass.
