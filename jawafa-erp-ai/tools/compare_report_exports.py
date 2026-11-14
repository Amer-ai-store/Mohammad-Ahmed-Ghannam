#!/usr/bin/env python3
"""Read-only, privacy-preserving CSV parity check for approved report exports.

Reference TrustSoft output and the independent ERP output must be captured
separately by authorized operators. Their exact hashes, scoped parameters and
reference screen ID are supplied in an attested manifest. Output contains ONLY
counts/status, never record contents. This comparison is ONE evidence step;
it does not certify printed layout, permissions or 90% ERP parity.

Only UTF-8 CSV is accepted. PDF/XLSX/Crystal binary rendering require a
separate approved structural/layout comparison workflow.
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

HEX = re.compile(r"^[0-9a-f]{64}$")
IDENT = re.compile(r"^[A-Z0-9][A-Z0-9_-]{2,99}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
NUMERIC_TYPES = {"integer_fils", "integer_milli", "decimal_3"}
TYPES = NUMERIC_TYPES | {"text", "date"}


class ReportComparisonError(ValueError):
    pass


def _hash(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def _required_str(record: dict, field: str) -> str:
    v = record.get(field)
    if not isinstance(v, str) or not v.strip():
        raise ReportComparisonError(f"MISSING_{field.upper()}")
    return v


def validate_manifest(manifest: dict) -> list[dict]:
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1:
        raise ReportComparisonError("INVALID_COMPARISON_MANIFEST")
    report_id = _required_str(manifest, "report_id")
    if not IDENT.fullmatch(report_id):
        raise ReportComparisonError("INVALID_REPORT_ID")
    for field in ("reference_screen_id", "reference_build",
                  "capture_approval_ref", "tenant_scope", "branch_scope"):
        _required_str(manifest, field)
    parameters = manifest.get("parameters")
    if not isinstance(parameters, dict) or not parameters:
        raise ReportComparisonError("MISSING_APPROVED_FILTER_PARAMETERS")
    for key, value in parameters.items():
        if not isinstance(key, str) or not key.strip() or not isinstance(value, str):
            raise ReportComparisonError("INVALID_FILTER_PARAMETERS")
    for field in ("reference_sha256", "candidate_sha256"):
        if not isinstance(manifest.get(field), str) or not HEX.fullmatch(manifest[field]):
            raise ReportComparisonError(f"INVALID_{field.upper()}")
    cols = manifest.get("columns")
    if not isinstance(cols, list) or not cols:
        raise ReportComparisonError("MISSING_COLUMN_SPEC")
    names = set()
    for col in cols:
        if not isinstance(col, dict):
            raise ReportComparisonError("INVALID_COLUMN_SPEC")
        name = _required_str(col, "name")
        if name in names:
            raise ReportComparisonError("DUPLICATE_COLUMN_SPEC")
        names.add(name)
        if col.get("type") not in TYPES:
            raise ReportComparisonError("UNKNOWN_COLUMN_TYPE")
    if manifest.get("reference_capture_authorized") is not True:
        raise ReportComparisonError("REFERENCE_NOT_AUTHORIZED")
    if manifest.get("candidate_is_read_only_export") is not True:
        raise ReportComparisonError("CANDIDATE_NOT_READ_ONLY")
    if manifest.get("compare_row_order") is not True:
        raise ReportComparisonError("ROW_ORDER_MUST_BE_EXPLICITLY_COMPARED")
    return cols


def _read_csv(blob: bytes, expected_headers: list[str]) -> list[dict]:
    try:
        stream = io.StringIO(blob.decode("utf-8-sig"), newline="")
        reader = csv.DictReader(stream, strict=True)
        if reader.fieldnames != expected_headers:
            raise ReportComparisonError("COLUMN_ORDER_OR_NAMES_DIFFER")
        rows = []
        for row in reader:
            if None in row or any(value is None for value in row.values()):
                raise ReportComparisonError("MALFORMED_CSV_ROW")
            rows.append(row)
        return rows
    except (UnicodeDecodeError, csv.Error) as exc:
        raise ReportComparisonError("INVALID_UTF8_CSV") from exc


def _normal(value: str, kind: str) -> str:
    if kind == "text":
        return value
    if kind == "date":
        import datetime
        if not DATE.fullmatch(value):
            raise ReportComparisonError("INVALID_DATE_CELL")
        try:
            datetime.date.fromisoformat(value)
        except ValueError as exc:
            raise ReportComparisonError("INVALID_DATE_CELL") from exc
        return value
    if kind in ("integer_fils", "integer_milli"):
        if not re.fullmatch(r"-?(?:0|[1-9]\d*)", value):
            raise ReportComparisonError("INVALID_INTEGER_CELL")
        return str(int(value))
    if kind == "decimal_3":
        if not re.fullmatch(r"-?(?:0|[1-9]\d*)(?:\.\d{1,3})?", value):
            raise ReportComparisonError("INVALID_DECIMAL_3_CELL")
        try:
            return str(Decimal(value).normalize())
        except InvalidOperation as exc:
            raise ReportComparisonError("INVALID_DECIMAL_3_CELL") from exc
    raise ReportComparisonError("UNKNOWN_COLUMN_TYPE")


def compare(manifest: dict, reference_bytes: bytes, candidate_bytes: bytes) -> dict:
    columns = validate_manifest(manifest)
    if _hash(reference_bytes) != manifest["reference_sha256"]:
        raise ReportComparisonError("REFERENCE_HASH_MISMATCH")
    if _hash(candidate_bytes) != manifest["candidate_sha256"]:
        raise ReportComparisonError("CANDIDATE_HASH_MISMATCH")
    headers = [c["name"] for c in columns]
    result = {
        "report_id": manifest["report_id"],
        "reference_build": manifest["reference_build"],
        "reference_sha256": manifest["reference_sha256"],
        "candidate_sha256": manifest["candidate_sha256"],
        "comparison_class": "CSV_DATA_ONLY_NOT_PRINT_LAYOUT_OR_ROLE_PROOF",
        "matched": False,
        "reference_rows": None,
        "candidate_rows": None,
        "different_row_positions": None,
        "different_cell_counts_by_column": {},
        "trustsoft_parity_accepted": False,
    }
    reference = _read_csv(reference_bytes, headers)
    candidate = _read_csv(candidate_bytes, headers)
    result["reference_rows"] = len(reference)
    result["candidate_rows"] = len(candidate)
    different = Counter()
    different_rows = 0
    for i in range(max(len(reference), len(candidate))):
        if i >= len(reference) or i >= len(candidate):
            different_rows += 1
            continue
        row_mismatch = False
        for col in columns:
            key = col["name"]
            expected = _normal(reference[i][key], col["type"])
            actual = _normal(candidate[i][key], col["type"])
            if expected != actual:
                different[key] += 1
                row_mismatch = True
        different_rows += int(row_mismatch)
    result["different_row_positions"] = different_rows
    result["different_cell_counts_by_column"] = dict(sorted(different.items()))
    result["matched"] = len(reference) == len(candidate) and different_rows == 0
    # CSV equality alone can never approve the entire TrustSoft report behavior.
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--reference-csv", type=Path, required=True)
    parser.add_argument("--candidate-csv", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.reference_csv.resolve() == args.candidate_csv.resolve():
            raise ReportComparisonError("SAME_FILE_CANNOT_BE_BOTH_SOURCES")
        manifest = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
        result = compare(
            manifest,
            args.reference_csv.read_bytes(),
            args.candidate_csv.read_bytes(),
        )
    except (OSError, ValueError) as exc:
        print(json.dumps({"result": "COMPARISON_BLOCKED",
                          "error": str(exc)}, sort_keys=True))
        return 2
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if result["matched"] else 1


if __name__ == "__main__":
    sys.exit(main())
