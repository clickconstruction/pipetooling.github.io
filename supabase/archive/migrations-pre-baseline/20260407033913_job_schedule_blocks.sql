-- Planned job work blocks (who / which day / time window, Central wall clock on work_date).
-- Schedule modal: Jobs Stages thread expand; Calendar Preview + chips read same rows.

CREATE TABLE public.job_schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  assignee_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  time_start time without time zone NOT NULL,
  time_end time without time zone NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_schedule_blocks_time_order CHECK (time_end > time_start),
  CONSTRAINT job_schedule_blocks_time_bounds CHECK (
    time_start >= time '04:00'
    AND time_end <= time '20:00'
  )
);

COMMENT ON TABLE public.job_schedule_blocks IS 'Office-scheduled work windows per job and assignee; times are Chicago wall time on work_date.';

CREATE INDEX idx_job_schedule_blocks_job_work_date
  ON public.job_schedule_blocks (job_id, work_date);

CREATE INDEX idx_job_schedule_blocks_assignee_work_date
  ON public.job_schedule_blocks (assignee_user_id, work_date);

CREATE OR REPLACE FUNCTION public.job_schedule_blocks_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_schedule_blocks_updated_at_tr ON public.job_schedule_blocks;
CREATE TRIGGER job_schedule_blocks_updated_at_tr
  BEFORE UPDATE ON public.job_schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.job_schedule_blocks_set_updated_at();

CREATE OR REPLACE FUNCTION public.job_schedule_blocks_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_schedule_blocks_created_by_tr ON public.job_schedule_blocks;
CREATE TRIGGER job_schedule_blocks_created_by_tr
  BEFORE INSERT ON public.job_schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.job_schedule_blocks_set_created_by();

ALTER TABLE public.job_schedule_blocks ENABLE ROW LEVEL SECURITY;

-- SELECT: same job visibility as thread notes / team, plus superintendent + project; always allow row if viewer is assignee.
CREATE POLICY "job_schedule_blocks_select"
  ON public.job_schedule_blocks FOR SELECT
  USING (
    assignee_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.jobs_ledger j
      WHERE j.id = job_schedule_blocks.job_id
        AND (
          public.is_dev()
          OR j.master_user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
          OR EXISTS (
            SELECT 1
            FROM public.master_superintendents ms
            WHERE ms.master_id = j.master_user_id
              AND ms.superintendent_id = auth.uid()
          )
          OR (j.project_id IS NOT NULL AND public.can_access_project_row(j.project_id))
          OR EXISTS (
            SELECT 1
            FROM public.master_assistants
            WHERE master_id = auth.uid()
              AND assistant_id = j.master_user_id
          )
          OR EXISTS (
            SELECT 1
            FROM public.master_assistants
            WHERE master_id = j.master_user_id
              AND assistant_id = auth.uid()
          )
          OR public.assistants_share_master(auth.uid(), j.master_user_id)
          OR EXISTS (
            SELECT 1
            FROM public.jobs_ledger_team_members jtm
            WHERE jtm.job_id = j.id
              AND jtm.user_id = auth.uid()
          )
        )
    )
  );

-- INSERT: dev, master_technician, assistant, superintendent with job manage access (not team-only subs)
CREATE POLICY "job_schedule_blocks_insert"
  ON public.job_schedule_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'superintendent')
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs_ledger j
      WHERE j.id = job_schedule_blocks.job_id
        AND (
          public.is_dev()
          OR j.master_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.master_assistants
            WHERE master_id = auth.uid()
              AND assistant_id = j.master_user_id
          )
          OR EXISTS (
            SELECT 1
            FROM public.master_assistants
            WHERE master_id = j.master_user_id
              AND assistant_id = auth.uid()
          )
          OR public.assistants_share_master(auth.uid(), j.master_user_id)
          OR EXISTS (
            SELECT 1
            FROM public.master_superintendents ms
            WHERE ms.master_id = j.master_user_id
              AND ms.superintendent_id = auth.uid()
          )
          OR (
            j.project_id IS NOT NULL
            AND public.can_access_project_row(j.project_id)
            AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
          )
        )
    )
  );

CREATE POLICY "job_schedule_blocks_update"
  ON public.job_schedule_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'superintendent')
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs_ledger j
      WHERE j.id = job_schedule_blocks.job_id
        AND (
          public.is_dev()
          OR j.master_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.master_assistants
            WHERE master_id = auth.uid()
              AND assistant_id = j.master_user_id
          )
          OR EXISTS (
            SELECT 1
            FROM public.master_assistants
            WHERE master_id = j.master_user_id
              AND assistant_id = auth.uid()
          )
          OR public.assistants_share_master(auth.uid(), j.master_user_id)
          OR EXISTS (
            SELECT 1
            FROM public.master_superintendents ms
            WHERE ms.master_id = j.master_user_id
              AND ms.superintendent_id = auth.uid()
          )
          OR (
            j.project_id IS NOT NULL
            AND public.can_access_project_row(j.project_id)
            AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'superintendent')
    )
  );

CREATE POLICY "job_schedule_blocks_delete"
  ON public.job_schedule_blocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'superintendent')
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs_ledger j
      WHERE j.id = job_schedule_blocks.job_id
        AND (
          public.is_dev()
          OR j.master_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.master_assistants
            WHERE master_id = auth.uid()
              AND assistant_id = j.master_user_id
          )
          OR EXISTS (
            SELECT 1
            FROM public.master_assistants
            WHERE master_id = j.master_user_id
              AND assistant_id = auth.uid()
          )
          OR public.assistants_share_master(auth.uid(), j.master_user_id)
          OR EXISTS (
            SELECT 1
            FROM public.master_superintendents ms
            WHERE ms.master_id = j.master_user_id
              AND ms.superintendent_id = auth.uid()
          )
          OR (
            j.project_id IS NOT NULL
            AND public.can_access_project_row(j.project_id)
            AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
          )
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_schedule_blocks TO authenticated;
