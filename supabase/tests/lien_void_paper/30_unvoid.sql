-- Presses nothing takes back (punch list #443, row 2): a voided test lien record can be put back
-- (migration *_lien_filing_unvoid_test). A void now remembers, on each desk paper it moves, the record, the sent day
-- it cleared and when it wrote the paper. unvoid_test_lien_filing clears the record's voided_at and undoes what the
-- void did to each paper, for a dev on a ZZ test job alone.
--
-- Rosa the office voids, as the Lien window's Void writes it. A paper put back approved, a paper put back as a draft,
-- an affidavit's paper and a paper set aside each come back exactly as they stood before the void: the record's row
-- compared whole, the paper's row compared whole but for updated_at, which the guard stamps on every write. A record
-- with no paper, a retainage notice and a second round trip. Each refusal with its own sentence: nobody signed in, an
-- assistant, the job's master, a record that is not there, a live record, a record that applied a paper already on
-- record, a real job, a paper that moved on four ways (sent again as a new record, touched by a later void, written
-- since the void, held), and a record voided before the memory was kept on a job that held a paper of its kind by
-- then. No rule holds one live record per job or per month, so no refusal for that exists to play.
-- Fixtures are made as postgres. Everything runs inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "lien_void_paper PASSED". See scripts/pgtest-lien-void-paper.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA lfu;
CREATE FUNCTION lfu.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004432' || p)::uuid $$;
CREATE FUNCTION lfu.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lfu.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The door's answer in a few words: ok with what it did to the papers, or the refusal's words.
CREATE FUNCTION lfu.try(p text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a jsonb;
BEGIN
  a := public.unvoid_test_lien_filing(lfu.id(p));
  RETURN 'ok ' || (a ->> 'kind') || ', restored ' || (a ->> 'papers_restored') || ', unset ' || (a ->> 'papers_unset_aside');
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A statement refused with words that hold `want`.
CREATE FUNCTION lfu.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- One write as whoever is signed in: 'ok N' with the rows it reached, or the refusal's words.
CREATE FUNCTION lfu.run(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'ok ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- The Lien window's Void (voidLienFiling): one column, with the day the pressing device says it is.
CREATE FUNCTION lfu.void(p text, p_at timestamptz) RETURNS text LANGUAGE sql AS $$
  SELECT lfu.run(format('UPDATE public.job_lien_filings SET voided_at = %L WHERE id = %L', p_at, lfu.id(p)))
$$;
-- markLienDeskItemSent's write (src/lib/jobs/lienDeskIo.ts): the paper sent, tied to its record, on a given day.
CREATE FUNCTION lfu.send(p_paper text, p_filing text, p_at timestamptz) RETURNS text LANGUAGE sql AS $$
  SELECT lfu.run(format('UPDATE public.job_lien_desk_items SET status = ''sent'', sent_filing_id = %L, sent_at = %L WHERE id = %L', lfu.id(p_filing), p_at, lfu.id(p_paper)))
$$;
-- A day past the memory's first instant, and a day before it. Internal function, so asked past the caller's grants.
CREATE FUNCTION lfu.after() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.lien_void_memory_since() + interval '1 hour' $$;
CREATE FUNCTION lfu.before() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.lien_void_memory_since() - interval '30 days' $$;
-- A paper as words, past RLS: status / its tie / its sent day / set aside.
CREATE FUNCTION lfu.paper(p text) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT i.status
      || ' / ' || coalesce('tied ' || right(i.sent_filing_id::text, 2), 'no tie')
      || ' / ' || CASE WHEN i.sent_at IS NULL THEN 'no sent day' WHEN i.sent_at = '2026-11-12 09:00:00+00'::timestamptz THEN 'sent Nov 12' ELSE 'another sent day' END
      || CASE WHEN i.voided_at IS NULL THEN '' ELSE ' / set aside' END
    FROM public.job_lien_desk_items i WHERE i.id = lfu.id(p)), 'no row')
$$;
-- What a paper remembers of a void, past RLS: the records in order / the sent day kept / whether it was written since.
CREATE FUNCTION lfu.memory(p text) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT coalesce((SELECT string_agg(right(u.x::text, 2), ' ' ORDER BY u.o) FROM unnest(i.void_of_filing_ids) WITH ORDINALITY AS u(x, o)), 'no record')
      || ' / ' || CASE WHEN i.void_prior_sent_at IS NULL THEN 'no day kept' WHEN i.void_prior_sent_at = '2026-11-12 09:00:00+00'::timestamptz THEN 'Nov 12 kept' ELSE 'another day kept' END
      || ' / ' || CASE WHEN i.void_stamped_at IS NULL THEN 'no stamp' WHEN i.void_stamped_at = i.updated_at THEN 'not written since' ELSE 'written since' END
    FROM public.job_lien_desk_items i WHERE i.id = lfu.id(p)), 'no row')
$$;
-- A record's whole row, and a paper's whole row but for updated_at, which the guard stamps on every write.
CREATE FUNCTION lfu.record_row(p text) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT to_jsonb(f)::text FROM public.job_lien_filings f WHERE f.id = lfu.id(p)), 'no row')
$$;
CREATE FUNCTION lfu.paper_row(p text) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT (to_jsonb(i) - 'updated_at')::text FROM public.job_lien_desk_items i WHERE i.id = lfu.id(p)), 'no row')
$$;
-- Rows kept from before a void, to hold against what stands after the un-void.
CREATE TABLE lfu.kept (k text PRIMARY KEY, v text NOT NULL);
CREATE FUNCTION lfu.keep(p text) RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO lfu.kept (k, v) VALUES (p, CASE WHEN left(p, 1) = 'c' THEN lfu.paper_row(p) ELSE lfu.record_row(p) END)
  ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v
$$;
CREATE FUNCTION lfu.as_kept(label text, p text) RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT lfu.same(label, CASE WHEN left(p, 1) = 'c' THEN lfu.paper_row(p) ELSE lfu.record_row(p) END, (SELECT v FROM lfu.kept WHERE k = p))
$$;
-- A job's Activity lines, past RLS, as a count.
CREATE FUNCTION lfu.lines(p text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM public.job_activity_events e WHERE e.job_id = lfu.id(p)
$$;
GRANT USAGE ON SCHEMA lfu TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lfu TO anon, authenticated, service_role;

-- Who: Devon the dev, Rosa the assistant, Malachi the master every job is under.
INSERT INTO auth.users (id, email) VALUES (lfu.id('a1'), 'devon@unvoid.test'), (lfu.id('a2'), 'rosa@unvoid.test'), (lfu.id('a3'), 'malachi@unvoid.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  (lfu.id('a1'), 'devon@unvoid.test', 'Devon Dev Lfu', 'dev', false, false),
  (lfu.id('a2'), 'rosa@unvoid.test', 'Rosa Office Lfu', 'assistant', false, false),
  (lfu.id('a3'), 'malachi@unvoid.test', 'Malachi Master Lfu', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Twelve ZZ Test jobs, d1 to dc, and one real-named job, b1 (a made-up name).
INSERT INTO public.service_types (id, name) VALUES (lfu.id('f0'), 'Unvoid bed work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status)
SELECT lfu.id('d' || to_hex(n)), lfu.id('a3'), lfu.id('f0'), 'J4432' || to_hex(n), 'ZZ Test unvoid job ' || n, 'ZZ Test GC', 'gc', 1000, 0, 'billed'
FROM generate_series(1, 12) AS n;
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  (lfu.id('b1'), lfu.id('a3'), lfu.id('f0'), 'J44320', 'Harbor Row Lot 6', 'Harbor Row Builders', 'gc', 1000, 0, 'billed');

-- The papers. The leader's approvals are made under his own sign-in, as the guard asks.
--   c1  d1, a notice he approved.               c2  d2, a notice nobody approved.
--   c3  d3, an affidavit he approved.            c4  d4, a notice he approved; a newer draft c5 comes after it is sent.
--   c6  d6, a retainage notice.                  c7  d7, a notice he approved, sent twice.
--   c8  d8, a notice he approved.                c9  d9, a notice nobody approved.
--   ca  da, a notice draft made long before the memory.   cb  db, a notice draft made today, and cd, an old affidavit draft.
--   cc  dc, a notice he approved.
SELECT lfu.as_user(lfu.id('a3'));
INSERT INTO public.job_lien_desk_items (id, job_id, kind, status, approval_mode, approved_by, approved_at, drafted_by) VALUES
  (lfu.id('c1'), lfu.id('d1'), 'notice_53_056', 'approved', 'leader', lfu.id('a3'), '2026-11-10 10:00:00+00', lfu.id('a2')),
  (lfu.id('c2'), lfu.id('d2'), 'notice_53_056', 'drafted', NULL, NULL, NULL, lfu.id('a2')),
  (lfu.id('c3'), lfu.id('d3'), 'affidavit', 'approved', 'leader', lfu.id('a3'), '2026-11-10 10:00:00+00', lfu.id('a2')),
  (lfu.id('c4'), lfu.id('d4'), 'notice_53_056', 'approved', 'leader', lfu.id('a3'), '2026-11-10 10:00:00+00', lfu.id('a2')),
  (lfu.id('c6'), lfu.id('d6'), 'retainage_53_057', 'drafted', NULL, NULL, NULL, lfu.id('a2')),
  (lfu.id('c7'), lfu.id('d7'), 'notice_53_056', 'approved', 'leader', lfu.id('a3'), '2026-11-10 10:00:00+00', lfu.id('a2')),
  (lfu.id('c8'), lfu.id('d8'), 'notice_53_056', 'approved', 'leader', lfu.id('a3'), '2026-11-10 10:00:00+00', lfu.id('a2')),
  (lfu.id('c9'), lfu.id('d9'), 'notice_53_056', 'drafted', NULL, NULL, NULL, lfu.id('a2')),
  (lfu.id('cb'), lfu.id('db'), 'notice_53_056', 'drafted', NULL, NULL, NULL, lfu.id('a2')),
  (lfu.id('cc'), lfu.id('dc'), 'notice_53_056', 'approved', 'leader', lfu.id('a3'), '2026-11-10 10:00:00+00', lfu.id('a2'));
INSERT INTO public.job_lien_desk_items (id, job_id, kind, status, drafted_by, created_at) VALUES
  (lfu.id('ca'), lfu.id('da'), 'notice_53_056', 'drafted', lfu.id('a2'), lfu.before() - interval '30 days'),
  (lfu.id('cd'), lfu.id('db'), 'affidavit', 'drafted', lfu.id('a2'), lfu.before() - interval '30 days');

-- The records, each made live as the office makes it.
--   e1 e2  notices of d1 and d2.          e3  d3's filed affidavit.          e4  d4's notice.
--   e5  d4, a notice by hand, no paper.   e6  d5, a notice by hand, no paper, on a job with no paper at all.
--   e8  d6's retainage notice.            e9  d7's first notice. ea, its second, is made below.
--   eb  d8's notice.                      ec  d9's notice.
--   ed  da, a notice by hand, voided before the memory.     ee  db, the same.     ef  dc's notice.
--   f1  the real job's notice.   f2  d5, applied from e6.   f3  d5, a notice by hand that stays live.
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, months_covered, by_hand, created_by) VALUES
  (lfu.id('e1'), lfu.id('d1'), 'notice_53_056', 100, '{2026-08}', false, lfu.id('a2')),
  (lfu.id('e2'), lfu.id('d2'), 'notice_53_056', 100, '{2026-08}', false, lfu.id('a2')),
  (lfu.id('e4'), lfu.id('d4'), 'notice_53_056', 100, '{2026-08}', false, lfu.id('a2')),
  (lfu.id('e5'), lfu.id('d4'), 'notice_53_056', 100, '{2026-07}', true, lfu.id('a2')),
  (lfu.id('e6'), lfu.id('d5'), 'notice_53_056', 100, '{2026-08}', true, lfu.id('a2')),
  (lfu.id('e8'), lfu.id('d6'), 'retainage_53_057', 100, '{}', false, lfu.id('a2')),
  (lfu.id('e9'), lfu.id('d7'), 'notice_53_056', 100, '{2026-08}', false, lfu.id('a2')),
  (lfu.id('eb'), lfu.id('d8'), 'notice_53_056', 100, '{2026-08}', false, lfu.id('a2')),
  (lfu.id('ec'), lfu.id('d9'), 'notice_53_056', 100, '{2026-08}', false, lfu.id('a2')),
  (lfu.id('ed'), lfu.id('da'), 'notice_53_056', 100, '{2026-08}', true, lfu.id('a2')),
  (lfu.id('ee'), lfu.id('db'), 'notice_53_056', 100, '{2026-08}', true, lfu.id('a2')),
  (lfu.id('ef'), lfu.id('dc'), 'notice_53_056', 100, '{2026-08}', false, lfu.id('a2')),
  (lfu.id('f1'), lfu.id('b1'), 'notice_53_056', 100, '{2026-08}', true, lfu.id('a2')),
  (lfu.id('f3'), lfu.id('d5'), 'notice_53_056', 100, '{2026-06}', true, lfu.id('a2'));
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, filed_at, county, recording_number, created_by) VALUES
  (lfu.id('e3'), lfu.id('d3'), 'affidavit', 100, '2026-11-16', 'ZZ TEST', 'ZZ-TEST-4432', lfu.id('a2'));
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, months_covered, applied_from, applied_from_label, created_by) VALUES
  (lfu.id('f2'), lfu.id('d5'), 'notice_53_056', 100, '{2026-08}', lfu.id('e6'), 'J44325', lfu.id('a2'));

-- Each paper sent and tied to its record on Nov 12, as the run records a mailing.
SELECT lfu.as_user(lfu.id('a2'));
SELECT lfu.same('the papers are sent, each tied to its record',
  lfu.send('c1', 'e1', '2026-11-12 09:00:00+00') || ', ' || lfu.send('c2', 'e2', '2026-11-12 09:00:00+00') || ', ' || lfu.send('c3', 'e3', '2026-11-12 09:00:00+00') || ', '
    || lfu.send('c4', 'e4', '2026-11-12 09:00:00+00') || ', ' || lfu.send('c6', 'e8', '2026-11-12 09:00:00+00') || ', ' || lfu.send('c7', 'e9', '2026-11-12 09:00:00+00') || ', '
    || lfu.send('c8', 'eb', '2026-11-12 09:00:00+00') || ', ' || lfu.send('c9', 'ec', '2026-11-12 09:00:00+00') || ', ' || lfu.send('cc', 'ef', '2026-11-12 09:00:00+00'),
  'ok 1, ok 1, ok 1, ok 1, ok 1, ok 1, ok 1, ok 1, ok 1');
-- d4's newer draft, allowed while the first paper is sent.
INSERT INTO public.job_lien_desk_items (id, job_id, kind, status, drafted_by) VALUES (lfu.id('c5'), lfu.id('d4'), 'notice_53_056', 'drafted', lfu.id('a2'));

SELECT lfu.same('the fixture: paper c1 is sent and tied, and remembers nothing', lfu.paper('c1') || ' | ' || lfu.memory('c1'), 'sent / tied e1 / sent Nov 12 | no record / no day kept / no stamp');
-- Every row as it stands before its void.
SELECT lfu.keep(p) FROM unnest(ARRAY['e1', 'c1', 'e2', 'c2', 'e3', 'c3', 'e4', 'c4', 'c5', 'e5', 'e6', 'e8', 'c6', 'eb', 'c8', 'ef', 'cc', 'ee', 'cb', 'cd']) AS p;
-- How many lines d1's Activity holds before anything is voided.
SELECT set_config('lfu.lines_d1', lfu.lines('d1'), true);

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Rosa voids, as the Lien window's Void writes it, on a day past the memory's first instant. A void does to a
-- paper what it did before, and each paper it moves now remembers the record, the sent day it cleared and the write.
SET LOCAL ROLE authenticated;
SELECT lfu.same('Rosa voids eight records', lfu.void('e1', lfu.after()) || ', ' || lfu.void('e2', lfu.after()) || ', ' || lfu.void('e3', lfu.after()) || ', ' || lfu.void('e4', lfu.after())
  || ', ' || lfu.void('e5', lfu.after()) || ', ' || lfu.void('e6', lfu.after()) || ', ' || lfu.void('e8', lfu.before()) || ', ' || lfu.void('f2', lfu.after()),
  'ok 1, ok 1, ok 1, ok 1, ok 1, ok 1, ok 1, ok 1');
SELECT lfu.same('an approved notice is back on the desk approved, and remembers', lfu.paper('c1') || ' | ' || lfu.memory('c1'), 'approved / no tie / no sent day | e1 / Nov 12 kept / not written since');
SELECT lfu.same('a notice nobody approved is back as a draft, and remembers', lfu.paper('c2') || ' | ' || lfu.memory('c2'), 'drafted / no tie / no sent day | e2 / Nov 12 kept / not written since');
SELECT lfu.same('an affidavit''s paper is back approved, and remembers', lfu.paper('c3') || ' | ' || lfu.memory('c3'), 'approved / no tie / no sent day | e3 / Nov 12 kept / not written since');
SELECT lfu.same('a paper with a newer draft beside it is set aside, keeps its tie and day, and remembers', lfu.paper('c4') || ' | ' || lfu.memory('c4'), 'sent / tied e4 / sent Nov 12 / set aside | e4 / no day kept / not written since');
SELECT lfu.as_kept('the newer draft is untouched by the void', 'c5');
SELECT lfu.as_kept('a retainage notice''s paper is untouched by its record''s void', 'c6');
SELECT lfu.same('and it remembers nothing', lfu.memory('c6'), 'no record / no day kept / no stamp');

-- 2. Rosa the assistant and Malachi the job's master are refused, and nothing moves.
SELECT lfu.same('an assistant is refused', lfu.try('e1'), 'Only a developer can put a voided record back.');
RESET ROLE;
SELECT lfu.as_user(lfu.id('a3'));
SET LOCAL ROLE authenticated;
SELECT lfu.same('the job''s master is refused', lfu.try('e1'), 'Only a developer can put a voided record back.');
RESET ROLE;
SELECT lfu.same('nothing moved', lfu.paper('c1') || ' | ' || lfu.memory('c1'), 'approved / no tie / no sent day | e1 / Nov 12 kept / not written since');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Devon the dev: the refusals that read the record alone.
SELECT lfu.as_user(lfu.id('a1'));
SET LOCAL ROLE authenticated;
SELECT lfu.same('a record that is not there is refused', lfu.try('ff'), 'The record is not there any more. Read the window again.');
SELECT lfu.same('a live record is refused', lfu.try('f3'), 'This record is not voided.');
SELECT lfu.same('a record that applied a paper already on record is refused', lfu.try('f2'), 'This record applied a paper already on record. Undo was its take-back. It stays voided.');
SELECT lfu.same('the real job''s record is voided', lfu.void('f1', lfu.after()), 'ok 1');
SELECT lfu.same('a record on a real job is refused', lfu.try('f1'), 'Only a record on a test job can be put back. This job is a real one.');

-- 4. Devon puts each record back, and every row stands as it stood before its void.
SELECT lfu.same('a notice whose paper went back approved', lfu.try('e1'), 'ok notice_53_056, restored 1, unset 0');
SELECT lfu.as_kept('its record is exactly as before the void', 'e1');
SELECT lfu.as_kept('its paper is as before the void, but for updated_at', 'c1');
SELECT lfu.same('the paper is sent, tied, on its old day, and remembers nothing', lfu.paper('c1') || ' | ' || lfu.memory('c1'), 'sent / tied e1 / sent Nov 12 | no record / no day kept / no stamp');
SELECT lfu.same('the job''s Activity holds what it held before the void', lfu.lines('d1'), current_setting('lfu.lines_d1'));
SELECT lfu.same('a second press is refused: the record is live', lfu.try('e1'), 'This record is not voided.');

SELECT lfu.same('a notice whose paper went back as a draft', lfu.try('e2'), 'ok notice_53_056, restored 1, unset 0');
SELECT lfu.as_kept('its record is exactly as before the void', 'e2');
SELECT lfu.as_kept('its paper is as before the void, but for updated_at', 'c2');

SELECT lfu.same('a filed affidavit', lfu.try('e3'), 'ok affidavit, restored 1, unset 0');
SELECT lfu.as_kept('its record is exactly as before the void', 'e3');
SELECT lfu.as_kept('its paper is as before the void, but for updated_at', 'c3');

SELECT lfu.same('a notice whose paper was set aside', lfu.try('e4'), 'ok notice_53_056, restored 0, unset 1');
SELECT lfu.as_kept('its record is exactly as before the void', 'e4');
SELECT lfu.as_kept('its paper is as before the void, but for updated_at', 'c4');
SELECT lfu.as_kept('the newer draft beside it is untouched', 'c5');
SELECT lfu.same('the old paper stands sent, and remembers nothing', lfu.paper('c4') || ' | ' || lfu.memory('c4'), 'sent / tied e4 / sent Nov 12 | no record / no day kept / no stamp');

SELECT lfu.same('a record with no paper, on a job that holds papers of its kind', lfu.try('e5'), 'ok notice_53_056, restored 0, unset 0');
SELECT lfu.as_kept('its record is exactly as before the void', 'e5');
SELECT lfu.same('a record with no paper, on a job with no paper', lfu.try('e6'), 'ok notice_53_056, restored 0, unset 0');
SELECT lfu.as_kept('its record is exactly as before the void', 'e6');
SELECT lfu.same('a retainage notice voided before the memory: its void moves no paper, so it goes back', lfu.try('e8'), 'ok retainage_53_057, restored 0, unset 0');
SELECT lfu.as_kept('its record is exactly as before the void', 'e8');
SELECT lfu.as_kept('its paper was never moved', 'c6');

-- A second round trip on the same record and paper.
SELECT lfu.same('e1 voided again and put back again', lfu.void('e1', lfu.after()) || ' / ' || lfu.paper('c1') || ' / ' || lfu.try('e1'), 'ok 1 / approved / no tie / no sent day / ok notice_53_056, restored 1, unset 0');
SELECT lfu.as_kept('the record is exactly as before the first void', 'e1');
SELECT lfu.as_kept('the paper is as before the first void, but for updated_at', 'c1');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. The paper moved on. Each way refuses the whole call, and the record stays voided.
-- (a) Sent again as a new record. The first record's memory is still on the paper, and the paper is no longer as the
-- void left it.
SELECT lfu.same('d7''s first record voided', lfu.void('e9', lfu.after()) || ' / ' || lfu.memory('c7'), 'ok 1 / e9 / Nov 12 kept / not written since');
SELECT lfu.same('a second record on d7, and the paper sent again as it',
  lfu.run(format('INSERT INTO public.job_lien_filings (id, job_id, kind, amount, months_covered, created_by) VALUES (%L, %L, ''notice_53_056'', 100, ''{2026-08}'', auth.uid())', lfu.id('ea'), lfu.id('d7')))
    || ', ' || lfu.send('c7', 'ea', '2026-11-20 09:00:00+00'), 'ok 1, ok 1');
SELECT lfu.same('the first record is refused: its paper is another record''s now', lfu.try('e9'), 'The paper this record sent has moved on since the void. The record stays voided.');
-- (b) Touched by a later void. The paper remembers both records, the later one last, and only the last can go back.
SELECT lfu.same('the second record voided', lfu.void('ea', lfu.after()) || ' / ' || lfu.paper('c7') || ' / ' || lfu.memory('c7'), 'ok 1 / approved / no tie / no sent day / e9 ea / another day kept / not written since');
SELECT lfu.same('the first record is refused: a later void touched its paper', lfu.try('e9'), 'The paper this record sent has moved on since the void. The record stays voided.');
SELECT lfu.same('the second record goes back, with its own sent day', lfu.try('ea') || ' / ' || lfu.paper('c7') || ' / ' || lfu.memory('c7'), 'ok notice_53_056, restored 1, unset 0 / sent / tied ea / another sent day / e9 / no day kept / no stamp');
SELECT lfu.same('the first record is still refused, and still voided', lfu.try('e9') || ' / ' || (SELECT (voided_at IS NOT NULL)::text FROM public.job_lien_filings WHERE id = lfu.id('e9')),
  'The paper this record sent has moved on since the void. The record stays voided. / true');
-- (c) Written since the void. In one transaction every write carries one now(), so the stamp is moved back a minute:
-- a void a minute ago, and a write to the paper now.
SELECT lfu.same('d8''s record voided', lfu.void('eb', lfu.after()) || ' / ' || lfu.memory('c8'), 'ok 1 / eb / Nov 12 kept / not written since');
SELECT lfu.same('the paper is written a minute after the void', lfu.run(format('UPDATE public.job_lien_desk_items SET void_stamped_at = void_stamped_at - interval ''1 minute'' WHERE id = %L', lfu.id('c8'))) || ' / ' || lfu.memory('c8'),
  'ok 1 / eb / Nov 12 kept / written since');
SELECT lfu.same('the record is refused: its paper was written since the void', lfu.try('eb'), 'The paper this record sent has moved on since the void. The record stays voided.');
SELECT lfu.same('nothing moved: the record is voided and the paper is on the desk', (SELECT (voided_at IS NOT NULL)::text FROM public.job_lien_filings WHERE id = lfu.id('eb')) || ' / ' || lfu.paper('c8'), 'true / approved / no tie / no sent day');
SELECT lfu.same('with the stamp as the void wrote it, the same record goes back',
  lfu.run(format('UPDATE public.job_lien_desk_items SET void_stamped_at = updated_at WHERE id = %L', lfu.id('c8'))) || ' / ' || lfu.try('eb'), 'ok 1 / ok notice_53_056, restored 1, unset 0');
SELECT lfu.as_kept('and its record is exactly as before the void', 'eb');
SELECT lfu.as_kept('and its paper is as before the void, but for updated_at', 'c8');
-- (d) Held on the desk since the void: it no longer stands the way a void leaves a paper.
SELECT lfu.same('d9''s record voided, and its draft held', lfu.void('ec', lfu.after()) || ', ' || lfu.run(format('UPDATE public.job_lien_desk_items SET status = ''held'', hold_reason = ''call_first'' WHERE id = %L', lfu.id('c9'))), 'ok 1, ok 1');
SELECT lfu.same('the record is refused: its paper is held', lfu.try('ec'), 'The paper this record sent has moved on since the void. The record stays voided.');

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Voided before the memory was kept. No memory then does not mean no paper moved.
SELECT lfu.same('two by-hand records voided on a day before the memory', lfu.void('ed', lfu.before()) || ', ' || lfu.void('ee', lfu.before()), 'ok 1, ok 1');
SELECT lfu.same('with a paper of its kind on the job by then, the record is refused', lfu.try('ed'), 'This record was voided before the app kept what a void does to its desk paper. It stays voided.');
SELECT lfu.same('with only a newer paper of its kind, and an old paper of another kind, the record goes back', lfu.try('ee'), 'ok notice_53_056, restored 0, unset 0');
SELECT lfu.as_kept('its record is exactly as before the void', 'ee');
SELECT lfu.as_kept('the newer paper of its kind is untouched', 'cb');
SELECT lfu.as_kept('the old paper of another kind is untouched', 'cd');
-- A device whose clock runs slow writes a day before the memory on a void that did keep its memory. The memory is
-- read first, so the paper goes back.
SELECT lfu.same('dc''s record voided with a day before the memory', lfu.void('ef', lfu.before()) || ' / ' || lfu.memory('cc'), 'ok 1 / ef / Nov 12 kept / not written since');
SELECT lfu.same('the memory is on the paper, so the record goes back with it', lfu.try('ef'), 'ok notice_53_056, restored 1, unset 0');
SELECT lfu.as_kept('its record is exactly as before the void', 'ef');
SELECT lfu.as_kept('its paper is as before the void, but for updated_at', 'cc');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Nobody signed in. With no claims the function says so; as anon the call is refused at the door.
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', '', true);
SELECT lfu.same('with nobody signed in the door says so', lfu.try('e9'), 'Sign in first.');
SET LOCAL ROLE anon;
SELECT lfu.refused('signed out, the door refuses', format($q$SELECT public.unvoid_test_lien_filing(%L)$q$, lfu.id('e9')), 'permission denied');
RESET ROLE;

-- 8. As shipped.
SELECT lfu.same('who may call the door, the memory''s day and the trigger''s function', (
  has_function_privilege('anon', 'public.unvoid_test_lien_filing(uuid)', 'EXECUTE')::text || '/' || has_function_privilege('authenticated', 'public.unvoid_test_lien_filing(uuid)', 'EXECUTE')::text
    || ' ' || has_function_privilege('anon', 'public.lien_void_memory_since()', 'EXECUTE')::text || '/' || has_function_privilege('authenticated', 'public.lien_void_memory_since()', 'EXECUTE')::text
    || ' ' || has_function_privilege('anon', 'public.job_lien_filing_void_restores_paper()', 'EXECUTE')::text || '/' || has_function_privilege('authenticated', 'public.job_lien_filing_void_restores_paper()', 'EXECUTE')::text),
  'false/true false/false false/false');
SELECT lfu.same('the memory''s day is fixed in the function''s body', (SELECT p.provolatile::text FROM pg_proc p WHERE p.oid = 'public.lien_void_memory_since()'::regprocedure), 'i');
SELECT lfu.same('three memory columns, each nullable with no default', (
  SELECT string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' ' || (NOT a.attnotnull)::text || ' ' || (NOT a.atthasdef)::text, ', ' ORDER BY a.attname)
  FROM pg_attribute a
  WHERE a.attrelid = 'public.job_lien_desk_items'::regclass AND a.attname LIKE 'void\_%' AND NOT a.attisdropped),
  'void_of_filing_ids uuid[] true true, void_prior_sent_at timestamp with time zone true true, void_stamped_at timestamp with time zone true true');
SELECT lfu.same('still one trigger, on a void of an affidavit or a notice', (
  SELECT count(*)::text || ' ' || bool_and(t.tgenabled = 'O')::text
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.job_lien_filings'::regclass AND t.tgname = 'job_lien_filing_void_restores_paper' AND NOT t.tgisinternal),
  '1 true');

DO $$ BEGIN RAISE NOTICE 'lien_void_paper PASSED'; END $$;
ROLLBACK;
