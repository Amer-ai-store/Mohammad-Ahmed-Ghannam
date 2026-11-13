#!/usr/bin/env python3
"""Private, READ-ONLY inventory of TrustSoft report-template file metadata.

The input is a pre-existing authorized JSON file of relative paths, file sizes,
and content hashes. Never read the vendor template bytes, employee records,
accounting transactions or source SQL. Public console output contains counts
only; the optional private manifest preserves individual names on the host.
The output is NOT proof that a template is used by a TrustSoft UI report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path, PureWindowsPath

HEX64 = re.compile(r"^[a-f0-9]{64}$")
AREAS = {"account": "account_templates", "pos": "pos_templates"}


class InvalidTemplateManifest(ValueError):
    pass


def inspect_entry(entry: object) -> dict:
    if not isinstance(entry, dict):
        raise InvalidTemplateManifest("TEMPLATE_ENTRY_NOT_OBJECT")
    value = entry.get("relative_path")
    if not isinstance(value, str) or not value.strip():
        raise InvalidTemplateManifest("TEMPLATE_PATH_REQUIRED")
    # All incoming paths are intentionally Windows-relative, but this program
    # also executes on Linux GitHub runners with synthetic fixtures.
    path = PureWindowsPath(value)
    if (
        path.is_absolute()
        or path.root  # Rooted Windows path without a drive is also unsafe.
        or path.drive
        or len(path.parts) < 2
        or any(part in (".", "..") for part in path.parts)
        or "/" in value
        or path.suffix.lower() != ".rpt"
        or ":" in value
    ):
        raise InvalidTemplateManifest("UNSAFE_TEMPLATE_RELATIVE_PATH")
    filename = entry.get("file_name")
    if not isinstance(filename, str) or filename.casefold() != path.name.casefold():
        raise InvalidTemplateManifest("TEMPLATE_FILENAME_MISMATCH")
    size = entry.get("bytes")
    if type(size) is not int or size <= 0:
        raise InvalidTemplateManifest("INVALID_TEMPLATE_SIZE")
    digest = entry.get("sha256")
    if not isinstance(digest, str) or not HEX64.fullmatch(digest):
        raise InvalidTemplateManifest("INVALID_TEMPLATE_SHA256")
    canonical_path = str(path).casefold()
    source_area = path.parts[0].casefold()
    return {
        "candidate_id": "TMPL-" + hashlib.sha256(
            canonical_path.encode("utf-8")
        ).hexdigest()[:20].upper(),
        "relative_path": str(path),
        "bytes": size,
        "sha256": digest,
        "source_area": AREAS.get(source_area, "unclassified_templates"),
        "state": "DISCOVERED_TEMPLATE_ONLY",
        "trustsoft_screen_id": None,
        "trustsoft_menu_path": None,
        "verified_report_id": None,
        "parity_status": "UNMEASURED",
    }


def audit(manifest: dict) -> tuple[dict, dict]:
    if not isinstance(manifest, dict) or not isinstance(manifest.get("entries"), list):
        raise InvalidTemplateManifest("TEMPLATE_MANIFEST_ENTRIES_REQUIRED")
    entries = manifest["entries"]
    if not entries:
        raise InvalidTemplateManifest("EMPTY_TEMPLATE_INVENTORY")
    items = [inspect_entry(item) for item in entries]
    paths = [item["relative_path"].casefold() for item in items]
    if len(set(paths)) != len(paths):
        raise InvalidTemplateManifest("DUPLICATE_RELATIVE_TEMPLATE_PATH")
    hashes = defaultdict(list)
    for item in items:
        hashes[item["sha256"]].append(item["candidate_id"])
    repeated = [v for v in hashes.values() if len(v) > 1]
    summary = {
        "classification": "SOURCE_TEMPLATE_METADATA_ONLY",
        "candidate_template_files": len(items),
        "unique_template_paths": len(paths),
        "unique_file_contents": len(hashes),
        "duplicated_content_groups": len(repeated),
        "duplicate_extra_copies": sum(len(g) - 1 for g in repeated),
        "total_template_bytes": sum(item["bytes"] for item in items),
        "source_area_counts": dict(sorted(
            Counter(item["source_area"] for item in items).items()
        )),
        "verified_trustsoft_ui_report_count": None,
        "matched_report_count": 0,
        "reference_report_catalog_frozen": False,
        "owner_report_parity_percent": None,
        "notes": "File count is not a count of UI reports or matched reports.",
    }
    private = {
        "classification": "PRIVATE_OWNER_REFERENCE_METADATA",
        "source_files_mutated": False,
        "summary": summary,
        "templates": sorted(items, key=lambda item: item["candidate_id"]),
        "duplicate_content_groups": repeated,
    }
    return summary, private


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--private-output", type=Path)
    args = parser.parse_args()
    try:
        payload = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
        summary, private = audit(payload)
        if args.private_output:
            if args.private_output.resolve() == args.manifest.resolve():
                raise InvalidTemplateManifest("CANNOT_OVERWRITE_SOURCE_MANIFEST")
            if args.private_output.exists():
                raise InvalidTemplateManifest("REFUSE_OVERWRITE_PRIVATE_AUDIT")
            args.private_output.parent.mkdir(parents=True, exist_ok=True)
            args.private_output.write_text(
                json.dumps(private, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
    except (OSError, ValueError) as exc:
        print(json.dumps({"result": "INVALID_TEMPLATE_MANIFEST", "error": str(exc)}))
        return 2
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
