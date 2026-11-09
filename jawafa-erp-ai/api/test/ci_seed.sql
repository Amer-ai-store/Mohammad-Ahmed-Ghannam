-- Disposable CI PostgreSQL fixtures ONLY; not real Jawafa_DB.
BEGIN;
CREATE ROLE erp_ci_api_login LOGIN PASSWORD 'ci-only-synthetic-never-production'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT erp_api_reader TO erp_ci_api_login;
INSERT INTO erp.tenants (tenant_id, display_name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Synthetic ERP A'),
  ('22222222-2222-4222-8222-222222222222', 'Synthetic ERP B');
INSERT INTO erp.api_memberships (tenant_id, oidc_subject, erp_role, is_active) VALUES
  ('11111111-1111-4111-8111-111111111111', 'member-A', 'accountant', true),
  ('22222222-2222-4222-8222-222222222222', 'member-B', 'auditor', true),
  ('11111111-1111-4111-8111-111111111111', 'viewer-A', 'viewer', true),
  ('11111111-1111-4111-8111-111111111111', 'inactive-A', 'supervisor', false);
INSERT INTO erp.cheques
  (cheque_id, tenant_id, reference_no, direction, amount_fils, created_by) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111', 'SYNTHETIC-A', 'received', 1200500, 'maker-A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '22222222-2222-4222-8222-222222222222', 'SYNTHETIC-B', 'issued', 900000, 'maker-B');
INSERT INTO erp.cheque_events
  (event_id, tenant_id, cheque_id, command_id, state_before, state_after,
   actor_subject, approver_subject, reason, event_time) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'SYNTHETIC-REGISTER-A',
   'draft', 'registered', 'maker-A', null, 'synthetic', now());
INSERT INTO erp.journal_headers
  (journal_id, tenant_id, journal_ref, journal_date, created_by) VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   '11111111-1111-4111-8111-111111111111', 'SYNTHETIC-JOURNAL',
   current_date, 'maker-A');
INSERT INTO erp.journal_lines
  (journal_line_id, tenant_id, journal_id, account_code, line_no, debit_fils, credit_fils) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '11111111-1111-4111-8111-111111111111',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'SYN-101', 1, 100250, 0),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff',
   '11111111-1111-4111-8111-111111111111',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'SYN-201', 2, 0, 100250);
COMMIT;
