SET lock_timeout = '3s';

-- The seal behind the Away note (punch list #256, PR 7, v2.6572). A teammate who left may, in PR 8, sign in
-- to one screen the office leaves for them (the Away note). The app hiding every other screen locks nothing: a
-- signed-in person holds a token that reaches the database, realtime, file storage and the edge functions
-- directly. So the seal is four locks on an archived caller (public.users.archived_at set), and this migration
-- is the three that live in the database; the fourth is the edge guard supabase/functions/_shared/refuseArchivedCaller.ts.
--
--   1. One gate before every database request: a PostgREST pre-request function (pgrst.db_pre_request) that
--      refuses every request from an archived caller except rpc/my_away_note (PR 8's one RPC). It covers tables,
--      views (most run as their owner and skip row rules), every RPC including the SECURITY DEFINER ones, GraphQL,
--      and edge functions that query as the caller. One lookup by primary key, the shape of is_read_only(), on
--      every request for everyone; the seal probe (scripts/pgtest-archived-seal.sh) measures it.
--   2. A fence on every table, restrictive like training mode's (apply_read_only_write_blocks) but on every
--      command: apply_archived_read_blocks(). It is what realtime obeys, and the lock behind the gate. It is the
--      fourth call every CREATE TABLE migration ends with (CLAUDE.md, scripts/check-migrations.sh).
--   3. File storage: the same fence on storage.objects.
--
-- Archived accounts are banned at sign-in today (archive-user), so nothing changes for anyone until PR 8 skips
-- the ban for a person with a note on. Idempotent: CREATE OR REPLACE throughout, and the fence creates only where
-- it is missing, so the first push locks every RLS table for the length of this transaction (push it in a quiet
-- moment) and every rerun locks nothing. Never bypassed by the service role, which carries no sub, so a function
-- that switches to it reads nothing of the caller here: that is the fourth lock's job.

-- 1. The predicate: the signed-in account is archived. SECURITY DEFINER, so the users row is read whatever the
--    caller's own row rules say; STABLE, so a policy's (SELECT ...) wrapper runs it once per statement.
CREATE OR REPLACE FUNCTION public.caller_is_archived() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND archived_at IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.caller_is_archived() IS 'True when the signed-in account is archived (users.archived_at set). The seal behind the Away note (punch list #256): the pre-request gate, the archived_fence policies on every table and on storage.objects all read it.';

REVOKE ALL ON FUNCTION public.caller_is_archived() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.caller_is_archived() TO anon, authenticated, service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN
    GRANT EXECUTE ON FUNCTION public.caller_is_archived() TO hr_agent;
  END IF;
END $$;

-- 2. The gate. PostgREST calls it before every request with request.path, request.method and request.jwt.claims
--    set. No sub (anon, the service role, a cron) passes; the Away note's own RPC passes; an archived caller is
--    refused with PT403, which PostgREST answers as HTTP 403 with these words.
CREATE OR REPLACE FUNCTION public.archived_pre_request() RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  path text := current_setting('request.path', true);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF path = '/rpc/my_away_note' THEN
    RETURN;
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived. The Away note is the one page it may read.'
      USING ERRCODE = 'PT403', DETAIL = 'archived_caller', HINT = 'Bring back the teammate to open the app again.';
  END IF;
END $$;

COMMENT ON FUNCTION public.archived_pre_request() IS 'PostgREST pre-request gate (pgrst.db_pre_request): refuses every request from an archived caller except /rpc/my_away_note. The seal behind the Away note (punch list #256).';

REVOKE ALL ON FUNCTION public.archived_pre_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archived_pre_request() TO anon, authenticated, service_role;

-- The setting lives on the authenticator role, where PostgREST reads it; the NOTIFY makes a running PostgREST
-- reload it. On a host where the migration's role may not alter authenticator, this warns instead of failing the
-- push, and the setting is made by hand in the SQL editor with the same ALTER ROLE; the fragment names the check.
DO $$
BEGIN
  EXECUTE $sql$ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.archived_pre_request'$sql$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'archived_seal: could not set pgrst.db_pre_request on authenticator (%). Run by hand: ALTER ROLE authenticator SET pgrst.db_pre_request = ''public.archived_pre_request''; NOTIFY pgrst, ''reload config'';', SQLERRM;
END $$;
NOTIFY pgrst, 'reload config';

-- 3. The fence on every table: one restrictive policy, archived_fence, on every RLS-enabled public table that
--    lacks it, for every command, so an archived caller reads nothing and writes nothing however the table's own
--    policies read. The (SELECT ...) wrapper makes the predicate an InitPlan, once per statement, not once per row.
--    Creates only what is missing, so a rerun after CREATE TABLE locks exactly the new table.
CREATE OR REPLACE FUNCTION public.apply_archived_read_blocks() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  t record;
  created integer := 0;
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polname = 'archived_fence')
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE POLICY archived_fence ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT NOT public.caller_is_archived())) WITH CHECK ((SELECT NOT public.caller_is_archived()))',
      t.table_name
    );
    created := created + 1;
  END LOOP;
  RETURN created;
END $$;

COMMENT ON FUNCTION public.apply_archived_read_blocks() IS 'Adds the restrictive archived_fence policy (every command, authenticated, NOT caller_is_archived()) to every RLS-enabled public table that lacks it. The fourth fence call every CREATE TABLE migration ends with (punch list #256).';

REVOKE EXECUTE ON FUNCTION public.apply_archived_read_blocks() FROM PUBLIC, anon, authenticated;

-- 4. File storage: the same fence on storage.objects, so a signed-in archived account downloads and uploads nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'archived_fence') THEN
    CREATE POLICY archived_fence ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
      USING ((SELECT NOT public.caller_is_archived()))
      WITH CHECK ((SELECT NOT public.caller_is_archived()));
  END IF;
END $$;

-- Every table gets its fence now; later CREATE TABLE migrations call this with the other three.
SELECT public.apply_archived_read_blocks();
