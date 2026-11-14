"""Synthetic-only old/new TrustSoft report comparison tests; no source data."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from compare_report_exports import ReportComparisonError, compare


REF = b"item_code,quantity_milli,amount_fils,report_date\nA,1000,5300,2026-10-01\nB,2500,-1250,2026-10-02\n"
SAME = REF
DIFF = b"item_code,quantity_milli,amount_fils,report_date\nA,1000,5200,2026-10-01\nB,2500,-1250,2026-10-02\n"
OUT_OF_ORDER = b"item_code,quantity_milli,amount_fils,report_date\nB,2500,-1250,2026-10-02\nA,1000,5300,2026-10-01\n"


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def fixture(ref=REF, candidate=SAME):
    return {
        "schema_version": 1,
        "report_id": "RPT-TEST-001",
        "reference_screen_id": "SYNTHETIC-SCREEN",
        "reference_build": "SYNTHETIC",
        "capture_approval_ref": "SYNTHETIC-APPROVAL",
        "tenant_scope": "FICTIONAL-COMPANY",
        "branch_scope": "FICTIONAL-BRANCH",
        "parameters": {"from": "2026-10-01", "to": "2026-10-31"},
        "reference_sha256": digest(ref),
        "candidate_sha256": digest(candidate),
        "reference_capture_authorized": True,
        "candidate_is_read_only_export": True,
        "compare_row_order": True,
        "columns": [
            {"name": "item_code", "type": "text"},
            {"name": "quantity_milli", "type": "integer_milli"},
            {"name": "amount_fils", "type": "integer_fils"},
            {"name": "report_date", "type": "date"},
        ],
    }


class ReportComparatorTests(unittest.TestCase):
    def test_exact_source_and_candidate_do_not_mean_final_acceptance(self):
        result = compare(fixture(), REF, SAME)
        self.assertTrue(result["matched"])
        self.assertFalse(result["trustsoft_parity_accepted"])
        self.assertEqual(result["reference_rows"], 2)
        self.assertEqual(result["different_row_positions"], 0)

    def test_amount_mismatch_returns_counts_without_exposing_values(self):
        result = compare(fixture(candidate=DIFF), REF, DIFF)
        self.assertFalse(result["matched"])
        self.assertEqual(result["different_row_positions"], 1)
        self.assertEqual(result["different_cell_counts_by_column"], {"amount_fils": 1})
        self.assertNotIn("5300", json.dumps(result))
        self.assertNotIn("5200", json.dumps(result))

    def test_output_row_order_is_intentionally_checked(self):
        result = compare(fixture(candidate=OUT_OF_ORDER), REF, OUT_OF_ORDER)
        self.assertFalse(result["matched"])
        self.assertEqual(result["different_row_positions"], 2)

    def test_wrong_source_hash_fails_before_comparison(self):
        with self.assertRaisesRegex(ReportComparisonError, "REFERENCE_HASH_MISMATCH"):
            compare(fixture(), b"forged source", SAME)
        with self.assertRaisesRegex(ReportComparisonError, "CANDIDATE_HASH_MISMATCH"):
            compare(fixture(), REF, b"forged ERP")

    def test_requires_source_capture_permission_and_scope(self):
        cases = [
            ("reference_capture_authorized", False, "REFERENCE_NOT_AUTHORIZED"),
            ("candidate_is_read_only_export", False, "CANDIDATE_NOT_READ_ONLY"),
            ("branch_scope", "", "MISSING_BRANCH_SCOPE"),
            ("reference_screen_id", None, "MISSING_REFERENCE_SCREEN_ID"),
            ("parameters", {}, "MISSING_APPROVED_FILTER_PARAMETERS"),
            ("compare_row_order", False, "ROW_ORDER_MUST_BE_EXPLICITLY_COMPARED"),
        ]
        for field, value, expected in cases:
            with self.subTest(field=field):
                manifest = fixture()
                manifest[field] = value
                with self.assertRaisesRegex(ReportComparisonError, expected):
                    compare(manifest, REF, SAME)

    def test_invalid_numeric_and_extra_csv_fields_block_comparison(self):
        invalid = [
            b"item_code,quantity_milli,amount_fils,report_date\nA,1.5,10,2026-10-01\n",
            b"item_code,quantity_milli,amount_fils,report_date\nA,1,1,2026-02-30\n",
            b"item_code,quantity_milli,amount_fils,report_date\nA,1,1,2026-10-01,EXTRA\n",
        ]
        for blob in invalid:
            with self.subTest(blob=blob[:22]):
                with self.assertRaises(ReportComparisonError):
                    compare(fixture(candidate=blob), REF, blob)

    def test_header_drift_is_rejected(self):
        blob = b"item_code,amount_fils,quantity_milli,report_date\nA,5300,1000,2026-10-01\n"
        with self.assertRaisesRegex(ReportComparisonError, "COLUMN_ORDER_OR_NAMES_DIFFER"):
            compare(fixture(candidate=blob), REF, blob)

    def test_duplicate_column_spec_rejected(self):
        manifest = fixture()
        manifest["columns"].append({"name": "item_code", "type": "text"})
        with self.assertRaisesRegex(ReportComparisonError, "DUPLICATE_COLUMN_SPEC"):
            compare(manifest, REF, SAME)

    def test_cli_never_prints_row_contents_and_blocks_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            ref = root / "trusted.csv"
            erp = root / "erp.csv"
            spec = root / "manifest.json"
            ref.write_bytes(REF)
            erp.write_bytes(DIFF)
            spec.write_text(json.dumps(fixture(candidate=DIFF)), encoding="utf-8")
            tool = Path(__file__).with_name("compare_report_exports.py")
            run = subprocess.run(
                [sys.executable, str(tool), "--manifest", str(spec),
                 "--reference-csv", str(ref), "--candidate-csv", str(erp)],
                capture_output=True, text=True,
            )
            self.assertEqual(run.returncode, 1)
            self.assertNotIn("A,1000", run.stdout)
            self.assertFalse(json.loads(run.stdout)["matched"])
            erp.write_bytes(REF)
            spec.write_text(json.dumps(fixture()), encoding="utf-8")
            ok = subprocess.run(
                [sys.executable, str(tool), "--manifest", str(spec),
                 "--reference-csv", str(ref), "--candidate-csv", str(erp)],
                capture_output=True, text=True,
            )
            self.assertEqual(ok.returncode, 0)
            self.assertTrue(json.loads(ok.stdout)["matched"])
            self.assertFalse(json.loads(ok.stdout)["trustsoft_parity_accepted"])


if __name__ == "__main__":
    unittest.main()
