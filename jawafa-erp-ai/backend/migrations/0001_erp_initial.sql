-- JAWAFA ERP AI independent database genesis (PostgreSQL 16+ design).
-- Review only; DO NOT run against Jawafa_DB or TrustSoft.
-- A dedicated, separately provisioned ERP database is required.
BEGIN;
CREATE SCHEMA IF NOT EXISTS erp;

CREATE TABLE IF NOT EXISTS erp.tenants (
  tenant_id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.cheques (
  cheque_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES erp.tenants(tenant_id),
  reference_no text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('received','issued')),
  amount_fils bigint NOT NULL CHECK (amount_fils > 0),
  currency_code char(3) NOT NULL DEFAULT 'JOD',
  created_by text NOT NULL CHECK (length(trim(created_by)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cheque_id),
  UNIQUE (tenant_id, direction, reference_no)
);

CREATE TABLE IF NOT EXISTS erp.cheque_events (
  event_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  cheque_id uuid NOT NULL,
  command_id text NOT NULL,
  state_before text NOT NULL,
  state_after text NOT NULL,
  actor_subject text NOT NULL,
  approver_subject text,
  reason text NOT NULL DEFAULT '',
  event_time timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  event_hash_sha256 text CHECK (
    event_hash_sha256 IS NULL OR event_hash_sha256 ~ '^[0-9a-f]{64}$'
  ),
  FOREIGN KEY (tenant_id, cheque_id) REFERENCES erp.cheques (tenant_id, cheque_id),
  UNIQUE (tenant_id, command_id),
  CHECK (actor_subject <> COALESCE(approver_subject, ''))
);

CREATE TABLE IF NOT EXISTS erp.journal_headers (
  journal_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES erp.tenants(tenant_id),
  journal_ref text NOT NULL,
  journal_date date NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, journal_id),
  UNIQUE (tenant_id, journal_ref)
);

CREATE TABLE IF NOT EXISTS erp.journal_lines (
  journal_line_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  account_code text NOT NULL,
  line_no integer NOT NULL CHECK (line_no > 0),
  debit_fils bigint NOT NULL DEFAULT 0 CHECK (debit_fils >= 0),
  credit_fils bigint NOT NULL DEFAULT 0 CHECK (credit_fils >= 0),
  FOREIGN KEY (tenant_id, journal_id)
    REFERENCES erp.journal_headers(tenant_id, journal_id),
  UNIQUE (tenant_id, journal_id, line_no),
  CHECK ((debit_fils > 0 AND credit_fils = 0)
      OR (credit_fils > 0 AND debit_fils = 0))
);

-- Append-only DB safeguard for event and posted-activity records.
-- A privileged DB owner/superuser can still bypass safeguards; operational
-- roles must not own the tables, hold BYPASSRLS, or have DDL privileges.
CREATE OR REPLACE FUNCTION erp.reject_financial_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_ERP_AUDIT: updates/deletes forbidden on %', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER reject_cheque_event_update_delete
BEFORE UPDATE OR DELETE ON erp.cheque_events
FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();

CREATE TRIGGER reject_journal_header_update_delete
BEFORE UPDATE OR DELETE ON erp.journal_headers
FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();

CREATE TRIGGER reject_journal_line_update_delete
BEFORE UPDATE OR DELETE ON erp.journal_lines
FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();

-- Tenant isolation: only a verified backend sets erp.tenant_id in a transaction.
-- NEVER expose a raw SQL connection or allow end users to SET arbitrary tenant IDs.
ALTER TABLE erp.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.cheque_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.journal_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.journal_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE erp.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.cheques FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.cheque_events FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.journal_headers FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.journal_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_read ON erp.tenants FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);
CREATE POLICY cheque_tenant_read ON erp.cheques FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);
CREATE POLICY cheque_event_tenant_read ON erp.cheque_events FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);
CREATE POLICY journal_tenant_read ON erp.journal_headers FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);
CREATE POLICY journal_line_tenant_read ON erp.journal_lines FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id', true),'')::uuid);

-- No INSERT/UPDATE/DELETE policies and no GRANTs are provisioned here.
-- Controlled write-side transaction functions and audit procedures must be
-- designed, independently reviewed, and tested BEFORE real ERP posting.
COMMIT;
