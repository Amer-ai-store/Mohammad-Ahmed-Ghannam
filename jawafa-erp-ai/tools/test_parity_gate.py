"""Synthetic tests only; they do not certify TrustSoft matching."""
import copy
import unittest

from parity_gate import InvalidCatalog, evaluate

HASH = "a" * 64
EXTRA_MODULES = (
    "bank_reconciliation", "accounts_receivable", "procurement", "inventory",
    "sales_pos", "tax", "investments", "security", "branches",
    "statutory_reports", "personnel", "permissions_settings",
)


def candidate():
    data = {
        "schema_version": 1,
        "reference_product": "TrustSoft",
        "catalog_frozen": False,
        "catalog_approval_ref": None,
        "mandatory_modules": ["cheques", "general_ledger", *EXTRA_MODULES],
        "workflows": [
            {"id": "CHQ-1", "module": "cheques", "name": "Cheque lifecycle",
             "status": "TESTED", "weight": None},
            {"id": "GL-1", "module": "general_ledger", "name": "Journal",
             "status": "DISCOVERED", "weight": None},
        ],
    }

    for index, module in enumerate(EXTRA_MODULES):
        data["workflows"].append({
            "id": f"BASE-{index + 1}", "module": module,
            "name": f"Synthetic {module} workflow", "status": "DISCOVERED",
            "weight": None,
        })
    return data


def freeze():
    data = candidate()
    data["catalog_frozen"] = True
    data["catalog_approval_ref"] = "independent-catalog-approval-001"
    data["owner_workflow_inventory_complete"] = True
    data["owner_workflow_inventory_approval_ref"] = "verified-owner-used-workflow-inventory"
    for entry in data["workflows"]:
        entry["owner_required"] = False
        entry["security_critical"] = False
        entry["weight"] = 1
    # 117 accepted / (117 + 13 mandatory other workflows) = 90%.
    data["workflows"][0]["weight"] = 117
    return data


def approve(entry):
    entry["status"] = "ACCEPTED"
    entry["reference_evidence_sha256"] = HASH
    entry["implementation_evidence_sha256"] = "b" * 64
    entry["comparison_evidence_sha256"] = "c" * 64
    entry["independent_approval_ref"] = "independent-review-of-comparison-001"


class ParityGateTests(unittest.TestCase):
    def test_unfrozen_catalog_is_unmeasured_not_zero_percent(self):
        result = evaluate(candidate())
        self.assertEqual(result["result"], "UNMEASURED")
        self.assertIsNone(result["parity_percent"])
        self.assertFalse(result["certification_eligible"])

    def test_frozen_but_unaccepted_catalog_is_below_threshold(self):
        result = evaluate(freeze())
        self.assertEqual(result["parity_percent"], 0)
        self.assertFalse(result["certification_eligible"])

    def test_accepted_exact_90_percent_passes_metadata_threshold(self):
        data = freeze()
        approve(data["workflows"][0])
        result = evaluate(data)
        self.assertEqual(result["parity_percent"], 90)
        self.assertEqual(result["result"], "VERIFIED_METADATA_THRESHOLD")
        self.assertTrue(result["certification_eligible"])

    def test_accepted_less_than_90_percent_fails(self):
        data = freeze()
        data["workflows"][0]["weight"] = 8
        data["workflows"][1]["weight"] = 2
        approve(data["workflows"][0])
        self.assertEqual(evaluate(data)["result"], "BELOW_90_PERCENT")

    def test_missing_source_comparison_proof_cannot_be_accepted(self):
        data = freeze()
        data["workflows"][0]["status"] = "ACCEPTED"
        with self.assertRaisesRegex(InvalidCatalog, "MISSING_HASHED"):
            evaluate(data)

    def test_no_approval_even_with_valid_hashes(self):
        data = freeze()
        approve(data["workflows"][0])
        data["workflows"][0]["independent_approval_ref"] = None
        with self.assertRaisesRegex(InvalidCatalog, "MISSING_INDEPENDENT"):
            evaluate(data)

    def test_duplicate_entry_fails(self):
        data = candidate()
        data["workflows"].append(copy.deepcopy(data["workflows"][0]))
        with self.assertRaisesRegex(InvalidCatalog, "DUPLICATED"):
            evaluate(data)

    def test_unfrozen_catalog_must_not_contain_early_weights(self):
        data = candidate()
        data["workflows"][0]["weight"] = 99
        with self.assertRaisesRegex(InvalidCatalog, "WEIGHT_BEFORE"):
            evaluate(data)

    def test_frozen_catalog_missing_modules_fails(self):
        data = freeze()
        data["workflows"] = data["workflows"][:1]
        with self.assertRaisesRegex(InvalidCatalog, "OMITS_MANDATORY"):
            evaluate(data)

    def test_reject_zero_or_fractional_weights(self):
        for bad in (0, -1, True, 0.5, None):
            with self.subTest(weight=bad):
                data = freeze()
                data["workflows"][0]["weight"] = bad
                with self.assertRaisesRegex(InvalidCatalog, "UNFROZEN_WEIGHT"):
                    evaluate(data)

    def test_frozen_catalog_cannot_drop_hr_and_settings(self):
        for missing in ("personnel", "permissions_settings"):
            with self.subTest(module=missing):
                data = freeze()
                data["mandatory_modules"].remove(missing)
                data["workflows"] = [
                    e for e in data["workflows"] if e["module"] != missing
                ]
                with self.assertRaisesRegex(
                    InvalidCatalog, "WEAKENS_OWNER_MODULE_BASELINE"
                ):
                    evaluate(data)

    def test_missing_hr_workflow_cannot_pass_even_if_named_mandatory(self):
        data = freeze()
        data["workflows"] = [
            e for e in data["workflows"] if e["module"] != "personnel"
        ]
        with self.assertRaisesRegex(InvalidCatalog, "OMITS_MANDATORY"):
            evaluate(data)

    def test_frozen_catalog_missing_complete_owner_inventory_is_rejected(self):
        data = freeze()
        data["owner_workflow_inventory_complete"] = False
        with self.assertRaisesRegex(InvalidCatalog, "OWNER_WORKFLOW_INVENTORY_NOT_COMPLETE"):
            evaluate(data)

    def test_owner_required_journal_blocks_even_at_90_percent(self):
        data = freeze()
        approve(data["workflows"][0])
        data["workflows"][1]["owner_required"] = True
        outcome = evaluate(data)
        self.assertEqual(outcome["parity_percent"], 90)
        self.assertFalse(outcome["certification_eligible"])
        self.assertEqual(outcome["unaccepted_owner_critical_workflows"], ["GL-1"])

    def test_security_critical_workflow_blocks_release(self):
        data = freeze()
        approve(data["workflows"][0])
        data["workflows"][1]["security_critical"] = True
        result = evaluate(data)
        self.assertEqual(result["result"], "OWNER_REQUIRED_WORKFLOWS_INCOMPLETE")

    def test_missing_critical_classification_cannot_silently_pass(self):
        data = freeze()
        del data["workflows"][0]["owner_required"]
        with self.assertRaisesRegex(InvalidCatalog, "MISSING_OWNER_CRITICAL_CLASSIFICATION"):
            evaluate(data)

    def test_reject_non_trustsoft_reference(self):
        data = candidate()
        data["reference_product"] = "Other"
        with self.assertRaisesRegex(InvalidCatalog, "REFERENCE_PRODUCT"):
            evaluate(data)


if __name__ == "__main__":
    unittest.main()
