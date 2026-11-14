-- Independent NEW JAWAFA ERP AI PostgreSQL prototype ONLY. Never run on Jawafa_DB.
-- These are synthetic reference structures, NOT TrustSoft-discovered schemas.
-- No payroll, HR identity document or production personal data belongs in this migration.
BEGIN;

-- The scoped HR reader is a new role within the synthetic ERP membership model.
ALTER TABLE erp.api_memberships DROP CONSTRAINT api_memberships_erp_role_check;
ALTER TABLE erp.api_memberships ADD CONSTRAINT api_memberships_erp_role_check
  CHECK (erp_role IN ('accountant','supervisor','auditor','viewer','clerk','hr_manager'));

CREATE TABLE erp.personnel_directory (
  employee_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES erp.tenants(tenant_id),
  employee_code text NOT NULL CHECK (length(btrim(employee_code)) BETWEEN 1 AND 50),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  department_code text NOT NULL CHECK (length(btrim(department_code)) BETWEEN 1 AND 50),
  employment_status text NOT NULL
    CHECK (employment_status IN ('active','on_leave','inactive')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, employee_id),
  UNIQUE (tenant_id, employee_code)
);

-- Explicit data-driven read grants: unknown role/resource/action => deny.
-- These are new ERP policy fixtures; they are NOT copied from TrustSoft.
CREATE TABLE erp.role_permissions (
  tenant_id uuid NOT NULL REFERENCES erp.tenants(tenant_id),
  erp_role text NOT NULL
    CHECK (erp_role IN ('accountant','supervisor','auditor','viewer','clerk','hr_manager')),
  resource text NOT NULL
    CHECK (resource IN ('personnel','permissions','settings')),
  action text NOT NULL CHECK (action = 'read'),
  allowed boolean NOT NULL DEFAULT false,
  policy_reference text NOT NULL CHECK (length(btrim(policy_reference)) > 0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, erp_role, resource, action)
);

-- Append-only, non-secret settings revisions. Real device credentials, access
-- tokens, SQL passwords and employee/payroll records are prohibited here.
CREATE TABLE erp.setting_revisions (
  revision_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES erp.tenants(tenant_id),
  setting_key text NOT NULL
    CHECK (setting_key IN ('locale','timezone','receipt_print_mode','approval_mode')),
  revision_no integer NOT NULL CHECK (revision_no > 0),
  setting_value text NOT NULL
    CHECK (length(btrim(setting_value)) BETWEEN 1 AND 120),
  recorded_by text NOT NULL CHECK (length(btrim(recorded_by)) > 0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, setting_key, revision_no)
);

CREATE VIEW erp.current_system_settings WITH (security_invoker = true) AS
SELECT DISTINCT ON (tenant_id, setting_key)
  tenant_id, setting_key, setting_value, revision_no, recorded_at
FROM erp.setting_revisions
ORDER BY tenant_id, setting_key, revision_no DESC;

CREATE TRIGGER personnel_directory_immutable
BEFORE UPDATE OR DELETE ON erp.personnel_directory
FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();

CREATE TRIGGER role_permissions_immutable
BEFORE UPDATE OR DELETE ON erp.role_permissions
FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();

CREATE TRIGGER setting_revisions_immutable
BEFORE UPDATE OR DELETE ON erp.setting_revisions
FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();

ALTER TABLE erp.personnel_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.personnel_directory FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.setting_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.setting_revisions FORCE ROW LEVEL SECURITY;

CREATE POLICY personnel_tenant_read ON erp.personnel_directory FOR SELECT
 USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);
CREATE POLICY role_permission_tenant_read ON erp.role_permissions FOR SELECT
 USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);
CREATE POLICY setting_revision_tenant_read ON erp.setting_revisions FOR SELECT
 USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);

GRANT SELECT ON erp.personnel_directory, erp.role_permissions,
 erp.setting_revisions, erp.current_system_settings TO erp_api_reader;
-- No write permissions or direct SQL exposure to Flutter users.
COMMIT;
