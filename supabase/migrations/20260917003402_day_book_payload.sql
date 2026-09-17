SET lock_timeout = '3s';

-- Day book (to-dos/day-book, PR 1+2): one read for People → Day book.
--
-- What each office person got done on each day of a range, read from the records
-- the app already stamps with the actor — never typed. One SECURITY DEFINER read,
-- gated the way the Crew Day payload is (inline role check on auth.uid()), that
-- returns raw rows in one shape; the client kernel (src/lib/people/dayBook.ts)
-- turns them into lines. Sources and the attribution facts behind each are in
-- to-dos/day-book/README.md → "What exists versus what is new".
--
-- Money rule: dev, controller and pay-approved masters (is_dev() OR
-- has_payroll_access()) may pick any person and see amounts. Assistants,
-- masters without pay approval and estimators see only themselves, and every
-- amount is emitted as NULL — the client never receives a figure it may not show.
--
-- Population: users whose role is dev / master_technician / assistant / controller
-- (the Crew Day "office" set, isCrewDayOfficeRole) — the people whose day the
-- office job records. Estimator lines and the estimator role join in PR 4.
--
-- System rows: an event with no actor (a service-role edge function or a backfill
-- wrote it — 60 % of invoice_sent rows are the Stripe / email send functions) is
-- nobody's outcome. They are not attributed; the payload counts them per day so the
-- tab can say "and 3 more by the system". The office's own billing act is
-- invoice_billed ("Marked billed"), which IS attributed (105 of 106 in the census).
--
-- No new table, no new index: the 30-day census read 4k activity rows, so a range
-- scan is cheap; indexes come when EXPLAIN says so. No read-only-block calls needed.

CREATE OR REPLACE FUNCTION public.get_day_book_payload(p_from date, p_to date, p_person uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_money boolean := false;
  v_pick boolean := false;
  v_person uuid;
  v_from date;
  v_to date;
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_office_job_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RETURN jsonb_build_object('error', 'range_required');
  END IF;
  v_from := LEAST(p_from, p_to);
  v_to := GREATEST(p_from, p_to);
  IF v_to - v_from > 92 THEN
    RETURN jsonb_build_object('error', 'range_too_long');
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;
  IF public.is_dev() OR public.has_payroll_access() THEN
    v_money := true;
    v_pick := true;
  ELSIF v_role IN ('master_technician', 'assistant', 'estimator') THEN
    v_money := false;
    v_pick := false;
  ELSE
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  v_person := CASE WHEN v_pick THEN p_person ELSE v_uid END;

  -- Company-calendar day boundaries as instants (the Crew Day convention:
  -- a row belongs to the Chicago date its timestamp falls on).
  v_from_ts := (v_from::timestamp AT TIME ZONE 'America/Chicago');
  v_to_ts := ((v_to + 1)::timestamp AT TIME ZONE 'America/Chicago');

  -- Canonical Office job: the People → Overhead setting, else the HCP-000 /
  -- name heuristic (same fallback order the rest of the app uses).
  SELECT NULLIF(TRIM(s.value_text), '')::uuid INTO v_office_job_id
  FROM public.app_settings s
  WHERE s.key = 'overhead_office_job_ledger_id_v1'
    AND EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = NULLIF(TRIM(s.value_text), '')::uuid);
  IF v_office_job_id IS NULL THEN
    SELECT o.id INTO v_office_job_id FROM public.get_jobs_ledger_office() o LIMIT 1;
  END IF;

  WITH people AS (
    SELECT u.id, u.name, u.role
    FROM public.users u
    WHERE u.role IN ('dev', 'master_technician', 'assistant', 'controller')
      AND (v_person IS NULL OR u.id = v_person)
  ),
  sessions AS (
    SELECT cs.user_id, cs.work_date, cs.clocked_in_at, cs.clocked_out_at,
           (cs.job_ledger_id IS NULL AND cs.bid_id IS NOT NULL) AS on_bid,
           COALESCE(cs.notes, '') AS note
    FROM public.clock_sessions cs
    JOIN people p ON p.id = cs.user_id
    WHERE cs.work_date BETWEEN v_from AND v_to
      AND cs.revoked_at IS NULL
      AND cs.rejected_at IS NULL
      AND ((v_office_job_id IS NOT NULL AND cs.job_ledger_id = v_office_job_id)
           OR (cs.job_ledger_id IS NULL AND cs.bid_id IS NOT NULL))
  ),
  -- Every attributed outcome in one shape. ref_type/ref_id/ref_label name what
  -- the line points at; amount_usd is NULL unless the viewer may see money.
  ev AS (
    -- The office's billing act: "Marked billed" (attributed at the trigger).
    SELECT e.actor_user_id, e.occurred_at AS at, 'billed'::text AS kind,
           'job'::text AS ref_type, e.job_id::text AS ref_id,
           CASE WHEN v_money THEN i.amount ELSE NULL END AS amount_usd,
           jsonb_build_object('invoice_id', e.detail ->> 'invoice_id', 'via', 'billed') AS detail
    FROM public.job_activity_events e
    LEFT JOIN public.jobs_ledger_invoices i ON i.id = (e.detail ->> 'invoice_id')::uuid
    WHERE e.event_type = 'invoice_billed' AND e.actor_user_id IS NOT NULL
      AND e.occurred_at >= v_from_ts AND e.occurred_at < v_to_ts
    UNION ALL
    -- A send that a person made in the app (HousecallPro channel today). The
    -- kernel dedupes billed + sent on the same invoice into one.
    SELECT e.actor_user_id, e.occurred_at, 'billed', 'job', e.job_id::text,
           CASE WHEN v_money THEN i.amount ELSE NULL END,
           jsonb_build_object('invoice_id', e.detail ->> 'invoice_id', 'via', 'sent', 'channel', e.detail ->> 'channel')
    FROM public.job_activity_events e
    LEFT JOIN public.jobs_ledger_invoices i ON i.id = (e.detail ->> 'invoice_id')::uuid
    WHERE e.event_type = 'invoice_sent' AND e.actor_user_id IS NOT NULL
      AND e.occurred_at >= v_from_ts AND e.occurred_at < v_to_ts
    UNION ALL
    -- A payment recorded: a bank deposit when the row carries a Mercury id.
    SELECT e.actor_user_id, e.occurred_at,
           CASE WHEN pm.mercury_transaction_id IS NOT NULL THEN 'deposit' ELSE 'payment' END,
           'job', e.job_id::text,
           CASE WHEN v_money THEN NULLIF(e.detail ->> 'amount', '')::numeric ELSE NULL END,
           jsonb_build_object('payment_type', e.detail ->> 'payment_type', 'mercury_transaction_id', pm.mercury_transaction_id)
    FROM public.job_activity_events e
    LEFT JOIN public.jobs_ledger_payments pm ON pm.id = (e.detail ->> 'source_id')::uuid
    WHERE e.event_type = 'payment_added' AND e.actor_user_id IS NOT NULL
      AND e.occurred_at >= v_from_ts AND e.occurred_at < v_to_ts
    UNION ALL
    SELECT e.actor_user_id, e.occurred_at, 'status', 'job', e.job_id::text, NULL,
           jsonb_build_object('from', e.detail ->> 'from', 'to', e.detail ->> 'to')
    FROM public.job_activity_events e
    WHERE e.event_type = 'status_change' AND e.actor_user_id IS NOT NULL
      AND e.occurred_at >= v_from_ts AND e.occurred_at < v_to_ts
    UNION ALL
    SELECT ce.actor_user_id, ce.occurred_at,
           CASE WHEN ce.event_type = 'sent' THEN 'contract_sent' ELSE 'contract_filed' END,
           'job', jc.job_id::text, NULL,
           jsonb_build_object('contract_id', ce.contract_id)
    FROM public.job_contract_events ce
    JOIN public.job_contracts jc ON jc.id = ce.contract_id
    WHERE ce.event_type IN ('sent', 'recorded') AND ce.actor_user_id IS NOT NULL
      AND ce.occurred_at >= v_from_ts AND ce.occurred_at < v_to_ts
    UNION ALL
    -- Clock-session approvals: one row per approved session, pointing at the
    -- person whose time it was; the kernel counts sessions, people and hours.
    SELECT cs.approved_by, cs.approved_at, 'approval', 'person', cs.user_id::text, NULL,
           jsonb_build_object('hours', ROUND((EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0)::numeric, 2))
    FROM public.clock_sessions cs
    WHERE cs.approved_by IS NOT NULL AND cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at >= v_from_ts AND cs.approved_at < v_to_ts
    UNION ALL
    SELECT hr.reviewed_by, hr.reviewed_at, 'hours_reviewed', 'person_name', hr.person_name, NULL,
           jsonb_build_object('start_date', hr.start_date, 'end_date', hr.end_date)
    FROM public.hours_reviewed hr
    WHERE hr.reviewed_by IS NOT NULL
      AND hr.reviewed_at >= v_from_ts AND hr.reviewed_at < v_to_ts
    UNION ALL
    SELECT dr.closed_by_user_id, dr.closed_at, 'dispatch_answered', 'dispatch_request', dr.id::text, NULL,
           jsonb_build_object('status', dr.status)
    FROM public.dispatch_requests dr
    WHERE dr.closed_by_user_id IS NOT NULL AND dr.closed_at IS NOT NULL
      AND dr.closed_at >= v_from_ts AND dr.closed_at < v_to_ts
    UNION ALL
    -- Deletions are aggregated per person, day and table (a bulk delete is one act,
    -- and the census saw ~1,000 rows in nine days); the kernel sums detail.n.
    SELECT da.deleted_by, MAX(da.deleted_at), 'deleted', 'table', da.table_name, NULL,
           jsonb_build_object('n', COUNT(*), 'restored_n', COUNT(*) FILTER (WHERE da.restored_at IS NOT NULL))
    FROM public.deleted_records_archive da
    WHERE da.deleted_by IS NOT NULL
      AND da.deleted_at >= v_from_ts AND da.deleted_at < v_to_ts
    GROUP BY da.deleted_by, (da.deleted_at AT TIME ZONE 'America/Chicago')::date, da.table_name
  ),
  scoped_ev AS (
    SELECT e.* FROM ev e JOIN people p ON p.id = e.actor_user_id
  ),
  -- Outcomes nobody on the tab did: written under the service role or by a backfill.
  sys AS (
    SELECT (e.occurred_at AT TIME ZONE 'America/Chicago')::date AS day,
           CASE e.event_type WHEN 'invoice_sent' THEN 'billed' WHEN 'payment_added' THEN 'payment' ELSE 'status' END AS kind,
           COUNT(*)::int AS n
    FROM public.job_activity_events e
    WHERE e.actor_user_id IS NULL
      AND e.event_type IN ('invoice_sent', 'payment_added', 'status_change')
      AND e.occurred_at >= v_from_ts AND e.occurred_at < v_to_ts
    GROUP BY 1, 2
  ),
  ref_jobs AS (
    SELECT DISTINCT jl.id, jl.hcp_number, jl.click_number, jl.job_name
    FROM public.jobs_ledger jl
    WHERE jl.id::text IN (SELECT ref_id FROM scoped_ev WHERE ref_type = 'job')
  ),
  ref_people AS (
    SELECT DISTINCT u.id, u.name
    FROM public.users u
    WHERE u.id::text IN (SELECT ref_id FROM scoped_ev WHERE ref_type = 'person')
  )
  SELECT jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'viewer', jsonb_build_object('can_see_money', v_money, 'can_pick_person', v_pick, 'user_id', v_uid),
    'users', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role) ORDER BY p.name) FROM people p), '[]'::jsonb),
    'jobs', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', j.id, 'hcp_number', j.hcp_number, 'click_number', j.click_number, 'job_name', j.job_name)) FROM ref_jobs j), '[]'::jsonb),
    'ref_people', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name)) FROM ref_people r), '[]'::jsonb),
    'sessions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'user_id', s.user_id, 'work_date', s.work_date, 'clocked_in_at', s.clocked_in_at,
        'clocked_out_at', s.clocked_out_at, 'on_bid', s.on_bid, 'note', s.note) ORDER BY s.clocked_in_at) FROM sessions s), '[]'::jsonb),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'actor_user_id', e.actor_user_id, 'at', e.at,
        'day', (e.at AT TIME ZONE 'America/Chicago')::date,
        'kind', e.kind, 'ref_type', e.ref_type, 'ref_id', e.ref_id,
        'amount_usd', e.amount_usd, 'detail', e.detail) ORDER BY e.at) FROM scoped_ev e), '[]'::jsonb),
    'system_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', s.day, 'kind', s.kind, 'n', s.n) ORDER BY s.day) FROM sys s), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_day_book_payload(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_day_book_payload(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_day_book_payload(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_day_book_payload(date, date, uuid) TO service_role;
