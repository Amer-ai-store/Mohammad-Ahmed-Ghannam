-- JAWAFA ERP AI (NEW PostgreSQL database only): cheque lifecycle guard v0.
-- Do NOT run this on Jawafa_DB / SQL Server / the original TrustSoft.
-- This is server-side prototype enforcement, NOT verified TrustSoft parity
-- or production-safe maker/checker identity authentication.
BEGIN;

CREATE OR REPLACE FUNCTION erp.validate_cheque_event_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, erp
AS $$
DECLARE
  v_direction text;
  v_maker text;
  v_expected text := 'draft';
  v_previous_at timestamptz;
  v_allowed boolean := false;
BEGIN
  -- Serialize parallel attempts for the same cheque. Never modify the source
  -- financial amount: row-level lock only, append events only.
  SELECT direction, created_by
    INTO v_direction, v_maker
    FROM erp.cheques
   WHERE tenant_id = NEW.tenant_id AND cheque_id = NEW.cheque_id
   FOR UPDATE;

  -- Let the existing composite FK reject an absent or foreign-tenant cheque.
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF btrim(NEW.actor_subject) = '' OR NEW.command_id IS NULL
     OR btrim(NEW.command_id) = '' THEN
    RAISE EXCEPTION 'ERP_CHEQUE_ACTOR_OR_COMMAND_REQUIRED';
  END IF;
  SELECT state_after, event_time
    INTO v_expected, v_previous_at
    FROM erp.cheque_events
   WHERE tenant_id = NEW.tenant_id AND cheque_id = NEW.cheque_id
   ORDER BY event_time DESC, event_id DESC
   LIMIT 1;
  IF NOT FOUND THEN v_expected := 'draft'; END IF;

  -- The audit timestamp is authoritative DATABASE time, never caller time.
  -- This prevents client-provided historical/backdated event timestamps.
  NEW.event_time := clock_timestamp();
  NEW.recorded_at := NEW.event_time;

  IF NEW.state_before IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'ERP_CHEQUE_STALE_OR_INVALID_PREVIOUS_STATE';
  END IF;
  IF v_previous_at IS NOT NULL AND NEW.event_time <= v_previous_at THEN
    RAISE EXCEPTION 'ERP_CHEQUE_NON_MONOTONIC_EVENT_TIME';
  END IF;
  IF NEW.event_time IS NULL OR NEW.state_after IS NULL THEN
    RAISE EXCEPTION 'ERP_CHEQUE_EVENT_FIELDS_REQUIRED';
  END IF;

  v_allowed := (
    (v_expected = 'draft' AND NEW.state_after IN ('registered','cancelled'))
    OR (v_expected = 'registered' AND NEW.state_after = 'cancelled')
    OR (v_expected = 'registered' AND v_direction = 'received'
        AND NEW.state_after = 'deposited')
    OR (v_expected = 'registered' AND v_direction = 'issued'
        AND NEW.state_after = 'delivered')
    OR (v_expected = 'deposited' AND v_direction = 'received'
        AND NEW.state_after IN ('cleared','returned'))
    OR (v_expected = 'delivered' AND v_direction = 'issued'
        AND NEW.state_after IN ('cleared','returned'))
  );
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'ERP_CHEQUE_TRANSITION_FORBIDDEN';
  END IF;

  -- The database only checks submitted identity *separation*. It cannot
  -- prove a checker authenticated without the future private OIDC gateway.
  IF NEW.state_after <> 'registered' THEN
    IF NEW.approver_subject IS NULL OR btrim(NEW.approver_subject) = ''
      OR NEW.approver_subject = NEW.actor_subject
      OR NEW.approver_subject = v_maker THEN
      RAISE EXCEPTION 'ERP_CHEQUE_INDEPENDENT_APPROVER_REQUIRED';
    END IF;
  END IF;
  IF NEW.state_after IN ('cancelled','returned') AND
     length(btrim(NEW.reason)) < 8 THEN
    RAISE EXCEPTION 'ERP_CHEQUE_REASON_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

-- Neither an app nor a browser may call this trigger function directly.
REVOKE ALL ON FUNCTION erp.validate_cheque_event_insert() FROM PUBLIC;

CREATE TRIGGER guard_cheque_event_insert
BEFORE INSERT ON erp.cheque_events
FOR EACH ROW EXECUTE FUNCTION erp.validate_cheque_event_insert();

-- No write grants or API credentials are created. Reader uses its own
-- underlying table RLS, not a privileged definer view.
CREATE OR REPLACE VIEW erp.cheque_current_state
WITH (security_invoker = true)
AS
SELECT c.tenant_id, c.cheque_id, c.reference_no, c.direction, c.amount_fils,
       COALESCE(last_event.state_after, 'draft') AS current_state,
       last_event.event_time AS last_event_time,
       (SELECT count(*)::integer FROM erp.cheque_events ev
         WHERE ev.tenant_id = c.tenant_id
           AND ev.cheque_id = c.cheque_id) AS event_count
  FROM erp.cheques c
  LEFT JOIN LATERAL (
      SELECT e.state_after, e.event_time
        FROM erp.cheque_events e
       WHERE e.tenant_id = c.tenant_id AND e.cheque_id = c.cheque_id
       ORDER BY e.event_time DESC, e.event_id DESC
       LIMIT 1
  ) AS last_event ON true;

COMMENT ON VIEW erp.cheque_current_state IS
  'Projection from immutable cheque master and append-only events; no bank settlement validation';
COMMIT;
