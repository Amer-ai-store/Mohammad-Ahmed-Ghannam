#!/usr/bin/env python3
"""Read-only CSV export inventory for JAWAFFASVR. Standard library only.
Prints aggregate metadata only. Never prints or uploads accounting records.
"""
import argparse, csv, datetime as dt, hashlib, json
from pathlib import Path

def inspect(root: Path):
    if not root.is_dir():
        raise SystemExit("Export directory does not exist")
    items = []
    for p in sorted(root.glob("*.csv")):
        try:
            with p.open("r", encoding="utf-8-sig", newline="") as f:
                reader = csv.reader(f)
                header = next(reader, [])
            items.append({"table": p.stem, "bytes": p.stat().st_size,
                          "columns": len(header),
                          "schema_sha256": hashlib.sha256(json.dumps(header, ensure_ascii=False).encode()).hexdigest(),
                          "empty": p.stat().st_size == 0})
        except (OSError, UnicodeError, csv.Error) as e:
            items.append({"table": p.stem, "error": type(e).__name__})
    return {"checked_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "source": "local_csv_export_snapshot", "live_sql_connected": False,
            "file_count": len(items), "files_with_errors": sum("error" in x for x in items),
            "zero_byte_files": sum(x.get("empty", False) for x in items),
            "tables": items}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, type=Path)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    data = inspect(args.source)
    output = json.dumps(data, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output, encoding="utf-8")
        print(json.dumps({k:v for k,v in data.items() if k != "tables"}, ensure_ascii=False))
    else:
        print(output)
