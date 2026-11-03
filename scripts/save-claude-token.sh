#!/usr/bin/env bash
# Creates a Claude Code token from your Claude subscription, checks that it works, and saves it as this
# repository's CLAUDE_CODE_OAUTH_TOKEN Actions secret, so the long token never has to be copied by hand.
# It then removes the ANTHROPIC_API_KEY secret, which the workflows would otherwise use instead of the token.
# Meant for a GitHub Codespace opened from a phone's browser; see docs/code-review-setup.md.
# The token is never printed by this script's own status messages; Claude setup-token may echo it in the private terminal.
# Never share terminal screenshots or logs. The transcript is deleted on exit.
set -euo pipefail

REPO="Amer-ai-store/Mohammad-Ahmed-Ghannam"
SECRET="CLAUDE_CODE_OAUTH_TOKEN"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# Refuse to store a credential from a checkout of the old/wrong repository.
# Never trust a pasted or inherited GitHub repo name as a secret destination.
origin="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$origin" != *"Amer-ai-store/Mohammad-Ahmed-Ghannam"* ]]; then
  echo "Wrong Codespace/repository: open the Amer-ai-store/Mohammad-Ahmed-Ghannam project first."
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required for safe secret upload."
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  say "Installing Claude Code..."
  curl -fsSL https://claude.ai/install.sh | bash >/dev/null
  export PATH="$HOME/.local/bin:$PATH"
fi

# Run the official login directly without recording a terminal transcript.
# The token remains on screen only in Claude's interactive output; never capture it in a file.
say "1/3  Sign in to Claude in this terminal. Copy the complete token privately."
claude setup-token

# read -s suppresses terminal echo. /dev/tty avoids consuming redirected CI stdin.
say "Paste the complete OAuth token below (the input is hidden):"
if ! IFS= read -r -s -p "OAuth token: " token </dev/tty; then
  echo "A private interactive terminal is required; no secret was saved."
  exit 1
fi
printf '\n' >/dev/tty
if [[ ! "$token" =~ ^sk-ant-oat[0-9]+-[A-Za-z0-9_-]{60,}$ ]]; then
  echo "Invalid OAuth token format. No secret was saved."
  exit 1
fi

say "2/3  Checking the token with Claude..."
# Other credentials are unset so the check proves this token works, not an API key the Codespace may hold.
if ! env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN="$token" \
  claude -p "Reply with the single word OK." >/dev/null 2>&1; then
  echo "Claude rejected the token, so it was not saved. Run this script again."
  exit 1
fi
echo "The token works."

say "3/3  Saving it as the $SECRET secret of $REPO..."
if ! gh secret list -R "$REPO" >/dev/null 2>&1; then
  # A Codespace's built-in GitHub token cannot manage secrets: sign in to GitHub once with your own account.
  unset GITHUB_TOKEN GH_TOKEN
  gh auth login -h github.com -p https -w
fi
printf '%s' "$token" | gh secret set "$SECRET" -R "$REPO"

# The workflows use ANTHROPIC_API_KEY instead of this token whenever both secrets exist, so remove the API key
# to make the reviews run on the Claude subscription. The key itself stays valid in the Anthropic Console.
if ! names="$(gh secret list -R "$REPO" | cut -f1)"; then
  echo "$SECRET is saved, but the secrets could not be listed to remove ANTHROPIC_API_KEY."
  echo "Remove it by hand at https://github.com/$REPO/settings/secrets/actions"
  exit 1
fi
if grep -qx 'ANTHROPIC_API_KEY' <<<"$names"; then
  echo "NOTICE: ANTHROPIC_API_KEY also exists, and CI prefers that key."
  echo "Review your authentication choice in GitHub Actions secrets; this script will not delete other secrets."
fi

say "Done: $SECRET is saved and was checked against Claude."
