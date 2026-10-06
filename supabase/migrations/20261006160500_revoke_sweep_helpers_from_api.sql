SET lock_timeout = '3s';

-- The three CREATE TABLE sweep helpers are SECURITY DEFINER functions in the
-- API-exposed public schema, and no migration ever revoked them, so the default
-- privileges left them executable by PUBLIC, anon and authenticated: anyone holding
-- the anon key (it ships in the client bundle) could POST /rest/v1/rpc/<helper> and
-- run DDL-capable code as postgres. Until 20261005222937_twin_fence_skip_existing.sql
-- the twin fence helper dropped and recreated every fence policy on each call, so one
-- such request locked every RLS table until it finished. All three only add what is
-- missing now, but nothing outside migrations calls them (no edge function, client
-- code, script, trigger or function body), so the API roles lose EXECUTE outright.
-- The owner (postgres, which db push runs as) and service_role keep it, and a later
-- CREATE OR REPLACE FUNCTION keeps these grants.
REVOKE EXECUTE ON FUNCTION public.apply_read_only_write_blocks() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_read_only_stmt_blocks() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_digital_twin_write_blocks() FROM PUBLIC, anon, authenticated;

-- Fail loudly if a REVOKE did nothing: run by a role without the owner's rights it
-- only warns "no privileges could be revoked", and this migration would record as
-- applied with the helpers still open to the API.
DO $$
DECLARE
  f text;
  r text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.apply_read_only_write_blocks()', 'public.apply_read_only_stmt_blocks()', 'public.apply_digital_twin_write_blocks()'] LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(r, f, 'EXECUTE') THEN
        RAISE EXCEPTION '% is still executable by %: the REVOKE did not take effect', f, r;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Self-test: the role db push runs as must still call all three, or every later
-- CREATE TABLE migration would fail on its footer. If it cannot, this statement fails
-- and the whole migration rolls back. With every table already covered, each call
-- creates nothing and takes no table locks.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
