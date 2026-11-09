-- Executed on disposable GitHub Actions PostgreSQL, NOT Jawafa_DB.
-- All fixture inserts are rolled back; test protects the NEW ERP foundation.
BEGIN;
INSERT INTO erp.tenants(tenant_id,display_name) VALUES
  ('11111111-1111-4111-8111-111111111111','Synthetic A'),
  ('22222222-2222-4222-8222-222222222222','Synthetic B');
INSERT INTO erp.cheques(cheque_id,tenant_id,reference_no,direction,amount_fils,created_by)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111','TEST-A','received',1000500,'maker-A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '22222222-2222-4222-8222-222222222222','TEST-B','issued',2000500,'maker-B');

INSERT INTO erp.cheque_events(event_id,tenant_id,cheque_id,command_id,
                             state_before,state_after,actor_subject,
                             approver_subject,reason,event_time)
VALUES ('00000000-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'TEST-A-REGISTER','draft','registered','clerk-A',NULL,'demo',
        now()-interval '10 seconds');

-- A caller-provided timestamp 10s in the past MUST NOT become audit time.
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM erp.cheque_events e
    WHERE e.command_id='TEST-A-REGISTER'
      AND (
        e.event_time < clock_timestamp() - interval '5 seconds'
        OR e.event_time IS DISTINCT FROM e.recorded_at
      )
  ) THEN
    RAISE EXCEPTION 'CLIENT_BACKDATED_AUDIT_TIME_ACCEPTED';
  END IF;
END $;

-- Forbidden deposit by the original maker (checker cannot be same maker).
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.cheque_events(event_id,tenant_id,cheque_id,command_id,
      state_before,state_after,actor_subject,approver_subject,reason,event_time)
    VALUES ('00000000-0000-4000-8000-000000000002',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'TEST-A-BAD-APPROVAL','registered','deposited','accountant-A',
      'maker-A','demo',now()-interval '9 seconds');
    RAISE EXCEPTION 'CHEQUE_MAKER_AS_APPROVER_WAS_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'ERP_CHEQUE_INDEPENDENT_APPROVER_REQUIRED' THEN RAISE; END IF;
  END;
END $$;

-- Wrong direction and invalid transition never becomes an event.
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.cheque_events(event_id,tenant_id,cheque_id,command_id,
      state_before,state_after,actor_subject,approver_subject,reason,event_time)
    VALUES ('00000000-0000-4000-8000-000000000003',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'TEST-A-BAD-DIRECTION','registered','delivered','accountant-A',
      'supervisor-A','demo',now()-interval '8 seconds');
    RAISE EXCEPTION 'RECEIVED_CHEQUE_DELIVERY_WAS_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'ERP_CHEQUE_TRANSITION_FORBIDDEN' THEN RAISE; END IF;
  END;
END $$;

-- Authorized synthetic deposit and clear, append-only.
INSERT INTO erp.cheque_events(event_id,tenant_id,cheque_id,command_id,
                             state_before,state_after,actor_subject,
                             approver_subject,reason,event_time)
VALUES ('00000000-0000-4000-8000-000000000004',
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'TEST-A-DEPOSIT','registered','deposited','accountant-A',
       'supervisor-A','synthetic deposit',now()-interval '5 seconds'),
       ('00000000-0000-4000-8000-000000000005',
       '11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'TEST-A-CLEAR','deposited','cleared','accountant-A',
       'supervisor-A','synthetic clear',now()-interval '1 seconds');

DO $$
BEGIN
  IF (SELECT current_state FROM erp.cheque_current_state
       WHERE reference_no='TEST-A') <> 'cleared' THEN
    RAISE EXCEPTION 'CHEQUE_STATE_PROJECTION_FAILED';
  END IF;
  IF (SELECT event_count FROM erp.cheque_current_state
       WHERE reference_no='TEST-A') <> 3 THEN
    RAISE EXCEPTION 'APPEND_ONLY_EVENT_COUNT_FAILED';
  END IF;
END $$;

-- Backdating or falsifying previous-state is rejected, no financial writes.
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.cheque_events(event_id,tenant_id,cheque_id,command_id,
      state_before,state_after,actor_subject,approver_subject,reason,event_time)
    VALUES ('00000000-0000-4000-8000-000000000006',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'TEST-A-STALE','registered','cancelled','accountant-A',
      'supervisor-A','synthetic cancelled',now());
    RAISE EXCEPTION 'CHEQUE_STALE_STATE_WAS_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'ERP_CHEQUE_STALE_OR_INVALID_PREVIOUS_STATE' THEN RAISE; END IF;
  END;
END $$;

-- Second tenant cheque has no event, read-only projection is draft.
DO $$
BEGIN
  IF (SELECT current_state FROM erp.cheque_current_state
       WHERE reference_no='TEST-B') <> 'draft' THEN
     RAISE EXCEPTION 'UNTOUCHED_CHEQUE_NOT_DRAFT';
  END IF;
END $$;

CREATE ROLE erp_ci_state_reader NOLOGIN;
GRANT USAGE ON SCHEMA erp TO erp_ci_state_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA erp TO erp_ci_state_reader;
GRANT SELECT ON erp.cheque_current_state TO erp_ci_state_reader;
SET ROLE erp_ci_state_reader;
SET erp.tenant_id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.cheque_current_state) <> 1 OR
     (SELECT current_state FROM erp.cheque_current_state) <> 'cleared'
  THEN RAISE EXCEPTION 'TENANT_A_CHEQUE_RLS_PROJECTION_FAILED'; END IF;
END $$;
SET erp.tenant_id='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.cheque_current_state) <> 1 OR
     (SELECT current_state FROM erp.cheque_current_state) <> 'draft'
  THEN RAISE EXCEPTION 'TENANT_B_CHEQUE_RLS_PROJECTION_FAILED'; END IF;
END $$;
SET erp.tenant_id='';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.cheque_current_state) <> 0
  THEN RAISE EXCEPTION 'MISSING_TENANT_CONTEXT_LEAKED_CHEQUES'; END IF;
END $$;

-- A reader may not create a financial event or call a write function.
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.cheque_events(event_id,tenant_id,cheque_id,command_id,
      state_before,state_after,actor_subject,approver_subject,reason,event_time)
    VALUES ('00000000-0000-4000-8000-000000000007',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'READER-WRITE-ATTEMPT','cleared','returned','attacker','checker',
      'attempted write',now());
    RAISE EXCEPTION 'READER_MUTATION_WAS_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Both referenced event and amount remain immune to direct UPDATE/DELETE.
DO $$
BEGIN
  BEGIN
    DELETE FROM erp.cheque_events WHERE command_id='TEST-A-DEPOSIT';
    RAISE EXCEPTION 'EVENT_DELETE_WAS_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
  END;
END $$;
DO $$
BEGIN
  BEGIN
    UPDATE erp.cheques SET amount_fils=1 WHERE reference_no='TEST-A';
    RAISE EXCEPTION 'CHEQUE_AMOUNT_CHANGE_WAS_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
SELECT 'PASS: synthetic cheque lifecycle guard, tenant projection, immutable audit and reader denial' AS result;
