SET lock_timeout = '3s';

-- Legal portal train, PR 3: the firm's no-login link. One private capability link per
-- law firm (legal_firms.id) that opens every matter marked attorney-ready — the customer
-- portal's link spine, firm-keyed, token only (no printed slug: a firm gets one link).
-- Revocation is the kill switch. Office-read; the edge function reads through the
-- service role and returns nothing an office-held entry contains.

CREATE TABLE IF NOT EXISTS public.legal_portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.legal_firms(id) ON DELETE CASCADE,
  token text,
  token_hash text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
COMMENT ON TABLE public.legal_portal_links IS 'Private no-login portal links for the collections law firm (v2.3315, firm-keyed). The raw token is the capability; revoked_at is the only kill switch.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_portal_links_active ON public.legal_portal_links (firm_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_portal_links_token ON public.legal_portal_links (token) WHERE token IS NOT NULL;

ALTER TABLE public.legal_portal_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_portal_links_office_select ON public.legal_portal_links;
CREATE POLICY legal_portal_links_office_select ON public.legal_portal_links FOR SELECT TO authenticated USING (public.legal_office_can_read());
GRANT SELECT ON TABLE public.legal_portal_links TO authenticated;

-- Mint: returns the EXISTING active link's raw token when present; p_rotate revokes + re-mints.
CREATE OR REPLACE FUNCTION public.mint_legal_portal_link(p_firm_id uuid, p_rotate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_raw text;
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s link'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_firms f WHERE f.id = p_firm_id) THEN RETURN jsonb_build_object('error', 'Firm not found'); END IF;

  SELECT token, created_at INTO v_row FROM public.legal_portal_links WHERE firm_id = p_firm_id AND revoked_at IS NULL;
  IF v_row.token IS NOT NULL AND NOT p_rotate THEN
    RETURN jsonb_build_object('token', v_row.token, 'activeSince', v_row.created_at);
  END IF;

  UPDATE public.legal_portal_links SET revoked_at = now() WHERE firm_id = p_firm_id AND revoked_at IS NULL;
  v_raw := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.legal_portal_links (firm_id, token, token_hash, created_by)
  VALUES (p_firm_id, v_raw, encode(digest(v_raw, 'sha256'), 'hex'), auth.uid());
  RETURN jsonb_build_object('token', v_raw, 'activeSince', now());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mint_legal_portal_link(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mint_legal_portal_link(uuid, boolean) TO authenticated;

-- Revoke without replacement — turn the firm's portal off.
CREATE OR REPLACE FUNCTION public.revoke_legal_portal_link(p_firm_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s link'); END IF;
  UPDATE public.legal_portal_links SET revoked_at = now() WHERE firm_id = p_firm_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_n > 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_legal_portal_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_legal_portal_link(uuid) TO authenticated;

-- The firm's portal is a counted public surface.
ALTER TABLE public.public_page_views DROP CONSTRAINT IF EXISTS public_page_views_surface_check;
ALTER TABLE public.public_page_views ADD CONSTRAINT public_page_views_surface_check
  CHECK (surface IN ('portal', 'estimate_terms', 'contract_accept', 'hazmat_notice', 'sub_portal', 'legal_portal'));

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
