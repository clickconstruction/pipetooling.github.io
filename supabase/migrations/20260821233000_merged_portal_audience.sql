SET lock_timeout = '3s';

-- Merged portal audience (portal custom-links train, PR A / migration 1).
--
-- The approved portal design shows ONE merged statement per company — the
-- union of jobs where they are the customer and jobs where they are the GC —
-- behind a single link. That merged link is audience 'all'; the old
-- 'customer' / 'gc' audiences live on as the gear's "Separate views" scoped
-- links, created on request. Existing rows keep working untouched.

ALTER TABLE public.customer_portal_links
  DROP CONSTRAINT IF EXISTS customer_portal_links_audience_check;
ALTER TABLE public.customer_portal_links
  ADD CONSTRAINT customer_portal_links_audience_check
  CHECK (audience IN ('customer', 'gc', 'all'));

COMMENT ON COLUMN public.customer_portal_links.audience IS
  'all = the merged statement (default since the custom-links train); customer / gc = scoped "Separate views" links.';

-- Mint v3: default audience becomes ''all''; validation accepts the merged
-- audience. Behavior otherwise identical to v2 (returns the existing active
-- token, or revoke+re-mint in this one transaction when p_rotate).
CREATE OR REPLACE FUNCTION public.mint_customer_portal_link(
  p_customer_id uuid,
  p_audience text DEFAULT 'all',
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
  IF p_audience NOT IN ('customer', 'gc', 'all') THEN
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
  'v3: audience ''all'' (merged statement) is the default; ''customer''/''gc'' remain as scoped links. Returns the existing active raw token or mints; p_rotate revokes + re-mints in one transaction. Office writers (dev/master/assistant-like).';
