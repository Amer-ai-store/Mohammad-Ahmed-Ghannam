-- NEW JAWAFA ERP AI database ONLY. Do not apply to Jawafa_DB or TrustSoft.
-- Reference prototype: supplier-specific invoice number duplication prevention.
-- Functional equivalence to TrustSoft has NOT been verified.
BEGIN;

CREATE OR REPLACE FUNCTION erp.normalize_supplier_invoice_ref(raw_ref text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT upper(
    regexp_replace(
      translate(btrim(raw_ref), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
      '[[:space:]]+', '', 'g'
    )
  )
$$;

CREATE TABLE erp.suppliers (
  supplier_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES erp.tenants(tenant_id),
  supplier_code text NOT NULL CHECK (length(btrim(supplier_code)) > 0),
  legal_name text NOT NULL CHECK (length(btrim(legal_name)) > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, supplier_id),
  UNIQUE (tenant_id, supplier_code)
);

CREATE TABLE erp.purchase_invoices (
  purchase_invoice_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  original_invoice_number text NOT NULL,
  invoice_number_key text GENERATED ALWAYS AS
    (erp.normalize_supplier_invoice_ref(original_invoice_number)) STORED,
  invoice_date date NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'JOD',
  total_fils bigint NOT NULL CHECK (total_fils > 0),
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES erp.suppliers (tenant_id, supplier_id),
  UNIQUE (tenant_id, purchase_invoice_id),
  UNIQUE (tenant_id, supplier_id, invoice_number_key),
  CHECK (length(btrim(original_invoice_number)) > 0),
  CHECK (length(erp.normalize_supplier_invoice_ref(original_invoice_number)) > 0),
  CHECK (length(original_invoice_number) <= 120),
  CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE TABLE erp.purchase_invoice_lines (
  line_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  purchase_invoice_id uuid NOT NULL,
  line_no integer NOT NULL CHECK (line_no > 0),
  item_reference text NOT NULL CHECK (length(btrim(item_reference)) > 0),
  quantity_milliunits bigint NOT NULL CHECK (quantity_milliunits > 0),
  net_fils bigint NOT NULL CHECK (net_fils >= 0),
  tax_fils bigint NOT NULL CHECK (tax_fils >= 0),
  gross_fils bigint GENERATED ALWAYS AS (net_fils + tax_fils) STORED,
  FOREIGN KEY (tenant_id, purchase_invoice_id)
    REFERENCES erp.purchase_invoices (tenant_id, purchase_invoice_id),
  UNIQUE (tenant_id, purchase_invoice_id, line_no),
  CHECK (net_fils <= 9223372036854775807 - tax_fils)
);

CREATE TRIGGER reject_purchase_invoice_update_delete
BEFORE UPDATE OR DELETE ON erp.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();
CREATE TRIGGER reject_purchase_line_update_delete
BEFORE UPDATE OR DELETE ON erp.purchase_invoice_lines
FOR EACH ROW EXECUTE FUNCTION erp.reject_financial_mutation();

ALTER TABLE erp.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.purchase_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.suppliers FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.purchase_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE erp.purchase_invoice_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY supplier_read ON erp.suppliers FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id',true),'')::uuid);
CREATE POLICY purchase_invoice_read ON erp.purchase_invoices FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id',true),'')::uuid);
CREATE POLICY purchase_invoice_lines_read ON erp.purchase_invoice_lines FOR SELECT
  USING (tenant_id = NULLIF(current_setting('erp.tenant_id',true),'')::uuid);

-- This is a read-only draft validation view. Nothing is posted to GL/bank.
CREATE VIEW erp.purchase_invoice_draft_checks
WITH (security_invoker = true) AS
SELECT i.tenant_id, i.purchase_invoice_id, i.supplier_id,
       i.original_invoice_number, i.invoice_number_key,
       i.currency_code, i.total_fils,
       count(l.line_id)::integer AS line_count,
       coalesce(sum(l.net_fils::numeric),0)::numeric AS net_fils,
       coalesce(sum(l.tax_fils::numeric),0)::numeric AS tax_fils,
       coalesce(sum(l.gross_fils::numeric),0)::numeric AS lines_gross_fils,
       (
         count(l.line_id) > 0
         AND coalesce(sum(l.gross_fils::numeric),0) = i.total_fils
       ) AS draft_total_matches_lines
FROM erp.purchase_invoices i
LEFT JOIN erp.purchase_invoice_lines l
  ON l.tenant_id = i.tenant_id
 AND l.purchase_invoice_id = i.purchase_invoice_id
GROUP BY i.tenant_id,i.purchase_invoice_id,i.supplier_id,
         i.original_invoice_number,i.invoice_number_key,i.currency_code,
         i.total_fils;

-- The OIDC-backed API may READ, but never write, financial originals.
GRANT SELECT ON erp.suppliers, erp.purchase_invoices, erp.purchase_invoice_lines,
 erp.purchase_invoice_draft_checks TO erp_api_reader;
COMMIT;
