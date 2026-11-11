#!/usr/bin/env python3
"""Real concurrent PostgreSQL test on disposable NEW-ERP CI database only.

Verifies that two independent transactions cannot both post a partial return
whose SUM exceeds the original sale quantity, amount, tax or cost. All records are synthetic.
NEVER run on Jawafa_DB, TrustSoft, or a non-disposable database.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

SAFE_DATABASES = {"jawafa_erp_ci", "jawafa_erp_api_ci"}
TENANT = "11111111-1111-4111-8111-111111111111"
BRANCH = "BR-RACE"


def require_isolated_test_host() -> None:
    if os.environ.get("PGDATABASE") not in SAFE_DATABASES:
        raise RuntimeError("DISPOSABLE_ERP_CI_DATABASE_REQUIRED")
    if os.environ.get("PGHOST") not in ("localhost", "127.0.0.1"):
        raise RuntimeError("LOCAL_POSTGRES_ONLY")
    if os.environ.get("PGUSER") != "postgres":
        raise RuntimeError("SYNTHETIC_CI_ADMIN_ONLY")
    if os.environ.get("ERP_ALLOW_RETURN_RACE_CI") != "1":
        raise RuntimeError("EXPLICIT_SYNTHETIC_RACE_TEST_OPT_IN_REQUIRED")


def psql(sql: str, *, timeout: float = 15) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        input=sql, text=True, capture_output=True, timeout=timeout, check=False,
    )


def must_succeed(result: subprocess.CompletedProcess, label: str) -> str:
    if result.returncode != 0:
        # Never echo raw SQL inputs or financial event payloads.
        raise RuntimeError(label + "_SQL_FAILURE")
    return result.stdout.strip()


def return_insert(event_id: str, origin: str, *, quantity: int,
                  amount: int, tax: int, cost: int) -> str:
    return f"""INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,family_code,
        supplier_code,movement_kind,posting_status,quantity_milli,
        net_amount_fils,tax_fils,cost_fils,reference_event_id)
      VALUES
       ('{TENANT}','{BRANCH}','{event_id}',date '2026-10-09',
        'SYNTH-RACE-ITEM','SYNTH-RACE-FAMILY','SYNTH-RACE-SUP',
        'sale_return','POSTED',{quantity},{amount},{tax},{cost},'{origin}');"""


def run_race(round_number: int, dimension: str) -> None:
    origin = f"RACE-ORIGINAL-{round_number}-{dimension}"
    if dimension not in ("QUANTITY", "AMOUNT", "TAX", "COST"):
        raise RuntimeError("UNKNOWN_SYNTHETIC_DIMENSION")
    quantity = 600 if dimension == "QUANTITY" else 300
    amount = 600 if dimension == "AMOUNT" else 300
    tax = 60 if dimension == "TAX" else 10
    cost = 400 if dimension == "COST" else 200
    rejected_code = ("CUMULATIVE_RETURN_EXCEEDS_SOURCE_QUANTITY"
                     if dimension == "QUANTITY"
                     else "CUMULATIVE_RETURN_EXCEEDS_SOURCE_FINANCIAL_LIMIT")
    setup = f"""INSERT INTO erp.item_movement_events
      (tenant_id,branch_id,event_id,event_date,item_code,family_code,
       supplier_code,movement_kind,posting_status,quantity_milli,
       net_amount_fils,tax_fils,cost_fils)
    VALUES
      ('{TENANT}','{BRANCH}','{origin}',date '2026-10-08',
       'SYNTH-RACE-ITEM','SYNTH-RACE-FAMILY','SYNTH-RACE-SUP',
       'sale','POSTED',1000,1000,100,700);"""
    must_succeed(psql(setup), "SYNTHETIC_ORIGIN")

    # First connection holds its transaction open after acquiring the return
    # origin lock. Second connection competes for the same original source.
    first_sql = (
        "BEGIN;\nSET LOCAL statement_timeout = '12000ms';\n"
        + return_insert(f"RACE-RETURN-{round_number}-{dimension}-A", origin,
                        quantity=quantity, amount=amount, tax=tax, cost=cost)
        + "\nSELECT pg_sleep(1.5);\nCOMMIT;\n"
    )
    second_sql = (
        "BEGIN;\nSET LOCAL statement_timeout = '12000ms';\n"
        + return_insert(f"RACE-RETURN-{round_number}-{dimension}-B", origin,
                        quantity=quantity, amount=amount, tax=tax, cost=cost)
        + "\nCOMMIT;\n"
    )

    first = subprocess.Popen(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True,
    )
    try:
        # Separate psql commands, not one SQL batch: each session is a genuine
        # transaction and the first lock is held until the delayed COMMIT.
        assert first.stdin is not None
        first.stdin.write(first_sql)
        first.stdin.close()
        first.stdin = None
        time.sleep(0.35)
        second = psql(second_sql, timeout=15)
        first_stdout, first_stderr = first.communicate(timeout=15)
    finally:
        if first.poll() is None:
            first.kill()
            first.communicate()

    statuses = sorted([first.returncode, second.returncode])
    if len(statuses) != 2 or statuses[0] != 0 or statuses[1] == 0:
        raise RuntimeError("CONCURRENT_OVERRETURN_WAS_NOT_REJECTED")
    rejected_text = second.stderr if second.returncode else first_stderr
    if rejected_code not in rejected_text:
        raise RuntimeError("UNEXPECTED_REJECTION_REQUIRES_REVIEW")

    status = must_succeed(psql(f"""SELECT count(*)::text || ':' ||
        coalesce(sum(quantity_milli),0)::text || ':' ||
        coalesce(sum(net_amount_fils),0)::text || ':' ||
        coalesce(sum(tax_fils),0)::text || ':' ||
        coalesce(sum(cost_fils),0)::text
        FROM erp.item_movement_events
        WHERE tenant_id='{TENANT}' AND branch_id='{BRANCH}'
          AND reference_event_id='{origin}' AND posting_status='POSTED';"""),
        "RACE_READBACK")
    expected = f"1:{quantity}:{amount}:{tax}:{cost}"
    if status != expected:
        raise RuntimeError("INVALID_CONCURRENT_COMMIT_READBACK")


def main() -> int:
    try:
        require_isolated_test_host()
        must_succeed(psql(f"""INSERT INTO erp.branches
          (tenant_id, branch_id, branch_label)
          VALUES ('{TENANT}','{BRANCH}','Synthetic Race Test Branch');"""),
          "RACE_BRANCH")
        for number in (1, 2):
            run_race(number, "QUANTITY")
        for dimension in ("AMOUNT", "TAX", "COST"):
            run_race(3, dimension)
        print("PASS: 5 isolated two-transaction races across quantity, amount, "
              "VAT and cost; one accepted, one rejected and exact count/qty/"
              "amount/tax/cost post-commit readback each")
        return 0
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        # Only error codes, not SQL rows/source contents.
        print("FAIL: " + type(exc).__name__ + " (" +
              (str(exc) if isinstance(exc, RuntimeError) else "PROCESS_ERROR") +
              ")", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
