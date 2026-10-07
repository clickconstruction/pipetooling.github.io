SET lock_timeout = '3s';

-- The firm's portal address, custom and short (v2.4756, the owner's call on 2026-10-06, after
-- v2.4750's <firm>-<12 characters>): the office picks the name part and the key ends in three
-- characters — my.clickplumbing.com/snell-law-f6a. The owner weighed the shorter key against a
-- passcode and chose the key alone with a throttle on wrong guesses, so:
--
--   * create / rotate take the address the office typed or rolled (p_address); the server checks
--     its shape (lowercase letters, digits and dashes, 5 to 40 long, ending in '-' + three
--     characters) and that no customer or sub holds it as a short address (the /p/ page resolves
--     a customer first, so a shared slug would shadow the firm's). The key is still kept hashed,
--     with the raw address in Vault, as item 22 built it.
--   * legal_portal_misses records every wrong key the portal functions see, by caller IP; a
--     caller with ten misses in an hour is refused for the rest of that hour
--     (legal_portal_guess_gate, service role only). A right key is never refused: the throttle
--     slows a guesser, it cannot lock the firm out.

-- A wrong key, by caller. Service role only; the office never reads it.
CREATE TABLE IF NOT EXISTS public.legal_portal_misses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.legal_portal_misses IS 'Wrong keys offered to the law firm''s portal functions, by caller IP (v2.4756). legal_portal_guess_gate() counts the last hour; rows older than a day are swept on insert.';
CREATE INDEX IF NOT EXISTS idx_legal_portal_misses_ip_at ON public.legal_portal_misses (ip, at DESC);
ALTER TABLE public.legal_portal_misses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.legal_portal_misses FROM PUBLIC, anon, authenticated;

-- The gate: with p_miss, note one more wrong key from this caller. Answers whether the caller is
-- locked (ten or more misses in the last hour). An unknown caller ('unknown') is counted but never
-- locked, so a proxy that hides every address cannot lock everyone behind it.
CREATE OR REPLACE FUNCTION public.legal_portal_guess_gate(p_ip text, p_miss boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ip text := coalesce(nullif(btrim(p_ip), ''), 'unknown');
  v_n int;
BEGIN
  IF p_miss THEN
    INSERT INTO public.legal_portal_misses (ip) VALUES (v_ip);
    DELETE FROM public.legal_portal_misses WHERE at < now() - interval '1 day' AND random() < 0.05;
  END IF;
  SELECT count(*) INTO v_n FROM public.legal_portal_misses WHERE ip = v_ip AND at > now() - interval '1 hour';
  RETURN jsonb_build_object('locked', v_ip <> 'unknown' AND v_n >= 10, 'misses', v_n);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_guess_gate(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.legal_portal_guess_gate(text, boolean) TO service_role;

-- The address's shape, and that no customer or sub holds it.
CREATE OR REPLACE FUNCTION public.legal_portal_address_problem(p_address text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF p_address IS NULL OR p_address !~ '^[a-z0-9][a-z0-9-]{3,38}[a-z0-9]$' THEN
    RETURN 'An address is 5 to 40 characters: lowercase letters, numbers and dashes.';
  END IF;
  IF p_address !~ '-[a-z0-9]{3}$' THEN
    RETURN 'An address ends in a dash and three characters.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.customer_portal_slugs WHERE slug = p_address) OR EXISTS (SELECT 1 FROM public.sub_portal_slugs WHERE slug = p_address) THEN
    RETURN 'That address is already a customer''s or a sub''s. Pick another.';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_address_problem(text) FROM PUBLIC, anon, authenticated;

-- A default address: the first two words of the firm's name and three random characters
-- (no 0/o/1/l, so it reads aloud).
CREATE OR REPLACE FUNCTION public.legal_portal_link_new_key(p_firm_name text)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public, extensions AS $$
DECLARE
  v_base text;
  v_tail text := '';
  v_alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789';
  v_bytes bytea := extensions.gen_random_bytes(3);
  i int;
BEGIN
  v_base := lower(coalesce(p_firm_name, ''));
  v_base := regexp_replace(v_base, '[\s_]+', '-', 'g');
  v_base := regexp_replace(v_base, '[^a-z0-9-]', '', 'g');
  v_base := regexp_replace(v_base, '-{2,}', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  v_base := array_to_string((regexp_split_to_array(v_base, '-'))[1:2], '-');
  v_base := left(v_base, 36);
  v_base := regexp_replace(v_base, '-+$', '');
  IF v_base = '' THEN v_base := 'firm'; END IF;
  FOR i IN 0..2 LOOP
    v_tail := v_tail || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN v_base || '-' || v_tail;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_new_key(text) FROM PUBLIC, anon, authenticated;

-- Insert one link with the given address (null: a default one). Returns the raw key once.
CREATE OR REPLACE FUNCTION public.legal_portal_link_insert(p_firm_id uuid, p_purpose text, p_label text, p_address text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_raw text;
  v_id uuid := gen_random_uuid();
  v_sid uuid;
  v_name text;
  v_now timestamptz := now();
  v_problem text;
BEGIN
  SELECT name INTO v_name FROM public.legal_firms WHERE id = p_firm_id;
  v_raw := coalesce(nullif(btrim(coalesce(p_address, '')), ''), public.legal_portal_link_new_key(v_name));
  v_problem := public.legal_portal_address_problem(v_raw);
  IF v_problem IS NOT NULL THEN RETURN jsonb_build_object('error', v_problem); END IF;
  IF EXISTS (SELECT 1 FROM public.legal_portal_links WHERE token_hash = encode(digest(v_raw, 'sha256'), 'hex')) THEN
    RETURN jsonb_build_object('error', 'That address was already used. Roll the tail or pick another.');
  END IF;
  v_sid := vault.create_secret(v_raw, 'legal_portal_link_' || v_id::text, 'The collections law firm''s portal key (legal_portal_links, punch list #85 item 22).');
  INSERT INTO public.legal_portal_links (id, firm_id, token, token_hash, token_secret_id, created_by, created_at, purpose, label)
  VALUES (v_id, p_firm_id, NULL, encode(digest(v_raw, 'sha256'), 'hex'), v_sid, auth.uid(), v_now, p_purpose, p_label);
  RETURN jsonb_build_object('id', v_id, 'token', v_raw, 'exists', true, 'activeSince', v_now, 'purpose', p_purpose, 'label', p_label);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_portal_link_insert(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.legal_portal_link_insert(uuid, text, text);

-- Create: the firm's own (p_label null) or one person's, at the address given (null: a default one).
CREATE OR REPLACE FUNCTION public.create_legal_portal_link(p_firm_id uuid, p_label text DEFAULT NULL, p_address text DEFAULT NULL)
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
    RETURN public.legal_portal_link_insert(p_firm_id, 'firm', NULL, p_address);
  END IF;
  IF length(v_label) > 80 THEN RETURN jsonb_build_object('error', 'Who it is for: at most 80 characters.'); END IF;
  RETURN public.legal_portal_link_insert(p_firm_id, 'person', v_label, p_address);
END;
$$;
DROP FUNCTION IF EXISTS public.create_legal_portal_link(uuid, text);
REVOKE EXECUTE ON FUNCTION public.create_legal_portal_link(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_legal_portal_link(uuid, text, text) TO authenticated;

-- Rotate: the old link dies as 'rotated'; the new one keeps the purpose and label, at the address
-- given (null: a default one). Nothing changes when the address is refused.
CREATE OR REPLACE FUNCTION public.rotate_legal_portal_link(p_link_id uuid, p_address text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_row record;
  v_problem text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized to manage the firm''s links'); END IF;
  SELECT id, firm_id, purpose, label INTO v_row FROM public.legal_portal_links WHERE id = p_link_id AND revoked_at IS NULL;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('error', 'That link is already off. Open the list again.'); END IF;
  IF nullif(btrim(coalesce(p_address, '')), '') IS NOT NULL THEN
    v_problem := public.legal_portal_address_problem(btrim(p_address));
    IF v_problem IS NOT NULL THEN RETURN jsonb_build_object('error', v_problem); END IF;
  END IF;
  PERFORM public.legal_portal_link_forget_secret(v_row.id);
  UPDATE public.legal_portal_links SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'rotated', token_secret_id = NULL WHERE id = v_row.id;
  RETURN public.legal_portal_link_insert(v_row.firm_id, v_row.purpose, v_row.label, p_address);
END;
$$;
DROP FUNCTION IF EXISTS public.rotate_legal_portal_link(uuid);
REVOKE EXECUTE ON FUNCTION public.rotate_legal_portal_link(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_legal_portal_link(uuid, text) TO authenticated;

-- The old client's door still creates or rotates the firm's own link, now at a default short address.
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
  IF v_row.id IS NOT NULL THEN RETURN public.rotate_legal_portal_link(v_row.id, NULL); END IF;
  RETURN public.legal_portal_link_insert(p_firm_id, 'firm', NULL, NULL);
END;
$$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
