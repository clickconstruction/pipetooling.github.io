SET lock_timeout = '3s';

-- Team leads: drop the frozen list (punch list #26, the Supervision train's residual).
--
-- Supervision (v2.3611–v2.3616) replaced leader → member links with users.needs_supervision and
-- reads who supervised whom off the schedule and the clock. Since v2.3616 nothing writes
-- team_leader_assignments or team_leader_clock_notify_prefs; read on prod 2026-10-08: 16 links,
-- the newest created 2026-08-13 and none written since (row versions older than every clock
-- session of 2026-09-17), 0 notify prefs, 0 report-email lead rows, no digest on "My team".
-- The links still opened doors through is_team_lead_for_member / is_team_lead_for_person_name.
-- This removes every such door, then the list:
--   1. twelve functions, each prod's live body less its team-lead check — pay access, the
--      office, devs and the person themselves keep theirs;
--   2. nineteen policies on ten tables lose the team-lead branch (ALTER POLICY keeps name, command
--      and roles); the two policies that were only that branch are dropped;
--   3. the two helpers and list_report_email_team_leads() go;
--   4. the digest's crew filter keeps 'all_users' only ('my_team' read the list);
--   5. last, the tables: report_email_subscription_team_leads (the report-email lead scope),
--      team_leader_clock_notify_prefs (its policies read the next one), team_leader_assignments,
--      its dev-only trigger function, and can_manage_team_leader_assignments(), which only
--      their own policies called.
--
-- Push in a quiet window, after the client and the edge functions that stop reading these are
-- live (the old ones degrade to "no leads" but log errors). ALTER/DROP POLICY takes ACCESS
-- EXCLUSIVE on clock_sessions, people_hours, jobs_ledger and the other seven tables, and the
-- drops lock public.users and report_email_subscriptions while their foreign-key triggers go;
-- all are held to commit, which is why the drops come last. With lock_timeout a busy moment
-- fails the push harmlessly: retry later.

-- 1. The functions, each its live body less the team-lead check (grants are kept by CREATE OR REPLACE).

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
    OR public.is_assistant();

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

CREATE OR REPLACE FUNCTION public.revoke_clock_sessions(p_session_ids uuid[])
 RETURNS TABLE(revoked_count integer, error_message text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_revoked int := 0;
  v_session RECORD;
  v_hours numeric;
  v_new_hours numeric;
  v_pay boolean;
  v_person_id uuid;
BEGIN
  v_pay :=
    public.has_payroll_access()
    OR public.is_assistant()
    OR public.is_assistant();

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name, cs.job_ledger_id, cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
  LOOP
    IF NOT v_pay THEN
      RETURN QUERY SELECT 0, 'Access denied'::text;
      RETURN;
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

    UPDATE public.people_hours
    SET hours = hours - v_hours,
        entered_by = auth.uid()
    WHERE work_date = v_session.work_date
      AND (
        (v_person_id IS NOT NULL AND person_id = v_person_id)
        OR (v_person_id IS NULL AND person_name = v_session.person_name)
      )
    RETURNING hours INTO v_new_hours;

    IF FOUND THEN
      IF v_new_hours <= 0 THEN
        DELETE FROM public.people_hours
        WHERE work_date = v_session.work_date
          AND (
            (v_person_id IS NOT NULL AND person_id = v_person_id)
            OR (v_person_id IS NULL AND person_name = v_session.person_name)
          );
      END IF;
    END IF;

    UPDATE public.clock_sessions
    SET approved_at = NULL, approved_by = NULL,
        revoked_at = NOW(), revoked_by = auth.uid()
    WHERE id = v_session.id;

    v_revoked := v_revoked + 1;

    IF v_session.job_ledger_id IS NOT NULL THEN
      PERFORM public.sync_crew_jobs_from_clock(v_session.person_name, v_session.work_date);
    END IF;
    IF v_session.bid_id IS NOT NULL THEN
      PERFORM public.sync_crew_bids_from_clock(v_session.person_name, v_session.work_date);
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_revoked, NULL::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_rejected_clock_sessions(p_session_ids uuid[])
 RETURNS TABLE(restored_count integer, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restored int := 0;
  v_session RECORD;
  v_pay boolean;
  v_dev boolean;
  v_hours numeric;
  v_new_hours numeric;
BEGIN
  v_pay := public.has_payroll_access()
    OR public.is_assistant()
    OR public.is_assistant();
  v_dev := public.is_dev();

  FOR v_session IN
    SELECT
      cs.id,
      cs.user_id,
      cs.clocked_in_at,
      cs.clocked_out_at,
      cs.work_date,
      trim(u.name) AS person_name,
      cs.approved_at,
      cs.job_ledger_id,
      cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.rejected_at IS NOT NULL
  LOOP
    IF NOT v_pay AND NOT v_dev THEN
      RETURN QUERY SELECT 0, 'Access denied'::text;
      RETURN;
    END IF;

    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      RETURN QUERY SELECT 0, ('User has no name for session ' || v_session.id::text)::text;
      RETURN;
    END IF;

    IF v_session.approved_at IS NOT NULL THEN
      v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
      IF v_hours > 0 THEN
        UPDATE public.people_hours
        SET hours = hours - v_hours,
            entered_by = auth.uid()
        WHERE person_name = v_session.person_name
          AND work_date = v_session.work_date
        RETURNING hours INTO v_new_hours;

        IF FOUND THEN
          IF v_new_hours <= 0 THEN
            DELETE FROM public.people_hours
            WHERE person_name = v_session.person_name
              AND work_date = v_session.work_date;
          END IF;
        END IF;
      END IF;

      UPDATE public.clock_sessions
      SET approved_at = NULL, approved_by = NULL
      WHERE id = v_session.id;

      IF v_session.job_ledger_id IS NOT NULL THEN
        PERFORM public.sync_crew_jobs_from_clock(v_session.person_name, v_session.work_date);
      END IF;
      IF v_session.bid_id IS NOT NULL THEN
        PERFORM public.sync_crew_bids_from_clock(v_session.person_name, v_session.work_date);
      END IF;
    END IF;

    UPDATE public.clock_sessions
    SET rejected_at = NULL, rejected_by = NULL
    WHERE id = v_session.id;

    v_restored := v_restored + 1;
  END LOOP;

  RETURN QUERY SELECT v_restored, NULL::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_ncns_and_reject_sessions_for_day(p_subject_user_id uuid, p_work_date date, p_details text DEFAULT NULL::text)
 RETURNS TABLE(rejected_count integer, had_approved_sessions boolean, error_message text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pay boolean;
  v_count int;
  v_had_approved boolean;
  v_has_open boolean;
  v_bad_name boolean;
  v_rejected int := 0;
  v_session RECORD;
  v_hours numeric;
BEGIN
  v_pay :=
    public.has_payroll_access()
    OR public.is_assistant()
    OR public.is_assistant();

  IF NOT v_pay THEN
    RETURN QUERY SELECT 0, false, 'Access denied'::text;
    RETURN;
  END IF;

  SELECT
    COUNT(*)::int,
    COALESCE(BOOL_OR(cs.approved_at IS NOT NULL), false),
    COALESCE(BOOL_OR(cs.clocked_out_at IS NULL), false),
    COALESCE(
      BOOL_OR(
        trim(u.name) IS NULL
        OR trim(u.name) = ''
      ),
      false
    )
  INTO v_count, v_had_approved, v_has_open, v_bad_name
  FROM public.clock_sessions cs
  INNER JOIN public.users u ON u.id = cs.user_id
  WHERE cs.user_id = p_subject_user_id
    AND cs.work_date = p_work_date
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL;

  IF v_count IS NULL OR v_count = 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.job_schedule_blocks jsb
      WHERE jsb.assignee_user_id = p_subject_user_id
        AND jsb.work_date = p_work_date
      LIMIT 1
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM public.attendance_incidents ai
        WHERE ai.subject_user_id = p_subject_user_id
          AND ai.work_date = p_work_date
          AND ai.incident_type = 'no_call_no_show'
        LIMIT 1
      ) THEN
        RETURN QUERY SELECT 0, false, 'NCNS already recorded for this day'::text;
        RETURN;
      END IF;

      INSERT INTO public.attendance_incidents (
        subject_user_id,
        work_date,
        created_by_user_id,
        metadata,
        details
      )
      VALUES (
        p_subject_user_id,
        p_work_date,
        auth.uid(),
        jsonb_build_object(
          'had_approved_sessions', false,
          'source', 'my_time_day_editor',
          'scheduled_without_clock', true,
          'rejected_session_count', 0
        ),
        NULLIF(TRIM(p_details), '')
      );

      RETURN QUERY SELECT 0, false, NULL::text;
      RETURN;
    END IF;

    RETURN QUERY SELECT 0, COALESCE(v_had_approved, false), 'No sessions or schedule for this day'::text;
    RETURN;
  END IF;

  IF v_bad_name THEN
    RETURN QUERY SELECT 0, v_had_approved, 'User has no name for one or more sessions'::text;
    RETURN;
  END IF;

  IF v_has_open THEN
    RETURN QUERY SELECT 0, v_had_approved, 'Clock out all sessions before recording NCNS'::text;
    RETURN;
  END IF;

  FOR v_session IN
    SELECT
      cs.id,
      cs.user_id,
      cs.clocked_in_at,
      cs.clocked_out_at,
      cs.work_date,
      cs.approved_at,
      trim(u.name) AS person_name,
      cs.job_ledger_id,
      cs.bid_id
    FROM public.clock_sessions cs
    INNER JOIN public.users u ON u.id = cs.user_id
    WHERE cs.user_id = p_subject_user_id
      AND cs.work_date = p_work_date
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
    ORDER BY cs.clocked_in_at ASC, cs.id ASC
  LOOP
    v_hours :=
      EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;

    IF v_session.approved_at IS NOT NULL AND v_hours > 0 THEN
      PERFORM public.people_hours_subtract_approved_hours(
        v_session.user_id,
        v_session.person_name,
        v_session.work_date,
        v_hours,
        auth.uid()
      );
    END IF;

    UPDATE public.clock_sessions
    SET
      approved_at = NULL,
      approved_by = NULL,
      revoked_at = NULL,
      revoked_by = NULL,
      rejected_at = NOW(),
      rejected_by = auth.uid()
    WHERE id = v_session.id;

    v_rejected := v_rejected + 1;

    IF v_session.job_ledger_id IS NOT NULL THEN
      PERFORM public.sync_crew_jobs_from_clock(v_session.person_name, v_session.work_date);
    END IF;
    IF v_session.bid_id IS NOT NULL THEN
      PERFORM public.sync_crew_bids_from_clock(v_session.person_name, v_session.work_date);
    END IF;
  END LOOP;

  INSERT INTO public.attendance_incidents (
    subject_user_id,
    work_date,
    created_by_user_id,
    metadata,
    details
  )
  VALUES (
    p_subject_user_id,
    p_work_date,
    auth.uid(),
    jsonb_build_object(
      'had_approved_sessions', v_had_approved,
      'source', 'my_time_day_editor'
    ),
    NULLIF(TRIM(p_details), '')
  );

  RETURN QUERY SELECT v_rejected, v_had_approved, NULL::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_edit_clock_sessions_for_user(p_target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p_target_user_id IS NOT NULL
    AND (
      p_target_user_id = auth.uid()
      OR public.has_payroll_access()
      OR public.is_assistant()
    );
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_clock_typed_entry(p_entry_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_entry public.clock_typed_entries%ROWTYPE;
  v_name text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN 'Not signed in.';
  END IF;
  SELECT * INTO v_entry FROM public.clock_typed_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RETURN 'That entry is gone.';
  END IF;
  IF NOT (public.is_dev() OR public.has_payroll_access() OR public.is_assistant()) THEN
    RETURN 'Only someone who approves hours can do this.';
  END IF;
  IF v_entry.kind <> 'added' THEN
    RETURN 'Only added hours need a second look.';
  END IF;
  IF v_entry.confirmed_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  IF v_entry.typed_by = v_actor THEN
    RETURN 'You typed these hours, so someone else has to look at them.';
  END IF;
  IF v_entry.user_id = v_actor THEN
    RETURN 'These are your own hours. Someone else has to look at them.';
  END IF;

  SELECT NULLIF(trim(u.name), '') INTO v_name FROM public.users u WHERE u.id = v_actor;
  v_name := COALESCE(v_name, 'Someone');
  UPDATE public.clock_typed_entries
  SET confirmed_by = v_actor, confirmed_by_name = v_name, confirmed_at = now()
  WHERE id = p_entry_id AND confirmed_at IS NULL;
  RETURN NULL;
END;
$function$
;

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
    or public.is_assistant()
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

CREATE OR REPLACE FUNCTION public.pay_staff_clear_salary_schedule_by_person_name(p_person_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_today date;
  v_caller_is_superintendent boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authenticated',
      'message', 'Not signed in.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superintendent'
  ) INTO v_caller_is_superintendent;

  IF NOT (
    public.is_dev()
    OR public.has_payroll_access()
    OR public.is_assistant()
    OR public.is_assistant()
    OR v_caller_is_superintendent
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authorized',
      'message', 'Not authorized.'
    );
  END IF;

  IF p_person_name IS NULL OR btrim(p_person_name) = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_name',
      'message', 'Person name is required.'
    );
  END IF;

  SELECT u.id INTO v_uid
  FROM public.users u
  WHERE btrim(u.name) = btrim(p_person_name)
  ORDER BY u.id
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'no_login_user',
      'message',
      'No user account matches this pay name. Align users.name with people_pay_config.person_name, or remove the salaried workday in Settings.'
    );
  END IF;

  IF NOT public.salary_schedule_staff_or_self_target(v_uid) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authorized_target',
      'message', 'Not authorized to clear schedule for this person.'
    );
  END IF;

  DELETE FROM public.salary_work_schedule_templates WHERE user_id = v_uid;
  DELETE FROM public.salary_work_schedule_day_overrides WHERE user_id = v_uid;

  v_today := (timezone('America/Denver', now()))::date;
  PERFORM public.sync_salary_clock_sessions_for_user_day(v_uid, v_today);

  RETURN jsonb_build_object('ok', true, 'user_id', v_uid::text);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.jobs_ledger_row_visible_for_tally_assign(p_job_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF p_job_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.role::text INTO v_role FROM public.users u WHERE u.id = p_user_id;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('subcontractor', 'helpers') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members jtm
      WHERE jtm.job_id = p_job_id AND jtm.user_id = p_user_id
    );
  END IF;

  IF v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller', 'primary') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_id
      AND (
        jl.master_user_id = p_user_id
        OR v_role = 'dev'
        OR v_role = 'primary'
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_user_id AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_user_id
        )
        OR public.assistants_share_master(p_user_id, jl.master_user_id)
      )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_user_accounts(p_survivor_user_id uuid, p_absorbed_user_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid;
  v_caller_role text;
  v_survivor public.users%ROWTYPE;
  v_absorbed public.users%ROWTYPE;
  v_moved jsonb := '{}'::jsonb;
  v_warnings text[] := ARRAY[]::text[];
  v_handled text[] := ARRAY[]::text[];
  v_n bigint;
  v_salary_collisions bigint;
  r record;
  lbl record;
  v_leftovers text[] := ARRAY[]::text[];
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated.');
  END IF;
  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller;
  IF v_caller_role IS DISTINCT FROM 'dev' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'error', 'Only devs can merge users.');
  END IF;
  IF p_survivor_user_id IS NULL OR p_absorbed_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_request', 'error', 'Both accounts are required.');
  END IF;
  IF p_survivor_user_id = p_absorbed_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'same_account', 'error', 'Pick two different accounts.');
  END IF;
  IF p_absorbed_user_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'code', 'self_absorb', 'error', 'You cannot absorb the account you are signed into.');
  END IF;

  SELECT * INTO v_survivor FROM public.users WHERE id = p_survivor_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'survivor_not_found', 'error', 'Surviving account not found.');
  END IF;
  SELECT * INTO v_absorbed FROM public.users WHERE id = p_absorbed_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'absorbed_not_found', 'error', 'Account to merge from not found.');
  END IF;

  IF v_survivor.role IS DISTINCT FROM v_absorbed.role THEN
    RETURN jsonb_build_object('ok', false, 'code', 'role_mismatch',
      'error', format('Both accounts must have the same role (%s vs %s).', v_survivor.role, v_absorbed.role));
  END IF;
  IF v_absorbed.archived_at IS NULL AND v_absorbed.last_sign_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'absorbed_in_use',
      'error', 'The account being merged away must be archived, or never signed into. Archive it first.');
  END IF;
  IF v_survivor.archived_at IS NOT NULL AND v_absorbed.archived_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'survivor_must_be_live',
      'error', 'Keep the live account: when one of the two is live, it must be the survivor.');
  END IF;

  -- Two salaried accounts with auto salary-schedule sessions on the same work date cannot be
  -- auto-merged (partial unique indexes on clock_sessions; deleting sessions would corrupt
  -- incrementally-maintained people_hours).
  SELECT count(*) INTO v_salary_collisions
  FROM public.clock_sessions b
  WHERE b.user_id = p_absorbed_user_id
    AND b.origin = 'salary_schedule'
    AND EXISTS (
      SELECT 1 FROM public.clock_sessions a
      WHERE a.user_id = p_survivor_user_id
        AND a.origin = 'salary_schedule'
        AND a.work_date = b.work_date
    );
  IF v_salary_collisions > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'salary_schedule_overlap',
      'error', format('Both accounts have salary-schedule clock sessions on %s of the same day(s). This pair cannot be auto-merged.', v_salary_collisions));
  END IF;

  BEGIN
    ------------------------------------------------------------------
    -- 1a. customers before jobs (job↔customer master invariant cascade)
    ------------------------------------------------------------------
    UPDATE public.customers SET master_user_id = p_survivor_user_id WHERE master_user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('customers.master_user_id', v_n); END IF;
    v_handled := v_handled || 'customers.master_user_id'::text;

    UPDATE public.jobs_ledger SET master_user_id = p_survivor_user_id WHERE master_user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('jobs_ledger.master_user_id', v_n); END IF;
    v_handled := v_handled || 'jobs_ledger.master_user_id'::text;

    ------------------------------------------------------------------
    -- 1b. personal board layout: survivor's wins, absorbed's is dropped
    ------------------------------------------------------------------
    DELETE FROM public.bid_working_board_placements WHERE user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('bid_working_board_placements.deleted', v_n); END IF;
    DELETE FROM public.bid_working_board_columns WHERE user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('bid_working_board_columns.deleted', v_n); END IF;
    v_handled := v_handled || ARRAY['bid_working_board_placements.user_id', 'bid_working_board_columns.user_id'];

    ------------------------------------------------------------------
    -- 1c. additive activity aggregates
    ------------------------------------------------------------------
    UPDATE public.user_app_activity_daily a
    SET active_seconds = LEAST(86400, a.active_seconds + b.active_seconds),
        first_seen_at = LEAST(a.first_seen_at, b.first_seen_at),
        last_seen_at = GREATEST(a.last_seen_at, b.last_seen_at)
    FROM public.user_app_activity_daily b
    WHERE a.user_id = p_survivor_user_id AND b.user_id = p_absorbed_user_id
      AND a.activity_date = b.activity_date;
    UPDATE public.user_app_activity_page_daily a
    SET active_seconds = LEAST(86400, a.active_seconds + b.active_seconds)
    FROM public.user_app_activity_page_daily b
    WHERE a.user_id = p_survivor_user_id AND b.user_id = p_absorbed_user_id
      AND a.activity_date = b.activity_date AND a.page = b.page;

    ------------------------------------------------------------------
    -- 1d. label slug collisions: keep survivor's label, repoint tags, drop absorbed's
    ------------------------------------------------------------------
    FOR lbl IN
      SELECT b.id AS b_id, a.id AS a_id
      FROM public.labels b
      JOIN public.labels a ON a.master_user_id = p_survivor_user_id AND a.slug = b.slug
      WHERE b.master_user_id = p_absorbed_user_id
    LOOP
      UPDATE public.user_labels t SET label_id = lbl.a_id
      WHERE t.label_id = lbl.b_id
        AND NOT EXISTS (SELECT 1 FROM public.user_labels t2 WHERE t2.user_id = t.user_id AND t2.label_id = lbl.a_id);
      DELETE FROM public.user_labels WHERE label_id = lbl.b_id;
      UPDATE public.people_labels t SET label_id = lbl.a_id
      WHERE t.label_id = lbl.b_id
        AND NOT EXISTS (SELECT 1 FROM public.people_labels t2 WHERE t2.person_id = t.person_id AND t2.label_id = lbl.a_id);
      DELETE FROM public.people_labels WHERE label_id = lbl.b_id;
      DELETE FROM public.labels WHERE id = lbl.b_id;
    END LOOP;
    UPDATE public.labels SET master_user_id = p_survivor_user_id WHERE master_user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('labels.master_user_id', v_n); END IF;
    v_handled := v_handled || 'labels.master_user_id'::text;

    ------------------------------------------------------------------
    -- 1e. org pair tables: rewrite both sides, then drop self-pairs
    ------------------------------------------------------------------
    FOR r IN
      SELECT * FROM (VALUES
        ('master_primaries', 'master_id', 'primary_id'),
        ('master_superintendents', 'master_id', 'superintendent_id')
      ) AS v(tbl, col1, col2)
    LOOP
      EXECUTE format(
        'UPDATE public.%I t SET %I = $1 WHERE t.%I = $2 AND NOT EXISTS (SELECT 1 FROM public.%I t2 WHERE t2.%I = $1 AND t2.%I = t.%I)',
        r.tbl, r.col1, r.col1, r.tbl, r.col1, r.col2, r.col2) USING p_survivor_user_id, p_absorbed_user_id;
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col1) USING p_absorbed_user_id;
      EXECUTE format(
        'UPDATE public.%I t SET %I = $1 WHERE t.%I = $2 AND NOT EXISTS (SELECT 1 FROM public.%I t2 WHERE t2.%I = $1 AND t2.%I = t.%I)',
        r.tbl, r.col2, r.col2, r.tbl, r.col2, r.col1, r.col1, r.col1) USING p_survivor_user_id, p_absorbed_user_id;
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col2) USING p_absorbed_user_id;
      EXECUTE format('DELETE FROM public.%I WHERE %I = %I', r.tbl, r.col1, r.col2);
      v_handled := v_handled || (r.tbl || '.' || r.col1) || (r.tbl || '.' || r.col2);
    END LOOP;

    ------------------------------------------------------------------
    -- 1f. membership / per-user-keyed tables: move-if-absent, drop leftovers
    ------------------------------------------------------------------
    FOR r IN
      SELECT * FROM (VALUES
        ('jobs_ledger_team_members', 'user_id', 't2.job_id = t.job_id'),
        ('checklist_instance_assignees', 'user_id', 't2.checklist_instance_id = t.checklist_instance_id'),
        ('checklist_item_assignees', 'user_id', 't2.checklist_item_id = t.checklist_item_id'),
        ('checklist_tech_tree_roadmap_members', 'user_id', 't2.roadmap_id = t.roadmap_id'),
        ('checklist_tech_tree_task_assignees', 'user_id', 't2.task_id = t.task_id'),
        ('step_subscriptions', 'user_id', 't2.step_id = t.step_id'),
        ('prospect_email_sent', 'user_id', 't2.prospect_id = t.prospect_id AND t2.template_key = t.template_key'),
        ('mercury_tally_transaction_notes', 'user_id', 't2.mercury_transaction_id = t.mercury_transaction_id'),
        ('report_reads', 'user_id', 't2.report_id = t.report_id'),
        ('dispatch_request_dismissals', 'user_id', 't2.request_id = t.request_id'),
        ('estimator_request_dismissals', 'user_id', 't2.request_id = t.request_id'),
        ('dev_ignored_checklist_items', 'dev_user_id', 't2.checklist_item_id = t.checklist_item_id'),
        ('dev_read_completed_items', 'dev_user_id', 't2.checklist_instance_id = t.checklist_instance_id'),
        ('user_checklist_item_mute_preferences', 'user_id', 't2.checklist_item_id = t.checklist_item_id'),
        ('recurring_job_report_schedule_recipients', 'recipient_user_id', 't2.schedule_id = t.schedule_id'),
        ('recurring_job_report_dispatch_log', 'recipient_user_id', 't2.schedule_id = t.schedule_id AND t2.reporting_date = t.reporting_date'),
        ('team_feedback_peer_ratings', 'peer_user_id', 't2.submission_id = t.submission_id'),
        ('user_daily_goals_ack', 'user_id', 't2.local_date = t.local_date'),
        ('salary_work_schedule_day_overrides', 'user_id', 't2.work_date = t.work_date'),
        ('user_labels', 'user_id', 't2.label_id = t.label_id'),
        ('user_bid_notes_read_state', 'user_id', 't2.bid_id = t.bid_id'),
        ('user_dashboard_buttons', 'user_id', 't2.button_key = t.button_key'),
        ('user_prospect_copy_templates', 'user_id', 't2.template_key = t.template_key'),
        ('user_prospect_quick_notes', 'user_id', 't2.label = t.label'),
        ('user_report_notification_preferences', 'user_id', 't2.template_id = t.template_id'),
        ('user_pinned_tabs', 'user_id', 't2.path = t.path AND COALESCE(t2.tab, '''') = COALESCE(t.tab, '''')'),
        ('push_subscriptions', 'user_id', 't2.endpoint = t.endpoint'),
        ('user_app_activity_daily', 'user_id', 't2.activity_date = t.activity_date'),
        ('user_app_activity_page_daily', 'user_id', 't2.activity_date = t.activity_date AND t2.page = t.page'),
        ('schedule_day_email_requests', 'recipient_user_id',
          't.status = ''pending'' AND t2.status = ''pending'' AND t2.work_date = t.work_date'),
        ('user_tag_org', 'user_id', 'TRUE'),
        ('banking_user_prefs', 'user_id', 'TRUE'),
        ('bid_estimators_extra_users', 'user_id', 'TRUE'),
        ('dispatch_group_members', 'user_id', 'TRUE'),
        ('estimator_group_members', 'user_id', 'TRUE'),
        ('pay_approved_masters', 'master_id', 'TRUE'),
        ('report_enabled_users', 'user_id', 'TRUE'),
        ('salary_work_schedule_templates', 'user_id', 'TRUE'),
        ('team_feedback_user_state', 'user_id', 'TRUE'),
        ('user_dashboard_preferences', 'user_id', 'TRUE'),
        ('user_app_activity_viewers', 'viewer_user_id', 'TRUE')
      ) AS v(tbl, ucol, match_expr)
    LOOP
      EXECUTE format(
        'UPDATE public.%I t SET %I = $1 WHERE t.%I = $2 AND NOT EXISTS (SELECT 1 FROM public.%I t2 WHERE t2.%I = $1 AND (%s))',
        r.tbl, r.ucol, r.ucol, r.tbl, r.ucol, r.match_expr) USING p_survivor_user_id, p_absorbed_user_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object(r.tbl || '.' || r.ucol, v_n); END IF;
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.ucol) USING p_absorbed_user_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object(r.tbl || '.' || r.ucol || '.duplicates_dropped', v_n); END IF;
      v_handled := v_handled || (r.tbl || '.' || r.ucol);
    END LOOP;

    ------------------------------------------------------------------
    -- 1g. accept_notify_user_ids uuid[] (no FK possible)
    ------------------------------------------------------------------
    UPDATE public.estimates e
    SET accept_notify_user_ids = (
      SELECT array_agg(DISTINCT x)
      FROM unnest(array_replace(e.accept_notify_user_ids, p_absorbed_user_id, p_survivor_user_id)) AS x
    )
    WHERE e.accept_notify_user_ids @> ARRAY[p_absorbed_user_id];
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('estimates.accept_notify_user_ids', v_n); END IF;

    ------------------------------------------------------------------
    -- 1h. roster link: move only when the survivor has none
    ------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM public.people WHERE account_user_id = p_absorbed_user_id) THEN
      IF EXISTS (SELECT 1 FROM public.people WHERE account_user_id = p_survivor_user_id) THEN
        v_warnings := v_warnings ||
          'Both accounts are linked to roster people; the absorbed account''s roster link was left in place. Merge the roster entries manually if needed.'::text;
      ELSE
        UPDATE public.people SET account_user_id = p_survivor_user_id WHERE account_user_id = p_absorbed_user_id;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('people.account_user_id', v_n); END IF;
        v_handled := v_handled || 'people.account_user_id'::text;
      END IF;
    ELSE
      v_handled := v_handled || 'people.account_user_id'::text;
    END IF;

    ------------------------------------------------------------------
    -- 2. dynamic sweep: every remaining FK to public.users / auth.users on public tables
    ------------------------------------------------------------------
    FOR r IN
      SELECT cl.relname AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped
      WHERE c.contype = 'f'
        AND cardinality(c.conkey) = 1
        AND n.nspname = 'public'
        AND c.confrelid IN ('public.users'::regclass, 'auth.users'::regclass)
        AND NOT (cl.relname = 'users' AND a.attname = 'id')
      ORDER BY cl.relname, a.attname
    LOOP
      CONTINUE WHEN (r.tbl || '.' || r.col) = ANY (v_handled);
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col)
        USING p_survivor_user_id, p_absorbed_user_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object(r.tbl || '.' || r.col, v_n); END IF;
    END LOOP;

    ------------------------------------------------------------------
    -- 3. coverage assert: nothing may still reference the absorbed id
    ------------------------------------------------------------------
    FOR r IN
      SELECT cl.relname AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped
      WHERE c.contype = 'f'
        AND cardinality(c.conkey) = 1
        AND n.nspname = 'public'
        AND c.confrelid IN ('public.users'::regclass, 'auth.users'::regclass)
        AND NOT (cl.relname = 'users' AND a.attname = 'id')
      UNION ALL
      SELECT 'user_app_activity_page_daily', 'user_id'
      UNION ALL
      SELECT 'people', 'account_user_id'
    LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.tbl, r.col)
        INTO v_n USING p_absorbed_user_id;
      IF v_n > 0 AND NOT (r.tbl = 'people' AND r.col = 'account_user_id'
          AND EXISTS (SELECT 1 FROM public.people WHERE account_user_id = p_survivor_user_id)) THEN
        v_leftovers := v_leftovers || format('%s.%s (%s rows)', r.tbl, r.col, v_n);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.estimates WHERE accept_notify_user_ids @> ARRAY[p_absorbed_user_id]) THEN
      v_leftovers := v_leftovers || 'estimates.accept_notify_user_ids'::text;
    END IF;
    IF cardinality(v_leftovers) > 0 THEN
      RAISE EXCEPTION 'merge left references behind: %', array_to_string(v_leftovers, ', ');
    END IF;

    ------------------------------------------------------------------
    -- 4. tombstone the absorbed account (email kept; auth ban happens in the edge function)
    ------------------------------------------------------------------
    UPDATE public.users
    SET archived_at = COALESCE(archived_at, now())
    WHERE id = p_absorbed_user_id;

    IF p_dry_run THEN
      RAISE EXCEPTION USING errcode = 'P0M01', message = 'dry run rollback';
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0M01' THEN
      RETURN jsonb_build_object('ok', true, 'dry_run', true, 'moved', v_moved, 'warnings', to_jsonb(v_warnings));
  END;

  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'moved', v_moved, 'warnings', to_jsonb(v_warnings));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'error', SQLERRM);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_global_email_schedule()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH gate AS (SELECT public.is_dev() AS ok),
setting_list AS (
  SELECT key,
         CASE WHEN value_text ~ '^\s*\[' THEN value_text::jsonb ELSE '[]'::jsonb END AS ids
  FROM public.app_settings
  WHERE key IN ('paid_job_email_recipients_v1', 'payment_made_email_recipients_v1')
),
setting_people AS (
  SELECT sl.key, jsonb_agg(jsonb_build_object('user_id', u.id, 'name', COALESCE(NULLIF(trim(u.name), ''), u.email)) ORDER BY u.name) AS people
  FROM setting_list sl
  CROSS JOIN LATERAL jsonb_array_elements_text(sl.ids) AS x(uid)
  JOIN public.users u ON u.id::text = x.uid
  GROUP BY sl.key
),
-- Ready to Bill v2 (v2.1844): per-person channel flags ride along.
rtb_people AS (
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'name', COALESCE(NULLIF(trim(u.name), ''), u.email),
    'email', (e ->> 'email') IS DISTINCT FROM 'false',
    'push', (e ->> 'push') IS DISTINCT FROM 'false'
  ) ORDER BY u.name) AS people
  FROM public.app_settings s
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN s.value_text ~ '^\s*\[' THEN s.value_text::jsonb ELSE '[]'::jsonb END
  ) AS e
  JOIN public.users u ON u.id::text = e ->> 'id'
  WHERE s.key = 'ready_to_bill_notify_recipients_v2'
    AND ((e ->> 'email') IS DISTINCT FROM 'false' OR (e ->> 'push') IS DISTINCT FROM 'false')
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE jsonb_build_object(
  'report_schedules', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'enabled', s.enabled,
      'time_local', to_char(s.time_local, 'HH24:MI'),
      'days_of_week', to_jsonb(s.days_of_week),
      'timezone', s.timezone,
      'recipients', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'row_id', r.id,
          'user_id', u.id,
          'name', COALESCE(NULLIF(trim(u.name), ''), u.email),
          'include_costs', r.include_costs
        ) ORDER BY u.name)
        FROM public.recurring_job_report_schedule_recipients r
        JOIN public.users u ON u.id = r.recipient_user_id
        WHERE r.schedule_id = s.id
      ), '[]'::jsonb)
    ) ORDER BY s.name)
    FROM public.recurring_job_report_schedules s
  ), '[]'::jsonb),
  'paid_recipients', COALESCE((SELECT people FROM setting_people WHERE key = 'paid_job_email_recipients_v1'), '[]'::jsonb),
  'payment_recipients', COALESCE((SELECT people FROM setting_people WHERE key = 'payment_made_email_recipients_v1'), '[]'::jsonb),
  'ready_to_bill_recipients', COALESCE((SELECT people FROM rtb_people), '[]'::jsonb),
  'report_email_subscriptions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id,
      'recipient_name', COALESCE(NULLIF(trim(u.name), ''), u.email, NULLIF(trim(s.recipient_email), ''), '—'),
      'external', s.recipient_user_id IS NULL,
      'label', NULLIF(trim(s.label), ''),
      'enabled', s.enabled,
      'auto_send', s.auto_send,
      'all_authors', s.all_authors,
      'authors', COALESCE((
        SELECT jsonb_agg(COALESCE(NULLIF(trim(au.name), ''), au.email) ORDER BY au.name)
        FROM public.report_email_subscription_authors a
        JOIN public.users au ON au.id = a.author_user_id
        WHERE a.subscription_id = s.id
      ), '[]'::jsonb)
    ) ORDER BY s.enabled DESC, COALESCE(NULLIF(trim(u.name), ''), u.email, s.recipient_email))
    FROM public.report_email_subscriptions s
    LEFT JOIN public.users u ON u.id = s.recipient_user_id
  ), '[]'::jsonb),
  'billed_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', b.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', b.send_at,
      'repeat_weekly', b.repeat_weekly
    ) ORDER BY b.send_at)
    FROM public.billed_report_email_requests b
    JOIN public.users ru ON ru.id = b.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = b.requested_by
    WHERE b.sent_at IS NULL
  ), '[]'::jsonb),
  'gc_statement_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', g.id,
      'entity_name', g.entity_name,
      'sent_to', g.sent_to,
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', g.send_at,
      'repeat_weekly', g.repeat_weekly
    ) ORDER BY g.send_at)
    FROM public.gc_statement_email_requests g
    LEFT JOIN public.users qu ON qu.id = g.requested_by
    WHERE g.sent_at IS NULL
  ), '[]'::jsonb),
  'weekly_movement_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', w.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', w.send_at,
      'repeat_weekly', w.repeat_weekly
    ) ORDER BY w.send_at)
    FROM public.weekly_movement_email_requests w
    JOIN public.users ru ON ru.id = w.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = w.requested_by
    WHERE w.sent_at IS NULL
  ), '[]'::jsonb),
  'weekly_money_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', m.send_at,
      'repeat_weekly', m.repeat_weekly
    ) ORDER BY m.send_at)
    FROM public.weekly_money_email_requests m
    JOIN public.users ru ON ru.id = m.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = m.requested_by
    WHERE m.sent_at IS NULL
  ), '[]'::jsonb),
  'payment_forecast_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.payment_forecast_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'money_waiting_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.money_waiting_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'statement_round_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.statement_round_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'crew_day_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.crew_day_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'gc_money_monday_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'recipient_name', COALESCE(NULLIF(trim(ru.name), ''), ru.email),
      'requested_by_name', COALESCE(NULLIF(trim(qu.name), ''), qu.email),
      'send_at', f.send_at,
      'repeat_weekly', f.repeat_weekly
    ) ORDER BY f.send_at)
    FROM public.gc_money_monday_email_requests f
    JOIN public.users ru ON ru.id = f.recipient_user_id
    LEFT JOIN public.users qu ON qu.id = f.requested_by
    WHERE f.sent_at IS NULL
  ), '[]'::jsonb),
  'schedule_day_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', d.id,
      'recipient_name', COALESCE(NULLIF(trim(u.name), ''), u.email),
      'send_at', d.send_at,
      'work_date', d.work_date
    ) ORDER BY d.send_at)
    FROM public.schedule_day_email_requests d
    JOIN public.users u ON u.id = d.recipient_user_id
    WHERE d.status = 'pending' AND d.sent_at IS NULL
  ), '[]'::jsonb)
) END;
$function$
;

COMMENT ON FUNCTION public.get_global_email_schedule() IS
  'Dev-only: every stream''s recipients and pending sends for the Settings → Email streams panel; NULL for non-devs. report_email_subscriptions carries authors (v2.3480; the team-lead scope went with the Team leads list, v2.5088).';

CREATE OR REPLACE FUNCTION public.get_my_email_schedule()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH me AS (SELECT (SELECT auth.uid()) AS uid),
chicago AS (
  SELECT today,
         (today - ((EXTRACT(ISODOW FROM today)::int - 1)))::date AS monday
  FROM (SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today) t
),
weekly AS (
  SELECT s.name, s.enabled, s.time_local, s.days_of_week, s.timezone,
         r.include_costs, r.activity_scope, r.crew_filter
  FROM public.recurring_job_report_schedule_recipients r
  JOIN public.recurring_job_report_schedules s ON s.id = r.schedule_id
  WHERE r.recipient_user_id = (SELECT uid FROM me)
),
-- Pending one-offs, plus ones already sent THIS Chicago week (Mon–today).
billed_oneoffs AS (
  SELECT b.send_at, b.sent_at, b.repeat_weekly, qu.name AS requested_by_name
  FROM public.billed_report_email_requests b
  LEFT JOIN public.users qu ON qu.id = b.requested_by
  CROSS JOIN chicago c
  WHERE b.recipient_user_id = (SELECT uid FROM me)
    AND (
      b.sent_at IS NULL
      OR (b.error IS NULL AND (b.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
schedule_day_oneoffs AS (
  SELECT d.send_at, d.sent_at, d.work_date
  FROM public.schedule_day_email_requests d
  CROSS JOIN chicago c
  WHERE d.recipient_user_id = (SELECT uid FROM me)
    AND (
      (d.status = 'pending' AND d.sent_at IS NULL)
      OR (d.status = 'sent' AND d.sent_at IS NOT NULL AND (d.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
gc_statement_oneoffs AS (
  -- Requester-scoped BY DESIGN (REPORT_SUBSCRIPTIONS.md): GC statements go to
  -- outside AP inboxes with no user row, so the scheduled send lists on the
  -- REQUESTER's schedule labeled with the destination address.
  SELECT g.send_at, g.sent_at, g.repeat_weekly, g.entity_name, g.sent_to
  FROM public.gc_statement_email_requests g
  CROSS JOIN chicago c
  WHERE (
      g.requested_by = (SELECT uid FROM me)
      OR lower(g.sent_to) = (SELECT lower(u.email) FROM public.users u WHERE u.id = (SELECT uid FROM me) AND COALESCE(u.email, '') <> '')
    )
    AND (
      g.sent_at IS NULL
      OR (g.error IS NULL AND (g.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
weekly_movement_oneoffs AS (
  -- Recipient-scoped like billed_report (recipients ARE users for this stream).
  SELECT w.send_at, w.sent_at, w.repeat_weekly, qu.name AS requested_by_name
  FROM public.weekly_movement_email_requests w
  LEFT JOIN public.users qu ON qu.id = w.requested_by
  CROSS JOIN chicago c
  WHERE w.recipient_user_id = (SELECT uid FROM me)
    AND (
      w.sent_at IS NULL
      OR (w.error IS NULL AND (w.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
weekly_money_oneoffs AS (
  -- Recipient-scoped; recipients are dev/controller users (wage-derived data).
  SELECT m.send_at, m.sent_at, m.repeat_weekly, qu.name AS requested_by_name
  FROM public.weekly_money_email_requests m
  LEFT JOIN public.users qu ON qu.id = m.requested_by
  CROSS JOIN chicago c
  WHERE m.recipient_user_id = (SELECT uid FROM me)
    AND (
      m.sent_at IS NULL
      OR (m.error IS NULL AND (m.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
payment_forecast_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.2223).
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.payment_forecast_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
money_waiting_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.2565).
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.money_waiting_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
statement_round_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.2771).
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.statement_round_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
crew_day_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.2603).
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.crew_day_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
gc_money_monday_oneoffs AS (
  -- Recipient-scoped like billed_report (v2.5024); recipients are the money team.
  SELECT f.send_at, f.sent_at, f.repeat_weekly, qu.name AS requested_by_name
  FROM public.gc_money_monday_email_requests f
  LEFT JOIN public.users qu ON qu.id = f.requested_by
  CROSS JOIN chicago c
  WHERE f.recipient_user_id = (SELECT uid FROM me)
    AND (
      f.sent_at IS NULL
      OR (f.error IS NULL AND (f.sent_at AT TIME ZONE 'America/Chicago')::date BETWEEN c.monday AND c.today)
    )
),
setting_list AS (
  SELECT key,
         CASE WHEN value_text ~ '^\s*\[' THEN value_text::jsonb ELSE '[]'::jsonb END AS ids
  FROM public.app_settings
  WHERE key IN ('paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'estimate_accepted_notify_recipients_v1')
),
-- Ready to Bill v2 (v2.1844): array of { id, email, push } objects.
rtb_membership AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.app_settings s
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN s.value_text ~ '^\s*\[' THEN s.value_text::jsonb ELSE '[]'::jsonb END
    ) AS e
    WHERE s.key = 'ready_to_bill_notify_recipients_v2'
      AND e ->> 'id' = (SELECT uid FROM me)::text
      AND ((e ->> 'email') IS DISTINCT FROM 'false' OR (e ->> 'push') IS DISTINCT FROM 'false')
  ) AS on_it
),
-- Per-estimate subscriptions that can still fire an acceptance email.
est_specific AS (
  SELECT e.title, e.created_at
  FROM public.estimates e
  WHERE (SELECT uid FROM me) = ANY(e.accept_notify_user_ids)
    AND e.status IN ('draft', 'sent')
),
-- Field report emails (v2.3472): every report_email_subscriptions row addressed
-- to me — by user id, or by an external address that matches my account email
-- (the manager may have typed the address instead of picking the user).
report_email_subs AS (
  SELECT s.id, s.enabled, s.auto_send, s.all_authors,
         COALESCE((
           SELECT jsonb_agg(COALESCE(NULLIF(trim(au.name), ''), au.email) ORDER BY au.name)
           FROM public.report_email_subscription_authors a
           JOIN public.users au ON au.id = a.author_user_id
           WHERE a.subscription_id = s.id
         ), '[]'::jsonb) AS authors
  FROM public.report_email_subscriptions s
  WHERE s.recipient_user_id = (SELECT uid FROM me)
     OR (
       s.recipient_user_id IS NULL
       AND s.recipient_email IS NOT NULL
       AND lower(trim(s.recipient_email)) = (
         SELECT lower(u.email) FROM public.users u
         WHERE u.id = (SELECT uid FROM me) AND COALESCE(u.email, '') <> ''
       )
     )
)
SELECT jsonb_build_object(
  'weekly', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', w.name,
      'enabled', w.enabled,
      'time_local', to_char(w.time_local, 'HH24:MI'),
      'days_of_week', to_jsonb(w.days_of_week),
      'timezone', w.timezone,
      'include_costs', w.include_costs,
      'activity_scope', w.activity_scope,
      'crew_filter', w.crew_filter
    ) ORDER BY w.time_local) FROM weekly w), '[]'::jsonb),
  'report_emails', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'enabled', r.enabled,
      'auto_send', r.auto_send,
      'all_authors', r.all_authors,
      'authors', r.authors
    ) ORDER BY r.enabled DESC, r.all_authors DESC) FROM report_email_subs r), '[]'::jsonb),
  'one_offs', COALESCE((SELECT jsonb_agg(o ORDER BY (o->>'send_at')) FROM (
      SELECT jsonb_build_object('stream', 'billed_report', 'send_at', b.send_at,
                                'sent_at', b.sent_at,
                                'repeat_weekly', b.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(b.requested_by_name), ''), 'scheduled')) AS o
      FROM billed_oneoffs b
      UNION ALL
      SELECT jsonb_build_object('stream', 'schedule_day', 'send_at', d.send_at,
                                'sent_at', d.sent_at,
                                'repeat_weekly', false,
                                'detail', 'for ' || to_char(d.work_date, 'Mon FMDD'))
      FROM schedule_day_oneoffs d
      UNION ALL
      SELECT jsonb_build_object('stream', 'gc_statement', 'send_at', g.send_at,
                                'sent_at', g.sent_at,
                                'repeat_weekly', g.repeat_weekly,
                                'detail', COALESCE(NULLIF(trim(g.entity_name), ''), 'Statement') || CHR(32) || CHR(8594) || CHR(32) || g.sent_to)
      FROM gc_statement_oneoffs g
      UNION ALL
      SELECT jsonb_build_object('stream', 'weekly_movement', 'send_at', w.send_at,
                                'sent_at', w.sent_at,
                                'repeat_weekly', w.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(w.requested_by_name), ''), 'scheduled'))
      FROM weekly_movement_oneoffs w
      UNION ALL
      SELECT jsonb_build_object('stream', 'weekly_money', 'send_at', m.send_at,
                                'sent_at', m.sent_at,
                                'repeat_weekly', m.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(m.requested_by_name), ''), 'scheduled'))
      FROM weekly_money_oneoffs m
      UNION ALL
      SELECT jsonb_build_object('stream', 'payment_forecast', 'send_at', f.send_at,
                                'sent_at', f.sent_at,
                                'repeat_weekly', f.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(f.requested_by_name), ''), 'scheduled'))
      FROM payment_forecast_oneoffs f
      UNION ALL
      SELECT jsonb_build_object('stream', 'money_waiting', 'send_at', mw.send_at,
                                'sent_at', mw.sent_at,
                                'repeat_weekly', mw.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(mw.requested_by_name), ''), 'scheduled'))
      FROM money_waiting_oneoffs mw
      UNION ALL
      SELECT jsonb_build_object('stream', 'crew_day', 'send_at', cd.send_at,
                                'sent_at', cd.sent_at,
                                'repeat_weekly', cd.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(cd.requested_by_name), ''), 'scheduled'))
      FROM crew_day_oneoffs cd
      UNION ALL
      SELECT jsonb_build_object('stream', 'statement_round', 'send_at', sr.send_at,
                                'sent_at', sr.sent_at,
                                'repeat_weekly', sr.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(sr.requested_by_name), ''), 'scheduled'))
      FROM statement_round_oneoffs sr
      UNION ALL
      SELECT jsonb_build_object('stream', 'gc_money_monday', 'send_at', gm.send_at,
                                'sent_at', gm.sent_at,
                                'repeat_weekly', gm.repeat_weekly,
                                'detail', COALESCE('from ' || NULLIF(trim(gm.requested_by_name), ''), 'scheduled'))
      FROM gc_money_monday_oneoffs gm
    ) x), '[]'::jsonb),
  'events', jsonb_build_object(
    'paid_in_full', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'paid_job_email_recipients_v1'), false),
    'payment_received', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'payment_made_email_recipients_v1'), false),
    'estimate_accepted_always', COALESCE((SELECT ids ? (SELECT uid FROM me)::text FROM setting_list WHERE key = 'estimate_accepted_notify_recipients_v1'), false),
    'ready_to_bill', COALESCE((SELECT on_it FROM rtb_membership), false)
  ),
  'estimate_specific', jsonb_build_object(
    'total', COALESCE((SELECT count(*) FROM est_specific), 0),
    'titles', COALESCE((SELECT jsonb_agg(c.t ORDER BY c.created_at DESC) FROM (
        SELECT NULLIF(trim(s.title), '') AS t, s.created_at
        FROM est_specific s
        ORDER BY s.created_at DESC
        LIMIT 5
      ) c WHERE c.t IS NOT NULL), '[]'::jsonb)
  )
);
$function$
;

COMMENT ON FUNCTION public.get_my_email_schedule() IS
  'Self-scoped: every email stream configured to reach auth.uid() — weekly digests (with activity scope + crew filter), pending one-offs across all scheduled streams, event streams, per-estimate subscriptions, and the field-report email subscriptions addressed to the caller (authors, v2.3480; the team-lead scope went with the Team leads list, v2.5088).';

-- 2. The policies, each its live expression less the team-lead branch; the two that were only that branch go.

ALTER POLICY "Attendance incidents staff insert" ON public.attendance_incidents
  WITH CHECK (((created_by_user_id = ( SELECT auth.uid() AS uid)) AND (public.is_dev() OR public.has_payroll_access() OR public.is_master_or_dev() OR public.is_assistant() OR public.is_assistant())));

ALTER POLICY "Attendance incidents staff select" ON public.attendance_incidents
  USING ((public.is_dev() OR public.has_payroll_access() OR public.is_master_or_dev() OR public.is_assistant() OR public.is_assistant()));

ALTER POLICY "clock_sessions select access" ON public.clock_sessions
  USING ((( SELECT public.is_dev() AS is_dev) OR (( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant)) OR (user_id = ( SELECT auth.uid() AS uid))));

ALTER POLICY "clock_sessions update access" ON public.clock_sessions
  USING ((( SELECT public.is_dev() AS is_dev) OR ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant))))
  WITH CHECK ((( SELECT public.is_dev() AS is_dev) OR ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant))));

ALTER POLICY "clock_typed_entries_select" ON public.clock_typed_entries
  USING ((( SELECT public.is_dev() AS is_dev) OR ( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR (user_id = ( SELECT auth.uid() AS uid))));

ALTER POLICY "people_crew_bids delete access" ON public.people_crew_bids
  USING ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_crew_bids insert access" ON public.people_crew_bids
  WITH CHECK ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_crew_bids select access" ON public.people_crew_bids
  USING ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_crew_bids update access" ON public.people_crew_bids
  USING ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)))
  WITH CHECK ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_crew_jobs delete access" ON public.people_crew_jobs
  USING ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_crew_jobs insert access" ON public.people_crew_jobs
  WITH CHECK ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_crew_jobs select access" ON public.people_crew_jobs
  USING ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_crew_jobs update access" ON public.people_crew_jobs
  USING ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)))
  WITH CHECK ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_hours insert access" ON public.people_hours
  WITH CHECK ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_hours select access" ON public.people_hours
  USING ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "people_hours update access" ON public.people_hours
  USING ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)))
  WITH CHECK ((( SELECT public.has_payroll_access() AS has_payroll_access) OR ( SELECT public.is_assistant() AS is_assistant) OR ( SELECT public.is_assistant() AS is_assistant)));

ALTER POLICY "salary_override_select" ON public.salary_work_schedule_day_overrides
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.salary_schedule_staff_or_self_target(user_id)));

ALTER POLICY "salary_template_select" ON public.salary_work_schedule_templates
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.salary_schedule_staff_or_self_target(user_id)));

ALTER POLICY "user_time_off_select" ON public.user_time_off
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.salary_schedule_staff_or_self_target(user_id)));

DROP POLICY IF EXISTS "Team leads can read jobs ledger for member clock sessions" ON public.jobs_ledger;
DROP POLICY IF EXISTS "Team leads can delete people hours for members" ON public.people_hours;

-- 3. The helpers and the report-email lead picker; no policy or function names them now.
DROP FUNCTION IF EXISTS public.list_report_email_team_leads();
DROP FUNCTION IF EXISTS public.is_team_lead_for_person_name(text);
DROP FUNCTION IF EXISTS public.is_team_lead_for_member(uuid, uuid);

-- 4. The digest's "My team" read the list. Fails loudly, and widens nobody, if a 'my_team' row
-- appeared since 2026-10-08.
ALTER TABLE public.recurring_job_report_schedule_recipients
  DROP CONSTRAINT IF EXISTS recurring_job_report_schedule_recipients_crew_filter_check;
ALTER TABLE public.recurring_job_report_schedule_recipients
  ADD CONSTRAINT recurring_job_report_schedule_recipients_crew_filter_check CHECK (crew_filter = 'all_users');

-- 5. The tables, last; their own policies, fences, indexes and triggers go with them.
DROP TABLE IF EXISTS public.report_email_subscription_team_leads;
DROP TABLE IF EXISTS public.team_leader_clock_notify_prefs;
DROP TABLE IF EXISTS public.team_leader_assignments;
DROP FUNCTION IF EXISTS public.team_leader_assignments_dashboard_visibility_dev_only();
DROP FUNCTION IF EXISTS public.can_manage_team_leader_assignments();
