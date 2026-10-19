-- The job's people (punch list #129 PR 1, migration *_job_people): is_job_people answers true for the office, the
-- job's account manager and the bid's estimator or account manager, and false for a stranger, an estimator on another
-- bid, a helper on the team and nobody signed in; the estimator writes a promise on their job with heard_by
-- themselves, is refused in words on another's, reads their job's promises and no other job's, voids their own and
-- the office's on the job, clears the board's date, and still gets NULL from the company-wide read; the primary who
-- is the job's account manager writes too, a primary who is not is refused. Everything rolls back. Raises on the first
-- failed assertion; ends with "job_people PASSED". See scripts/pgtest-job-people.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Theo (estimator, bid B1), Kim (estimator, bid B2's estimator and account manager), Rosa (assistant), Luis (primary,
-- J1's and J3's account manager), Pat (primary on nothing), Marcus (helper on J1's team), Mo (the master the customer
-- belongs to, since a customer's master must be a master or a dev).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e4a01', 'theo@people.test'),
  ('00000000-0000-0000-0000-0000000e4a02', 'kim@people.test'),
  ('00000000-0000-0000-0000-0000000e4a03', 'rosa@people.test'),
  ('00000000-0000-0000-0000-0000000e4a04', 'luis@people.test'),
  ('00000000-0000-0000-0000-0000000e4a05', 'pat@people.test'),
  ('00000000-0000-0000-0000-0000000e4a06', 'marcus@people.test'),
  ('00000000-0000-0000-0000-0000000e4a07', 'mo@people.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e4a01', 'theo@people.test', 'People Theo', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e4a02', 'kim@people.test', 'People Kim', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e4a03', 'rosa@people.test', 'People Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e4a04', 'luis@people.test', 'People Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000e4a05', 'pat@people.test', 'People Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000e4a06', 'marcus@people.test', 'People Marcus', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000e4a07', 'mo@people.test', 'People Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000e4b01', 'People Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000e4c01', '00000000-0000-0000-0000-0000000e4a07', 'Dana Whitfield');

-- B1 is Theo's bid; B2 is Kim's, Kim its account manager too.
INSERT INTO public.bids (id, created_by, estimator_id, account_manager_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000e4d01', '00000000-0000-0000-0000-0000000e4a03', '00000000-0000-0000-0000-0000000e4a01', NULL, '00000000-0000-0000-0000-0000000e4b01', 'Whitfield repipe', '00000000-0000-0000-0000-0000000e4c01'),
  ('00000000-0000-0000-0000-0000000e4d02', '00000000-0000-0000-0000-0000000e4a03', '00000000-0000-0000-0000-0000000e4a02', '00000000-0000-0000-0000-0000000e4a02', '00000000-0000-0000-0000-0000000e4b01', 'Park water heater', '00000000-0000-0000-0000-0000000e4c01');

-- J1 came from B1 with Luis as its account manager; J2 from B2; J3 from no bid, Luis its account manager.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, bid_id, account_manager_user_id, account_manager_relationship) VALUES
  ('00000000-0000-0000-0000-0000000e4f01', '00000000-0000-0000-0000-0000000e4a07', '00000000-0000-0000-0000-0000000e4b01', '1032', 'Whitfield repipe', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e4c01', 'customer', 4200, 0, 'billed', '00000000-0000-0000-0000-0000000e4d01', '00000000-0000-0000-0000-0000000e4a04', 'primary'),
  ('00000000-0000-0000-0000-0000000e4f02', '00000000-0000-0000-0000-0000000e4a07', '00000000-0000-0000-0000-0000000e4b01', '1040', 'Park water heater', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e4c01', 'customer', 2900, 0, 'billed', '00000000-0000-0000-0000-0000000e4d02', NULL, NULL),
  ('00000000-0000-0000-0000-0000000e4f03', '00000000-0000-0000-0000-0000000e4a07', '00000000-0000-0000-0000-0000000e4b01', '1037', 'Ortega gas line', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e4c01', 'customer', 4800, 0, 'billed', NULL, '00000000-0000-0000-0000-0000000e4a04', 'primary');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000e4f01', '00000000-0000-0000-0000-0000000e4a04'),
  ('00000000-0000-0000-0000-0000000e4f01', '00000000-0000-0000-0000-0000000e4a06'),
  ('00000000-0000-0000-0000-0000000e4f03', '00000000-0000-0000-0000-0000000e4a04');

CREATE SCHEMA jpp;
CREATE FUNCTION jpp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jpp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION jpp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The three jobs' answers as the signed-in person: "J1 t, J2 f, J3 f".
CREATE FUNCTION jpp.people() RETURNS text LANGUAGE sql AS $$
  SELECT 'J1 ' || left(public.is_job_people('00000000-0000-0000-0000-0000000e4f01')::text, 1)
      || ', J2 ' || left(public.is_job_people('00000000-0000-0000-0000-0000000e4f02')::text, 1)
      || ', J3 ' || left(public.is_job_people('00000000-0000-0000-0000-0000000e4f03')::text, 1)
$$;
-- One job's live promises as the signed-in person: "Oct 25 by text, Dana, heard by People Theo; …" or "NULL".
CREATE FUNCTION jpp.promises(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg(to_char((e->>'promisedYmd')::date, 'Mon DD') || ' by ' || (e->>'channel') || ', ' || (e->>'saidBy') || ', heard by ' || (e->>'heardByName'), '; ' ORDER BY e->>'createdAt' DESC)
    FROM jsonb_array_elements(public.list_job_payment_promises_for(p_job)) e), 'NULL')
$$;
-- The rows themselves are the dev's alone under RLS (job_payment_promises, job_promised_pay_dates), so the bed reads
-- them through definer helpers, as the app reads them through its functions.
CREATE FUNCTION jpp.heard(p_job uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT u.name || ' / ' || p.source FROM public.job_payment_promises p JOIN public.users u ON u.id = p.heard_by
  WHERE p.job_id = p_job AND p.voided_at IS NULL ORDER BY p.created_at LIMIT 1
$$;
CREATE FUNCTION jpp.board(p_job uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT promised_date::text FROM public.job_promised_pay_dates WHERE job_id = p_job
$$;
CREATE FUNCTION jpp.pid(p_job uuid, p_date date) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.job_payment_promises WHERE job_id = p_job AND promised_date = p_date AND voided_at IS NULL LIMIT 1
$$;
GRANT USAGE ON SCHEMA jpp TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jpp TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Who the job's people are.
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a01');
SELECT jpp.same('Theo, the estimator of B1, is J1''s and no other job''s', jpp.people(), 'J1 t, J2 f, J3 f');
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a02');
SELECT jpp.same('Kim, B2''s estimator and account manager, is J2''s', jpp.people(), 'J1 f, J2 t, J3 f');
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a03');
SELECT jpp.same('Rosa, the office, is every job''s', jpp.people(), 'J1 t, J2 t, J3 t');
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a04');
SELECT jpp.same('Luis, the account manager on J1 and J3, is theirs', jpp.people(), 'J1 t, J2 f, J3 t');
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a05');
SELECT jpp.same('Pat, a primary on nothing, is nobody''s', jpp.people(), 'J1 f, J2 f, J3 f');
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a06');
SELECT jpp.same('Marcus, a helper on J1''s team, is nobody''s', jpp.people(), 'J1 f, J2 f, J3 f');
SELECT jpp.as_user(NULL);
SELECT jpp.same('nobody signed in is nobody''s', jpp.people(), 'J1 f, J2 f, J3 f');
SELECT jpp.same('a job that is not there is nobody''s', public.is_job_people('00000000-0000-0000-0000-0000000e4f99')::text, 'false');

-- 2 · Theo writes Dana's word on his job, and reads it.
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a01');
SELECT jpp.same('Theo writes the promise on J1', (public.add_job_payment_promise('00000000-0000-0000-0000-0000000e4f01', DATE '2026-10-25', 'Dana', 'text'))->>'promisedDate', '2026-10-25');
SELECT jpp.same('the promise is heard by Theo, from the office side', jpp.heard('00000000-0000-0000-0000-0000000e4f01'), 'People Theo / office');
SELECT jpp.same('the board''s date follows', jpp.board('00000000-0000-0000-0000-0000000e4f01'), '2026-10-25');
SELECT jpp.same('Theo reads J1''s promises', jpp.promises('00000000-0000-0000-0000-0000000e4f01'), 'Oct 25 by text, Dana, heard by People Theo');
SELECT jpp.same('Theo reads nothing of J2', jpp.promises('00000000-0000-0000-0000-0000000e4f02'), 'NULL');
SELECT jpp.same('the company-wide read still answers Theo nothing', coalesce(public.list_job_payment_promises()::text, 'NULL'), 'NULL');
SELECT jpp.refused('Theo is refused on Kim''s job', $q$SELECT public.add_job_payment_promise('00000000-0000-0000-0000-0000000e4f02', DATE '2026-10-25', 'Dana', 'text')$q$, 'Not allowed to record payment promises');
SELECT jpp.refused('Theo is refused on a job with no bid', $q$SELECT public.add_job_payment_promise('00000000-0000-0000-0000-0000000e4f03', DATE '2026-10-25', 'Dana', 'text')$q$, 'Not allowed to record payment promises');

-- 3 · Rosa writes one on J1 too; Theo voids both, and clears the board's date.
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a03');
SELECT jpp.same('Rosa writes a second word on J1', (public.add_job_payment_promise('00000000-0000-0000-0000-0000000e4f01', DATE '2026-10-28', 'Dana', 'phone'))->>'promisedDate', '2026-10-28');
SELECT jpp.same('Rosa writes one on J2', (public.add_job_payment_promise('00000000-0000-0000-0000-0000000e4f02', DATE '2026-11-02', 'Dana', 'phone'))->>'promisedDate', '2026-11-02');
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a01');
SELECT jpp.same('Theo reads both of J1''s, newest first', jpp.promises('00000000-0000-0000-0000-0000000e4f01'), 'Oct 28 by phone, Dana, heard by People Rosa; Oct 25 by text, Dana, heard by People Theo');
SELECT jpp.same('Theo voids the office''s word on his job', (public.void_job_payment_promise(jpp.pid('00000000-0000-0000-0000-0000000e4f01', DATE '2026-10-28')))->>'voided', 'true');
SELECT jpp.refused('Theo is refused voiding a word on Kim''s job', $q$SELECT public.void_job_payment_promise(jpp.pid('00000000-0000-0000-0000-0000000e4f02', DATE '2026-11-02'))$q$, 'Not allowed to void payment promises');
SELECT jpp.refused('voiding a promise that is not there is refused', $q$SELECT public.void_job_payment_promise('00000000-0000-0000-0000-0000000e4f99')$q$, 'Not allowed to void payment promises');
SELECT jpp.same('Theo clears the board''s date on J1', (public.set_job_promised_pay_date('00000000-0000-0000-0000-0000000e4f01', NULL))->>'cleared', 'true');
SELECT jpp.refused('Theo is refused clearing J2''s', $q$SELECT public.set_job_promised_pay_date('00000000-0000-0000-0000-0000000e4f02', NULL)$q$, 'Not allowed to set promised pay dates');

-- 4 · The primary who is the job's account manager writes; one who is not is refused.
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a04');
SELECT jpp.same('Luis writes on J3, his job with no bid', (public.add_job_payment_promise('00000000-0000-0000-0000-0000000e4f03', DATE '2026-11-05', 'Dana', 'in_person'))->>'promisedDate', '2026-11-05');
SELECT jpp.same('Luis reads J3''s', jpp.promises('00000000-0000-0000-0000-0000000e4f03'), 'Nov 05 by in_person, Dana, heard by People Luis');
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a05');
SELECT jpp.refused('Pat is refused on J1', $q$SELECT public.add_job_payment_promise('00000000-0000-0000-0000-0000000e4f01', DATE '2026-11-05', 'Dana', 'phone')$q$, 'Not allowed to record payment promises');
SELECT jpp.same('Pat, a primary, still reads J1''s through the old gate', jpp.promises('00000000-0000-0000-0000-0000000e4f01'), 'Oct 25 by text, Dana, heard by People Theo');
SELECT jpp.as_user('00000000-0000-0000-0000-0000000e4a06');
SELECT jpp.refused('Marcus, on the team, is refused', $q$SELECT public.add_job_payment_promise('00000000-0000-0000-0000-0000000e4f01', DATE '2026-11-05', 'Dana', 'phone')$q$, 'Not allowed to record payment promises');
SELECT jpp.same('Marcus reads nothing', jpp.promises('00000000-0000-0000-0000-0000000e4f01'), 'NULL');

DO $$ BEGIN RAISE NOTICE 'job_people PASSED'; END $$;
ROLLBACK;
