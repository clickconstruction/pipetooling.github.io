-- Reliable public link view audit: SECURITY DEFINER RPC (same pattern as accept trigger / log_estimate_customer_event).

CREATE OR REPLACE FUNCTION public.record_estimate_public_link_view(
  p_estimate_id uuid,
  p_client_ip text DEFAULT '',
  p_user_agent text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = p_estimate_id AND e.status = 'sent'
  ) THEN
    RETURN;
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
    'public_link_view',
    'get-estimate-for-customer',
    NULLIF(btrim(COALESCE(p_client_ip, '')), ''),
    NULLIF(btrim(COALESCE(p_user_agent, '')), ''),
    '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_estimate_public_link_view(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_estimate_public_link_view(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.record_estimate_public_link_view(uuid, text, text) IS
  'Appends public_link_view when customer GET loads sent quote; Edge service_role only.';
