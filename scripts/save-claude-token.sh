#!/usr/bin/env bash
# Optional manual Claude OAuth setup for authorized repository maintainers.
# Free GitHub Actions code review does not require Anthropic/Claude credentials.
# Security: do not record terminal output or write a token to temporary files.
# Claude setup-token may show a credential on the screen; do not share screenshots.
set +x  # Prevent caller-supplied bash -x from echoing secret-bearing commands.
set -euo pipefail
umask 077

REPO="Amer-ai-store/Mohammad-Ahmed-Ghannam"
SECRET="CLAUDE_CODE_OAUTH_TOKEN"
token=""
trap 'unset token CLAUDE_CODE_OAUTH_TOKEN 2>/dev/null || true' EXIT

say() { printf '\n%s\n' "$*"; }

# Exact repository match, not a substring that could match a lookalike remote.
origin="$(git remote get-url origin 2>/dev/null || true)"
case "$origin" in
  https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam|https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam.git|git@github.com:Amer-ai-store/Mohammad-Ahmed-Ghannam|git@github.com:Amer-ai-store/Mohammad-Ahmed-Ghannam.git) ;;
  *) echo "Wrong repository remote; no secret was accessed or saved." >&2; exit 1 ;;
esac

if ! command -v gh >/dev/null 2>&1; then
  echo "Install and authenticate the official GitHub CLI first." >&2
  exit 1
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "Install Claude Code through its official instructions first; no automatic installer is run." >&2
  exit 1
fi
# Confirm secret-manager access BEFORE asking for a sensitive credential.
if ! gh secret list -R "$REPO" >/dev/null 2>&1; then
  echo "GitHub CLI cannot access repository Actions secrets; authenticate with an authorized maintainer account." >&2
  exit 1
fi
if [[ ! -r /dev/tty ]]; then
  echo "A private interactive terminal is required; do not use CI or piped stdin." >&2
  exit 1
fi

say "1/3: Complete the official Claude setup-token login in this private terminal."
# Do not capture this command's stdout/stderr, launch script(1), or save a transcript.
claude setup-token

say "Copy the complete OAuth token, then paste it below (input is hidden)."
if ! IFS= read -r -s -p "OAuth token: " token </dev/tty; then
  echo "Unable to read from a private terminal; nothing was stored." >&2
  exit 1
fi
printf '\n' >/dev/tty
if [[ ! "$token" =~ ^sk-ant-oat[0-9]+-[A-Za-z0-9_-]{60,}$ ]]; then
  echo "Credential format is invalid; nothing was stored." >&2
  exit 1
fi

say "2/3: Test only the new token; other Anthropic credentials are excluded."
if ! (
  unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN
  export CLAUDE_CODE_OAUTH_TOKEN="$token"
  claude -p "Reply with OK." >/dev/null 2>&1
); then
  echo "Claude did not accept this credential; nothing was stored." >&2
  exit 1
fi

say "3/3: Save the credential directly through the GitHub secret manager."
# Token is piped through stdin, not passed as a command-line argument.
printf '%s' "$token" | gh secret set "$SECRET" -R "$REPO"
unset token
say "Credential stored. Existing repository secrets were not altered."
