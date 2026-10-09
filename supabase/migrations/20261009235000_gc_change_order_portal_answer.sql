SET lock_timeout = '3s';

-- GC mode, Owner Billing's O7c: the customer answers a change order in their portal (v2.5025). O3's
-- gc_answer_change_order refused every call with no signed-in user, so the portal's press, which runs as the service
-- role, could not land; and a signed-in user could say how = 'portal'. It is restated with O7a's acceptance gate:
-- how = 'portal' runs only as the service role (submit-portal-request, which checks the portal link's customer), and
-- how = 'office' needs a sign-in, as before. A decline may carry the customer's reason, one short line, kept on the
-- change order and shown to the office; never required (the lead's call, 2026-10-09). Otherwise O3's body as it was.

ALTER TABLE public.gc_change_orders
  ADD COLUMN IF NOT EXISTS declined_note text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gc_change_orders_declined_note_short' AND conrelid = 'public.gc_change_orders'::regclass
  ) THEN
    ALTER TABLE public.gc_change_orders ADD CONSTRAINT gc_change_orders_declined_note_short
      CHECK (length(declined_note) <= 300 AND position(E'\n' IN declined_note) = 0);
  END IF;
END $$;

COMMENT ON COLUMN public.gc_change_orders.declined_note IS
  'GC mode (O7c, v2.5025): the customer''s reason for declining, one short line, as they gave it in their portal or the office recorded it. Empty: none given, or the change order was signed.';

-- The new parameter changes the function's signature, so O3's is dropped first.
DROP FUNCTION IF EXISTS public.gc_answer_change_order(uuid, boolean, date, text);

-- The customer's answer (the prototype's ownerSignChangeOrder and ownerDeclineChangeOrder): signed
-- or declined on a day, recorded by the office from their signed copy (decision 5) or pressed in
-- their portal (O7c, through the service role's own path). Only a change order that went, and not
-- before the day it went.
CREATE OR REPLACE FUNCTION public.gc_answer_change_order(p_id uuid, p_signed boolean, p_on date, p_how text DEFAULT 'office', p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_change_orders%ROWTYPE;
  v_note text := btrim(COALESCE(p_note, ''));
BEGIN
  IF p_how = 'portal' AND current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the customer''s portal records an answer as theirs.';
  END IF;
  IF p_how = 'office' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to record the customer''s answer.';
  END IF;
  IF p_how IS NULL OR p_how NOT IN ('office', 'portal') THEN
    RAISE EXCEPTION 'The answer is recorded by the office or pressed in their portal.';
  END IF;
  SELECT * INTO v FROM public.gc_change_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change order is not there.';
  END IF;
  IF v.status <> 'sent' THEN
    RAISE EXCEPTION 'Change order % is not waiting on the customer.', v.number;
  END IF;
  IF p_signed IS NULL OR p_on IS NULL THEN
    RAISE EXCEPTION 'Say whether they signed it, and the day.';
  END IF;
  IF p_on < v.sent_on THEN
    RAISE EXCEPTION 'They can''t answer before it went on %.', to_char(v.sent_on, 'Mon FMDD');
  END IF;
  IF length(v_note) > 300 OR position(E'\n' IN v_note) > 0 THEN
    RAISE EXCEPTION 'Keep the reason to one short line.';
  END IF;
  UPDATE public.gc_change_orders
  SET status = CASE WHEN p_signed THEN 'signed' ELSE 'declined' END, answered_on = p_on, answered_how = p_how,
      declined_note = CASE WHEN p_signed THEN '' ELSE v_note END
  WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.gc_answer_change_order(uuid, boolean, date, text, text) IS
  'GC mode (O3, restated by O7c): records the customer''s signature or decline on a sent change order, by the office (signed in) or from their portal (the service role only), a decline with an optional one-line reason. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_answer_change_order(uuid, boolean, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_answer_change_order(uuid, boolean, date, text, text) TO authenticated, service_role;
