#!/usr/bin/env bash
# Non-secret regressions for the optional Claude token helper.
set -euo pipefail
helper="scripts/save-claude-token.sh"
bash -n "$helper"

# Never create a plaintext terminal transcript or silently remove unrelated secrets.
if grep -Eq '(^|[[:space:]])script[[:space:]]+(-|--)' "$helper"; then
  echo "FAIL: terminal transcript command must not be used"
  exit 1
fi
if grep -Eq '(^|[[:space:]])(mktemp|tee)[[:space:]]' "$helper"; then
  echo "FAIL: credential-bearing temporary output is forbidden"
  exit 1
fi
if grep -Eq 'gh[[:space:]]+secret[[:space:]]+delete' "$helper"; then
  echo "FAIL: helper must not delete unrelated secrets"
  exit 1
fi
grep -Fq 'read -r -s' "$helper"
grep -Fq 'set +x' "$helper"
grep -Fq 'gh secret list' "$helper"

# Fail-closed path without a token: isolated mock commands, no actual auth or secrets.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat >"$tmp/bin/git" <<'MOCK'
#!/usr/bin/env bash
echo "https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam.git"
MOCK
cat >"$tmp/bin/gh" <<'MOCK'
#!/usr/bin/env bash
if [[ "$*" == secret\ list* ]]; then exit 1; fi
echo "$*" >>"$SECURE_HELPER_MOCK_LOG"
MOCK
cat >"$tmp/bin/claude" <<'MOCK'
#!/usr/bin/env bash
echo "SHOULD_NOT_CALL_CLAUDE" >>"$SECURE_HELPER_MOCK_LOG"
MOCK
chmod +x "$tmp/bin/"*
export SECURE_HELPER_MOCK_LOG="$tmp/mock.log"
if PATH="$tmp/bin:$PATH" bash "$helper" </dev/null >"$tmp/stdout" 2>"$tmp/stderr"; then
  echo "FAIL: script continued without authorized secrets-manager access"
  exit 1
fi
test ! -s "$SECURE_HELPER_MOCK_LOG"
if grep -Eq 'sk-ant-oat[0-9]+-' "$tmp/stdout" "$tmp/stderr"; then
  echo "FAIL: token appears in status output"
  exit 1
fi
echo "PASS: helper syntax, no transcript, no secret deletion, fail-closed authentication."
