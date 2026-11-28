#!/usr/bin/env bash
# Test the DCO gate against synthetic commits, never real credentials.
set -euo pipefail
checker="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check_pr_dco.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
git init -q
git config user.name 'Fixture Author'
git config user.email 'fixture@example.invalid'
git -c commit.gpgsign=false commit --allow-empty -q -m 'baseline'
base="$(git rev-parse HEAD)"
git -c commit.gpgsign=false commit --allow-empty -q -m $'signed change\n\nSigned-off-by: Fixture Author <fixture@example.invalid>'
signed="$(git rev-parse HEAD)"
bash "$checker" "$base" "$signed" >/dev/null
git -c commit.gpgsign=false commit --allow-empty -q -m 'unsigned change'
unsigned="$(git rev-parse HEAD)"
if bash "$checker" "$base" "$unsigned" >/dev/null 2>&1; then
  echo 'FAIL: unsigned commit passed DCO gate' >&2
  exit 1
fi
git -c commit.gpgsign=false commit --allow-empty -q -m $'spoofed signature\n\nSigned-off-by: Other Person <someone@example.invalid>'
spoofed="$(git rev-parse HEAD)"
if bash "$checker" "$base" "$spoofed" >/dev/null 2>&1; then
  echo 'FAIL: unrelated contributor footer passed DCO gate' >&2
  exit 1
fi
echo 'PASS: real author sign-off accepted; unsigned and mismatched sign-offs rejected.'
