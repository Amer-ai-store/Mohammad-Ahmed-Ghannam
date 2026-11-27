#!/usr/bin/env python3
"""Verify per-commit DCO trailers in a pull request without any privileged token.

This is a repository-native trailer audit, NOT certification by the external DCO
GitHub App and NOT a substitute for an independent human security review.
"""
from __future__ import annotations

import re
import subprocess
import sys

TRAILER = re.compile(
    r"^[ \t]*Signed-off-by:[ \t]*(?P<name>[^<>\r\n]+?)"
    r"[ \t]*<(?P<email>[^<>\r\n]+)>[ \t]*$",
    re.IGNORECASE | re.MULTILINE,
)


def trailer_matches_author(message: str, author_name: str, author_email: str) -> bool:
    """Require an explicit exact author-name + email certification trailer."""
    return any(
        m.group("name").strip() == author_name.strip()
        and m.group("email").strip() == author_email.strip()
        for m in TRAILER.finditer(message)
    )


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args], text=True, encoding="utf-8", stderr=subprocess.PIPE
    ).rstrip("\n")


def audit(base_ref: str = "origin/main") -> int:
    # Rev-list from the merge-base excludes unmodified target history.
    merge_base = git("merge-base", base_ref, "HEAD")
    commits = [
        sha for sha in git("rev-list", "--reverse", f"{merge_base}..HEAD").splitlines()
        if sha
    ]
    if not commits:
        print("DCO_TRAILER_AUDIT_NO_COMMITS: no PR commits to certify", file=sys.stderr)
        return 1
    failed = []
    for sha in commits:
        name, email, message = git(
            "show", "-s", "--format=%an%x00%ae%x00%B", sha
        ).split("\x00", 2)
        if not trailer_matches_author(message, name, email):
            failed.append(sha)
    if failed:
        print("DCO_TRAILER_AUDIT_FAIL: missing/mismatched author trailers: "
              + ", ".join(failed), file=sys.stderr)
        return 1
    print(f"DCO_TRAILER_AUDIT_PASS: verified {len(commits)} PR commit authors/trailers.")
    print("This check does not represent the external DCO App or independent approval.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(audit(sys.argv[1] if len(sys.argv) > 1 else "origin/main"))
    except (subprocess.CalledProcessError, ValueError) as error:
        print(f"DCO_TRAILER_AUDIT_ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
