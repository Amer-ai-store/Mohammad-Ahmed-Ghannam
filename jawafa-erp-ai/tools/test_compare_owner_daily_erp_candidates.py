"""Synthetic-only, privacy-safe tests for four-column candidate crosswalk."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from compare_owner_daily_erp_candidates import (
    CANDIDATES, ERP_COLUMNS, CandidateError, compare_private_exports,
)
from render_owner_monthly_movement import EXPECTED_FIELDS


def csvblob(rows, *, header=None, bom=True):
    stream = io.StringIO(newline="")
    w = csv.writer(stream)
    if header is not None:
        w.writerow(header)
    w.writerows(rows)
    return (b"\xef\xbb\xbf" if bom else b"") + stream.getvalue().encode("utf-8")


def build(*, changed=False, reference_more=False, duplicate=False):
    src = dict.fromkeys(EXPECTED_FIELDS, "0.000")
    src.update(
        MonthYear="2026 / 10 / 1", ItemCode="A001",
        Item_Name="عينة اصطناعية", Family_Code="0001", Supplier_Code="0002",
        Sales_Qty="1.000", Net_Sales_Before_Tax="0.250",
        Net_Sales_Cost="0.175", Net_Profit="0.075",
        **{"Cost_Damage": ",0.000"},
    )
    out = {
        "day": "2026-10-01", "item_code": "A001",
        "purchase_qty_milli": 0, "sales_qty_milli": 1000,
        "stock_delta_qty_milli": -1000,
        "purchases_before_tax_fils": 0, "purchase_tax_fils": 0,
        "sales_before_tax_fils": 250, "sales_tax_fils": 40,
        "sales_cost_fils": 175, "sales_profit_fils": 75,
    }
    if changed:
        out["sales_profit_fils"] = 70
    ref_rows = [[src[k] for k in EXPECTED_FIELDS] + [""]]
    erp_rows = [[out[k] for k in ERP_COLUMNS]]
    if duplicate:
        ref_rows.append(ref_rows[0])
    if reference_more:
        other = dict(src, MonthYear="2026 / 10 / 2")
        ref_rows.append([other[k] for k in EXPECTED_FIELDS] + [""])
    ref = csvblob(ref_rows, header=list(EXPECTED_FIELDS) + [""])
    erp = csvblob(erp_rows, header=list(ERP_COLUMNS), bom=False)
    return ref, erp


def compare(ref, erp, **extra):
    args = {
        "reference_sha256": hashlib.sha256(ref).hexdigest(),
        "independent_sha256": hashlib.sha256(erp).hexdigest(),
        "from_date": "2026-10-01", "to_date": "2026-10-31",
        "operator_scope_ref": "TEST-CANDIDATE-001",
        "candidate_only_acknowledged": True,
    }
    args.update(extra)
    return compare_private_exports(ref, erp, **args)


class CandidateCrosswalkTests(unittest.TestCase):
    def test_matching_four_candidates_never_approves_vendor_parity(self):
        ref, erp = build()
        data = compare(ref, erp)
        self.assertEqual(data["common_day_item_keys"], 1)
        self.assertEqual(data["candidate_field_count"], 4)
        self.assertEqual(data["unassessed_source_fields"], 39)
        self.assertEqual(data["different_common_rows"], 0)
        self.assertFalse(data["owner_report_parity_accepted"])
        self.assertIsNone(data["functional_parity_percent"])
        self.assertFalse(data["same_tenant_branch_verified"])
        self.assertFalse(data["vendor_business_formula_verified"])

    def test_one_changed_financial_value_reports_only_position_count(self):
        ref, erp = build(changed=True)
        data = compare(ref, erp)
        self.assertEqual(data["different_common_rows"], 1)
        self.assertEqual(
            data["different_cell_counts_by_reference_field"], {"Net_Profit": 1}
        )
        self.assertNotIn("0.075", json.dumps(data))
        self.assertNotIn("A001", json.dumps(data))

    def test_missing_erp_rows_count_as_coverage_gap_not_zero_valued(self):
        ref, erp = build(reference_more=True)
        data = compare(ref, erp)
        self.assertEqual(data["reference_only_keys"], 1)
        self.assertEqual(data["erp_only_keys"], 0)
        self.assertEqual(data["reference_rows"], 2)

    def test_duplicate_date_item_is_blocked(self):
        ref, erp = build(duplicate=True)
        with self.assertRaisesRegex(CandidateError, "REFERENCE_DUPLICATE_DAY_ITEM"):
            compare(ref, erp)

    def test_wrong_file_hash_rejected(self):
        ref, erp = build()
        with self.assertRaisesRegex(CandidateError, "REFERENCE_SHA256_MISMATCH"):
            compare(ref, erp, reference_sha256="0" * 64)
        with self.assertRaisesRegex(CandidateError, "INDEPENDENT_SHA256_MISMATCH"):
            compare(ref, erp, independent_sha256="0" * 64)

    def test_wrong_schema_or_missing_trailing_source_column_fails(self):
        ref, erp = build()
        broken = ref.replace(b"Sales_Qty", b"Sales_Xty")
        with self.assertRaisesRegex(CandidateError, "REFERENCE_SCHEMA_MISMATCH"):
            compare(broken, erp)
        ref_no_last = csvblob(
            [["2026 / 10 / 1"] + ["0.000"] * 42],
            header=list(EXPECTED_FIELDS),
        )
        with self.assertRaisesRegex(CandidateError, "REFERENCE_SCHEMA_MISMATCH"):
            compare(ref_no_last, erp)

    def test_candidate_requires_explicit_ack_and_traceable_scope(self):
        ref, erp = build()
        with self.assertRaisesRegex(CandidateError, "EXPLICIT_CANDIDATE"):
            compare(ref, erp, candidate_only_acknowledged=False)
        with self.assertRaisesRegex(CandidateError, "SCOPE_ATTESTATION"):
            compare(ref, erp, operator_scope_ref="")

    def test_dates_outside_same_scope_are_not_compared(self):
        ref, erp = build()
        with self.assertRaisesRegex(CandidateError, "ROW_OUTSIDE_ASSERTED_SCOPE"):
            compare(ref, erp, from_date="2026-11-01", to_date="2026-11-30")

    def test_invalid_scale_and_naive_comma_coercion_denied(self):
        ref, erp = build()
        malformed = ref.replace(b"0.250", b",0.250")
        with self.assertRaisesRegex(CandidateError, "INVALID_REFERENCE_SCALE"):
            compare(malformed, erp)
        self.assertEqual(len(CANDIDATES), 4)

    def test_public_safe_cli_result_does_not_echo_amounts_or_items(self):
        ref, erp = build()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            f1, f2 = root / "ref.csv", root / "candidate.csv"
            f1.write_bytes(ref)
            f2.write_bytes(erp)
            source = Path(__file__).with_name("compare_owner_daily_erp_candidates.py")
            args = [
                sys.executable, str(source),
                "--reference-csv", str(f1),
                "--independent-erp-csv", str(f2),
                "--reference-sha256", hashlib.sha256(ref).hexdigest(),
                "--independent-sha256", hashlib.sha256(erp).hexdigest(),
                "--from-date", "2026-10-01", "--to-date", "2026-10-31",
                "--operator-scope-ref", "TEST-CANDIDATE-001",
                "--acknowledge-candidate-only",
            ]
            p = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, p.stderr + p.stdout)
            self.assertEqual(json.loads(p.stdout)["result"], "CANDIDATE_FIELD_CHECK_ONLY")
            self.assertNotIn("A001", p.stdout)
            self.assertNotIn("0.250", p.stdout)
            p2 = subprocess.run(args[:-1], capture_output=True, text=True)
            self.assertEqual(p2.returncode, 2)


if __name__ == "__main__":
    unittest.main()
