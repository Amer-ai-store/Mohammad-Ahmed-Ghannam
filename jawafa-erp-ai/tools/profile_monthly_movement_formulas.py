#!/usr/bin/env python3
"""Private and read-only candidate formula evidence from TrustSoft table export.

Reads an authorized archived source CSV as-is, never modifies it and never
prints source row values/identifiers. Aggregate consistency is NOT a verified
TrustSoft business formula, UI report, tax policy or ERP functional parity.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import Counter
from decimal import Decimal, InvalidOperation, localcontext
from pathlib import Path

REQUIRED = (
    "MonthYear", "ItemCode",
    "Net_Sales_Before_Tax", "Net_Sales_After_Tax",
    "Net_Purchase_Before_Tax", "Net_Purchase_After_Tax",
    "Sales_Cost", "Net_Sales_Cost", "Net_Profit",
    "Net_Profit_Margin_Per", "Net_Profit_Markup_Per",
)
ZERO = Decimal(0)
EPS_AMOUNT = Decimal("0.015")
EPS_PERCENT = Decimal("0.05")
ONE_SIXTEEN = Decimal("1.16")


class FormulaProfileError(ValueError):
    pass


def parse_amount(value: str) -> Decimal | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if "," in value or " " in value or len(value) > 96:
        return None
    try:
        parsed = Decimal(value)
    except InvalidOperation:
        return None
    if not parsed.is_finite():
        return None
    return parsed


def candidate_specs():
    return (
        ("profit = net sales before tax - net sales cost",
         ("Net_Profit", "Net_Sales_Before_Tax", "Net_Sales_Cost"),
         lambda profit, sales, cost: (profit, sales - cost), EPS_AMOUNT),
        ("profit = net sales after tax - net sales cost",
         ("Net_Profit", "Net_Sales_After_Tax", "Net_Sales_Cost"),
         lambda profit, sales, cost: (profit, sales - cost), EPS_AMOUNT),
        ("profit = net sales before tax - sales cost",
         ("Net_Profit", "Net_Sales_Before_Tax", "Sales_Cost"),
         lambda profit, sales, cost: (profit, sales - cost), EPS_AMOUNT),
        ("profit = net sales after tax - sales cost",
         ("Net_Profit", "Net_Sales_After_Tax", "Sales_Cost"),
         lambda profit, sales, cost: (profit, sales - cost), EPS_AMOUNT),
        ("profit margin % = net profit / net sales before tax * 100",
         ("Net_Profit_Margin_Per", "Net_Profit", "Net_Sales_Before_Tax"),
         lambda percentage, profit, sales: (percentage, profit * 100 / sales), EPS_PERCENT),
        ("profit margin % = net profit / net sales after tax * 100",
         ("Net_Profit_Margin_Per", "Net_Profit", "Net_Sales_After_Tax"),
         lambda percentage, profit, sales: (percentage, profit * 100 / sales), EPS_PERCENT),
        ("profit markup % = net profit / net sales cost * 100",
         ("Net_Profit_Markup_Per", "Net_Profit", "Net_Sales_Cost"),
         lambda percentage, profit, cost: (percentage, profit * 100 / cost), EPS_PERCENT),
        ("profit markup % = net profit / sales cost * 100",
         ("Net_Profit_Markup_Per", "Net_Profit", "Sales_Cost"),
         lambda percentage, profit, cost: (percentage, profit * 100 / cost), EPS_PERCENT),
        ("sales cost = net sales cost",
         ("Sales_Cost", "Net_Sales_Cost"),
         lambda cost, net_cost: (cost, net_cost), EPS_AMOUNT),
        ("sales before tax = after tax * 1.16",
         ("Net_Sales_Before_Tax", "Net_Sales_After_Tax"),
         lambda before, after: (before, after * ONE_SIXTEEN), EPS_AMOUNT),
        ("purchases before tax = after tax * 1.16",
         ("Net_Purchase_Before_Tax", "Net_Purchase_After_Tax"),
         lambda before, after: (before, after * ONE_SIXTEEN), EPS_AMOUNT),
        ("sales after tax = before tax * 1.16",
         ("Net_Sales_After_Tax", "Net_Sales_Before_Tax"),
         lambda after, before: (after, before * ONE_SIXTEEN), EPS_AMOUNT),
        ("purchases after tax = before tax * 1.16",
         ("Net_Purchase_After_Tax", "Net_Purchase_Before_Tax"),
         lambda after, before: (after, before * ONE_SIXTEEN), EPS_AMOUNT),
    )


def profile_rows(fieldnames: list[str], rows: list[dict[str, str]]) -> dict:
    if len(fieldnames) != 44 or len(set(fieldnames)) != 44 or any(
        field not in fieldnames for field in REQUIRED
    ):
        raise FormulaProfileError("INVALID_SOURCE_COLUMN_CONTRACT")
    if not rows:
        raise FormulaProfileError("EMPTY_EXPORT")
    for row in rows:
        if None in row or any(value is None for value in row.values()):
            raise FormulaProfileError("MALFORMED_CSV_ROW")
    grain = Counter((r["MonthYear"].strip(), r["ItemCode"].strip()) for r in rows)
    duplicates = sum(v - 1 for v in grain.values() if v > 1)

    numeric_columns = tuple(sorted({
        field for _name, fields, _fn, _tolerance in candidate_specs()
        for field in fields
    }))
    invalid_counts = Counter()
    parsed_rows = []
    for row in rows:
        parsed = {}
        for field in numeric_columns:
            value = parse_amount(row[field])
            if value is None:
                invalid_counts[field] += 1
            parsed[field] = value
        parsed_rows.append(parsed)

    results = []
    for name, fields, evaluate, tolerance in candidate_specs():
        eligible = tested = matches = excludes = 0
        for parsed in parsed_rows:
            nums = [parsed[field] for field in fields]
            if any(v is None for v in nums):
                continue
            eligible += 1
            if all(v == ZERO for v in nums):
                excludes += 1
                continue
            # Percent denominator must be nonzero and percentage numerators
            # without a nonzero true amount are ambiguous.
            if " / " in name and nums[-1] == ZERO:
                excludes += 1
                continue
            tested += 1
            try:
                with localcontext() as ctx:
                    ctx.prec = 38
                    actual, expected = evaluate(*nums)
            except (ZeroDivisionError, InvalidOperation, OverflowError):
                excludes += 1
                tested -= 1
                continue
            if abs(actual - expected) <= tolerance:
                matches += 1
        contradicted = tested - matches
        results.append({
            "hypothesis": name,
            "eligible_numeric_rows": eligible,
            "excluded_trivial_or_undefined_rows": excludes,
            "tested_nontrivial_rows": tested,
            "matching_rows_within_stated_tolerance": matches,
            "contradicting_rows": contradicted,
            "tolerance": str(tolerance),
            "match_rate_percent": round(100 * matches / tested, 2) if tested else None,
            "classification": (
                "UNTESTABLE_IN_SNAPSHOT" if not tested else
                "CONSISTENT_IN_SNAPSHOT_ONLY" if contradicted == 0 and tested >= 5 else
                "CONTRADICTED_IN_SNAPSHOT" if contradicted > 0 else
                "INSUFFICIENT_NONTRIVIAL_ROWS"
            ),
        })
    return {
        "reference": "TrustSoft archived source table export; NOT approved UI report",
        "data_sensitivity": "SOURCE_VALUES_PRIVATE_AGGREGATES_ONLY",
        "source_row_count": len(rows),
        "source_column_count": len(fieldnames),
        "grain_candidate": "MonthYear + ItemCode ONLY, not SQL verified",
        "duplicate_month_item_key_extra_rows": duplicates,
        "numeric_parse_invalid_or_empty_counts": dict(sorted(invalid_counts.items())),
        "candidate_formulas": results,
        "verified_original_business_formulas": 0,
        "report_parity_accepted": False,
        "report_parity_percent": None,
        "warning": (
            "Even perfect agreement on 97 archived rows proves only sample "
            "consistency, not original algorithm, legal VAT basis, all periods "
            "or a TrustSoft UI report comparison."
        ),
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--archived-source-csv", type=Path, required=True)
    p.add_argument("--expected-source-sha256", required=True)
    p.add_argument("--expected-header-sha256", required=True)
    args = p.parse_args()
    try:
        if len(args.expected_source_sha256) != 64 or len(args.expected_header_sha256) != 64:
            raise FormulaProfileError("EXPECTED_SHA256_REQUIRED")
        data = args.archived_source_csv.read_bytes()
        if hashlib.sha256(data).hexdigest() != args.expected_source_sha256:
            raise FormulaProfileError("SOURCE_FILE_HASH_MISMATCH")
        try:
            text = data.decode("utf-8-sig")
        except UnicodeError as exc:
            raise FormulaProfileError("SOURCE_NOT_UTF8") from exc
        import io
        reader = csv.DictReader(io.StringIO(text, newline=""), strict=True)
        headers = reader.fieldnames
        if headers is None:
            raise FormulaProfileError("SOURCE_HEADERS_MISSING")
        if hashlib.sha256("\n".join(headers).encode("utf-8")).hexdigest() != args.expected_header_sha256:
            raise FormulaProfileError("SOURCE_HEADER_HASH_MISMATCH")
        result = profile_rows(headers, list(reader))
    except (OSError, ValueError, csv.Error) as exc:
        print(json.dumps({"result": "SOURCE_PROFILE_BLOCKED", "error": str(exc)}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
