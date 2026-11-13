#!/usr/bin/env python3
"""Strict, READ-ONLY source TABLE header audit for monthly movements.

A 44-column TrustSoft exported source-table HEADER is a different artifact from
the owner-accessible TrustSoft REPORT output. This check prevents declaring
report parity based solely on source column names or synthetic ERP unit tests.
It never opens a source data row, connects to SQL, or changes files.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
from pathlib import Path

HASH = re.compile(r"^[a-f0-9]{64}$")
MAX_HEADER_BYTES = 65536


class SourceSchemaError(ValueError):
    pass


def _decode_header_line(blob: bytes) -> list[str]:
    if not blob or len(blob) > MAX_HEADER_BYTES or b"\n" in blob:
        raise SourceSchemaError("INVALID_SOURCE_HEADER_BYTES")
    try:
        decoded = blob.decode("utf-8-sig").rstrip("\r\n")
        parsed = list(csv.reader(io.StringIO(decoded), strict=True))
    except (UnicodeDecodeError, csv.Error) as exc:
        raise SourceSchemaError("SOURCE_HEADER_NOT_UTF8_CSV") from exc
    if len(parsed) != 1 or not parsed[0] or not all(parsed[0]):
        raise SourceSchemaError("INVALID_CSV_HEADER_FIELDS")
    if len(set(parsed[0])) != len(parsed[0]):
        raise SourceSchemaError("DUPLICATE_SOURCE_HEADER_FIELDS")
    return parsed[0]


def _header_hash(names: list[str]) -> str:
    return hashlib.sha256("\n".join(names).encode("utf-8")).hexdigest()


def audit(manifest: dict, header_line: bytes | None = None) -> dict:
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1:
        raise SourceSchemaError("INVALID_REFERENCE_SCHEMA_MANIFEST")
    if (manifest.get("reference_product") != "TrustSoft" or
            manifest.get("source_table") != "dbo.MonthlyMovementSummaryReport" or
            manifest.get("source_kind") != "CSV_HEADER_ONLY_NOT_UI_REPORT"):
        raise SourceSchemaError("UNTRUSTED_SOURCE_SCHEMA_IDENTITY")
    columns = manifest.get("columns")
    count = manifest.get("expected_column_count")
    if not isinstance(columns, list) or type(count) is not int or count <= 0:
        raise SourceSchemaError("INVALID_COLUMNS_COUNT")
    if len(columns) != count:
        raise SourceSchemaError("COLUMN_COUNT_MISMATCH")
    source_names = []
    for i, field in enumerate(columns):
        if not isinstance(field, dict):
            raise SourceSchemaError("INVALID_COLUMN_RECORD")
        if type(field.get("ordinal")) is not int or field["ordinal"] != i + 1:
            raise SourceSchemaError("COLUMN_POSITION_MISMATCH")
        name = field.get("name")
        if not isinstance(name, str) or not name.strip():
            raise SourceSchemaError("EMPTY_FIELD_NAME")
        if field.get("source_type") == "UNKNOWN_NOT_OBSERVED":
            if field.get("business_formula_verified") is not False:
                raise SourceSchemaError("FALSE_FORMULA_VERIFICATION")
        elif not isinstance(field.get("source_type"), str):
            raise SourceSchemaError("INVALID_SOURCE_TYPE")
        if type(field.get("business_formula_verified")) is not bool:
            raise SourceSchemaError("INVALID_FORMULA_VERIFICATION")
        erp_name = field.get("candidate_erp_field")
        if erp_name is not None and not isinstance(erp_name, str):
            raise SourceSchemaError("INVALID_CANDIDATE_MAPPING")
        source_names.append(name)
    if len(set(source_names)) != len(source_names):
        raise SourceSchemaError("DUPLICATE_COLUMN_NAME")
    expected = manifest.get("header_columns_sha256")
    if not isinstance(expected, str) or not HASH.fullmatch(expected):
        raise SourceSchemaError("MISSING_HEADER_SHA256")
    if _header_hash(source_names) != expected:
        raise SourceSchemaError("REFERENCE_MANIFEST_HEADER_HASH_MISMATCH")
    candidate_cols = manifest.get("candidate_columns")
    if (not isinstance(candidate_cols, list) or
            len(candidate_cols) != 7 or
            len(set(candidate_cols)) != len(candidate_cols) or
            any(not isinstance(x, str) or not x for x in candidate_cols)):
        raise SourceSchemaError("INVALID_SYNTHETIC_REPORT_COLUMNS")
    if manifest.get("candidate_report_kind") != "SYNTHETIC_MONTHLY_ITEM_MOVEMENT":
        raise SourceSchemaError("UNEXPECTED_CANDIDATE_REPORT_KIND")
    for key in ("reference_runtime_output_captured",
                "reference_semantics_verified", "owner_report_accepted"):
        if type(manifest.get(key)) is not bool:
            raise SourceSchemaError("INVALID_REFERENCE_ACCEPTANCE_FLAG")
    if manifest["owner_report_accepted"]:
        raise SourceSchemaError("SOURCE_HEADER_CANNOT_ACCEPT_UI_REPORT")
    if manifest["reference_runtime_output_captured"]:
        digest = manifest.get("reference_output_sha256")
        if not isinstance(digest, str) or not HASH.fullmatch(digest):
            raise SourceSchemaError("MISSING_RUNTIME_REPORT_OUTPUT_EVIDENCE")
    if manifest["reference_semantics_verified"] and any(
        not col["business_formula_verified"] for col in columns
    ):
        raise SourceSchemaError("UNVERIFIED_SOURCE_FORMULAS_CANNOT_BE_CONFIRMED")
    header_validated = None
    if header_line is not None:
        actual_names = _decode_header_line(header_line)
        if actual_names != source_names:
            raise SourceSchemaError("SOURCE_HEADER_DRIFT_OR_ORDER_CHANGE")
        if _header_hash(actual_names) != expected:
            raise SourceSchemaError("SOURCE_HEADER_SHA256_MISMATCH")
        header_validated = True
    return {
        "reference_product": "TrustSoft",
        "source_table": manifest["source_table"],
        "source_header_field_count": len(source_names),
        "candidate_report_field_count": len(candidate_cols),
        "source_header_verified_against_export": header_validated,
        "unverified_formula_field_count": sum(
            col["business_formula_verified"] is False for col in columns
        ),
        "candidate_report_source_mappings_count": sum(
            col["candidate_erp_field"] is not None for col in columns
        ),
        "reference_runtime_report_captured": manifest["reference_runtime_output_captured"],
        "owner_report_parity_accepted": False,
        "report_parity_percent": None,
        "result": "SCHEMA_HEADER_OBSERVED_REPORT_UNMEASURED",
        "warning": (
            "Observed source-table header is NOT the TrustSoft printed report. "
            "Do not assume meaning, types, formulas, opening balance or tax behavior."
        ),
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--source-export-header-from", type=Path)
    p.add_argument("--require-report-accepted", action="store_true")
    args = p.parse_args()
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        header = None
        if args.source_export_header_from:
            # Deliberately reads exactly ONE line, no accounting/numeric rows.
            with args.source_export_header_from.open("rb") as source:
                header = source.readline(MAX_HEADER_BYTES + 1)
            if header.endswith(b"\n"):
                header = header[:-1]
            if header.endswith(b"\r"):
                header = header[:-1]
        result = audit(manifest, header)
    except (OSError, ValueError) as exc:
        print(json.dumps({"result": "SOURCE_SCHEMA_AUDIT_BLOCKED",
                          "error": str(exc)}, sort_keys=True))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 1 if args.require_report_accepted else 0


if __name__ == "__main__":
    sys.exit(main())
