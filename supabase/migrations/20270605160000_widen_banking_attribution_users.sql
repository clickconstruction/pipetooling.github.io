-- Widen the Banking attribution picker to ANY non-archived user (drop the role filter).
-- list_users_for_banking_attribution previously restricted to a 9-role allowlist, which
-- excluded the `helpers` role (real people who appear in the People → Users roster but
-- couldn't be attributed). Removing the role filter makes every non-archived user
-- selectable in all Banking attribution pickers (User Review, allocations modal,
-- card-link modal, Parts unattributed, snapshot) — they all read this one RPC.
--
-- SECURITY DEFINER, so it bypasses the users SELECT RLS (no RLS change needed). The
-- caller gate (dev/master_technician/assistant) and archived exclusion are unchanged.

CREATE OR REPLACE FUNCTION public.list_users_for_banking_attribution()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u.name
  FROM public.users u
  WHERE u.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.users caller
      WHERE caller.id = auth.uid()
        AND caller.role IN ('dev', 'master_technician', 'assistant')
    )
  ORDER BY u.name;
$$;
