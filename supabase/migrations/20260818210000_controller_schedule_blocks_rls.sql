SET lock_timeout = '3s';

-- Controller can edit schedule blocks (v2.1811).
--
-- The client has treated controller as a schedule-dispatch editor since the
-- swim-lanes work (CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES in
-- src/lib/scheduleDispatchEditRoles.ts includes 'controller'), and
-- docs/ACCESS_CONTROL.md says controller does everything an assistant can.
-- But every job_schedule_blocks WRITE policy — the four job-anchored ones in
-- the baseline and the four bid-anchored ones from 20260813224521 — gates on
-- the literal array ['dev','master_technician','assistant','superintendent'].
-- Controller is missing, so a controller's block insert/update/delete fails
-- RLS while the UI happily offers the drag. (dispatch_swim_lanes got the
-- 5-role array from day one — 20260721230000's header even flags the parity
-- gap it was working around.)
--
-- Fix: one capability function for the schedule-dispatch edit cohort, used by
-- all eight write policies. Mirrors the client set — keep the two in sync.
-- The job-visibility arm of each policy is unchanged: controllers resolve job
-- visibility like assistants (master_assistants is role-agnostic and
-- assistants_share_master() is membership-based, not role-based).
--
-- Idempotent: CREATE OR REPLACE + DROP POLICY IF EXISTS/CREATE, each policy
-- recreated atomically inside the migration transaction.

CREATE OR REPLACE FUNCTION public.can_edit_schedule_dispatch()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent')
  );
$$;

COMMENT ON FUNCTION public.can_edit_schedule_dispatch() IS
  'Schedule-dispatch edit cohort (v2.1811): mirror of CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES in src/lib/scheduleDispatchEditRoles.ts — keep in sync. Used by the job_schedule_blocks write policies (job- and bid-anchored).';

-- ---------------------------------------------------------------------------
-- Job-anchored write policies: baseline definitions with the literal 4-role
-- gate swapped for can_edit_schedule_dispatch(). The jobs_ledger visibility
-- expression is unchanged. (job_id IS NULL bid rows still fall through to the
-- _bid_ policies below — the EXISTS on jobs_ledger never matches NULL.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "job_schedule_blocks_insert" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_insert" ON public.job_schedule_blocks
  FOR INSERT WITH CHECK (
    public.can_edit_schedule_dispatch()
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = job_schedule_blocks.job_id
        AND (
          public.is_dev()
          OR j.master_user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.master_assistants
            WHERE master_assistants.master_id = (SELECT auth.uid())
              AND master_assistants.assistant_id = j.master_user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.master_assistants
            WHERE master_assistants.master_id = j.master_user_id
              AND master_assistants.assistant_id = (SELECT auth.uid())
          )
          OR public.assistants_share_master((SELECT auth.uid()), j.master_user_id)
          OR EXISTS (
            SELECT 1 FROM public.master_superintendents ms
            WHERE ms.master_id = j.master_user_id
              AND ms.superintendent_id = (SELECT auth.uid())
          )
          OR (
            j.project_id IS NOT NULL
            AND public.can_access_project_row(j.project_id)
            AND EXISTS (
              SELECT 1 FROM public.users
              WHERE users.id = (SELECT auth.uid())
                AND users.role = 'superintendent'::public.user_role
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "job_schedule_blocks_update" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_update" ON public.job_schedule_blocks
  FOR UPDATE USING (
    public.can_edit_schedule_dispatch()
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = job_schedule_blocks.job_id
        AND (
          public.is_dev()
          OR j.master_user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.master_assistants
            WHERE master_assistants.master_id = (SELECT auth.uid())
              AND master_assistants.assistant_id = j.master_user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.master_assistants
            WHERE master_assistants.master_id = j.master_user_id
              AND master_assistants.assistant_id = (SELECT auth.uid())
          )
          OR public.assistants_share_master((SELECT auth.uid()), j.master_user_id)
          OR EXISTS (
            SELECT 1 FROM public.master_superintendents ms
            WHERE ms.master_id = j.master_user_id
              AND ms.superintendent_id = (SELECT auth.uid())
          )
          OR (
            j.project_id IS NOT NULL
            AND public.can_access_project_row(j.project_id)
            AND EXISTS (
              SELECT 1 FROM public.users
              WHERE users.id = (SELECT auth.uid())
                AND users.role = 'superintendent'::public.user_role
            )
          )
        )
    )
  ) WITH CHECK (
    public.can_edit_schedule_dispatch()
  );

DROP POLICY IF EXISTS "job_schedule_blocks_delete" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_delete" ON public.job_schedule_blocks
  FOR DELETE USING (
    public.can_edit_schedule_dispatch()
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = job_schedule_blocks.job_id
        AND (
          public.is_dev()
          OR j.master_user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.master_assistants
            WHERE master_assistants.master_id = (SELECT auth.uid())
              AND master_assistants.assistant_id = j.master_user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.master_assistants
            WHERE master_assistants.master_id = j.master_user_id
              AND master_assistants.assistant_id = (SELECT auth.uid())
          )
          OR public.assistants_share_master((SELECT auth.uid()), j.master_user_id)
          OR EXISTS (
            SELECT 1 FROM public.master_superintendents ms
            WHERE ms.master_id = j.master_user_id
              AND ms.superintendent_id = (SELECT auth.uid())
          )
          OR (
            j.project_id IS NOT NULL
            AND public.can_access_project_row(j.project_id)
            AND EXISTS (
              SELECT 1 FROM public.users
              WHERE users.id = (SELECT auth.uid())
                AND users.role = 'superintendent'::public.user_role
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Bid-anchored write policies (20260813224521): same swap. Bid visibility
-- still rides the bids table's own RLS via the bare EXISTS.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "job_schedule_blocks_bid_insert" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_bid_insert" ON public.job_schedule_blocks
  FOR INSERT WITH CHECK (
    bid_id IS NOT NULL
    AND public.can_edit_schedule_dispatch()
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_schedule_blocks.bid_id)
  );

DROP POLICY IF EXISTS "job_schedule_blocks_bid_update" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_bid_update" ON public.job_schedule_blocks
  FOR UPDATE USING (
    bid_id IS NOT NULL
    AND public.can_edit_schedule_dispatch()
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_schedule_blocks.bid_id)
  ) WITH CHECK (
    public.can_edit_schedule_dispatch()
  );

DROP POLICY IF EXISTS "job_schedule_blocks_bid_delete" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_bid_delete" ON public.job_schedule_blocks
  FOR DELETE USING (
    bid_id IS NOT NULL
    AND public.can_edit_schedule_dispatch()
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_schedule_blocks.bid_id)
  );
