#!/usr/bin/env python3
"""Offline read-only HTML reference viewer for an owner-uploaded monthly CSV.

This is not a replacement for TrustSoft ERP query output or financial parity.
Financial figures remain inside the generated PRIVATE file, not CI logs.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import os
import re
import sys
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

SHA256 = re.compile(r"^[0-9a-f]{64}$")
IDENT = re.compile(r"^[A-Za-z0-9._:-]{1,120}$")
LEGACY_DATE = re.compile(r"^\s*(\d{4})\s*/\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")
CANON_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SUM_FIELDS = (
    "Net_Sales_Before_Tax", "Net_Sales_After_Tax",
    "Net_Purchase_Before_Tax", "Net_Purchase_After_Tax",
    "Net_Sales_Cost", "Net_Profit", "Sales_Qty",
)
DISPLAY_FIELDS = (
    "MonthYear", "ItemCode", "Item_Name", "Net_Sales_Before_Tax",
    "Net_Sales_After_Tax", "Net_Sales_Cost", "Net_Profit",
    "Sales_Qty", "Family_Code", "Supplier_Code",
)
EXPECTED_FIELDS = (
    "MonthYear", "ItemCode", "Item_Name", "Net_Sales_Before_Tax",
    "Net_Sales_After_Tax", "Net_Purchase_Before_Tax",
    "Net_Purchase_After_Tax", "Sales_Cost", "Net_Sales_Cost", "Net_Profit",
    "Profit_Markup_Per", "Net_Profit_Markup_Per", "Net_Profit_Margin_Per",
    "Profit_Margin_Per", "Sales_Qty", "Receipt_Qty", "Receipt_Value",
    "Withdrawals_Qty", "Withdrawals_Value", "Stock_Net_Qty",
    "Stock_Net_Value", "Total_Damage_Qty", "Total_Damage_Cost",
    "Damage_from_Sales_Before_Tax_Per", "Damage_from_Net_Profit_Per",
    "Damage_from_Sales_Cost_Per", "Dept_Withdrawals_Qty",
    "Dept_Withdrawals_Cost", "Net_Purchase_Qty", "Cost_Damage",
    "Qty_Damage", "Cost_Installation Damage", "Qty_Installation Damage",
    "Cost_Maintenance Damage", "Qty_Maintenance Damage",
    "Family_Code", "Family_Desc", "Supplier_Code", "Supplier_Desc",
    "Class_Desc", "Type_Desc", "Country_Desc", "Volume_Desc",
)


class ScreenError(ValueError):
    pass


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def iso_day(value: str) -> date:
    m = LEGACY_DATE.fullmatch(value)
    try:
        if m:
            return date(*(int(n) for n in m.groups()))
        if CANON_DATE.fullmatch(value):
            return date.fromisoformat(value)
    except ValueError as exc:
        raise ScreenError("INVALID_DATE_CELL") from exc
    raise ScreenError("INVALID_DATE_CELL")


def parse_sum(value: str) -> Decimal:
    if not isinstance(value, str) or not re.fullmatch(r"-?\d+(?:\.\d{1,6})?", value):
        raise ScreenError("INVALID_SELECTED_NUMERIC_FIELD")
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise ScreenError("INVALID_SELECTED_NUMERIC_FIELD") from exc
    if not amount.is_finite():
        raise ScreenError("INVALID_SELECTED_NUMERIC_FIELD")
    return amount


def escape(value: object) -> str:
    return html.escape(str(value), quote=True)


def safe_key(value: str, name: str) -> str:
    if not isinstance(value, str) or not IDENT.fullmatch(value):
        raise ScreenError("INVALID_" + name)
    return value


def render(source: Path, output: Path, *, expected_sha256: str,
           tenant: str, branch: str, capture_ref: str,
           start: str, end: str, item: str = "", supplier: str = "",
           family: str = "", max_visible: int = 120,
           private_output_attested: bool = False) -> dict:
    if private_output_attested is not True:
        raise ScreenError("PRIVATE_OUTPUT_ATTESTATION_REQUIRED")
    if not isinstance(expected_sha256, str) or not SHA256.fullmatch(expected_sha256):
        raise ScreenError("SOURCE_SHA256_REQUIRED")
    for label, value in (("TENANT", tenant), ("BRANCH", branch),
                         ("CAPTURE_REF", capture_ref)):
        safe_key(value, label)
    for label, value in (("ITEM", item), ("SUPPLIER", supplier), ("FAMILY", family)):
        if value:
            safe_key(value, label)
    try:
        first, last = date.fromisoformat(start), date.fromisoformat(end)
    except (ValueError, TypeError) as exc:
        raise ScreenError("INVALID_FILTER_DATE") from exc
    if first > last:
        raise ScreenError("REVERSED_DATE_RANGE")
    if type(max_visible) is not int or not 1 <= max_visible <= 1000:
        raise ScreenError("INVALID_VISIBLE_PAGE_SIZE")
    if source.resolve(strict=True) == output.resolve(strict=False):
        raise ScreenError("CANNOT_REPLACE_SOURCE")
    if source.suffix.lower() != ".csv" or output.suffix.lower() != ".html":
        raise ScreenError("PRIVATE_CSV_SOURCE_AND_HTML_OUTPUT_REQUIRED")
    if output.exists() or output.is_symlink():
        raise ScreenError("REFUSE_REPLACE_EVIDENCE")
    if file_hash(source) != expected_sha256:
        raise ScreenError("SOURCE_SHA256_MISMATCH")

    totals = {column: Decimal(0) for column in SUM_FIELDS}
    selected = visible = source_count = 0
    parts = []
    with source.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle, strict=True)
        header = next(reader, None)
        if (header is None or len(header) != 44 or header[-1] != "" or
                tuple(x[1:-1] if x.startswith("[") and x.endswith("]") else x
                      for x in header[:-1]) != EXPECTED_FIELDS):
            raise ScreenError("UNKNOWN_OWNER_REPORT_CSV_SCHEMA")
        for raw in reader:
            source_count += 1
            if len(raw) != 44 or raw[-1] != "":
                raise ScreenError("SOURCE_DATA_WIDTH_DRIFT")
            row = dict(zip(EXPECTED_FIELDS, raw[:-1]))
            day = iso_day(row["MonthYear"])
            if not first <= day <= last:
                continue
            if item and row["ItemCode"] != item:
                continue
            if supplier and row["Supplier_Code"] != supplier:
                continue
            if family and row["Family_Code"] != family:
                continue
            selected += 1
            for field in SUM_FIELDS:
                totals[field] += parse_sum(row[field])
            if visible < max_visible:
                cells = "".join("<td>" + escape(row[f]) + "</td>" for f in DISPLAY_FIELDS)
                details = "".join(
                    "<dt>" + escape(key) + "</dt><dd>" + escape(row[key]) + "</dd>"
                    for key in EXPECTED_FIELDS
                )
                parts.append(
                    "<tr>" + cells + "<td><details><summary>الحقول الـ43</summary>"
                    + "<dl>" + details + "</dl></details></td></tr>"
                )
                visible += 1

    cards = "".join(
        "<article class='metric'><span>" + escape(k) + "</span>"
        "<strong dir='ltr'>" + escape(format(v, "f")) + "</strong></article>"
        for k, v in totals.items()
    )
    headings = "".join("<th>" + escape(key) + "</th>" for key in DISPLAY_FIELDS)
    rows_html = "".join(parts) if parts else (
        '<tr><td colspan="11">لا توجد نتائج ضمن المرشحات</td></tr>'
    )
    filters = ("الفترة: " + escape(start) + " إلى " + escape(end)
               + " | الصنف: " + escape(item or "الكل")
               + " | المورد: " + escape(supplier or "الكل")
               + " | العائلة: " + escape(family or "الكل"))
    page = (
        '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;; object-src &#39;none&#39;">'
        '<meta name="referrer" content="no-referrer">'
        '<title>JAWAFA ERP AI — الحركات الشهرية (مرجع مالك)</title>'
        '<style>body{font-family:system-ui,Tahoma,Arial,sans-serif;background:#f7f8fa;color:#182433;margin:0}'
        'main{max-width:1450px;margin:auto;padding:18px}'
        '.warning{background:#fff0d3;border-right:4px solid #d59627;padding:13px;margin:16px 0}'
        '.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}'
        '.metric{background:white;border:1px solid #d5dce7;border-radius:10px;padding:12px;display:grid;gap:7px}'
        '.metric strong{font-size:1.3rem;overflow-wrap:anywhere}'
        '.scroll{overflow-x:auto;border:1px solid #d5dce7;background:white}'
        'table{border-collapse:collapse;width:100%;font-size:13px}'
        'th,td{white-space:nowrap;padding:9px;border-bottom:1px solid #e0e5ee;text-align:right}'
        'th{background:#eef2f8}dl{white-space:normal;display:grid;grid-template-columns:1fr 2fr;gap:5px}'
        'dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}'
        '@media print{body{background:white}details{display:none}.scroll{overflow:visible}}</style>'
        '</head><body><main><h1>الحركات الشهرية — شاشة قراءة فقط</h1>'
        '<p>JAWAFA ERP AI | نطاق الملف: ' + escape(tenant) + ' / ' + escape(branch)
        + ' | مرجع الالتقاط: ' + escape(capture_ref) + '</p>'
        '<p class="warning">تقرير مرجعي تجريبي من ملف المالك، وليس مخرج محرك ERP أو إثبات تطابق TrustSoft.'
        ' المجاميع هي جمع مباشر لحقول المصدر دون تعديل أو إعادة تفسير؛ احتفظ بالملف في مكان خاص.</p>'
        '<p>' + filters + '</p>'
        '<p>صفوف المصدر: <strong>' + str(source_count) +
        '</strong> | الصفوف المطابقة: <strong>' + str(selected) +
        '</strong> | المعروضة: <strong>' + str(visible) + '</strong></p>'
        '<section class="metrics">' + cards + '</section>'
        '<h2>تفاصيل التقرير (كل صف يحتفظ بـ43 حقلًا)</h2>'
        '<div class="scroll"><table><thead><tr>' + headings +
        '<th>الحقول كاملة</th></tr></thead><tbody>' + rows_html +
        '</tbody></table></div><footer><p>SHA256: ' + escape(expected_sha256) +
        ' — هذه معاينة محلية فقط. التطابق الوظيفي والصلاحيات الإنتاجية غير مثبتة.</p>'
        '</footer></main></body></html>'
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(output), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(page)
    except Exception:
        output.unlink(missing_ok=True)
        raise
    return {
        "result": "PRIVATE_REFERENCE_SCREEN_CREATED_NOT_ERP_PARITY",
        "source_rows": source_count, "selected_rows": selected,
        "visible_rows": visible, "source_sha256": expected_sha256,
        "report_schema_named_fields": len(EXPECTED_FIELDS),
        "totals_recorded_in_private_html_only": True,
        "trustsoft_parity_percent": None, "production_accepted": False,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--source-csv", type=Path, required=True)
    p.add_argument("--expected-source-sha256", required=True)
    p.add_argument("--output-html", type=Path, required=True)
    p.add_argument("--tenant", required=True)
    p.add_argument("--branch", required=True)
    p.add_argument("--capture-ref", required=True)
    p.add_argument("--from-date", required=True)
    p.add_argument("--to-date", required=True)
    p.add_argument("--item-code", default="")
    p.add_argument("--supplier-code", default="")
    p.add_argument("--family-code", default="")
    p.add_argument("--max-visible", type=int, default=120)
    p.add_argument("--attest-private-output", action="store_true")
    a = p.parse_args()
    try:
        result = render(
            a.source_csv, a.output_html, expected_sha256=a.expected_source_sha256,
            tenant=a.tenant, branch=a.branch, capture_ref=a.capture_ref,
            start=a.from_date, end=a.to_date, item=a.item_code,
            supplier=a.supplier_code, family=a.family_code,
            max_visible=a.max_visible, private_output_attested=a.attest_private_output,
        )
    except (OSError, ValueError, UnicodeError, csv.Error) as exc:
        print(json.dumps({"result": "REFERENCE_SCREEN_BLOCKED", "error": str(exc)}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
