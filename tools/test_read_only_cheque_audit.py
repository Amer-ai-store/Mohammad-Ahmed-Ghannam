"""Synthetic tests for the read-only auditor. No Jawafa records included."""
import csv
import hashlib
import tempfile
import unittest
from pathlib import Path

from read_only_cheque_audit import analyze

class ChequeAuditTests(unittest.TestCase):
    def make_export(self, root):
        data = root / "data"
        data.mkdir()
        tables = {
            "dbo.ARPDocuments.csv": (["CheqId", "TransNo"], [["100", "11"], ["101", "11"], ["102", "12"]]),
            "dbo.ARPPayMaster.csv": (["TransNo", "PayType"], [["11", "1"], ["12", "1"], ["13", "0"]]),
            "dbo.CheqMovement.csv": (["CheqId", "statusE", "MoveDate"], [
                ["100", "Paid", "2025-01-01"],
                ["SECRET_FAKE_ID", "Paid", "2025-02-01"],
                ["SECRET_FAKE_ID", "Returned", "2025-03-01"],
            ]),
        }
        entries = []
        for name, (header, values) in tables.items():
            file = data / name
            with file.open("w", newline="", encoding="utf-8") as f:
                w = csv.writer(f); w.writerow(header); w.writerows(values)
            entries.append([name, file.stat().st_size, hashlib.sha256(file.read_bytes()).hexdigest()])
        with (root / "manifest_sha256.csv").open("w", newline="") as f:
            w = csv.writer(f); w.writerow(["file", "bytes", "sha256"]); w.writerows(entries)

    def test_reference_integrity_and_no_leaked_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_export(root)
            report = analyze(root)
            self.assertEqual(report["manifest"]["matched"], 3)
            self.assertEqual(report["links"]["documents_without_voucher_master"], 0)
            self.assertEqual(report["links"]["voucher_masters_without_cheque_document"], 1)
            self.assertEqual(report["links"]["movements_without_current_cheque_document"], 2)
            self.assertEqual(report["links"]["distinct_missing_cheque_ids"], 1)
            self.assertEqual(report["keys"]["duplicate_cheque_ids"], 0)
            self.assertNotIn("SECRET_FAKE_ID", str(report))

    def test_manifest_corruption_detected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_export(root)
            path = root / "data" / "dbo.CheqMovement.csv"
            with path.open("a") as f:
                f.write("modified")
            report = analyze(root)
            self.assertEqual(report["manifest"]["status"], "incomplete")
            self.assertEqual(report["manifest"]["matched"], 2)

if __name__ == "__main__":
    unittest.main()
