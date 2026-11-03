SET lock_timeout = '3s';

-- dev_clock_session_write (v2.6437, dev-mcp 0.16.0): the dev seat's door to clock sessions — the start and the
-- end, the description, the job, and the approval — with a dry run. The office edits a session in the app
-- (ClockSessionEditSplitModal, the Hours grid, the Person desk's queue) as rows under RLS; a dev's coding agent
-- (dev-mcp's plan_clock_sessions / apply_clock_sessions) had no door at all, since a dev-mcp POST reaches only
-- the dev-gated definer RPCs fixed in _shared/devMcpWrites.ts. This wrapper is a SECURITY DEFINER function
-- gated is_dev() inside that writes the same columns the modal writes, op by op, each op its own savepoint — a
-- refused op is reported with its reason and the rest go on (do what is ready, never all or nothing) — and with
-- p_dry_run = true (the default) performs every write and unwinds it, returning what would change. The table's
-- own triggers still run inside the definer: the typed-hours snapshot stamps a start or end the dev moved on a
-- punched session as hours the dev typed (the second look stays someone else's), the approval guard holds the
-- dev's own session and the hours the dev typed, the crew sync follows a moved session, the billing-only refusal
-- refuses a move onto a billing-only job, and the read-only (training) blocks fire as they do in the app.
--
-- Payload: { reason (words, required), ops: [ { op: 'times',   session_id, start, end }
--                                            | { op: 'note',    session_id, note }
--                                            | { op: 'move',    session_id, job_id }
--                                            | { op: 'approve', session_id } ] }, at most 50 ops.
-- Reply: { dry_run, reason, by, applied, held, refused, ops: [{ seq, op, session_id, person, outcome
--         (applied | held | refused), words, before, after }] } — before and after are the session's image
--         (dev_clock_session_image): work_date, clocked_in_at, clocked_out_at, hours, job { id, number, name },
--         bid_id, notes, origin, approved_at.
--
-- Two live RPCs are pasted whole below with one line added each (house rule: never rebuild an RPC body from a
-- repo baseline; paste it and change one thing): approve_clock_sessions (20261010022000_drop_team_leader_list.sql) and
-- recompute_people_hours_after_session_edit (20261010022000_drop_team_leader_list.sql) each let a dev through — their check
-- read has_payroll_access() OR is_assistant(), and has_payroll_access() is the controller or a pay-approved
-- master, never a dev — so the seat's approval and a moved start, end or job on an approved session reach
-- people_hours the way the office's do. The app's own doors are unchanged for everyone else.

-- 1. approve_clock_sessions: a dev may approve (one line added: OR public.is_dev()).
CREATE OR REPLACE FUNCTION public.approve_clock_sessions(p_session_ids uuid[])
 RETURNS TABLE(approved_count integer, error_message text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_approved int := 0;
  v_session RECORD;
  v_hours numeric;
  v_to_sync RECORD;
  v_pay boolean;
  v_person_id uuid;
BEGIN
  v_pay :=
    public.has_payroll_access()
    OR public.is_assistant()
    OR public.is_dev();

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name, cs.job_ledger_id, cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NULL
  LOOP
    IF NOT v_pay THEN
      RETURN QUERY SELECT 0, 'Access denied'::text;
      RETURN;
    END IF;

    -- Typed by the approver, or the approver's own hours: left for someone else (v2.4242).
    IF public.clock_session_approval_hold(v_session.id) IS NOT NULL THEN
      CONTINUE;
    END IF;

    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      RETURN QUERY SELECT 0, ('User has no name for session ' || v_session.id::text)::text;
      RETURN;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
    IF v_hours <= 0 THEN
      CONTINUE;
    END IF;

    v_person_id := public.resolve_pay_person_id_from_clock_user(v_session.user_id, v_session.person_name);

    INSERT INTO public.people_hours (person_name, work_date, hours, entered_by, person_id)
    VALUES (v_session.person_name, v_session.work_date, v_hours, auth.uid(), v_person_id)
    ON CONFLICT (person_name, work_date) DO UPDATE SET
      hours = public.people_hours.hours + EXCLUDED.hours,
      entered_by = EXCLUDED.entered_by,
      person_id = COALESCE(public.people_hours.person_id, EXCLUDED.person_id);

    UPDATE public.clock_sessions
    SET approved_at = NOW(), approved_by = auth.uid(),
        revoked_at = NULL, revoked_by = NULL
    WHERE id = v_session.id;

    v_approved := v_approved + 1;
  END LOOP;

  FOR v_to_sync IN
    SELECT DISTINCT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.job_ledger_id IS NOT NULL
      AND trim(u.name) IS NOT NULL
      AND trim(u.name) != ''
  LOOP
    PERFORM public.sync_crew_jobs_from_clock(v_to_sync.person_name, v_to_sync.work_date);
  END LOOP;

  FOR v_to_sync IN
    SELECT DISTINCT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.bid_id IS NOT NULL
      AND trim(u.name) IS NOT NULL
      AND trim(u.name) != ''
  LOOP
    PERFORM public.sync_crew_bids_from_clock(v_to_sync.person_name, v_to_sync.work_date);
  END LOOP;

  RETURN QUERY SELECT v_approved, NULL::text;
END;
$function$
;

-- 2. recompute_people_hours_after_session_edit: a dev may recompute (one line added: or public.is_dev()).
CREATE OR REPLACE FUNCTION public.recompute_people_hours_after_session_edit(p_session_id uuid, p_old_work_date date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_person_name text;
  v_person_id uuid;
  v_cur_work_date date;
  v_date date;
  v_sum numeric;
begin
  select cs.user_id, trim(u.name), cs.work_date
    into v_user_id, v_person_name, v_cur_work_date
  from public.clock_sessions cs
  join public.users u on u.id = cs.user_id
  where cs.id = p_session_id;

  if v_user_id is null or v_person_name is null or v_person_name = '' then
    return;
  end if;

  if not (
    public.has_payroll_access()
    or public.is_assistant()
    or public.is_dev()
    or auth.uid() = v_user_id
  ) then
    raise exception 'Access denied';
  end if;

  v_person_id := public.resolve_pay_person_id_from_clock_user(v_user_id, v_person_name);

  for v_date in
    select distinct d
    from (values (v_cur_work_date), (p_old_work_date)) as t(d)
    where d is not null
  loop
    select coalesce(sum(extract(epoch from (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0), 0)
      into v_sum
    from public.clock_sessions cs
    where cs.user_id = v_user_id
      and cs.work_date = v_date
      and cs.clocked_out_at is not null
      and cs.approved_at is not null
      and cs.revoked_at is null
      and cs.rejected_at is null;

    insert into public.people_hours (person_name, work_date, hours, entered_by, person_id)
    values (v_person_name, v_date, v_sum, auth.uid(), v_person_id)
    on conflict (person_name, work_date) do update set
      hours = excluded.hours,
      entered_by = excluded.entered_by,
      person_id = coalesce(public.people_hours.person_id, excluded.person_id);
  end loop;
end;
$function$
;

-- 3. The session's image, as the plan and the apply report it before and after. Invoker's rights: called by a
-- person it reads under their RLS; called from the definer below it reads as the definer.
CREATE OR REPLACE FUNCTION public.dev_clock_session_image(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'work_date', cs.work_date,
    'clocked_in_at', cs.clocked_in_at,
    'clocked_out_at', cs.clocked_out_at,
    'hours', CASE WHEN cs.clocked_out_at IS NULL THEN NULL
                  ELSE round((extract(epoch from (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0)::numeric, 2) END,
    'job', CASE WHEN j.id IS NULL THEN NULL ELSE jsonb_build_object('id', j.id, 'number', j.click_number, 'name', j.job_name) END,
    'bid_id', cs.bid_id,
    'notes', cs.notes,
    'origin', cs.origin,
    'approved_at', cs.approved_at)
  FROM public.clock_sessions cs
  LEFT JOIN public.jobs_ledger j ON j.id = cs.job_ledger_id
  WHERE cs.id = p_session_id
$$;

REVOKE ALL ON FUNCTION public.dev_clock_session_image(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dev_clock_session_image(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dev_clock_session_image(uuid) TO authenticated;

-- 4. The door.
CREATE OR REPLACE FUNCTION public.dev_clock_session_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_by text;
  v_reason text;
  v_ops jsonb;
  v_op jsonb;
  v_seq int := 0;
  v_kind text;
  v_sid uuid;
  v_row public.clock_sessions%ROWTYPE;
  v_person text;
  v_before jsonb;
  v_after jsonb;
  v_words text;
  v_outcome text;
  v_old_date date;
  v_start timestamptz;
  v_end timestamptz;
  v_note text;
  v_job uuid;
  v_job_name text;
  v_appr record;
  v_results jsonb := '[]'::jsonb;
  v_applied int := 0;
  v_held int := 0;
  v_refused int := 0;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_clock_session_write: devs only' USING ERRCODE = '42501';
  END IF;

  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_by := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF v_by IS NULL THEN
    RAISE EXCEPTION 'dev_clock_session_write: no users row for the caller';
  END IF;

  v_reason := btrim(COALESCE(p->>'reason', ''));
  IF v_reason = '' THEN
    RAISE EXCEPTION 'dev_clock_session_write: reason is required, in words — it is kept in the call log and read by the next person';
  END IF;
  v_ops := p->'ops';
  IF v_ops IS NULL OR jsonb_typeof(v_ops) <> 'array' OR jsonb_array_length(v_ops) = 0 THEN
    RAISE EXCEPTION 'dev_clock_session_write: ops is required, an array of at least one op';
  END IF;
  IF jsonb_array_length(v_ops) > 50 THEN
    RAISE EXCEPTION 'dev_clock_session_write: at most 50 ops a call';
  END IF;

  BEGIN
    FOR v_op IN SELECT value FROM jsonb_array_elements(v_ops) LOOP
      v_seq := v_seq + 1;
      v_kind := lower(btrim(COALESCE(v_op->>'op', '')));
      v_sid := NULL; v_before := NULL; v_after := NULL; v_words := NULL; v_person := NULL; v_outcome := 'applied';
      BEGIN
        -- Each op is its own savepoint: a refusal here is reported and the next op runs.
        BEGIN
          v_sid := NULLIF(btrim(COALESCE(v_op->>'session_id', '')), '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'session_id is not a uuid';
        END;
        IF v_sid IS NULL THEN
          RAISE EXCEPTION 'session_id is required';
        END IF;
        SELECT * INTO v_row FROM public.clock_sessions WHERE id = v_sid FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'session % not found', v_sid;
        END IF;
        IF v_row.revoked_at IS NOT NULL THEN
          RAISE EXCEPTION 'the session is revoked';
        END IF;
        IF v_row.rejected_at IS NOT NULL THEN
          RAISE EXCEPTION 'the session is rejected';
        END IF;
        SELECT trim(u.name) INTO v_person FROM public.users u WHERE u.id = v_row.user_id;
        v_before := public.dev_clock_session_image(v_sid);
        v_old_date := v_row.work_date;

        CASE v_kind
          WHEN 'times' THEN
            v_start := NULLIF(btrim(COALESCE(v_op->>'start', '')), '')::timestamptz;
            v_end := NULLIF(btrim(COALESCE(v_op->>'end', '')), '')::timestamptz;
            IF v_start IS NULL OR v_end IS NULL THEN
              RAISE EXCEPTION 'times needs start and end, each an ISO timestamp with its offset';
            END IF;
            IF v_end <= v_start THEN
              RAISE EXCEPTION 'end must be after start';
            END IF;
            IF v_end - v_start > interval '24 hours' THEN
              RAISE EXCEPTION 'a session is at most 24 hours';
            END IF;
            UPDATE public.clock_sessions
               SET clocked_in_at = v_start,
                   clocked_out_at = v_end,
                   work_date = (v_start AT TIME ZONE 'America/Chicago')::date
             WHERE id = v_sid;
            v_words := 'start and end set';
          WHEN 'note' THEN
            IF NOT (v_op ? 'note') OR jsonb_typeof(v_op->'note') <> 'string' THEN
              RAISE EXCEPTION 'note needs note, the words (an empty string clears it)';
            END IF;
            v_note := btrim(v_op->>'note');
            IF length(v_note) > 2000 THEN
              RAISE EXCEPTION 'note is at most 2,000 characters';
            END IF;
            UPDATE public.clock_sessions SET notes = v_note WHERE id = v_sid;
            v_words := CASE WHEN v_note = '' THEN 'note cleared' ELSE 'note set' END;
          WHEN 'move' THEN
            BEGIN
              v_job := NULLIF(btrim(COALESCE(v_op->>'job_id', '')), '')::uuid;
            EXCEPTION WHEN OTHERS THEN
              RAISE EXCEPTION 'job_id is not a uuid';
            END;
            IF v_job IS NULL THEN
              RAISE EXCEPTION 'move needs job_id, a jobs_ledger.id (find_job)';
            END IF;
            SELECT j.job_name INTO v_job_name FROM public.jobs_ledger j WHERE j.id = v_job;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'job % not found', v_job;
            END IF;
            IF v_row.job_ledger_id = v_job THEN
              RAISE EXCEPTION 'the session is already on that job';
            END IF;
            UPDATE public.clock_sessions SET job_ledger_id = v_job, bid_id = NULL WHERE id = v_sid;
            v_words := 'moved to ' || COALESCE(v_job_name, v_job::text);
          WHEN 'approve' THEN
            IF v_row.approved_at IS NOT NULL THEN
              RAISE EXCEPTION 'the session is already approved';
            END IF;
            IF v_row.clocked_out_at IS NULL THEN
              RAISE EXCEPTION 'the session is still open: it has no end';
            END IF;
            SELECT * INTO v_appr FROM public.approve_clock_sessions_v2(ARRAY[v_sid]);
            IF COALESCE(v_appr.approved_count, 0) = 0 THEN
              v_outcome := 'held';
              v_words := CASE
                WHEN COALESCE(v_appr.held_own, 0) > 0 THEN 'held: your own session waits for someone else''s approval'
                WHEN COALESCE(v_appr.held_typed, 0) > 0 THEN 'held: hours you typed wait for a second look by someone else'
                ELSE 'held: ' || COALESCE(v_appr.error_message, 'not approved')
              END;
            ELSE
              v_words := 'approved';
            END IF;
          ELSE
            RAISE EXCEPTION 'unknown op "%": times, note, move or approve', v_kind;
        END CASE;

        SELECT * INTO v_row FROM public.clock_sessions WHERE id = v_sid;
        v_after := public.dev_clock_session_image(v_sid);
        IF (v_kind IN ('times', 'move') OR (v_kind = 'approve' AND v_outcome = 'applied')) AND v_row.approved_at IS NOT NULL THEN
          PERFORM public.recompute_people_hours_after_session_edit(v_sid, v_old_date);
        END IF;
        IF v_outcome = 'held' THEN
          v_held := v_held + 1;
        ELSE
          v_applied := v_applied + 1;
        END IF;
        v_results := v_results || jsonb_build_object(
          'seq', v_seq, 'op', v_kind, 'session_id', v_sid, 'person', v_person,
          'outcome', v_outcome, 'words', v_words, 'before', v_before, 'after', v_after);
      EXCEPTION WHEN OTHERS THEN
        v_refused := v_refused + 1;
        v_results := v_results || jsonb_build_object(
          'seq', v_seq, 'op', v_kind, 'session_id', v_op->>'session_id', 'person', v_person,
          'outcome', 'refused', 'words', SQLERRM, 'before', v_before, 'after', NULL);
      END;
    END LOOP;

    v_out := jsonb_build_object(
      'dry_run', p_dry_run, 'reason', v_reason, 'by', v_by,
      'applied', v_applied, 'held', v_held, 'refused', v_refused, 'ops', v_results);
    IF p_dry_run THEN
      -- unwind every write above; v_out survives the exception
      RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';
    END IF;
    RETURN v_out;
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      RETURN v_out;
  END;
END
$fn$;

COMMENT ON FUNCTION public.dev_clock_session_write(jsonb, boolean) IS
  'dev-mcp (v2.6437): a signed-in dev adjusts clock sessions — the start and the end, the description, the job, the approval — op by op, each op applied, held or refused with its reason; p_dry_run = true (default) performs and unwinds every write, returning what would change.';

REVOKE ALL ON FUNCTION public.dev_clock_session_write(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dev_clock_session_write(jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.dev_clock_session_write(jsonb, boolean) TO authenticated;
