#!/usr/bin/env python3
"""Fail-closed TrustSoft functional-parity evidence gate (no source-data access).

The gate checks evidence *metadata*, not the truth of an external comparison.
Only an independent, authorized reviewer can establish real functional parity.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

STATES = {"DISCOVERED", "ANALYZED", "SPECIFIED", "BUILT", "TESTED", "MATCHED", "ACCEPTED"}
SHA256 = re.compile(r"^[0-9a-f]{64}$")
ID = re.compile(r"^[A-Z][A-Z0-9-]*$")
REQUIRED_PROOF = ("reference_evidence_sha256", "implementation_evidence_sha256",
                  "comparison_evidence_sha256", "independent_approval_ref")
# The owner explicitly requires personnel + permissions/settings in the baseline.
# This fixed minimum cannot be erased by editing mandatory_modules in JSON.
BASELINE_REQUIRED_MODULES = frozenset({
    "cheques", "bank_reconciliation", "general_ledger", "accounts_receivable",
    "procurement", "inventory", "sales_pos", "tax", "investments",
    "security", "branches", "statutory_reports", "personnel",
    "permissions_settings",
})


class InvalidCatalog(ValueError):
    pass


def _valid_hash(value: object) -> bool:
    return isinstance(value, str) and bool(SHA256.fullmatch(value))


def evaluate(catalog: dict) -> dict:
    """Return an auditable classification. Never guess the parity denominator."""
    if not isinstance(catalog, dict) or catalog.get("schema_version") != 1:
        raise InvalidCatalog("UNSUPPORTED_CATALOG_SCHEMA")
    if catalog.get("reference_product") != "TrustSoft":
        raise InvalidCatalog("REFERENCE_PRODUCT_NOT_TRUSTSOFT")
    frozen = catalog.get("catalog_frozen")
    if type(frozen) is not bool:
        raise InvalidCatalog("CATALOG_FROZEN_MUST_BE_BOOLEAN")
    entries = catalog.get("workflows")
    if not isinstance(entries, list) or not entries:
        raise InvalidCatalog("EMPTY_WORKFLOW_CATALOG")
    if frozen and not isinstance(catalog.get("catalog_approval_ref"), str):
        raise InvalidCatalog("FROZEN_CATALOG_MISSING_APPROVAL")
    if frozen and not catalog["catalog_approval_ref"].strip():
        raise InvalidCatalog("FROZEN_CATALOG_MISSING_APPROVAL")
    seen = set()
    total = accepted_weight = 0
    for entry in entries:
        if not isinstance(entry, dict):
            raise InvalidCatalog("WORKFLOW_NOT_OBJECT")
        key = entry.get("id")
        if not isinstance(key, str) or not ID.fullmatch(key) or key in seen:
            raise InvalidCatalog("INVALID_OR_DUPLICATED_WORKFLOW_ID")
        seen.add(key)
        if not isinstance(entry.get("module"), str) or not entry["module"].strip():
            raise InvalidCatalog(f"{key}:MISSING_MODULE")
        if not isinstance(entry.get("name"), str) or not entry["name"].strip():
            raise InvalidCatalog(f"{key}:MISSING_NAME")
        status = entry.get("status")
        if status not in STATES:
            raise InvalidCatalog(f"{key}:UNKNOWN_STATUS")
        weight = entry.get("weight")
        if frozen:
            if type(weight) is not int or weight <= 0:
                raise InvalidCatalog(f"{key}:UNFROZEN_WEIGHT")
            total += weight
        elif weight is not None:
            raise InvalidCatalog(f"{key}:WEIGHT_BEFORE_CATALOG_FREEZE")
        if status in ("MATCHED", "ACCEPTED"):
            if not all(_valid_hash(entry.get(field)) for field in REQUIRED_PROOF[:3]):
                raise InvalidCatalog(f"{key}:MISSING_HASHED_COMPARISON_EVIDENCE")
            approval = entry.get("independent_approval_ref")
            if not isinstance(approval, str) or not approval.strip():
                raise InvalidCatalog(f"{key}:MISSING_INDEPENDENT_APPROVAL")
        if status == "ACCEPTED" and frozen:
            accepted_weight += weight
    # A frozen register is still invalid if the scope omits core ERP workflows.
    if frozen:
        required = catalog.get("mandatory_modules")
        if not isinstance(required, list) or not required or any(
            not isinstance(m, str) or not m.strip() for m in required
        ):
            raise InvalidCatalog("FROZEN_CATALOG_MISSING_MANDATORY_MODULES")
        if not BASELINE_REQUIRED_MODULES.issubset(set(required)):
            raise InvalidCatalog("FROZEN_CATALOG_WEAKENS_OWNER_MODULE_BASELINE")
        if not set(required).issubset({e["module"] for e in entries}):
            raise InvalidCatalog("FROZEN_CATALOG_OMITS_MANDATORY_MODULE")
    score = (accepted_weight * 100 / total) if frozen else None
    ready = frozen and score >= 90
    return {
        "result": "VERIFIED_METADATA_THRESHOLD" if ready else (
            "BELOW_90_PERCENT" if frozen else "UNMEASURED"
        ),
        "parity_percent": round(score, 3) if score is not None else None,
        "catalog_frozen": frozen,
        "workflow_count": len(entries),
        "accepted_workflow_count": sum(e["status"] == "ACCEPTED" for e in entries),
        "certification_eligible": bool(ready),
        "warning": (
            "Metadata checks do not independently validate external TrustSoft behavior; "
            "source comparisons and approvals require external evidence review."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--require-90", action="store_true",
                        help="Fail if frozen, accepted weighted parity is below 90 percent")
    args = parser.parse_args()
    try:
        result = evaluate(json.loads(args.manifest.read_text(encoding="utf-8")))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"result": "INVALID_CATALOG", "error": str(exc)}))
        return 2
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if not args.require_90 or result["certification_eligible"] else 1


if __name__ == "__main__":
    sys.exit(main())
