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
-- Fully synthetic purchase data; never sourced from TrustSoft or Jawafa_DB.
INSERT INTO erp.suppliers (supplier_id, tenant_id, supplier_code, legal_name) VALUES
 ('10000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111','SYN-A','Synthetic Supplier A'),
 ('20000000-0000-4000-8000-000000000002',
  '22222222-2222-4222-8222-222222222222','SYN-B','Synthetic Supplier B');
INSERT INTO erp.purchase_invoices
 (purchase_invoice_id,tenant_id,supplier_id,original_invoice_number,
  invoice_date,total_fils,created_by) VALUES
 ('30000000-0000-4000-8000-000000000003',
  '11111111-1111-4111-8111-111111111111',
  '10000000-0000-4000-8000-000000000001',
  ' inv-١٢٣ ',date '2026-11-01',100250,'synthetic-maker'),
 ('40000000-0000-4000-8000-000000000004',
  '22222222-2222-4222-8222-222222222222',
  '20000000-0000-4000-8000-000000000002',
  'INV-124',date '2026-11-01',555000,'synthetic-maker');
INSERT INTO erp.purchase_invoice_lines
 (line_id,tenant_id,purchase_invoice_id,line_no,item_reference,
  quantity_milliunits,net_fils,tax_fils) VALUES
 ('50000000-0000-4000-8000-000000000005',
  '11111111-1111-4111-8111-111111111111',
  '30000000-0000-4000-8000-000000000003',
  1,'SYNTHETIC-STOCK',1000,90000,10250);
COMMIT;
