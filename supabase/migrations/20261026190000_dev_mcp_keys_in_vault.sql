SET lock_timeout = '3s';

-- v2.5899 — Dev MCP keys kept in Vault, so a live key can be copied again.
--
-- The owner, 2026-10-26, on Settings → Your account → Dev MCP keys: "I would like to be able
-- to copy to clipboard an existing key." Only the key's sha256 was stored (20260920063130:
-- "plaintext exists only at issue time"), so nothing could be copied. Offered a one-press
-- reissue, keeping keys encrypted from now on, or copying the snippet with the key blank,
-- he chose to keep them. From this file on:
--
--   * dev_mcp_issue_key(p_token, p_label): the browser still generates the key (ptd_ + 64 hex,
--     src/lib/devMcp/devMcpKeys.ts) and the function stores its sha256 as before, for the
--     dev-mcp lookup, AND the key itself in Supabase Vault (secret_id). The row is the
--     caller's own, as the old insert_own policy held; a training account and a twin are
--     refused in words.
--   * dev_mcp_reveal_key(p_credential_id): the key back, decrypted, for the dev's OWN live
--     key only, and one row in dev_mcp_calls (verb reveal_key) per reveal — the card asks
--     before it calls, and the row is the log the card promises.
--   * Revoking a row (the card's UPDATE, unchanged) or deleting one deletes its Vault secret
--     and clears secret_id (two triggers, one function), so only a live key is recoverable.
--
-- A key issued before this file has no secret_id and stays hash-only: the card offers no
-- Copy on it, and the reveal refuses it in words. dev-mcp itself does not change: it still
-- looks a presented key up by its hash.
--
-- Order: deploy the client first (it reads the table without secret_id until the column is
-- there, and issues the old way while the function is missing); then push this.
-- No CREATE TABLE, so the three apply_* fence calls are not needed.

ALTER TABLE public.dev_mcp_credentials ADD COLUMN IF NOT EXISTS secret_id uuid NULL;
COMMENT ON COLUMN public.dev_mcp_credentials.secret_id IS
  'Vault secret (vault.secrets.id) holding the key itself, for Copy on the Settings card (v2.5899). Null on keys issued before v2.5899 and on revoked keys: the trigger deletes the secret on revoke. Read only through dev_mcp_reveal_key(), the owner''s own live key, each reveal logged in dev_mcp_calls.';

-- ---------------------------------------------------------------------------------------------
-- Issue: the hash for the lookup, the key for Copy later.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dev_mcp_issue_key(p_token text, p_label text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_sid uuid;
  v_label text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_dev() THEN RAISE EXCEPTION 'Only a dev can issue a dev key' USING ERRCODE = '42501'; END IF;
  IF public.is_digital_twin() THEN RAISE EXCEPTION 'A digital twin cannot issue a dev key' USING ERRCODE = '42501'; END IF;
  IF public.is_read_only() THEN RAISE EXCEPTION 'A training account cannot issue a dev key' USING ERRCODE = '42501'; END IF;
  IF p_token IS NULL OR p_token !~ '^ptd_[0-9a-f]{64}$' THEN RAISE EXCEPTION 'That is not a dev key' USING ERRCODE = '22023'; END IF;

  v_label := left(btrim(coalesce(p_label, '')), 80);
  IF v_label = '' THEN v_label := 'unlabeled'; END IF;

  v_id := gen_random_uuid();
  v_sid := vault.create_secret(p_token, 'dev_mcp_key_' || v_id::text, 'A dev''s MCP key, label "' || v_label || '" (dev_mcp_credentials, v2.5899).');
  INSERT INTO public.dev_mcp_credentials (id, user_id, token_hash, label, created_by, secret_id)
  VALUES (v_id, v_uid, encode(digest(p_token, 'sha256'), 'hex'), v_label, v_uid, v_sid);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dev_mcp_issue_key(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_mcp_issue_key(text, text) TO authenticated;
COMMENT ON FUNCTION public.dev_mcp_issue_key(text, text) IS
  'v2.5899: issues a Dev MCP key for the caller (a dev, not a twin, not in training mode): stores the key''s sha256 for the dev-mcp lookup and the key itself in Vault, so the Settings card can copy it again. Returns the new row''s id.';

-- ---------------------------------------------------------------------------------------------
-- Reveal: the owner's own live key, decrypted, and a log row per reveal.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dev_mcp_reveal_key(p_credential_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_key text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_dev() THEN RAISE EXCEPTION 'Only a dev can copy a dev key' USING ERRCODE = '42501'; END IF;
  IF public.is_digital_twin() THEN RAISE EXCEPTION 'A digital twin cannot copy a dev key' USING ERRCODE = '42501'; END IF;
  IF public.is_read_only() THEN RAISE EXCEPTION 'A training account cannot copy a dev key' USING ERRCODE = '42501'; END IF;

  SELECT id, user_id, label, revoked_at, secret_id INTO v_row FROM public.dev_mcp_credentials WHERE id = p_credential_id;
  -- One answer for a missing row and another dev's row: the reveal is for your own keys.
  IF v_row.id IS NULL OR v_row.user_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'That key is not yours' USING ERRCODE = '42501'; END IF;
  IF v_row.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'That key was revoked, so it cannot be copied' USING ERRCODE = 'P0001'; END IF;
  IF v_row.secret_id IS NULL THEN RAISE EXCEPTION 'That key was issued before keys were kept, so it cannot be copied. Issue a new one.' USING ERRCODE = 'P0001'; END IF;

  SELECT s.decrypted_secret INTO v_key FROM vault.decrypted_secrets s WHERE s.id = v_row.secret_id;
  IF v_key IS NULL THEN RAISE EXCEPTION 'The key''s secret is gone. Issue a new one.' USING ERRCODE = 'P0001'; END IF;

  -- The log the card promises: one row per reveal, in the same log as the key's calls.
  INSERT INTO public.dev_mcp_calls (credential_id, user_id, verb, target, args, status, row_count, duration_ms)
  VALUES (v_row.id, v_uid, 'reveal_key', 'dev_mcp_credentials', jsonb_build_object('credential_id', v_row.id, 'label', v_row.label, 'from', 'settings'), 'ok', 1, 0);
  RETURN v_key;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dev_mcp_reveal_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_mcp_reveal_key(uuid) TO authenticated;
COMMENT ON FUNCTION public.dev_mcp_reveal_key(uuid) IS
  'v2.5899: the caller''s own live Dev MCP key, decrypted from Vault, for Copy on the Settings card. Refuses another dev''s key, a revoked key and a key issued before v2.5899. Writes one dev_mcp_calls row (verb reveal_key) per reveal.';

-- ---------------------------------------------------------------------------------------------
-- Forget: a revoked or deleted key's secret leaves Vault with it. A dead key is useless anyway
-- (dev-mcp refuses a revoked row), so a Vault refusal never blocks the revoke: noted, skipped.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dev_mcp_credentials_forget_secret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.secret_id IS NOT NULL THEN
    BEGIN
      DELETE FROM vault.secrets WHERE id = OLD.secret_id;
    EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
      RAISE NOTICE 'dev_mcp_credentials_forget_secret: Vault refused the delete (%); the key is revoked regardless', SQLERRM;
    END;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.secret_id := NULL;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dev_mcp_credentials_forget_secret() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dev_mcp_credentials_forget_secret_on_revoke ON public.dev_mcp_credentials;
CREATE TRIGGER dev_mcp_credentials_forget_secret_on_revoke
  BEFORE UPDATE OF revoked_at ON public.dev_mcp_credentials
  FOR EACH ROW
  WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
  EXECUTE FUNCTION public.dev_mcp_credentials_forget_secret();

DROP TRIGGER IF EXISTS dev_mcp_credentials_forget_secret_on_delete ON public.dev_mcp_credentials;
CREATE TRIGGER dev_mcp_credentials_forget_secret_on_delete
  BEFORE DELETE ON public.dev_mcp_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.dev_mcp_credentials_forget_secret();

COMMENT ON TABLE public.dev_mcp_credentials IS
  'Per-dev keys for the dev-mcp edge function — one per machine; a dev issues only their own; revoke a row to cut one machine off. token_hash (sha256) is the lookup; since v2.5899 a key issued through dev_mcp_issue_key also sits in Vault (secret_id) for Copy on the Settings card, and leaves it on revoke. See docs/dev-mcp/README.md.';
