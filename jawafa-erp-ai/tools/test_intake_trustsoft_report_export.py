"""Synthetic-only test suite for approved TrustSoft monthly UI export intake."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from intake_trustsoft_report_export import CaptureError, capture

CSV = b"ItemCode,MonthYear,Sales_Qty,Net_Sales_After_Tax\nITEM-A,2026-10,1,999999\n"


def options(root):
    approved = root / "approved"
    approved.mkdir()
    src = approved / "monthly.csv"
    src.write_bytes(CSV)
    return {
        "approved_dir": approved,
        "source": src,
        "output": root / "evidence" / "capture.json",
        "screen_id": "135",
        "reference_build": "TEST-ONLY",
        "operator_capture_ref": "TEST-CAPTURE-001",
        "tenant_scope": "TENANT-TEST",
        "branch_scope": "BR-TEST",
        "filters": {"from": "2026-10-01", "to": "2026-10-31"},
        "ui_export_confirmed": True,
    }


class CaptureTests(unittest.TestCase):
    def test_valid_reference_header_and_hash_without_leaking_data(self):
        with tempfile.TemporaryDirectory() as folder:
            setup = options(Path(folder))
            result = capture(**setup)
            self.assertEqual(result["column_count"], 4)
            self.assertFalse(result["trustsoft_parity_accepted"])
            self.assertFalse(result["source_file_modified"])
            manifest = json.loads(setup["output"].read_text())
            self.assertEqual(manifest["reference_screen_id"], "135")
            self.assertEqual(manifest["csv_columns"][0], "ItemCode")
            self.assertFalse(manifest["reference_ui_output_verified"])
            self.assertIsNone(manifest["independent_capture_review_ref"])
            self.assertNotIn("999999", json.dumps(manifest))
            self.assertEqual(setup["source"].read_bytes(), CSV)

    def test_no_ui_attestation_no_capture(self):
        with tempfile.TemporaryDirectory() as folder:
            setup = options(Path(folder))
            setup["ui_export_confirmed"] = False
            with self.assertRaisesRegex(CaptureError, "UI_EXPORT_NOT_CONFIRMED"):
                capture(**setup)
            self.assertFalse(setup["output"].exists())

    def test_wrong_screen_and_missing_filters_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            setup = options(Path(folder))
            setup["screen_id"] = "999"
            with self.assertRaisesRegex(CaptureError, "UNKNOWN_TRUSTSOFT_SCREEN"):
                capture(**setup)
            setup["screen_id"] = "136"
            setup["filters"] = {}
            with self.assertRaisesRegex(CaptureError, "MISSING_EXACT_UI_FILTERS"):
                capture(**setup)

    def test_outside_approved_folder_and_symlink_escape_denied(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            setup = options(root)
            outside = root / "outside.csv"
            outside.write_bytes(CSV)
            setup["source"] = outside
            with self.assertRaisesRegex(CaptureError, "SOURCE_OUTSIDE_APPROVED"):
                capture(**setup)
            pointer = setup["approved_dir"] / "point.csv"
            pointer.symlink_to(outside)
            setup["source"] = pointer
            with self.assertRaisesRegex(CaptureError, "SOURCE_OUTSIDE_APPROVED"):
                capture(**setup)

    def test_manifest_never_overwrites_original_data_or_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            setup = options(Path(folder))
            setup["output"] = setup["source"]
            with self.assertRaisesRegex(CaptureError, "CANNOT_WRITE_INSIDE_REFERENCE_EXPORT"):
                capture(**setup)
            setup["output"] = setup["approved_dir"] / "wrong.json"
            with self.assertRaisesRegex(CaptureError, "CANNOT_WRITE_INSIDE_REFERENCE_EXPORT"):
                capture(**setup)
            setup["output"] = Path(folder) / "private" / "capture.json"
            capture(**setup)
            first = setup["output"].read_bytes()
            with self.assertRaisesRegex(CaptureError, "REFUSE_OVERWRITE"):
                capture(**setup)
            self.assertEqual(setup["output"].read_bytes(), first)
            self.assertEqual(setup["source"].read_bytes(), CSV)

    def test_duplicate_headers_blocked(self):
        with tempfile.TemporaryDirectory() as folder:
            setup = options(Path(folder))
            setup["source"].write_bytes(b"ItemCode,ItemCode\nA,B\n")
            with self.assertRaisesRegex(CaptureError, "DUPLICATE_CSV_COLUMNS"):
                capture(**setup)

    def test_non_utf8_and_non_csv_sources_denied(self):
        with tempfile.TemporaryDirectory() as folder:
            setup = options(Path(folder))
            setup["source"].write_bytes(b"\xff\xfeBAD\n")
            with self.assertRaisesRegex(CaptureError, "INVALID_UTF8_CSV_HEADER"):
                capture(**setup)
            doc = setup["approved_dir"] / "fiscal.pdf"
            doc.write_bytes(b"%PDF-1.7")
            setup["source"] = doc
            with self.assertRaisesRegex(CaptureError, "UI_CSV_EXPORT_REQUIRED"):
                capture(**setup)

    def test_cli_never_prints_sensitive_rows_and_requires_ui_flag(self):
        with tempfile.TemporaryDirectory() as folder:
            setup = options(Path(folder))
            filters_path = Path(folder) / "filters.json"
            filters_path.write_text(json.dumps(setup["filters"]), encoding="utf-8")
            script = Path(__file__).with_name("intake_trustsoft_report_export.py")
            cmd = [
                sys.executable, str(script),
                "--approved-export-dir", str(setup["approved_dir"]),
                "--source-csv", str(setup["source"]),
                "--private-manifest", str(setup["output"]),
                "--screen-id", "136",
                "--reference-build", "TEST-ONLY",
                "--operator-capture-ref", "TEST-CAPTURE-001",
                "--tenant-scope", "TENANT-TEST",
                "--branch-scope", "BR-TEST",
                "--filters-json", str(filters_path),
            ]
            blocked = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(blocked.returncode, 2)
            self.assertFalse(setup["output"].exists())
            accepted = subprocess.run(
                [*cmd, "--confirm-ui-export"], capture_output=True, text=True
            )
            self.assertEqual(accepted.returncode, 0, accepted.stderr)
            self.assertNotIn("999999", accepted.stdout)
            self.assertFalse(json.loads(accepted.stdout)["trustsoft_parity_accepted"])


if __name__ == "__main__":
    unittest.main()
