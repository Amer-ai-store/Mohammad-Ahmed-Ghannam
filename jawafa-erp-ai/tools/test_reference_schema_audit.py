"""Synthetic tests of a read-only TrustSoft reference HEADER auditor."""
import csv
import json
import tempfile
import unittest
from pathlib import Path

from reference_schema_audit import (
    InvalidReferenceExport, evaluate, read_inventory,
)


class HeaderOnlyReferenceAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.data = self.root / "data"
        self.data.mkdir()
        self.inventory = self.root / "inventory_tables.csv"

    def inventory_rows(self, rows):
        with self.inventory.open("w", encoding="utf-8", newline="") as file:
            writer = csv.writer(file)
            writer.writerow(("schema", "table", "rows", "cols"))
            writer.writerows(rows)

    def create_source(self, name, header, fake_private_row="PRIVATE_VALUE_MUST_NOT_APPEAR"):
        with (self.data / f"{name}.csv").open(
            "w", encoding="utf-8", newline=""
        ) as file:
            writer = csv.writer(file)
            writer.writerow(header)
            writer.writerow([fake_private_row for _ in header])

    def test_header_pair_is_discovered_without_treating_as_verified_fk(self):
        self.inventory_rows([
            ("dbo", "Items", "100", "2"),
            ("dbo", "Families", "12", "1"),
        ])
        self.create_source("dbo.Items", ["ItemCode", "FamCode"])
        self.create_source("dbo.Families", ["FamCode"])
        result = evaluate(self.inventory, self.data)
        relation = next(j for j in result["candidate_joins"]
                        if j["module"] == "procurement_inventory"
                        and j["from_table"] == "dbo.Items")
        self.assertTrue(relation["column_pair_present"])
        self.assertEqual(relation["status"], "DISCOVERED")
        self.assertFalse(relation["foreign_key_verified"])
        self.assertFalse(relation["functional_parity_verified"])
        self.assertIsNone(result["trustsoft_functional_parity_percent"])
        self.assertEqual(result["inventory_table_count"], 2)
        self.assertNotIn("PRIVATE_VALUE_MUST_NOT_APPEAR", json.dumps(result))

    def test_missing_header_blocks_candidate_join_instead_of_guessing(self):
        self.inventory_rows([("dbo", "Items", "1", "2")])
        self.create_source("dbo.Items", ["ItemCode", "FamCode"])
        result = evaluate(self.inventory, self.data)
        relation = next(j for j in result["candidate_joins"]
                        if j["from_table"] == "dbo.Items"
                        and j["to_table"] == "dbo.Families")
        self.assertFalse(relation["column_pair_present"])
        self.assertEqual(relation["status"], "MISSING_HEADER_EVIDENCE")
        self.assertFalse(result["source_table_metadata"]["dbo.Families"]["csv_header_present"])

    def test_inventory_identifiers_are_restricted(self):
        self.inventory_rows([("dbo", "../private", "0", "0")])
        with self.assertRaisesRegex(InvalidReferenceExport, "IDENTIFIER"):
            read_inventory(self.inventory)

    def test_duplicate_inventory_identifier_fails_closed(self):
        self.inventory_rows([
            ("dbo", "Items", "20", "2"),
            ("dbo", "Items", "21", "2"),
        ])
        with self.assertRaisesRegex(InvalidReferenceExport, "DUPLICATE"):
            read_inventory(self.inventory)

    def test_reference_header_does_not_ingest_subsequent_rows(self):
        self.inventory_rows([("dbo", "Journal_GL", "1", "2"),
                             ("dbo", "From_gl", "1", "2")])
        self.create_source("dbo.Journal_GL", ["JournalNo", "JournalDate"])
        self.create_source("dbo.From_gl", ["JournalNo", "amount"])
        result = evaluate(self.inventory, self.data)
        text = json.dumps(result)
        self.assertNotIn("PRIVATE_VALUE_MUST_NOT_APPEAR", text)
        self.assertIn("JournalNo", text)
        self.assertEqual(result["verified_foreign_key_count"], 0)
        self.assertTrue(result["read_only"])


if __name__ == "__main__":
    unittest.main()
