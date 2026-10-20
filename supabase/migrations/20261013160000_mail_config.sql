SET lock_timeout = '3s';

-- The Docsmit train, PR 9 (docs/DOCSMIT_LIEN_RUN_PLAN.md, "Managed from Developer settings"): the connection's
-- secrets live in Vault, written from the app by a dev through the mail-config function and read by
-- mail-send-docsmit and mail-poll at call time, so the owner rotates them without a terminal. Three functions,
-- all the service role's only (a signed-in user never reaches Vault):
--   * mail_secret_set(name, value): makes or replaces the Vault secret named docsmit_<name>. Only the four
--     Docsmit names are allowed; a blank value forgets the secret.
--   * mail_secret_get(name): the decrypted value, or null.
--   * mail_secrets_status(): which of the four are set, as jsonb {name: boolean}, never a value.

CREATE OR REPLACE FUNCTION public.mail_secret_name_ok(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_name IN ('docsmit_email', 'docsmit_password_sha512', 'docsmit_software_id', 'docsmit_base_url')
$$;

CREATE OR REPLACE FUNCTION public.mail_secret_set(p_name text, p_value text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_value text := btrim(coalesce(p_value, ''));
  v_id uuid;
BEGIN
  IF NOT public.mail_secret_name_ok(v_name) THEN
    RAISE EXCEPTION 'Not a Docsmit secret: %', p_name;
  END IF;
  SELECT id INTO v_id FROM vault.secrets WHERE name = v_name;
  IF v_value = '' THEN
    IF v_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_id; END IF;
    RETURN false;
  END IF;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_value, v_name, 'Docsmit (the certified-mail provider): set from Settings → Developer by mail-config.');
  ELSE
    PERFORM vault.update_secret(v_id, v_value, v_name, 'Docsmit (the certified-mail provider): set from Settings → Developer by mail-config.');
  END IF;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION public.mail_secret_get(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT s.decrypted_secret
  FROM vault.decrypted_secrets s
  WHERE s.name = lower(btrim(coalesce(p_name, ''))) AND public.mail_secret_name_ok(lower(btrim(coalesce(p_name, ''))))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.mail_secrets_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT jsonb_build_object(
    'docsmit_email', EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'docsmit_email'),
    'docsmit_password_sha512', EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'docsmit_password_sha512'),
    'docsmit_software_id', EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'docsmit_software_id'),
    'docsmit_base_url', EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'docsmit_base_url')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.mail_secret_name_ok(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mail_secret_set(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mail_secret_get(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mail_secrets_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mail_secret_set(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mail_secret_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mail_secrets_status() TO service_role;
