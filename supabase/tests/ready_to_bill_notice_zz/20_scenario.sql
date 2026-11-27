-- Presses nothing takes back (punch list #443, row 7's walk): a ZZ test job sends no Ready to bill notice
-- (migration *_ready_to_bill_notice_leaves_zz_out). Every move of a job into ready_to_bill fires
-- enqueue_ready_to_bill_notification_au, whose function queued one paid_job_email_queue row of kind ready_to_bill for
-- any job. Since the migration a job that job_is_zz_test calls a test job queues nothing.
-- Devon the dev makes the moves the app makes: through update_job_status from Working and from Billed, which is the
-- move a void of the last billed bill makes, and by a direct update under RLS. A real job queues one row a move, as
-- before, and so does a job with zz inside its name. A job with ZZ at the start of its name, one with ZZ at the start
-- of its stored customer name alone and one named in lower case after a space queue none. A move out of
-- ready_to_bill and an update that leaves the status where it is queue none for anyone. A job renamed in the same
-- update as its move is read as it stands after the update. A ZZ test job that reaches Paid still queues its
-- paid_in_full row, as a real one does. Fixtures made as postgres; everything runs inside one transaction that rolls
-- back. Raises on the first failed assertion; ends with "ready_to_bill_notice_zz PASSED".
-- See scripts/pgtest-ready-to-bill-notice-zz.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA rtbz;
CREATE FUNCTION rtbz.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004437' || p)::uuid $$;
CREATE FUNCTION rtbz.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION rtbz.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The app's own move, as the signed-in person: "ok", the verb's refusal, or what it raised.
CREATE FUNCTION rtbz.move(p_job uuid, p_to text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a jsonb;
BEGIN
  a := public.update_job_status(p_job, p_to);
  IF a ->> 'error' IS NOT NULL THEN RETURN 'refused: ' || (a ->> 'error'); END IF;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN 'raised: ' || SQLERRM;
END $$;
-- A direct update of the job's status, as the signed-in person under the table's own policies: how many rows it
-- reached, or the refusal's words. Here the trigger's function is the only code that runs as its owner.
CREATE FUNCTION rtbz.direct(p_job uuid, p_to text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE public.jobs_ledger SET status = p_to WHERE id = p_job;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text || ' row';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- The queue past RLS: every job of this bed by its last two hex digits with its count of rows of one kind, in order.
CREATE FUNCTION rtbz.queued(p_kind text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(j.id::text, 2) || ':' || (SELECT count(*) FROM public.paid_job_email_queue q WHERE q.job_ledger_id = j.id AND q.kind = p_kind)::text, ' ' ORDER BY j.id), '')
  FROM public.jobs_ledger j
  WHERE j.id::text LIKE '00000000-0000-0000-0000-0000004437%'
$$;
-- Where each job stands, past RLS, the same way.
CREATE FUNCTION rtbz.statuses() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(j.id::text, 2) || ':' || j.status::text, ' ' ORDER BY j.id), '')
  FROM public.jobs_ledger j
  WHERE j.id::text LIKE '00000000-0000-0000-0000-0000004437%'
$$;
GRANT USAGE ON SCHEMA rtbz TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rtbz TO anon, authenticated, service_role;

-- Who: Devon the dev, who makes the moves, and Malachi the master every job is under.
INSERT INTO auth.users (id, email) VALUES (rtbz.id('e1'), 'devon@rtbnotice.test'), (rtbz.id('e2'), 'malachi@rtbnotice.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  (rtbz.id('e1'), 'devon@rtbnotice.test', 'Devon Dev Rtbz', 'dev', false, false),
  (rtbz.id('e2'), 'malachi@rtbnotice.test', 'Malachi Master Rtbz', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- The jobs, every name made up. The a jobs start at Working, the b and d jobs at Billed, the c jobs at Working.
--   a1 b1 d1  a real job.                                     a2  a real job with zz inside both names, not at the start.
--   a3 b3 d3  ZZ at the start of the job's own name.          a4 b4  ZZ at the start of the stored customer name alone.
--   a5 b5     lower case zz after a space, in the job's name.
--   c1  a real job renamed to a ZZ name in the same update as its move.
--   c2  a ZZ test job renamed to a real name in the same update as its move.
INSERT INTO public.service_types (id, name) VALUES (rtbz.id('f0'), 'Ready to bill notice bed work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  (rtbz.id('a1'), rtbz.id('e2'), rtbz.id('f0'), 'J4437A1', 'Harbor Row Lot 7', 'Harbor Row Builders', 'gc', 1000, 0, 'working'),
  (rtbz.id('a2'), rtbz.id('e2'), rtbz.id('f0'), 'J4437A2', 'Jazz Hall repipe', 'Buzz Mechanical', 'gc', 1000, 0, 'working'),
  (rtbz.id('a3'), rtbz.id('e2'), rtbz.id('f0'), 'J4437A3', 'ZZ Test notice job', 'Harbor Row Builders', 'gc', 1000, 0, 'working'),
  (rtbz.id('a4'), rtbz.id('e2'), rtbz.id('f0'), 'J4437A4', 'Cedar Bend Lot 2', 'ZZ Test GC', 'gc', 1000, 0, 'working'),
  (rtbz.id('a5'), rtbz.id('e2'), rtbz.id('f0'), 'J4437A5', ' zz lower case job', 'Harbor Row Builders', 'gc', 1000, 0, 'working'),
  (rtbz.id('b1'), rtbz.id('e2'), rtbz.id('f0'), 'J4437B1', 'Harbor Row Lot 8', 'Harbor Row Builders', 'gc', 1000, 0, 'billed'),
  (rtbz.id('b3'), rtbz.id('e2'), rtbz.id('f0'), 'J4437B3', 'ZZ Test voided bill job', 'Harbor Row Builders', 'gc', 1000, 0, 'billed'),
  (rtbz.id('b4'), rtbz.id('e2'), rtbz.id('f0'), 'J4437B4', 'Cedar Bend Lot 3', 'ZZ Test GC', 'gc', 1000, 0, 'billed'),
  (rtbz.id('b5'), rtbz.id('e2'), rtbz.id('f0'), 'J4437B5', ' zz lower case billed job', 'Harbor Row Builders', 'gc', 1000, 0, 'billed'),
  (rtbz.id('c1'), rtbz.id('e2'), rtbz.id('f0'), 'J4437C1', 'Marsh Lane Lot 9', 'Harbor Row Builders', 'gc', 1000, 0, 'working'),
  (rtbz.id('c2'), rtbz.id('e2'), rtbz.id('f0'), 'J4437C2', 'ZZ Test job to be renamed', 'Harbor Row Builders', 'gc', 1000, 0, 'working'),
  (rtbz.id('d1'), rtbz.id('e2'), rtbz.id('f0'), 'J4437D1', 'Harbor Row Lot 9', 'Harbor Row Builders', 'gc', 1000, 0, 'billed'),
  (rtbz.id('d3'), rtbz.id('e2'), rtbz.id('f0'), 'J4437D3', 'ZZ Test paid job', 'Harbor Row Builders', 'gc', 1000, 0, 'billed');

-- ---------------------------------------------------------------------------------------------------------------
-- 0. What stands before any move.
SELECT rtbz.same('nothing is queued at the start', rtbz.queued('ready_to_bill') || ' | ' || rtbz.queued('paid_in_full'),
  'a1:0 a2:0 a3:0 a4:0 a5:0 b1:0 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0 | a1:0 a2:0 a3:0 a4:0 a5:0 b1:0 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0');
SELECT rtbz.same('the convention calls each job what the bed says it is',
  (SELECT string_agg(right(j.id::text, 2) || ':' || public.job_is_zz_test(j.id)::text, ' ' ORDER BY j.id) FROM public.jobs_ledger j WHERE j.id::text LIKE '00000000-0000-0000-0000-0000004437%'),
  'a1:false a2:false a3:true a4:true a5:true b1:false b3:true b4:true b5:true c1:false c2:true d1:false d3:true');
SELECT rtbz.same('the trigger stands once on jobs_ledger, enabled, on this function',
  (SELECT count(*)::text FROM pg_trigger t WHERE t.tgrelid = 'public.jobs_ledger'::regclass AND t.tgname = 'enqueue_ready_to_bill_notification_au' AND NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgfoid = 'public.enqueue_ready_to_bill_notification()'::regprocedure),
  '1');
SELECT rtbz.same('the function runs as its owner, with its search path as it was',
  (SELECT p.prosecdef::text || ' ' || array_to_string(p.proconfig, ',') FROM pg_proc p WHERE p.oid = 'public.enqueue_ready_to_bill_notification()'::regprocedure),
  'true search_path=public');
SELECT rtbz.same('the function and job_is_zz_test have one owner',
  (SELECT count(DISTINCT p.proowner)::text FROM pg_proc p WHERE p.oid IN ('public.enqueue_ready_to_bill_notification()'::regprocedure, 'public.job_is_zz_test(uuid)'::regprocedure)),
  '1');
SELECT rtbz.same('a signed-in account cannot call job_is_zz_test itself', has_function_privilege('authenticated', 'public.job_is_zz_test(uuid)', 'EXECUTE')::text, 'false');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Devon moves each a job from Working into Ready to bill, through the app's own verb.
SELECT rtbz.as_user(rtbz.id('e1'));
SET LOCAL ROLE authenticated;
SELECT rtbz.same('Working to Ready to bill, the five a jobs',
  rtbz.move(rtbz.id('a1'), 'ready_to_bill') || ' ' || rtbz.move(rtbz.id('a2'), 'ready_to_bill') || ' ' || rtbz.move(rtbz.id('a3'), 'ready_to_bill') || ' ' || rtbz.move(rtbz.id('a4'), 'ready_to_bill') || ' ' || rtbz.move(rtbz.id('a5'), 'ready_to_bill'),
  'ok ok ok ok ok');
SELECT rtbz.same('each real job queued one notice and each ZZ test job none', rtbz.queued('ready_to_bill'),
  'a1:1 a2:1 a3:0 a4:0 a5:0 b1:0 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0');

-- 2. The move a void of the last billed bill makes: Billed back into Ready to bill.
SELECT rtbz.same('Billed back to Ready to bill, the four b jobs',
  rtbz.move(rtbz.id('b1'), 'ready_to_bill') || ' ' || rtbz.move(rtbz.id('b3'), 'ready_to_bill') || ' ' || rtbz.move(rtbz.id('b4'), 'ready_to_bill') || ' ' || rtbz.move(rtbz.id('b5'), 'ready_to_bill'),
  'ok ok ok ok');
SELECT rtbz.same('the real job sent back queued one notice and each ZZ test job none', rtbz.queued('ready_to_bill'),
  'a1:1 a2:1 a3:0 a4:0 a5:0 b1:1 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0');

-- 3. A direct update under RLS, where nothing but the trigger's function runs as its owner. Out of Ready to bill
-- queues nothing for either job. Back into it queues one more for the real job and none for the ZZ test job.
SELECT rtbz.same('a direct move out of Ready to bill reaches each row', rtbz.direct(rtbz.id('a1'), 'working') || ' / ' || rtbz.direct(rtbz.id('a3'), 'working'), '1 row / 1 row');
SELECT rtbz.same('a move out of Ready to bill queues nothing', rtbz.queued('ready_to_bill'),
  'a1:1 a2:1 a3:0 a4:0 a5:0 b1:1 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0');
SELECT rtbz.same('a direct move back into Ready to bill reaches each row', rtbz.direct(rtbz.id('a1'), 'ready_to_bill') || ' / ' || rtbz.direct(rtbz.id('a3'), 'ready_to_bill'), '1 row / 1 row');
SELECT rtbz.same('the real job queued one more and the ZZ test job none', rtbz.queued('ready_to_bill'),
  'a1:2 a2:1 a3:0 a4:0 a5:0 b1:1 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0');

-- 4. The app's own move out of Ready to bill, a real job and a ZZ test job: nothing is queued.
SELECT rtbz.same('Ready to bill back to Working', rtbz.move(rtbz.id('a2'), 'working') || ' ' || rtbz.move(rtbz.id('a4'), 'working'), 'ok ok');
RESET ROLE;
SELECT rtbz.same('a send back to Working queues nothing', rtbz.queued('ready_to_bill'),
  'a1:2 a2:1 a3:0 a4:0 a5:0 b1:1 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. As postgres. An update that leaves the status at ready_to_bill queues nothing, whether it names the status or
-- another column. A move between two other statuses queues nothing.
UPDATE public.jobs_ledger SET status = 'ready_to_bill' WHERE id IN (rtbz.id('a1'), rtbz.id('a3'), rtbz.id('a5'), rtbz.id('b1'), rtbz.id('b3'));
UPDATE public.jobs_ledger SET status = status, revenue = 1001 WHERE id IN (rtbz.id('a1'), rtbz.id('a3'), rtbz.id('b1'), rtbz.id('b4'));
UPDATE public.jobs_ledger SET status = 'waiting' WHERE id IN (rtbz.id('a2'), rtbz.id('a4'));
SELECT rtbz.same('the jobs stand where the moves left them', rtbz.statuses(),
  'a1:ready_to_bill a2:waiting a3:ready_to_bill a4:waiting a5:ready_to_bill b1:ready_to_bill b3:ready_to_bill b4:ready_to_bill b5:ready_to_bill c1:working c2:working d1:billed d3:billed');
SELECT rtbz.same('a status left where it is, and a move between two other statuses, queue nothing', rtbz.queued('ready_to_bill'),
  'a1:2 a2:1 a3:0 a4:0 a5:0 b1:1 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0');

-- 6. A job renamed in the same update as its move is read as it stands after the update: the real job that takes a
-- ZZ name queues nothing, and the ZZ test job that takes a real name queues its one row.
UPDATE public.jobs_ledger SET status = 'ready_to_bill', job_name = 'ZZ Test renamed in the move' WHERE id = rtbz.id('c1');
UPDATE public.jobs_ledger SET status = 'ready_to_bill', job_name = 'Quarry Road Lot 1' WHERE id = rtbz.id('c2');
SELECT rtbz.same('the name the job holds after the update decides', rtbz.queued('ready_to_bill'),
  'a1:2 a2:1 a3:0 a4:0 a5:0 b1:1 b3:0 b4:0 b5:0 c1:0 c2:1 d1:0 d3:0');

-- 7. The paid notice is as it was: a job that reaches Paid queues one paid_in_full row, a ZZ test job too.
UPDATE public.jobs_ledger SET status = 'paid' WHERE id IN (rtbz.id('d1'), rtbz.id('d3'));
SELECT rtbz.same('reaching Paid queues one paid_in_full row for the real job and for the ZZ test job', rtbz.queued('paid_in_full'),
  'a1:0 a2:0 a3:0 a4:0 a5:0 b1:0 b3:0 b4:0 b5:0 c1:0 c2:0 d1:1 d3:1');
SELECT rtbz.same('and no Ready to bill row', rtbz.queued('ready_to_bill'),
  'a1:2 a2:1 a3:0 a4:0 a5:0 b1:1 b3:0 b4:0 b5:0 c1:0 c2:1 d1:0 d3:0');
SELECT rtbz.same('no payment row was queued by any move', rtbz.queued('payment'),
  'a1:0 a2:0 a3:0 a4:0 a5:0 b1:0 b3:0 b4:0 b5:0 c1:0 c2:0 d1:0 d3:0');

DO $$ BEGIN RAISE NOTICE 'ready_to_bill_notice_zz PASSED'; END $$;
ROLLBACK;
