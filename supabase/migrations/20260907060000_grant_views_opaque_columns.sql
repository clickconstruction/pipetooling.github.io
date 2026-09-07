SET lock_timeout = '3s';

-- v2.2995 — the master_assistants / master_shares views stop looking like users(id) to PostgREST.
--
-- 20260907050000 (one company, Phase 5) replaced the two grant tables with views whose columns
-- are plain references to public.users.id. PostgREST (and `supabase gen types`) trace plain view
-- columns back to their base column, so every foreign key that references users(id) — dozens of
-- tables, hundreds of FKs — gained four extra "relationships" through the views. Effects:
--   * `database.ts` grew from 20.7k to 29.1k lines and the client stopped typechecking
--     ("Type instantiation is excessively deep" on ReturnType<typeof supabase.from>);
--   * resource embedding gained ambiguous paths users → master_assistants / master_shares.
-- Wrapping each id in a CASE makes the column an expression: same value on every row (the WHERE
-- already keeps archived users out), same type, but no longer traceable to users.id, so the
-- relationship graph and the generated types return to their pre-Phase-5 shape.
-- CREATE OR REPLACE keeps column names and types, so the 84 policies and 45 functions that bind
-- to these views are untouched. Idempotent.

CREATE OR REPLACE VIEW public.master_assistants AS
  SELECT (CASE WHEN o.archived_at IS NULL THEN o.id END) AS master_id,
         (CASE WHEN u.archived_at IS NULL THEN u.id END) AS assistant_id,
         u.created_at
  FROM public.users o
  CROSS JOIN public.users u
  WHERE o.archived_at IS NULL
    AND o.role IN ('dev', 'master_technician')
    AND u.archived_at IS NULL
    AND u.role IN ('assistant', 'controller', 'estimator')
    AND u.id <> o.id;

CREATE OR REPLACE VIEW public.master_shares AS
  SELECT (CASE WHEN a.archived_at IS NULL THEN a.id END) AS sharing_master_id,
         (CASE WHEN b.archived_at IS NULL THEN b.id END) AS viewing_master_id,
         b.created_at
  FROM public.users a
  CROSS JOIN public.users b
  WHERE a.archived_at IS NULL
    AND b.archived_at IS NULL
    AND a.role IN ('dev', 'master_technician')
    AND b.role IN ('dev', 'master_technician')
    AND a.id <> b.id;

COMMENT ON VIEW public.master_assistants IS
  'One company (v2.2987): adoption BY RULE — every live dev/master paired with every live assistant, controller and estimator. Replaces the synced table so the 45 RPCs and 84 policies that still name master_assistants keep answering yes for the whole office with nothing to sync. Not an access decision: is_office_staff() is. Ids are wrapped in CASE (v2.2995) so PostgREST does not relate every users FK through this view.';
COMMENT ON VIEW public.master_shares IS
  'One company (v2.2987): sharing BY RULE — every live dev/master paired with every other. Replaces the synced table; see master_assistants. Ids wrapped in CASE (v2.2995) for the same reason.';
