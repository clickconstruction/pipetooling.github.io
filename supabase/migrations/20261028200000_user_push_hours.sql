SET lock_timeout = '3s';

-- v2.6026 — Push me: each person's own days and hours for pushes (punch list #141 PR 2;
-- docs/migrations/20261028200000_user_push_hours.md).
--
-- One row a person, in the Office hours card's shape said the right way round: the days and the hours they ARE
-- pushed, "HH:MM" Chicago, to after from. No row is any time. The person reads and writes their own row; the owner
-- and a dev read every row (the Office hours card's coverage line, PR 4); the service role reads for the senders
-- (PR 3 and PR 5). The client reads it fail-soft, so it may deploy first. Nothing holds a push until PR 3.
-- A table is created, so the three fence appliers run at the end.

CREATE TABLE IF NOT EXISTS public.user_push_hours (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  -- The days the person is pushed, 0 for Sunday to 6 for Saturday, at least one.
  days integer[] NOT NULL
    CONSTRAINT user_push_hours_days_known CHECK (cardinality(days) >= 1 AND days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]),
  -- From and to, "HH:MM" Chicago, zero-padded as the Office hours row keeps them, so the text order is the time order.
  opens text NOT NULL
    CONSTRAINT user_push_hours_opens_hm CHECK (opens ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  closes text NOT NULL
    CONSTRAINT user_push_hours_closes_hm CHECK (closes ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT user_push_hours_to_after_from CHECK (opens < closes),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.user_push_hours IS
  'Push me (v2.6026, punch list #141): the days and hours a person is pushed, one row a person; no row is any time. Own row to read and write; the owner and a dev read every row; the service role reads for the senders.';

ALTER TABLE public.user_push_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_push_hours_own ON public.user_push_hours;
CREATE POLICY user_push_hours_own ON public.user_push_hours
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_hours_master_or_dev_read ON public.user_push_hours;
CREATE POLICY user_push_hours_master_or_dev_read ON public.user_push_hours
  FOR SELECT TO authenticated USING ((SELECT public.is_master_or_dev()));

REVOKE ALL ON TABLE public.user_push_hours FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_push_hours TO authenticated;
GRANT ALL ON TABLE public.user_push_hours TO service_role;

-- ---------- The fences, for the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
