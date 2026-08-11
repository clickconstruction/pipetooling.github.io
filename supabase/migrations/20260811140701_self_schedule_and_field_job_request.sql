SET lock_timeout = '3s';

-- Self-scheduling + field job requests (v2.1568, owner-approved plan+mockups).
--
-- My Schedule gains "+ Add job" (all roles): search any active job, put it on
-- your own schedule, reflow your own day, and — when the job doesn't exist —
-- request it from the field. Field roles can't see jobs beyond their crew and
-- can't write schedule blocks, so everything goes through SECURITY DEFINER
-- RPCs with tight validation instead of widening table RLS:
--
--   search_jobs_for_self_schedule(q)   identity fields only (no money), jobs in
--                                      waiting/working/ready_to_bill/billed, cap 20.
--   self_schedule_add_block(...)       block for YOURSELF on an active job
--                                      (+ optional crew join so the job stays
--                                      visible to field roles elsewhere).
--   self_move_schedule_block(...)      move any block ASSIGNED TO YOU. Moving a
--                                      dispatch-created block stamps the trail
--                                      (field_moved_at + first original window in
--                                      field_moved_from), unlinks you from a crew
--                                      group, and posts a job thread note —
--                                      movement is free, silence is prevented.
--   self_remove_schedule_block(...)    delete ONLY blocks you created yourself;
--                                      dispatch-created visits can be moved, never
--                                      removed, from the field.
--   request_field_job(...)             creates a REAL Waiting job (customer kept as
--                                      text fields — office links/creates the real
--                                      customer on review), name-only line items,
--                                      schedules the requester, and files a
--                                      'review_field_job' dispatch request.
--
-- Table RLS is untouched. Training-mode users are still blocked: the v2.704
-- read_only statement triggers fire inside SECURITY DEFINER functions too.
-- The two new columns are additive; old clients ignore them.

ALTER TABLE public.job_schedule_blocks
  ADD COLUMN IF NOT EXISTS field_moved_at timestamptz,
  ADD COLUMN IF NOT EXISTS field_moved_from jsonb;

COMMENT ON COLUMN public.job_schedule_blocks.field_moved_at IS
  'Last time the assignee moved this dispatch-created block themselves (v2.1568 self-scheduling trail).';
COMMENT ON COLUMN public.job_schedule_blocks.field_moved_from IS
  'Original {work_date,time_start,time_end} before the FIRST field move; set once.';

CREATE OR REPLACE FUNCTION public.search_jobs_for_self_schedule(p_query text)
RETURNS TABLE (
  id uuid,
  hcp_number text,
  click_number text,
  job_name text,
  job_address text,
  status text,
  customer_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.job_address, j.status, j.customer_name
  FROM public.jobs_ledger j
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND j.status IN ('waiting', 'working', 'ready_to_bill', 'billed')
    AND (
      COALESCE(trim(p_query), '') = ''
      OR j.hcp_number ILIKE '%' || trim(p_query) || '%'
      OR j.click_number ILIKE '%' || trim(p_query) || '%'
      OR j.job_name ILIKE '%' || trim(p_query) || '%'
      OR j.job_address ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(j.customer_name, '') ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY array_position(ARRAY['waiting','working','ready_to_bill','billed'], j.status),
           NULLIF(j.hcp_number, '') NULLS LAST,
           j.job_name
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_jobs_for_self_schedule(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.self_schedule_add_block(
  p_job_id uuid,
  p_work_date date,
  p_time_start time,
  p_time_end time,
  p_join_crew boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_block_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF p_time_end <= p_time_start THEN
    RAISE EXCEPTION 'end time must be after start time';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = p_job_id AND j.status IN ('waiting', 'working', 'ready_to_bill', 'billed')
  ) THEN
    RAISE EXCEPTION 'job not found or not schedulable';
  END IF;

  INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, created_by, work_date, time_start, time_end)
  VALUES (p_job_id, v_uid, v_uid, p_work_date, p_time_start, p_time_end)
  RETURNING id INTO v_block_id;

  IF p_join_crew THEN
    INSERT INTO public.jobs_ledger_team_members (job_id, user_id)
    SELECT p_job_id, v_uid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members t
      WHERE t.job_id = p_job_id AND t.user_id = v_uid
    );
  END IF;

  RETURN v_block_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_schedule_add_block(uuid, date, time, time, boolean) TO authenticated;

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

  -- The trail: dispatch-created moves post to the job thread.
  IF v_block.created_by IS DISTINCT FROM v_uid THEN
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

GRANT EXECUTE ON FUNCTION public.self_move_schedule_block(uuid, date, time, time) TO authenticated;

CREATE OR REPLACE FUNCTION public.self_remove_schedule_block(p_block_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  DELETE FROM public.job_schedule_blocks b
  WHERE b.id = p_block_id AND b.assignee_user_id = v_uid AND b.created_by = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'block not found, not yours, or set by dispatch (dispatch visits can be moved, not removed)';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_remove_schedule_block(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_field_job(
  p_job_name text,
  p_job_address text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_gc_name text,
  p_line_items text[],
  p_work_date date,
  p_time_start time,
  p_time_end time
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_master uuid;
  v_job_id uuid;
  v_item text;
  v_seq int := 0;
  v_label text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF COALESCE(trim(p_job_name), '') = '' THEN
    RAISE EXCEPTION 'job name is required';
  END IF;
  IF p_time_end <= p_time_start THEN
    RAISE EXCEPTION 'end time must be after start time';
  END IF;

  -- Field-created jobs default to the company's earliest master; the office
  -- reassigns on review if needed (flagged in the dispatch request).
  SELECT u.id INTO v_master
  FROM public.users u
  WHERE u.role = 'master_technician' AND u.archived_at IS NULL
  ORDER BY u.created_at
  LIMIT 1;
  IF v_master IS NULL THEN
    RAISE EXCEPTION 'no active master technician to own the job';
  END IF;

  INSERT INTO public.jobs_ledger (job_name, job_address, status, master_user_id, customer_name, customer_phone, customer_email)
  VALUES (
    trim(p_job_name),
    COALESCE(trim(p_job_address), ''),
    'waiting',
    v_master,
    NULLIF(trim(p_customer_name), ''),
    NULLIF(trim(p_customer_phone), ''),
    NULLIF(trim(p_customer_email), '')
  )
  RETURNING id INTO v_job_id;

  FOREACH v_item IN ARRAY COALESCE(p_line_items, ARRAY[]::text[]) LOOP
    IF COALESCE(trim(v_item), '') <> '' THEN
      v_seq := v_seq + 1;
      INSERT INTO public.jobs_ledger_fixtures (job_id, name, sequence_order)
      VALUES (v_job_id, trim(v_item), v_seq);
    END IF;
  END LOOP;

  INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES (v_job_id, v_uid);

  INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, created_by, work_date, time_start, time_end)
  VALUES (v_job_id, v_uid, v_uid, p_work_date, p_time_start, p_time_end);

  INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
  VALUES (v_job_id, v_uid, 'Requested this job from the field and scheduled a visit for ' || p_work_date || '.');

  v_label := trim(p_job_name) || CASE WHEN COALESCE(trim(p_customer_name), '') <> '' THEN ' — ' || trim(p_customer_name) ELSE '' END;
  INSERT INTO public.dispatch_requests (from_user_id, title, job_ledger_id, pending_action, reference_summary)
  VALUES (
    v_uid,
    'Review field-requested job: ' || v_label,
    v_job_id,
    'review_field_job',
    concat_ws(' · ',
      NULLIF(trim(p_customer_name), ''),
      NULLIF(trim(p_customer_phone), ''),
      NULLIF(trim(p_customer_email), ''),
      CASE WHEN COALESCE(trim(p_gc_name), '') <> '' THEN 'GC: ' || trim(p_gc_name) END,
      'Owner defaulted to earliest master — reassign if needed'
    )
  );

  RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_field_job(text, text, text, text, text, text, text[], date, time, time) TO authenticated;
