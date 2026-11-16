-- A job leaves the lien path for its own reason (v2.7504): the answer on the job and the press that writes it. Who
-- may press, what is refused, what each answer writes, the line on the job's activity, the attorney's list and what
-- its flag refused, the same press twice, and putting the job back. One transaction that rolls back; raises on the
-- first failed assertion; ends with "job_lien_path_answer PASSED". See scripts/pgtest-job-lien-path-answer.sh. Never
-- against prod.
\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA bedt;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.id(n text) RETURNS uuid LANGUAGE sql IMMUTABLE AS
  $$ SELECT ('00000000-0000-0000-0000-' || lpad(n, 12, '0'))::uuid $$;
CREATE FUNCTION bedt.as_user(n text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claim.sub', CASE WHEN n = '' THEN '' ELSE bedt.id(n)::text END, true) $$;
CREATE FUNCTION bedt.lines(job text) RETURNS bigint LANGUAGE sql AS
  $$ SELECT count(*) FROM public.job_activity_events WHERE job_id = bedt.id(job) AND event_type = 'lien_path_change' $$;

INSERT INTO public.users (id, role) VALUES (bedt.id('1'), 'assistant'), (bedt.id('2'), 'technician'), (bedt.id('3'), 'master_technician'), (bedt.id('4'), 'controller'), (bedt.id('5'), 'dev');
-- A billed job, a job still being worked, and a billed job that is on the attorney's list already.
INSERT INTO public.jobs_ledger (id, hcp_number, status) VALUES (bedt.id('10'), 'ZZ10', 'billed'), (bedt.id('11'), 'ZZ11', 'working'), (bedt.id('14'), 'ZZ14', 'billed');
INSERT INTO public.jobs_ledger (id, hcp_number, status, collections_at, collections_note) VALUES (bedt.id('13'), 'ZZ13', 'billed', '2026-10-01T15:00:00Z', 'an older note');

-- 1 · The columns, and who may run the press.
SELECT bedt.ok('a job starts on the lien path', (SELECT lien_path_answer IS NULL AND lien_path_answered_at IS NULL AND lien_path_answered_by IS NULL AND lien_path_reason IS NULL FROM public.jobs_ledger WHERE id = bedt.id('10')));
SELECT bedt.ok('anon cannot run the press', NOT has_function_privilege('anon', 'public.set_job_lien_path_answer(uuid, text, text, boolean)', 'EXECUTE'));
SELECT bedt.ok('a signed-in person can', has_function_privilege('authenticated', 'public.set_job_lien_path_answer(uuid, text, text, boolean)', 'EXECUTE'));
SELECT bedt.ok('the function runs as its owner', (SELECT prosecdef FROM pg_proc WHERE proname = 'set_job_lien_path_answer'));

SELECT bedt.as_user('');
SELECT bedt.ok('nobody signed in is refused', public.set_job_lien_path_answer(bedt.id('10'), 'off_path', 'why') = '{"error": "Not authenticated"}'::jsonb);
SELECT bedt.as_user('2');
SELECT bedt.ok('a technician is refused', public.set_job_lien_path_answer(bedt.id('10'), 'off_path', 'why')->>'error' = 'Not authorized to take a job off the lien path');
SELECT bedt.ok('a refusal writes nothing', (SELECT lien_path_answer IS NULL AND lien_path_answered_by IS NULL FROM public.jobs_ledger WHERE id = bedt.id('10')) AND bedt.lines('10') = 0);

-- 2 · What is refused for the office too.
SELECT bedt.as_user('1');
SELECT bedt.ok('an unknown answer is refused', public.set_job_lien_path_answer(bedt.id('10'), 'maybe', 'why')->>'error' = 'The answer must be off_path or on_path');
SELECT bedt.ok('no answer is refused', public.set_job_lien_path_answer(bedt.id('10'), NULL, 'why')->>'error' = 'The answer must be off_path or on_path');
SELECT bedt.ok('an unknown job is refused', public.set_job_lien_path_answer(bedt.id('999'), 'off_path', 'why')->>'error' = 'Job not found');
SELECT bedt.ok('off the path needs a reason', public.set_job_lien_path_answer(bedt.id('10'), 'off_path', '   ')->>'error' = 'Say why this job is off the lien path');
SELECT bedt.ok('still nothing is written', (SELECT lien_path_answer IS NULL FROM public.jobs_ledger WHERE id = bedt.id('10')) AND bedt.lines('10') = 0);
DO $$ BEGIN
  BEGIN
    UPDATE public.jobs_ledger SET lien_path_answer = 'maybe' WHERE id = bedt.id('10');
    RAISE EXCEPTION 'FAILED: the column took an answer it does not know';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the column refuses an answer it does not know';
  END;
END $$;
-- A job that was never taken off has nothing to put back.
SELECT bedt.ok('putting back a job that is on the path answers ok and changes nothing', public.set_job_lien_path_answer(bedt.id('10'), 'on_path') = '{"ok": true, "answer": null, "changed": false, "on_attorney_list": false, "already_on_list": false, "held": null}'::jsonb);
SELECT bedt.ok('and writes no stamp and no line', (SELECT lien_path_answered_at IS NULL AND lien_path_answered_by IS NULL FROM public.jobs_ledger WHERE id = bedt.id('10')) AND bedt.lines('10') = 0);

-- 3 · Off the lien path: the answer, the trimmed reason, who and when, one line on the activity, no list unless asked.
CREATE TEMP TABLE r_off ON COMMIT DROP AS
  SELECT public.set_job_lien_path_answer(bedt.id('10'), 'off_path', '  The bill is for trips to pick up checks, not for work on the property.  ') AS r;
SELECT bedt.ok('off: the press answers ok', (SELECT r = '{"ok": true, "answer": "off_path", "changed": true, "on_attorney_list": false, "already_on_list": false, "held": null}'::jsonb FROM r_off));
SELECT bedt.ok('off: the answer, the trimmed reason, who and when are on the job', (SELECT lien_path_answer = 'off_path' AND lien_path_reason = 'The bill is for trips to pick up checks, not for work on the property.' AND lien_path_answered_by = bedt.id('1') AND lien_path_answered_at IS NOT NULL AND updated_at IS NOT NULL FROM public.jobs_ledger WHERE id = bedt.id('10')));
SELECT bedt.ok('off: one line on the activity, with the reason and who', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('10') AND event_type = 'lien_path_change' AND actor_user_id = bedt.id('1') AND financial AND summary = 'Taken off the lien path — The bill is for trips to pick up checks, not for work on the property.' AND detail = '{"answer": "off_path", "reason": "The bill is for trips to pick up checks, not for work on the property."}'::jsonb));
SELECT bedt.ok('off: not on the attorney''s list unless asked', (SELECT collections_at IS NULL FROM public.jobs_ledger WHERE id = bedt.id('10')));

-- 4 · The same press twice changes nothing; a new reason is a new line and a new stamp.
SELECT bedt.as_user('3');
SELECT bedt.ok('again, same reason: ok and unchanged', public.set_job_lien_path_answer(bedt.id('10'), 'off_path', 'The bill is for trips to pick up checks, not for work on the property.')->>'changed' = 'false');
SELECT bedt.ok('again, same reason: still the assistant''s press and one line', (SELECT lien_path_answered_by = bedt.id('1') FROM public.jobs_ledger WHERE id = bedt.id('10')) AND bedt.lines('10') = 1);
SELECT bedt.ok('a new reason: changed', public.set_job_lien_path_answer(bedt.id('10'), 'off_path', 'Counsel says a trip charge is not lienable.')->>'changed' = 'true');
SELECT bedt.ok('a new reason: the master''s press, the new words, a second line', (SELECT lien_path_answered_by = bedt.id('3') AND lien_path_reason = 'Counsel says a trip charge is not lienable.' FROM public.jobs_ledger WHERE id = bedt.id('10')) AND bedt.lines('10') = 2);

-- 5 · Off the path and onto the attorney's list: a billed job goes on with the reason, a job not billed is named and
--     leaves the path all the same, a job already on the list keeps its own note.
CREATE TEMP TABLE r_list ON COMMIT DROP AS
  SELECT public.set_job_lien_path_answer(bedt.id('14'), 'off_path', 'No lien right here. Collect it from the contractor.', true) AS r;
SELECT bedt.ok('a billed job goes on the attorney''s list', (SELECT r = '{"ok": true, "answer": "off_path", "changed": true, "on_attorney_list": true, "already_on_list": false, "held": null}'::jsonb FROM r_list));
SELECT bedt.ok('a billed job: the Collections flag carries the reason', (SELECT collections_at IS NOT NULL AND collections_by = bedt.id('3') AND collections_note = 'No lien right here. Collect it from the contractor.' FROM public.jobs_ledger WHERE id = bedt.id('14')));
SELECT bedt.ok('a billed job: one Collections line and one lien path line', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('14') AND event_type = 'collections_change') AND bedt.lines('14') = 1);
CREATE TEMP TABLE r_working ON COMMIT DROP AS
  SELECT public.set_job_lien_path_answer(bedt.id('11'), 'off_path', 'Not lienable.', true) AS r;
SELECT bedt.ok('a job not billed: the Collections flag''s own refusal is named', (SELECT r = '{"ok": true, "answer": "off_path", "changed": true, "on_attorney_list": false, "already_on_list": false, "held": "Job must be in Billed Awaiting Payment to change Collections"}'::jsonb FROM r_working));
SELECT bedt.ok('a job not billed: off the path all the same, and not on the list', (SELECT lien_path_answer = 'off_path' AND collections_at IS NULL FROM public.jobs_ledger WHERE id = bedt.id('11')));
CREATE TEMP TABLE r_listed ON COMMIT DROP AS
  SELECT public.set_job_lien_path_answer(bedt.id('13'), 'off_path', 'Not lienable.', true) AS r;
SELECT bedt.ok('a job already on the list says so', (SELECT r = '{"ok": true, "answer": "off_path", "changed": true, "on_attorney_list": true, "already_on_list": true, "held": null}'::jsonb FROM r_listed));
SELECT bedt.ok('a job already on the list keeps its own note and day, with no second Collections line', (SELECT collections_note = 'an older note' AND collections_at = '2026-10-01T15:00:00Z' FROM public.jobs_ledger WHERE id = bedt.id('13')) AND (SELECT count(*) = 0 FROM public.job_activity_events WHERE job_id = bedt.id('13') AND event_type = 'collections_change'));
-- Asking for the list on the way back is not a thing: the list is asked only on the way off.
SELECT bedt.ok('the same press again, list asked again: unchanged, already on the list', public.set_job_lien_path_answer(bedt.id('14'), 'off_path', 'No lien right here. Collect it from the contractor.', true) = '{"ok": true, "answer": "off_path", "changed": false, "on_attorney_list": true, "already_on_list": true, "held": null}'::jsonb);
SELECT bedt.ok('and still one Collections line', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('14') AND event_type = 'collections_change'));

-- 6 · Put it back on the lien path: a reason is asked, the answer goes, who, when and why stay, the list is not touched.
SELECT bedt.as_user('4');
SELECT bedt.ok('putting it back needs a reason', public.set_job_lien_path_answer(bedt.id('14'), 'on_path')->>'error' = 'Say why this job goes back on the lien path');
SELECT bedt.ok('refused, the job is still off the path and still the master''s', (SELECT lien_path_answer = 'off_path' AND lien_path_answered_by = bedt.id('3') FROM public.jobs_ledger WHERE id = bedt.id('14')));
-- The press and the read of what it wrote are two statements: one statement would read the job as it stood before.
SELECT bedt.ok('with a reason it goes back', public.set_job_lien_path_answer(bedt.id('14'), 'on_path', 'Counsel says the claim stands.', true) = '{"ok": true, "answer": null, "changed": true, "on_attorney_list": false, "already_on_list": false, "held": null}'::jsonb);
SELECT bedt.ok('back: on the path, with who, when and why', (SELECT lien_path_answer IS NULL AND lien_path_reason = 'Counsel says the claim stands.' AND lien_path_answered_by = bedt.id('4') AND lien_path_answered_at IS NOT NULL FROM public.jobs_ledger WHERE id = bedt.id('14')));
SELECT bedt.ok('back: a second line on the activity, in the words of the way back', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('14') AND event_type = 'lien_path_change' AND actor_user_id = bedt.id('4') AND summary = 'Put back on the lien path — Counsel says the claim stands.' AND detail = '{"answer": null, "reason": "Counsel says the claim stands."}'::jsonb) AND bedt.lines('14') = 2);
SELECT bedt.ok('back: the job stays on the attorney''s list', (SELECT collections_at IS NOT NULL FROM public.jobs_ledger WHERE id = bedt.id('14')));
SELECT bedt.as_user('5');
SELECT bedt.ok('a dev can take it off again', public.set_job_lien_path_answer(bedt.id('14'), 'off_path', 'Off again.')->>'changed' = 'true');
SELECT bedt.ok('and the job says so', (SELECT lien_path_answer = 'off_path' AND lien_path_answered_by = bedt.id('5') FROM public.jobs_ledger WHERE id = bedt.id('14')) AND bedt.lines('14') = 3);

DO $$ BEGIN RAISE NOTICE 'job_lien_path_answer PASSED'; END $$;
ROLLBACK;
