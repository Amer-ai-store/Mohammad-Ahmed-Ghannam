-- Disposable PostgreSQL-16 integration tests for the NEW ERP schema only.
-- The workflow starts its own empty PostgreSQL service. Never run on Jawafa_DB.
BEGIN;
DO $$
BEGIN
  IF to_regclass('erp.tenants') IS NULL OR to_regclass('erp.cheques') IS NULL
     OR to_regclass('erp.cheque_events') IS NULL
     OR to_regclass('erp.journal_headers') IS NULL
     OR to_regclass('erp.journal_lines') IS NULL THEN
    RAISE EXCEPTION 'EXPECTED_ERP_TABLES_MISSING';
  END IF;
END $$;

INSERT INTO erp.tenants (tenant_id,display_name) VALUES
('11111111-1111-4111-8111-111111111111','Synthetic tenant A'),
('22222222-2222-4222-8222-222222222222','Synthetic tenant B');
INSERT INTO erp.cheques
  (cheque_id,tenant_id,reference_no,direction,amount_fils,created_by)
VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','DEMO-A','received',1200500,'makerA'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','DEMO-B','issued',775000,'makerB');
INSERT INTO erp.cheque_events
  (event_id,tenant_id,cheque_id,command_id,state_before,state_after,
  actor_subject,approver_subject,reason,event_time)
VALUES
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DEMO-E1','draft','registered',
'clerkA',NULL,'synthetic',now());
INSERT INTO erp.journal_headers
  (journal_id,tenant_id,journal_ref,journal_date,created_by)
VALUES
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111',
'DEMO-J1',current_date,'makerA');
INSERT INTO erp.journal_lines
  (journal_line_id,tenant_id,journal_id,account_code,line_no,debit_fils,credit_fils)
VALUES
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111',
'dddddddd-dddd-4ddd-8ddd-dddddddddddd','DEMO-101',1,1000500,0),
('ffffffff-ffff-4fff-8fff-ffffffffffff','11111111-1111-4111-8111-111111111111',
'dddddddd-dddd-4ddd-8ddd-dddddddddddd','DEMO-201',2,0,1000500);

-- Deliberately unbalanced second tenant DRAFT proves the read-only view
-- distinguishes balancing from mere persistence; no journal is posted.
INSERT INTO erp.journal_headers (journal_id,tenant_id,journal_ref,journal_date,created_by)
VALUES ('44444444-4444-4444-8444-444444444444',
'22222222-2222-4222-8222-222222222222','DEMO-J2',current_date,'makerB');
INSERT INTO erp.journal_lines
 (journal_line_id,tenant_id,journal_id,account_code,line_no,debit_fils,credit_fils)
VALUES
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444','DEMO-101',1,6000,0),
 ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444','DEMO-201',2,0,5000);

-- Reader cannot change data. Tenant context must be set by an authenticated
-- server; a client-controllable session variable is NOT secure isolation.
CREATE ROLE erp_ci_reader NOLOGIN;
GRANT USAGE ON SCHEMA erp TO erp_ci_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA erp TO erp_ci_reader;
SET ROLE erp_ci_reader;
SET erp.tenant_id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.cheques) != 1 THEN
    RAISE EXCEPTION 'TENANT_A_READER_RLS_FAILED';
  END IF;
  IF (SELECT count(*) FROM erp.cheque_events) != 1 THEN
    RAISE EXCEPTION 'TENANT_A_EVENT_RLS_FAILED';
  END IF;
  IF (SELECT count(*) FROM erp.journal_draft_balance WHERE balanced_for_review) != 1
  THEN RAISE EXCEPTION 'TENANT_A_BALANCED_DRAFT_VIEW_FAILED'; END IF;
END $$;
SET erp.tenant_id='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.cheques) != 1 OR
     (SELECT count(*) FROM erp.cheque_events) != 0 THEN
    RAISE EXCEPTION 'TENANT_B_READER_RLS_FAILED';
  END IF;
  IF (SELECT count(*) FROM erp.journal_draft_balance) != 1 OR
     (SELECT count(*) FROM erp.journal_draft_balance WHERE balanced_for_review) != 0
  THEN RAISE EXCEPTION 'TENANT_B_UNBALANCED_DRAFT_VIEW_FAILED'; END IF;
END $$;
SET erp.tenant_id='';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.cheques) != 0 THEN
    RAISE EXCEPTION 'EMPTY_TENANT_CONTEXT_FAILS_OPEN';
  END IF;
END $$;
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.tenants (tenant_id,display_name)
      VALUES('33333333-3333-4333-8333-333333333333','NOT_ALLOWED');
    RAISE EXCEPTION 'READER_WRITE_UNEXPECTEDLY_PERMITTED';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

-- Triggers reject mutation even when tests use a privileged migrator.
DO $
BEGIN
  BEGIN
    UPDATE erp.cheques SET amount_fils = 2
      WHERE cheque_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'CHEQUE_AMOUNT_MUTATION_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
  END;
END $;

DO $$
BEGIN
  BEGIN
    UPDATE erp.journal_headers SET journal_ref='TAMPERED'
      WHERE journal_ref='DEMO-J1';
    RAISE EXCEPTION 'JOURNAL_HEADER_MUTATION_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
  END;
END $$;
DO $$
BEGIN
  BEGIN
    DELETE FROM erp.cheque_events WHERE command_id='DEMO-E1';
    RAISE EXCEPTION 'EVENT_DELETION_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
  END;
END $$;
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.cheque_events
      (event_id,tenant_id,cheque_id,command_id,state_before,state_after,
       actor_subject,approver_subject,reason,event_time)
    VALUES('99999999-9999-4999-8999-999999999999',
       '22222222-2222-4222-8222-222222222222',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CROSS-TENANT',
       'draft','registered','actor',NULL,'attempt',now());
    RAISE EXCEPTION 'CROSS_TENANT_EVENT_LINK_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;
ROLLBACK;
SELECT 'PASS: ERP schema, conditional RLS, read-only role, immutable audit and tenant-safe FK' AS result;
