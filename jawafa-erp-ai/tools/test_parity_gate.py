"""Synthetic tests only; they do not certify TrustSoft matching."""
import copy
import unittest

from parity_gate import InvalidCatalog, evaluate

HASH = "a" * 64


def candidate():
    return {
        "schema_version": 1,
        "reference_product": "TrustSoft",
        "catalog_frozen": False,
        "catalog_approval_ref": None,
        "mandatory_modules": ["cheques", "general_ledger"],
        "workflows": [
            {"id": "CHQ-1", "module": "cheques", "name": "Cheque lifecycle",
             "status": "TESTED", "weight": None},
            {"id": "GL-1", "module": "general_ledger", "name": "Journal",
             "status": "DISCOVERED", "weight": None},
        ],
    }


def freeze():
    data = candidate()
    data["catalog_frozen"] = True
    data["catalog_approval_ref"] = "independent-catalog-approval-001"
    data["workflows"][0]["weight"] = 9
    data["workflows"][1]["weight"] = 1
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

    def test_reject_non_trustsoft_reference(self):
        data = candidate()
        data["reference_product"] = "Other"
        with self.assertRaisesRegex(InvalidCatalog, "REFERENCE_PRODUCT"):
            evaluate(data)


if __name__ == "__main__":
    unittest.main()
