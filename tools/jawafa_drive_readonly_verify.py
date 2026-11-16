#!/usr/bin/env python3
"""Private Drive V5 verification; never fetches SQL or publishes source rows.

Run only on an authorized private runner with GOOGLE_APPLICATION_CREDENTIALS
or Workload Identity Federation scoped to drive.readonly.
The verified object is a HYBRID historical export, not a consistent native backup.
"""
from __future__ import annotations

import io
import json
import os
import sys
import hashlib
import re
from datetime import datetime, timedelta, timezone

from jawafa_drive_v5_validator import parse_csv, validate_v5

FOLDER = os.environ.get("JAWAFA_DRIVE_FOLDER", "1X9MuorGVaaAwolc25_MG4kgKQGPiWard")
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
FOLDER_MIME = "application/vnd.google-apps.folder"
RUN_PATTERN = re.compile(r"^([0-9]{8})-0100$")
# Descend known export paths only, never crawl arbitrary private Drive trees.
EXPORT_PARENT_NAMES = {"Exports", "hourly-v5", "Jawafa_DB_Exports"}


def client():
    import google.auth
    from googleapiclient.discovery import build

    creds, _ = google.auth.default(scopes=SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def children(api, folder: str):
    token = None
    while True:
        items = api.files().list(
            q="'%s' in parents and trashed = false" % folder.replace("'", "\\'"),
            fields="nextPageToken,files(id,name,mimeType,size)",
            pageSize=1000, pageToken=token,
            supportsAllDrives=True, includeItemsFromAllDrives=True,
        ).execute()
        yield from items.get("files", [])
        token = items.get("nextPageToken")
        if not token:
            break


def download_small(api, file_id: str) -> bytes:
    from googleapiclient.http import MediaIoBaseDownload

    out = io.BytesIO()
    loader = MediaIoBaseDownload(out, api.files().get_media(fileId=file_id, supportsAllDrives=True))
    done = False
    while not done:
        _, done = loader.next_chunk()
    return out.getvalue()


class DigestSink:
    """Streaming writer: never retains private CSV content in memory or CI logs."""

    def __init__(self):
        self._digest = hashlib.sha256()
        self.size = 0

    def write(self, part: bytes) -> int:
        self._digest.update(part)
        self.size += len(part)
        return len(part)

    @property
    def hexdigest(self) -> str:
        return self._digest.hexdigest()


def download_digest(api, file_id: str) -> dict:
    from googleapiclient.http import MediaIoBaseDownload

    sink = DigestSink()
    loader = MediaIoBaseDownload(sink, api.files().get_media(fileId=file_id, supportsAllDrives=True), chunksize=4 * 1024 * 1024)
    done = False
    while not done:
        _, done = loader.next_chunk()
    return {"sha256": sink.hexdigest, "size": str(sink.size)}


def expected_date_today_jordan() -> str:
    # Jordan has remained UTC+03; runner timezone must not affect daily gate.
    return datetime.now(timezone(timedelta(hours=3))).strftime("%Y%m%d")


def _valid_expected_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y%m%d")
        return len(value) == 8
    except ValueError:
        return False


def find_latest_run(api, root_id: str) -> dict:
    """Find dated run folders under the authorized Jawafa offsite hierarchy.

    An explicit JAWAFA_DRIVE_RUN_FOLDER may select a historic run; freshness
    remains required against JAWAFA_EXPECTED_RUN_DATE or today's Jordan date.
    """
    override = os.environ.get("JAWAFA_DRIVE_RUN_FOLDER")
    if override:
        entry = api.files().get(fileId=override, fields="id,name,mimeType", supportsAllDrives=True).execute()
        if entry.get("mimeType") != FOLDER_MIME or not RUN_PATTERN.fullmatch(entry.get("name", "")):
            raise ValueError("invalid_explicit_run_folder")
        return entry
    queue = [(root_id, 0)]
    checked = set()
    candidates = []
    while queue:
        folder_id, depth = queue.pop(0)
        if folder_id in checked:
            continue
        checked.add(folder_id)
        for child in children(api, folder_id):
            if child.get("mimeType") != FOLDER_MIME:
                continue
            name = child.get("name", "")
            if RUN_PATTERN.fullmatch(name):
                candidates.append(child)
            elif depth < 3 and (name in EXPORT_PARENT_NAMES or name.startswith("Jawafa_Forensic_Offsite_Copy_")):
                queue.append((child["id"], depth + 1))
    if not candidates:
        raise ValueError("no_dated_v5_run_folder")
    return max(candidates, key=lambda obj: obj["name"])


def index_files(items: list[dict]) -> dict[str, dict]:
    by_name = {}
    for item in items:
        name = item["name"]
        if name in by_name:
            raise ValueError("duplicate_drive_file_name")
        by_name[name] = item
    return by_name


def main() -> int:
    try:
        api = client()
        run = find_latest_run(api, FOLDER)
        expected_day = os.environ.get("JAWAFA_EXPECTED_RUN_DATE", expected_date_today_jordan())
        if not _valid_expected_date(expected_day):
            raise ValueError("invalid_expected_date")
        if run["name"] != expected_day + "-0100":
            raise ValueError("stale_or_missing_today_v5_export")
        root = index_files(list(children(api, run["id"])))
        if not all(k in root for k in ("inventory_tables.csv", "manifest_sha256.csv", "export_results.csv", "data")):
            raise ValueError("missing_required_run_files")
        if root["data"].get("mimeType") != FOLDER_MIME:
            raise ValueError("invalid_data_folder")
        inventory = parse_csv(download_small(api, root["inventory_tables.csv"]["id"]), ("schema", "table", "rows", "cols"), "inventory")
        manifest = parse_csv(download_small(api, root["manifest_sha256.csv"]["id"]), ("file", "bytes", "sha256"), "manifest")
        results = parse_csv(download_small(api, root["export_results.csv"]["id"]), ("table", "mode", "rows", "status"), "results")

        data_items = list(children(api, root["data"]["id"]))
        drive = []
        for entry in data_items:
            if entry.get("mimeType") == FOLDER_MIME:
                raise ValueError("nested_data_folder_not_expected")
            # Any unrecognized child file fails the set comparison; no silent skips.
            try:
                digest = download_digest(api, entry["id"])
                drive.append({"name": entry["name"], "size": digest["size"], "sha256": digest["sha256"]})
                if "size" in entry and str(entry["size"]) != digest["size"]:
                    raise ValueError("drive_metadata_size_mismatch")
            except Exception:
                raise RuntimeError("drive_file_download_or_hash_failed") from None
        report = validate_v5(inventory, results, manifest, drive)
        report["run_name"] = run["name"]
        report["expected_day"] = expected_day
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return 0 if report["verified"] else 2
    except Exception as exc:
        # Never include file contents, source records, tokens, URLs or stack traces.
        code = str(exc) if isinstance(exc, ValueError) else "drive_verification_error"
        print(json.dumps({"schema": "jawafa_v5_private_drive_verification_v2", "verified": False, "error_code": code}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
