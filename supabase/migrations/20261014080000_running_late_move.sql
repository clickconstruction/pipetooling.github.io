SET lock_timeout = '3s';

-- Messages, residential R8 · 3 PR 2 (v2.5431): dispatch writes back. A tech's Running late text gives the customer a
-- new window, and Move it slides the tech's day on the dispatch board with the reason, in one call.
--
-- 1. self_move_schedule_block: the newest body (20260813224521) with one skip. Its thread note for a block someone
--    else made is left off for the block running_late_move names in the transaction-local app.running_late_block, so
--    the late job reads one line (the event) and not two. A slid block keeps its note.
-- 2. running_late_move(p_moves, p_reason, p_job_line, p_note_title, p_note_summary): the kernel's moves
--    (scheduleDispatch/whatSlides.ts → boardWrite), the last stop first and the late block last. Each row goes
--    through self_move_schedule_block, so the move's rules keep one home: the tech's own block, the end after the
--    start, out of a crew block. One transaction: a refusal anywhere moves nothing, and so does a window past 8:00 PM
--    (the board's day end, job_schedule_blocks_time_bounds, refused here in words before the CHECK) or on another day. Then one job_activity_events row of type running_late on the late block's job (the reason's
--    home: summary is the kernel's job line, detail the block, from, to, reason and the slid blocks), and one
--    dispatch_requests row from the tech with pending_action running_late (no button in the inbox; the title and
--    summary are the dispatcher's note). Returns that row's id: the client calls notify-dispatch-request with it, as
--    Quick Estimate does, which pushes the dispatch group. A bid's block moves with the note and no job line.
--
-- dispatch_requests.pending_action has no CHECK (baseline), so running_late needs no widening. Any signed-in user
-- may insert a dispatch_requests row as themselves (dispatch_requests_insert); the row is written here so the move
-- and the note are one write. No table: the fences are untouched, and training mode's statement trigger on
-- job_schedule_blocks, job_activity_events and dispatch_requests refuses the call inside this definer function.

-- ---------------------------------------------------------------------------
-- 1. self_move_schedule_block: the newest body, the note skipped for the late block.
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
  -- Running late (v2.5431): running_late_move writes the late block's job
  -- line itself, so the note is left off for the block it names.
  IF v_block.created_by IS DISTINCT FROM v_uid AND v_block.job_id IS NOT NULL
     AND COALESCE(current_setting('app.running_late_block', true), '') IS DISTINCT FROM p_block_id::text THEN
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

-- ---------------------------------------------------------------------------
-- 2. running_late_move: the slide, the job's line and the dispatcher's note in one call.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.running_late_move(
  p_moves jsonb,
  p_reason text,
  p_job_line text,
  p_note_title text,
  p_note_summary text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_count int;
  v_late jsonb;
  v_late_id uuid;
  v_block public.job_schedule_blocks%ROWTYPE;
  v_move jsonb;
  v_row public.job_schedule_blocks%ROWTYPE;
  v_slid uuid[] := ARRAY[]::uuid[];
  v_request_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF jsonb_typeof(p_moves) IS DISTINCT FROM 'array' OR jsonb_array_length(p_moves) = 0 THEN
    RAISE EXCEPTION 'nothing to move';
  END IF;
  IF COALESCE(trim(p_reason), '') = '' OR COALESCE(trim(p_job_line), '') = '' OR COALESCE(trim(p_note_title), '') = '' THEN
    RAISE EXCEPTION 'a running late move needs its reason, its job line and its note';
  END IF;

  v_count := jsonb_array_length(p_moves);
  IF (SELECT count(DISTINCT m ->> 'p_block_id') FROM jsonb_array_elements(p_moves) m) <> v_count THEN
    RAISE EXCEPTION 'a block moves once';
  END IF;

  -- The late block is the last row: the kernel moves the last stop first.
  v_late := p_moves -> (v_count - 1);
  v_late_id := (v_late ->> 'p_block_id')::uuid;
  SELECT * INTO v_block
  FROM public.job_schedule_blocks b
  WHERE b.id = v_late_id AND b.assignee_user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'block not found or not yours';
  END IF;
  IF v_block.time_start = (v_late ->> 'p_time_start')::time AND v_block.time_end = (v_late ->> 'p_time_end')::time THEN
    RAISE EXCEPTION 'the late block keeps its window';
  END IF;

  -- One day, the late block's, and nothing past 8:00 PM, the board's day end (job_schedule_blocks_time_bounds).
  FOR v_move IN SELECT m FROM jsonb_array_elements(p_moves) m LOOP
    SELECT * INTO v_row FROM public.job_schedule_blocks b WHERE b.id = (v_move ->> 'p_block_id')::uuid;
    IF NOT FOUND OR v_row.assignee_user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'block not found or not yours';
    END IF;
    IF (v_move ->> 'p_work_date')::date IS DISTINCT FROM v_block.work_date OR v_row.work_date IS DISTINCT FROM v_block.work_date THEN
      RAISE EXCEPTION 'a running late move stays on its day';
    END IF;
    IF (v_move ->> 'p_time_end')::time > time '20:00' THEN
      RAISE EXCEPTION 'that would run the day past 8:00 PM';
    END IF;
  END LOOP;

  -- The moves, each through self_move_schedule_block, the late block's own note left off.
  PERFORM set_config('app.running_late_block', v_late_id::text, true);
  FOR v_move IN SELECT m FROM jsonb_array_elements(p_moves) m LOOP
    PERFORM public.self_move_schedule_block(
      (v_move ->> 'p_block_id')::uuid,
      (v_move ->> 'p_work_date')::date,
      (v_move ->> 'p_time_start')::time,
      (v_move ->> 'p_time_end')::time
    );
    IF (v_move ->> 'p_block_id')::uuid <> v_late_id THEN
      v_slid := v_slid || (v_move ->> 'p_block_id')::uuid;
    END IF;
  END LOOP;
  PERFORM set_config('app.running_late_block', '', true);

  -- The reason's home: one line on the late block's job. A bid's block has no job activity.
  IF v_block.job_id IS NOT NULL THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (
      v_block.job_id,
      'running_late',
      now(),
      v_uid,
      left(trim(p_job_line), 500),
      jsonb_build_object(
        'block_id', v_block.id,
        'from', jsonb_build_object('work_date', v_block.work_date, 'time_start', v_block.time_start, 'time_end', v_block.time_end),
        'to', jsonb_build_object('work_date', v_block.work_date, 'time_start', (v_late ->> 'p_time_start')::time, 'time_end', (v_late ->> 'p_time_end')::time),
        'reason', trim(p_reason),
        'slid_block_ids', to_jsonb(v_slid)
      ),
      false
    );
  END IF;

  -- The dispatcher's note, from the tech; the client pushes it with notify-dispatch-request.
  INSERT INTO public.dispatch_requests (from_user_id, title, job_ledger_id, bid_id, pending_action, reference_summary)
  VALUES (v_uid, left(trim(p_note_title), 2000), v_block.job_id, v_block.bid_id, 'running_late', NULLIF(trim(p_note_summary), ''))
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.running_late_move(jsonb, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.running_late_move(jsonb, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.running_late_move(jsonb, text, text, text, text) IS
  'Running late (v2.5431, residential R8 · 3): the tech''s own blocks on one day slide through self_move_schedule_block in one transaction, the late block last; one running_late job_activity_events row on its job carries the reason; one dispatch_requests row (pending_action running_late) is the dispatcher''s note, its id returned for notify-dispatch-request. A window past 8:00 PM or on another day moves nothing.';
