"""Synthetic-only tests. No owner financial data in repository or CI."""
import csv
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from verify_monthly_txt_csv_roundtrip import PreservationError, verify


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sample_rows():
    header = ["MonthYear", "[ItemCode]", "[Item_Name]"] + [
        f"[SYNTHETIC_FIELD_{i}]" for i in range(4, 44)
    ] + [""]
    assert len(header) == 44
    a = ["2026 /  10 / 1", "A-001", "تجريبي"] + [
        "0.000" for _ in range(4, 44)
    ] + [""]
    b = ["2026 /  10 / 2", "A-002", "Test name"] + [
        ",0.000" if i == 30 else "-0.001" if i == 8 else "0.000"
        for i in range(4, 44)
    ] + [""]
    return [header, a, b]


def seed(root, *, mutate=None):
    t = root / "source.txt"
    c = root / "copy.csv"
    rows = sample_rows()
    with t.open("w", encoding="utf-16", newline="") as out:
        csv.writer(out, delimiter="\t").writerows(rows)
    new = [r[:] for r in rows]
    if mutate:
        mutate(new)
    with c.open("w", encoding="utf-8-sig", newline="") as out:
        csv.writer(out).writerows(new)
    return t, c


def check(t, c):
    return verify(t, c, expected_source_sha256=sha(t), expected_converted_sha256=sha(c))


class MonthlyRoundtripTests(unittest.TestCase):
    def test_exact_preservation_including_arabic_and_comma_legacy_values(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d))
            before = t.read_bytes()
            result = check(t, c)
            self.assertTrue(result["all_cells_preserved"])
            self.assertEqual(result["source_rows"], 2)
            self.assertEqual(result["converted_rows"], 2)
            self.assertEqual(result["named_column_count"], 43)
            self.assertEqual(result["different_data_row_count"], 0)
            self.assertIsNone(result["trustsoft_parity_percent"])
            self.assertFalse(result["trustsoft_functional_parity_accepted"])
            self.assertEqual(t.read_bytes(), before)

    def test_any_financial_digit_change_is_detected_but_not_echoed(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d), mutate=lambda r: r[1].__setitem__(10, "987654.123"))
            result = check(t, c)
            self.assertFalse(result["all_cells_preserved"])
            self.assertEqual(result["different_cell_counts_by_ordinal"], {"11": 1})
            self.assertEqual(result["different_data_row_count"], 1)
            self.assertNotIn("987654", json.dumps(result))

    def test_reordered_rows_detected(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d), mutate=lambda r: r.__setitem__(slice(1, None), r[1:][::-1]))
            result = check(t, c)
            self.assertEqual(result["different_data_row_count"], 2)

    def test_missing_output_row_detected(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d), mutate=lambda r: r.pop())
            result = check(t, c)
            self.assertEqual(result["source_rows"], 2)
            self.assertEqual(result["converted_rows"], 1)
            self.assertEqual(result["different_data_row_count"], 1)

    def test_header_change_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d), mutate=lambda r: r[0].__setitem__(1, "ItemCode"))
            with self.assertRaisesRegex(PreservationError, "HEADER_WAS_CHANGED"):
                check(t, c)

    def test_hash_mismatch_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d))
            with self.assertRaisesRegex(PreservationError, "SOURCE_SHA256_MISMATCH"):
                verify(t, c, expected_source_sha256="0" * 64, expected_converted_sha256=sha(c))
            with self.assertRaisesRegex(PreservationError, "CONVERTED_SHA256_MISMATCH"):
                verify(t, c, expected_source_sha256=sha(t), expected_converted_sha256="0" * 64)

    def test_missing_last_column_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d))
            with t.open("w", encoding="utf-16", newline="") as out:
                csv.writer(out, delimiter="\t").writerows([r[:-1] for r in sample_rows()])
            with self.assertRaisesRegex(PreservationError, "UNKNOWN_SOURCE_HEADER_CONTRACT"):
                check(t, c)

    def test_incorrect_encoding_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d))
            t.write_text("not BOM", encoding="utf8")
            with self.assertRaisesRegex(PreservationError, "SOURCE_NOT_UTF16"):
                check(t, c)

    def test_cli_exit_code_provides_reusable_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            t, c = seed(Path(d))
            script = Path(__file__).with_name("verify_monthly_txt_csv_roundtrip.py")
            p = subprocess.run([sys.executable, str(script), "--source-txt", str(t),
                                "--converted-csv", str(c), "--expected-source-sha256", sha(t),
                                "--expected-converted-sha256", sha(c)], capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            self.assertEqual(json.loads(p.stdout)["result"], "ALL_SOURCE_CELLS_PRESERVED")
            self.assertNotIn("A-001", p.stdout)


if __name__ == "__main__":
    unittest.main()
