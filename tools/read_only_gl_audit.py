#!/usr/bin/env python3
"""Offline, read-only consistency check of exported GL journal legs.

This checks mathematical consistency only, NOT legal posting, bank settlement,
or account correctness. No journal identifiers or monetary totals are emitted.
"""
import argparse
import csv
import json
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

def records(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f)

def money(v):
    try:
        return Decimal((v or "").strip())
    except (InvalidOperation, AttributeError):
        return None

def analyze(root, tolerance=Decimal("0.01")):
    data = root / "data"
    inputs = [data / name for name in ("dbo.Journal_GL.csv", "dbo.From_gl.csv", "dbo.To_GL.csv")]
    if any(not p.is_file() or p.is_symlink() for p in inputs):
        raise FileNotFoundError("Missing expected GL export")
    headers = set()
    header_info = {}
    lines = Counter()
    totals = defaultdict(lambda: [Decimal(0), Decimal(0)])
    invalid_amounts = Counter()
    for row in records(inputs[0]):
        headers.add(row["JournalNo"].strip())
        header_info[row["JournalNo"].strip()] = (row.get("JournalType") or "UNKNOWN", (row.get("JournalDate") or "")[:4], money(row.get("Total")) )
    for side, path in enumerate(inputs[1:]):
        for row in records(path):
            key = row["JournalNo"].strip()
            lines[("from", "to")[side]] += 1
            amount = money(row.get("amount") if side == 0 else row.get("Amount"))
            if amount is None:
                invalid_amounts[("from", "to")[side]] += 1
            else:
                totals[key][side] += amount
    missing_header = sum(k not in headers for k in totals)
    unbalanced = 0
    zero_one_side = 0
    exceptions_by_type = Counter()
    exceptions_by_year = Counter()
    exception_direction = Counter()
    exception_header_matches = Counter()
    for key, (debit, credit) in totals.items():
        if debit == 0 or credit == 0:
            zero_one_side += 1
        if abs(debit - credit) > tolerance:
            unbalanced += 1
            category, year, declared_total = header_info.get(key, ("UNKNOWN", "UNKNOWN", None))
            exceptions_by_type[category] += 1
            exceptions_by_year[year or "UNKNOWN"] += 1
            exception_direction["from_more" if debit > credit else "to_more"] += 1
            if declared_total is None:
                exception_header_matches["no_declared_total"] += 1
            elif abs(debit - declared_total) <= tolerance and abs(credit - declared_total) <= tolerance:
                exception_header_matches["both"] += 1
            elif abs(debit - declared_total) <= tolerance:
                exception_header_matches["from_only"] += 1
            elif abs(credit - declared_total) <= tolerance:
                exception_header_matches["to_only"] += 1
            else:
                exception_header_matches["neither"] += 1
    return {
        "classification": "OFFLINE_ARITHMETIC_SCREENING_ONLY",
        "journal_headers": len(headers),
        "line_counts": dict(lines),
        "journal_numbers_with_lines": len(totals),
        "journal_numbers_without_header": missing_header,
        "headers_without_any_lines": len(headers - totals.keys()),
        "journal_numbers_with_one_zero_side": zero_one_side,
        "journal_numbers_with_unequal_leg_totals": unbalanced,
        "invalid_amount_cells": dict(invalid_amounts),
        "exceptions_by_journal_type": dict(sorted(exceptions_by_type.items())),
        "exceptions_by_year": dict(sorted(exceptions_by_year.items())),
        "exception_direction": dict(sorted(exception_direction.items())),
        "exception_header_total_matches": dict(sorted(exception_header_matches.items())),
        "tolerance": str(tolerance),
        "limitations": [
            "A zero or unequal amount may reflect entry types or GL conventions; inspect original voucher before claiming misposting.",
            "This arithmetic does not verify financial statements, rights, or bank balances.",
            "Only snapshot CSV, not the live SQL schema or application, was analyzed.",
        ],
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export_directory", type=Path)
    args = parser.parse_args()
    print(json.dumps(analyze(args.export_directory.resolve()), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
