-- NEW independent JAWAFA ERP AI PostgreSQL schema only; never Jawafa_DB.
BEGIN;
CREATE TABLE erp.api_memberships (
  tenant_id uuid NOT NULL REFERENCES erp.tenants(tenant_id),
  oidc_subject text NOT NULL CHECK (length(btrim(oidc_subject)) > 0),
  erp_role text NOT NULL CHECK (erp_role IN ('accountant','supervisor','auditor','viewer','clerk')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, oidc_subject)
);
CREATE INDEX api_memberships_subject_lookup ON erp.api_memberships
  (oidc_subject, tenant_id) WHERE is_active;
ALTER TABLE erp.api_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.api_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY api_membership_tenant_read ON erp.api_memberships FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='erp_api_reader') THEN
    CREATE ROLE erp_api_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA erp TO erp_api_reader;
GRANT SELECT ON erp.api_memberships, erp.cheques, erp.cheque_events,
  erp.journal_headers, erp.journal_lines,
  erp.cheque_current_state, erp.journal_draft_balance TO erp_api_reader;
-- No INSERT, UPDATE, DELETE or EXECUTE privileges for ERP API login.
COMMIT;
