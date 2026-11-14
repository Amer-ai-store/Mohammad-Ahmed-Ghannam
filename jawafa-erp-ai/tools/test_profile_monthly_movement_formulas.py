"""Synthetic-only validation for private historical formula candidate probe."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from profile_monthly_movement_formulas import FormulaProfileError, profile_rows

DOC = Path(__file__).resolve().parent.parent / "docs" / (
    "reference_monthly_movement_schema_20261110.json"
)


def fields():
    contract = json.loads(DOC.read_text(encoding="utf-8"))
    return [x["name"] for x in contract["columns"]]


def rows(count=6):
    results = []
    for i in range(count):
        row = {k: "0" for k in fields()}
        row.update({
            "MonthYear": "2026-10",
            "ItemCode": f"ITEM-{i:02d}",
            "Net_Sales_Before_Tax": "100.000",
            "Net_Sales_After_Tax": "116.000",
            "Net_Purchase_Before_Tax": "50.000",
            "Net_Purchase_After_Tax": "58.000",
            "Sales_Cost": "80",
            "Net_Sales_Cost": "70.000",
            "Net_Profit": "30.000",
            "Net_Profit_Margin_Per": "30.000",
            "Net_Profit_Markup_Per": "42.857",
        })
        results.append(row)
    return results


def csv_bytes(data):
    stream = io.StringIO(newline="")
    w = csv.DictWriter(stream, fieldnames=fields())
    w.writeheader()
    w.writerows(data)
    return stream.getvalue().encode("utf-8")


class FormulaCandidateTests(unittest.TestCase):
    def test_consistency_is_only_observed_not_claimed_as_vendor_formula(self):
        result = profile_rows(fields(), rows())
        self.assertEqual(result["source_row_count"], 6)
        self.assertEqual(result["source_column_count"], 44)
        matches = {x["hypothesis"]: x for x in result["candidate_formulas"]}
        p = matches["profit = net sales before tax - net sales cost"]
        self.assertEqual(p["tested_nontrivial_rows"], 6)
        self.assertEqual(p["matching_rows_within_stated_tolerance"], 6)
        self.assertEqual(p["classification"], "CONSISTENT_IN_SNAPSHOT_ONLY")
        other = matches["profit = net sales after tax - net sales cost"]
        self.assertEqual(other["contradicting_rows"], 6)
        self.assertFalse(result["report_parity_accepted"])
        self.assertIsNone(result["report_parity_percent"])
        self.assertEqual(result["verified_original_business_formulas"], 0)

    def test_grain_duplicates_are_counted_but_not_deemed_errors(self):
        example = rows(3)
        example[2]["ItemCode"] = example[1]["ItemCode"]
        result = profile_rows(fields(), example)
        self.assertEqual(result["duplicate_month_item_key_extra_rows"], 1)
        self.assertFalse(result["report_parity_accepted"])

    def test_invalid_input_amount_is_counted_not_printed(self):
        data = rows()
        data[0]["Net_Profit"] = "private-record-is-broken"
        result = profile_rows(fields(), data)
        self.assertEqual(result["numeric_parse_invalid_or_empty_counts"]["Net_Profit"], 1)
        self.assertNotIn("private-record-is-broken", json.dumps(result))

    def test_trivial_all_zero_records_do_not_prove_business_formula(self):
        example = rows()
        for row in example:
            for key in ("Net_Profit", "Net_Sales_Before_Tax", "Net_Sales_Cost"):
                row[key] = "0"
        result = profile_rows(fields(), example)
        p = next(item for item in result["candidate_formulas"]
                 if item["hypothesis"] == "profit = net sales before tax - net sales cost")
        self.assertEqual(p["tested_nontrivial_rows"], 0)
        self.assertEqual(p["classification"], "UNTESTABLE_IN_SNAPSHOT")

    def test_invalid_row_structure_rejected(self):
        invalid = rows(1)[0]
        invalid[None] = ["extra"]
        with self.assertRaisesRegex(FormulaProfileError, "MALFORMED_CSV_ROW"):
            profile_rows(fields(), [invalid])
        with self.assertRaisesRegex(FormulaProfileError, "INVALID_SOURCE_COLUMN_CONTRACT"):
            profile_rows(fields()[:-1], rows())

    def test_private_cli_never_logs_source_rows_and_checks_hash(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            p = root / "reference.csv"
            blob = csv_bytes(rows())
            p.write_bytes(blob)
            header = "\n".join(fields()).encode("utf-8")
            script = Path(__file__).with_name("profile_monthly_movement_formulas.py")
            cmd = [
                sys.executable, str(script), "--archived-source-csv", str(p),
                "--expected-source-sha256", hashlib.sha256(blob).hexdigest(),
                "--expected-header-sha256", hashlib.sha256(header).hexdigest(),
            ]
            run = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertNotIn("ITEM-01", run.stdout)
            self.assertNotIn("100.000", run.stdout)
            self.assertEqual(json.loads(run.stdout)["source_row_count"], 6)
            bad = subprocess.run(
                cmd[:-3] + ["x" * 64] + cmd[-2:],
                capture_output=True, text=True,
            )
            # malformed CLI path is blocked by argparse; no source data logged.
            self.assertNotEqual(bad.returncode, 0)
            mismatch = subprocess.run(
                [*cmd[:cmd.index("--expected-source-sha256")],
                 "--expected-source-sha256", "0" * 64,
                 "--expected-header-sha256", cmd[-1]],
                capture_output=True, text=True,
            )
            self.assertEqual(mismatch.returncode, 2)
            self.assertIn("SOURCE_FILE_HASH_MISMATCH", mismatch.stdout)


if __name__ == "__main__":
    unittest.main()
