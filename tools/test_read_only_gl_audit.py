"""Synthetic tests for offline GL arithmetic screening."""
import csv
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from read_only_gl_audit import analyze

class GeneralLedgerAuditTests(unittest.TestCase):
    def fixture(self, parent):
        data = parent / "data"
        data.mkdir()
        def make(name, cols, rows):
            with (data / name).open("w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(cols)
                writer.writerows(rows)
        make("dbo.Journal_GL.csv", ["JournalNo"], [[1], [2], [3]])
        make("dbo.From_gl.csv", ["JournalNo","amount"], [[1,"100.00"],[2,"50.00"],[3,"10.00"]])
        make("dbo.To_GL.csv", ["JournalNo","Amount"], [[1,"100.00"],[2,"49.50"],[3,"10.00"]])

    def test_unbalanced_journal_detected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.fixture(root)
            r = analyze(root)
            self.assertEqual(r["journal_numbers_with_unequal_leg_totals"], 1)
            self.assertEqual(r["journal_numbers_without_header"], 0)
            self.assertEqual(r["headers_without_any_lines"], 0)
            self.assertEqual(r["journal_headers"], 3)
            self.assertNotIn("49.50", str(r))

    def test_tolerance_and_missing_header(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.fixture(root)
            with (root / "data" / "dbo.From_gl.csv").open("a") as f:
                f.write("9,0.01\n")
            with (root / "data" / "dbo.To_GL.csv").open("a") as f:
                f.write("9,0.00\n")
            r = analyze(root, tolerance=Decimal("0.01"))
            self.assertEqual(r["journal_numbers_without_header"], 1)
            self.assertEqual(r["journal_numbers_with_unequal_leg_totals"], 1)

if __name__ == "__main__":
    unittest.main()
