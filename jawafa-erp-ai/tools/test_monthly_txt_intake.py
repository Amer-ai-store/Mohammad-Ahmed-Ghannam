"""Synthetic validation only. Never commit owner financial report data."""
from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from monthly_txt_intake import IntakeError, ingest


REFERENCE = Path(__file__).resolve().parents[1] / "docs" / (
    "reference_monthly_movement_schema_20261110.json"
)


def names():
    source = json.loads(REFERENCE.read_text(encoding="utf-8"))
    cols = [x["name"] for x in source["columns"]]
    assert len(cols) == 44
    cols.remove("Main_Barcode")
    assert len(cols) == 43
    return cols


def row(item="A001", date="2026 /  10 / 1"):
    cols = names()
    record = dict.fromkeys(cols, "0.000")
    record.update({
        "MonthYear": date,
        "ItemCode": item,
        "Item_Name": "Synthetic item / عينة",
        "Net_Sales_Before_Tax": "2.560",
        "Net_Sales_Cost": "2.043",
        "Net_Profit": "0.517",
        "Family_Code": "0001",
        "Supplier_Code": "0002",
        "Cost_Damage": ",0.000",
        "Cost_Installation Damage": ",0.000",
        "Cost_Maintenance Damage": ",0.000",
    })
    return [record[x] for x in cols] + [""]


def seed(path: Path, records=None, *, extra_header=True):
    columns = names()
    with path.open("w", encoding="utf-16", newline="") as stream:
        writer = csv.writer(stream, delimiter="\t")
        writer.writerow(
            ["MonthYear"] + [f"[{x}]" for x in columns[1:]] +
            ([""] if extra_header else [])
        )
        for record in (records if records is not None else [row()]):
            writer.writerow(record)


def args(root):
    inp = root / "source.txt"
    seed(inp)
    return (inp, root / "out.csv", root / "evidence.json")


class MonthlyTxtIntakeTests(unittest.TestCase):
    def test_exact_fields_value_text_and_source_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            input_path, output, manifest = args(Path(tmp))
            before = input_path.read_bytes()
            result = ingest(input_path, output, manifest)
            self.assertEqual(result["rows"], 1)
            self.assertEqual(result["columns"], 43)
            self.assertFalse(result["parity_accepted"])
            self.assertEqual(before, input_path.read_bytes())
            with output.open(encoding="utf-8-sig", newline="") as stream:
                reader = csv.DictReader(stream)
                values = next(reader)
            self.assertEqual(values["MonthYear"], "2026-10-01")
            self.assertEqual(values["ItemCode"], "A001")
            self.assertEqual(values["Family_Code"], "0001")
            self.assertEqual(values["Net_Profit"], "0.517")
            self.assertEqual(values["Cost_Damage"], ",0.000")
            meta = json.loads(manifest.read_text(encoding="utf-8"))
            self.assertEqual(meta["reference_schema_missing"], ["Main_Barcode"])
            self.assertFalse(meta["reference_report_runtime_attested"])
            self.assertEqual(meta["anomaly_counts"]["PROFIT_IDENTITY_EXACT"], 1)
            self.assertEqual(
                meta["anomaly_counts"]["Cost_Damage_PREFIX_COMMA"], 1
            )

    def test_detect_duplicate_day_item_even_if_amount_different(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp, output, manifest = args(Path(tmp))
            seed(inp, [row(), row()])
            with self.assertRaisesRegex(IntakeError, "DUPLICATED_DATE_ITEM"):
                ingest(inp, output, manifest)
            self.assertFalse(output.exists())

    def test_multi_day_same_item_allowed(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp, output, manifest = args(Path(tmp))
            seed(inp, [row(), row(date="2026 / 10 / 2")])
            result = ingest(inp, output, manifest)
            self.assertEqual(result["date_count"], 2)
            self.assertEqual(result["item_count"], 1)

    def test_reject_missing_last_tab_and_header_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp, output, manifest = args(Path(tmp))
            seed(inp, [row()], extra_header=False)
            with self.assertRaisesRegex(IntakeError, "EXPECTED_43_NAMED"):
                ingest(inp, output, manifest)
            seed(inp, [row()[:-1]])
            with self.assertRaisesRegex(IntakeError, "SOURCE_WIDTH_DRIFT"):
                ingest(inp, output, manifest)

    def test_existing_evidence_and_source_overwrite_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp, output, manifest = args(Path(tmp))
            with self.assertRaisesRegex(IntakeError, "PATH_COLLISION"):
                ingest(inp, inp, manifest)
            ingest(inp, output, manifest)
            with self.assertRaisesRegex(IntakeError, "REFUSE_OVERWRITE"):
                ingest(inp, output, manifest)

    def test_bom_and_bad_date_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp, output, manifest = args(Path(tmp))
            inp.write_text("invalid header\n", encoding="utf-8")
            with self.assertRaisesRegex(IntakeError, "EXPECTED_UTF16_LE_BOM"):
                ingest(inp, output, manifest)
            seed(inp, [row(date="2026 / 13 / 1")])
            with self.assertRaisesRegex(IntakeError, "INVALID_SOURCE_DATE"):
                ingest(inp, output, manifest)

    def test_profit_rounding_is_not_mutated(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp, output, manifest = args(Path(tmp))
            synthetic = row()
            idx = names().index("Net_Profit")
            synthetic[idx] = "0.518"
            seed(inp, [synthetic])
            result = ingest(inp, output, manifest)
            self.assertEqual(result["anomalies"]["PROFIT_IDENTITY_DIFF_AT_MOST_001"], 1)
            with output.open(encoding="utf-8-sig", newline="") as stream:
                values = next(csv.DictReader(stream))
            self.assertEqual(values["Net_Profit"], "0.518")


if __name__ == "__main__":
    unittest.main()
