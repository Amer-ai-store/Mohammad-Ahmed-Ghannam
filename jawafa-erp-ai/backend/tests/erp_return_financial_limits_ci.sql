-- Disposable PostgreSQL CI ONLY; never Jawafa_DB or production financial rows.
-- Separate cap for original quantity, pre-tax amount, tax and sales cost.
-- All numbers are synthetic integer fils/milli.
BEGIN;
DO $limits$
DECLARE
  tenant uuid := '11111111-1111-4111-8111-111111111111';
  branch text := 'BR-A';
  mode text;
  origin text;
  rejected boolean;
  extra_amount bigint;
  extra_tax bigint;
  extra_cost bigint;
  n integer;
  qty numeric;
  amount numeric;
  tax numeric;
  cost numeric;
BEGIN
  FOR mode IN SELECT unnest(ARRAY['AMOUNT','TAX','COST']) LOOP
    origin := 'SYN-ORIGINAL-LIMIT-' || mode;
    INSERT INTO erp.item_movement_events
      (tenant_id,branch_id,event_id,event_date,item_code,family_code,
       supplier_code,movement_kind,posting_status,quantity_milli,
       net_amount_fils,tax_fils,cost_fils)
    VALUES
      (tenant,branch,origin,date '2026-10-01',
       'SYN-LIMIT-ITEM','SYN-LIMIT-FAMILY','SYN-LIMIT-SUP',
       'sale','POSTED',1000,1000,100,700);

    -- A legitimate first partial return: 200 of 1000, 200 of 1000,
    -- 20 of 100, 140 of 700.
    INSERT INTO erp.item_movement_events
      (tenant_id,branch_id,event_id,event_date,item_code,family_code,
       supplier_code,movement_kind,posting_status,quantity_milli,
       net_amount_fils,tax_fils,cost_fils,reference_event_id)
    VALUES
      (tenant,branch,'SYN-FIRST-RETURN-'||mode,date '2026-10-02',
       'SYN-LIMIT-ITEM','SYN-LIMIT-FAMILY','SYN-LIMIT-SUP',
       'sale_return','POSTED',200,200,20,140,origin);

    -- Each second attempt is individually <= original in ALL fields,
    -- has quantity <= remaining, but exceeds the source aggregate by 1.
    extra_amount := CASE WHEN mode='AMOUNT' THEN 801 ELSE 100 END;
    extra_tax := CASE WHEN mode='TAX' THEN 81 ELSE 10 END;
    extra_cost := CASE WHEN mode='COST' THEN 561 ELSE 70 END;
    rejected := false;
    BEGIN
      INSERT INTO erp.item_movement_events
        (tenant_id,branch_id,event_id,event_date,item_code,family_code,
         supplier_code,movement_kind,posting_status,quantity_milli,
         net_amount_fils,tax_fils,cost_fils,reference_event_id)
      VALUES
        (tenant,branch,'SYN-BAD-CUMULATIVE-'||mode,date '2026-10-03',
         'SYN-LIMIT-ITEM','SYN-LIMIT-FAMILY','SYN-LIMIT-SUP',
         'sale_return','POSTED',100,extra_amount,extra_tax,extra_cost,origin);
    EXCEPTION WHEN check_violation THEN
      rejected := true;
    END;
    IF NOT rejected THEN
      RAISE EXCEPTION 'CUMULATIVE_%_FINANCIAL_CAP_WAS_NOT_ENFORCED', mode;
    END IF;

    -- Independent single-return cap, unaffected by prior count.
    extra_amount := CASE WHEN mode='AMOUNT' THEN 1001 ELSE 100 END;
    extra_tax := CASE WHEN mode='TAX' THEN 101 ELSE 10 END;
    extra_cost := CASE WHEN mode='COST' THEN 701 ELSE 70 END;
    rejected := false;
    BEGIN
      INSERT INTO erp.item_movement_events
        (tenant_id,branch_id,event_id,event_date,item_code,family_code,
         supplier_code,movement_kind,posting_status,quantity_milli,
         net_amount_fils,tax_fils,cost_fils,reference_event_id)
      VALUES
        (tenant,branch,'SYN-BAD-SINGLE-'||mode,date '2026-10-03',
         'SYN-LIMIT-ITEM','SYN-LIMIT-FAMILY','SYN-LIMIT-SUP',
         'sale_return','POSTED',100,extra_amount,extra_tax,extra_cost,origin);
    EXCEPTION WHEN check_violation THEN
      rejected := true;
    END;
    IF NOT rejected THEN
      RAISE EXCEPTION 'SINGLE_%_FINANCIAL_CAP_WAS_NOT_ENFORCED', mode;
    END IF;

    -- Exact readback: only the legitimate first refund survives.
    SELECT count(*),sum(quantity_milli),sum(net_amount_fils),
           sum(tax_fils),sum(cost_fils)
      INTO n,qty,amount,tax,cost
      FROM erp.item_movement_events
     WHERE tenant_id=tenant AND branch_id=branch
       AND reference_event_id=origin AND posting_status='POSTED';
    IF n <> 1 OR qty <> 200 OR amount <> 200 OR tax <> 20 OR cost <> 140 THEN
      RAISE EXCEPTION 'FINANCIAL_CAP_SOURCE_READBACK_FAILED_%', mode;
    END IF;
  END LOOP;
END
$limits$;
ROLLBACK;
