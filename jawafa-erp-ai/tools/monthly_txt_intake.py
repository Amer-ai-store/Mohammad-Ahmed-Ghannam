#!/usr/bin/env python3
"""Read-only TrustSoft monthly TXT (UTF-16 TSV) intake for JAWAFA ERP AI.

Private source/export bytes never belong in GitHub. This converter:
- requires UTF-16 BOM, strict 44 TSV cells (43 meaningful + one empty suffix)
- preserves ALL original field values as strings; only date is normalized
- never converts malformed numeric strings such as ',0.000' to 0.000
- rejects overwrites, duplicate day/item identities and schema drift
- emits UTF-8 BOM CSV and a private count-only QA metadata manifest
- explicitly does NOT certify the file as authentic TrustSoft UI output.
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import os
import re
import sys
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

TRAILING_EXPECTED = 44
NAMED_FIELDS = 43
PROFIT_FIELDS = ("Net_Sales_Before_Tax", "Net_Sales_Cost", "Net_Profit")
LEGACY_TEXT_COSTS = {
    "Cost_Damage", "Cost_Installation Damage", "Cost_Maintenance Damage"
}
DATE = re.compile(r"^\s*(\d{4})\s*/\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")


class IntakeError(ValueError):
    pass


def _iso(value: str) -> str:
    match = DATE.fullmatch(value)
    if match is None:
        raise IntakeError("INVALID_SOURCE_DATE")
    try:
        return date(*(int(x) for x in match.groups())).isoformat()
    except ValueError as exc:
        raise IntakeError("INVALID_SOURCE_DATE") from exc


def _sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while data := stream.read(1024 * 1024):
            digest.update(data)
    return digest.hexdigest()


def ingest(source: Path, output: Path, private_manifest: Path) -> dict:
    if not source.is_file():
        raise IntakeError("SOURCE_TXT_NOT_FOUND")
    if source.suffix.lower() != ".txt":
        raise IntakeError("SOURCE_MUST_BE_TXT")
    resolved = source.resolve()
    targets = [output.resolve(), private_manifest.resolve()]
    if len(set([resolved, *targets])) != 3:
        raise IntakeError("INPUT_OR_OUTPUT_PATH_COLLISION")
    if output.exists() or private_manifest.exists():
        raise IntakeError("REFUSE_OVERWRITE_ORIGINAL_OR_EXISTING_EVIDENCE")
    if output.suffix.lower() != ".csv" or private_manifest.suffix.lower() != ".json":
        raise IntakeError("INVALID_OUTPUT_EXTENSIONS")
    with source.open("rb") as stream:
        if stream.read(2) != b"\xff\xfe":
            raise IntakeError("EXPECTED_UTF16_LE_BOM")
    days = collections.Counter()
    identities = set()
    anomalies = collections.Counter()
    seen_items = set()
    rows = 0
    source_columns = []
    output.parent.mkdir(parents=True, exist_ok=True)
    private_manifest.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation: do not silently change any previous evidence.
    handle = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with source.open("r", encoding="utf-16", newline="") as stream, \
                os.fdopen(handle, "w", encoding="utf-8-sig", newline="") as target:
            reader = csv.reader(stream, delimiter="\t", strict=True)
            writer = csv.writer(target, lineterminator="\r\n")
            try:
                source_columns = next(reader)
            except StopIteration as exc:
                raise IntakeError("EMPTY_SOURCE") from exc
            if len(source_columns) != TRAILING_EXPECTED or source_columns[-1] != "":
                raise IntakeError("EXPECTED_43_NAMED_FIELDS_PLUS_EMPTY_TRAILER")
            normalized = [name.removeprefix("[").removesuffix("]")
                          for name in source_columns[:-1]]
            if (len(set(normalized)) != NAMED_FIELDS or
                    normalized[0:3] != ["MonthYear", "ItemCode", "Item_Name"] or
                    normalized[-1] != "Volume_Desc" or
                    "Main_Barcode" in normalized):
                raise IntakeError("UNEXPECTED_MONTHLY_SCHEMA")
            writer.writerow(normalized)
            for line_no, row in enumerate(reader, start=2):
                if len(row) != TRAILING_EXPECTED or row[-1] != "":
                    raise IntakeError(f"SOURCE_WIDTH_DRIFT_AT_LINE_{line_no}")
                iso = _iso(row[0])
                item_code = row[1]
                if not item_code.strip():
                    raise IntakeError(f"MISSING_ITEM_CODE_AT_LINE_{line_no}")
                identity = (iso, item_code)
                if identity in identities:
                    raise IntakeError(f"DUPLICATED_DATE_ITEM_AT_LINE_{line_no}")
                identities.add(identity)
                days[iso] += 1
                seen_items.add(item_code)
                for i, name in enumerate(normalized):
                    if name in LEGACY_TEXT_COSTS and row[i] == ",0.000":
                        anomalies[f"{name}_PREFIX_COMMA"] += 1
                try:
                    a, b, c = (Decimal(row[normalized.index(key)])
                               for key in PROFIT_FIELDS)
                    if not all(x.is_finite() for x in (a,b,c)):
                        raise InvalidOperation()
                    difference = c - (a - b)
                    if difference == 0:
                        anomalies["PROFIT_IDENTITY_EXACT"] += 1
                    elif abs(difference) <= Decimal("0.001"):
                        anomalies["PROFIT_IDENTITY_DIFF_AT_MOST_001"] += 1
                    else:
                        anomalies["PROFIT_IDENTITY_DIFF_GT_001"] += 1
                except (InvalidOperation, ValueError):
                    anomalies["PROFIT_IDENTITY_NOT_NUMERIC"] += 1
                # No financial figure, ID, item name or supplier is logged.
                writer.writerow([iso, *row[1:-1]])
                rows += 1
        manifest = {
            "schema_version": 1,
            "classification": "PRIVATE_OWNER_UPLOADED_REPORT_NOT_INDEPENDENT_UI_ATTESTATION",
            "source_kind": "OWNER_UPLOADED_UTF16_TSV",
            "source_sha256": _sha(source),
            "output_sha256": _sha(output),
            "source_file_unchanged": True,
            "reference_report_runtime_attested": False,
            "source_header_fields": len(source_columns),
            "named_columns": len(source_columns) - 1,
            "empty_trailing_header_cell": True,
            "reference_schema_missing": ["Main_Barcode"],
            "row_count": rows,
            "distinct_item_codes": len(seen_items),
            "distinct_dates": len(days),
            "date_rows": dict(sorted(days.items())),
            "anomaly_counts": dict(anomalies),
            "trustsoft_parity_accepted": False,
        }
        fd = os.open(private_manifest, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as m:
            json.dump(manifest, m, ensure_ascii=False, indent=2)
        return {
            "status": "CONVERTED_UNATTESTED",
            "rows": rows,
            "columns": NAMED_FIELDS,
            "item_count": len(seen_items),
            "date_count": len(days),
            "source_unchanged": True,
            "parity_accepted": False,
            "anomalies": dict(anomalies),
        }
    except Exception:
        if output.exists():
            output.unlink()
        raise


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--output-csv", type=Path, required=True)
    p.add_argument("--private-manifest", type=Path, required=True)
    args = p.parse_args()
    try:
        result = ingest(args.source, args.output_csv, args.private_manifest)
    except (OSError, ValueError, UnicodeError, csv.Error) as exc:
        print(json.dumps({"status": "BLOCKED", "reason": str(exc)}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
