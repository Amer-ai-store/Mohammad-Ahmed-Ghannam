#!/usr/bin/env bash
# Verify every commit introduced by a PR has a DCO Signed-off-by matching
# its actual Git author or committer. No repository modifications or secrets.
set -euo pipefail
if [[ $# -ne 2 ]]; then
  echo "Usage: $0 BASE_SHA HEAD_SHA" >&2
  exit 2
fi
base="$1"
head="$2"
for sha in "$base" "$head"; do
  if [[ ! "$sha" =~ ^[0-9a-fA-F]{40}$ ]] || ! git cat-file -e "$sha^{commit}" 2>/dev/null; then
    echo "Invalid or missing commit SHA; refusing to claim a DCO pass." >&2
    exit 2
  fi
done
merge_base="$(git merge-base "$base" "$head")"
mapfile -t commits < <(git rev-list --reverse "$merge_base..$head")
if [[ ${#commits[@]} -eq 0 ]]; then
  echo "No PR commits to certify; refusing an empty DCO pass." >&2
  exit 1
fi
failed=0
for sha in "${commits[@]}"; do
  author_name="$(git show -s --format=%an "$sha")"
  author_email="$(git show -s --format=%ae "$sha")"
  committer_name="$(git show -s --format=%cn "$sha")"
  committer_email="$(git show -s --format=%ce "$sha")"
  message="$(git show -s --format=%B "$sha")"
  author_footer="Signed-off-by: $author_name <$author_email>"
  committer_footer="Signed-off-by: $committer_name <$committer_email>"
  if printf '%s\n' "$message" | grep -Fxq -- "$author_footer" || printf '%s\n' "$message" | grep -Fxq -- "$committer_footer"; then
    echo "PASS DCO ${sha:0:12}"
  else
    echo "FAIL DCO ${sha:0:12}: no exact author/committer sign-off" >&2
    failed=1
  fi
done
if [[ "$failed" -ne 0 ]]; then exit 1; fi
echo "Verified DCO Signed-off-by trailers on ${#commits[@]} PR commits."
