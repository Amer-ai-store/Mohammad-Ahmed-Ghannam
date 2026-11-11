-- NEW JAWAFA ERP AI PostgreSQL only — NEVER Jawafa_DB or TrustSoft.
-- REVIEW/DISPOSABLE CI migration: provision immutable report event storage.
-- Original financial, accounting, stock and employee records are untouched.
-- Deployment to any production database requires independent approval.
BEGIN;

CREATE TABLE erp.branches (
  tenant_id uuid NOT NULL REFERENCES erp.tenants(tenant_id),
  branch_id text NOT NULL
    CHECK (branch_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  branch_label text NOT NULL CHECK (length(btrim(branch_label)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, branch_id)
);

-- Grants and revocations are immutable events. No UPDATE/DELETE is necessary
-- to revoke a report user's access; a later explicit revoke event wins.
CREATE TABLE erp.report_branch_access_events (
  access_event_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  branch_id text NOT NULL,
  oidc_subject text NOT NULL,
  access_action text NOT NULL CHECK (access_action IN ('grant', 'revoke')),
  authorization_reference text NOT NULL
    CHECK (length(btrim(authorization_reference)) BETWEEN 6 AND 120),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES erp.branches(tenant_id, branch_id),
  FOREIGN KEY (tenant_id, oidc_subject)
    REFERENCES erp.api_memberships(tenant_id, oidc_subject)
);
CREATE INDEX report_branch_access_event_lookup
  ON erp.report_branch_access_events
  (tenant_id, oidc_subject, branch_id, recorded_at DESC, access_event_id DESC);

-- SECURITY INVOKER maintains tenant RLS on the underlying access-event table.
CREATE VIEW erp.current_report_branch_access
  WITH (security_invoker = true)
AS
SELECT DISTINCT ON (tenant_id, oidc_subject, branch_id)
  tenant_id, oidc_subject, branch_id,
  (access_action = 'grant') AS allowed
FROM erp.report_branch_access_events
ORDER BY tenant_id, oidc_subject, branch_id,
         recorded_at DESC, access_event_id DESC;

CREATE TABLE erp.item_movement_events (
  tenant_id uuid NOT NULL,
  branch_id text NOT NULL,
  event_id text NOT NULL
    CHECK (event_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  event_date date NOT NULL,
  item_code text NOT NULL
    CHECK (item_code ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  family_code text NOT NULL
    CHECK (family_code ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  supplier_code text NOT NULL
    CHECK (supplier_code ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  movement_kind text NOT NULL CHECK (movement_kind IN
    ('purchase','purchase_return','sale','sale_return','stock_in','stock_out')),
  posting_status text NOT NULL CHECK (posting_status IN ('POSTED','VOIDED')),
  quantity_milli bigint NOT NULL CHECK (quantity_milli > 0),
  net_amount_fils bigint NOT NULL CHECK (net_amount_fils >= 0),
  tax_fils bigint NOT NULL CHECK (tax_fils >= 0),
  cost_fils bigint NOT NULL CHECK (cost_fils >= 0),
  reference_event_id text,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- Exact source event identity and tenant+branch tuple prevent duplicates.
  PRIMARY KEY (tenant_id, branch_id, event_id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES erp.branches(tenant_id, branch_id),
  -- A return must cite an event belonging to that SAME branch and company.
  FOREIGN KEY (tenant_id, branch_id, reference_event_id)
    REFERENCES erp.item_movement_events(tenant_id, branch_id, event_id),
  CHECK ((movement_kind IN ('sale_return','purchase_return'))
         = (reference_event_id IS NOT NULL)),
  CHECK (reference_event_id IS NULL OR reference_event_id <> event_id),
  CHECK (movement_kind NOT IN ('stock_in','stock_out')
         OR (net_amount_fils=0 AND tax_fils=0 AND cost_fils=0)),
  CHECK (movement_kind IN ('sale','sale_return') OR cost_fils=0)
);
CREATE INDEX item_movement_report_range
  ON erp.item_movement_events(tenant_id, branch_id, event_date, item_code, event_id);

-- Check parent event TYPE, item/family/supplier, date and quantity.
-- This is a new-ERP insertion guard, NOT a TrustSoft vendor implementation.
CREATE OR REPLACE FUNCTION erp.verify_movement_return_origin()
RETURNS trigger LANGUAGE plpgsql AS $return_guard$
DECLARE
  original erp.item_movement_events%ROWTYPE;
  expected_kind text;
BEGIN
  IF NEW.movement_kind NOT IN ('sale_return','purchase_return') THEN
    RETURN NEW;
  END IF;
  expected_kind := CASE WHEN NEW.movement_kind='sale_return'
                        THEN 'sale' ELSE 'purchase' END;
  SELECT * INTO original FROM erp.item_movement_events
   WHERE tenant_id=NEW.tenant_id AND branch_id=NEW.branch_id
     AND event_id=NEW.reference_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='RETURN_SOURCE_NOT_FOUND';
  END IF;
  IF original.movement_kind <> expected_kind OR
     original.posting_status <> 'POSTED' OR
     original.item_code <> NEW.item_code OR
     original.family_code <> NEW.family_code OR
     original.supplier_code <> NEW.supplier_code OR
     original.event_date > NEW.event_date OR
     NEW.quantity_milli > original.quantity_milli THEN
    RAISE EXCEPTION USING ERRCODE='23514',
      MESSAGE='RETURN_SOURCE_KIND_SCOPE_OR_QUANTITY_INVALID';
  END IF;
  RETURN NEW;
END;
$return_guard$;
CREATE TRIGGER erp_return_lineage_before_insert
  BEFORE INSERT ON erp.item_movement_events
  FOR EACH ROW EXECUTE FUNCTION erp.verify_movement_return_origin();

-- Fast read-only fraud-review index. Multiple partial returns across
-- transactions still need an independently audited cumulative cap.
CREATE INDEX item_movement_origin_returns
  ON erp.item_movement_events
  (tenant_id, branch_id, reference_event_id, posting_status)
  WHERE reference_event_id IS NOT NULL;

-- All original ERP financial events are append-only. Corrections must use
-- separately authorized compensating events; neither update nor delete.
CREATE TRIGGER erp_branches_no_update_delete
  BEFORE UPDATE OR DELETE ON erp.branches
  FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();
CREATE TRIGGER erp_branch_access_no_update_delete
  BEFORE UPDATE OR DELETE ON erp.report_branch_access_events
  FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();
CREATE TRIGGER erp_item_movements_no_update_delete
  BEFORE UPDATE OR DELETE ON erp.item_movement_events
  FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();

ALTER TABLE erp.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.report_branch_access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.item_movement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.branches FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.report_branch_access_events FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.item_movement_events FORCE ROW LEVEL SECURITY;

CREATE POLICY branches_tenant_read ON erp.branches FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id',true),'')::uuid);
CREATE POLICY branch_access_tenant_read ON erp.report_branch_access_events FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id',true),'')::uuid);
CREATE POLICY movement_events_tenant_read ON erp.item_movement_events FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id',true),'')::uuid);

GRANT SELECT ON erp.branches, erp.report_branch_access_events,
  erp.current_report_branch_access, erp.item_movement_events TO erp_api_reader;
-- Never grant INSERT/UPDATE/DELETE/DDL to the ERP API read login.
COMMIT;
