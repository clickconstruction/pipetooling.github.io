SET lock_timeout = '3s';

-- The Quo connection in Settings (v2.5718, the owner's ask of 2026-10-21: no terminal in setup). Quo's API key lives in
-- Vault, written from Settings → Phone and texts by the owner or a dev through the quo-config function and read by
-- quo-send, quo-webhook and quo-config at call time, so the key is set and rotated without a terminal. The QUO_API_KEY
-- function secret stays the fallback while Vault holds no key. Three functions, the service role's only (a signed-in
-- user never reaches Vault), in the shape of the Docsmit connection's (20261013160000):
--   * quo_secret_set(value, saved_by): makes or replaces the one Vault secret named quo_api_key, keeping who saved it
--     as the secret's description; a blank value forgets the secret.
--   * quo_secret_get(): the decrypted key, or null.
--   * quo_secret_status(): whether it is set, when it was last saved and by whom, as jsonb; never the key.

CREATE OR REPLACE FUNCTION public.quo_secret_set(p_value text, p_saved_by text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_value text := btrim(coalesce(p_value, ''));
  v_by text := left(btrim(coalesce(p_saved_by, '')), 120);
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'quo_api_key';
  IF v_value = '' THEN
    IF v_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_id; END IF;
    RETURN false;
  END IF;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_value, 'quo_api_key', v_by);
  ELSE
    PERFORM vault.update_secret(v_id, v_value, 'quo_api_key', v_by);
  END IF;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.quo_secret_get()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT s.decrypted_secret
  FROM vault.decrypted_secrets s
  WHERE s.name = 'quo_api_key'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.quo_secret_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_build_object('set', true, 'saved_at', s.updated_at, 'saved_by', nullif(s.description, ''))
      FROM vault.secrets s
      WHERE s.name = 'quo_api_key'
      LIMIT 1
    ),
    jsonb_build_object('set', false, 'saved_at', null, 'saved_by', null)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.quo_secret_set(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quo_secret_get() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quo_secret_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quo_secret_set(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quo_secret_get() TO service_role;
GRANT EXECUTE ON FUNCTION public.quo_secret_status() TO service_role;
