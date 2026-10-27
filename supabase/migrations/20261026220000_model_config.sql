SET lock_timeout = '3s';

-- The Model keys card in Settings (punch list #186, v2.5916): a language model's API key lives in Vault, written from
-- Settings → Phone and texts by the owner or a dev through the model-config function and read by report-draft at call
-- time, so a key is set and rotated without a terminal. One secret per provider, named model_<provider>_api_key; the
-- function's own ANTHROPIC_API_KEY secret stays the fallback while Vault holds none. Three functions, the service
-- role's only (a signed-in user never reaches Vault), in the shape of the Quo connection's (20261021020000):
--   * model_secret_set(provider, value, saved_by): makes or replaces the provider's one Vault secret, keeping who
--     saved it as the secret's description; a blank value forgets the secret.
--   * model_secret_get(provider): the decrypted key, or null.
--   * model_secret_status(provider): whether it is set, when it was last saved and by whom, as jsonb; never the key.
-- The provider is one of a short list the function holds, so a typo never makes a stray secret.

CREATE OR REPLACE FUNCTION public.model_secret_name(p_provider text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('anthropic') THEN
    RAISE EXCEPTION 'unknown model provider: %', coalesce(p_provider, '(none)');
  END IF;
  RETURN 'model_' || p_provider || '_api_key';
END
$$;

CREATE OR REPLACE FUNCTION public.model_secret_set(p_provider text, p_value text, p_saved_by text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_name text := public.model_secret_name(p_provider);
  v_value text := btrim(coalesce(p_value, ''));
  v_by text := left(btrim(coalesce(p_saved_by, '')), 120);
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = v_name;
  IF v_value = '' THEN
    IF v_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_id; END IF;
    RETURN false;
  END IF;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_value, v_name, v_by);
  ELSE
    PERFORM vault.update_secret(v_id, v_value, v_name, v_by);
  END IF;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.model_secret_get(p_provider text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT s.decrypted_secret
  FROM vault.decrypted_secrets s
  WHERE s.name = public.model_secret_name(p_provider)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.model_secret_status(p_provider text)
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
      WHERE s.name = public.model_secret_name(p_provider)
      LIMIT 1
    ),
    jsonb_build_object('set', false, 'saved_at', null, 'saved_by', null)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.model_secret_name(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.model_secret_set(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.model_secret_get(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.model_secret_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.model_secret_name(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.model_secret_set(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.model_secret_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.model_secret_status(text) TO service_role;
