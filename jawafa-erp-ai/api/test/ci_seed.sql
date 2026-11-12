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
  ('11111111-1111-4111-8111-111111111111', 'inactive-A', 'supervisor', false),
  ('11111111-1111-4111-8111-111111111111', 'hr-A', 'hr_manager', true),
  ('11111111-1111-4111-8111-111111111111', 'supervisor-A', 'supervisor', true);
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
-- Fictional personnel directory (NO real employee records or payroll identifiers).
INSERT INTO erp.personnel_directory
 (employee_id,tenant_id,employee_code,display_name,department_code,employment_status) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000011',
  '11111111-1111-4111-8111-111111111111','EMP-A','Fictional Employee A','OPS','active'),
 ('bbbbbbbb-0000-4000-8000-000000000022',
  '22222222-2222-4222-8222-222222222222','EMP-B','Fictional Employee B','HR','on_leave');

-- Explicit per-company grants, default deny for absent and false entries.
INSERT INTO erp.role_permissions
 (tenant_id,erp_role,resource,action,allowed,policy_reference) VALUES
 ('11111111-1111-4111-8111-111111111111','hr_manager','personnel','read',true,'ci-only'),
 ('11111111-1111-4111-8111-111111111111','supervisor','personnel','read',true,'ci-only'),
 ('11111111-1111-4111-8111-111111111111','supervisor','settings','read',true,'ci-only'),
 ('11111111-1111-4111-8111-111111111111','supervisor','permissions','read',true,'ci-only'),
 ('22222222-2222-4222-8222-222222222222','auditor','personnel','read',false,'ci-only'),
 ('22222222-2222-4222-8222-222222222222','auditor','settings','read',true,'ci-only');

INSERT INTO erp.setting_revisions
 (revision_id,tenant_id,setting_key,revision_no,setting_value,recorded_by) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000033',
  '11111111-1111-4111-8111-111111111111','locale',1,'en','ci-only'),
 ('aaaaaaaa-0000-4000-8000-000000000044',
  '11111111-1111-4111-8111-111111111111','locale',2,'ar','ci-only'),
 ('bbbbbbbb-0000-4000-8000-000000000055',
  '22222222-2222-4222-8222-222222222222','locale',1,'en','ci-only');

-- NEW ERP synthetic-only branch ledger fixtures: NEVER real source data.
INSERT INTO erp.branches(tenant_id,branch_id,branch_label) VALUES
 ('11111111-1111-4111-8111-111111111111','BR-A','Synthetic authorized branch'),
 ('11111111-1111-4111-8111-111111111111','BR-LOCKED','Synthetic restricted branch'),
 ('11111111-1111-4111-8111-111111111111','BR-REVOKED','Synthetic revoked branch'),
 ('22222222-2222-4222-8222-222222222222','BR-A','Synthetic foreign branch');
INSERT INTO erp.report_branch_access_events
 (access_event_id,tenant_id,branch_id,oidc_subject,access_action,
  authorization_reference,recorded_at) VALUES
 ('70000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111','BR-A','member-A','grant',
  'SYNTHETIC-CI-GRANT-001',timestamptz '2026-11-10 00:00:00+00'),
 ('70000000-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111','BR-A','viewer-A','grant',
  'SYNTHETIC-CI-GRANT-002',timestamptz '2026-11-10 00:00:00+00'),
 ('70000000-0000-4000-8000-000000000003',
  '11111111-1111-4111-8111-111111111111','BR-LOCKED','supervisor-A','grant',
  'SYNTHETIC-CI-GRANT-003',timestamptz '2026-11-10 00:00:00+00'),
 ('70000000-0000-4000-8000-000000000004',
  '22222222-2222-4222-8222-222222222222','BR-A','member-B','grant',
  'SYNTHETIC-CI-GRANT-004',timestamptz '2026-11-10 00:00:00+00'),
 ('70000000-0000-4000-8000-000000000005',
  '11111111-1111-4111-8111-111111111111','BR-REVOKED','member-A','grant',
  'SYNTHETIC-CI-GRANT-005',timestamptz '2026-11-10 00:00:00+00'),
 ('70000000-0000-4000-8000-000000000006',
  '11111111-1111-4111-8111-111111111111','BR-REVOKED','member-A','revoke',
  'SYNTHETIC-CI-REVOKE-006',timestamptz '2026-11-11 00:00:00+00');

INSERT INTO erp.item_movement_events
 (tenant_id,branch_id,event_id,event_date,item_code,family_code,supplier_code,
  movement_kind,posting_status,quantity_milli,net_amount_fils,tax_fils,
  cost_fils,reference_event_id) VALUES
 ('11111111-1111-4111-8111-111111111111','BR-A','EV-A-1',
  date '2026-10-01','SKU-A','FAM-A','SUP-A',
  'sale','POSTED',1000,250,40,175,NULL),
 ('11111111-1111-4111-8111-111111111111','BR-A','EV-A-2',
  date '2026-10-02','SKU-A','FAM-A','SUP-A',
  'sale_return','POSTED',100,25,4,15,'EV-A-1'),
 ('11111111-1111-4111-8111-111111111111','BR-A','EV-A-3',
  date '2026-10-02','SKU-A','FAM-A','SUP-A',
  'purchase','POSTED',3000,600,96,0,NULL),
 ('11111111-1111-4111-8111-111111111111','BR-A','EV-A-4',
  date '2026-10-02','SKU-A','FAM-A','SUP-A',
  'stock_out','VOIDED',200,0,0,0,NULL),
 ('11111111-1111-4111-8111-111111111111','BR-LOCKED','EV-A-HIDDEN',
  date '2026-10-01','PRIVATE-ITEM','FAM-A','SUP-A',
  'sale','POSTED',9000,8000,1280,4000,NULL),
 ('11111111-1111-4111-8111-111111111111','BR-REVOKED','EV-A-REVOKED',
  date '2026-10-01','PRIVATE-REVOKED','FAM-A','SUP-A',
  'sale','POSTED',9000,8000,1280,4000,NULL),
 ('22222222-2222-4222-8222-222222222222','BR-A','EV-B-1',
  date '2026-10-01','PRIVATE-OTHER-TENANT','FAM-B','SUP-B',
  'sale','POSTED',9000,8000,1280,4000,NULL);


-- Independent ERP-only 2024/2025 historical comparator test data.
-- Synthetic, never derived from owner TrustSoft/Jawafa_DB records.
INSERT INTO erp.item_movement_events
 (tenant_id,branch_id,event_id,event_date,item_code,family_code,supplier_code,
  movement_kind,posting_status,quantity_milli,net_amount_fils,tax_fils,
  cost_fils,reference_event_id) VALUES
 ('11111111-1111-4111-8111-111111111111','BR-A','HIST-EV-2025-01',
  date '2025-10-01','SKU-A','FAM-A','SUP-A',
  'sale','POSTED',1000,100,16,60,NULL),
 ('11111111-1111-4111-8111-111111111111','BR-A','HIST-EV-2025-02',
  date '2025-10-02','SKU-A','FAM-A','SUP-A',
  'sale','POSTED',1000,200,32,120,NULL),
 ('11111111-1111-4111-8111-111111111111','BR-A','HIST-EV-2024-01',
  date '2024-10-01','SKU-A','FAM-A','SUP-A',
  'sale','POSTED',1000,75,12,50,NULL),
 ('11111111-1111-4111-8111-111111111111','BR-A','HIST-EV-2024-02',
  date '2024-10-02','SKU-A','FAM-A','SUP-A',
  'sale','POSTED',1000,50,8,30,NULL),
 ('22222222-2222-4222-8222-222222222222','BR-A','HIST-FOREIGN-2025',
  date '2025-10-02','SECRET-OTHER-TENANT','FAM-B','SUP-B',
  'sale','POSTED',1000,9999,1599,5000,NULL),
 ('11111111-1111-4111-8111-111111111111','BR-LOCKED','HIST-LOCKED-2025',
  date '2025-10-02','SECRET-RESTRICTED','FAM-A','SUP-A',
  'sale','POSTED',1000,9999,1599,5000,NULL);


COMMIT;
