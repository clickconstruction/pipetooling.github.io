SET lock_timeout = '3s';

-- Bid-anchored schedule blocks (v2.1613).
--
-- The dispatch calendar could only schedule jobs: job_schedule_blocks.job_id
-- was NOT NULL and every RLS policy resolved visibility through jobs_ledger.
-- Office staff had no way to put bid work (site walks, estimating visits,
-- pre-construction) on a person's day. This migration makes the block anchor
-- a union — exactly one of job_id / bid_id — following the reports_one_anchor
-- pattern.
--
-- RLS is ADDITIVE: the four existing job-anchored policies are untouched
-- (permissive policies OR together). New _bid_ policies cover bid-anchored
-- rows: the same office-role gate as the job policies, with bid visibility
-- inherited from the bids table's own RLS via a bare EXISTS. Field roles keep
-- seeing their own blocks through the existing SELECT policy's
-- assignee_user_id arm, which never referenced the job.
--
-- self_move_schedule_block gains a job_id guard: it posted a jobs_ledger
-- thread note on dispatch-created moves, which would raise NOT NULL for a
-- bid-anchored block and fail the whole move. Bid moves skip the note.
-- (Body copied from 20260811140701, the live definition.)

ALTER TABLE public.job_schedule_blocks
  ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.job_schedule_blocks.bid_id IS
  'Bid anchor (v2.1613): exactly one of job_id / bid_id is set (one_anchor CHECK).';

ALTER TABLE public.job_schedule_blocks
  ALTER COLUMN job_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.job_schedule_blocks
    ADD CONSTRAINT job_schedule_blocks_one_anchor
    CHECK ((job_id IS NULL) <> (bid_id IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_job_schedule_blocks_bid_id
  ON public.job_schedule_blocks (bid_id) WHERE bid_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Bid-anchored policies (additive; job policies untouched).
-- Office schedule-edit roles = the same array the job policies use. The
-- EXISTS on bids runs under the caller's rights, so the bids table's own RLS
-- (dev / master_technician / assistant / estimator / primary read all bids)
-- decides bid visibility — superintendents fall out of the bid branch
-- naturally, and estimators/primaries can SEE bid blocks but not write them.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "job_schedule_blocks_bid_select" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_bid_select" ON public.job_schedule_blocks
  FOR SELECT USING (
    bid_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_schedule_blocks.bid_id)
  );

DROP POLICY IF EXISTS "job_schedule_blocks_bid_insert" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_bid_insert" ON public.job_schedule_blocks
  FOR INSERT WITH CHECK (
    bid_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'superintendent'::public.user_role])
    )
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_schedule_blocks.bid_id)
  );

DROP POLICY IF EXISTS "job_schedule_blocks_bid_update" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_bid_update" ON public.job_schedule_blocks
  FOR UPDATE USING (
    bid_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'superintendent'::public.user_role])
    )
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_schedule_blocks.bid_id)
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'superintendent'::public.user_role])
    )
  );

DROP POLICY IF EXISTS "job_schedule_blocks_bid_delete" ON public.job_schedule_blocks;
CREATE POLICY "job_schedule_blocks_bid_delete" ON public.job_schedule_blocks
  FOR DELETE USING (
    bid_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'superintendent'::public.user_role])
    )
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_schedule_blocks.bid_id)
  );

-- ---------------------------------------------------------------------------
-- move_job_schedule_block_group: allow NULL p_job_id (bid-anchored groups).
-- Same body as the live (baseline) definition with every `job_id = p_job_id`
-- predicate relaxed to `(p_job_id IS NULL OR job_id = p_job_id)` — group ids
-- are unique UUIDs, so the job filter was always redundant; old clients that
-- still pass a job id keep byte-identical behavior. Runs as invoker (RLS).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."move_job_schedule_block_group"("p_job_id" "uuid", "p_shared_block_group_id" "uuid", "p_new_work_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM id
  FROM public.job_schedule_blocks
  WHERE (p_job_id IS NULL OR job_id = p_job_id)
    AND shared_block_group_id = p_shared_block_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No schedule blocks found for that linked group.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.job_schedule_blocks L
    WHERE (p_job_id IS NULL OR L.job_id = p_job_id)
      AND L.shared_block_group_id = p_shared_block_group_id
      AND L.work_date IS DISTINCT FROM p_new_work_date
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_schedule_blocks L
    INNER JOIN public.job_schedule_blocks O
      ON O.assignee_user_id = L.assignee_user_id
     AND O.work_date = p_new_work_date
     AND O.id NOT IN (
       SELECT id
       FROM public.job_schedule_blocks
       WHERE (p_job_id IS NULL OR job_id = p_job_id)
         AND shared_block_group_id = p_shared_block_group_id
     )
     AND L.time_start < O.time_end
     AND O.time_start < L.time_end
    WHERE (p_job_id IS NULL OR L.job_id = p_job_id)
      AND L.shared_block_group_id = p_shared_block_group_id
  ) THEN
    RAISE EXCEPTION 'That time overlaps another block for this person on this day.';
  END IF;

  UPDATE public.job_schedule_blocks
  SET work_date = p_new_work_date
  WHERE (p_job_id IS NULL OR job_id = p_job_id)
    AND shared_block_group_id = p_shared_block_group_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- self_move_schedule_block: guard the thread-note insert for bid blocks.
-- Identical to the 20260811140701 body except the note fires only when the
-- moved block has a job anchor.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.self_move_schedule_block(
  p_block_id uuid,
  p_work_date date,
  p_time_start time,
  p_time_end time
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_block public.job_schedule_blocks%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF p_time_end <= p_time_start THEN
    RAISE EXCEPTION 'end time must be after start time';
  END IF;

  SELECT * INTO v_block
  FROM public.job_schedule_blocks b
  WHERE b.id = p_block_id AND b.assignee_user_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'block not found or not yours';
  END IF;

  IF v_block.work_date = p_work_date
     AND v_block.time_start = p_time_start
     AND v_block.time_end = p_time_end THEN
    RETURN; -- nothing moved
  END IF;

  UPDATE public.job_schedule_blocks b
  SET work_date = p_work_date,
      time_start = p_time_start,
      time_end = p_time_end,
      -- Moving your block out of a linked crew group unlinks just you (the
      -- office Manage Day editor's existing semantic).
      shared_block_group_id = NULL,
      field_moved_at = CASE WHEN v_block.created_by IS DISTINCT FROM v_uid THEN now() ELSE b.field_moved_at END,
      field_moved_from = CASE
        WHEN v_block.created_by IS DISTINCT FROM v_uid THEN
          COALESCE(
            b.field_moved_from,
            jsonb_build_object(
              'work_date', v_block.work_date,
              'time_start', v_block.time_start,
              'time_end', v_block.time_end
            )
          )
        ELSE b.field_moved_from
      END
  WHERE b.id = p_block_id;

  -- The trail: dispatch-created moves post to the job thread. Bid-anchored
  -- blocks (v2.1613) have no job thread — the move itself still lands.
  IF v_block.created_by IS DISTINCT FROM v_uid AND v_block.job_id IS NOT NULL THEN
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
    VALUES (
      v_block.job_id,
      v_uid,
      'Moved my scheduled visit from ' || v_block.work_date || ' ' ||
      to_char(v_block.time_start, 'HH12:MI AM') || '–' || to_char(v_block.time_end, 'HH12:MI AM') ||
      ' to ' || p_work_date || ' ' ||
      to_char(p_time_start, 'HH12:MI AM') || '–' || to_char(p_time_end, 'HH12:MI AM')
    );
  END IF;
END;
$$;
