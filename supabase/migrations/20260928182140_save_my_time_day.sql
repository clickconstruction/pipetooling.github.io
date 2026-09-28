SET lock_timeout = '3s';

-- save_my_time_day: the My Time day editor's Save as one transaction.
--
-- The editor works out every write for the day in the browser (lib/myTimeDayPersist.ts) and used
-- to send them one request at a time: a refusal part-way left the rows before it rewritten and the
-- rest unsent (the MY_TIME_DAY_EDITOR_MODAL map, quirk 26). This function takes the whole list and
-- applies it in order inside the one transaction PostgREST opens for the call — any error rolls
-- every write back.
--
-- Behaviour-preserving on purpose:
--   * SECURITY INVOKER: the direct INSERT / UPDATEs run under the caller's own RLS on
--     clock_sessions, exactly as the browser's requests did.
--   * The split / replace writes call the existing own_* or leader_* RPCs unchanged (they keep
--     their own permission checks, week fences and people_hours bookkeeping). An error_message
--     from one of them is raised, so it rolls back everything written before it.
--   * After an in-place UPDATE of an approved row's times, people_hours is resynced once for the
--     day with recompute_people_hours_after_session_edit — what the browser does since v2.4061.
--
-- p_writes is a JSON array; each element has "op" and:
--   insert        clocked_in_at, clocked_out_at, notes, job_ledger_id, bid_id
--                 (user_id = p_subject_user_id, work_date = p_work_date)
--   update_notes  id, notes
--   update_times  id, clocked_in_at, clocked_out_at, notes, and optionally work_date,
--                 job_ledger_id, bid_id (written only when present)
--   split_segments id, segments        split_cluster / replace_mixed  ids, segments
-- p_leader picks leader_* (true) or own_* (false) for the three RPC writes.

CREATE OR REPLACE FUNCTION public.save_my_time_day(
  p_subject_user_id uuid,
  p_work_date date,
  p_leader boolean,
  p_writes jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_n int;
  v_i int;
  v_w jsonb;
  v_op text;
  v_id uuid;
  v_ids uuid[];
  v_row public.clock_sessions%ROWTYPE;
  v_err text;
  v_count int;
  v_approved_times_changed uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_subject_user_id IS NULL OR p_work_date IS NULL OR p_leader IS NULL THEN
    RAISE EXCEPTION 'save_my_time_day: person, day and RPC family are required';
  END IF;
  IF p_writes IS NULL OR jsonb_typeof(p_writes) <> 'array' THEN
    RAISE EXCEPTION 'save_my_time_day: expected an array of writes';
  END IF;

  v_n := jsonb_array_length(p_writes);
  FOR v_i IN 0 .. v_n - 1 LOOP
    v_w := p_writes -> v_i;
    v_op := v_w ->> 'op';

    IF v_op = 'insert' THEN
      INSERT INTO public.clock_sessions (
        user_id, work_date, clocked_in_at, clocked_out_at, notes, job_ledger_id, bid_id
      ) VALUES (
        p_subject_user_id,
        p_work_date,
        (v_w ->> 'clocked_in_at')::timestamptz,
        (v_w ->> 'clocked_out_at')::timestamptz,
        v_w ->> 'notes',
        NULLIF(v_w ->> 'job_ledger_id', '')::uuid,
        NULLIF(v_w ->> 'bid_id', '')::uuid
      );

    ELSIF v_op IN ('update_notes', 'update_times') THEN
      v_id := (v_w ->> 'id')::uuid;
      SELECT * INTO v_row FROM public.clock_sessions WHERE id = v_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Clock session % was not found', v_id;
      END IF;
      IF v_row.user_id IS DISTINCT FROM p_subject_user_id THEN
        RAISE EXCEPTION 'Clock session % belongs to someone else', v_id;
      END IF;

      IF v_op = 'update_notes' THEN
        UPDATE public.clock_sessions SET notes = v_w ->> 'notes' WHERE id = v_id;
      ELSE
        UPDATE public.clock_sessions SET
          clocked_in_at = (v_w ->> 'clocked_in_at')::timestamptz,
          clocked_out_at = (v_w ->> 'clocked_out_at')::timestamptz,
          notes = v_w ->> 'notes',
          work_date = CASE WHEN v_w ? 'work_date' THEN (v_w ->> 'work_date')::date ELSE work_date END,
          job_ledger_id = CASE WHEN v_w ? 'job_ledger_id' THEN NULLIF(v_w ->> 'job_ledger_id', '')::uuid ELSE job_ledger_id END,
          bid_id = CASE WHEN v_w ? 'bid_id' THEN NULLIF(v_w ->> 'bid_id', '')::uuid ELSE bid_id END
        WHERE id = v_id;
        IF v_row.approved_at IS NOT NULL THEN
          v_approved_times_changed := v_id;
        END IF;
      END IF;
      -- RLS hides a row the caller may not change: the UPDATE matches nothing instead of failing.
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count <> 1 THEN
        RAISE EXCEPTION 'Clock session % could not be updated', v_id;
      END IF;

    ELSIF v_op = 'split_segments' THEN
      v_id := (v_w ->> 'id')::uuid;
      IF p_leader THEN
        SELECT r.error_message INTO v_err FROM public.leader_split_clock_session_segments(v_id, v_w -> 'segments') r;
      ELSE
        SELECT r.error_message INTO v_err FROM public.split_own_clock_session_segments(v_id, v_w -> 'segments') r;
      END IF;
      IF v_err IS NOT NULL THEN
        RAISE EXCEPTION '%', v_err;
      END IF;

    ELSIF v_op IN ('split_cluster', 'replace_mixed') THEN
      v_ids := ARRAY(SELECT jsonb_array_elements_text(v_w -> 'ids')::uuid);
      IF v_op = 'split_cluster' THEN
        IF p_leader THEN
          SELECT r.error_message INTO v_err FROM public.leader_split_clock_session_cluster(v_ids, v_w -> 'segments') r;
        ELSE
          SELECT r.error_message INTO v_err FROM public.split_own_clock_session_cluster(v_ids, v_w -> 'segments') r;
        END IF;
      ELSE
        IF p_leader THEN
          SELECT r.error_message INTO v_err FROM public.leader_replace_clock_session_cluster_mixed(v_ids, v_w -> 'segments') r;
        ELSE
          SELECT r.error_message INTO v_err FROM public.replace_own_clock_session_cluster_mixed(v_ids, v_w -> 'segments') r;
        END IF;
      END IF;
      IF v_err IS NOT NULL THEN
        RAISE EXCEPTION '%', v_err;
      END IF;

    ELSE
      RAISE EXCEPTION 'save_my_time_day: unknown write "%"', v_op;
    END IF;
  END LOOP;

  IF v_approved_times_changed IS NOT NULL THEN
    PERFORM public.recompute_people_hours_after_session_edit(v_approved_times_changed);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.save_my_time_day(uuid, date, boolean, jsonb) IS
  'My Time day editor Save as one transaction: the day''s inserts, note / time updates (caller''s RLS) and own_* / leader_* split / replace RPCs in order; any error rolls all back. Resyncs people_hours once after an approved row''s times change. v2.4063.';

REVOKE ALL ON FUNCTION public.save_my_time_day(uuid, date, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_time_day(uuid, date, boolean, jsonb) TO authenticated;
