#!/usr/bin/env python3
"""Read only source screen/action catalog audit for the independent ERP.

Reads ONLY approved TrustSoft screen/functional UI metadata CSVs from a
PRIVATE authorized export, not financial data or user-role assignments.
Private evidence contains screen labels and IDs and must not enter GitHub.
Source joins are CANDIDATES, not proven SQL foreign keys or runtime rights.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

TABLES = {
    "screens": ("dbo.User_Screen_Settings_Name.csv",
                ("Screen_No", "ScreenNameA", "ScreenNameE")),
    "functions": ("dbo.MPOSFunction.csv",
                  ("FunctionNo", "FunctionName", "FunctionNameA")),
    "locations": ("dbo.MPOSFunction_Location.csv",
                  ("Funct_Id", "List_No", "Button_Name", "Location")),
    "keys": ("dbo.MPOSKeyFunction.csv",
             ("FunctionId", "Function", "FunctionArb")),
}
CANDIDATE_SCREEN = re.compile(
    r"(?i)report|print|summary|inventory|sale|purchase|stock|account|journal|cheq"
)


class UiCatalogError(ValueError):
    pass


def _read_csv(data_dir: Path, name: str, required: tuple[str, ...]):
    path = data_dir / name
    try:
        binary = path.read_bytes()
        text = binary.decode("utf-8-sig")
        reader = csv.DictReader(text.splitlines())
        if reader.fieldnames is None or not set(required).issubset(reader.fieldnames):
            raise UiCatalogError("INVALID_UI_METADATA_HEADERS")
        rows = list(reader)
        if any(None in row for row in rows):
            raise UiCatalogError("INVALID_UI_METADATA_ROW")
        return rows, hashlib.sha256(binary).hexdigest()
    except (UnicodeError, OSError, csv.Error) as exc:
        raise UiCatalogError("UI_METADATA_FILE_UNREADABLE") from exc


def _id(value, kind):
    if not isinstance(value, str) or not value.strip():
        raise UiCatalogError(f"MISSING_{kind}_ID")
    return value.strip()


def _unique_by(rows, field, name):
    result = {}
    for row in rows:
        key = _id(row.get(field), name)
        if key in result:
            raise UiCatalogError(f"DUPLICATE_{name}_ID")
        result[key] = row
    return result


def audit(data_dir: Path):
    tables = {}
    hashes = {}
    for key, (name, columns) in TABLES.items():
        rows, digest = _read_csv(data_dir, name, columns)
        tables[key] = rows
        hashes[key] = digest
    screens = _unique_by(tables["screens"], "Screen_No", "SCREEN")
    functions = _unique_by(tables["functions"], "FunctionNo", "FUNCTION")
    linked_locations = []
    reserved = []
    unresolved = []
    for location in tables["locations"]:
        ident = _id(location.get("Funct_Id"), "POS_LOCATION_FUNCTION")
        if ident in functions:
            linked_locations.append(location)
        elif ident == "0":
            reserved.append(location)
        else:
            unresolved.append(location)
    linked_keys = []
    missing_keys = []
    for key in tables["keys"]:
        ident = _id(key.get("FunctionId"), "POS_KEY_FUNCTION")
        (linked_keys if ident in functions else missing_keys).append(key)
    labels = {row["ScreenNameE"].strip()
              for row in tables["screens"] if row["ScreenNameE"].strip()}
    candidate_labels = [x for x in labels if CANDIDATE_SCREEN.search(x)]
    summary = {
        "evidence_class": "SOURCE_UI_METADATA_CANDIDATES_ONLY",
        "screen_ids": len(screens),
        "distinct_english_screen_labels": len(labels),
        "broad_report_or_business_named_screen_candidates": len(candidate_labels),
        "pos_defined_function_ids": len(functions),
        "pos_location_rows": len(tables["locations"]),
        "pos_location_rows_linked_by_identical_id": len(linked_locations),
        "pos_location_unique_linked_functions": len({
            row["Funct_Id"].strip() for row in linked_locations
        }),
        "pos_reserved_zero_location_rows": len(reserved),
        "pos_unresolved_nonzero_location_rows": len(unresolved),
        "pos_key_function_rows": len(tables["keys"]),
        "pos_key_function_rows_linked": len(linked_keys),
        "pos_missing_key_functions": len(missing_keys),
        "verified_ui_actions": None,
        "verified_report_screen_to_rpt_mappings": None,
        "functional_parity_percent": None,
        "no_original_files_modified": True,
        "notes": "Names/keys only; string matches do not prove runtime behavior.",
    }
    private = {
        "source_tables_sha256": hashes,
        "summary": summary,
        "screens": [
            {
                "screen_id": key,
                "arabic_label": row["ScreenNameA"],
                "english_label": row["ScreenNameE"],
                "state": "DISCOVERED_SCREEN_ID_ONLY",
            }
            for key, row in sorted(screens.items())
        ],
        "pos_functions": [
            {
                "function_id": key,
                "english_label": row["FunctionName"],
                "arabic_label": row["FunctionNameA"],
                "state": "DISCOVERED_FUNCTION_ID_ONLY",
            }
            for key, row in sorted(functions.items())
        ],
        "pos_screen_locations": [
            {"function_id": row["Funct_Id"], "list_id": row["List_No"],
             "button_name": row["Button_Name"], "location": row["Location"],
             "mapping_state": (
                 "ID_PRESENT_IN_MPOSFUNCTION" if row in linked_locations
                 else "RESERVED_ZERO" if row in reserved else "UNRESOLVED"
             )}
            for row in tables["locations"]
        ],
    }
    return summary, private


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--private-export-dir", required=True, type=Path)
    parser.add_argument("--private-output", type=Path)
    args = parser.parse_args()
    try:
        summary, private = audit(args.private_export_dir)
        if args.private_output:
            if args.private_output.exists():
                raise UiCatalogError("REFUSE_OVERWRITE_PRIVATE_EVIDENCE")
            args.private_output.parent.mkdir(parents=True, exist_ok=True)
            args.private_output.write_text(
                json.dumps(private, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        print(json.dumps(summary, sort_keys=True))
        return 0
    except (OSError, ValueError) as exc:
        print(json.dumps({"result": "UI_AUDIT_BLOCKED", "error": str(exc)}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
