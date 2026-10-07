SET lock_timeout = '3s';

-- The firm's portal links, v2.4750 (the owner's ask, 2026-10-06): the address carries the firm's
-- name like a GC's does, a firm may hold several links (its own, which rides in every email, and
-- one per person at the firm, each labelled, so one person can be turned off alone), and the
-- office sees every link it ever made — live ones with their address, turned-off ones with when,
-- why and by whom.
--
--   * A new key is <the firm's name as a slug>-<12 random characters> (62 bits), so the link reads
--     my.clickplumbing.com/snell-law-firm-pllc-k4tp9x2mq7zr. It is still the capability: the
--     table keeps only its sha256 (punch list #85 item 22) and Vault keeps the raw key per link.
--   * The office reads the live addresses back through list_legal_portal_links(), which decrypts
--     them from Vault. The table never holds a raw key; the office can copy a link any time.
--   * purpose: 'firm' (one live per firm, the one the emails carry) or 'person' (any number,
--     label required). revoked_by / revoke_reason ('rotated' · 'off' · 'replaced') tell the list
--     what happened to a dead link.
--   * mint_legal_portal_link(p_firm_id, p_rotate) keeps working for the client that is live while
--     this file is pushed: it creates or rotates the firm's own link.

ALTER TABLE public.legal_portal_links ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'firm';
ALTER TABLE public.legal_portal_links ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.legal_portal_links ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.legal_portal_links ADD COLUMN IF NOT EXISTS revoke_reason text;
ALTER TABLE public.legal_portal_links DROP CONSTRAINT IF EXISTS legal_portal_links_purpose_check;
ALTER TABLE public.legal_portal_links ADD CONSTRAINT legal_portal_links_purpose_check CHECK (purpose IN ('firm', 'person'));
ALTER TABLE public.legal_portal_links DROP CONSTRAINT IF EXISTS legal_portal_links_revoke_reason_check;
ALTER TABLE public.legal_portal_links ADD CONSTRAINT legal_portal_links_revoke_reason_check CHECK (revoke_reason IS NULL OR revoke_reason IN ('rotated', 'off', 'replaced'));
ALTER TABLE public.legal_portal_links DROP CONSTRAINT IF EXISTS legal_portal_links_person_label_check;
ALTER TABLE public.legal_portal_links ADD CONSTRAINT legal_portal_links_person_label_check CHECK (purpose <> 'person' OR (label IS NOT NULL AND length(btrim(label)) > 0));
COMMENT ON COLUMN public.legal_portal_links.purpose IS 'firm: the firm''s own link, one live per firm, the one every email carries. person: a link for one person at the firm (label), any number, turned off alone (v2.4750).';
COMMENT ON COLUMN public.legal_portal_links.label IS 'Who the link is for, in the office''s words (a person link). Null on the firm''s own link.';
COMMENT ON COLUMN public.legal_portal_links.revoke_reason IS 'Why a link died: rotated (a new one took its place), off (turned off), replaced (the firm was replaced).';
COMMENT ON TABLE public.legal_portal_links IS 'Private no-login portal links for the collections law firm (v2.3315, firm-keyed; v2.4750: several per firm, the key reads <firm>-<tail>). Hash only at rest since punch list #85 item 22: token_hash is the lookup, the raw key sits in Vault per link; revoked_at is the only kill switch.';

-- One live firm link per firm; person links are free.
DROP INDEX IF EXISTS public.idx_legal_portal_links_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_portal_links_active_firm ON public.legal_portal_links (firm_id) WHERE revoked_at IS NULL AND purpose = 'firm';

-- The office reads every column but the token (the new columns included).
REVOKE SELECT ON TABLE public.legal_portal_links FROM authenticated;
GRANT SELECT (id, firm_id, token_hash, token_secret_id, created_by, created_at, revoked_at, purpose, label, revoked_by, revoke_reason) ON public.legal_portal_links TO authenticated;

-- The key: the firm's name as a slug (at most 40 characters) + '-' + 12 characters from [a-z0-9].
-- A name with nothing usable in it reads 'firm'. Lowercase and dash-only so it is a slug the
-- short domain's Worker and the /p/ page both carry through unchanged.
CREATE OR REPLACE FUNCTION public.legal_portal_link_new_key(p_firm_name text)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public, extensions AS $$
DECLARE
  v_base text;
  v_tail text := '';
  v_alphabet constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  v_bytes bytea := extensions.gen_random_bytes(12);
  i int;
BEGIN
  v_base := lower(coalesce(p_firm_name, ''));
  v_base := regexp_replace(v_base, '[\s_]+', '-', 'g');
  v_base := regexp_replace(v_base, '[^a-z0-9-]', '', 'g');
  v_base := regexp_replace(v_base, '-{2,}', '-', 'g');
  v_base := left(v_base, 40);
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  IF v_base = '' THEN v_base := 'firm'; END IF;
  FOR i IN 0..11 LOOP
    v_tail := v_tail || substr(v_alphabet, (get_byte(v_bytes, i) % 36) + 1, 1);
  END LOOP;
  RETURN v_base || '-' || v_tail;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_new_key(text) FROM PUBLIC, anon, authenticated;

-- Forget one link's Vault secret (rotate and turn off). A Vault refusal never blocks the revoke:
-- a revoked link's key is refused by the functions anyway.
CREATE OR REPLACE FUNCTION public.legal_portal_link_forget_secret(p_link_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    DELETE FROM vault.secrets WHERE id IN (SELECT token_secret_id FROM public.legal_portal_links WHERE id = p_link_id AND token_secret_id IS NOT NULL);
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE 'legal_portal_link_forget_secret: Vault refused the delete (%); the link is revoked regardless', SQLERRM;
  END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_forget_secret(uuid) FROM PUBLIC, anon, authenticated;

-- Insert one link and return it with its raw key (the one time the key is minted).
CREATE OR REPLACE FUNCTION public.legal_portal_link_insert(p_firm_id uuid, p_purpose text, p_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_raw text;
  v_id uuid := gen_random_uuid();
  v_sid uuid;
  v_name text;
  v_now timestamptz := now();
BEGIN
  SELECT name INTO v_name FROM public.legal_firms WHERE id = p_firm_id;
  v_raw := public.legal_portal_link_new_key(v_name);
  v_sid := vault.create_secret(v_raw, 'legal_portal_link_' || v_id::text, 'The collections law firm''s portal key (legal_portal_links, punch list #85 item 22).');
  INSERT INTO public.legal_portal_links (id, firm_id, token, token_hash, token_secret_id, created_by, created_at, purpose, label)
  VALUES (v_id, p_firm_id, NULL, encode(digest(v_raw, 'sha256'), 'hex'), v_sid, auth.uid(), v_now, p_purpose, p_label);
  RETURN jsonb_build_object('id', v_id, 'token', v_raw, 'exists', true, 'activeSince', v_now, 'purpose', p_purpose, 'label', p_label);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_insert(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Create a link: the firm's own (p_label null; refused while one is live) or one person's (p_label).
CREATE OR REPLACE FUNCTION public.create_legal_portal_link(p_firm_id uuid, p_label text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s links'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_firms f WHERE f.id = p_firm_id) THEN RETURN jsonb_build_object('error', 'Firm not found'); END IF;
  IF v_label IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.legal_portal_links WHERE firm_id = p_firm_id AND revoked_at IS NULL AND purpose = 'firm') THEN
      RETURN jsonb_build_object('error', 'The firm already has its link. Rotate it for a new address.');
    END IF;
    RETURN public.legal_portal_link_insert(p_firm_id, 'firm', NULL);
  END IF;
  IF length(v_label) > 80 THEN RETURN jsonb_build_object('error', 'Who it is for: at most 80 characters.'); END IF;
  RETURN public.legal_portal_link_insert(p_firm_id, 'person', v_label);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_legal_portal_link(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_legal_portal_link(uuid, text) TO authenticated;

-- Rotate one link: the old one dies as 'rotated', a new one with the same purpose and label is minted.
CREATE OR REPLACE FUNCTION public.rotate_legal_portal_link(p_link_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s links'); END IF;
  SELECT id, firm_id, purpose, label INTO v_row FROM public.legal_portal_links WHERE id = p_link_id AND revoked_at IS NULL;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('error', 'That link is already off. Open the list again.'); END IF;
  PERFORM public.legal_portal_link_forget_secret(v_row.id);
  UPDATE public.legal_portal_links SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'rotated', token_secret_id = NULL WHERE id = v_row.id;
  RETURN public.legal_portal_link_insert(v_row.firm_id, v_row.purpose, v_row.label);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rotate_legal_portal_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_legal_portal_link(uuid) TO authenticated;

-- Turn one link off.
CREATE OR REPLACE FUNCTION public.revoke_legal_portal_link_by_id(p_link_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s links'); END IF;
  PERFORM public.legal_portal_link_forget_secret(p_link_id);
  UPDATE public.legal_portal_links SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'off', token_secret_id = NULL WHERE id = p_link_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_n > 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_legal_portal_link_by_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_legal_portal_link_by_id(uuid) TO authenticated;

-- Every link the firm ever had, newest first, with the live ones' addresses read back from Vault.
-- Office only (legal_office_can_read). A key Vault cannot give back comes as token null.
CREATE OR REPLACE FUNCTION public.list_legal_portal_links(p_firm_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s links'); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'purpose', l.purpose,
    'label', l.label,
    'createdAt', l.created_at,
    'createdBy', cu.name,
    'revokedAt', l.revoked_at,
    'revokedBy', ru.name,
    'revokeReason', l.revoke_reason,
    'token', CASE WHEN l.revoked_at IS NULL THEN s.decrypted_secret END
  ) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_out
  FROM public.legal_portal_links l
  LEFT JOIN public.users cu ON cu.id = l.created_by
  LEFT JOIN public.users ru ON ru.id = l.revoked_by
  LEFT JOIN vault.decrypted_secrets s ON s.id = l.token_secret_id AND l.revoked_at IS NULL
  WHERE l.firm_id = p_firm_id;
  RETURN jsonb_build_object('links', v_out);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.list_legal_portal_links(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_legal_portal_links(uuid) TO authenticated;

-- The emails' read: the firm's own live link, decrypted. Service role only (unchanged signature).
CREATE OR REPLACE FUNCTION public.legal_portal_link_token(p_firm_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.decrypted_secret
  FROM public.legal_portal_links l
  JOIN vault.decrypted_secrets s ON s.id = l.token_secret_id
  WHERE l.firm_id = p_firm_id AND l.revoked_at IS NULL AND l.purpose = 'firm'
  ORDER BY l.created_at DESC
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legal_portal_link_token(uuid) TO service_role;

-- One link's key by id, for a send of a person's link. Service role only.
CREATE OR REPLACE FUNCTION public.legal_portal_link_token_by_id(p_link_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.decrypted_secret
  FROM public.legal_portal_links l
  JOIN vault.decrypted_secrets s ON s.id = l.token_secret_id
  WHERE l.id = p_link_id AND l.revoked_at IS NULL
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_token_by_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legal_portal_link_token_by_id(uuid) TO service_role;

-- The old client's door, kept so the client that is live while this file is pushed still works:
-- creates the firm's own link, or rotates it. Minted keys are the new shape.
CREATE OR REPLACE FUNCTION public.mint_legal_portal_link(p_firm_id uuid, p_rotate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s link'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_firms f WHERE f.id = p_firm_id) THEN RETURN jsonb_build_object('error', 'Firm not found'); END IF;
  SELECT id, created_at INTO v_row FROM public.legal_portal_links WHERE firm_id = p_firm_id AND revoked_at IS NULL AND purpose = 'firm';
  IF v_row.id IS NOT NULL AND NOT p_rotate THEN
    RETURN jsonb_build_object('token', NULL, 'exists', true, 'activeSince', v_row.created_at);
  END IF;
  IF v_row.id IS NOT NULL THEN RETURN public.rotate_legal_portal_link(v_row.id); END IF;
  RETURN public.legal_portal_link_insert(p_firm_id, 'firm', NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mint_legal_portal_link(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mint_legal_portal_link(uuid, boolean) TO authenticated;

-- Turn every link of the firm off (the old client's kill switch), now stamped.
CREATE OR REPLACE FUNCTION public.revoke_legal_portal_link(p_firm_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s link'); END IF;
  PERFORM public.legal_portal_link_forget_secrets(p_firm_id);
  UPDATE public.legal_portal_links SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'off', token_secret_id = NULL WHERE firm_id = p_firm_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_n > 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_legal_portal_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_legal_portal_link(uuid) TO authenticated;
