SET lock_timeout = '3s';

-- v2.5992 (punch list #204 PR 1): a sent estimate's good-through date can be extended, and the link
-- the customer has keeps working.
--
-- A city's estimate (#156, 2026-10-27) sat with the city's five people, each holding a copy of the
-- one emailed link, through four weeks of their approval. When `valid_until` passed, the accept page
-- answered 410 "Estimate expired", Resend was refused (`pricing_expired`), and the office remade the
-- estimate by hand. Nothing on the sent view could move the date.
--
-- 1. estimate_customer_events learns event_type 'good_through_extended' (metadata.from, metadata.to,
--    metadata.user_id, metadata.user_name) and the staff source 'extend_estimate_good_through'.
-- 2. log_estimate_customer_event accepts the widened sets.
-- 3. extend_estimate_good_through(p_estimate_id, p_valid_until): the staff writer — one SECURITY
--    DEFINER RPC that sets the new day, pushes the link's own end (`public_token_expires_at`) and every
--    shared link's (`estimate_share_links.expires_at`) to at least the end of that day in the company's
--    zone, never earlier, and appends the event in the same transaction. The token hash is untouched:
--    every copy of the link the customer passed around keeps working (the owner's call 1 of #204).
--    Gated like record_estimate_decline. Read-only users are stopped by the read_only_block_stmt
--    trigger on estimates, twins by the digital-twin fence.

ALTER TABLE public.estimate_customer_events
  DROP CONSTRAINT IF EXISTS estimate_customer_events_event_type_check;
ALTER TABLE public.estimate_customer_events
  ADD CONSTRAINT estimate_customer_events_event_type_check
  CHECK (event_type = ANY (ARRAY['public_link_view'::text, 'public_accept_submitted'::text, 'option_viewed'::text, 'declined'::text, 'good_through_extended'::text]));

ALTER TABLE public.estimate_customer_events
  DROP CONSTRAINT IF EXISTS estimate_customer_events_source_check;
ALTER TABLE public.estimate_customer_events
  ADD CONSTRAINT estimate_customer_events_source_check
  CHECK (source = ANY (ARRAY['get-estimate-for-customer'::text, 'accept-estimate'::text, 'log-estimate-option-view'::text, 'record_estimate_decline'::text, 'extend_estimate_good_through'::text]));

COMMENT ON COLUMN public.estimate_customer_events.event_type IS
  'public_link_view: successful get-estimate-for-customer 200 (office previews with ?preview=1 are not stamped); public_accept_submitted: successful accept-estimate; option_viewed: customer selected/inspected an option on the acceptance page (metadata.option_key/option_name); declined: the estimate was declined (metadata.by = customer | staff, metadata.note; staff rows add metadata.channel + metadata.user_id); good_through_extended: the office moved the good-through date (metadata.from, metadata.to, metadata.user_id, metadata.user_name).';

COMMENT ON COLUMN public.estimate_customer_events.source IS
  'Edge function (or RPC, for record_estimate_decline and extend_estimate_good_through) that recorded the event.';

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
  IF p_event_type NOT IN ('public_link_view', 'public_accept_submitted', 'option_viewed', 'declined', 'good_through_extended') THEN
    RAISE EXCEPTION 'log_estimate_customer_event: invalid event_type';
  END IF;
  IF p_source NOT IN ('get-estimate-for-customer', 'accept-estimate', 'log-estimate-option-view', 'record_estimate_decline', 'extend_estimate_good_through') THEN
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
  'Inserts estimate_customer_events row. Edge only (GRANT service_role). v2.2873: accepts option_viewed and declined; v2.5992: good_through_extended.';

CREATE OR REPLACE FUNCTION public.extend_estimate_good_through(
  p_estimate_id uuid,
  p_valid_until date
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.estimates%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_link_end timestamptz;
  v_name text;
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

  IF p_valid_until IS NULL THEN
    RAISE EXCEPTION 'Pick the day the pricing is good through.';
  END IF;
  IF p_valid_until < v_today THEN
    RAISE EXCEPTION 'The good-through day must be today or later.';
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
    RAISE EXCEPTION 'Only a sent estimate can have its good-through date extended (this one is %)', v_row.status;
  END IF;
  IF v_row.bid_room_id IS NOT NULL THEN
    RAISE EXCEPTION 'This change order lives in the bid room; the GC signs it there.';
  END IF;

  -- The link lives through the end of the new day in the company's calendar: midnight that starts the
  -- next day, in America/Chicago. Never earlier than what the row or a shared link already has.
  v_link_end := ((p_valid_until + 1)::timestamp AT TIME ZONE 'America/Chicago');

  UPDATE public.estimates
     SET valid_until = p_valid_until,
         public_token_expires_at = GREATEST(COALESCE(public_token_expires_at, v_link_end), v_link_end)
   WHERE id = p_estimate_id
     AND status = 'sent'::public.estimate_status;

  UPDATE public.estimate_share_links
     SET expires_at = GREATEST(expires_at, v_link_end)
   WHERE estimate_id = p_estimate_id;

  SELECT NULLIF(btrim(u.name), '') INTO v_name FROM public.users u WHERE u.id = v_uid;

  INSERT INTO public.estimate_customer_events (
    estimate_id, event_type, source, client_ip, user_agent, metadata
  ) VALUES (
    p_estimate_id,
    'good_through_extended',
    'extend_estimate_good_through',
    NULL,
    NULL,
    jsonb_build_object('from', v_row.valid_until, 'to', p_valid_until, 'user_id', v_uid, 'user_name', v_name)
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'estimate_id', p_estimate_id,
    'valid_until', p_valid_until,
    'link_expires_at', v_link_end,
    'event_id', v_event_id
  );
END;
$$;

COMMENT ON FUNCTION public.extend_estimate_good_through(uuid, date) IS
  'Staff writer for a sent estimate''s good-through date (v2.5992, punch list #204): sets valid_until to a day today or later, pushes public_token_expires_at and every estimate_share_links.expires_at to at least the end of that day in America/Chicago (the hash is untouched, so every copy of the link keeps working), and appends an estimate_customer_events row (good_through_extended; metadata.from, to, user_id, user_name) in one transaction. Same access gate as record_estimate_decline.';

REVOKE ALL ON FUNCTION public.extend_estimate_good_through(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extend_estimate_good_through(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.extend_estimate_good_through(uuid, date) TO authenticated;
