"""Synthetic-only full-chain test: independent Node events -> private CSV -> compare.

This is NOT a TrustSoft functional parity test. Never put owner numbers here.
"""
from __future__ import annotations

import csv
import hashlib
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from compare_owner_daily_erp_candidates import compare_private_exports
from render_owner_monthly_movement import EXPECTED_FIELDS

ROOT = Path(__file__).resolve().parents[1]
NODE_CLI = ROOT / "api" / "tools" / "export_private_daily_report.mjs"
NODE = shutil.which("node")


@unittest.skipUnless(NODE, "Node runtime unavailable for synthetic bridge test")
class PrivateReportBridgeTests(unittest.TestCase):
    def build(self, temp: Path, *, discrepancy: bool):
        source = temp / "events.json"
        candidate = temp / "daily.csv"
        manifest = temp / "candidate-manifest.json"
        reference = temp / "owner-reference.csv"

        payload = {
            "schemaVersion": 1,
            "sourceKind": "NEW_ERP_EVENT_EXPORT_READ_ONLY",
            "provenance": {
                "captureRef": "SYNTHETIC-CAPTURE-101",
                "authorizationRef": "SYNTHETIC-APPROVED-101",
                "tenantId": "SYNTH-TENANT",
                "branchId": "SYNTH-BRANCH",
                "fromDate": "2026-10-01",
                "toDate": "2026-10-31",
            },
            "events": [
                {
                    "eventId": "SYNTH-EVENT-1",
                    "tenantId": "SYNTH-TENANT",
                    "branchId": "SYNTH-BRANCH",
                    "date": "2026-10-01",
                    "itemCode": "SYNTH-SKU",
                    "familyCode": "SYNTH-FAM",
                    "supplierCode": "SYNTH-SUP",
                    "kind": "sale",
                    "status": "POSTED",
                    "quantityMilli": 1000,
                    "netAmountFils": 250,
                    "taxFils": 40,
                    "costFils": 175,
                },
            ],
        }
        source.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
        args = [
            NODE, str(NODE_CLI), "--events-json", str(source),
            "--expected-source-sha256", sha(source),
            "--approved-private-dir", str(temp),
            "--output-csv", str(candidate), "--output-manifest", str(manifest),
            "--attest-private-output",
        ]
        p = subprocess.run(args, capture_output=True, text=True, timeout=15)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        data = json.loads(p.stdout)
        self.assertEqual(data["status"], "CREATED_PRIVATE_CANDIDATE")
        self.assertFalse(data["comparisonWithTrustSoftPerformed"])
        self.assertIsNone(data["trustsoftFunctionalParityPercent"])
        self.assertNotIn("SYNTH-SKU", p.stdout)
        self.assertEqual(data["outputSha256"], sha(candidate))
        self.assertEqual(json.loads(manifest.read_text())["outputSha256"], sha(candidate))

        row = dict.fromkeys(EXPECTED_FIELDS, "0.000")
        row.update(
            MonthYear="2026 / 10 / 1",
            ItemCode="SYNTH-SKU",
            Item_Name="Synth reference",
            Family_Code="SYNTH-FAM",
            Supplier_Code="SYNTH-SUP",
            Sales_Qty="1.000",
            Net_Sales_Before_Tax="0.250",
            Net_Sales_Cost="0.175",
            Net_Profit="0.076" if discrepancy else "0.075",
        )
        with reference.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(list(EXPECTED_FIELDS) + [""])
            writer.writerow([row[k] for k in EXPECTED_FIELDS] + [""])

        compared = compare_private_exports(
            reference.read_bytes(), candidate.read_bytes(),
            reference_sha256=sha(reference),
            independent_sha256=sha(candidate),
            from_date="2026-10-01",
            to_date="2026-10-31",
            operator_scope_ref="SYNTHETIC-SCOPE-101",
            candidate_only_acknowledged=True,
        )
        return compared, p.stdout

    def test_genuine_cross_runtime_synthetic_pipeline_not_parity(self):
        with tempfile.TemporaryDirectory() as t:
            summary, stdout = self.build(Path(t), discrepancy=False)
            self.assertEqual(summary["common_day_item_keys"], 1)
            self.assertEqual(summary["different_common_rows"], 0)
            self.assertEqual(summary["reference_only_keys"], 0)
            self.assertEqual(summary["erp_only_keys"], 0)
            self.assertEqual(summary["candidate_field_count"], 4)
            self.assertFalse(summary["owner_report_parity_accepted"])
            self.assertIsNone(summary["functional_parity_percent"])

    def test_one_modified_source_profit_is_detected_without_leak(self):
        with tempfile.TemporaryDirectory() as t:
            summary, stdout = self.build(Path(t), discrepancy=True)
            self.assertEqual(summary["different_common_rows"], 1)
            self.assertEqual(
                summary["different_cell_counts_by_reference_field"],
                {"Net_Profit": 1},
            )
            self.assertNotIn("0.076", json.dumps(summary))
            self.assertNotIn("SYNTH-SKU", json.dumps(summary))


if __name__ == "__main__":
    unittest.main()
