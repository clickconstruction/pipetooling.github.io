SET lock_timeout = '3s';

-- v2.2932: watchers. Who hears when a sub reports on a job — a percent, "my
-- work here is done", or picked dates — by email, as it happens. Assigned
-- superintendents (jobs_ledger_team_members × users.role = superintendent)
-- watch by default; anyone the office subscribes joins them; a row can turn
-- any of the three kinds off. Sends are logged so one person hears about one
-- job's one kind at most once an hour. Additive + idempotent.

CREATE TABLE IF NOT EXISTS public.job_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hear_progress boolean NOT NULL DEFAULT true,
  hear_done boolean NOT NULL DEFAULT true,
  hear_dates boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'assigned')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_watchers_job_user_key UNIQUE (job_id, user_id)
);
COMMENT ON TABLE public.job_watchers IS 'Who hears (by email) when a sub reports on this job: percent, done, dates. Assigned superintendents are implied; a row here adds someone or changes what one hears.';

CREATE INDEX IF NOT EXISTS job_watchers_job_idx ON public.job_watchers (job_id);
CREATE INDEX IF NOT EXISTS job_watchers_user_idx ON public.job_watchers (user_id);

DROP TRIGGER IF EXISTS job_watchers_set_updated_at ON public.job_watchers;
CREATE TRIGGER job_watchers_set_updated_at
  BEFORE UPDATE ON public.job_watchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.job_watcher_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('progress', 'done', 'dates')),
  subject text,
  sent boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.job_watcher_notices IS 'One row per watcher email (or a folded skip when one went out within the hour). Written by the submit-sub-portal function.';
CREATE INDEX IF NOT EXISTS job_watcher_notices_fold_idx ON public.job_watcher_notices (user_id, job_id, kind, created_at DESC);

ALTER TABLE public.job_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_watcher_notices ENABLE ROW LEVEL SECURITY;

-- Read: the office set, superintendents, and always your own rows.
DROP POLICY IF EXISTS jw_select ON public.job_watchers;
CREATE POLICY jw_select ON public.job_watchers FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role IN ('dev','master_technician','assistant','controller','estimator','superintendent')
  )
);
-- Write: the office set for anyone; anyone for their own row (watch / unwatch / what they hear).
DROP POLICY IF EXISTS jw_insert ON public.job_watchers;
CREATE POLICY jw_insert ON public.job_watchers FOR INSERT WITH CHECK (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);
DROP POLICY IF EXISTS jw_update ON public.job_watchers;
CREATE POLICY jw_update ON public.job_watchers FOR UPDATE USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
) WITH CHECK (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);
DROP POLICY IF EXISTS jw_delete ON public.job_watchers;
CREATE POLICY jw_delete ON public.job_watchers FOR DELETE USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician','assistant','controller','estimator')
  )
);

-- Notices: your own, and the office; written only by the service role.
DROP POLICY IF EXISTS jwn_select ON public.job_watcher_notices;
CREATE POLICY jwn_select ON public.job_watcher_notices FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician','assistant','controller')
  )
);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
