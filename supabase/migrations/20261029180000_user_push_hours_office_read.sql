SET lock_timeout = '3s';

-- v2.6060 — the office reads every person's Push me hours (punch list #141 PR 4;
-- docs/migrations/20261029180000_user_push_hours_office_read.md).
--
-- The thread's pill on Messages says when whoever has the reply is off, and when every office member is, read from
-- user_push_hours (20261028200000). The reply push already tells the office that in words (v2.6029, "Dana wrote to
-- Luis, who is off until 6 AM"). Until now a person read their own row and only the owner and a dev read every row
-- (user_push_hours_master_or_dev_read); the office team (gc_office_team(): dev, master_technician, assistant,
-- controller, estimator) reads every row too. Additive, SELECT alone; no new table, so no fences. Idempotent.

DROP POLICY IF EXISTS user_push_hours_office_read ON public.user_push_hours;
CREATE POLICY user_push_hours_office_read ON public.user_push_hours
  FOR SELECT TO authenticated USING ((SELECT public.gc_office_team()));

COMMENT ON POLICY user_push_hours_office_read ON public.user_push_hours IS
  'Punch list #141 PR 4 (v2.6060): the office team reads every person''s Push me hours, for the thread''s pill on Messages and the Office hours card''s coverage line.';
