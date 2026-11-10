#!/usr/bin/env python3
"""Private, read-only intake for an authorized TrustSoft *UI-exported* CSV.

This cannot operate TrustSoft or create a reference export. It is an
evidence-capture tool to run ONLY AFTER an authorized operator uses the real
TrustSoft interface (e.g. monthly movement screen 135 or 136). Only file
hash and CSV header are accessed; no data rows are parsed or logged.
Destination JSON is private and intentionally NOT ready for parity acceptance.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SAFE_TOKEN = re.compile(r"^[A-Za-z0-9._:-]{3,128}$")
KNOWN_SCREENS = {"135", "136"}
MAX_HEADER = 65536
MAX_FILE = 512 * 1024 * 1024


class CaptureError(ValueError):
    pass


def _required_token(value: object, field: str) -> str:
    if not isinstance(value, str) or not SAFE_TOKEN.fullmatch(value):
        raise CaptureError(f"INVALID_{field.upper()}")
    return value


def _header_bytes(f) -> bytes:
    line = f.readline(MAX_HEADER + 1)
    if len(line) > MAX_HEADER or not line:
        raise CaptureError("INVALID_CSV_HEADER_SIZE")
    return line


def _read_header(raw: bytes) -> list[str]:
    try:
        decoded = raw.decode("utf-8-sig").rstrip("\r\n")
        fields = list(csv.reader(io.StringIO(decoded), strict=True))
    except (UnicodeError, csv.Error) as exc:
        raise CaptureError("INVALID_UTF8_CSV_HEADER") from exc
    if len(fields) != 1 or not fields[0] or any(not field.strip() for field in fields[0]):
        raise CaptureError("INVALID_CSV_COLUMNS")
    if len(fields[0]) != len(set(fields[0])):
        raise CaptureError("DUPLICATE_CSV_COLUMNS")
    if len(fields[0]) > 512:
        raise CaptureError("TOO_MANY_CSV_COLUMNS")
    return fields[0]


def capture(
    *,
    approved_dir: Path,
    source: Path,
    output: Path,
    screen_id: str,
    reference_build: str,
    operator_capture_ref: str,
    tenant_scope: str,
    branch_scope: str,
    filters: dict,
    ui_export_confirmed: bool,
) -> dict:
    if ui_export_confirmed is not True:
        raise CaptureError("TRUSTSOFT_UI_EXPORT_NOT_CONFIRMED")
    if screen_id not in KNOWN_SCREENS:
        raise CaptureError("UNKNOWN_TRUSTSOFT_SCREEN")
    for field, value in {
        "reference_build": reference_build,
        "operator_capture_ref": operator_capture_ref,
        "tenant_scope": tenant_scope,
        "branch_scope": branch_scope,
    }.items():
        _required_token(value, field)
    if not isinstance(filters, dict) or not filters:
        raise CaptureError("MISSING_EXACT_UI_FILTERS")
    if any(
        not isinstance(k, str) or not SAFE_TOKEN.fullmatch(k)
        or not isinstance(v, str) or not v.strip() or len(v) > 200
        for k, v in filters.items()
    ):
        raise CaptureError("INVALID_FILTERS")
    src_root = approved_dir.resolve(strict=True)
    src = source.resolve(strict=True)
    try:
        src.relative_to(src_root)
    except ValueError as exc:
        raise CaptureError("SOURCE_OUTSIDE_APPROVED_EXPORT_DIR") from exc
    if src.suffix.lower() != ".csv" or not src.is_file():
        raise CaptureError("UI_CSV_EXPORT_REQUIRED")
    size = src.stat().st_size
    if not 1 <= size <= MAX_FILE:
        raise CaptureError("REPORT_EXPORT_SIZE_OUT_OF_RANGE")
    dest = output.resolve(strict=False)
    if dest == src or dest.is_relative_to(src_root):
        raise CaptureError("CANNOT_WRITE_INSIDE_REFERENCE_EXPORT")
    if dest.suffix.lower() != ".json":
        raise CaptureError("PRIVATE_MANIFEST_MUST_BE_JSON")
    if dest.exists():
        raise CaptureError("REFUSE_OVERWRITE_PRIVATE_EVIDENCE")

    digest = hashlib.sha256()
    with src.open("rb") as stream:
        header = _read_header(_header_bytes(stream))
        stream.seek(0)
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    record = {
        "schema_version": 1,
        "classification": "PRIVATE_UI_CSV_CAPTURE_PENDING_REVIEW",
        "reference_product": "TrustSoft",
        "reference_screen_id": screen_id,
        "reference_build": reference_build,
        "operator_capture_ref": operator_capture_ref,
        "ui_export_operator_attested": True,
        "independent_capture_review_ref": None,
        "source_file_sha256": digest.hexdigest(),
        "source_file_bytes": size,
        "captured_utc": datetime.now(timezone.utc).isoformat(),
        "tenant_scope": tenant_scope,
        "branch_scope": branch_scope,
        "parameters": dict(sorted(filters.items())),
        "csv_columns": header,
        "csv_column_types_verified": False,
        "reference_ui_output_verified": False,
        "candidate_erp_output_sha256": None,
        "old_new_report_compared": False,
        "trustsoft_parity_accepted": False,
        "warning": (
            "Operator-attested UI export is NOT independently verified. "
            "Data rows must not be sent to public GitHub or CI."
        ),
    }
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Atomic exclusive create prevents accidental replacement of evidence.
    fd = os.open(str(dest), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return {
        "result": "CAPTURE_RECORDED_PENDING_INDEPENDENT_REVIEW",
        "screen_id": screen_id,
        "column_count": len(header),
        "source_sha256": digest.hexdigest(),
        "source_bytes": size,
        "trustsoft_parity_accepted": False,
        "source_file_modified": False,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--approved-export-dir", required=True, type=Path)
    p.add_argument("--source-csv", required=True, type=Path)
    p.add_argument("--private-manifest", required=True, type=Path)
    p.add_argument("--screen-id", required=True)
    p.add_argument("--reference-build", required=True)
    p.add_argument("--operator-capture-ref", required=True)
    p.add_argument("--tenant-scope", required=True)
    p.add_argument("--branch-scope", required=True)
    p.add_argument("--filters-json", required=True, type=Path)
    p.add_argument("--confirm-ui-export", action="store_true")
    args = p.parse_args()
    try:
        filters = json.loads(args.filters_json.read_text(encoding="utf-8"))
        result = capture(
            approved_dir=args.approved_export_dir,
            source=args.source_csv,
            output=args.private_manifest,
            screen_id=args.screen_id,
            reference_build=args.reference_build,
            operator_capture_ref=args.operator_capture_ref,
            tenant_scope=args.tenant_scope,
            branch_scope=args.branch_scope,
            filters=filters,
            ui_export_confirmed=args.confirm_ui_export,
        )
    except (OSError, ValueError) as exc:
        print(json.dumps({"result": "CAPTURE_BLOCKED", "error": str(exc)}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
