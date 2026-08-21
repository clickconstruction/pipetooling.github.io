SET lock_timeout = '3s';

-- digest() lives in pgcrypto (extensions schema on Supabase; not in the baseline).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Customer portal spine (portal train PR 1): one revocable, rotatable link
-- per customer (and per GC) opening the no-login portal page — outstanding
-- bills + pay links, later schedule/bid request forms. Follows the estimate
-- customer-view security model exactly: only a sha256 HASH of the token is
-- stored (a DB read never leaks a live link); the raw token is returned once
-- by the mint RPC and thereafter only rotation produces a new one. All
-- public access goes through the customer-portal edge function (service
-- role); the table itself is office-readable for the globe-modal status line.

CREATE TABLE IF NOT EXISTS public.customer_portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'customer' CHECK (audience IN ('customer', 'gc')),
  token_hash text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

COMMENT ON TABLE public.customer_portal_links IS
  'Capability links for the no-login customer/GC portal (portal train PR 1). token_hash = sha256 of the raw link token (raw shown once at mint). One ACTIVE link per customer+audience; rotation revokes and re-mints.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_portal_links_active
  ON public.customer_portal_links (customer_id, audience)
  WHERE revoked_at IS NULL;

ALTER TABLE public.customer_portal_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office can read portal links" ON public.customer_portal_links;
CREATE POLICY "Office can read portal links" ON public.customer_portal_links
  FOR SELECT USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')
       )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_portal_links TO authenticated;

-- Mint (or rotate) the active link for a customer+audience. Returns the RAW
-- token — the only time it is ever visible. p_rotate=false returns an error
-- marker when an active link already exists (the modal then offers Rotate);
-- p_rotate=true revokes any active link first.
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
  v_existing timestamptz;
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

  SELECT created_at INTO v_existing
  FROM public.customer_portal_links
  WHERE customer_id = p_customer_id AND audience = p_audience AND revoked_at IS NULL;

  IF v_existing IS NOT NULL AND NOT p_rotate THEN
    RETURN jsonb_build_object('exists', true, 'activeSince', v_existing);
  END IF;

  UPDATE public.customer_portal_links
  SET revoked_at = now()
  WHERE customer_id = p_customer_id AND audience = p_audience AND revoked_at IS NULL;

  v_raw := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO public.customer_portal_links (customer_id, audience, token_hash, created_by)
  VALUES (p_customer_id, p_audience, encode(digest(v_raw, 'sha256'), 'hex'), auth.uid());

  RETURN jsonb_build_object('token', v_raw, 'audience', p_audience);
END;
$$;

COMMENT ON FUNCTION public.mint_customer_portal_link(uuid, text, boolean) IS
  'Mint or rotate (p_rotate) the active portal link for a customer+audience; returns the raw token exactly once. Office writers (dev/master/assistant-like).';

REVOKE EXECUTE ON FUNCTION public.mint_customer_portal_link(uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mint_customer_portal_link(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.mint_customer_portal_link(uuid, text, boolean) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
