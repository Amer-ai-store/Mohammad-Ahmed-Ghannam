#!/usr/bin/env python3
"""Privacy-safe CANDIDATE field crosswalk: owner monthly TXT-derived CSV vs ERP events.

This is NOT a certified TrustSoft comparison: owner reference screenshot,
tenant/branch, cost policy, 100% report inventory and filters remain unaudited.
Only four candidate fields are comparable, at day/item grain. Full reference
report has 43 named fields; the new ERP event view has only 11 columns.

The explicit 1000 scale assumes reference currency subunits are fils and
reported quantities have 3 fractional digits. Both remain hypotheses.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path
from render_owner_monthly_movement import EXPECTED_FIELDS, iso_day

HEX = re.compile(r"^[a-f0-9]{64}$")
DECIMAL3 = re.compile(r"^-?(?:0|[1-9]\d*)(?:\.\d{1,3})?$")
SIGNED_INT = re.compile(r"^-?(?:0|[1-9]\d*)$")
ERP_COLUMNS = (
    "day", "item_code", "purchase_qty_milli", "sales_qty_milli",
    "stock_delta_qty_milli", "purchases_before_tax_fils",
    "purchase_tax_fils", "sales_before_tax_fils", "sales_tax_fils",
    "sales_cost_fils", "sales_profit_fils",
)
CANDIDATES = (
    ("Sales_Qty", "sales_qty_milli"),
    ("Net_Sales_Before_Tax", "sales_before_tax_fils"),
    ("Net_Sales_Cost", "sales_cost_fils"),
    ("Net_Profit", "sales_profit_fils"),
)
MAX_SAFE_INT = 9007199254740991


class CandidateError(ValueError):
    pass


def _safe_checksum(blob: bytes, expected: str, kind: str) -> None:
    if not isinstance(expected, str) or not HEX.fullmatch(expected):
        raise CandidateError("INVALID_" + kind + "_SHA256")
    if hashlib.sha256(blob).hexdigest() != expected:
        raise CandidateError(kind + "_SHA256_MISMATCH")


def _date(text: str) -> str:
    try:
        return iso_day(text).isoformat()
    except ValueError as exc:
        raise CandidateError("INVALID_REFERENCE_DATE") from exc


def _source_scaled(value: str) -> int:
    # A strict, reversible candidate transform: decimal-3 -> integer milli.
    # This does NOT prove original TrustSoft field type or currency semantics.
    if not isinstance(value, str) or not DECIMAL3.fullmatch(value):
        raise CandidateError("INVALID_REFERENCE_SCALE_CANDIDATE")
    try:
        v = Decimal(value) * Decimal(1000)
    except InvalidOperation as exc:
        raise CandidateError("INVALID_REFERENCE_SCALE_CANDIDATE") from exc
    if abs(v) > MAX_SAFE_INT or v != v.to_integral_value():
        raise CandidateError("REFERENCE_SCALE_OVERFLOW")
    return int(v)


def _erp_scaled(value: str) -> int:
    if not isinstance(value, str) or not SIGNED_INT.fullmatch(value):
        raise CandidateError("INVALID_ERP_INTEGER")
    v = int(value)
    if abs(v) > MAX_SAFE_INT:
        raise CandidateError("ERP_INTEGER_OVERFLOW")
    return v


def _reader(blob: bytes, expected: tuple[str, ...], kind: str, *, trailing: bool):
    try:
        raw = blob.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(raw, newline=""), strict=True)
        header = next(reader, None)
        if not header:
            raise CandidateError(kind + "_HEADER_MISSING")
        normalized = tuple(
            value[1:-1] if value.startswith("[") and value.endswith("]")
            else value for value in (header[:-1] if trailing else header)
        )
        if (normalized != expected or (trailing and (len(header) != 44 or
                header[-1] != "")) or (not trailing and len(header) != len(expected))):
            raise CandidateError(kind + "_SCHEMA_MISMATCH")
        output = {}
        for row in reader:
            if len(row) != len(header) or (trailing and row[-1] != ""):
                raise CandidateError(kind + "_ROW_WIDTH_MISMATCH")
            fields = dict(zip(expected, row[:-1] if trailing else row))
            if trailing:
                key = (_date(fields["MonthYear"]), fields["ItemCode"])
            else:
                try:
                    day = iso_day(fields["day"]).isoformat()
                except ValueError as exc:
                    raise CandidateError("INVALID_ERP_DATE") from exc
                key = (day, fields["item_code"])
            if not key[1]:
                raise CandidateError(kind + "_MISSING_ITEM_CODE")
            if key in output:
                raise CandidateError(kind + "_DUPLICATE_DAY_ITEM")
            output[key] = fields
        return output
    except (UnicodeError, csv.Error) as exc:
        raise CandidateError(kind + "_CSV_PARSE_ERROR") from exc


def compare_private_exports(
    reference_blob: bytes, independent_blob: bytes, *,
    reference_sha256: str, independent_sha256: str,
    from_date: str, to_date: str,
    operator_scope_ref: str,
    candidate_only_acknowledged: bool,
) -> dict:
    if candidate_only_acknowledged is not True:
        raise CandidateError("EXPLICIT_CANDIDATE_ONLY_ACK_REQUIRED")
    if not isinstance(operator_scope_ref, str) or not re.fullmatch(
        r"[A-Za-z0-9._:-]{6,100}", operator_scope_ref
    ):
        raise CandidateError("SCOPE_ATTESTATION_REFERENCE_REQUIRED")
    try:
        first, last = iso_day(from_date), iso_day(to_date)
    except ValueError as exc:
        raise CandidateError("INVALID_SCOPE_DATE") from exc
    if first > last:
        raise CandidateError("REVERSED_SCOPE")
    _safe_checksum(reference_blob, reference_sha256, "REFERENCE")
    _safe_checksum(independent_blob, independent_sha256, "INDEPENDENT")
    source = _reader(reference_blob, EXPECTED_FIELDS, "REFERENCE", trailing=True)
    erp = _reader(independent_blob, ERP_COLUMNS, "ERP", trailing=False)

    if any(not first <= iso_day(k[0]) <= last for k in set(source) | set(erp)):
        raise CandidateError("ROW_OUTSIDE_ASSERTED_SCOPE")
    reference_keys = set(source)
    erp_keys = set(erp)
    both = reference_keys & erp_keys
    differences = Counter()
    disagreeing_rows = 0
    for key in both:
        left, right = source[key], erp[key]
        any_difference = False
        for source_col, erp_col in CANDIDATES:
            if _source_scaled(left[source_col]) != _erp_scaled(right[erp_col]):
                differences[source_col] += 1
                any_difference = True
        if any_difference:
            disagreeing_rows += 1
    return {
        "result": "CANDIDATE_FIELD_CHECK_ONLY",
        "basis": "OWNER_UNATTESTED_CSV_VS_INDEPENDENT_ERP_EVENTS_ASSUMED_SCOPE",
        "scope_reference": operator_scope_ref,
        "reference_sha256": reference_sha256,
        "independent_sha256": independent_sha256,
        "reference_rows": len(source),
        "independent_erp_rows": len(erp),
        "common_day_item_keys": len(both),
        "reference_only_keys": len(reference_keys - erp_keys),
        "erp_only_keys": len(erp_keys - reference_keys),
        "different_common_rows": disagreeing_rows,
        "different_cell_counts_by_reference_field": dict(sorted(differences.items())),
        "candidate_field_count": len(CANDIDATES),
        "owner_reference_named_field_count": len(EXPECTED_FIELDS),
        "unassessed_source_fields": len(EXPECTED_FIELDS) - len(CANDIDATES),
        "reference_scale_assumption": "decimal_3_reference_x1000_TO_ERP_INTEGER_FILS_MILLI",
        "same_tenant_branch_verified": False,
        "source_event_completeness_verified": False,
        "vendor_business_formula_verified": False,
        "owner_report_parity_accepted": False,
        "functional_parity_percent": None,
        "warning": "Counts of candidate field coincidences are NOT TrustSoft report parity.",
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--reference-csv", required=True, type=Path)
    p.add_argument("--independent-erp-csv", required=True, type=Path)
    p.add_argument("--reference-sha256", required=True)
    p.add_argument("--independent-sha256", required=True)
    p.add_argument("--from-date", required=True)
    p.add_argument("--to-date", required=True)
    p.add_argument("--operator-scope-ref", required=True)
    p.add_argument("--acknowledge-candidate-only", action="store_true")
    args = p.parse_args()
    try:
        if args.reference_csv.resolve(strict=True) == (
            args.independent_erp_csv.resolve(strict=True)
        ):
            raise CandidateError("SAME_FILE_NOT_INDEPENDENT")
        result = compare_private_exports(
            args.reference_csv.read_bytes(), args.independent_erp_csv.read_bytes(),
            reference_sha256=args.reference_sha256,
            independent_sha256=args.independent_sha256,
            from_date=args.from_date, to_date=args.to_date,
            operator_scope_ref=args.operator_scope_ref,
            candidate_only_acknowledged=args.acknowledge_candidate_only,
        )
    except (OSError, ValueError) as exc:
        print(json.dumps({"result": "BLOCKED", "error": str(exc)}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0 if (result["reference_only_keys"] == 0 and
                 result["erp_only_keys"] == 0 and
                 result["different_common_rows"] == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
