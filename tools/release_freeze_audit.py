#!/usr/bin/env python3
"""Non-deployment, non-secret static guard for Issue #102.

Inspects committed workflow source only. It cannot prove provider-side deployment
restrictions, queued jobs, GitHub Pages settings or external integration settings.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys

# Explicit publishing actions / commands; avoid blocking safe artifact uploads or test CI.
PUBLISH_SIGNATURES = {
    "GitHub Pages deployment action": r"\buses:\s*actions/deploy-pages@",
    "GitHub release publication": r"\bgh\s+release\s+create\b",
    "GitHub release action": r"\buses:\s*softprops/action-gh-release@",
    "Cloudflare deploy": r"\b(?:npx\s+)?wrangler\s+(?:deploy|publish)\b",
    "Cloudflare Pages publish": r"\bwrangler\s+pages\s+deploy\b",
    "Vercel deploy": r"\b(?:npx\s+)?vercel\s+(?:deploy|--prod)\b",
    "Firebase deploy": r"\bfirebase\s+deploy\b",
    "Expo EAS submission": r"\beas\s+submit\b",
    "Play Store release action": r"\buses:\s*r0adkll/upload-google-play@",
    "Apple App Store upload": r"\buses:\s*apple-actions/upload-testflight-build@",
    "Docker publishing": r"\bdocker\s+push\b",
}
COMPILED = [(name, re.compile(pattern, re.IGNORECASE)) for name, pattern in PUBLISH_SIGNATURES.items()]
PERMISSION_RISK = re.compile(r"^\s*(?:pages|deployments):\s*write\s*$", re.IGNORECASE | re.MULTILINE)


def inspect_workflow(name: str, body: str) -> list[str]:
    # YAML comments do not execute; avoid false positives from notes and examples.
    content = "\n".join(line for line in body.splitlines() if not line.lstrip().startswith("#"))
    findings = [f"{name}: {label}" for label, pattern in COMPILED if pattern.search(content)]
    if PERMISSION_RISK.search(content):
        findings.append(f"{name}: publish-capable permissions")
    if name == "pages.yml" and "Production Pages deployment frozen" not in body:
        findings.append("pages.yml: expected explicit production freeze marker missing")
    return findings


def audit(root: Path) -> tuple[int, list[str]]:
    folder = root / ".github" / "workflows"
    paths = sorted((*folder.glob("*.yml"), *folder.glob("*.yaml")))
    if not paths:
        return 0, ["No tracked workflow files: cannot verify static freeze"]
    issues: list[str] = []
    for path in paths:
        issues.extend(inspect_workflow(path.name, path.read_text(encoding="utf-8")))
    return len(paths), issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    count, issues = audit(args.root)
    print(f"Inspected {count} tracked workflow files.")
    if issues:
        for item in issues:
            print("BLOCKED:", item)
        return 1
    print("PASS: no known direct publishing patterns in tracked workflow source.")
    print("LIMITATION: external deployment integrations, historical workflows,")
    print("branch protections and pending production runs require independent checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
