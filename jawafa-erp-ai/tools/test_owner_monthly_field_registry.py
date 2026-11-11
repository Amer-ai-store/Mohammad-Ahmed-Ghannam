"""Fail-closed metadata checks for ALL 43 owner reference report fields.

Tests cannot certify a TrustSoft source field business meaning.
"""
from __future__ import annotations

import json
import unittest
from collections import Counter
from pathlib import Path

from render_owner_monthly_movement import EXPECTED_FIELDS
from compare_owner_daily_erp_candidates import CANDIDATES, ERP_COLUMNS

REGISTRY = (
    Path(__file__).resolve().parents[1]
    / "docs" / "owner_monthly_field_registry_20261111.json"
)


class OwnerMonthlyFieldRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(REGISTRY.read_text(encoding="utf-8"))

    def test_all_named_source_fields_are_explicitly_catalogued_once(self):
        fields = self.data["fields"]
        self.assertEqual(self.data["source_named_field_count"], 43)
        self.assertEqual(self.data["source_trailing_empty_column_count"], 1)
        self.assertEqual(len(fields), 43)
        self.assertEqual(
            [entry["source_field"] for entry in fields], list(EXPECTED_FIELDS)
        )
        self.assertEqual(
            [entry["ordinal"] for entry in fields], list(range(1, 44))
        )
        self.assertEqual(
            len(set(entry["source_field"] for entry in fields)), 43
        )

    def test_exactly_four_unverified_numeric_candidates_and_two_keys(self):
        classes = Counter(entry["purpose"] for entry in self.data["fields"])
        self.assertEqual(classes["CANDIDATE_NUMERIC_COMPARISON"], 4)
        self.assertEqual(classes["CANDIDATE_DAY_KEY"], 1)
        self.assertEqual(classes["CANDIDATE_ITEM_KEY"], 1)
        self.assertEqual(classes["UNMAPPED_SOURCE_FIELD"], 37)
        self.assertEqual(self.data["candidate_numeric_field_count"], 4)
        pairs = {
            entry["source_field"]: entry["proposed_erp_field"]
            for entry in self.data["fields"]
            if entry["purpose"] == "CANDIDATE_NUMERIC_COMPARISON"
        }
        self.assertEqual(pairs, dict(CANDIDATES))
        self.assertTrue(all(x in ERP_COLUMNS for x in pairs.values()))

    def test_no_unverified_field_or_candidate_is_marked_accepted(self):
        self.assertIsNone(self.data["owner_report_parity_percent"])
        self.assertFalse(self.data["reference_report_ui_runtime_attested"])
        self.assertFalse(self.data["source_scope_independently_verified"])
        self.assertEqual(self.data["owner_approved_business_formulas"], 0)
        self.assertEqual(self.data["accepted_numeric_field_count"], 0)
        for field in self.data["fields"]:
            for key in (
                "reference_semantics_verified", "original_formula_verified",
                "independent_erp_value_matched", "print_and_export_verified",
                "role_access_verified", "accepted",
            ):
                self.assertIs(field[key], False)

    def test_unmapped_fields_do_not_invent_counterpart_or_unit_scale(self):
        for entry in self.data["fields"]:
            if entry["purpose"] == "UNMAPPED_SOURCE_FIELD":
                self.assertIsNone(entry["proposed_erp_field"])
                self.assertIsNone(entry["unit_scale_proposed"])
            elif entry["purpose"] == "CANDIDATE_NUMERIC_COMPARISON":
                self.assertEqual(
                    entry["unit_scale_proposed"],
                    "DECIMAL_3_X_1000_UNVERIFIED",
                )


if __name__ == "__main__":
    unittest.main()
