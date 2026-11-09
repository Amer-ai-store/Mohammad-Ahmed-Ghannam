#!/usr/bin/env python3
"""Read-only, header-only reference schema explorer for the NEW ERP.

This tool intentionally reads only CSV inventory rows (counts, not financial
records) and the FIRST CSV HEADER row of approved TrustSoft export files.
It does not connect to SQL, read data rows, infer foreign keys as proven, or
mutate original source files. Its JSON output is source-schema evidence only.
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

# Explicit candidate joins, selected from approved reference HEADER observations.
# Each result is DISCOVERED, NEVER functionally matched or SQL-FK validated.
CANDIDATE_JOINS = (
    ("accounting", "dbo.Journal_GL", "JournalNo", "dbo.From_gl", "JournalNo"),
    ("accounting", "dbo.Journal_GL", "JournalNo", "dbo.To_GL", "JournalNo"),
    ("cheques", "dbo.ARPDocuments", "CheqId", "dbo.CheqMovement", "CheqId"),
    ("procurement_inventory", "dbo.Items", "FamCode", "dbo.Families", "FamCode"),
    ("procurement_inventory", "dbo.Receipt", "RecNo",
     "dbo.InvPurchaseVouchersTransactionHistory", "ReceiptNo"),
    ("sales", "dbo.InvoiceSales", "InvoiceNo",
     "dbo.ItemLineInvoSales", "InvoiceNo"),
    ("sales", "dbo.InvoiceSales", "Invoice_Journal_No",
     "dbo.Journal_GL", "JournalNo"),
    ("reports", "dbo.List_Report", "ReportNo",
     "dbo.Report_Condition", "ReportNo"),
    ("personnel", "dbo.EmpPersonal", "EmpId",
     "dbo.EmpSalaryCalculation", "EmpId"),
    ("personnel", "dbo.EmpPersonal", "EmpId",
     "dbo.EmpHistory", "EmpId"),
    ("security", "dbo.USER", "Uno",
     "dbo.UserVouchersBranches", "UserNo"),
)

MODULE_TABLES = {
    "accounting": ("dbo.Journal_GL", "dbo.From_gl", "dbo.To_GL"),
    "cheques": ("dbo.ARPDocuments", "dbo.CheqMovement"),
    "procurement_inventory": (
        "dbo.Items", "dbo.Families", "dbo.Receipt",
        "dbo.InvPurchaseVouchersTransactionHistory",
    ),
    "sales": ("dbo.InvoiceSales", "dbo.ItemLineInvoSales"),
    "reports": ("dbo.List_Report", "dbo.Report_Condition"),
    "personnel": ("dbo.EmpPersonal", "dbo.EmpSalaryCalculation", "dbo.EmpHistory"),
    "security": ("dbo.USER", "dbo.UserVouchersBranches"),
}


class InvalidReferenceExport(ValueError):
    pass


def read_inventory(path: Path) -> dict[str, dict[str, str]]:
    """Read table inventory metadata, never other exported source content."""
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None or not {"schema", "table"}.issubset(
            reader.fieldnames
        ):
            raise InvalidReferenceExport("INVENTORY_SCHEMA_TABLE_HEADERS_REQUIRED")
        result = {}
        for row in reader:
            schema = (row.get("schema") or "").strip()
            table = (row.get("table") or "").strip()
            if not schema or not table or "/" in schema + table or "\\" in schema + table:
                raise InvalidReferenceExport("INVALID_INVENTORY_TABLE_IDENTIFIER")
            key = f"{schema}.{table}"
            if key in result:
                raise InvalidReferenceExport("DUPLICATE_INVENTORY_IDENTIFIER")
            # No data rows or financial amounts are read here.
            result[key] = {
                "rows": row.get("rows", ""),
                "cols": row.get("cols", ""),
            }
    return result


def read_header(data_dir: Path, table: str) -> tuple[str, ...] | None:
    # The audited table name is fixed in source code; no client-controlled path.
    filename = data_dir / f"{table}.csv"
    if not filename.is_file():
        return None
    with filename.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream)
        try:
            header = next(reader)
        except StopIteration:
            return tuple()
    return tuple(header)  # The file's remaining rows are NEVER accessed.


def evaluate(inventory: Path, data_dir: Path) -> dict:
    listing = read_inventory(inventory)
    tables = sorted({table for group in MODULE_TABLES.values() for table in group})
    observations = {}
    for table in tables:
        header = read_header(data_dir, table)
        declared = listing.get(table)
        observations[table] = {
            "in_inventory": declared is not None,
            "csv_header_present": header is not None,
            "header_field_count": len(header) if header is not None else None,
            "inventory_export_rows": declared["rows"] if declared else None,
            # Field names may be used for schema comparison, NOT row values.
            "fields": sorted(set(header)) if header is not None else [],
        }
    joins = []
    for module, from_table, from_column, to_table, to_column in CANDIDATE_JOINS:
        left = observations[from_table]["fields"]
        right = observations[to_table]["fields"]
        found = from_column in left and to_column in right
        joins.append({
            "module": module,
            "from_table": from_table,
            "from_column": from_column,
            "to_table": to_table,
            "to_column": to_column,
            "column_pair_present": found,
            "status": "DISCOVERED" if found else "MISSING_HEADER_EVIDENCE",
            "foreign_key_verified": False,
            "functional_parity_verified": False,
        })
    return {
        "schema_version": 1,
        "data_policy": "EXPORTED_INVENTORY_AND_CSV_HEADERS_ONLY",
        "read_only": True,
        "inventory_table_count": len(listing),
        "selected_table_count": len(tables),
        "source_table_metadata": observations,
        "candidate_joins": joins,
        "verified_foreign_key_count": 0,
        "trustsoft_functional_parity_percent": None,
        "warning": (
            "Column name correspondence is not SQL FK proof; "
            "no source records, role rights, report definitions or "
            "reference UI behavior were validated."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        result = evaluate(args.inventory, args.data_dir)
    except (OSError, UnicodeError, csv.Error, InvalidReferenceExport) as error:
        print(json.dumps({"status": "INVALID_EXPORT", "error": str(error)}))
        return 2
    if args.output:
        args.output.write_text(
            json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
        )
    print(json.dumps({
        "status": "HEADER_ONLY_AUDIT",
        "tables_in_inventory": result["inventory_table_count"],
        "selected_reference_tables": result["selected_table_count"],
        "column_pairs_present": sum(
            relation["column_pair_present"] for relation in result["candidate_joins"]
        ),
        "foreign_keys_verified": 0,
        "trustsoft_parity": "UNMEASURED",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
