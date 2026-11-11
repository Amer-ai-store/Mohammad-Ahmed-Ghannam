-- Disposable CI PostgreSQL ONLY. Tests NEW ERP immutable event storage.
-- Never run this test or migration on Jawafa_DB or TrustSoft.
BEGIN;
DO $$
DECLARE
  blocked boolean;
  allowed_flag boolean;
  expected_count integer;
BEGIN
  SELECT count(*) INTO expected_count FROM erp.item_movement_events;
  IF expected_count <> 7 THEN
    RAISE EXCEPTION 'SYNTHETIC_EVENT_FIXTURES_MISSING';
  END IF;

  SELECT allowed INTO allowed_flag FROM erp.current_report_branch_access
    WHERE tenant_id='11111111-1111-4111-8111-111111111111'
      AND branch_id='BR-REVOKED' AND oidc_subject='member-A';
  IF allowed_flag IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'APPEND_ONLY_BRANCH_REVOCATION_NOT_APPLIED';
  END IF;
  SELECT allowed INTO allowed_flag FROM erp.current_report_branch_access
    WHERE tenant_id='11111111-1111-4111-8111-111111111111'
      AND branch_id='BR-A' AND oidc_subject='member-A';
  IF allowed_flag IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'APPROVED_BRANCH_GRANT_NOT_ACTIVE';
  END IF;

  SELECT count(*) INTO expected_count FROM pg_class
    WHERE relname IN ('item_movement_events','report_branch_access_events')
      AND relrowsecurity AND relforcerowsecurity;
  IF expected_count <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_AND_GRANT_RLS_MUST_BE_FORCED';
  END IF;

  IF has_table_privilege('erp_ci_api_login','erp.item_movement_events','INSERT')
     OR has_table_privilege('erp_ci_api_login','erp.item_movement_events','UPDATE')
     OR has_table_privilege('erp_ci_api_login','erp.item_movement_events','DELETE')
     OR has_table_privilege('erp_ci_api_login','erp.report_branch_access_events','INSERT')
     OR has_table_privilege('erp_ci_api_login','erp.report_branch_access_events','UPDATE')
     OR has_table_privilege('erp_ci_api_login','erp.report_branch_access_events','DELETE')
  THEN
    RAISE EXCEPTION 'READ_ONLY_ERP_API_HAS_WRITE_GRANT';
  END IF;

  blocked := false;
  BEGIN
    UPDATE erp.item_movement_events SET cost_fils=176
     WHERE tenant_id='11111111-1111-4111-8111-111111111111'
       AND branch_id='BR-A' AND event_id='EV-A-1';
  EXCEPTION WHEN raise_exception THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'EVENT_UPDATE_PROTECTION_MISSING';
  END IF;
  blocked := false;
  BEGIN
    DELETE FROM erp.item_movement_events
     WHERE tenant_id='11111111-1111-4111-8111-111111111111'
       AND branch_id='BR-A' AND event_id='EV-A-1';
  EXCEPTION WHEN raise_exception THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'EVENT_DELETE_PROTECTION_MISSING';
  END IF;

  blocked := false;
  BEGIN
    UPDATE erp.report_branch_access_events SET access_action='grant'
     WHERE access_event_id='70000000-0000-4000-8000-000000000006';
  EXCEPTION WHEN raise_exception THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'REVOCATION_IMMUTABILITY_MISSING';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','EV-A-1',
        date '2026-10-01','SKU-A','FAM-A','SUP-A',
        'sale','POSTED',1000,250,40,175);
  EXCEPTION WHEN unique_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'DUPLICATE_EVENT_ID_WAS_ACCEPTED';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils,reference_event_id)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','BAD-FOREIGN-RETURN',
        date '2026-10-02','SKU-A','FAM-A','SUP-A',
        'sale_return','POSTED',100,25,4,15,'EV-B-1');
  EXCEPTION WHEN foreign_key_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'CROSS_TENANT_RETURN_REFERENCE_ACCEPTED';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','BAD-QTY',
        date '2026-10-02','SKU-A','FAM-A','SUP-A',
        'sale','POSTED',0,25,4,15);
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'ZERO_QUANTITY_EVENT_ACCEPTED';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils,reference_event_id)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','BAD-MISMATCH_KIND',
        date '2026-10-02','SKU-A','FAM-A','SUP-A',
        'purchase_return','POSTED',100,25,4,0,'EV-A-1');
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'RETURN_MISMATCH_KIND_SHOULD_BE_BLOCKED';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils,reference_event_id)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','BAD-MISMATCH_ITEM',
        date '2026-10-02','OTHER-SKU','FAM-A','SUP-A',
        'sale_return','POSTED',100,25,4,15,'EV-A-1');
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'RETURN_MISMATCH_ITEM_SHOULD_BE_BLOCKED';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils,reference_event_id)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','BAD-MISMATCH_FAMILY',
        date '2026-10-02','SKU-A','OTHER-FAMILY','SUP-A',
        'sale_return','POSTED',100,25,4,15,'EV-A-1');
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'RETURN_MISMATCH_FAMILY_SHOULD_BE_BLOCKED';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils,reference_event_id)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','BAD-MISMATCH_SUPPLIER',
        date '2026-10-02','SKU-A','FAM-A','OTHER-SUPPLIER',
        'sale_return','POSTED',100,25,4,15,'EV-A-1');
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'RETURN_MISMATCH_SUPPLIER_SHOULD_BE_BLOCKED';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils,reference_event_id)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','BAD-BACKDATED_RETURN',
        date '2026-09-30','SKU-A','FAM-A','SUP-A',
        'sale_return','POSTED',100,25,4,15,'EV-A-1');
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'RETURN_BACKDATED_RETURN_SHOULD_BE_BLOCKED';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO erp.item_movement_events
       (tenant_id,branch_id,event_id,event_date,item_code,
        family_code,supplier_code,movement_kind,posting_status,
        quantity_milli,net_amount_fils,tax_fils,cost_fils,reference_event_id)
     VALUES
       ('11111111-1111-4111-8111-111111111111','BR-A','BAD-OVERSIZED_SINGLE_RETURN',
        date '2026-10-02','SKU-A','FAM-A','SUP-A',
        'sale_return','POSTED',1001,25,4,15,'EV-A-1');
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'RETURN_OVERSIZED_SINGLE_RETURN_SHOULD_BE_BLOCKED';
  END IF;
END
$;
ROLLBACK;
