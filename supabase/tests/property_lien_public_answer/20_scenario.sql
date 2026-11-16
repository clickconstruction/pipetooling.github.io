-- Is this public property? (v2.7436): the answer on the property record and the press that takes its jobs off the
-- lien path. Who may answer, what each answer writes, a job at a time what the press did and what it held, the second
-- press, and taking the answer back. One transaction that rolls back; raises on the first failed assertion; ends with
-- "property_lien_public_answer PASSED". See scripts/pgtest-property-lien-public-answer.sh. Never against prod.
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
-- One job's line of a press's answer.
CREATE FUNCTION bedt.line(result jsonb, job text) RETURNS jsonb LANGUAGE sql AS
  $$ SELECT j FROM jsonb_array_elements(result->'jobs') j WHERE j->>'job_id' = bedt.id(job)::text $$;

INSERT INTO public.users (id, role) VALUES (bedt.id('1'), 'assistant'), (bedt.id('2'), 'technician'), (bedt.id('3'), 'master_technician'), (bedt.id('4'), 'controller'), (bedt.id('5'), 'dev');
-- Two properties. 800 is the city's, with a billed job, a working job, and a job that is on the attorney's list already.
INSERT INTO public.customer_addresses (id, owner_name) VALUES (bedt.id('800'), 'ZZ TEST CITY OF'), (bedt.id('801'), 'ZZ Test Private LLC');
INSERT INTO public.jobs_ledger (id, hcp_number, status, customer_address_id) VALUES
  (bedt.id('10'), 'ZZ10', 'billed', bedt.id('800')),
  (bedt.id('11'), 'ZZ11', 'working', bedt.id('800')),
  (bedt.id('12'), 'ZZ12', 'billed', bedt.id('801'));
INSERT INTO public.jobs_ledger (id, hcp_number, status, customer_address_id, collections_at, collections_note, lien_payment_bond) VALUES
  (bedt.id('13'), 'ZZ13', 'billed', bedt.id('800'), '2026-10-01T15:00:00Z', 'an older note', 'yes');

-- 1 · The columns, and who may run the press.
SELECT bedt.ok('the answer starts unanswered', (SELECT lien_public_answer IS NULL AND lien_public_answered_at IS NULL FROM public.customer_addresses WHERE id = bedt.id('800')));
SELECT bedt.ok('anon cannot run the press', NOT has_function_privilege('anon', 'public.set_property_lien_public_answer(uuid, text, text, jsonb, text)', 'EXECUTE'));
SELECT bedt.ok('a signed-in person can', has_function_privilege('authenticated', 'public.set_property_lien_public_answer(uuid, text, text, jsonb, text)', 'EXECUTE'));
SELECT bedt.ok('the function runs as its owner', (SELECT prosecdef FROM pg_proc WHERE proname = 'set_property_lien_public_answer'));

SELECT bedt.as_user('');
SELECT bedt.ok('nobody signed in is refused', public.set_property_lien_public_answer(bedt.id('800'), 'private') = '{"error": "Not authenticated"}'::jsonb);
SELECT bedt.as_user('2');
SELECT bedt.ok('a technician is refused', public.set_property_lien_public_answer(bedt.id('800'), 'private')->>'error' = 'Not authorized to answer the public property question');
SELECT bedt.ok('a refusal writes nothing', (SELECT lien_public_answer IS NULL AND lien_public_answered_by IS NULL FROM public.customer_addresses WHERE id = bedt.id('800')));

-- 2 · What is refused for the office too.
SELECT bedt.as_user('1');
SELECT bedt.ok('an unknown answer is refused', public.set_property_lien_public_answer(bedt.id('800'), 'maybe')->>'error' = 'The answer must be public, private or unanswered');
SELECT bedt.ok('an unknown bond is refused', public.set_property_lien_public_answer(bedt.id('800'), 'public', 'why', '[]', 'maybe')->>'error' = 'The payment bond must be yes, no or unknown');
SELECT bedt.ok('jobs that are not a list are refused', public.set_property_lien_public_answer(bedt.id('800'), 'public', 'why', '{"job_id": 1}')->>'error' = 'The jobs must be a list');
SELECT bedt.ok('an unknown property is refused', public.set_property_lien_public_answer(bedt.id('999'), 'private')->>'error' = 'Property record not found');
SELECT bedt.ok('public needs a reason', public.set_property_lien_public_answer(bedt.id('800'), 'public', '   ')->>'error' = 'Say why this property is off the lien path');
SELECT bedt.ok('still nothing is written', (SELECT lien_public_answer IS NULL FROM public.customer_addresses WHERE id = bedt.id('800')));
DO $$ BEGIN
  BEGIN
    UPDATE public.customer_addresses SET lien_public_answer = 'maybe' WHERE id = bedt.id('801');
    RAISE EXCEPTION 'FAILED: the column took an answer it does not know';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the column refuses an answer it does not know';
  END;
END $$;

-- 3 · No, it is private: the answer, who and when; no reason asked; no job touched, whatever is handed in.
CREATE TEMP TABLE r_private ON COMMIT DROP AS
  SELECT public.set_property_lien_public_answer(bedt.id('801'), 'private', NULL, jsonb_build_array(jsonb_build_object('job_id', bedt.id('12'))), 'yes') AS r;
SELECT bedt.ok('private: the press answers ok with no jobs', (SELECT r = '{"ok": true, "answer": "private", "jobs": []}'::jsonb FROM r_private));
SELECT bedt.ok('private: the answer, who and when are on the record', (SELECT lien_public_answer = 'private' AND lien_public_answered_by = bedt.id('1') AND lien_public_answered_at IS NOT NULL AND lien_public_reason IS NULL AND updated_at IS NOT NULL FROM public.customer_addresses WHERE id = bedt.id('801')));
SELECT bedt.ok('private: the job is not touched', (SELECT lien_payment_bond = 'unknown' AND collections_at IS NULL FROM public.jobs_ledger WHERE id = bedt.id('12')));

-- 4 · Yes, public property: the answer, the bond on the ticked jobs, each onto the attorney's list, and what was held.
CREATE TEMP TABLE r_public ON COMMIT DROP AS
  SELECT public.set_property_lien_public_answer(
    bedt.id('800'), 'public', '  Public property. The owner of record is ZZ TEST CITY OF.  ',
    jsonb_build_array(
      jsonb_build_object('job_id', bedt.id('10'), 'note', 'Public property. A lien notice was mailed Oct 8.'),
      jsonb_build_object('job_id', bedt.id('11')),
      jsonb_build_object('job_id', bedt.id('12')),
      jsonb_build_object('job_id', bedt.id('13')),
      jsonb_build_object('job_id', bedt.id('77')),
      jsonb_build_object('job_id', 'not-a-job')
    ),
    'no') AS r;
SELECT bedt.ok('public: the press answers ok', (SELECT r->>'ok' = 'true' AND r->>'answer' = 'public' AND jsonb_array_length(r->'jobs') = 6 FROM r_public));
SELECT bedt.ok('public: the answer, the trimmed reason, who and when are on the record', (SELECT lien_public_answer = 'public' AND lien_public_reason = 'Public property. The owner of record is ZZ TEST CITY OF.' AND lien_public_answered_by = bedt.id('1') AND lien_public_answered_at IS NOT NULL FROM public.customer_addresses WHERE id = bedt.id('800')));
SELECT bedt.ok('a billed job: its bond is set and it goes on the attorney''s list', (SELECT bedt.line(r, '10') = jsonb_build_object('job_id', bedt.id('10'), 'bond_set', true, 'on_attorney_list', true, 'already_on_list', false, 'held', NULL) FROM r_public));
SELECT bedt.ok('a billed job: the Collections flag carries its own note', (SELECT lien_payment_bond = 'no' AND collections_at IS NOT NULL AND collections_by = bedt.id('1') AND collections_note = 'Public property. A lien notice was mailed Oct 8.' FROM public.jobs_ledger WHERE id = bedt.id('10')));
SELECT bedt.ok('a billed job: one Collections line on its activity', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('10') AND event_type = 'collections_change'));
SELECT bedt.ok('a job not billed: its bond is set, and the Collections flag''s own refusal is named', (SELECT bedt.line(r, '11') = jsonb_build_object('job_id', bedt.id('11'), 'bond_set', true, 'on_attorney_list', false, 'already_on_list', false, 'held', 'Job must be in Billed Awaiting Payment to change Collections') FROM r_public));
SELECT bedt.ok('a job not billed: not on the list, and the others went on', (SELECT lien_payment_bond = 'no' AND collections_at IS NULL FROM public.jobs_ledger WHERE id = bedt.id('11')));
SELECT bedt.ok('a job at another property is held and not written', (SELECT bedt.line(r, '12')->>'held' = 'This job is not at this property' AND (bedt.line(r, '12')->>'bond_set')::boolean IS FALSE FROM r_public) AND (SELECT lien_payment_bond = 'unknown' AND collections_at IS NULL FROM public.jobs_ledger WHERE id = bedt.id('12')));
SELECT bedt.ok('a job already on the list stays as it was, with its own note', (SELECT bedt.line(r, '13') = jsonb_build_object('job_id', bedt.id('13'), 'bond_set', true, 'on_attorney_list', true, 'already_on_list', true, 'held', NULL) FROM r_public) AND (SELECT collections_note = 'an older note' AND collections_at = '2026-10-01T15:00:00Z' AND lien_payment_bond = 'no' FROM public.jobs_ledger WHERE id = bedt.id('13')));
SELECT bedt.ok('a job nobody knows is held', (SELECT bedt.line(r, '77')->>'held' = 'Job not found' FROM r_public));
SELECT bedt.ok('a line that names no job is held', (SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'jobs') j WHERE j->>'job_id' IS NULL AND j->>'held' = 'No job was named') FROM r_public));

-- 5 · The same press again changes nothing but the stamp: no second flag, no second line, no bond written.
SELECT bedt.as_user('3');
CREATE TEMP TABLE r_again ON COMMIT DROP AS
  SELECT public.set_property_lien_public_answer(bedt.id('800'), 'public', 'Public property.', jsonb_build_array(jsonb_build_object('job_id', bedt.id('10'))), 'no') AS r;
SELECT bedt.ok('again: the job is already on the list and its bond already says so', (SELECT bedt.line(r, '10') = jsonb_build_object('job_id', bedt.id('10'), 'bond_set', false, 'on_attorney_list', true, 'already_on_list', true, 'held', NULL) FROM r_again));
SELECT bedt.ok('again: still one Collections line', (SELECT count(*) = 1 FROM public.job_activity_events WHERE job_id = bedt.id('10') AND event_type = 'collections_change'));
SELECT bedt.ok('again: the master''s press is the one on record', (SELECT lien_public_answered_by = bedt.id('3') FROM public.customer_addresses WHERE id = bedt.id('800')));
-- With no bond handed in, the jobs keep their own.
SELECT bedt.ok('no bond handed in: the press writes none', (SELECT (bedt.line(public.set_property_lien_public_answer(bedt.id('800'), 'public', 'Public property.', jsonb_build_array(jsonb_build_object('job_id', bedt.id('11')))), '11')->>'bond_set')::boolean IS FALSE));
SELECT bedt.ok('no bond handed in: the job keeps its own', (SELECT lien_payment_bond = 'no' FROM public.jobs_ledger WHERE id = bedt.id('11')));

-- 6 · Put it back on the lien path: a reason is asked, the answer goes, who, when and why stay, and no job is touched.
SELECT bedt.as_user('4');
SELECT bedt.ok('taking a public answer back needs a reason', public.set_property_lien_public_answer(bedt.id('800'), 'unanswered')->>'error' = 'Say why this property goes back on the lien path');
SELECT bedt.ok('so does calling it private after public', public.set_property_lien_public_answer(bedt.id('800'), 'private', '')->>'error' = 'Say why this property goes back on the lien path');
SELECT bedt.ok('refused, the answer is still public and still the master''s', (SELECT lien_public_answer = 'public' AND lien_public_answered_by = bedt.id('3') FROM public.customer_addresses WHERE id = bedt.id('800')));
SELECT bedt.ok('with a reason it goes back', public.set_property_lien_public_answer(bedt.id('800'), 'unanswered', 'The county sold the lot in 2025.') = '{"ok": true, "answer": null, "jobs": []}'::jsonb);
SELECT bedt.ok('back: unanswered, with who, when and why', (SELECT lien_public_answer IS NULL AND lien_public_reason = 'The county sold the lot in 2025.' AND lien_public_answered_by = bedt.id('4') AND lien_public_answered_at IS NOT NULL FROM public.customer_addresses WHERE id = bedt.id('800')));
SELECT bedt.ok('back: the job stays on the attorney''s list and keeps its bond', (SELECT collections_at IS NOT NULL AND lien_payment_bond = 'no' FROM public.jobs_ledger WHERE id = bedt.id('10')));
-- Taking back an answer that was private asks no reason.
SELECT bedt.as_user('5');
-- The press and the read of what it wrote are two statements: one statement would read the record as it stood before.
SELECT bedt.ok('a private answer is taken back with no reason', public.set_property_lien_public_answer(bedt.id('801'), 'unanswered')->>'ok' = 'true');
SELECT bedt.ok('and the record is unanswered again, with who took it back', (SELECT lien_public_answer IS NULL AND lien_public_answered_by = bedt.id('5') FROM public.customer_addresses WHERE id = bedt.id('801')));

DO $$ BEGIN RAISE NOTICE 'property_lien_public_answer PASSED'; END $$;
ROLLBACK;
