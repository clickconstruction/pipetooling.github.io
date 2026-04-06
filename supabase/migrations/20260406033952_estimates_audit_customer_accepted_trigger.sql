-- Record customer acceptance in estimate_customer_events when status becomes customer_accepted.
-- Runs in the same transaction as app UPDATE (e.g. accept-estimate Edge); does not depend on Edge PostgREST rpc/insert.

CREATE OR REPLACE FUNCTION public.estimates_audit_customer_accepted_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status = 'sent'
     AND NEW.status = 'customer_accepted'
  THEN
    INSERT INTO public.estimate_customer_events (
      estimate_id,
      event_type,
      source,
      client_ip,
      user_agent,
      metadata
    )
    VALUES (
      NEW.id,
      'public_accept_submitted',
      'accept-estimate',
      NULLIF(btrim(COALESCE(NEW.acceptor_ip, '')), ''),
      NULLIF(btrim(COALESCE(NEW.acceptor_user_agent, '')), ''),
      jsonb_strip_nulls(
        jsonb_build_object(
          'had_signature',
          NEW.acceptor_signature_storage_path IS NOT NULL
          AND btrim(COALESCE(NEW.acceptor_signature_storage_path, '')) <> ''
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimates_audit_customer_accepted_trigger ON public.estimates;
CREATE TRIGGER estimates_audit_customer_accepted_trigger
AFTER UPDATE OF status ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.estimates_audit_customer_accepted_row();

COMMENT ON FUNCTION public.estimates_audit_customer_accepted_row() IS
  'Appends estimate_customer_events on sent -> customer_accepted; aligns with accept-estimate Edge.';
