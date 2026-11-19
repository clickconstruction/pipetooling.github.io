-- Voiding a filed lien affidavit puts its paper back (v2.7892, migration *_lien_void_puts_paper_back), and so does
-- voiding a § 53.056 notice's record (v2.7911, migration *_lien_void_puts_notice_back).
-- The office's own writes under its own sign-in and RLS: the filing recorded (an INSERT into job_lien_filings), the
-- paper marked sent (markLienDeskItemSent's UPDATE), the filing voided (voidFiling's UPDATE). The fixture is made as
-- postgres, signed in as the leader where his approval is on the paper; everything rolls back.
-- Raises on the first failed assertion; ends with "lien_void_paper PASSED".
-- See scripts/pgtest-lien-void-paper.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: Malachi (the leader), Rosa (the office) and Dee (a dev).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000f8a01', 'malachi@void.test'),
  ('00000000-0000-0000-0000-0000000f8a02', 'rosa@void.test'),
  ('00000000-0000-0000-0000-0000000f8a03', 'dee@void.test');
INSERT INTO public.users (id, email, name, notes, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000f8a01', 'malachi@void.test', 'Malachi', NULL, 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000f8a02', 'rosa@void.test', 'Rosa', NULL, 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000f8a03', 'dee@void.test', 'Dee', NULL, 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, notes = EXCLUDED.notes, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA lvp;
CREATE FUNCTION lvp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lvp.id(kind text, n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS
  $$ SELECT ('00000000-0000-0000-0000-0000000f8' || kind || lpad(n::text, 2, '0'))::uuid $$;
-- Sign in as someone (the claims auth.uid() and auth.role() read).
CREATE FUNCTION lvp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- One write as whoever is signed in: 'ok N' with the rows it reached, or the refusal's SQLSTATE.
CREATE FUNCTION lvp.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  n integer;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'ok ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The office records job N's lien as filed: the filing row, as the signed-in user.
CREATE FUNCTION lvp.record(n integer) RETURNS text LANGUAGE sql AS $$
  SELECT lvp.try(format(
    'INSERT INTO public.job_lien_filings (id, job_id, kind, amount, filed_at, county, recording_number, created_by) VALUES (%L, %L, ''affidavit'', 0, ''2026-11-16'', ''ZZ TEST'', %L, auth.uid())',
    lvp.id('d', n), lvp.id('b', n), 'ZZ-TEST-' || n))
$$;
-- The office records job N's notice as mailed: the record that names its month, as the signed-in user.
CREATE FUNCTION lvp.record_notice(n integer) RETURNS text LANGUAGE sql AS $$
  SELECT lvp.try(format(
    'INSERT INTO public.job_lien_filings (id, job_id, kind, amount, months_covered, created_by) VALUES (%L, %L, ''notice_53_056'', 0, ''{2026-09}'', auth.uid())',
    lvp.id('d', n), lvp.id('b', n)))
$$;
-- markLienDeskItemSent's write (src/lib/jobs/lienDeskIo.ts): paper N sent, tied to filing F.
CREATE FUNCTION lvp.mark_sent(n integer, f integer) RETURNS text LANGUAGE sql AS $$
  SELECT lvp.try(format('UPDATE public.job_lien_desk_items SET status = ''sent'', sent_filing_id = %L WHERE id = %L', lvp.id('d', f), lvp.id('c', n)))
$$;
-- voidFiling's write (src/components/jobs/LienFilingTabs.tsx).
CREATE FUNCTION lvp.void(f integer) RETURNS text LANGUAGE sql AS $$
  SELECT lvp.try(format('UPDATE public.job_lien_filings SET voided_at = now() WHERE id = %L', lvp.id('d', f)))
$$;
-- A paper as words, whoever is asking: status / how it was approved / by whom / on his day / tie / sent day / set aside.
CREATE FUNCTION lvp.paper(n integer) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT i.status || ' / ' || coalesce(i.approval_mode, '-')
      || ' / by ' || coalesce((SELECT u.name FROM public.users u WHERE u.id = i.approved_by), '-')
      || ' / ' || CASE WHEN i.approved_at IS NULL THEN 'no day' WHEN i.approved_at = '2026-11-10 10:00:00+00'::timestamptz THEN 'his day' ELSE 'another day' END
      || ' / ' || CASE WHEN i.sent_filing_id IS NULL THEN 'no tie' ELSE 'tied' END
      || ' / ' || CASE WHEN i.sent_at IS NULL THEN 'no sent day' ELSE 'sent day' END
      || CASE WHEN i.printed_at IS NULL THEN '' ELSE ' / printed' END
      || CASE WHEN i.signed_at IS NULL THEN '' ELSE ' / signed by ' || coalesce(i.signer_printed_name, '-') END
      || CASE WHEN i.voided_at IS NULL THEN '' ELSE ' / set aside' END
      || CASE WHEN i.word_note <> '' THEN ' / "' || i.word_note || '"' ELSE '' END
    FROM public.job_lien_desk_items i WHERE i.id = lvp.id('c', n)), 'no row')
$$;
GRANT USAGE ON SCHEMA lvp TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lvp TO anon, authenticated, service_role;

-- Fourteen jobs. A paper is c<N> on job b<N>; its filing is d<N>.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000f8e01', 'Void Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status)
SELECT lvp.id('b', n), '00000000-0000-0000-0000-0000000f8a01', '00000000-0000-0000-0000-0000000f8e01', (88900 + n)::text, 'ZZ Test Void Job ' || n, 'ZZ Test GC', 'gc', 38625, 34825, 'billed'
FROM generate_series(1, 14) AS n;

-- The papers. The leader's approvals are made under his own sign-in, as the guard asks, on a fixed day.
SELECT lvp.as_user('00000000-0000-0000-0000-0000000f8a01');
INSERT INTO public.job_lien_desk_items (id, job_id, kind, status, approval_mode, approved_by, approved_at, word_note, word_channel, drafted_by) VALUES
  -- 1: approved by his own press. 5, 7, 8: the same, for the checks by hand.
  (lvp.id('c', 1), lvp.id('b', 1), 'affidavit', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '', '', '00000000-0000-0000-0000-0000000f8a02'),
  (lvp.id('c', 5), lvp.id('b', 5), 'affidavit', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '', '', '00000000-0000-0000-0000-0000000f8a02'),
  (lvp.id('c', 7), lvp.id('b', 7), 'affidavit', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '', '', '00000000-0000-0000-0000-0000000f8a02'),
  (lvp.id('c', 8), lvp.id('b', 8), 'affidavit', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '', '', '00000000-0000-0000-0000-0000000f8a02'),
  -- 2: approved on his spoken word, written down by the office.
  (lvp.id('c', 2), lvp.id('b', 2), 'affidavit', 'approved', 'word', '00000000-0000-0000-0000-0000000f8a02', '2026-11-10 10:00:00+00', 'He said file it', 'phone', '00000000-0000-0000-0000-0000000f8a02'),
  -- 3: never approved, still the office's draft when the lien was recorded.
  (lvp.id('c', 3), lvp.id('b', 3), 'affidavit', 'drafted', NULL, NULL, NULL, '', '', '00000000-0000-0000-0000-0000000f8a02'),
  -- 4: approved by his own press; a newer draft comes to the same job after it is filed.
  (lvp.id('c', 4), lvp.id('b', 4), 'affidavit', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '', '', '00000000-0000-0000-0000-0000000f8a02'),
  -- 12, 13: notices approved by his own press, for the newer paper and the check by hand. 14: an affidavit, on a job
  -- that also holds a notice draft.
  (lvp.id('c', 12), lvp.id('b', 12), 'notice_53_056', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '', '', '00000000-0000-0000-0000-0000000f8a02'),
  (lvp.id('c', 13), lvp.id('b', 13), 'notice_53_056', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '', '', '00000000-0000-0000-0000-0000000f8a02'),
  (lvp.id('c', 14), lvp.id('b', 14), 'affidavit', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '', '', '00000000-0000-0000-0000-0000000f8a02'),
  -- 10: a notice approved on his spoken word. 11: a notice never approved, recorded as already sent.
  (lvp.id('c', 10), lvp.id('b', 10), 'notice_53_056', 'approved', 'word', '00000000-0000-0000-0000-0000000f8a02', '2026-11-10 10:00:00+00', 'He said mail it', 'phone', '00000000-0000-0000-0000-0000000f8a02'),
  (lvp.id('c', 11), lvp.id('b', 11), 'notice_53_056', 'drafted', NULL, NULL, NULL, '', '', '00000000-0000-0000-0000-0000000f8a02'),
  (lvp.id('c', 24), lvp.id('b', 14), 'notice_53_056', 'drafted', NULL, NULL, NULL, '', '', '00000000-0000-0000-0000-0000000f8a02');
-- 6: a notice approved by his own press, signed by him and printed, as a notice stands when its mailing is recorded.
INSERT INTO public.job_lien_desk_items (id, job_id, kind, months, status, approval_mode, approved_by, approved_at, drafted_by, printed_at, signed_at, signed_by, signer_signature_mode, signer_printed_name) VALUES
  (lvp.id('c', 6), lvp.id('b', 6), 'notice_53_056', '{2026-09}', 'approved', 'leader', '00000000-0000-0000-0000-0000000f8a01', '2026-11-10 10:00:00+00', '00000000-0000-0000-0000-0000000f8a02', '2026-11-11 10:00:00+00', '2026-11-10 11:00:00+00', '00000000-0000-0000-0000-0000000f8a01', 'type', 'Malachi Whites');
-- Job 6's notice on record, and job 9's filed affidavit with no paper on the desk.
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, months_covered, created_by) VALUES
  (lvp.id('d', 6), lvp.id('b', 6), 'notice_53_056', 0, '{2026-08}', '00000000-0000-0000-0000-0000000f8a02');
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, filed_at, created_by) VALUES
  (lvp.id('d', 9), lvp.id('b', 9), 'affidavit', 0, '2026-11-16', '00000000-0000-0000-0000-0000000f8a02');
-- Job 8's filing was voided before any paper was tied to it: the one case the trigger never sees.
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, filed_at, voided_at, created_by) VALUES
  (lvp.id('d', 8), lvp.id('b', 8), 'affidavit', 0, '2026-11-16', now(), '00000000-0000-0000-0000-0000000f8a02');

SELECT lvp.same('the fixture: his approval is on paper 1', lvp.paper(1), 'approved / leader / by Malachi / his day / no tie / no sent day');

-- ---------- 1 · the office records, then voids: the leader's paper goes back with his approval untouched ----------
SELECT lvp.as_user('00000000-0000-0000-0000-0000000f8a02');
SET LOCAL ROLE authenticated;
SELECT lvp.same('Rosa records job 1 as filed', lvp.record(1), 'ok 1');
SELECT lvp.same('and its paper is marked sent', lvp.mark_sent(1, 1), 'ok 1');
SELECT lvp.same('the paper is sent and tied to the filing', lvp.paper(1), 'sent / leader / by Malachi / his day / tied / sent day');
SELECT lvp.same('Rosa voids the filing', lvp.void(1), 'ok 1');
SELECT lvp.same('the paper is approved again, by him, on his day, with no tie and no sent day', lvp.paper(1), 'approved / leader / by Malachi / his day / no tie / no sent day');

-- ---------- 2 · a paper approved on his word keeps its note ----------
SELECT lvp.same('job 2 recorded', lvp.record(2) || ', ' || lvp.mark_sent(2, 2), 'ok 1, ok 1');
SELECT lvp.same('job 2 voided', lvp.void(2), 'ok 1');
SELECT lvp.same('the word and who wrote it down stand', lvp.paper(2), 'approved / word / by Rosa / his day / no tie / no sent day / "He said file it"');

-- ---------- 3 · a paper never approved goes back to the office's draft ----------
SELECT lvp.same('job 3 recorded', lvp.record(3) || ', ' || lvp.mark_sent(3, 3), 'ok 1, ok 1');
SELECT lvp.same('job 3 voided', lvp.void(3), 'ok 1');
SELECT lvp.same('a draft again, approved by nobody', lvp.paper(3), 'drafted / - / by - / no day / no tie / no sent day');

-- ---------- 4 · a newer live paper on the job stands, and the old one is set aside ----------
SELECT lvp.same('job 4 recorded', lvp.record(4) || ', ' || lvp.mark_sent(4, 4), 'ok 1, ok 1');
SELECT lvp.same('a second draft on job 4, allowed while the first is sent',
  lvp.try(format('INSERT INTO public.job_lien_desk_items (id, job_id, kind, status, drafted_by) VALUES (%L, %L, ''affidavit'', ''drafted'', auth.uid())', lvp.id('c', 40), lvp.id('b', 4))), 'ok 1');
SELECT lvp.same('job 4 voided', lvp.void(4), 'ok 1');
SELECT lvp.same('the old paper is set aside, still naming the filing it became', lvp.paper(4), 'sent / leader / by Malachi / his day / tied / sent day / set aside');
SELECT lvp.same('the newer draft is untouched', lvp.paper(40), 'drafted / - / by - / no day / no tie / no sent day');

-- ---------- 5 · what moves nothing: a lien with no paper on the desk, and a second void ----------
SELECT lvp.same('a filed lien with no paper on the desk voids', lvp.void(9), 'ok 1');
SELECT lvp.same('voiding job 1 again reaches the row', lvp.void(1), 'ok 1');
SELECT lvp.same('and its paper stays where the first void put it', lvp.paper(1), 'approved / leader / by Malachi / his day / no tie / no sent day');

-- ---------- 6 · by hand, the guard is as it was ----------
SELECT lvp.same('job 5 recorded', lvp.record(5) || ', ' || lvp.mark_sent(5, 5), 'ok 1, ok 1');
SELECT lvp.same('the office cannot move a sent paper back to approved while its filing is live',
  lvp.try(format('UPDATE public.job_lien_desk_items SET status = ''approved'', sent_filing_id = NULL, sent_at = NULL WHERE id = %L', lvp.id('c', 5))), '42501');
SELECT lvp.same('so it stays sent', lvp.paper(5), 'sent / leader / by Malachi / his day / tied / sent day');
SELECT lvp.same('the office cannot approve a draft in the leader''s name',
  lvp.try(format('UPDATE public.job_lien_desk_items SET status = ''approved'', approval_mode = ''leader'' WHERE id = %L', lvp.id('c', 3))), '42501');
-- Paper 8 is tied to a filing that was already voided, so no void fires for it.
SELECT lvp.same('paper 8 tied to its voided filing', lvp.mark_sent(8, 8), 'ok 1');
SELECT lvp.same('moving it back in another name is a new approval, refused',
  lvp.try(format('UPDATE public.job_lien_desk_items SET status = ''approved'', approved_by = auth.uid(), sent_filing_id = NULL, sent_at = NULL WHERE id = %L', lvp.id('c', 8))), '42501');
SELECT lvp.same('moving it back on another day is a new approval, refused',
  lvp.try(format('UPDATE public.job_lien_desk_items SET status = ''approved'', approved_at = now(), sent_filing_id = NULL, sent_at = NULL WHERE id = %L', lvp.id('c', 8))), '42501');
SELECT lvp.same('moving it back with his approval untouched is allowed',
  lvp.try(format('UPDATE public.job_lien_desk_items SET status = ''approved'', sent_filing_id = NULL, sent_at = NULL WHERE id = %L', lvp.id('c', 8))), 'ok 1');
SELECT lvp.same('paper 8 is approved again, by him, on his day', lvp.paper(8), 'approved / leader / by Malachi / his day / no tie / no sent day');

-- ---------- 7 · the lien can be recorded again, and voided again ----------
SELECT lvp.same('job 7 recorded and voided', lvp.record(7) || ', ' || lvp.mark_sent(7, 7) || ', ' || lvp.void(7), 'ok 1, ok 1, ok 1');
SELECT lvp.same('a second filing on job 7',
  lvp.try(format('INSERT INTO public.job_lien_filings (id, job_id, kind, amount, filed_at, created_by) VALUES (%L, %L, ''affidavit'', 0, ''2026-11-17'', auth.uid())', lvp.id('d', 70), lvp.id('b', 7))), 'ok 1');
SELECT lvp.same('the paper is marked sent again', lvp.mark_sent(7, 70), 'ok 1');
SELECT lvp.same('sent and tied to the second filing', lvp.paper(7), 'sent / leader / by Malachi / his day / tied / sent day');
SELECT lvp.same('the second filing voided', lvp.void(70), 'ok 1');
SELECT lvp.same('and the paper is back once more', lvp.paper(7), 'approved / leader / by Malachi / his day / no tie / no sent day');

-- ---------- 8 · a notice's record voided puts the notice back (v2.7911) ----------
-- Job 6's notice is on record from the fixture (d6). It was signed and printed before its mailing was recorded.
SELECT lvp.same('the notice paper sent', lvp.mark_sent(6, 6), 'ok 1');
SELECT lvp.same('sent, tied, still signed and printed', lvp.paper(6), 'sent / leader / by Malachi / his day / tied / sent day / printed / signed by Malachi Whites');
SELECT lvp.same('Rosa voids the notice''s record', lvp.void(6), 'ok 1');
SELECT lvp.same('the notice is approved again, by him, signed and printed as it was, with no tie and no sent day',
  lvp.paper(6), 'approved / leader / by Malachi / his day / no tie / no sent day / printed / signed by Malachi Whites');
SELECT lvp.same('a notice on his word: recorded, sent, voided', lvp.record_notice(10) || ', ' || lvp.mark_sent(10, 10) || ', ' || lvp.void(10), 'ok 1, ok 1, ok 1');
SELECT lvp.same('the word and who wrote it down stand', lvp.paper(10), 'approved / word / by Rosa / his day / no tie / no sent day / "He said mail it"');
SELECT lvp.same('a notice nobody approved: recorded as already sent, then voided', lvp.record_notice(11) || ', ' || lvp.mark_sent(11, 11) || ', ' || lvp.void(11), 'ok 1, ok 1, ok 1');
SELECT lvp.same('a draft again, approved by nobody', lvp.paper(11), 'drafted / - / by - / no day / no tie / no sent day');
SELECT lvp.same('job 12''s notice recorded and sent', lvp.record_notice(12) || ', ' || lvp.mark_sent(12, 12), 'ok 1, ok 1');
SELECT lvp.same('a second notice draft on job 12, allowed while the first is sent',
  lvp.try(format('INSERT INTO public.job_lien_desk_items (id, job_id, kind, status, drafted_by) VALUES (%L, %L, ''notice_53_056'', ''drafted'', auth.uid())', lvp.id('c', 21), lvp.id('b', 12))), 'ok 1');
SELECT lvp.same('job 12''s record voided', lvp.void(12), 'ok 1');
SELECT lvp.same('the old notice is set aside', lvp.paper(12), 'sent / leader / by Malachi / his day / tied / sent day / set aside');
SELECT lvp.same('the newer notice draft is untouched', lvp.paper(21), 'drafted / - / by - / no day / no tie / no sent day');
-- A paper of another kind on the job does not set the paper aside: job 14 holds a notice draft beside its lien.
SELECT lvp.same('job 14''s lien recorded, sent, voided', lvp.record(14) || ', ' || lvp.mark_sent(14, 14) || ', ' || lvp.void(14), 'ok 1, ok 1, ok 1');
SELECT lvp.same('its lien paper is approved again beside the notice draft', lvp.paper(14) || ' | ' || lvp.paper(24),
  'approved / leader / by Malachi / his day / no tie / no sent day | drafted / - / by - / no day / no tie / no sent day');
-- By hand, a notice is as an affidavit is.
SELECT lvp.same('job 13''s notice recorded and sent', lvp.record_notice(13) || ', ' || lvp.mark_sent(13, 13), 'ok 1, ok 1');
SELECT lvp.same('the office cannot move a sent notice back to approved while its record is live',
  lvp.try(format('UPDATE public.job_lien_desk_items SET status = ''approved'', sent_filing_id = NULL, sent_at = NULL WHERE id = %L', lvp.id('c', 13))), '42501');
SELECT lvp.same('so it stays sent', lvp.paper(13), 'sent / leader / by Malachi / his day / tied / sent day');
RESET ROLE;

-- ---------- 9 · as shipped ----------
SELECT lvp.same('nobody calls the trigger''s function', (
  has_function_privilege('anon', 'public.job_lien_filing_void_restores_paper()', 'EXECUTE')::text || '/'
    || has_function_privilege('authenticated', 'public.job_lien_filing_void_restores_paper()', 'EXECUTE')::text),
  'false/false');
SELECT lvp.same('one trigger, on a void of an affidavit or a notice', (
  SELECT count(*)::text || ' ' || bool_and(t.tgenabled = 'O')::text
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.job_lien_filings'::regclass AND t.tgname = 'job_lien_filing_void_restores_paper' AND NOT t.tgisinternal),
  '1 true');

DO $$ BEGIN RAISE NOTICE 'lien_void_paper PASSED'; END $$;
ROLLBACK;
