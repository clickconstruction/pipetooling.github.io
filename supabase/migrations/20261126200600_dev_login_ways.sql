SET lock_timeout = '3s';

-- A login's ways in, for the person desk (punch list #447, the desk's Ways in row).
--
-- A person may now sign in with Google beside their password (v2.8670). The Auth server keeps one row a
-- way in in auth.identities, and nothing in the app could read it or take a way in away. Two functions,
-- each a dev's alone:
--
--   dev_login_ways(p_user_id)     reads: is a password set, and each way in with the address it carries
--                                 and when it was last used. It never returns a hash or a token.
--   dev_unlink_google(p_user_id)  takes the Google way in off one login, and ends that login's open
--                                 sessions so a Google session cannot outlive the link. The password,
--                                 the person and every row that points at them stay. A login whose only
--                                 way in is Google is refused: set a password first, so nobody is locked
--                                 out by the press.
--
-- change-user-email calls the second as the service role when a dev moves a person's address: the Google
-- link is held by Google's own id and would otherwise go on opening the login from the old account.
--
-- No table is made, so no fence call is owed. Both functions are SECURITY DEFINER with an empty search
-- path, and say who may run them.

CREATE OR REPLACE FUNCTION public.dev_login_ways(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_login boolean;
  v_has_password boolean;
  v_ways jsonb;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev reads a login''s ways in.' USING ERRCODE = '42501';
  END IF;
  SELECT true, (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '')
    INTO v_has_login, v_has_password
    FROM auth.users u WHERE u.id = p_user_id;
  IF v_has_login IS NULL THEN
    RETURN jsonb_build_object('has_login', false, 'has_password', false, 'ways', '[]'::jsonb);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'provider', i.provider,
           'email', i.identity_data->>'email',
           'last_sign_in_at', i.last_sign_in_at,
           'linked_at', i.created_at
         ) ORDER BY i.created_at), '[]'::jsonb)
    INTO v_ways
    FROM auth.identities i WHERE i.user_id = p_user_id;
  RETURN jsonb_build_object('has_login', true, 'has_password', coalesce(v_has_password, false), 'ways', v_ways);
END;
$$;

CREATE OR REPLACE FUNCTION public.dev_unlink_google(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_removed integer;
  v_other_ways integer;
  v_has_password boolean;
BEGIN
  -- A dev, or an edge function acting for one (change-user-email runs as the service role).
  IF NOT (public.is_dev() OR coalesce((SELECT auth.role()), '') = 'service_role') THEN
    RAISE EXCEPTION 'Only a dev removes a way in.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = p_user_id AND i.provider = 'google') THEN
    RETURN jsonb_build_object('removed', 0);
  END IF;
  SELECT count(*) INTO v_other_ways FROM auth.identities i WHERE i.user_id = p_user_id AND i.provider <> 'google';
  SELECT (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '') INTO v_has_password FROM auth.users u WHERE u.id = p_user_id;
  IF v_other_ways = 0 AND NOT coalesce(v_has_password, false) THEN
    RAISE EXCEPTION 'Google is their only way in. Set a password first.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM auth.identities i WHERE i.user_id = p_user_id AND i.provider = 'google';
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- The login's own list of ways in, which the Auth server reads when it signs a token.
  UPDATE auth.users u
     SET raw_app_meta_data =
           jsonb_set(
             CASE WHEN coalesce(u.raw_app_meta_data->>'provider', '') = 'google'
                  THEN jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{provider}', '"email"'::jsonb)
                  ELSE coalesce(u.raw_app_meta_data, '{}'::jsonb) END,
             '{providers}',
             coalesce((SELECT jsonb_agg(p) FROM jsonb_array_elements_text(coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb)) AS p WHERE p <> 'google'), '[]'::jsonb))
   WHERE u.id = p_user_id;

  -- A session that Google opened must not outlive the link. Ending every session is the plain rule:
  -- the person signs in again with their password or an emailed link.
  DELETE FROM auth.sessions s WHERE s.user_id = p_user_id;

  RETURN jsonb_build_object('removed', v_removed);
END;
$$;

REVOKE ALL ON FUNCTION public.dev_login_ways(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dev_unlink_google(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_login_ways(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dev_unlink_google(uuid) TO authenticated, service_role;
