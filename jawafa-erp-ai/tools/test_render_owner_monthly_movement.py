"""Read-only reference report viewer tests. Only synthetic records in CI."""
from __future__ import annotations

import csv
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from render_owner_monthly_movement import ScreenError, EXPECTED_FIELDS, render


def seed(folder, *, bad_field=None):
    root = Path(folder)
    src = root / "report.csv"
    with src.open("w", encoding="utf-8-sig", newline="") as out:
        writer = csv.writer(out)
        writer.writerow(
            [EXPECTED_FIELDS[0]] + [f"[{c}]" for c in EXPECTED_FIELDS[1:]] + [""]
        )
        cases = [
            ("2026 /  10 / 1", "A-001", "F-001", "S-001", "2.560", "2.043"),
            ("2026 /  10 / 2", "A-001", "F-001", "S-001", "1.000", "0.800"),
            ("2026 /  10 / 3", "A-002", "F-002", "S-002", "5.000", "4.200"),
        ]
        for day, item, family, supplier, sales, cost in cases:
            row = dict.fromkeys(EXPECTED_FIELDS, "0.000")
            row.update(
                MonthYear=day, ItemCode=item,
                Item_Name="<img src=x onerror=alert(1)>",
                Family_Code=family, Supplier_Code=supplier,
                Net_Sales_Before_Tax=sales, Net_Sales_After_Tax=sales,
                Net_Sales_Cost=cost,
                Net_Profit=str(Decimal(sales) - Decimal(cost)),
                Sales_Qty="1.000", **{"Cost_Damage": ",0.000"},
            )
            if bad_field and item == "A-002":
                row[bad_field] = "NaN"
            writer.writerow([row[k] for k in EXPECTED_FIELDS] + [""])
    return src, hashlib.sha256(src.read_bytes()).hexdigest(), root / "private.html"


def settings(sha):
    return {
        "expected_sha256": sha, "tenant": "OWNER-TEST", "branch": "BR-TEST",
        "capture_ref": "APPROVED-TEST", "start": "2026-10-01",
        "end": "2026-10-31", "private_output_attested": True,
    }


class OfflineReferenceScreenTests(unittest.TestCase):
    def test_totals_detail_and_html_escaping(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            result = render(src, output, **settings(sha))
            self.assertEqual((result["source_rows"], result["selected_rows"]), (3, 3))
            self.assertFalse(result["production_accepted"])
            self.assertIsNone(result["trustsoft_parity_percent"])
            page = output.read_text(encoding="utf-8")
            self.assertIn("8.560", page)
            self.assertIn("Cost_Damage", page)
            self.assertIn(",0.000", page)
            self.assertIn("&lt;img src=x onerror=alert(1)&gt;", page)
            self.assertNotIn("<img src=x", page)
            self.assertNotIn("<script", page)
            self.assertNotIn("https://", page)
            self.assertNotIn("8.560", json.dumps(result))

    def test_date_item_supplier_family_filter(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            options = settings(sha)
            options.update(
                start="2026-10-02", end="2026-10-02", item="A-001",
                supplier="S-001", family="F-001",
            )
            result = render(src, output, **options)
            self.assertEqual(result["selected_rows"], 1)
            self.assertEqual(result["visible_rows"], 1)
            self.assertNotIn("5.000", output.read_text())

    def test_zero_rows(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            result = render(src, output, **settings(sha), item="MISSING")
            self.assertEqual(result["selected_rows"], 0)
            self.assertIn("لا توجد نتائج", output.read_text())

    def test_page_limit_does_not_reduce_totals(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            result = render(src, output, **settings(sha), max_visible=1)
            self.assertEqual(result["selected_rows"], 3)
            self.assertEqual(result["visible_rows"], 1)
            self.assertIn("8.560", output.read_text())

    def test_requires_operator_private_attestation(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            options = settings(sha)
            options["private_output_attested"] = False
            with self.assertRaisesRegex(ScreenError, "PRIVATE_OUTPUT_ATTESTATION"):
                render(src, output, **options)
            self.assertFalse(output.exists())

    def test_source_hash_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            with self.assertRaisesRegex(ScreenError, "SOURCE_SHA256_MISMATCH"):
                render(src, output, **settings("0" * 64))

    def test_output_never_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            render(src, output, **settings(sha))
            old = output.read_bytes()
            with self.assertRaisesRegex(ScreenError, "REFUSE_REPLACE_EVIDENCE"):
                render(src, output, **settings(sha))
            self.assertEqual(old, output.read_bytes())

    def test_bad_dates_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            options = settings(sha)
            options["start"] = "2026-14-01"
            with self.assertRaisesRegex(ScreenError, "INVALID_FILTER_DATE"):
                render(src, output, **options)
            options["start"] = "2026-11-01"
            with self.assertRaisesRegex(ScreenError, "REVERSED_DATE_RANGE"):
                render(src, output, **options)

    def test_numeric_corruption_blocks_without_output(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder, bad_field="Net_Profit")
            with self.assertRaisesRegex(ScreenError, "INVALID_SELECTED_NUMERIC_FIELD"):
                render(src, output, **settings(sha))
            self.assertFalse(output.exists())

    def test_unselected_bad_number_preserves_other_group(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder, bad_field="Net_Profit")
            result = render(src, output, **settings(sha), item="A-001")
            self.assertEqual(result["selected_rows"], 2)

    def test_schema_drift_denied(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            text = src.read_text(encoding="utf-8-sig")
            src.write_text(text.replace("[ItemCode]", "[UnknownCode]"),
                           encoding="utf-8-sig")
            digest = hashlib.sha256(src.read_bytes()).hexdigest()
            with self.assertRaisesRegex(ScreenError, "UNKNOWN_OWNER_REPORT_CSV_SCHEMA"):
                render(src, output, **settings(digest))

    def test_scope_parameter_injection_denied(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            options = settings(sha)
            options["tenant"] = "<external>"
            with self.assertRaisesRegex(ScreenError, "INVALID_TENANT"):
                render(src, output, **options)

    def test_cli_returns_metadata_without_values(self):
        with tempfile.TemporaryDirectory() as folder:
            src, sha, output = seed(folder)
            script = Path(__file__).with_name("render_owner_monthly_movement.py")
            p = subprocess.run(
                [
                    sys.executable, str(script), "--source-csv", str(src),
                    "--expected-source-sha256", sha, "--output-html", str(output),
                    "--tenant", "OWNER-TEST", "--branch", "BR-TEST",
                    "--capture-ref", "APPROVED-TEST", "--from-date", "2026-10-01",
                    "--to-date", "2026-10-31", "--attest-private-output",
                ], capture_output=True, text=True,
            )
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            self.assertNotIn("8.560", p.stdout)
            self.assertEqual(json.loads(p.stdout)["selected_rows"], 3)


if __name__ == "__main__":
    unittest.main()
