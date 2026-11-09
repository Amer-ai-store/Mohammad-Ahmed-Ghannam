"""Synthetic gate tests: metadata validity is not TrustSoft report acceptance."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from report_gate import InvalidReportCatalog, evaluate

H = "a" * 64


def candidate():
    return {
        "schema_version": 1,
        "reference_product": "TrustSoft",
        "scope": "all_owner_accessible_and_used_reports_across_every_module",
        "catalog_frozen": False,
        "reference_version_verified": False,
        "menu_screen_inventory_complete": False,
        "report_template_inventory_complete": False,
        "all_owner_used_reports_enumerated": False,
        "independent_catalog_approval_ref": None,
        "evidence_snapshot_sha256": None,
        "reports": [],
    }


def report(rid="RPT-001"):
    return {
        "id": rid,
        "module": "procurement",
        "reference_menu_path": "Synthetic > Reports",
        "reference_report_name": "Synthetic report — not a TrustSoft claim",
        "status": "DISCOVERED",
    }


def freeze(data):
    data["catalog_frozen"] = True
    for field in (
        "reference_version_verified", "menu_screen_inventory_complete",
        "report_template_inventory_complete", "all_owner_used_reports_enumerated",
    ):
        data[field] = True
    data["independent_catalog_approval_ref"] = "reviewed-source-catalog"
    data["evidence_snapshot_sha256"] = H
    return data


def approve(entry):
    entry["status"] = "ACCEPTED"
    for name, hash_ in (
        ("reference_evidence_sha256", H),
        ("implementation_evidence_sha256", "b" * 64),
        ("comparison_evidence_sha256", "c" * 64),
    ):
        entry[name] = hash_
    entry["independent_approval_ref"] = "third-party-acceptance"
    for key in (
        "filters_tested", "totals_tested", "format_layout_tested",
        "permissions_tested", "historical_consistency_tested",
    ):
        entry[key] = True


class ReportGateTests(unittest.TestCase):
    def test_empty_unfrozen_is_unmeasured_and_denies_release(self):
        result = evaluate(candidate())
        self.assertEqual(result["result"], "UNMEASURED")
        self.assertIsNone(result["owner_report_coverage_percent"])
        self.assertFalse(result["report_release_gate_passed"])

    def test_unverified_inventory_cannot_be_frozen(self):
        data = candidate()
        data["reports"] = [report()]
        data["catalog_frozen"] = True
        with self.assertRaisesRegex(InvalidReportCatalog, "INCOMPLETE_REFERENCE_INVENTORY"):
            evaluate(data)

    def test_empty_frozen_inventory_is_rejected(self):
        with self.assertRaisesRegex(InvalidReportCatalog, "FROZEN_REPORT_CATALOG_EMPTY"):
            evaluate(freeze(candidate()))

    def test_not_all_reports_accepted_cannot_release_even_if_one_passes(self):
        data = freeze(candidate())
        data["reports"] = [report(), report("RPT-002")]
        approve(data["reports"][0])
        result = evaluate(data)
        self.assertEqual(result["owner_report_coverage_percent"], 50)
        self.assertEqual(result["missing_reports"], 1)
        self.assertFalse(result["report_release_gate_passed"])

    def test_all_reports_accepted_only_passes_metadata_gate(self):
        data = freeze(candidate())
        data["reports"] = [report(), report("RPT-002")]
        for entry in data["reports"]:
            approve(entry)
        result = evaluate(data)
        self.assertEqual(result["owner_report_coverage_percent"], 100)
        self.assertTrue(result["report_release_gate_passed"])
        self.assertEqual(result["result"], "ALL_REPORTS_ACCEPTED_METADATA_ONLY")

    def test_missing_filter_test_fails(self):
        data = freeze(candidate())
        data["reports"] = [report()]
        approve(data["reports"][0])
        data["reports"][0]["filters_tested"] = False
        with self.assertRaisesRegex(InvalidReportCatalog, "REPORT_TEST_MATRIX_INCOMPLETE"):
            evaluate(data)

    def test_missing_independent_review_fails(self):
        data = freeze(candidate())
        data["reports"] = [report()]
        approve(data["reports"][0])
        data["reports"][0]["independent_approval_ref"] = ""
        with self.assertRaisesRegex(InvalidReportCatalog, "MISSING_INDEPENDENT_REPORT_APPROVAL"):
            evaluate(data)

    def test_duplicates_cannot_inflate_coverage(self):
        data = candidate()
        data["reports"] = [report(), copy.deepcopy(report())]
        with self.assertRaisesRegex(InvalidReportCatalog, "DUPLICATE_REPORT_ID"):
            evaluate(data)

    def test_release_cli_rejects_90_percent_when_reports_not_approved(self):
        from test_parity_gate import approve as approve_workflow, freeze as freeze_workflows
        workflows = freeze_workflows()
        approve_workflow(workflows["workflows"][0])
        reports = candidate()  # Catalog intentionally incomplete.
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)
            (source / "workflows.json").write_text(json.dumps(workflows), encoding="utf-8")
            (source / "reports.json").write_text(json.dumps(reports), encoding="utf-8")
            cmd = [
                sys.executable, str(Path(__file__).with_name("parity_gate.py")),
                "--manifest", str(source / "workflows.json"), "--require-90",
                "--reports-manifest", str(source / "reports.json"),
            ]
            process = subprocess.run(cmd, capture_output=True, text=True, check=False)
            self.assertEqual(process.returncode, 1, process.stderr)
            payload = json.loads(process.stdout)
            self.assertEqual(payload["functional_parity"]["parity_percent"], 90)
            self.assertEqual(payload["result"], "ERP_RELEASE_NOT_APPROVED")
            self.assertEqual(payload["owner_reports"]["result"], "UNMEASURED")

    def test_release_cli_rejects_missing_report_manifest(self):
        from test_parity_gate import approve as approve_workflow, freeze as freeze_workflows
        workflows = freeze_workflows()
        approve_workflow(workflows["workflows"][0])
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "workflows.json"
            source.write_text(json.dumps(workflows), encoding="utf-8")
            process = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("parity_gate.py")),
                 "--manifest", str(source), "--require-90"],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(process.returncode, 2)
            self.assertEqual(json.loads(process.stdout)["result"],
                             "REPORT_MANIFEST_REQUIRED_FOR_90_RELEASE_CLAIM")

    def test_cannot_weaken_owner_report_scope(self):
        data = candidate()
        data["scope"] = "nine_ids_from_List_Report_only"
        with self.assertRaisesRegex(InvalidReportCatalog, "REPORT_SCOPE_WEAKENED"):
            evaluate(data)


if __name__ == "__main__":
    unittest.main()
