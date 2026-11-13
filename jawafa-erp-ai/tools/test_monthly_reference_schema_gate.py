"""Regression tests for the TrustSoft source-column contract. All data synthetic."""
from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from monthly_reference_schema_gate import SourceSchemaError, audit

MANIFEST_PATH = Path(__file__).resolve().parent.parent / "docs" / (
    "reference_monthly_movement_schema_20261110.json"
)


def manifest():
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def reference_header(spec=None):
    source = spec or manifest()
    return ",".join(field["name"] for field in source["columns"]).encode("utf-8")


class MonthlyReferenceSchemaTests(unittest.TestCase):
    def test_all_44_observed_columns_explicitly_unverified(self):
        result = audit(manifest(), reference_header())
        self.assertEqual(result["source_header_field_count"], 44)
        self.assertEqual(result["candidate_report_field_count"], 7)
        self.assertEqual(result["source_header_verified_against_export"], True)
        self.assertEqual(result["unverified_formula_field_count"], 44)
        self.assertEqual(result["candidate_report_source_mappings_count"], 0)
        self.assertIsNone(result["report_parity_percent"])
        self.assertFalse(result["owner_report_parity_accepted"])
        self.assertEqual(result["result"], "SCHEMA_HEADER_OBSERVED_REPORT_UNMEASURED")

    def test_manifest_without_original_file_is_not_header_verified(self):
        result = audit(manifest())
        self.assertIsNone(result["source_header_verified_against_export"])
        self.assertFalse(result["owner_report_parity_accepted"])

    def test_detect_modified_or_reordered_reference_columns(self):
        source = manifest()
        source["columns"][3]["name"] = "InventedRevenue"
        with self.assertRaisesRegex(SourceSchemaError, "MANIFEST_HEADER_HASH_MISMATCH"):
            audit(source, reference_header())
        with self.assertRaisesRegex(SourceSchemaError, "SOURCE_HEADER_DRIFT"):
            audit(manifest(), reference_header().replace(b"ItemCode,", b"NewCode,"))

    def test_reject_column_omission_and_duplicate(self):
        spec = manifest()
        spec["columns"].pop()
        with self.assertRaisesRegex(SourceSchemaError, "COLUMN_COUNT_MISMATCH"):
            audit(spec)
        spec = manifest()
        spec["columns"][1]["name"] = spec["columns"][0]["name"]
        with self.assertRaisesRegex(SourceSchemaError, "DUPLICATE_COLUMN_NAME"):
            audit(spec)

    def test_no_false_report_approval_or_formula_verification(self):
        spec = manifest()
        spec["owner_report_accepted"] = True
        with self.assertRaisesRegex(SourceSchemaError, "CANNOT_ACCEPT_UI_REPORT"):
            audit(spec)
        spec = manifest()
        spec["reference_semantics_verified"] = True
        with self.assertRaisesRegex(SourceSchemaError, "UNVERIFIED_SOURCE_FORMULAS"):
            audit(spec)
        spec = manifest()
        spec["columns"][0]["business_formula_verified"] = True
        with self.assertRaisesRegex(SourceSchemaError, "FALSE_FORMULA_VERIFICATION"):
            audit(spec)

    def test_source_runtime_claim_requires_actual_output_evidence(self):
        spec = manifest()
        spec["reference_runtime_output_captured"] = True
        with self.assertRaisesRegex(SourceSchemaError, "MISSING_RUNTIME_REPORT_OUTPUT"):
            audit(spec)

    def test_cli_opens_only_source_csv_header_and_never_logs_rows(self):
        with tempfile.TemporaryDirectory() as root:
            folder = Path(root)
            src = folder / "source.csv"
            manifest_path = folder / "manifest.json"
            src.write_bytes(reference_header() + b"\r\n" +
                            b"SECRET_PERSONAL_SOURCE_ROW_DO_NOT_READ\n")
            manifest_path.write_text(json.dumps(manifest()), encoding="utf-8")
            script = Path(__file__).with_name("monthly_reference_schema_gate.py")
            args = [
                sys.executable, str(script),
                "--manifest", str(manifest_path),
                "--source-export-header-from", str(src),
            ]
            run = subprocess.run(args, capture_output=True, text=True, check=False)
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            self.assertNotIn("SECRET_PERSONAL", run.stdout)
            self.assertEqual(
                json.loads(run.stdout)["source_header_verified_against_export"],
                True,
            )
            deny = subprocess.run(
                [*args, "--require-report-accepted"],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(deny.returncode, 1)
            self.assertFalse(json.loads(deny.stdout)["owner_report_parity_accepted"])

    def test_cli_denies_header_drift(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / "source.csv"
            spec = root / "manifest.json"
            source.write_bytes(reference_header().replace(b"ItemCode", b"NotItemCode") + b"\n")
            spec.write_text(json.dumps(manifest()), encoding="utf-8")
            run = subprocess.run(
                [sys.executable,
                 str(Path(__file__).with_name("monthly_reference_schema_gate.py")),
                 "--manifest", str(spec),
                 "--source-export-header-from", str(source)],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(run.returncode, 2)
            self.assertIn("SOURCE_HEADER_DRIFT_OR_ORDER_CHANGE", run.stdout)


if __name__ == "__main__":
    unittest.main()
