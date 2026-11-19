SET lock_timeout = '3s';

-- The two reads behind the schedule emails ask who is calling. list_schedule_blocks_for_share and
-- list_job_schedule_blocks_for_schedule_email answer the schedule as one named person sees it, and both run as their
-- definer for any signed-in caller. Each now begins by asking the gate below, which raises 42501 unless the caller
-- has business with the named person:
--
--   * the dispatch functions, which read with the service key and carry no login, read for anyone, as before;
--   * a signed-in caller reads for himself;
--   * the day's schedule email alone is also read for anyone by the office (is_office_staff(): dev, master
--     technician, assistant, controller), the roles the policy schedule_day_email_requests_insert_office_any_recipient
--     lets send that email to another person. Their window previews what the person picked will be sent.
--     The shared schedule has no such leg: its window previews the sender's own board and names nobody else.
--
-- One clause changes inside the read, family 7 of punch list #400 (to-dos/primary-job-doors.md): a primary named as
-- the viewer or the recipient is held to the blocks assigned to him and the jobs he is the account manager of
-- (jobs_ledger.account_manager_user_id), the rule the table job_schedule_blocks already holds him to through
-- primary_scope_jobs_ledger. It is written inline because these reads ask about a named person, not auth.uid().
-- Every other role's legs, and the bid blocks, are as they were.
--
-- Both functions are replaced from their live definitions (pg_get_functiondef on a copy of the whole schema, the same
-- bodies as 20261118020000) with the gate's statement in front of the read and the primary's clause round the job
-- legs. No name, argument or returned column changes, and every caller in the app already asks within the gate's
-- rule, so this is safe on either side of a client deploy. The grants are restated by name: authenticated and the
-- service role, never anon.
-- No CREATE TABLE. Idempotent: CREATE OR REPLACE and grants that name every role.

-- 1) The gate. p_office_reads_anyone is true for the read whose senders may name another person.
CREATE OR REPLACE FUNCTION public.schedule_read_gate(p_person uuid, p_office_reads_anyone boolean)
RETURNS void
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    -- The dispatch functions: the service key, no login.
    IF auth.role() = 'service_role' THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Sign in to read a schedule.' USING ERRCODE = '42501';
  END IF;
  IF p_person IS NOT NULL AND p_person = auth.uid() THEN
    RETURN;
  END IF;
  IF p_office_reads_anyone AND public.is_office_staff() THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'You can read your own schedule only.' USING ERRCODE = '42501';
END;
$$;

COMMENT ON FUNCTION public.schedule_read_gate(uuid, boolean) IS
  'The gate of the two schedule email reads: returns for the service role with no login, for a caller naming himself and, when p_office_reads_anyone, for the office (is_office_staff()). Raises 42501 for anyone else. Called from inside those reads only.';
REVOKE ALL ON FUNCTION public.schedule_read_gate(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_read_gate(uuid, boolean) TO service_role;

-- 2) The day's schedule email for one recipient: the service role, the office for anyone, a person for himself.
CREATE OR REPLACE FUNCTION public.list_job_schedule_blocks_for_schedule_email(p_recipient uuid, p_work_date date)
 RETURNS TABLE(id uuid, job_id uuid, assignee_user_id uuid, work_date date, time_start time without time zone, time_end time without time zone, note text, assignee_name text, job_hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Who may ask: the gate raises for anyone else, before a row is read.
  SELECT public.schedule_read_gate(p_recipient, true);

  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    -- Papers before a job opens: a job the recipient is locked out of keeps its number and its time, and nothing else.
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_recipient) THEN NULL ELSE jsb.note END,
    trim(COALESCE(u.name, '')) AS assignee_name,
    CASE WHEN jsb.bid_id IS NOT NULL
      THEN COALESCE('B' || NULLIF(b.bid_number, ''), 'Bid')
      ELSE COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
    END AS job_hcp_number,
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_recipient) THEN 'Papers to sign first' ELSE COALESCE(jl.job_name, b.project_name) END AS job_name,
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_recipient) THEN NULL ELSE COALESCE(jl.job_address, b.address) END AS job_address
  FROM public.job_schedule_blocks jsb
  LEFT JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.bids b ON b.id = jsb.bid_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date = p_work_date
    AND (
      (jsb.bid_id IS NOT NULL AND (
        jsb.assignee_user_id = p_recipient
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient
                   AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'))
      ))
      OR (jsb.job_id IS NOT NULL AND (
        jsb.assignee_user_id = p_recipient
        -- A primary is held to the jobs he is the account manager of, the rule the table holds him to
        -- (primary_scope_jobs_ledger), asked here about the named person. Every other role reads as before.
        OR ((
          jl.account_manager_user_id = p_recipient
          OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'primary')
        ) AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'dev')
        OR jl.master_user_id = p_recipient
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'primary')
        OR EXISTS (
          SELECT 1 FROM public.master_superintendents ms
          WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_recipient
        )
        OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_recipient))
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_recipient AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_recipient
        )
        OR public.assistants_share_master(p_recipient, jl.master_user_id)
        OR EXISTS (
          SELECT 1 FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jl.id AND jtm.user_id = p_recipient
        )
        ))
      ))
    )
  ORDER BY jsb.time_start ASC, jsb.assignee_user_id ASC;
$function$;

COMMENT ON FUNCTION public.list_job_schedule_blocks_for_schedule_email(uuid, date) IS
  'Dispatch schedule blocks for one calendar day as p_recipient sees them (the job_schedule_blocks SELECT rule asked about a named person). A primary named is held to the blocks assigned to him and the jobs he is the account manager of. Read by the service role, by the office for anyone, and by a signed-in person for himself (schedule_read_gate); anyone else is refused with 42501.';
REVOKE ALL ON FUNCTION public.list_job_schedule_blocks_for_schedule_email(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_schedule_blocks_for_schedule_email(uuid, date) TO authenticated, service_role;

-- 3) The shared schedule as its sender sees it: the service role, and a person for himself.
CREATE OR REPLACE FUNCTION public.list_schedule_blocks_for_share(p_viewer uuid, p_start date, p_end date)
 RETURNS TABLE(id uuid, job_id uuid, assignee_user_id uuid, work_date date, time_start time without time zone, time_end time without time zone, note text, assignee_name text, job_hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Who may ask: the gate raises for anyone else, before a row is read.
  SELECT public.schedule_read_gate(p_viewer, false);

  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    -- Papers before a job opens: a job the viewer is locked out of keeps its number and its time, and nothing else.
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_viewer) THEN NULL ELSE jsb.note END,
    trim(COALESCE(u.name, '')) AS assignee_name,
    CASE WHEN jsb.bid_id IS NOT NULL
      THEN COALESCE('B' || NULLIF(b.bid_number, ''), 'Bid')
      ELSE COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
    END AS job_hcp_number,
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_viewer) THEN 'Papers to sign first' ELSE COALESCE(jl.job_name, b.project_name) END AS job_name,
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_viewer) THEN NULL ELSE COALESCE(jl.job_address, b.address) END AS job_address
  FROM public.job_schedule_blocks jsb
  LEFT JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.bids b ON b.id = jsb.bid_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date BETWEEN p_start AND p_end
    AND (
      (jsb.bid_id IS NOT NULL AND (
        jsb.assignee_user_id = p_viewer
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer
                   AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'))
      ))
      OR (jsb.job_id IS NOT NULL AND (
        jsb.assignee_user_id = p_viewer
        -- A primary is held to the jobs he is the account manager of, the rule the table holds him to
        -- (primary_scope_jobs_ledger), asked here about the named person. Every other role reads as before.
        OR ((
          jl.account_manager_user_id = p_viewer
          OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'primary')
        ) AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'dev')
        OR jl.master_user_id = p_viewer
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'primary')
        OR EXISTS (
          SELECT 1 FROM public.master_superintendents ms
          WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_viewer
        )
        OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_viewer))
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_viewer AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_viewer
        )
        OR public.assistants_share_master(p_viewer, jl.master_user_id)
        OR EXISTS (
          SELECT 1 FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jl.id AND jtm.user_id = p_viewer
        )
        ))
      ))
    )
  ORDER BY assignee_name ASC, jsb.work_date ASC, jsb.time_start ASC;
$function$;

COMMENT ON FUNCTION public.list_schedule_blocks_for_share(uuid, date, date) IS
  'The dispatch board (all assignees) over [p_start, p_end] as p_viewer sees it (the job_schedule_blocks SELECT rule asked about a named person). A primary named is held to the blocks assigned to him and the jobs he is the account manager of. Read by the service role and by a signed-in person for himself (schedule_read_gate); anyone else is refused with 42501.';
REVOKE ALL ON FUNCTION public.list_schedule_blocks_for_share(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_schedule_blocks_for_share(uuid, date, date) TO authenticated, service_role;
