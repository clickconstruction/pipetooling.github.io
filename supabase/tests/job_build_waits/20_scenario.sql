-- A Build job waits, with a reason (v2.8709, punch list #192 write A): who may press, what is refused, what a mark
-- writes on the job and on its Activity, the same press twice, what a lift stamps, a second wait after a lift, who
-- reads a wait, and that no one writes the table by hand. One transaction that rolls back; raises on the first failed
-- assertion; ends with "job_build_waits PASSED". See scripts/pgtest-job-build-waits.sh. Never against prod.
\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA bedt;
GRANT USAGE ON SCHEMA bedt TO authenticated;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.id(n text) RETURNS uuid LANGUAGE sql IMMUTABLE AS
  $$ SELECT ('00000000-0000-0000-0000-' || lpad(n, 12, '0'))::uuid $$;
CREATE FUNCTION bedt.as_user(n text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claim.sub', CASE WHEN n = '' THEN '' ELSE bedt.id(n)::text END, true) $$;
CREATE FUNCTION bedt.open(job text) RETURNS bigint LANGUAGE sql AS
  $$ SELECT count(*) FROM public.job_build_waits WHERE job_id = bedt.id(job) AND lifted_at IS NULL $$;
CREATE FUNCTION bedt.lines(job text) RETURNS text LANGUAGE sql AS
  $$ SELECT COALESCE(string_agg(event_type || ': ' || summary, ' | ' ORDER BY occurred_at, event_type DESC), '') FROM public.job_activity_events WHERE job_id = bedt.id(job) $$;
-- What a signed-in person reads under the table's own policy.
CREATE FUNCTION bedt.seen() RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.job_build_waits;
  RESET ROLE;
  RETURN n;
END $$;

-- 1 the office (an assistant) · 2 a helper on job 10's crew · 3 the owner · 4 a controller · 5 a dev · 6 an estimator
-- on no job · 7 an assistant in training · 8 an assistant who has left.
INSERT INTO public.users (id, role, name, read_only, archived_at) VALUES
  (bedt.id('1'), 'assistant', 'Dana Office', false, NULL), (bedt.id('2'), 'helpers', 'Sam Helper', false, NULL),
  (bedt.id('3'), 'master_technician', 'Mo Owner', false, NULL), (bedt.id('4'), 'controller', 'Cal Books', false, NULL),
  (bedt.id('5'), 'dev', 'Dev Seat', false, NULL), (bedt.id('6'), 'estimator', 'Eli Bids', false, NULL),
  (bedt.id('7'), 'assistant', 'Rita Training', true, NULL), (bedt.id('8'), 'assistant', 'Olga Gone', false, now() - interval '3 days');
INSERT INTO public.jobs_ledger (id, hcp_number) VALUES (bedt.id('10'), 'ZZ10'), (bedt.id('11'), 'ZZ11');
INSERT INTO public.job_crew (job_id, user_id) VALUES (bedt.id('10'), bedt.id('2'));

-- 1 · Who may run the press, and who may touch the table.
SELECT bedt.ok('anon cannot run the press', NOT has_function_privilege('anon', 'public.set_job_build_wait(uuid, boolean, text, text)', 'EXECUTE'));
SELECT bedt.ok('a signed-in person can', has_function_privilege('authenticated', 'public.set_job_build_wait(uuid, boolean, text, text)', 'EXECUTE'));
SELECT bedt.ok('the function runs as its owner', (SELECT prosecdef FROM pg_proc WHERE proname = 'set_job_build_wait'));
SELECT bedt.ok('row security is on', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.job_build_waits'::regclass));
SELECT bedt.ok('a signed-in person may read the table and nothing else', has_table_privilege('authenticated', 'public.job_build_waits', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.job_build_waits', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.job_build_waits', 'UPDATE') AND NOT has_table_privilege('authenticated', 'public.job_build_waits', 'DELETE'));
SELECT bedt.ok('anon may not read it', NOT has_table_privilege('anon', 'public.job_build_waits', 'SELECT'));
SELECT bedt.ok('the one policy is a read', (SELECT count(*) = 1 AND bool_and(cmd = 'SELECT') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'job_build_waits'));

SELECT bedt.as_user('');
SELECT bedt.ok('nobody signed in is refused', public.set_job_build_wait(bedt.id('10'), true, 'gc_not_ready') = '{"error": "Not authenticated"}'::jsonb);
SELECT bedt.as_user('2');
SELECT bedt.ok('a helper on the job is refused', public.set_job_build_wait(bedt.id('10'), true, 'gc_not_ready')->>'error' = 'Only the office marks a job waiting or lifts a wait.');
SELECT bedt.as_user('6');
SELECT bedt.ok('an estimator is refused', public.set_job_build_wait(bedt.id('10'), true, 'gc_not_ready')->>'error' = 'Only the office marks a job waiting or lifts a wait.');
SELECT bedt.as_user('8');
SELECT bedt.ok('an assistant who has left is refused', public.set_job_build_wait(bedt.id('10'), true, 'gc_not_ready')->>'error' = 'Only the office marks a job waiting or lifts a wait.');
SELECT bedt.as_user('7');
SELECT bedt.ok('an assistant in training changes nothing', public.set_job_build_wait(bedt.id('10'), true, 'gc_not_ready')->>'error' = 'A training account changes nothing.');
SELECT bedt.ok('a refusal writes nothing, on the table or on the Activity', (SELECT count(*) = 0 FROM public.job_build_waits) AND (SELECT count(*) = 0 FROM public.job_activity_events));

-- 2 · What is refused for the office too.
SELECT bedt.as_user('1');
SELECT bedt.ok('no answer is refused', public.set_job_build_wait(bedt.id('10'), NULL, 'gc_not_ready')->>'error' = 'Say whether the job waits or the wait is lifted.');
SELECT bedt.ok('an unknown job is refused', public.set_job_build_wait(bedt.id('999'), true, 'gc_not_ready')->>'error' = 'Job not found');
SELECT bedt.ok('a mark needs a reason', public.set_job_build_wait(bedt.id('10'), true)->>'error' = 'Pick the reason the job waits.');
SELECT bedt.ok('a reason nobody offers is refused', public.set_job_build_wait(bedt.id('10'), true, 'because')->>'error' = 'Pick the reason the job waits.');
SELECT bedt.ok('another reason needs its words', public.set_job_build_wait(bedt.id('10'), true, 'other', '   ')->>'error' = 'Say why the job waits.');
SELECT bedt.ok('still nothing is written', (SELECT count(*) = 0 FROM public.job_build_waits) AND (SELECT count(*) = 0 FROM public.job_activity_events));
SELECT bedt.ok('lifting a wait nobody marked answers ok and changes nothing', public.set_job_build_wait(bedt.id('10'), false) = '{"ok": true, "waits": false, "changed": false}'::jsonb);
SELECT bedt.ok('and writes no line', (SELECT count(*) = 0 FROM public.job_activity_events));

-- 3 · Marked: the reason, the trimmed words, who and when, and one line on the job's Activity.
SELECT bedt.ok('marked: the press answers ok', public.set_job_build_wait(bedt.id('10'), true, 'gc_not_ready', '  Slab pour moved a week.  ') = '{"ok": true, "waits": true, "changed": true}'::jsonb);
SELECT bedt.ok('marked: the row says why, who and when', (SELECT count(*) = 1 FROM public.job_build_waits WHERE job_id = bedt.id('10') AND reason = 'gc_not_ready' AND note = 'Slab pour moved a week.' AND marked_by = bedt.id('1') AND marked_by_name = 'Dana Office' AND since_at IS NOT NULL AND lifted_at IS NULL AND lifted_by IS NULL));
SELECT bedt.ok('marked: one line on the Activity, in words, by the person', bedt.lines('10') = 'build_wait_marked: Marked the job waiting: the GC is not ready for us. Slab pour moved a week.');
SELECT bedt.ok('the line names who and is not a money line', (SELECT actor_user_id = bedt.id('1') AND financial = false AND detail->>'reason' = 'gc_not_ready' FROM public.job_activity_events WHERE job_id = bedt.id('10')));
SELECT bedt.ok('the other job does not wait', bedt.open('11') = 0);

-- 4 · The same press twice is one wait and one line, whoever presses and whatever reason they pick.
SELECT bedt.as_user('3');
SELECT bedt.ok('again: ok and unchanged', public.set_job_build_wait(bedt.id('10'), true, 'weather') = '{"ok": true, "waits": true, "changed": false}'::jsonb);
SELECT bedt.ok('still one wait, with the first reason', bedt.open('10') = 1 AND (SELECT reason = 'gc_not_ready' FROM public.job_build_waits WHERE job_id = bedt.id('10') AND lifted_at IS NULL));
SELECT bedt.ok('and still one line', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('10')));

-- 5 · Another reason carries its words as the reason.
SELECT bedt.as_user('4');
SELECT bedt.ok('a controller marks another job with words of their own', public.set_job_build_wait(bedt.id('11'), true, 'other', 'The permit is with the city.') = '{"ok": true, "waits": true, "changed": true}'::jsonb);
SELECT bedt.ok('its line says the words once', bedt.lines('11') = 'build_wait_marked: Marked the job waiting: The permit is with the city.');

-- 6 · Who reads a wait: whoever reads its job, and nobody else.
SELECT bedt.as_user('1');
SELECT bedt.ok('the office reads both waits', bedt.seen() = 2);
SELECT bedt.as_user('2');
SELECT bedt.ok('a helper reads the wait on the job they are on, and not the other', bedt.seen() = 1);
SELECT bedt.as_user('6');
SELECT bedt.ok('an estimator on no job reads none', bedt.seen() = 0);
SELECT bedt.as_user('');
SELECT bedt.ok('nobody signed in reads none', bedt.seen() = 0);

-- 7 · Lifted: who and when, one more line, and the job can wait again.
SELECT bedt.as_user('5');
SELECT bedt.ok('a dev lifts the wait', public.set_job_build_wait(bedt.id('10'), false) = '{"ok": true, "waits": false, "changed": true}'::jsonb);
SELECT bedt.ok('lifted: the row keeps its reason and says who lifted it', (SELECT count(*) = 1 FROM public.job_build_waits WHERE job_id = bedt.id('10') AND reason = 'gc_not_ready' AND lifted_by = bedt.id('5') AND lifted_by_name = 'Dev Seat' AND lifted_at IS NOT NULL) AND bedt.open('10') = 0);
SELECT bedt.ok('lifted: a second line on the Activity', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('10') AND event_type = 'build_wait_lifted' AND summary = 'Lifted the wait. The job counts on the Build desk again.' AND actor_user_id = bedt.id('5')));
SELECT bedt.ok('a second lift changes nothing', public.set_job_build_wait(bedt.id('10'), false) = '{"ok": true, "waits": false, "changed": false}'::jsonb);
SELECT bedt.ok('and writes no line', (SELECT count(*) = 2 FROM public.job_activity_events WHERE job_id = bedt.id('10')));
SELECT bedt.as_user('1');
-- A press and the read of what it wrote are two statements: one statement reads one snapshot.
SELECT bedt.ok('the job waits again', public.set_job_build_wait(bedt.id('10'), true, 'materials') = '{"ok": true, "waits": true, "changed": true}'::jsonb);
SELECT bedt.ok('as a new row beside the lifted one', (SELECT count(*) = 2 FROM public.job_build_waits WHERE job_id = bedt.id('10')) AND bedt.open('10') = 1);
SELECT bedt.ok('with a line of its own', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('10') AND summary = 'Marked the job waiting: waiting on materials.'));

-- 8 · The table's own rules, whoever writes.
DO $$ BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.job_build_waits (job_id, reason) VALUES (bedt.id('11'), 'weather');
    RESET ROLE;
    RAISE EXCEPTION 'FAILED: a signed-in person wrote the table by hand';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'ok: a signed-in person cannot write the table by hand';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.job_build_waits (job_id, reason) VALUES (bedt.id('10'), 'weather');
    RAISE EXCEPTION 'FAILED: the table took a second open wait on one job';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok: the table refuses a second open wait on one job';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.job_build_waits SET reason = 'other', note = ' ' WHERE job_id = bedt.id('10') AND lifted_at IS NULL;
    RAISE EXCEPTION 'FAILED: the table took another reason with no words';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the table refuses another reason with no words';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.job_build_waits SET reason = 'holiday' WHERE job_id = bedt.id('10') AND lifted_at IS NULL;
    RAISE EXCEPTION 'FAILED: the table took a reason nobody offers';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the table refuses a reason nobody offers';
  END;
END $$;
-- A job deleted takes its waits with it.
DELETE FROM public.jobs_ledger WHERE id = bedt.id('11');
SELECT bedt.ok('a deleted job takes its waits', (SELECT count(*) = 0 FROM public.job_build_waits WHERE job_id = bedt.id('11')));

DO $$ BEGIN RAISE NOTICE 'job_build_waits PASSED'; END $$;
ROLLBACK;
