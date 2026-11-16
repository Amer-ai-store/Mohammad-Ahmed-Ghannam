"""Pure, deterministic validation for private Jawafa V5 Drive exports.

No network, credentials, SQL access, or imports from Google libraries.
Input is metadata and SHA-256 values independently observed from stored files.
The v5 hybrid export is NOT a transactional SQL backup/restore guarantee.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
from collections import Counter

HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")


def parse_csv(data: bytes, fields: tuple[str, ...], label: str) -> list[dict[str, str]]:
    """Parse UTF-8 BOM/non-BOM CSV, rejecting structural corruption."""
    try:
        text = data.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
        header = reader.fieldnames or []
        if len(header) != len(set(header)) or not set(fields).issubset(header):
            raise ValueError("invalid_columns:" + label)
        result = list(reader)
        if any(None in row or any(value is None for value in row.values()) for row in result):
            raise ValueError("malformed_record:" + label)
        return result
    except (UnicodeError, csv.Error) as exc:
        raise ValueError("invalid_csv:" + label) from exc


def _unique(rows: list[dict], key, label: str, errors: list[str]) -> dict[str, dict]:
    found: dict[str, dict] = {}
    for row in rows:
        name = str(key(row)).strip()
        if not name or any(x in name for x in ("/", "\\", "\x00", "..")):
            errors.append("invalid_name:" + label)
            continue
        if name in found:
            errors.append("duplicate:" + label + ":" + name)
        else:
            found[name] = row
    return found


def _nonnegative_int(value: object) -> bool:
    try:
        return str(int(str(value))) == str(value).strip() and int(str(value)) >= 0
    except (ValueError, TypeError):
        return False


def validate_v5(
    inventory: list[dict[str, str]],
    results: list[dict[str, str]],
    manifest: list[dict[str, str]],
    drive_files: list[dict[str, str]],
    *,
    expected_tables: int = 1024,
    expected_full: int = 1009,
    expected_delta: int = 14,
    reference: str = "dbo.ItemSalesSummary",
) -> dict:
    """Fail closed on omissions, swapped files, incorrect modes, sizes or hashes.

    drive_files: actual direct children of the private run's data folder,
    with keys name, size, sha256 (hash independently computed from bytes).
    """
    errors: list[str] = []
    inv = _unique(inventory, lambda x: x.get("schema", "") + "." + x.get("table", ""), "inventory", errors)
    res = _unique(results, lambda x: x.get("table", ""), "results", errors)
    man = _unique(manifest, lambda x: x.get("file", ""), "manifest", errors)
    files = _unique(drive_files, lambda x: x.get("name", ""), "data_folder", errors)

    for label, observed, expected in (
        ("inventory", len(inventory), expected_tables),
        ("results", len(results), expected_tables),
        ("manifest", len(manifest), expected_full + expected_delta),
        ("data_files", len(drive_files), expected_full + expected_delta),
    ):
        if observed != expected:
            errors.append(f"incorrect_count:{label}:{observed}:expected={expected}")
    if set(inv) != set(res):
        errors.append("inventory_results_set_mismatch")
    for row in inventory:
        if not _nonnegative_int(row.get("rows")) or not _nonnegative_int(row.get("cols")):
            errors.append("invalid_inventory_counts")
            break
    mode_counts = Counter(row.get("mode") for row in results if row.get("status") == "OK")
    if mode_counts.get("FULL") != expected_full or mode_counts.get("DELTA") != expected_delta:
        errors.append("incorrect_v5_modes")

    valid_results: set[str] = set()
    refs = 0
    for name, row in res.items():
        mode, status = row.get("mode"), row.get("status")
        if name == reference:
            refs += 1
            if mode != "BASELINE_REFERENCE" or status != "REFERENCE_ONLY_NOT_EXPORTED":
                errors.append("invalid_reference_status")
        elif mode not in {"FULL", "DELTA"} or status != "OK":
            errors.append("invalid_export_status:" + name)
        else:
            valid_results.add(name + ".csv")
        if not _nonnegative_int(row.get("rows")):
            errors.append("invalid_result_rows:" + name)
    if refs != 1 or reference not in inv:
        errors.append("missing_reference")

    expected_files = {name + ".csv" for name in inv if name != reference}
    if expected_files != valid_results:
        errors.append("invalid_results_file_set")
    if set(man) != expected_files:
        errors.append("manifest_file_set_mismatch")
    if set(files) != expected_files:
        errors.append("drive_file_set_mismatch")
    if set(files) != set(man):
        errors.append("manifest_drive_set_mismatch")

    for name, row in man.items():
        if not _nonnegative_int(row.get("bytes")) or not HEX64.fullmatch(row.get("sha256") or ""):
            errors.append("invalid_manifest_entry:" + name)
    for name, item in files.items():
        stored = man.get(name)
        if not stored:
            continue
        if not _nonnegative_int(item.get("size")) or item.get("size") != stored.get("bytes"):
            errors.append("size_mismatch:" + name)
        digest = item.get("sha256") or ""
        if not HEX64.fullmatch(digest) or digest.lower() != (stored.get("sha256") or "").lower():
            errors.append("sha256_mismatch:" + name)

    return {
        "schema": "jawafa_v5_private_drive_verification_v2",
        "classification": "PRIVATE_HYBRID_EXPORT_NOT_SQL_RESTORE_PROOF",
        "inventory_count": len(inventory),
        "results_count": len(results),
        "manifest_count": len(manifest),
        "drive_csv_count": len(drive_files),
        "full_count": mode_counts.get("FULL", 0),
        "delta_count": mode_counts.get("DELTA", 0),
        "reference_count": refs,
        "sha256_files_checked": sum(1 for f in files.values() if HEX64.fullmatch(f.get("sha256") or "")),
        "issues": sorted(set(errors)),
        "verified": not errors,
        "sql_restore_tested": False,
        "financial_snapshot_consistent": False,
    }


def sha256_bytes(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()
