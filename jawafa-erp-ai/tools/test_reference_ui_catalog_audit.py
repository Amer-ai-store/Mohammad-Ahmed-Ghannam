"""Safe, synthetic tests for TrustSoft UI metadata-only candidate inventory."""
from __future__ import annotations

import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from reference_ui_catalog_audit import UiCatalogError, audit


def build_source(folder: Path):
    tables = {
        "dbo.User_Screen_Settings_Name.csv": (
            ["Screen_No", "ScreenNameA", "ScreenNameE"],
            [["1", "شاشة محاسبة", "Account Statements"],
             ["2", "تقارير", "Sales Report"],
             ["3", "مستودعات", "Inventory"]]),
        "dbo.MPOSFunction.csv": (
            ["FunctionNo", "FunctionName", "FunctionNameA"],
            [["10", "Print receipt", "طباعة"],
             ["20", "Return", "مردود"]]),
        "dbo.MPOSFunction_Location.csv": (
            ["Funct_Id", "List_No", "Button_Name", "Location"],
            [["10", "1", "PRINT", "1"],
             ["0", "1", "RESERVED", "2"],
             ["99", "1", "UNRESOLVED", "3"]]),
        "dbo.MPOSKeyFunction.csv": (
            ["FunctionId", "Function", "FunctionArb"],
            [["20", "RETURN", "مردود"]]),
    }
    for name, (headers, rows) in tables.items():
        with (folder / name).open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(headers)
            writer.writerows(rows)


class UiCatalogTests(unittest.TestCase):
    def test_screen_and_pos_join_candidates_are_not_accepted_features(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            build_source(source)
            summary, private = audit(source)
            self.assertEqual(summary["screen_ids"], 3)
            self.assertEqual(summary["distinct_english_screen_labels"], 3)
            self.assertEqual(
                summary["broad_report_or_business_named_screen_candidates"], 3,
            )
            self.assertEqual(summary["pos_defined_function_ids"], 2)
            self.assertEqual(summary["pos_location_rows"], 3)
            self.assertEqual(summary["pos_location_rows_linked_by_identical_id"], 1)
            self.assertEqual(summary["pos_reserved_zero_location_rows"], 1)
            self.assertEqual(summary["pos_unresolved_nonzero_location_rows"], 1)
            self.assertEqual(summary["pos_key_function_rows_linked"], 1)
            self.assertIsNone(summary["functional_parity_percent"])
            self.assertIsNone(summary["verified_report_screen_to_rpt_mappings"])
            self.assertTrue(summary["no_original_files_modified"])
            self.assertEqual(len(private["screens"]), 3)
            self.assertEqual(len(private["pos_functions"]), 2)
            self.assertEqual(len(private["source_tables_sha256"]), 4)

    def test_duplicate_screen_id_rejected_not_silently_collapsed(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            build_source(source)
            with (source / "dbo.User_Screen_Settings_Name.csv").open(
                "a", encoding="utf-8", newline=""
            ) as handle:
                csv.writer(handle).writerow(["1", "duplicated", "duplicate"])
            with self.assertRaisesRegex(UiCatalogError, "DUPLICATE_SCREEN"):
                audit(source)

    def test_duplicate_function_id_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            build_source(source)
            with (source / "dbo.MPOSFunction.csv").open(
                "a", encoding="utf-8", newline=""
            ) as handle:
                csv.writer(handle).writerow(["10", "other", "other"])
            with self.assertRaisesRegex(UiCatalogError, "DUPLICATE_FUNCTION"):
                audit(source)

    def test_missing_header_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            build_source(source)
            (source / "dbo.MPOSKeyFunction.csv").write_text(
                "FunctionId,Function\n20,RETURN\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(UiCatalogError, "INVALID_UI_METADATA_HEADERS"):
                audit(source)

    def test_cli_keeps_labels_private_and_refuses_existing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "source"
            source.mkdir()
            build_source(source)
            output = base / "private.json"
            script = Path(__file__).with_name("reference_ui_catalog_audit.py")
            args = [sys.executable, str(script), "--private-export-dir",
                    str(source), "--private-output", str(output)]
            first = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertNotIn("Account Statements", first.stdout)
            self.assertEqual(json.loads(first.stdout)["screen_ids"], 3)
            self.assertEqual(
                json.loads(output.read_text(encoding="utf-8"))["screens"][0]["english_label"],
                "Account Statements",
            )
            second = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(second.returncode, 2)
            self.assertIn("REFUSE_OVERWRITE_PRIVATE_EVIDENCE", second.stdout)


if __name__ == "__main__":
    unittest.main()
