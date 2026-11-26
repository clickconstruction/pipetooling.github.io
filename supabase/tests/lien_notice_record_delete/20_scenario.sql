-- Presses nothing takes back (punch list #443, row 1): deleting a test notice record takes its Activity line too
-- (migration *_lien_notice_record_delete_test). delete_test_lien_notice_record deletes one voided § 53.056 notice
-- recorded by hand on a ZZ test job, with the line its insert wrote on the job's Activity.
-- delete_test_lien_notice_stray_lines clears the lines of records deleted before the first function existed.
-- Rosa the assistant and Malachi the job's own master are refused at both doors. Devon the dev is refused a live
-- record, a record on a real job, a notice the run made, an affidavit, a record each of the four ties points at and a
-- record that is not there. He deletes the one record with its one line, and its sibling, the sibling's line and a
-- line of another type stand. A record he deletes the old way, straight off the table, leaves its line, and the sweep
-- clears that line alone, refuses a real job untouched and answers zero the second time. A direct DELETE on
-- job_activity_events reaches no row for anyone. Fixtures made as postgres; everything runs inside one transaction
-- that rolls back. Raises on the first failed assertion; ends with "lien_notice_record_delete PASSED".
-- See scripts/pgtest-lien-notice-record-delete.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA lnd;
CREATE FUNCTION lnd.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004430' || p)::uuid $$;
CREATE FUNCTION lnd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lnd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The record door's answer in a few words: ok with the lines it took, or the refusal's words.
CREATE FUNCTION lnd.try(p_filing uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a jsonb;
BEGIN
  a := public.delete_test_lien_notice_record(p_filing);
  RETURN 'ok ' || (a ->> 'activity_lines');
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- The sweep's answer the same way.
CREATE FUNCTION lnd.sweep(p_job uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a jsonb;
BEGIN
  a := public.delete_test_lien_notice_stray_lines(p_job);
  RETURN 'ok ' || (a ->> 'activity_lines');
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A statement refused with words that hold `want`.
CREATE FUNCTION lnd.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A direct DELETE of a job's notice lines, tried as the signed-in person: how many rows it reached, or the refusal's
-- words. job_activity_events has a read policy and no other, so the schema's default grant reaches no row for anyone.
CREATE FUNCTION lnd.try_direct_lines(p_job uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.job_activity_events WHERE job_id = p_job AND event_type = 'lien_notice_sent';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text || ' row';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A direct DELETE of one record, the same way: the table's own policy lets a dev delete and nobody else.
CREATE FUNCTION lnd.try_direct_record(p_filing uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.job_lien_filings WHERE id = p_filing;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text || ' row';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- What stands, past RLS: the two jobs' records by their last two hex digits, in order.
CREATE FUNCTION lnd.records() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(id::text, 2), ' ' ORDER BY id), '') FROM public.job_lien_filings WHERE job_id IN (lnd.id('d1'), lnd.id('d2'))
$$;
-- A job's Activity lines, past RLS, as words in order: "notice:e1" is a lien_notice_sent line that names record e1,
-- "notice:-" one that names nothing, "other:e1" the bed's line of another type. Lines other triggers wrote are left out.
CREATE FUNCTION lnd.lines(p_job uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(w.word, ' ' ORDER BY w.word COLLATE "C"), '')
  FROM (
    SELECT CASE e.event_type WHEN 'lien_notice_sent' THEN 'notice' ELSE 'other' END || ':' || coalesce(nullif(right(e.detail ->> 'source_id', 2), ''), '-') AS word
    FROM public.job_activity_events e
    WHERE e.job_id = p_job AND e.event_type IN ('lien_notice_sent', 'lnd_bed_other')
  ) w
$$;
-- What points at the tied records, past RLS: nothing the functions refuse may be cleared on the way.
CREATE FUNCTION lnd.ties() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'paper ' || coalesce((SELECT right(i.sent_filing_id::text, 2) FROM public.job_lien_desk_items i WHERE i.id = lnd.id('c1')), '-')
      || ' / bill ' || coalesce((SELECT right(b.lien_offer_filing_id::text, 2) FROM public.jobs_ledger_invoices b WHERE b.id = lnd.id('b1')), '-')
      || ' / applied ' || coalesce((SELECT right(f.applied_from::text, 2) FROM public.job_lien_filings f WHERE f.id = lnd.id('ea')), '-')
      || ' / copies ' || (SELECT count(*) FROM public.sent_documents s WHERE s.source_table = 'job_lien_filings' AND s.source_id = lnd.id('eb'))::text
$$;
GRANT USAGE ON SCHEMA lnd TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lnd TO anon, authenticated, service_role;

-- Who: Devon the dev, Rosa the assistant, Malachi the master both jobs are under.
INSERT INTO auth.users (id, email) VALUES (lnd.id('a1'), 'devon@noticedelete.test'), (lnd.id('a2'), 'rosa@noticedelete.test'), (lnd.id('a3'), 'malachi@noticedelete.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  (lnd.id('a1'), 'devon@noticedelete.test', 'Devon Dev Lnd', 'dev', false, false),
  (lnd.id('a2'), 'rosa@noticedelete.test', 'Rosa Office Lnd', 'assistant', false, false),
  (lnd.id('a3'), 'malachi@noticedelete.test', 'Malachi Master Lnd', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Two jobs: d1 a ZZ Test job, d2 a real-named one (a made-up name).
INSERT INTO public.service_types (id, name) VALUES (lnd.id('f0'), 'Notice delete bed work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  (lnd.id('d1'), lnd.id('a3'), lnd.id('f0'), 'J44301', 'ZZ Test notice delete job', 'ZZ Test GC', 'gc', 1000, 0, 'billed'),
  (lnd.id('d2'), lnd.id('a3'), lnd.id('f0'), 'J44302', 'Harbor Row Lot 4', 'Harbor Row Builders', 'gc', 1000, 0, 'billed');

-- The records, every one made live so its insert writes its own line as on prod, then voided where the case asks.
--   e1  ZZ job, by hand, voided: the one that goes.          e2  ZZ job, by hand, voided: its sibling, which stays.
--   e3  ZZ job, by hand, live.                               e4  real job, by hand, voided.
--   e5  ZZ job, a notice the run made, voided.               e6  ZZ job, an affidavit, voided.
--   e7  ZZ job, by hand, voided, a desk paper tied to it.    e8  ZZ job, by hand, voided, a bill's pay offer names it.
--   e9  ZZ job, by hand, voided, record ea applied from it.  eb  ZZ job, by hand, voided, two sent copies name it.
--   ec  ZZ job, by hand, voided: deleted the old way below, straight off the table, so its line is left.
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, months_covered, by_hand, created_by) VALUES
  (lnd.id('e1'), lnd.id('d1'), 'notice_53_056', 100, '{2026-08}', true, lnd.id('a2')),
  (lnd.id('e2'), lnd.id('d1'), 'notice_53_056', 100, '{2026-09}', true, lnd.id('a2')),
  (lnd.id('e3'), lnd.id('d1'), 'notice_53_056', 100, '{2026-10}', true, lnd.id('a2')),
  (lnd.id('e4'), lnd.id('d2'), 'notice_53_056', 100, '{2026-08}', true, lnd.id('a2')),
  (lnd.id('e5'), lnd.id('d1'), 'notice_53_056', 100, '{2026-07}', false, lnd.id('a2')),
  (lnd.id('e7'), lnd.id('d1'), 'notice_53_056', 100, '{2026-06}', true, lnd.id('a2')),
  (lnd.id('e8'), lnd.id('d1'), 'notice_53_056', 100, '{2026-05}', true, lnd.id('a2')),
  (lnd.id('e9'), lnd.id('d1'), 'notice_53_056', 100, '{2026-04}', true, lnd.id('a2')),
  (lnd.id('eb'), lnd.id('d1'), 'notice_53_056', 100, '{2026-03}', true, lnd.id('a2')),
  (lnd.id('ec'), lnd.id('d1'), 'notice_53_056', 100, '{2026-02}', true, lnd.id('a2'));
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, filed_at, by_hand, created_by) VALUES
  (lnd.id('e6'), lnd.id('d1'), 'affidavit', 100, '2026-11-16', true, lnd.id('a2'));
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, months_covered, applied_from, created_by) VALUES
  (lnd.id('ea'), lnd.id('d1'), 'notice_53_056', 100, '{2026-04}', lnd.id('e9'), lnd.id('a2'));
UPDATE public.job_lien_filings SET voided_at = now() WHERE id IN (lnd.id('e1'), lnd.id('e2'), lnd.id('e4'), lnd.id('e5'), lnd.id('e6'), lnd.id('e7'), lnd.id('e8'), lnd.id('e9'), lnd.id('eb'), lnd.id('ec'));
-- The ties, made after the voids: voiding a record clears the desk paper tied to it, so this paper is tied to one already voided.
INSERT INTO public.job_lien_desk_items (id, job_id, kind, status, drafted_by, sent_filing_id, sent_at) VALUES
  (lnd.id('c1'), lnd.id('d1'), 'notice_53_056', 'sent', lnd.id('a2'), lnd.id('e7'), now());
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at, lien_offer_filing_id) VALUES
  (lnd.id('b1'), lnd.id('d1'), 0, 'billed', 100, now(), lnd.id('e8'));
INSERT INTO public.sent_documents (kind, how, source_table, source_id) VALUES
  ('lien_notice_53_056', 'print', 'job_lien_filings', lnd.id('eb')),
  ('lien_notice_53_056', 'email', 'job_lien_filings', lnd.id('eb'));
-- Lines no record's insert wrote. On the ZZ job: a line of another type that names record e1, a line of another type
-- that names no record, and a notice line that names nothing. On the real job: a notice line whose record is gone.
INSERT INTO public.job_activity_events (job_id, event_type, summary, detail, financial) VALUES
  (lnd.id('d1'), 'lnd_bed_other', 'Another kind of line that names record e1', jsonb_build_object('source_id', lnd.id('e1')::text), true),
  (lnd.id('d1'), 'lnd_bed_other', 'Another kind of line that names no record', jsonb_build_object('source_id', lnd.id('f3')::text), true),
  (lnd.id('d1'), 'lien_notice_sent', 'A notice line that names nothing', '{}'::jsonb, true),
  (lnd.id('d2'), 'lien_notice_sent', 'A notice line on the real job whose record is gone', jsonb_build_object('source_id', lnd.id('f2')::text), true);

SELECT lnd.same('twelve records stand', lnd.records(), 'e1 e2 e3 e4 e5 e6 e7 e8 e9 ea eb ec');
SELECT lnd.same('each notice wrote its line on the ZZ job, and the affidavit none', lnd.lines(lnd.id('d1')),
  'notice:- notice:e1 notice:e2 notice:e3 notice:e5 notice:e7 notice:e8 notice:e9 notice:ea notice:eb notice:ec other:e1 other:f3');
SELECT lnd.same('the real job holds its record''s line and the stray', lnd.lines(lnd.id('d2')), 'notice:e4 notice:f2');
SELECT lnd.same('the four ties stand', lnd.ties(), 'paper e7 / bill e8 / applied e9 / copies 2');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Rosa the assistant is refused at both doors, and deletes no row herself.
SELECT lnd.as_user(lnd.id('a2'));
SET LOCAL ROLE authenticated;
SELECT lnd.same('an assistant is refused at the record door', lnd.try(lnd.id('e1')), 'Only a developer can delete a notice record.');
SELECT lnd.same('an assistant is refused at the sweep', lnd.sweep(lnd.id('d1')), 'Only a developer can clear Activity lines.');
SELECT lnd.same('an assistant''s direct delete of a record reaches no row', lnd.try_direct_record(lnd.id('e1')), '0 row');
SELECT lnd.same('an assistant''s direct delete of the lines reaches no row', lnd.try_direct_lines(lnd.id('d1')), '0 row');
RESET ROLE;

-- 2. Malachi, the master both jobs are under, is refused the same way.
SELECT lnd.as_user(lnd.id('a3'));
SET LOCAL ROLE authenticated;
SELECT lnd.same('the job''s master is refused at the record door', lnd.try(lnd.id('e1')), 'Only a developer can delete a notice record.');
SELECT lnd.same('the job''s master is refused at the sweep', lnd.sweep(lnd.id('d1')), 'Only a developer can clear Activity lines.');
SELECT lnd.same('the master''s direct delete of a record reaches no row', lnd.try_direct_record(lnd.id('e1')), '0 row');
SELECT lnd.same('the master''s direct delete of the lines reaches no row', lnd.try_direct_lines(lnd.id('d1')), '0 row');
RESET ROLE;
SELECT lnd.same('nothing changed: the records', lnd.records(), 'e1 e2 e3 e4 e5 e6 e7 e8 e9 ea eb ec');
SELECT lnd.same('nothing changed: the lines', lnd.lines(lnd.id('d1')),
  'notice:- notice:e1 notice:e2 notice:e3 notice:e5 notice:e7 notice:e8 notice:e9 notice:ea notice:eb notice:ec other:e1 other:f3');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Devon the dev: each refusal of the record door with its words, then the one delete.
SELECT lnd.as_user(lnd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT lnd.same('a live record is refused', lnd.try(lnd.id('e3')), 'Void this record first.');
SELECT lnd.same('a record on a real job is refused', lnd.try(lnd.id('e4')), 'Only a record on a test job can be deleted. This job is a real one.');
SELECT lnd.same('a notice the run made is refused', lnd.try(lnd.id('e5')), 'Only a notice recorded by hand can be deleted.');
SELECT lnd.same('an affidavit is refused', lnd.try(lnd.id('e6')), 'Only a notice recorded by hand can be deleted.');
SELECT lnd.same('a record a desk paper is tied to is refused', lnd.try(lnd.id('e7')), 'A paper on the Lien desk is tied to this record. It stays.');
SELECT lnd.same('a record a bill''s pay offer names is refused', lnd.try(lnd.id('e8')), 'A bill’s pay offer names this record. It stays.');
SELECT lnd.same('a record another was applied from is refused', lnd.try(lnd.id('e9')), 'Another record was applied from this one. It stays.');
SELECT lnd.same('a record two sent copies name is refused, with the count', lnd.try(lnd.id('eb')), '2 sent copies name this record. It stays.');
SELECT lnd.same('a record that is not there is refused', lnd.try(lnd.id('f9')), 'The record is not there any more. Read the window again.');
SELECT lnd.same('nothing changed yet: the records', lnd.records(), 'e1 e2 e3 e4 e5 e6 e7 e8 e9 ea eb ec');
SELECT lnd.same('nothing changed yet: the lines', lnd.lines(lnd.id('d1')),
  'notice:- notice:e1 notice:e2 notice:e3 notice:e5 notice:e7 notice:e8 notice:e9 notice:ea notice:eb notice:ec other:e1 other:f3');
SELECT lnd.same('nothing changed yet: the ties', lnd.ties(), 'paper e7 / bill e8 / applied e9 / copies 2');
SELECT lnd.same('a dev''s direct delete of the lines reaches no row either', lnd.try_direct_lines(lnd.id('d1')), '0 row');

SELECT lnd.same('the voided by-hand record goes, with its one line', lnd.try(lnd.id('e1')), 'ok 1');
SELECT lnd.same('the record is gone and every other stands', lnd.records(), 'e2 e3 e4 e5 e6 e7 e8 e9 ea eb ec');
SELECT lnd.same('its line is gone; its sibling''s line and the line of another type that named it stand', lnd.lines(lnd.id('d1')),
  'notice:- notice:e2 notice:e3 notice:e5 notice:e7 notice:e8 notice:e9 notice:ea notice:eb notice:ec other:e1 other:f3');
SELECT lnd.same('the real job is as it was', lnd.lines(lnd.id('d2')), 'notice:e4 notice:f2');
SELECT lnd.same('a second delete of the same record is refused', lnd.try(lnd.id('e1')), 'The record is not there any more. Read the window again.');

-- 4. The sweep. Record ec goes the old way, as the Lien window deleted before this migration: straight off the table,
-- under the table's own dev policy. Its line is left, as three were on prod.
SELECT lnd.same('the old way deletes the record', lnd.try_direct_record(lnd.id('ec')), '1 row');
SELECT lnd.same('and leaves its line', lnd.lines(lnd.id('d1')),
  'notice:- notice:e2 notice:e3 notice:e5 notice:e7 notice:e8 notice:e9 notice:ea notice:eb notice:ec other:e1 other:f3');
SELECT lnd.same('the sweep refuses a real job', lnd.sweep(lnd.id('d2')), 'Only a test job’s Activity lines can be cleared. This job is a real one.');
SELECT lnd.same('the real job''s stray line is untouched', lnd.lines(lnd.id('d2')), 'notice:e4 notice:f2');
SELECT lnd.same('the sweep refuses a job that is not there', lnd.sweep(lnd.id('f8')), 'The job is not there any more.');
SELECT lnd.same('the sweep clears the one line whose record is gone', lnd.sweep(lnd.id('d1')), 'ok 1');
SELECT lnd.same('every line that names a standing record, names nothing or is of another type stands', lnd.lines(lnd.id('d1')),
  'notice:- notice:e2 notice:e3 notice:e5 notice:e7 notice:e8 notice:e9 notice:ea notice:eb other:e1 other:f3');
SELECT lnd.same('a second sweep answers zero', lnd.sweep(lnd.id('d1')), 'ok 0');
SELECT lnd.same('no record went with the sweep', lnd.records(), 'e2 e3 e4 e5 e6 e7 e8 e9 ea eb');
SELECT lnd.same('the four ties still stand', lnd.ties(), 'paper e7 / bill e8 / applied e9 / copies 2');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Nobody signed in. With no claims the functions say so; as anon the call is refused at the door, since both are
-- revoked from anon.
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', '', true);
SELECT lnd.same('with nobody signed in the record door says so', lnd.try(lnd.id('e2')), 'Sign in first.');
SELECT lnd.same('with nobody signed in the sweep says so', lnd.sweep(lnd.id('d1')), 'Sign in first.');
SET LOCAL ROLE anon;
SELECT lnd.refused('signed out, the record door refuses', format($q$SELECT public.delete_test_lien_notice_record(%L)$q$, lnd.id('e2')), 'permission denied');
SELECT lnd.refused('signed out, the sweep refuses', format($q$SELECT public.delete_test_lien_notice_stray_lines(%L)$q$, lnd.id('d1')), 'permission denied');
RESET ROLE;
SELECT lnd.same('the sibling record and its line stand to the end', lnd.records() || ' | ' || lnd.lines(lnd.id('d1')),
  'e2 e3 e4 e5 e6 e7 e8 e9 ea eb | notice:- notice:e2 notice:e3 notice:e5 notice:e7 notice:e8 notice:e9 notice:ea notice:eb other:e1 other:f3');

DO $$ BEGIN RAISE NOTICE 'lien_notice_record_delete PASSED'; END $$;
ROLLBACK;
