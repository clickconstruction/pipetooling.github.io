SET lock_timeout = '3s';

-- v2.1176: the dev-only location indicator on /people fetched user_id from
-- EVERY clock session that ever recorded GPS coords — unbounded, no date
-- filter, growing with history — just to build a distinct set of user ids in
-- the browser. Do the DISTINCT server-side instead. Mirrors the
-- get_archived_user_names read-RPC pattern from the baseline.
CREATE OR REPLACE FUNCTION public.get_location_enabled_user_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT user_id FROM clock_sessions
  WHERE (clock_in_lat IS NOT NULL OR clock_out_lat IS NOT NULL)
    AND user_id IS NOT NULL;
$$;

ALTER FUNCTION public.get_location_enabled_user_ids() OWNER TO postgres;
GRANT ALL ON FUNCTION public.get_location_enabled_user_ids() TO anon;
GRANT ALL ON FUNCTION public.get_location_enabled_user_ids() TO authenticated;
GRANT ALL ON FUNCTION public.get_location_enabled_user_ids() TO service_role;
