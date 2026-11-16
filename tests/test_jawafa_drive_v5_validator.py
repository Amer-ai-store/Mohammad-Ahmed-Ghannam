"""Synthetic only: no Jawafa financial rows, Drive credentials or network."""
import csv
import hashlib
import io
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))
from jawafa_drive_v5_validator import validate_v5, parse_csv
from jawafa_drive_readonly_verify import DigestSink


def sample():
    tables = ["dbo.Branches", "dbo.Items", "dbo.MPOSSales", "dbo.ItemSalesSummary"]
    inv = [dict(schema=t.split(".")[0], table=t.split(".")[1], rows="1", cols="2") for t in tables]
    results = [
        dict(table="dbo.Branches", mode="FULL", rows="1", status="OK"),
        dict(table="dbo.Items", mode="FULL", rows="1", status="OK"),
        dict(table="dbo.MPOSSales", mode="DELTA", rows="1", status="OK"),
        dict(table="dbo.ItemSalesSummary", mode="BASELINE_REFERENCE", rows="1", status="REFERENCE_ONLY_NOT_EXPORTED"),
    ]
    data = [dict(name=t+".csv", size="3", sha256=hashlib.sha256(b"abc").hexdigest()) for t in tables[:3]]
    manifests = [dict(file=x["name"], bytes=x["size"], sha256=x["sha256"]) for x in data]
    return inv, results, manifests, data


def check(inv=None, results=None, manifest=None, files=None):
    original = sample()
    return validate_v5(*(v if v is not None else original[i] for i, v in enumerate((inv, results, manifest, files))), expected_tables=4, expected_full=2, expected_delta=1)


class V5ValidatorTest(unittest.TestCase):
    def test_valid_hybrid(self):
        r = check()
        self.assertTrue(r["verified"], r["issues"])
        self.assertFalse(r["sql_restore_tested"])
        self.assertFalse(r["financial_snapshot_consistent"])

    def test_manifest_same_count_but_swapped_name(self):
        _, _, manifest, _ = sample()
        manifest[0]["file"] = "dbo.NonExisting.csv"
        self.assertIn("manifest_file_set_mismatch", check(manifest=manifest)["issues"])

    def test_data_same_count_but_swapped_name(self):
        _, _, _, files = sample()
        files[1]["name"] = "dbo.NonExisting.csv"
        self.assertIn("drive_file_set_mismatch", check(files=files)["issues"])

    def test_missing_file(self):
        _, _, _, files = sample()
        self.assertFalse(check(files=files[:-1])["verified"])

    def test_duplicate_manifest(self):
        _, _, manifests, _ = sample()
        manifests[1]["file"] = manifests[0]["file"]
        self.assertTrue(any(x.startswith("duplicate:manifest") for x in check(manifest=manifests)["issues"]))

    def test_duplicate_inventory(self):
        inventory, _, _, _ = sample()
        inventory[1]["table"] = inventory[0]["table"]
        self.assertFalse(check(inv=inventory)["verified"])

    def test_hash_mismatch(self):
        _, _, _, files = sample()
        files[0]["sha256"] = "0"*64
        self.assertTrue(any(x.startswith("sha256_mismatch") for x in check(files=files)["issues"]))

    def test_size_mismatch(self):
        _, _, _, files = sample()
        files[0]["size"] = "2"
        self.assertTrue(any(x.startswith("size_mismatch") for x in check(files=files)["issues"]))

    def test_bad_hash_format(self):
        _, _, manifests, _ = sample()
        manifests[0]["sha256"] = "X"
        self.assertFalse(check(manifest=manifests)["verified"])

    def test_reference_cannot_be_marked_exported(self):
        _, rows, _, _ = sample()
        rows[-1]["status"] = "OK"
        self.assertIn("invalid_reference_status", check(results=rows)["issues"])

    def test_wrong_full_delta_counts(self):
        _, rows, _, _ = sample()
        rows[0]["mode"] = "DELTA"
        self.assertIn("incorrect_v5_modes", check(results=rows)["issues"])

    def test_error_status(self):
        _, rows, _, _ = sample()
        rows[1]["status"] = "FAILED"
        self.assertFalse(check(results=rows)["verified"])

    def test_manifest_more_than_expected(self):
        _, _, manifests, _ = sample()
        manifests.append(dict(file="dbo.Extra.csv", bytes="1", sha256="a"*64))
        self.assertFalse(check(manifest=manifests)["verified"])

    def test_invalid_csv_columns(self):
        with self.assertRaisesRegex(ValueError, "invalid_columns"):
            parse_csv(b"schema_name,table_name,rows,cols\ndbo,Branches,1,2\n", ("schema", "table", "rows", "cols"), "inventory")

    def test_utf8_bom_and_quoted_columns(self):
        rows=parse_csv(b'\xef\xbb\xbf"schema","table","rows","cols"\n"dbo","Branches","1","2"\n', ("schema", "table", "rows", "cols"), "inventory")
        self.assertEqual(rows[0]["schema"], "dbo")

    def test_truncated_csv(self):
        with self.assertRaises(ValueError):
            parse_csv(b'"schema","table","rows","cols"\n"dbo","Branches","1"\n', ("schema", "table", "rows", "cols"), "inventory")

    def test_digest_sink_streams(self):
        sink = DigestSink()
        sink.write(b"ab"); sink.write(b"c")
        self.assertEqual(sink.size, 3)
        self.assertEqual(sink.hexdigest, hashlib.sha256(b"abc").hexdigest())


if __name__ == "__main__":
    unittest.main()
