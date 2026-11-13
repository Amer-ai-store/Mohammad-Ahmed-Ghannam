#!/usr/bin/env python3
"""Privacy-preserving, read-only owner TXT -> CSV cell-level verification.

Only validates preservation of an operator-supplied file. This is NOT a
TrustSoft UI report certification and not ERP/TrustSoft business parity.
Original source rows, prices, item codes and personal data are never emitted.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from itertools import zip_longest
from pathlib import Path

HEX64 = re.compile(r"^[0-9a-f]{64}$")
MISSING = object()


class PreservationError(ValueError):
    pass


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def _validate_digest(given: str, field: str) -> str:
    if not isinstance(given, str) or not HEX64.fullmatch(given):
        raise PreservationError("MISSING_OR_INVALID_" + field)
    return given


def verify(
    source_txt: Path, converted_csv: Path,
    *, expected_source_sha256: str, expected_converted_sha256: str,
) -> dict:
    _validate_digest(expected_source_sha256, "SOURCE_SHA256")
    _validate_digest(expected_converted_sha256, "CONVERTED_SHA256")
    if source_txt.resolve(strict=True) == converted_csv.resolve(strict=True):
        raise PreservationError("SOURCE_AND_OUTPUT_ARE_SAME_FILE")
    if source_txt.suffix.lower() != ".txt" or converted_csv.suffix.lower() != ".csv":
        raise PreservationError("EXPECTED_TXT_AND_CSV_EXTENSIONS")
    with source_txt.open("rb") as stream:
        if stream.read(2) != b"\xff\xfe":
            raise PreservationError("SOURCE_NOT_UTF16_LE_BOM")
    if digest_file(source_txt) != expected_source_sha256:
        raise PreservationError("SOURCE_SHA256_MISMATCH")
    if digest_file(converted_csv) != expected_converted_sha256:
        raise PreservationError("CONVERTED_SHA256_MISMATCH")

    diff_positions: Counter[int] = Counter()
    mismatching_rows = source_rows = output_rows = 0
    source_hdr = output_hdr = None
    with (source_txt.open("r", encoding="utf-16", newline="") as source,
          converted_csv.open("r", encoding="utf-8-sig", newline="") as converted):
        tsv = csv.reader(source, delimiter="\t", strict=True)
        values = csv.reader(converted, strict=True)
        source_hdr = next(tsv, None)
        output_hdr = next(values, None)
        if (source_hdr is None or len(source_hdr) != 44 or source_hdr[-1] != "" or
                any(not h.strip() for h in source_hdr[:-1]) or
                len(set(source_hdr[:-1])) != 43):
            raise PreservationError("UNKNOWN_SOURCE_HEADER_CONTRACT")
        if output_hdr != source_hdr:
            raise PreservationError("HEADER_WAS_CHANGED_OR_DROPPED")
        for src, dst in zip_longest(tsv, values, fillvalue=MISSING):
            if src is not MISSING:
                source_rows += 1
            if dst is not MISSING:
                output_rows += 1
            if src is MISSING or dst is MISSING:
                mismatching_rows += 1
                continue
            row_diff = False
            for i in range(44):
                left = src[i] if i < len(src) else MISSING
                right = dst[i] if i < len(dst) else MISSING
                if left != right:
                    diff_positions[i + 1] += 1
                    row_diff = True
            if len(src) != 44 or len(dst) != 44:
                row_diff = True
            mismatching_rows += int(row_diff)

    matched = mismatching_rows == 0 and source_rows == output_rows
    return {
        "result": "ALL_SOURCE_CELLS_PRESERVED" if matched else "SOURCE_CELLS_DIFFER",
        "source_kind": "OWNER_UPLOADED_TSV_TO_CSV_UNATTESTED",
        "source_sha256": expected_source_sha256,
        "converted_sha256": expected_converted_sha256,
        "source_rows": source_rows,
        "converted_rows": output_rows,
        "data_column_count": 44,
        "named_column_count": 43,
        "empty_trailing_header": True,
        "different_data_row_count": mismatching_rows,
        "different_cell_counts_by_ordinal": {
            str(index): count for index, count in sorted(diff_positions.items())
        },
        "all_cells_preserved": matched,
        "report_runtime_attested": False,
        "trustsoft_functional_parity_accepted": False,
        "trustsoft_parity_percent": None,
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source-txt", type=Path, required=True)
    p.add_argument("--converted-csv", type=Path, required=True)
    p.add_argument("--expected-source-sha256", required=True)
    p.add_argument("--expected-converted-sha256", required=True)
    args = p.parse_args()
    try:
        result = verify(
            args.source_txt, args.converted_csv,
            expected_source_sha256=args.expected_source_sha256,
            expected_converted_sha256=args.expected_converted_sha256,
        )
    except (OSError, ValueError, csv.Error, UnicodeError) as exc:
        # Deliberately never print file contents, row identities or file paths.
        print(json.dumps({"result": "SOURCE_PRESERVATION_BLOCKED", "reason": str(exc)}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0 if result["all_cells_preserved"] else 1


if __name__ == "__main__":
    sys.exit(main())
