#!/usr/bin/env python3
"""Read-only guard for Issue #57; checked tasks are not proof of production acceptance."""
import json
import os
import re
import sys
from urllib.request import Request, urlopen

MARKER = "OPEN: no acceptance evidence established:"
WARNING = "\n\nWarning:"
EXPECTED_OPEN = 11
EXPECTED_BASELINE = 2


def audit(body: str, state: str = "open") -> list[str]:
    errors = []
    if state != "open":
        errors.append("ISSUE_57_NOT_OPEN: production acceptance needs an independent evidence review")
    if body.count(MARKER) != 1:
        return errors + ["MISSING_OR_DUPLICATED_OPEN_REGISTER"]
    if WARNING not in body.split(MARKER, 1)[1]:
        return errors + ["MISSING_REGISTER_BOUNDARY"]
    before, after = body.split(MARKER, 1)
    open_section = after.split(WARNING, 1)[0]
    baseline = before.split("Verified in prior controlled checks:", 1)
    if len(baseline) != 2:
        errors.append("VERIFIED_BASELINE_MARKER_MISSING")
    elif len(re.findall(r"(?m)^- \[x\] ", baseline[1])) != EXPECTED_BASELINE:
        errors.append("VERIFIED_BASELINE_COUNT_CHANGED")
    rows = re.findall(r"(?m)^- \[([x ])\] (.+)$", open_section)
    if len(rows) != EXPECTED_OPEN:
        errors.append(f"OPEN_REGISTER_ROW_COUNT_CHANGED: {len(rows)} != {EXPECTED_OPEN}")
    for checked, title in rows:
        if checked == "x":
            errors.append("UNSUPPORTED_ACCEPTANCE_CHECKBOX: " + title)
    return errors


def self_test() -> None:
    prefix = "Verified in prior controlled checks:\n- [x] health\n- [x] proxy\n\n" + MARKER + "\n"
    rows = "".join(f"- [ ] acceptance {n}\n" for n in range(EXPECTED_OPEN))
    good = prefix + rows + WARNING + "\nReport"
    assert audit(good) == []
    assert any("UNSUPPORTED_ACCEPTANCE_CHECKBOX" in e for e in audit(good.replace("- [ ] acceptance 2", "- [x] acceptance 2")))
    assert any("ROW_COUNT_CHANGED" in e for e in audit(prefix + rows.replace("- [ ] acceptance 3\n", "") + WARNING))
    assert any("ISSUE_57_NOT_OPEN" in e for e in audit(good, "closed"))
    print("PASS: marker/count/false-green/closure synthetic cases")


def check_live() -> int:
    repository = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GH_TOKEN"]
    req = Request(
        f"https://api.github.com/repos/{repository}/issues/57",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "User-Agent": "jawafa-issue57-readonly-guard"},
    )
    with urlopen(req, timeout=20) as response:
        issue = json.load(response)
    errors = audit(issue.get("body") or "", issue.get("state") or "")
    report = (
        "### Jawafa Issue #57 evidence-gate integrity\n\n"
        + f"- Issue status: {issue.get('state')}\n"
        + "- The 11 OPEN acceptance criteria must remain unchecked until independently evidenced.\n"
        + "- This check observes a public GitHub issue only. It cannot approve live SQL, finances or deployment.\n"
        + f"- Outcome: {'FAIL' if errors else 'PASS'}\n"
    )
    if errors:
        report += "\n" + "\n".join(f"- {e}" for e in errors) + "\n"
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as out:
            out.write(report)
    if errors:
        for err in errors:
            print("::error title=Jawafa release-gate evidence::" + err.replace("%", "%25").replace("\r", " ").replace("\n", " "))
        return 1
    print("PASS: Issue #57 OPEN register remains visibly unaccepted; no financial or SQL checks claimed")
    return 0


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
    elif len(sys.argv) == 1:
        sys.exit(check_live())
    else:
        raise SystemExit("Usage: check_jawafa_issue57.py [--self-test]")
