#!/usr/bin/env python3
"""Read-only offline verification of Jawafa CSV export integrity and cheque links.

No SQL access, no mutation of exports, and no raw cheque identifiers in reports.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from collections import Counter

FILES = {
    "documents": "dbo.ARPDocuments.csv",
    "masters": "dbo.ARPPayMaster.csv",
    "movements": "dbo.CheqMovement.csv",
}

def rows(path):
    with path.open("r", newline="", encoding="utf-8-sig") as stream:
        yield from csv.DictReader(stream)

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def verify_manifest(root):
    manifest = root / "manifest_sha256.csv"
    if not manifest.is_file():
        return {"status": "missing_manifest", "checked": 0, "matched": 0}
    totals = Counter()
    for item in rows(manifest):
        totals["checked"] += 1
        name = item.get("file", "")
        if not name or Path(name).name != name or "/" in name or "\\" in name:
            totals["invalid_path"] += 1
            continue
        file = root / "data" / name
        if not file.is_file() or file.is_symlink():
            totals["missing"] += 1
            continue
        try:
            expected_size = int(item["bytes"])
        except (ValueError, KeyError):
            totals["size_mismatched"] += 1
            continue
        if file.stat().st_size != expected_size:
            totals["size_mismatched"] += 1
        elif digest(file).casefold() != item.get("sha256", "").casefold():
            totals["hash_mismatched"] += 1
        else:
            totals["matched"] += 1
    return dict(status="complete" if totals["checked"] and totals["matched"] == totals["checked"] else "incomplete", **totals)

def analyze(root):
    for name in FILES.values():
        if not (root / "data" / name).is_file():
            raise FileNotFoundError("Missing approved export: " + name)
    documents = list(rows(root / "data" / FILES["documents"]))
    masters = list(rows(root / "data" / FILES["masters"]))
    movements = list(rows(root / "data" / FILES["movements"]))
    cheque_keys = [r["CheqId"].strip() for r in documents]
    voucher_keys = [r["TransNo"].strip() for r in masters]
    cheque_set, voucher_set = set(cheque_keys), set(voucher_keys)
    doc_vouchers = set(r["TransNo"].strip() for r in documents)
    exceptions = [r for r in movements if r["CheqId"].strip() not in cheque_set]
    return {
        "classification": "OFFLINE_EXPORT_ONLY_NOT_PRODUCTION_ACCEPTANCE",
        "manifest": verify_manifest(root),
        "counts": {"documents": len(documents), "voucher_masters": len(masters), "cheque_movements": len(movements)},
        "keys": {"duplicate_cheque_ids": len(cheque_keys) - len(cheque_set),
                 "duplicate_voucher_master_ids": len(voucher_keys) - len(voucher_set)},
        "links": {
            "documents_without_voucher_master": sum(r["TransNo"].strip() not in voucher_set for r in documents),
            "voucher_masters_without_cheque_document": sum(r["TransNo"].strip() not in doc_vouchers for r in masters),
            "movements_without_current_cheque_document": len(exceptions),
            "distinct_missing_cheque_ids": len(set(r["CheqId"].strip() for r in exceptions)),
        },
        "exception_statuses": dict(sorted(Counter(str(r.get("statusE") or "UNKNOWN").strip() for r in exceptions).items())),
        "exception_years": dict(sorted(Counter(r.get("MoveDate", "")[:4] or "UNKNOWN" for r in exceptions).items())),
        "limitations": [
            "Missing current cheque document does not prove deletion or fraud.",
            "Voucher masters may represent non-cheque payment methods.",
            "Offline CSV joins do not establish live SQL constraints or bank clearance.",
            "Require original bank evidence and source history before attribution.",
        ],
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export_directory", type=Path)
    parser.add_argument("--output", type=Path, help="Optional report path outside original export directory")
    args = parser.parse_args()
    root = args.export_directory.resolve()
    report = json.dumps(analyze(root), ensure_ascii=False, indent=2) + "\n"
    if args.output:
        target = args.output.resolve()
        if target == root or root in target.parents:
            parser.error("Refusing to write inside original export directory")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(report, encoding="utf-8")
        print("Written:", target)
    else:
        print(report, end="")

if __name__ == "__main__":
    main()
