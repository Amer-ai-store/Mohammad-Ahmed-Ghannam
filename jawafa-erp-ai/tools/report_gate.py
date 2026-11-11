#!/usr/bin/env python3
"""Fail-closed TrustSoft report coverage auditor for the NEW JAWAFA ERP AI.

It checks metadata completeness only. It does NOT prove that a report's behavior,
filtering, layout, calculations, output format or authorization matches TrustSoft.
Production certification requires independent, reproducible evidence review.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HASH = re.compile(r"^[0-9a-f]{64}$")
ID = re.compile(r"^[A-Z][A-Z0-9_-]*$")
ALLOWED_STATES = {
    "DISCOVERED", "ANALYZED", "SPECIFIED", "BUILT", "TESTED",
    "MATCHED", "ACCEPTED",
}
PROOFS = (
    "reference_evidence_sha256",
    "implementation_evidence_sha256",
    "comparison_evidence_sha256",
)
TEST_FLAGS = (
    "filters_tested",
    "totals_tested",
    "format_layout_tested",
    "permissions_tested",
    "historical_consistency_tested",
)
COVERAGE_FLAGS = (
    "reference_version_verified",
    "menu_screen_inventory_complete",
    "report_template_inventory_complete",
    "all_owner_used_reports_enumerated",
)


class InvalidReportCatalog(ValueError):
    pass


def _valid_hash(value: object) -> bool:
    return isinstance(value, str) and bool(HASH.fullmatch(value))


def evaluate(catalog: dict) -> dict:
    if not isinstance(catalog, dict) or catalog.get("schema_version") != 1:
        raise InvalidReportCatalog("UNSUPPORTED_REPORT_CATALOG_SCHEMA")
    if catalog.get("reference_product") != "TrustSoft":
        raise InvalidReportCatalog("REPORT_REFERENCE_NOT_TRUSTSOFT")
    if catalog.get("scope") != "all_owner_accessible_and_used_reports_across_every_module":
        raise InvalidReportCatalog("REPORT_SCOPE_WEAKENED")
    frozen = catalog.get("catalog_frozen")
    if type(frozen) is not bool:
        raise InvalidReportCatalog("REPORT_CATALOG_FROZEN_NOT_BOOLEAN")
    reports = catalog.get("reports")
    if not isinstance(reports, list):
        raise InvalidReportCatalog("REPORTS_NOT_LIST")
    for flag in COVERAGE_FLAGS:
        if type(catalog.get(flag)) is not bool:
            raise InvalidReportCatalog(f"{flag}:NOT_BOOLEAN")
        if frozen and catalog[flag] is not True:
            raise InvalidReportCatalog(f"{flag}:INCOMPLETE_REFERENCE_INVENTORY")
    if frozen:
        if not reports:
            raise InvalidReportCatalog("FROZEN_REPORT_CATALOG_EMPTY")
        approval = catalog.get("independent_catalog_approval_ref")
        if not isinstance(approval, str) or not approval.strip():
            raise InvalidReportCatalog("FROZEN_REPORT_CATALOG_MISSING_APPROVAL")
        if not _valid_hash(catalog.get("evidence_snapshot_sha256")):
            raise InvalidReportCatalog("FROZEN_REPORT_CATALOG_MISSING_SOURCE_HASH")

    names = set()
    accepted = 0
    for report in reports:
        if not isinstance(report, dict):
            raise InvalidReportCatalog("REPORT_ENTRY_NOT_OBJECT")
        key = report.get("id")
        if not isinstance(key, str) or not ID.fullmatch(key) or key in names:
            raise InvalidReportCatalog("INVALID_OR_DUPLICATE_REPORT_ID")
        names.add(key)
        for field in ("module", "reference_menu_path", "reference_report_name"):
            if not isinstance(report.get(field), str) or not report[field].strip():
                raise InvalidReportCatalog(f"{key}:{field}:REQUIRED")
        if report.get("status") not in ALLOWED_STATES:
            raise InvalidReportCatalog(f"{key}:UNKNOWN_REPORT_STATE")
        if report["status"] in ("MATCHED", "ACCEPTED"):
            if not all(_valid_hash(report.get(p)) for p in PROOFS):
                raise InvalidReportCatalog(f"{key}:MISSING_REPORT_COMPARISON_EVIDENCE")
            review = report.get("independent_approval_ref")
            if not isinstance(review, str) or not review.strip():
                raise InvalidReportCatalog(f"{key}:MISSING_INDEPENDENT_REPORT_APPROVAL")
            if any(report.get(flag) is not True for flag in TEST_FLAGS):
                raise InvalidReportCatalog(f"{key}:REPORT_TEST_MATRIX_INCOMPLETE")
        if report["status"] == "ACCEPTED":
            accepted += 1

    covered = frozen and len(reports) > 0 and accepted == len(reports)
    return {
        "result": "ALL_REPORTS_ACCEPTED_METADATA_ONLY" if covered else (
            "REPORTS_INCOMPLETE" if frozen else "UNMEASURED"
        ),
        "report_count": len(reports),
        "accepted_reports": accepted,
        "missing_reports": len(reports) - accepted,
        "catalog_frozen": frozen,
        "owner_report_coverage_percent": (
            round(100 * accepted / len(reports), 3) if frozen else None
        ),
        "report_release_gate_passed": bool(covered),
        "warning": (
            "The report gate validates catalog metadata only; independent "
            "TrustSoft report output comparison and catalog completeness "
            "must be established by authorized reviewers."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--require-all", action="store_true")
    args = parser.parse_args()
    try:
        result = evaluate(json.loads(args.manifest.read_text(encoding="utf-8")))
    except (OSError, ValueError) as exc:
        print(json.dumps({"result": "INVALID_REPORT_CATALOG", "error": str(exc)}))
        return 2
    print(json.dumps(result, sort_keys=True, ensure_ascii=False))
    return 0 if not args.require_all or result["report_release_gate_passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
