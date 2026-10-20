-- An estimator's job draft (punch list #129 follow-up, migration *_job_draft): list_bid_jobs_opened answers an
-- estimator and the office with the jobs each bid opened, newest first, and a primary, a helper and nobody with none;
-- an estimator's Dispatch request carries its draft in pending_payload, the estimator reads it back, Dispatch's
-- reader (a dev) reads it, and another estimator does not. Everything rolls back. Raises on the first failed
-- assertion; ends with "bid_jobs_opened PASSED". See scripts/pgtest-bid-jobs-opened.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Wendi and Kim (estimators), Rosa (assistant), Luis (primary), Marcus (helper), Dee (dev), Mo (the master).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000eaa01', 'wendi@opened.test'),
  ('00000000-0000-0000-0000-0000000eaa02', 'kim@opened.test'),
  ('00000000-0000-0000-0000-0000000eaa03', 'rosa@opened.test'),
  ('00000000-0000-0000-0000-0000000eaa04', 'luis@opened.test'),
  ('00000000-0000-0000-0000-0000000eaa06', 'marcus@opened.test'),
  ('00000000-0000-0000-0000-0000000eaa07', 'mo@opened.test'),
  ('00000000-0000-0000-0000-0000000eaa08', 'dee@opened.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000eaa01', 'wendi@opened.test', 'Opened Wendi', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000eaa02', 'kim@opened.test', 'Opened Kim', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000eaa03', 'rosa@opened.test', 'Opened Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000eaa04', 'luis@opened.test', 'Opened Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000eaa06', 'marcus@opened.test', 'Opened Marcus', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000eaa07', 'mo@opened.test', 'Opened Mo', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000eaa08', 'dee@opened.test', 'Opened Dee', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000eab01', 'Opened Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000eac01', '00000000-0000-0000-0000-0000000eaa07', 'Southern Post');
-- B1 (Wendi's) opened two jobs; B2 (Kim's) none.
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000ead01', '00000000-0000-0000-0000-0000000eaa03', '00000000-0000-0000-0000-0000000eaa01', '00000000-0000-0000-0000-0000000eab01', 'Take 5 Seguin', '00000000-0000-0000-0000-0000000eac01'),
  ('00000000-0000-0000-0000-0000000ead02', '00000000-0000-0000-0000-0000000eaa03', '00000000-0000-0000-0000-0000000eaa02', '00000000-0000-0000-0000-0000000eab01', 'Park water heater', '00000000-0000-0000-0000-0000000eac01');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, click_number, job_name, customer_name, bill_to_party, revenue, payments_made, status, bid_id, created_at) VALUES
  ('00000000-0000-0000-0000-0000000eaf01', '00000000-0000-0000-0000-0000000eaa07', '00000000-0000-0000-0000-0000000eab01', '878', '', 'Take 5- Seguin', 'Southern Post', 'gc', 38625, 0, 'billed', '00000000-0000-0000-0000-0000000ead01', '2026-06-25T18:35:00Z'),
  ('00000000-0000-0000-0000-0000000eaf02', '00000000-0000-0000-0000-0000000eaa07', '00000000-0000-0000-0000-0000000eab01', '', '1085', 'Take 5- Seguin phase 2', 'Southern Post', 'gc', 0, 0, 'waiting', '00000000-0000-0000-0000-0000000ead01', '2026-10-20T15:00:00Z');

CREATE SCHEMA bjo;
CREATE FUNCTION bjo.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bjo.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The jobs both bids opened, as the signed-in person reads them: "B1 878/; B1 /1085" newest first, or "none".
CREATE FUNCTION bjo.opened() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg('B' || right(o.bid_id::text, 1) || ' ' || coalesce(o.hcp_number, '') || '/' || coalesce(o.click_number, ''), '; ' ORDER BY o.created_at DESC)
    FROM public.list_bid_jobs_opened(ARRAY['00000000-0000-0000-0000-0000000ead01', '00000000-0000-0000-0000-0000000ead02']::uuid[]) o), 'none')
$$;
-- The drafts the signed-in person reads on open_job_from_bid requests: "Take 5 Seguin 38625" or "none".
CREATE FUNCTION bjo.drafts() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg((r.pending_payload->'job_draft'->>'jobName') || ' ' || (r.pending_payload->'job_draft'->>'carry'), '; ')
    FROM public.dispatch_requests r WHERE r.pending_action = 'open_job_from_bid' AND r.pending_payload ? 'job_draft'), 'none')
$$;
GRANT USAGE ON SCHEMA bjo TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bjo TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

SELECT bjo.as_user('00000000-0000-0000-0000-0000000eaa01');
SELECT bjo.same('Wendi, who reads no job row, reads the jobs her bid opened, newest first', bjo.opened(), 'B1 /1085; B1 878/');
SELECT bjo.same('... and no jobs_ledger row of her own', (SELECT count(*)::text FROM public.jobs_ledger WHERE bid_id = '00000000-0000-0000-0000-0000000ead01'), '0');
SELECT bjo.as_user('00000000-0000-0000-0000-0000000eaa02');
SELECT bjo.same('Kim, another estimator, reads them too (the job-accounts strip''s audience)', bjo.opened(), 'B1 /1085; B1 878/');
SELECT bjo.as_user('00000000-0000-0000-0000-0000000eaa03');
SELECT bjo.same('Rosa, the office, reads them', bjo.opened(), 'B1 /1085; B1 878/');
SELECT bjo.as_user('00000000-0000-0000-0000-0000000eaa04');
SELECT bjo.same('Luis, a primary, gets none from the function (his own policies answer him)', bjo.opened(), 'none');
SELECT bjo.as_user('00000000-0000-0000-0000-0000000eaa06');
SELECT bjo.same('Marcus, a helper, gets none', bjo.opened(), 'none');
SELECT bjo.as_user(NULL);
SELECT bjo.same('nobody signed in gets none', bjo.opened(), 'none');

-- The draft rides the request.
SELECT bjo.as_user('00000000-0000-0000-0000-0000000eaa01');
INSERT INTO public.dispatch_requests (from_user_id, title, bid_id, pending_action, pending_payload) VALUES
  ('00000000-0000-0000-0000-0000000eaa01', 'Open the job for B2 · Park water heater — won with Southern Post', '00000000-0000-0000-0000-0000000ead02', 'open_job_from_bid',
   '{"job_draft": {"v": 1, "jobName": "Take 5 Seguin", "address": "380 TX-123", "gcKey": "", "gcName": "Southern Post", "carry": 38625, "serviceTypeId": null, "wantedBy": "2026-10-30", "note": "Slab pour is the 3rd"}}'::jsonb);
SELECT bjo.same('Wendi files a request with her draft and reads it back', bjo.drafts(), 'Take 5 Seguin 38625');
SELECT bjo.as_user('00000000-0000-0000-0000-0000000eaa02');
SELECT bjo.same('Kim does not read Wendi''s request', bjo.drafts(), 'none');
SELECT bjo.as_user('00000000-0000-0000-0000-0000000eaa08');
SELECT bjo.same('Dee, a dev, reads it for Dispatch', bjo.drafts(), 'Take 5 Seguin 38625');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'bid_jobs_opened PASSED'; END $$;
ROLLBACK;
