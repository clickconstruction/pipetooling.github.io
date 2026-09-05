SET lock_timeout = '3s';

-- v2.2873 (journey-map J17-F6 / N1 / N2, Tier-2 #34): estimates can be declined.
--
-- `declined` has sat in the estimate_status enum since the baseline with no writer anywhere:
-- the customer's only "no" was silence and the office could not record a phone "no" either,
-- so dead estimates aged in the Pipeline's Sent bucket wearing "sent Nd ago — nudge?" chips.
--
-- 1. estimate_customer_events learns event_type 'declined' (metadata.by = customer | staff,
--    metadata.note, and for staff metadata.channel + metadata.user_id) and the staff source
--    'record_estimate_decline'.
-- 2. log_estimate_customer_event accepts the widened sets. It also finally accepts
--    'option_viewed' / 'log-estimate-option-view' — the CHECKs allowed them since
--    20260828193012 but this RPC still rejected them, so the shared logger fell through to
--    its plain-insert fallback on every option view (worked, but logged an error each time).
-- 3. record_estimate_decline(p_estimate_id, p_note, p_channel): the staff writer — one
--    SECURITY DEFINER RPC that flips sent → declined and appends the event in the same
--    transaction. Gated like estimates_select (staff roles + user_can_access_estimate /
--    superintendent_can_access_estimate / office-wide roles). Read-only users are stopped
--    by the read_only_block_stmt trigger on estimates (v2.704), as with every RPC.
--
-- The customer door (`accept-estimate` with action: 'decline', service role) writes the same
-- shape with source 'accept-estimate'.

ALTER TABLE public.estimate_customer_events
  DROP CONSTRAINT IF EXISTS estimate_customer_events_event_type_check;
ALTER TABLE public.estimate_customer_events
  ADD CONSTRAINT estimate_customer_events_event_type_check
  CHECK (event_type = ANY (ARRAY['public_link_view'::text, 'public_accept_submitted'::text, 'option_viewed'::text, 'declined'::text]));

ALTER TABLE public.estimate_customer_events
  DROP CONSTRAINT IF EXISTS estimate_customer_events_source_check;
ALTER TABLE public.estimate_customer_events
  ADD CONSTRAINT estimate_customer_events_source_check
  CHECK (source = ANY (ARRAY['get-estimate-for-customer'::text, 'accept-estimate'::text, 'log-estimate-option-view'::text, 'record_estimate_decline'::text]));

COMMENT ON COLUMN public.estimate_customer_events.event_type IS
  'public_link_view: successful get-estimate-for-customer 200 (office previews with ?preview=1 are not stamped); public_accept_submitted: successful accept-estimate; option_viewed: customer selected/inspected an option on the acceptance page (metadata.option_key/option_name); declined: the estimate was declined (metadata.by = customer | staff, metadata.note; staff rows add metadata.channel + metadata.user_id).';

COMMENT ON COLUMN public.estimate_customer_events.source IS
  'Edge function (or RPC, for record_estimate_decline) that recorded the event.';

CREATE OR REPLACE FUNCTION public.log_estimate_customer_event(
  p_estimate_id uuid,
  p_event_type text,
  p_source text,
  p_client_ip text,
  p_user_agent text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_event_type NOT IN ('public_link_view', 'public_accept_submitted', 'option_viewed', 'declined') THEN
    RAISE EXCEPTION 'log_estimate_customer_event: invalid event_type';
  END IF;
  IF p_source NOT IN ('get-estimate-for-customer', 'accept-estimate', 'log-estimate-option-view', 'record_estimate_decline') THEN
    RAISE EXCEPTION 'log_estimate_customer_event: invalid source';
  END IF;

  INSERT INTO public.estimate_customer_events (
    estimate_id,
    event_type,
    source,
    client_ip,
    user_agent,
    metadata
  )
  VALUES (
    p_estimate_id,
    p_event_type,
    p_source,
    NULLIF(trim(p_client_ip), ''),
    NULLIF(trim(p_user_agent), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_estimate_customer_event(uuid, text, text, text, text, jsonb) IS
  'Inserts estimate_customer_events row. Edge only (GRANT service_role). v2.2873: accepts option_viewed and declined.';

CREATE OR REPLACE FUNCTION public.record_estimate_decline(
  p_estimate_id uuid,
  p_note text DEFAULT '',
  p_channel text DEFAULT 'phone'
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.estimates%ROWTYPE;
  v_note text := left(btrim(regexp_replace(COALESCE(p_note, ''), '\s+', ' ', 'g')), 280);
  v_channel text := CASE WHEN p_channel IN ('phone', 'in_person', 'email', 'text', 'other') THEN p_channel ELSE 'other' END;
  v_event_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid
      AND u.role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent')
  ) THEN
    RAISE EXCEPTION 'You do not have access to estimates' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.estimates e WHERE e.id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  IF NOT (
    public.user_can_access_estimate(v_row)
    OR public.superintendent_can_access_estimate(v_row)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = v_uid
        AND u.role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary')
    )
  ) THEN
    RAISE EXCEPTION 'You do not have access to this estimate' USING ERRCODE = '42501';
  END IF;

  IF v_row.status IS DISTINCT FROM 'sent'::public.estimate_status THEN
    RAISE EXCEPTION 'Only a sent estimate can be marked declined (this one is %)', v_row.status;
  END IF;

  UPDATE public.estimates
     SET status = 'declined'::public.estimate_status
   WHERE id = p_estimate_id
     AND status = 'sent'::public.estimate_status;

  INSERT INTO public.estimate_customer_events (
    estimate_id, event_type, source, client_ip, user_agent, metadata
  ) VALUES (
    p_estimate_id,
    'declined',
    'record_estimate_decline',
    NULL,
    NULL,
    jsonb_build_object('by', 'staff', 'channel', v_channel, 'note', v_note, 'user_id', v_uid)
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('ok', true, 'estimate_id', p_estimate_id, 'event_id', v_event_id);
END;
$$;

COMMENT ON FUNCTION public.record_estimate_decline(uuid, text, text) IS
  'Staff writer for a decline the office heard by phone / in person (v2.2873): sent → declined + an estimate_customer_events row (event_type declined, metadata.by = staff, channel, note, user_id) in one transaction. Same access gate as estimates_select.';

REVOKE ALL ON FUNCTION public.record_estimate_decline(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_estimate_decline(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_estimate_decline(uuid, text, text) TO authenticated;
