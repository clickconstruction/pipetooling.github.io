-- Dedupe rapid repeat public_link_view rows (same estimate, IP, UA within a few seconds),
-- e.g. React18 Strict Mode double useEffect in dev or duplicate client fetches.

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
DECLARE
  v_ip text := NULLIF(btrim(COALESCE(p_client_ip, '')), '');
  v_ua text := NULLIF(btrim(COALESCE(p_user_agent, '')), '');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = p_estimate_id AND e.status = 'sent'
  ) THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_estimate_id::text));

  IF EXISTS (
    SELECT 1 FROM public.estimate_customer_events ece
    WHERE ece.estimate_id = p_estimate_id
      AND ece.event_type = 'public_link_view'
      AND ece.occurred_at > now() - interval '5 seconds'
      AND ece.client_ip IS NOT DISTINCT FROM v_ip
      AND ece.user_agent IS NOT DISTINCT FROM v_ua
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
    v_ip,
    v_ua,
    '{}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.record_estimate_public_link_view(uuid, text, text) IS
  'Appends public_link_view when customer GET loads sent quote; skips duplicate same IP/UA within 5s; Edge service_role only.';
