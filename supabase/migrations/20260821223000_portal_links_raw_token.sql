SET lock_timeout = '3s';

-- Portal links v2 (portal train PR 4): store the RAW token.
--
-- v1 (20260821213000) stored only a sha256 hash — leak-hardened, but it made
-- the globe modal's core flow impossible: an existing link could never be
-- shown again, so "click the globe → copy/preview the customer's portal"
-- only worked in the same breath as minting. These links expose the same
-- data class as Stripe hosted-invoice URLs, which this schema already stores
-- raw; the usability of a re-showable link wins, and rotation stays one
-- click. Legacy hash-only rows (there is exactly one, already rotated blind)
-- are revoked — their raw tokens are unrecoverable by design.

ALTER TABLE public.customer_portal_links ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE public.customer_portal_links ALTER COLUMN token_hash DROP NOT NULL;

UPDATE public.customer_portal_links SET revoked_at = now()
WHERE token IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_portal_links_token
  ON public.customer_portal_links (token)
  WHERE token IS NOT NULL;

COMMENT ON COLUMN public.customer_portal_links.token IS
  'Raw portal link token (v2). v1 hash-only rows have token NULL and were revoked at migration.';

-- Mint v2: returns the EXISTING active link''s token when present (no rotate
-- needed just to look at it); p_rotate still revokes + re-mints.
CREATE OR REPLACE FUNCTION public.mint_customer_portal_link(
  p_customer_id uuid,
  p_audience text DEFAULT 'customer',
  p_rotate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ok boolean;
  v_raw text;
  v_row record;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized to manage portal links');
  END IF;
  IF p_audience NOT IN ('customer', 'gc') THEN
    RETURN jsonb_build_object('error', 'Unknown audience');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = p_customer_id) THEN
    RETURN jsonb_build_object('error', 'Customer not found');
  END IF;

  SELECT token, created_at INTO v_row
  FROM public.customer_portal_links
  WHERE customer_id = p_customer_id AND audience = p_audience AND revoked_at IS NULL;

  IF v_row.token IS NOT NULL AND NOT p_rotate THEN
    RETURN jsonb_build_object('token', v_row.token, 'audience', p_audience, 'activeSince', v_row.created_at);
  END IF;

  UPDATE public.customer_portal_links
  SET revoked_at = now()
  WHERE customer_id = p_customer_id AND audience = p_audience AND revoked_at IS NULL;

  v_raw := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO public.customer_portal_links (customer_id, audience, token, token_hash, created_by)
  VALUES (p_customer_id, p_audience, v_raw, encode(digest(v_raw, 'sha256'), 'hex'), auth.uid());

  RETURN jsonb_build_object('token', v_raw, 'audience', p_audience, 'activeSince', now());
END;
$$;

COMMENT ON FUNCTION public.mint_customer_portal_link(uuid, text, boolean) IS
  'v2: returns the existing active link''s raw token (or mints one); p_rotate revokes + re-mints. Office writers (dev/master/assistant-like).';

-- Revoke without replacement — the kill switch the globe modal offers.
CREATE OR REPLACE FUNCTION public.revoke_customer_portal_link(
  p_customer_id uuid,
  p_audience text DEFAULT 'customer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_count int;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized to manage portal links');
  END IF;

  UPDATE public.customer_portal_links
  SET revoked_at = now()
  WHERE customer_id = p_customer_id AND audience = p_audience AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_count);
END;
$$;

COMMENT ON FUNCTION public.revoke_customer_portal_link(uuid, text) IS
  'Revoke the active portal link for a customer+audience without replacement. Office writers.';

REVOKE EXECUTE ON FUNCTION public.revoke_customer_portal_link(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_customer_portal_link(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_customer_portal_link(uuid, text) TO authenticated;
