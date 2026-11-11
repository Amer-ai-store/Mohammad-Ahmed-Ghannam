-- Add transaction-level READ ONLY financial validation view to the NEW ERP database.
-- Not a TrustSoft migration. No real posting is performed by this view.
BEGIN;
CREATE OR REPLACE VIEW erp.journal_draft_balance
WITH (security_invoker = true)
AS
SELECT h.tenant_id,
       h.journal_id,
       h.journal_ref,
       count(l.journal_line_id)::integer AS line_count,
       COALESCE(sum(l.debit_fils::numeric),0)::numeric AS debit_total_fils,
       COALESCE(sum(l.credit_fils::numeric),0)::numeric AS credit_total_fils,
       (
         count(l.journal_line_id) >= 2
         AND COALESCE(sum(l.debit_fils::numeric),0) > 0
         AND COALESCE(sum(l.debit_fils::numeric),0)
             = COALESCE(sum(l.credit_fils::numeric),0)
       ) AS balanced_for_review
FROM erp.journal_headers h
LEFT JOIN erp.journal_lines l
  ON l.tenant_id = h.tenant_id AND l.journal_id = h.journal_id
GROUP BY h.tenant_id, h.journal_id, h.journal_ref;

-- Security invoker ensures the caller's underlying table RLS policies apply.
-- No grants to browser/client or financial posting roles are created here.
COMMIT;
