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
