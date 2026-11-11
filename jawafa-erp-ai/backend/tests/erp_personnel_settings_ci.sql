-- New ERP disposable PostgreSQL 16 ONLY. Fictional HR data, complete ROLLBACK.
BEGIN;
INSERT INTO erp.tenants(tenant_id,display_name) VALUES
 ('11111111-1111-4111-8111-111111111111','Synthetic company A'),
 ('22222222-2222-4222-8222-222222222222','Synthetic company B');

INSERT INTO erp.personnel_directory
 (employee_id,tenant_id,employee_code,display_name,department_code,employment_status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'EMP-001','Fictional Employee A','OPS','active'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',
 'EMP-001','Fictional Employee B','HR','on_leave');

INSERT INTO erp.role_permissions(tenant_id,erp_role,resource,action,allowed,policy_reference) VALUES
 ('11111111-1111-4111-8111-111111111111','hr_manager','personnel','read',true,'ci-hr'),
 ('11111111-1111-4111-8111-111111111111','supervisor','settings','read',true,'ci-supervisor'),
 ('11111111-1111-4111-8111-111111111111','supervisor','permissions','read',true,'ci-supervisor'),
 ('22222222-2222-4222-8222-222222222222','auditor','personnel','read',false,'ci-denied');

INSERT INTO erp.setting_revisions
 (revision_id,tenant_id,setting_key,revision_no,setting_value,recorded_by) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '11111111-1111-4111-8111-111111111111','locale',1,'en','ci-seed'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '11111111-1111-4111-8111-111111111111','locale',2,'ar','ci-seed'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 '22222222-2222-4222-8222-222222222222','locale',1,'en','ci-seed');

-- Only tenant-local rows and latest revision are readable; empty tenant fails closed.
SET ROLE erp_api_reader;
SET erp.tenant_id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
 IF (SELECT count(*) FROM erp.personnel_directory) <> 1
    OR (SELECT display_name FROM erp.personnel_directory LIMIT 1) <> 'Fictional Employee A'
 THEN RAISE EXCEPTION 'PERSONNEL_TENANT_A_LEAK'; END IF;
 IF (SELECT count(*) FROM erp.role_permissions) <> 3
 THEN RAISE EXCEPTION 'ROLE_PERMISSIONS_TENANT_A_LEAK'; END IF;
 IF (SELECT count(*) FROM erp.current_system_settings) <> 1
    OR (SELECT setting_value FROM erp.current_system_settings) <> 'ar'
    OR (SELECT revision_no FROM erp.current_system_settings) <> 2
 THEN RAISE EXCEPTION 'SETTING_LATEST_REVISION_FAILED'; END IF;
END $$;
SET erp.tenant_id='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
 IF (SELECT count(*) FROM erp.personnel_directory) <> 1
    OR (SELECT display_name FROM erp.personnel_directory LIMIT 1) <> 'Fictional Employee B'
 THEN RAISE EXCEPTION 'PERSONNEL_TENANT_B_LEAK'; END IF;
 IF (SELECT count(*) FROM erp.role_permissions WHERE allowed) <> 0
 THEN RAISE EXCEPTION 'DENIED_PERMISSION_BECAME_ALLOWED'; END IF;
 IF (SELECT setting_value FROM erp.current_system_settings) <> 'en'
 THEN RAISE EXCEPTION 'SETTING_TENANT_B_LEAK'; END IF;
END $$;
SET erp.tenant_id='';
DO $$
BEGIN
 IF (SELECT count(*) FROM erp.personnel_directory) <> 0
    OR (SELECT count(*) FROM erp.role_permissions) <> 0
    OR (SELECT count(*) FROM erp.current_system_settings) <> 0
 THEN RAISE EXCEPTION 'UNSET_TENANT_CONTEXT_EXPOSED_DATA'; END IF;
 BEGIN
   UPDATE erp.setting_revisions SET setting_value='forged' WHERE setting_key='locale';
   RAISE EXCEPTION 'READER_UPDATE_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   INSERT INTO erp.personnel_directory
   (employee_id,tenant_id,employee_code,display_name,department_code,employment_status)
   VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff',
   '11111111-1111-4111-8111-111111111111','FORGED','forged','OPS','active');
   RAISE EXCEPTION 'READER_INSERT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;

-- Owner-level direct mutation is blocked by append-only triggers (except DDL/superuser).
DO $$
BEGIN
 BEGIN
   UPDATE erp.personnel_directory SET display_name='altered'
    WHERE employee_code='EMP-001';
   RAISE EXCEPTION 'EMPLOYEE_MUTATION_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
 END;
 BEGIN
   DELETE FROM erp.role_permissions WHERE policy_reference='ci-hr';
   RAISE EXCEPTION 'PERMISSION_DELETION_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE erp.setting_revisions SET revision_no=4 WHERE revision_no=1;
   RAISE EXCEPTION 'SETTING_HISTORY_MUTATION_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
SELECT 'PASS: synthetic personnel isolation, settings revisions, permissions, denied writes' AS result;
