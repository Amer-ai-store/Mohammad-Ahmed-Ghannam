-- Disposable PostgreSQL CI: new ERP, fictional invoices only, ROLLBACK.
BEGIN;

INSERT INTO erp.tenants(tenant_id,display_name) VALUES
 ('11111111-1111-4111-8111-111111111111','Synthetic Company A'),
 ('22222222-2222-4222-8222-222222222222','Synthetic Company B');

INSERT INTO erp.suppliers (supplier_id,tenant_id,supplier_code,legal_name) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','SUP-1','Synthetic Supplier A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '11111111-1111-4111-8111-111111111111','SUP-2','Synthetic Supplier B'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '22222222-2222-4222-8222-222222222222','SUP-1','Synthetic Supplier C');

INSERT INTO erp.purchase_invoices
 (purchase_invoice_id,tenant_id,supplier_id,original_invoice_number,
  invoice_date,currency_code,total_fils,created_by)
VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',' inv-١٢٣ ',
  date '2026-11-01','JOD',10000,'maker-1');

DO $$
BEGIN
  IF (SELECT invoice_number_key FROM erp.purchase_invoices
      WHERE purchase_invoice_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')
     <> 'INV-123' THEN
    RAISE EXCEPTION 'NORMALIZATION_FAILED';
  END IF;
END $$;

-- Same supplier + same number after Arabic/Persian/Latin digit normalization
-- MUST be rejected by a durable SQL UNIQUE constraint.
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.purchase_invoices
     (purchase_invoice_id,tenant_id,supplier_id,original_invoice_number,
      invoice_date,currency_code,total_fils,created_by)
    VALUES
     ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',' InV-۱۲۳ ',
      date '2026-11-02','JOD',15000,'maker-2');
    RAISE EXCEPTION 'DUPLICATE_SUPPLIER_INVOICE_WAS_ALLOWED';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- Same supplier invoice number under DIFFERENT suppliers and companies
-- is permitted (unless a separate future regulatory rule disallows it).
INSERT INTO erp.purchase_invoices
 (purchase_invoice_id,tenant_id,supplier_id,original_invoice_number,
  invoice_date,currency_code,total_fils,created_by)
VALUES
 ('ffffffff-ffff-4fff-8fff-ffffffffffff',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','inv-123',
  date '2026-11-01','JOD',12000,'maker-3'),
 ('99999999-9999-4999-8999-999999999999',
  '22222222-2222-4222-8222-222222222222',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','inv-123',
  date '2026-11-01','JOD',8000,'maker-4');

INSERT INTO erp.purchase_invoice_lines
 (line_id,tenant_id,purchase_invoice_id,line_no,item_reference,
  quantity_milliunits,net_fils,tax_fils)
VALUES
 ('aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,'SYN-ITEM-1',2000,5000,800),
 ('aaaaaaaa-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',2,'SYN-ITEM-2',1000,4200,0);

DO $$
BEGIN
  IF NOT (SELECT draft_total_matches_lines FROM erp.purchase_invoice_draft_checks
      WHERE purchase_invoice_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') THEN
    RAISE EXCEPTION 'BALANCED_PURCHASE_INVOICE_FAILED';
  END IF;
  IF (SELECT tax_fils FROM erp.purchase_invoice_draft_checks
      WHERE purchase_invoice_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 800
  THEN RAISE EXCEPTION 'PURCHASE_TAX_RECONCILIATION_FAILED'; END IF;
  IF (SELECT draft_total_matches_lines FROM erp.purchase_invoice_draft_checks
      WHERE purchase_invoice_id='ffffffff-ffff-4fff-8fff-ffffffffffff')
  THEN RAISE EXCEPTION 'EMPTY_LINES_PURCHASE_INVOICE_FALSE_POSITIVE'; END IF;
END $$;

-- Cross-company supplier references MUST fail at the composite FOREIGN KEY.
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.purchase_invoices
     (purchase_invoice_id,tenant_id,supplier_id,original_invoice_number,
      invoice_date,total_fils,created_by)
    VALUES
     ('12345678-0000-4000-8000-000000000001',
      '11111111-1111-4111-8111-111111111111',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'CROSS-TENANT-FORGED', date '2026-11-01', 1,'attacker');
    RAISE EXCEPTION 'CROSS_TENANT_SUPPLIER_WAS_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- Amount/header/line history is immutable, including for privileged migrator.
DO $$
BEGIN
  BEGIN
    UPDATE erp.purchase_invoices SET total_fils=1
       WHERE purchase_invoice_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    RAISE EXCEPTION 'PURCHASE_TOTAL_MUTATION_WAS_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
  END;
END $$;
DO $$
BEGIN
  BEGIN
    DELETE FROM erp.purchase_invoice_lines
     WHERE purchase_invoice_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    RAISE EXCEPTION 'PURCHASE_LINE_DELETION_WAS_ALLOWED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'IMMUTABLE_ERP_AUDIT%' THEN RAISE; END IF;
  END;
END $$;

CREATE ROLE erp_ci_supplier_reader NOLOGIN;
GRANT USAGE ON SCHEMA erp TO erp_ci_supplier_reader;
GRANT SELECT ON erp.suppliers,erp.purchase_invoices,
 erp.purchase_invoice_lines,erp.purchase_invoice_draft_checks
 TO erp_ci_supplier_reader;
SET ROLE erp_ci_supplier_reader;
SET erp.tenant_id='11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.purchase_invoice_draft_checks) <> 2 THEN
    RAISE EXCEPTION 'SUPPLIER_TENANT_A_ISOLATION_FAILED';
  END IF;
END $$;
SET erp.tenant_id='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.purchase_invoice_draft_checks) <> 1 THEN
    RAISE EXCEPTION 'SUPPLIER_TENANT_B_ISOLATION_FAILED';
  END IF;
END $$;
SET erp.tenant_id='';
DO $$
BEGIN
  IF (SELECT count(*) FROM erp.purchase_invoice_draft_checks) <> 0 THEN
    RAISE EXCEPTION 'SUPPLIER_FAIL_CLOSED_TENANT_CONTEXT_FAILED';
  END IF;
END $$;
DO $$
BEGIN
  BEGIN
    INSERT INTO erp.purchase_invoices
     (purchase_invoice_id,tenant_id,supplier_id,original_invoice_number,
      invoice_date,total_fils,created_by)
    VALUES
     ('99999999-0000-4000-8000-000000000001',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'ATTEMPTED-WRITE',date '2026-11-01',1,'attacker');
    RAISE EXCEPTION 'READ_ONLY_SUPPLIER_ROLE_COULD_INSERT';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: supplier invoice duplication (Arabic/Persian), tenant isolation, draft tax totals, and immutable lines' AS result;
