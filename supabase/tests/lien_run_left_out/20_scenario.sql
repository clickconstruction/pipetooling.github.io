-- A lien paper left out of the run, and put back (v2.8474, punch list #362 step 5): who may press, what is refused,
-- what a leave-out writes, the same press twice, a second run's leave-out beside the first, what putting back stamps,
-- who reads the rows, and that no one writes the table by hand. One transaction that rolls back; raises on the first
-- failed assertion; ends with "lien_run_left_out PASSED". See scripts/pgtest-lien-run-left-out.sh. Never against prod.
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
CREATE FUNCTION bedt.live(job text, paper text) RETURNS bigint LANGUAGE sql AS
  $$ SELECT count(*) FROM public.lien_run_left_out WHERE job_id = bedt.id(job) AND paper = $2 AND put_back_at IS NULL $$;
-- What a signed-in person reads under the table's own policy.
CREATE FUNCTION bedt.seen() RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.lien_run_left_out;
  RESET ROLE;
  RETURN n;
END $$;

INSERT INTO public.users (id, role) VALUES (bedt.id('1'), 'assistant'), (bedt.id('2'), 'technician'), (bedt.id('3'), 'master_technician'), (bedt.id('4'), 'controller'), (bedt.id('5'), 'dev'), (bedt.id('6'), 'estimator');
INSERT INTO public.jobs_ledger (id, hcp_number) VALUES (bedt.id('10'), 'ZZ10'), (bedt.id('11'), 'ZZ11');

-- 1 · Who may run the press, and who may touch the table.
SELECT bedt.ok('anon cannot run the press', NOT has_function_privilege('anon', 'public.set_lien_run_left_out(uuid, text, date, boolean, text, text)', 'EXECUTE'));
SELECT bedt.ok('a signed-in person can', has_function_privilege('authenticated', 'public.set_lien_run_left_out(uuid, text, date, boolean, text, text)', 'EXECUTE'));
SELECT bedt.ok('the function runs as its owner', (SELECT prosecdef FROM pg_proc WHERE proname = 'set_lien_run_left_out'));
SELECT bedt.ok('row security is on', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lien_run_left_out'::regclass));
SELECT bedt.ok('a signed-in person may read the table and nothing else', has_table_privilege('authenticated', 'public.lien_run_left_out', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.lien_run_left_out', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.lien_run_left_out', 'UPDATE') AND NOT has_table_privilege('authenticated', 'public.lien_run_left_out', 'DELETE'));
SELECT bedt.ok('anon may not read it', NOT has_table_privilege('anon', 'public.lien_run_left_out', 'SELECT'));
SELECT bedt.ok('the one policy is a read', (SELECT count(*) = 1 AND bool_and(cmd = 'SELECT') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lien_run_left_out'));

SELECT bedt.as_user('');
SELECT bedt.ok('nobody signed in is refused', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', true, 'customer_paying') = '{"error": "Not authenticated"}'::jsonb);
SELECT bedt.as_user('2');
SELECT bedt.ok('a technician is refused', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', true, 'customer_paying')->>'error' = 'Not authorized to leave a lien paper out of the run');
SELECT bedt.as_user('6');
SELECT bedt.ok('an estimator is refused', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', true, 'customer_paying')->>'error' = 'Not authorized to leave a lien paper out of the run');
SELECT bedt.ok('a refusal writes nothing', (SELECT count(*) = 0 FROM public.lien_run_left_out));

-- 2 · What is refused for the office too.
SELECT bedt.as_user('1');
SELECT bedt.ok('an unknown paper is refused', public.set_lien_run_left_out(bedt.id('10'), 'retainage', '2026-11-16', true, 'customer_paying')->>'error' = 'The paper must be notice or affidavit');
SELECT bedt.ok('no answer is refused', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', NULL, 'customer_paying')->>'error' = 'Say whether the paper is left out or put back');
SELECT bedt.ok('an unknown job is refused', public.set_lien_run_left_out(bedt.id('999'), 'affidavit', '2026-11-16', true, 'customer_paying')->>'error' = 'Job not found');
SELECT bedt.ok('a leave-out needs its run', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', NULL, true, 'customer_paying')->>'error' = 'Say which run the paper is left out of');
SELECT bedt.ok('a leave-out needs a reason', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', true)->>'error' = 'Pick a reason to leave this paper out');
SELECT bedt.ok('a reason nobody offers is refused', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', true, 'because')->>'error' = 'Pick a reason to leave this paper out');
SELECT bedt.ok('another reason needs its words', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', true, 'other', '   ')->>'error' = 'Say why this paper is left out');
SELECT bedt.ok('still nothing is written', (SELECT count(*) = 0 FROM public.lien_run_left_out));
SELECT bedt.ok('putting back a paper nobody left out answers ok and changes nothing', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', NULL, false) = '{"ok": true, "left_out": false, "changed": false}'::jsonb);

-- 3 · Left out: the run's day, the reason, the trimmed words, who and when.
SELECT bedt.ok('left out: the press answers ok', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', true, 'other', '  The owner is out of the country until the 20th.  ') = '{"ok": true, "left_out": true, "changed": true}'::jsonb);
SELECT bedt.ok('left out: the row says which run, why, who and when', (SELECT count(*) = 1 FROM public.lien_run_left_out WHERE job_id = bedt.id('10') AND paper = 'affidavit' AND run_day = '2026-11-16' AND reason = 'other' AND note = 'The owner is out of the country until the 20th.' AND left_out_by = bedt.id('1') AND left_out_at IS NOT NULL AND put_back_at IS NULL AND put_back_by IS NULL));
SELECT bedt.ok('the job''s notice is its own paper and is not left out', bedt.live('10', 'notice') = 0);

-- 4 · The same press twice writes one row, whoever presses and whatever reason they pick the second time.
SELECT bedt.as_user('3');
SELECT bedt.ok('again, same run: ok and unchanged', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-11-16', true, 'customer_paying') = '{"ok": true, "left_out": true, "changed": false}'::jsonb);
SELECT bedt.ok('again, same run: still one row, still the assistant''s reason', bedt.live('10', 'affidavit') = 1 AND (SELECT reason = 'other' AND left_out_by = bedt.id('1') FROM public.lien_run_left_out WHERE job_id = bedt.id('10')));

-- 5 · The next run asks again; left out of it too, that is a second row beside the first.
SELECT bedt.ok('the next run: a new leave-out', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-12-15', true, 'customer_paying')->>'changed' = 'true');
SELECT bedt.ok('the next run: two rows stand, one a run', bedt.live('10', 'affidavit') = 2 AND (SELECT count(*) = 1 FROM public.lien_run_left_out WHERE job_id = bedt.id('10') AND run_day = '2026-12-15' AND reason = 'customer_paying' AND note = '' AND left_out_by = bedt.id('3')));
SELECT bedt.ok('a notice on another job is left out by the master', public.set_lien_run_left_out(bedt.id('11'), 'notice', '2026-12-15', true, 'leader_not_in_time')->>'changed' IS NOT NULL);

-- 6 · Put back: every standing leave-out of that paper is stamped, with who and when, and nothing else is.
SELECT bedt.as_user('4');
SELECT bedt.ok('put back: the press answers ok', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', NULL, false) = '{"ok": true, "left_out": false, "changed": true}'::jsonb);
SELECT bedt.ok('put back: both rows are stamped by the controller', bedt.live('10', 'affidavit') = 0 AND (SELECT count(*) = 2 FROM public.lien_run_left_out WHERE job_id = bedt.id('10') AND put_back_by = bedt.id('4') AND put_back_at IS NOT NULL));
SELECT bedt.ok('put back: who left it out and why stay on the row', (SELECT count(*) = 1 FROM public.lien_run_left_out WHERE job_id = bedt.id('10') AND run_day = '2026-11-16' AND left_out_by = bedt.id('1') AND note = 'The owner is out of the country until the 20th.'));
SELECT bedt.ok('put back: the other job''s notice still stands', bedt.live('11', 'notice') = 1);
SELECT bedt.ok('put back twice: ok and unchanged', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', NULL, false)->>'changed' = 'false');
-- A paper put back can be left out of the same run again: the key holds only the rows that stand.
SELECT bedt.as_user('5');
SELECT bedt.ok('left out again after a put back: a new row', public.set_lien_run_left_out(bedt.id('10'), 'affidavit', '2026-12-15', true, 'ask_attorney')->>'changed' = 'true' AND bedt.live('10', 'affidavit') = 1);

-- 7 · Who reads the rows.
SELECT bedt.as_user('1');
SELECT bedt.ok('an assistant reads every row', bedt.seen() = 4);
SELECT bedt.as_user('3');
SELECT bedt.ok('a master reads every row', bedt.seen() = 4);
SELECT bedt.as_user('4');
SELECT bedt.ok('a controller reads every row', bedt.seen() = 4);
SELECT bedt.as_user('5');
SELECT bedt.ok('a dev reads every row', bedt.seen() = 4);
SELECT bedt.as_user('2');
SELECT bedt.ok('a technician reads none', bedt.seen() = 0);
SELECT bedt.as_user('6');
SELECT bedt.ok('an estimator reads none', bedt.seen() = 0);

-- 8 · Nobody writes the table by hand, and the table refuses a row that makes no sense.
SELECT bedt.as_user('1');
DO $$ BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.lien_run_left_out (job_id, paper, run_day, reason, left_out_by) VALUES (bedt.id('11'), 'affidavit', '2026-12-15', 'customer_paying', bedt.id('1'));
    RESET ROLE;
    RAISE EXCEPTION 'FAILED: a signed-in person wrote the table by hand';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'ok: a signed-in person cannot write the table by hand';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.lien_run_left_out (job_id, paper, run_day, reason, left_out_by) VALUES (bedt.id('11'), 'affidavit', '2026-12-15', 'other', bedt.id('1'));
    RAISE EXCEPTION 'FAILED: the table took another reason with no words';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the table refuses another reason with no words';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.lien_run_left_out SET put_back_at = now() WHERE job_id = bedt.id('11') AND paper = 'notice';
    RAISE EXCEPTION 'FAILED: the table took a put back with nobody named';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the table refuses a put back with nobody named';
  END;
END $$;
-- A job deleted takes its rows with it.
DELETE FROM public.jobs_ledger WHERE id = bedt.id('11');
SELECT bedt.ok('a deleted job takes its rows', (SELECT count(*) = 0 FROM public.lien_run_left_out WHERE job_id = bedt.id('11')));

DO $$ BEGIN RAISE NOTICE 'lien_run_left_out PASSED'; END $$;
ROLLBACK;
