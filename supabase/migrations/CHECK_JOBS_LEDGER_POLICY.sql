-- Run in Supabase SQL Editor to verify jobs_ledger RLS policy.
-- If has_assistant_visibility = false, run APPLY_JOBS_LEDGER_ASSISTANT_VISIBILITY.sql.
-- The expanded policy includes master_assistants (for assistants seeing each other's jobs).

SELECT
  pol.polname AS policy_name,
  CASE WHEN pg_get_expr(pol.polqual, pol.polrelid)::text LIKE '%master_assistants%'
    THEN true ELSE false END AS has_assistant_visibility
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public' AND cls.relname = 'jobs_ledger'
  AND pol.polname = 'Devs, masters, assistants can read jobs ledger';
