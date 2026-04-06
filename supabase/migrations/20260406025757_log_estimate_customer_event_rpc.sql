-- Reliable audit write path for Edge (service_role): direct INSERT inside SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.log_estimate_customer_event(
  p_estimate_id uuid,
  p_event_type text,
  p_source text,
  p_client_ip text,
  p_user_agent text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_event_type NOT IN ('public_link_view', 'public_accept_submitted') THEN
    RAISE EXCEPTION 'log_estimate_customer_event: invalid event_type';
  END IF;
  IF p_source NOT IN ('get-estimate-for-customer', 'accept-estimate') THEN
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

REVOKE ALL ON FUNCTION public.log_estimate_customer_event(uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_estimate_customer_event(uuid, text, text, text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.log_estimate_customer_event(uuid, text, text, text, text, jsonb) IS
  'Inserts estimate_customer_events row. Edge only (GRANT service_role).';
