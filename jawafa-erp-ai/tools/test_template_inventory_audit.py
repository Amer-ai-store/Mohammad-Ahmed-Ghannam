"""Synthetic tests for the private template-header/filename inventory."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from template_inventory_audit import InvalidTemplateManifest, audit


def item(path, digest="a" * 64, size=150):
    return {
        "relative_path": path,
        "file_name": path.split("\\")[-1],
        "sha256": digest,
        "bytes": size,
    }


class TemplateInventoryAuditTests(unittest.TestCase):
    def test_areas_duplicates_and_no_claimed_report_count(self):
        source = {"entries": [
            item(r"Account\Reports\Ledger.rpt"),
            item(r"Account\Reports\LedgerCopy.rpt"),
            item(r"POS\Reports\Receipt.rpt", "b" * 64),
        ]}
        summary, private = audit(source)
        self.assertEqual(summary["candidate_template_files"], 3)
        self.assertEqual(summary["unique_file_contents"], 2)
        self.assertEqual(summary["duplicate_extra_copies"], 1)
        self.assertEqual(summary["source_area_counts"], {
            "account_templates": 2, "pos_templates": 1,
        })
        self.assertIsNone(summary["owner_report_parity_percent"])
        self.assertIsNone(summary["verified_trustsoft_ui_report_count"])
        self.assertEqual(summary["matched_report_count"], 0)
        self.assertTrue(all(
            t["parity_status"] == "UNMEASURED" for t in private["templates"]
        ))
        self.assertFalse(private["source_files_mutated"])

    def test_repeated_path_in_different_case_rejected(self):
        with self.assertRaisesRegex(InvalidTemplateManifest, "DUPLICATE_RELATIVE"):
            audit({"entries": [
                item(r"Account\Reports\A.rpt", "a" * 64),
                item(r"account\reports\a.RPT", "b" * 64),
            ]})

    def test_invalid_paths_rejected(self):
        for value in (
            r"C:\Secrets\report.rpt",
            r"..\outside.rpt",
            r"Account\..\report.rpt",
            "Account/Reports/report.rpt",
            r"Account\Reports\report.exe",
            r"\Account\Reports\report.rpt",
        ):
            with self.subTest(value=value):
                with self.assertRaisesRegex(InvalidTemplateManifest, "UNSAFE"):
                    audit({"entries": [item(value)]})

    def test_file_name_mismatch_rejected(self):
        sample = item(r"Account\Reports\ABC.rpt")
        sample["file_name"] = "Other.rpt"
        with self.assertRaisesRegex(InvalidTemplateManifest, "FILENAME_MISMATCH"):
            audit({"entries": [sample]})

    def test_invalid_hashes_or_sizes_rejected(self):
        sample = item(r"Account\Reports\ABC.rpt", "invalid")
        with self.assertRaisesRegex(InvalidTemplateManifest, "INVALID_TEMPLATE_SHA"):
            audit({"entries": [sample]})
        sample = item(r"Account\Reports\ABC.rpt")
        sample["bytes"] = 0
        with self.assertRaisesRegex(InvalidTemplateManifest, "INVALID_TEMPLATE_SIZE"):
            audit({"entries": [sample]})

    def test_private_output_cli_is_immutable_and_summary_has_no_paths(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            source = root / "input.json"
            output = root / "private" / "inventory.json"
            source.write_text(
                json.dumps({"entries": [item(r"Account\Reports\PrivateReport.rpt")]}),
                encoding="utf-8",
            )
            script = Path(__file__).with_name("template_inventory_audit.py")
            args = [
                sys.executable, str(script), "--manifest", str(source),
                "--private-output", str(output),
            ]
            run = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            public = json.loads(run.stdout)
            self.assertNotIn("PrivateReport", json.dumps(public))
            self.assertEqual(len(json.loads(output.read_text())["templates"]), 1)
            repeat = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(repeat.returncode, 2)
            self.assertIn("REFUSE_OVERWRITE", repeat.stdout)
            self.assertEqual(
                json.loads(source.read_text())["entries"][0]["file_name"],
                "PrivateReport.rpt",
            )
            source_as_target = subprocess.run(
                [sys.executable, str(script), "--manifest", str(source),
                 "--private-output", str(source)],
                capture_output=True, text=True,
            )
            self.assertEqual(source_as_target.returncode, 2)
            self.assertIn("CANNOT_OVERWRITE_SOURCE", source_as_target.stdout)


if __name__ == "__main__":
    unittest.main()
