SET lock_timeout = '3s';

-- Punch list #85, item 22: the law firm's portal token is no longer kept readable at rest.
--
-- Before: legal_portal_links kept the raw token beside its sha256, and the four office roles
-- that pass legal_office_can_read() could SELECT it (the Firm's link dialog read it to show
-- and copy the link; mint_legal_portal_link(p_rotate => false) handed back an existing raw
-- token to any of them). Anyone holding it can act as the firm on the portal.
--
-- After:
--   * the table keeps only token_hash (the functions look the link up by it); the raw column
--     is emptied and held empty by a CHECK;
--   * the raw token of the live link is kept encrypted in Supabase Vault, because every email
--     to the firm carries the live link: legal-notify-dispatch reads it through
--     legal_portal_link_token(), which only the service role may execute;
--   * the office sees the raw token once, in mint_legal_portal_link's answer when it creates
--     or rotates the link; asking again returns no token;
--   * the office's column grant leaves the token out entirely.
-- Revoking or rotating deletes the old link's Vault secret.
--
-- Order: deploy the client and legal-notify-dispatch from the same PR first (both work before
-- and after this file); then push this.

ALTER TABLE public.legal_portal_links ADD COLUMN IF NOT EXISTS token_secret_id uuid;
COMMENT ON COLUMN public.legal_portal_links.token_secret_id IS 'Vault secret (vault.secrets.id) holding the live link''s raw token for the firm''s emails (punch list #85, item 22). Null on revoked links. Read only through legal_portal_link_token(), service role only.';

-- Move each live link's raw token into Vault, then empty the raw column on every row. A failure
-- here aborts the whole file: nothing is emptied until every live token is safe in Vault.
DO $$
DECLARE
  r record;
  v_sid uuid;
BEGIN
  FOR r IN SELECT id, token FROM public.legal_portal_links WHERE token IS NOT NULL AND revoked_at IS NULL AND token_secret_id IS NULL LOOP
    v_sid := vault.create_secret(r.token, 'legal_portal_link_' || r.id::text, 'The collections law firm''s portal token (legal_portal_links, punch list #85 item 22).');
    UPDATE public.legal_portal_links SET token_secret_id = v_sid WHERE id = r.id;
  END LOOP;
  UPDATE public.legal_portal_links SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex') WHERE token IS NOT NULL AND token_hash IS NULL;
  UPDATE public.legal_portal_links SET token = NULL WHERE token IS NOT NULL;
END $$;

ALTER TABLE public.legal_portal_links DROP CONSTRAINT IF EXISTS legal_portal_links_token_not_kept;
ALTER TABLE public.legal_portal_links ADD CONSTRAINT legal_portal_links_token_not_kept CHECK (token IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_portal_links_token_hash ON public.legal_portal_links (token_hash) WHERE token_hash IS NOT NULL;
COMMENT ON TABLE public.legal_portal_links IS 'Private no-login portal links for the collections law firm (v2.3315, firm-keyed). Hash only at rest since punch list #85 item 22: token_hash is the lookup, the live raw token sits in Vault for the emails; revoked_at is the only kill switch.';

-- The office reads every column but the token.
REVOKE SELECT ON TABLE public.legal_portal_links FROM authenticated;
GRANT SELECT (id, firm_id, token_hash, token_secret_id, created_by, created_at, revoked_at) ON public.legal_portal_links TO authenticated;

-- Mint: the raw token is returned only when a link is created or rotated. Asking again for an
-- existing link answers exists = true and no token.
CREATE OR REPLACE FUNCTION public.mint_legal_portal_link(p_firm_id uuid, p_rotate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_raw text;
  v_row record;
  v_id uuid;
  v_sid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s link'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_firms f WHERE f.id = p_firm_id) THEN RETURN jsonb_build_object('error', 'Firm not found'); END IF;

  SELECT id, created_at INTO v_row FROM public.legal_portal_links WHERE firm_id = p_firm_id AND revoked_at IS NULL;
  IF v_row.id IS NOT NULL AND NOT p_rotate THEN
    RETURN jsonb_build_object('token', NULL, 'exists', true, 'activeSince', v_row.created_at);
  END IF;

  PERFORM public.legal_portal_link_forget_secrets(p_firm_id);
  UPDATE public.legal_portal_links SET revoked_at = now(), token_secret_id = NULL WHERE firm_id = p_firm_id AND revoked_at IS NULL;

  v_raw := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id := gen_random_uuid();
  v_sid := vault.create_secret(v_raw, 'legal_portal_link_' || v_id::text, 'The collections law firm''s portal token (legal_portal_links, punch list #85 item 22).');
  INSERT INTO public.legal_portal_links (id, firm_id, token, token_hash, token_secret_id, created_by)
  VALUES (v_id, p_firm_id, NULL, encode(digest(v_raw, 'sha256'), 'hex'), v_sid, auth.uid());
  RETURN jsonb_build_object('token', v_raw, 'exists', true, 'activeSince', now());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mint_legal_portal_link(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mint_legal_portal_link(uuid, boolean) TO authenticated;

-- Deletes the Vault secrets of a firm's live links (rotate and revoke call it). A dead link's
-- token is useless anyway (the functions refuse a revoked link), so a Vault refusal here never
-- blocks the revoke: it is noted and skipped.
CREATE OR REPLACE FUNCTION public.legal_portal_link_forget_secrets(p_firm_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    DELETE FROM vault.secrets WHERE id IN (SELECT token_secret_id FROM public.legal_portal_links WHERE firm_id = p_firm_id AND revoked_at IS NULL AND token_secret_id IS NOT NULL);
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE 'legal_portal_link_forget_secrets: Vault refused the delete (%); the link is revoked regardless', SQLERRM;
  END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_forget_secrets(uuid) FROM PUBLIC, anon, authenticated;

-- Revoke without replacement: turn the firm's portal off, and forget its token.
CREATE OR REPLACE FUNCTION public.revoke_legal_portal_link(p_firm_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s link'); END IF;
  PERFORM public.legal_portal_link_forget_secrets(p_firm_id);
  UPDATE public.legal_portal_links SET revoked_at = now(), token_secret_id = NULL WHERE firm_id = p_firm_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_n > 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_legal_portal_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_legal_portal_link(uuid) TO authenticated;

-- The emails' read: the live link's raw token, decrypted. Service role only.
CREATE OR REPLACE FUNCTION public.legal_portal_link_token(p_firm_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.decrypted_secret
  FROM public.legal_portal_links l
  JOIN vault.decrypted_secrets s ON s.id = l.token_secret_id
  WHERE l.firm_id = p_firm_id AND l.revoked_at IS NULL
  ORDER BY l.created_at DESC
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legal_portal_link_token(uuid) TO service_role;
