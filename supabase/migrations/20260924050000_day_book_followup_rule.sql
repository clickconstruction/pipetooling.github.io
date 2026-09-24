SET lock_timeout = '3s';

-- Day book (to-dos/day-book, v2.3800): the estimating strip's "No follow-up in 7 days"
-- counts a follow-up the way the office writes one.
--
-- The 2026-09-22 live pass read 3 of 5 for Wendi where the census hand count read 2 of 5.
-- The rule required a contact_method on the entry, because the robot pipeline's log lines
-- carry none — but neither do most human follow-ups ("touched base with them and did
-- follow up today", no method picked). So a bid the estimator wrote about the day it went
-- out was counted as never followed up. The rule now takes any entry the person or anyone
-- else wrote on the bid from the day of the first send through seven days after it,
-- leaving out only the app's own outcome-change line ("Win/Loss changed from …", written
-- by outcomeChangeBidNote.ts). An entry before the send is not a follow-up to it.
--
-- The body is 20260922190000_day_book_queue_snapshots.sql's, with only the unfollowed_n
-- predicate in strip_sent changed. No new table, so no read-only block calls.

CREATE OR REPLACE FUNCTION public.day_book_payload_for(p_uid uuid, p_from date, p_to date, p_person uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := p_uid;
  v_role text;
  v_money boolean := false;
  v_pick boolean := false;
  v_person uuid;
  v_from date;
  v_to date;
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_office_job_id uuid;
  v_prev_from date;
  v_prev_to date;
  v_est_money boolean := false;
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
  -- Owner decision 2 (2026-09-22): devs and controllers only, for now — everyone, with
  -- amounts. Every other role is refused here whatever the client shows.
  IF v_role IN ('dev', 'controller') THEN
    v_money := true;
    v_pick := true;
  ELSE
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;
  v_person := CASE WHEN v_pick THEN p_person ELSE v_uid END;
  -- The estimating strip's "was": the window of equal length before this one.
  v_prev_to := v_from - 1;
  v_prev_from := v_from - (v_to - v_from + 1);
  v_est_money := v_money OR (v_person IS NOT NULL AND v_person = v_uid);

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
    WHERE u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')
      AND COALESCE(u.is_sample, false) = false
      AND COALESCE(u.is_digital_twin, false) = false
      AND u.archived_at IS NULL
      AND (v_person IS NULL OR u.id = v_person)
  ),
  sessions AS (
    SELECT cs.user_id, cs.work_date, cs.clocked_in_at, cs.clocked_out_at, cs.bid_id,
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
    UNION ALL
    -- A bid sent: one row per send, valued at the send. Money: a payroll viewer, or the
    -- sender looking at their own bids (they see them on the Bid Board today).
    SELECT s.created_by, ((s.sent_on::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago'), 'bid_sent', 'bid', s.bid_id::text,
           CASE WHEN v_money OR s.created_by = v_uid THEN s.value ELSE NULL END,
           jsonb_build_object('bid_version_id', s.bid_version_id, 'round_label', s.round_label, 'is_alternate', s.is_alternate,
                              'gcs', (SELECT COUNT(*) FROM public.bid_gcs g WHERE g.bid_id = s.bid_id))
    FROM public.bid_version_sends s
    WHERE s.created_by IS NOT NULL AND s.sent_on BETWEEN v_from AND v_to
    UNION ALL
    -- Priced: the human touches on bid_pricing_assignments, one row per bid per day per person.
    SELECT a.updated_by, MAX(a.updated_at), 'priced', 'bid', a.bid_id::text, NULL,
           jsonb_build_object('lines', COUNT(*))
    FROM public.bid_pricing_assignments a
    WHERE a.updated_by IS NOT NULL AND a.updated_at >= v_from_ts AND a.updated_at < v_to_ts
    GROUP BY a.updated_by, a.bid_id, (a.updated_at AT TIME ZONE 'America/Chicago')::date
    UNION ALL
    SELECT b.recorded_by, b.recorded_at, 'best_effort', 'bid', b.bid_id::text,
           CASE WHEN v_money OR b.recorded_by = v_uid THEN b.value ELSE NULL END, '{}'::jsonb
    FROM public.bid_best_efforts b
    WHERE b.recorded_by IS NOT NULL AND b.recorded_at >= v_from_ts AND b.recorded_at < v_to_ts
    UNION ALL
    -- Asked a house for prices; quotes_in = quotes that came back on that RFQ (any day).
    SELECT r.created_by, COALESCE(((r.requested_on::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago'), r.created_at), 'rfq_asked', 'bid', r.bid_id::text, NULL,
           jsonb_build_object('supply_house_id', r.supply_house_id, 'quotes_in', (SELECT COUNT(*) FROM public.bid_quotes q WHERE q.rfq_id = r.id))
    FROM public.bid_rfqs r
    WHERE r.created_by IS NOT NULL AND COALESCE(r.requested_on, r.created_at::date) BETWEEN v_from AND v_to
    UNION ALL
    -- A verdict on a robot audit.
    SELECT n.author_id, n.created_at, 'audited', 'bid', n.bid_id::text, NULL,
           jsonb_build_object('audit_id', n.audit_id, 'outcome', n.digest_outcome)
    FROM public.bid_audit_notes n
    WHERE n.author_id IS NOT NULL AND n.digest_outcome IS NOT NULL
      AND n.created_at >= v_from_ts AND n.created_at < v_to_ts
    UNION ALL
    SELECT q.answered_by, q.answered_at, 'robot_answered', 'bid', q.about_bid_id::text, NULL,
           jsonb_build_object('question_id', q.id, 'kind', q.kind)
    FROM public.twin_questions q
    WHERE q.answered_by IS NOT NULL AND q.answered_at IS NOT NULL
      AND q.answered_at >= v_from_ts AND q.answered_at < v_to_ts
    UNION ALL
    -- A human follow-up with a GC (the robot pipeline's log lines carry no contact_method).
    SELECT f.created_by, f.occurred_at, 'followed_up', 'bid', f.bid_id::text, NULL,
           jsonb_build_object('contact_method', f.contact_method, 'gc_customer_id', f.gc_customer_id)
    FROM public.bids_submission_entries f
    WHERE f.created_by IS NOT NULL AND f.contact_method IS NOT NULL
      AND f.occurred_at >= v_from_ts AND f.occurred_at < v_to_ts
  ),
  -- Schedule changes (v2.3726): one row per add / move / reassign / remove on
  -- job_schedule_blocks, from the ledger the trigger above keeps. The kernel reads
  -- "Updated the schedule · N people · N blocks · Thu–Fri" off them.
  ev_schedule AS (
    SELECT sbe.actor_user_id, sbe.occurred_at AS at, 'schedule'::text AS kind,
           'job'::text AS ref_type, sbe.job_id::text AS ref_id, NULL::numeric AS amount_usd,
           jsonb_build_object('change', sbe.change, 'block_id', sbe.block_id, 'assignee_user_id', sbe.assignee_user_id,
                              'work_date', sbe.work_date, 'bid_id', sbe.bid_id) AS detail
    FROM public.schedule_block_events sbe
    WHERE sbe.actor_user_id IS NOT NULL
      AND sbe.occurred_at >= v_from_ts AND sbe.occurred_at < v_to_ts
  ),
  ev_all AS (
    SELECT * FROM ev UNION ALL SELECT * FROM ev_schedule
  ),
  scoped_ev AS (
    SELECT e.* FROM ev_all e JOIN people p ON p.id = e.actor_user_id
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
    UNION ALL
    SELECT (sbe.occurred_at AT TIME ZONE 'America/Chicago')::date, 'schedule', COUNT(*)::int
    FROM public.schedule_block_events sbe
    WHERE sbe.actor_user_id IS NULL AND sbe.occurred_at >= v_from_ts AND sbe.occurred_at < v_to_ts
    GROUP BY 1
  ),
  -- What was still waiting at the end of each day (v2.3714): reconstructed from the
  -- records' own timestamps, so history carries "N still waiting" and the Month grid
  -- can go amber. Approvals are exact — a session's clock-out, approval, rejection and
  -- revocation are all stamped. Bills, deposits and contracts keep no as-of state
  -- (an invoice's "ready" moment is not stamped; the deposit filter is a setting), so
  -- they stay live-today-only until the nightly snapshot the to-do describes.
  queue_days AS (
    SELECT d::date AS day,
           ((d::date + 1)::timestamp AT TIME ZONE 'America/Chicago') AS end_ts
    FROM generate_series(v_from, LEAST(v_to, (now() AT TIME ZONE 'America/Chicago')::date), interval '1 day') AS d
  ),
  queue AS (
    SELECT qd.day, 'approvals'::text AS kind,
           (SELECT COUNT(*)::int FROM public.clock_sessions cs
             WHERE cs.clocked_out_at IS NOT NULL AND cs.clocked_out_at < qd.end_ts
               AND (cs.approved_at IS NULL OR cs.approved_at >= qd.end_ts)
               AND (cs.rejected_at IS NULL OR cs.rejected_at >= qd.end_ts)
               AND (cs.revoked_at IS NULL OR cs.revoked_at >= qd.end_ts)) AS n
    FROM queue_days qd
    UNION ALL
    -- What a dev or controller's Dashboard counted that day (decision 6, v2.3736): the
    -- Needs You card's own figures for deposits to match, jobs without a contract and
    -- bills to send, written once a day by record_day_book_queue. A day nobody looked
    -- has no row and stays unknown.
    SELECT s.day, s.kind, s.n
    FROM public.day_book_queue_snapshots s
    WHERE s.day BETWEEN v_from AND v_to AND s.kind IN ('deposits', 'contracts', 'billing')
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
  ),
  ref_bids AS (
    SELECT DISTINCT b.id, b.bid_number, b.project_name
    FROM public.bids b
    WHERE b.id::text IN (SELECT ref_id FROM scoped_ev WHERE ref_type = 'bid')
       OR b.id IN (SELECT s.bid_id FROM sessions s WHERE s.bid_id IS NOT NULL)
  ),
  strip_sent AS (
    SELECT w.win, COUNT(DISTINCT s.bid_id) AS sent_n,
           SUM(CASE WHEN v_est_money THEN ls.value END) AS sent_usd,
           COUNT(DISTINCT s.bid_id) FILTER (WHERE fs.first_sent > b.bid_due_date) AS late_n,
           COUNT(DISTINCT s.bid_id) FILTER (
             WHERE (b.outcome IS NULL OR b.outcome IN ('open', 'pending'))
               -- v2.3800: any entry written on the bid from the first send through seven
               -- days after counts as the follow-up (a method is rarely picked); the app's
               -- own outcome-change line (outcomeChangeBidNote.ts) is not one.
               AND NOT EXISTS (SELECT 1 FROM public.bids_submission_entries f
                               WHERE f.bid_id = s.bid_id
                                 AND (f.occurred_at AT TIME ZONE 'America/Chicago')::date BETWEEN fs.first_sent AND fs.first_sent + 7
                                 AND COALESCE(f.notes, '') NOT LIKE 'Win/Loss changed from %')
               AND fs.first_sent + 7 < (now() AT TIME ZONE 'America/Chicago')::date) AS unfollowed_n
    FROM (VALUES ('now', v_from, v_to), ('was', v_prev_from, v_prev_to)) AS w(win, f, t)
    JOIN public.bid_version_sends s ON s.created_by = v_person AND s.sent_on BETWEEN w.f AND w.t
    JOIN public.bids b ON b.id = s.bid_id
    JOIN LATERAL (SELECT MIN(s2.sent_on) AS first_sent FROM public.bid_version_sends s2 WHERE s2.bid_id = s.bid_id) fs ON true
    JOIN LATERAL (SELECT s3.value FROM public.bid_version_sends s3 WHERE s3.bid_id = s.bid_id ORDER BY s3.sent_on DESC, s3.created_at DESC LIMIT 1) ls ON true
    GROUP BY w.win
  ),
  strip_decided AS (
    SELECT w.win,
           COUNT(*) FILTER (WHERE b.outcome IN ('won', 'started_or_complete', 'signed')) AS won_n,
           COUNT(*) FILTER (WHERE b.outcome = 'lost') AS lost_n,
           SUM(CASE WHEN v_est_money AND b.outcome IN ('won', 'started_or_complete', 'signed') THEN b.bid_value END) AS won_usd,
           SUM(CASE WHEN v_est_money AND b.outcome = 'lost' THEN b.bid_value END) AS lost_usd,
           COUNT(*) FILTER (WHERE b.outcome = 'lost' AND b.loss_category IS NULL
                              AND NOT EXISTS (SELECT 1 FROM public.bid_versions v WHERE v.bid_id = b.id AND v.loss_category IS NOT NULL)) AS lost_no_reason_n
    FROM (VALUES ('now', v_from, v_to), ('was', v_prev_from, v_prev_to)) AS w(win, f, t)
    JOIN public.bids b ON b.estimator_id = v_person AND b.outcome_at IS NOT NULL
      AND (b.outcome_at AT TIME ZONE 'America/Chicago')::date BETWEEN w.f AND w.t
    GROUP BY w.win
  ),
  -- Hit rate by value over the 90 days ending at the window's end (the bidCostToWin rule).
  strip_hit AS (
    SELECT w.win,
           SUM(b.bid_value) FILTER (WHERE b.outcome IN ('won', 'started_or_complete', 'signed')) AS won_usd,
           SUM(b.bid_value) FILTER (WHERE b.outcome = 'lost') AS lost_usd,
           COUNT(*) AS decided_n
    FROM (VALUES ('now', v_to), ('was', v_prev_to)) AS w(win, t)
    JOIN public.bids b ON b.estimator_id = v_person AND b.outcome_at IS NOT NULL
      AND b.outcome IN ('won', 'started_or_complete', 'signed', 'lost')
      AND (b.outcome_at AT TIME ZONE 'America/Chicago')::date BETWEEN w.t - 89 AND w.t
    GROUP BY w.win
  ),
  strip_rfq AS (
    SELECT w.win, COUNT(*) AS asks_n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY (EXTRACT(EPOCH FROM (q.received_at - (r.requested_on::timestamp AT TIME ZONE 'America/Chicago'))) / 86400.0)::double precision) AS median_days
    FROM (VALUES ('now', v_from, v_to), ('was', v_prev_from, v_prev_to)) AS w(win, f, t)
    JOIN public.bid_rfqs r ON r.created_by = v_person AND r.requested_on BETWEEN w.f AND w.t
    LEFT JOIN LATERAL (SELECT MIN(q1.received_at) AS received_at FROM public.bid_quotes q1 WHERE q1.rfq_id = r.id) q ON true
    GROUP BY w.win
  ),
  strip_robot AS (
    SELECT w.win, COUNT(*) AS runs_n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY tr.delta_pct::double precision) AS median_delta
    FROM (VALUES ('now', v_from, v_to), ('was', v_prev_from, v_prev_to)) AS w(win, f, t)
    JOIN public.twin_shadow_runs tr ON tr.scored_at IS NOT NULL AND tr.delta_pct IS NOT NULL
      AND (tr.scored_at AT TIME ZONE 'America/Chicago')::date BETWEEN w.f AND w.t
    JOIN public.bids rb ON rb.id = tr.reference_bid_id AND rb.estimator_id = v_person
    GROUP BY w.win
  ),
  strip_hours AS (
    SELECT w.win, COALESCE(SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0), 0) AS bid_hours
    FROM (VALUES ('now', v_from, v_to), ('was', v_prev_from, v_prev_to)) AS w(win, f, t)
    LEFT JOIN public.clock_sessions cs ON cs.user_id = v_person AND cs.bid_id IS NOT NULL AND cs.job_ledger_id IS NULL
      AND cs.clocked_out_at IS NOT NULL AND cs.revoked_at IS NULL AND cs.rejected_at IS NULL
      AND cs.work_date BETWEEN w.f AND w.t
    GROUP BY w.win
  )
  SELECT jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'viewer', jsonb_build_object('can_see_money', v_money, 'can_pick_person', v_pick, 'user_id', v_uid),
    'users', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role) ORDER BY p.name) FROM people p), '[]'::jsonb),
    'jobs', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', j.id, 'hcp_number', j.hcp_number, 'click_number', j.click_number, 'job_name', j.job_name)) FROM ref_jobs j), '[]'::jsonb),
    'ref_people', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name)) FROM ref_people r), '[]'::jsonb),
    'bids', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'bid_number', b.bid_number, 'project_name', b.project_name)) FROM ref_bids b), '[]'::jsonb),
    'sessions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'user_id', s.user_id, 'work_date', s.work_date, 'clocked_in_at', s.clocked_in_at,
        'clocked_out_at', s.clocked_out_at, 'on_bid', s.on_bid, 'bid_id', s.bid_id, 'note', s.note) ORDER BY s.clocked_in_at) FROM sessions s), '[]'::jsonb),
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'actor_user_id', e.actor_user_id, 'at', e.at,
        'day', (e.at AT TIME ZONE 'America/Chicago')::date,
        'kind', e.kind, 'ref_type', e.ref_type, 'ref_id', e.ref_id,
        'amount_usd', e.amount_usd, 'detail', e.detail) ORDER BY e.at) FROM scoped_ev e), '[]'::jsonb),
    'system_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', s.day, 'kind', s.kind, 'n', s.n) ORDER BY s.day) FROM sys s), '[]'::jsonb),
    'queue', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', q.day, 'kind', q.kind, 'n', q.n) ORDER BY q.day) FROM queue q), '[]'::jsonb),
    -- The estimating strip (v2.3727): only for one picked person; each measure twice,
    -- this window and the one before it. Values NULL when the viewer may not see money.
    'estimating', CASE WHEN v_person IS NULL THEN NULL ELSE jsonb_build_object(
      'person', v_person, 'money', v_est_money,
      'prev_from', v_prev_from, 'prev_to', v_prev_to,
      'windows', (SELECT jsonb_object_agg(w.win, jsonb_build_object(
          'sent_n', COALESCE(ss.sent_n, 0), 'sent_usd', ss.sent_usd, 'late_n', COALESCE(ss.late_n, 0), 'unfollowed_n', COALESCE(ss.unfollowed_n, 0),
          'won_n', COALESCE(sd.won_n, 0), 'lost_n', COALESCE(sd.lost_n, 0), 'won_usd', sd.won_usd, 'lost_usd', sd.lost_usd, 'lost_no_reason_n', COALESCE(sd.lost_no_reason_n, 0),
          'hit_won_usd', CASE WHEN v_est_money THEN sh.won_usd END, 'hit_lost_usd', CASE WHEN v_est_money THEN sh.lost_usd END,
          'hit_rate', CASE WHEN COALESCE(sh.won_usd, 0) + COALESCE(sh.lost_usd, 0) > 0 THEN ROUND(COALESCE(sh.won_usd, 0) / (COALESCE(sh.won_usd, 0) + COALESCE(sh.lost_usd, 0)), 4) END,
          'hit_decided_n', COALESCE(sh.decided_n, 0),
          'rfq_asks_n', COALESCE(sr.asks_n, 0), 'rfq_median_days', sr.median_days,
          'robot_runs_n', COALESCE(sb.runs_n, 0), 'robot_median_delta', sb.median_delta,
          'bid_hours', COALESCE(sho.bid_hours, 0)))
        FROM (VALUES ('now'), ('was')) AS w(win)
        LEFT JOIN strip_sent ss ON ss.win = w.win
        LEFT JOIN strip_decided sd ON sd.win = w.win
        LEFT JOIN strip_hit sh ON sh.win = w.win
        LEFT JOIN strip_rfq sr ON sr.win = w.win
        LEFT JOIN strip_robot sb ON sb.win = w.win
        LEFT JOIN strip_hours sho ON sho.win = w.win)
    ) END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

