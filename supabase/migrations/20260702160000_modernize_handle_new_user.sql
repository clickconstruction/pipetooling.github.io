-- Modernize handle_new_user (fires on auth.users INSERT via on_auth_user_created).
-- The previous version predated the role renames: it only honored invited_role in
-- ('owner','master','assistant','subcontractor') and defaulted everyone else to
-- 'master' — a legacy enum label the app no longer recognizes. Invites carrying any
-- modern role (dev, master_technician, helpers, estimator, primary, superintendent)
-- silently landed as 'master'.
--
-- Changes:
--   * invited_role accepts the modern 8-role list.
--   * Default for users with no/unknown invited_role (e.g. public /sign-up) is now
--     'helpers' — least-privileged common role — instead of legacy 'master'.
--   * ON CONFLICT (id) DO NOTHING so an edge-function upsert racing the trigger
--     (create-user / invite-user both write public.users explicitly) can't abort
--     auth user creation.

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  invited text := NEW.raw_user_meta_data->>'invited_role';
  r public.user_role;
BEGIN
  IF invited IN ('dev','master_technician','assistant','subcontractor',
                 'helpers','estimator','primary','superintendent') THEN
    r := invited::public.user_role;
  ELSE
    r := 'helpers'::public.user_role;
  END IF;
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    r
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Creates the public.users row for a new auth user. Role comes from raw_user_meta_data.invited_role (set by the invite-user edge function) when it is one of the modern roles; otherwise defaults to helpers (least privilege, covers public sign-up). Idempotent vs edge-function upserts via ON CONFLICT DO NOTHING.';
