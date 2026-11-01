# Codex cloud environment operating instructions

## Scope
Repository: Amer-ai-store/Mohammad-Ahmed-Ghannam. These instructions apply to Codex tasks in this repository. They do not grant permissions unavailable to the agent.

## Autonomous execution
For each authorized task, inspect the repository and current environment first; select the least-privileged reversible solution; implement, test, and record evidence without repeated approval for routine non-destructive work. If blocked, try a safe alternative and report the precise blocker. Never claim a cloud environment, secret, deployment, or integration exists without verifying it through the corresponding service.

## Cloud environment configuration
Create/configure a Codex cloud environment through ChatGPT settings when the service provides an authorized action. Associate it with this repository and the intended branch. Use the minimal required setup script and pinned dependencies. Enable network access only when necessary, with appropriate destination restrictions. Verify setup by running a non-destructive test.

## Variables and secrets
Environment variables are non-sensitive configuration only. Secret values must be stored in the provider's secret manager, not in repository files, logs, issues, screenshots, or chat. Never invent secret values. For missing credentials, record their names and stop only the affected integration. Rotate any exposed credentials. Do not copy secrets between Codex and GitHub Actions automatically; configure each provider separately using authorized secure actions.

## Financial and production safety
Jawafa_DB and original accounting records are read-only. No INSERT, UPDATE, DELETE, DDL, or destructive restoration. No public production deployment until independently verified HTTPS, authentication, least-privilege database credentials, security review, and end-to-end acceptance tests. Preserve backups and audit trails.

## Evidence and completion
For each task record: requested action, source, changes, tests and outputs, commit/PR links, status (NOT STARTED / BLOCKED / TESTED / VERIFIED), and remaining blockers. NO EVIDENCE = NO DONE. Prefer changes on a separate branch and PR with review before merging to main.

## Suggested non-secret variable names (examples only)
APP_ENV=staging
GITHUB_REPOSITORY=Amer-ai-store/Mohammad-Ahmed-Ghannam
JAWAFA_DB_MODE=read_only
DEPLOYMENT_ENABLED=false

## Secret key names (values must be supplied via secret manager)
GITHUB_TOKEN (only if required and not provided by native authentication)
DATABASE_READONLY_URL (only if a verified least-privilege account exists)

## Automatic fallback ladder
1. Try the connected provider's native action, then an existing verified integration, then a repository-native CI workflow or a safe documented manual prerequisite.
2. If a cloud environment cannot be created via available tools, prepare setup instructions and non-secret templates in the repository. Never claim a provider-side environment was created.
3. If credentials are unavailable, use native GitHub authentication or ephemeral CI credentials where supported. Never fabricate tokens, bypass authentication, or ask to paste secret values into issues.
4. On failing checks, inspect logs, reproduce, fix on a branch, rerun tests and keep production disabled. Escalate only irreversible operations, account-level authorization, payments, secret entry, or security exceptions.
5. Reuse existing task records; do not create duplicate agents or scheduled jobs without checking current automation inventory.

## Codex environment checklist
- Select the repository and branch in the Codex cloud environment settings.
- Non-secret environment variables: APP_ENV=staging, JAWAFA_DB_MODE=read_only, DEPLOYMENT_ENABLED=false.
- Add provider-managed secrets only if required and available; verify by safe presence checks, never by printing values.
- Default network policy: disabled; enable narrow access for required dependency registries only when supported.
- Setup script: detect package manager from lockfiles, install with its frozen/CI mode, and run existing lint/test scripts; never run database migrations during setup.
- Verify: environment starts, repository checkout succeeds, tests return exit code 0, and no secret appears in logs.
- Record the provider environment identifier, run URL, timestamp and evidence once actually created.
