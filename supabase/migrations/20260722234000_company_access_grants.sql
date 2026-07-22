-- Company-wide access grants (v2.921): the business runs as ONE company, but access
-- to customers/projects/workflows flows through per-master grant tables
-- (master_assistants, master_primaries, master_superintendents, master_shares) —
-- 82 policies and ~50 functions consult them. Rather than rewriting that surface,
-- this migration makes the grants COMPLETE and SELF-MAINTAINING: every live
-- dev/master "adopts" every live assistant/controller/primary/superintendent and
-- shares with every other dev/master. A users trigger re-syncs on hire/role
-- change/restore, so the Sharing & Adoption screen stops being needed and a
-- missing-adoption bug (e.g. a new assistant seeing no customers) can't recur.
-- Rows are only ever ADDED (idempotent ON CONFLICT DO NOTHING); nothing loses access.

CREATE OR REPLACE FUNCTION public.sync_company_access_grants()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owners AS (
    SELECT id FROM public.users
    WHERE archived_at IS NULL AND role IN ('dev', 'master_technician')
  )
  INSERT INTO public.master_assistants (master_id, assistant_id)
  SELECT o.id, u.id
  FROM owners o
  CROSS JOIN public.users u
  WHERE u.archived_at IS NULL AND u.role IN ('assistant', 'controller')
  ON CONFLICT DO NOTHING;

  WITH owners AS (
    SELECT id FROM public.users
    WHERE archived_at IS NULL AND role IN ('dev', 'master_technician')
  )
  INSERT INTO public.master_primaries (master_id, primary_id)
  SELECT o.id, u.id
  FROM owners o
  CROSS JOIN public.users u
  WHERE u.archived_at IS NULL AND u.role = 'primary'
  ON CONFLICT DO NOTHING;

  WITH owners AS (
    SELECT id FROM public.users
    WHERE archived_at IS NULL AND role IN ('dev', 'master_technician')
  )
  INSERT INTO public.master_superintendents (master_id, superintendent_id)
  SELECT o.id, u.id
  FROM owners o
  CROSS JOIN public.users u
  WHERE u.archived_at IS NULL AND u.role = 'superintendent'
  ON CONFLICT DO NOTHING;

  WITH owners AS (
    SELECT id FROM public.users
    WHERE archived_at IS NULL AND role IN ('dev', 'master_technician')
  )
  INSERT INTO public.master_shares (sharing_master_id, viewing_master_id)
  SELECT a.id, b.id
  FROM owners a
  CROSS JOIN owners b
  WHERE a.id <> b.id
  ON CONFLICT DO NOTHING;
$$;

COMMENT ON FUNCTION public.sync_company_access_grants() IS
  'Company-wide access (v2.921): fills the master_* grant tables with every eligible live pair so adoption/sharing is automatic. Additive + idempotent; called by trigger on users role/archived_at changes.';

CREATE OR REPLACE FUNCTION public.sync_company_access_grants_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_company_access_grants();
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS sync_company_access_grants_on_users ON public.users;
CREATE TRIGGER sync_company_access_grants_on_users
  AFTER INSERT OR UPDATE OF role, archived_at ON public.users
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_company_access_grants_trigger();

-- Seed now for all existing users.
SELECT public.sync_company_access_grants();
