-- Corrections as links (20261112050000, punch list #315): person_file_amendments, its guard, and the three keys
-- hr_agent_write learned. Here: a dev's dry run names each link and writes nothing, twice alike, so a plan and its
-- apply hash the same; the write lands the entry with its links; a link between two things already on the file; every
-- refusal of the guard in words (another person's file, the wrong direction, the other way round, twice, itself); a
-- link withdrawn with a reason and never changed again; who may read and add (a dev; an estimator nothing); the dev
-- seat refused a link that touches a counsel-only record; a payload with no link answering as it always did; and,
-- since 20261127075633, that anon holds nothing on the table and the signed-in role SELECT alone, so a statement sent
-- straight at the table is refused for want of the privilege in the same words whatever it names, for a dev too,
-- while the door, the guard and the HR agent's key work as they did.
-- Made-up people and words. Fixtures made as postgres; the doors run as signed-in users through RLS, inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with "person_file_amendments PASSED".
-- See scripts/pgtest-person-file-amendments.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA pfa;
CREATE FUNCTION pfa.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pfa.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION pfa.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The seat's header on, or off.
CREATE FUNCTION pfa.seat(p_on boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.headers', CASE WHEN p_on THEN '{"x-dev-seat":"dev-mcp"}' ELSE '{}' END, true);
END $$;
-- What the bed reads past RLS: the file's links in a few words, oldest first.
CREATE FUNCTION pfa.links(p_person uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(
    a.how || ' ' || right(a.from_id::text, 2) || '>' || right(a.to_id::text, 2) || CASE WHEN a.withdrawn_at IS NULL THEN '' ELSE ' (withdrawn: ' || a.withdrawn_why || ')' END,
    ', ' ORDER BY a.created_at, a.how, a.to_id), 'none')
  FROM public.person_file_amendments a WHERE a.person_id = p_person $$;
CREATE FUNCTION pfa.entries(p_person uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM public.person_file_entries e WHERE e.person_id = p_person $$;
-- What a signed-in user reads through RLS.
CREATE FUNCTION pfa.visible() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT count(*)::text FROM public.person_file_amendments a WHERE a.person_id IN ('00000000-0000-0000-0000-0000000969b1', '00000000-0000-0000-0000-0000000969b2') $$;
-- How a statement was refused, as its SQLSTATE and its words, or 'allowed'. Two refusals that read alike tell nothing apart.
CREATE FUNCTION pfa.refusal(stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RETURN SQLSTATE || ' ' || SQLERRM;
  END;
  RETURN 'allowed';
END $$;
GRANT USAGE ON SCHEMA pfa TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pfa TO authenticated, anon;

-- Who: a dev and an estimator.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000969d1', 'dev@amends.test'),
  ('00000000-0000-0000-0000-0000000969d2', 'estimator@amends.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000969d1', 'dev@amends.test', 'Amend Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000969d2', 'estimator@amends.test', 'Amend Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- Two people. Pat has four entries (e1 the oldest, e3 and e4 written at the same instant), a piece of evidence and a
-- counsel-only one; Sam has one entry.
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000969b1', '00000000-0000-0000-0000-0000000969d1', 'helper', 'Pat Sample'),
  ('00000000-0000-0000-0000-0000000969b2', '00000000-0000-0000-0000-0000000969d1', 'helper', 'Sam Sample');
INSERT INTO public.person_file_entries (id, person_id, entry_date, content, source, created_at) VALUES
  ('00000000-0000-0000-0000-0000000969e1', '00000000-0000-0000-0000-0000000969b1', '2026-03-02', 'The truck came back at 4:10.', 'incident', '2026-03-03 15:00+00'),
  ('00000000-0000-0000-0000-0000000969e2', '00000000-0000-0000-0000-0000000969b1', '2026-03-02', 'Correction to the March 2 entry: the gate log reads 5:40.', 'incident', '2026-03-09 15:00+00'),
  ('00000000-0000-0000-0000-0000000969e3', '00000000-0000-0000-0000-0000000969b1', '2026-03-16', 'Asked for Friday off.', 'conversation', '2026-03-16 15:00+00'),
  ('00000000-0000-0000-0000-0000000969e4', '00000000-0000-0000-0000-0000000969b1', '2026-03-16', 'Friday was given.', 'conversation', '2026-03-16 15:00+00'),
  ('00000000-0000-0000-0000-0000000969e5', '00000000-0000-0000-0000-0000000969b2', '2026-03-02', 'Sam rode along.', 'job_event', '2026-03-03 15:00+00');
INSERT INTO public.person_file_evidence (id, person_id, dated_on, title, memo, counsel_only, created_at) VALUES
  ('00000000-0000-0000-0000-0000000969f1', '00000000-0000-0000-0000-0000000969b1', '2026-03-02', 'Gate log, March 2', 'The truck is logged in at 5:40.', false, '2026-03-04 15:00+00'),
  ('00000000-0000-0000-0000-0000000969f2', '00000000-0000-0000-0000-0000000969b1', '2026-03-02', 'A note kept for counsel', 'Kept inside the circle.', true, '2026-03-04 15:00+00');

SET LOCAL ROLE authenticated;

-- ── who may call the door ────────────────────────────────────────────────────────────────────────
SELECT pfa.as_user('00000000-0000-0000-0000-0000000969d2');
SELECT pfa.refused('an estimator is refused the door',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","entries":[{"entry_date":"2026-03-20","content":"x"}]}'::jsonb, true)$q$, 'devs only');
SELECT pfa.refused('the agent''s own function is not a signed-in user''s to call',
  $q$SELECT public.hr_agent_write('{"person_id":"00000000-0000-0000-0000-0000000969b1"}'::jsonb)$q$, 'permission denied');
SELECT pfa.same('an estimator reads no link', pfa.visible(), '0');

SELECT pfa.as_user('00000000-0000-0000-0000-0000000969d1');

-- ── a payload with no link answers as it always did ──────────────────────────────────────────────
SELECT pfa.same('no link named, no link key in the reply',
  (SELECT (r ? 'amendments')::text || ' ' || (r ? 'withdrawn')::text || ' ' || (r ? 'amendments_inserted')::text || ' ' || (r->>'entries_inserted')
     FROM public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","entries":[{"entry_date":"2026-03-20","content":"A plain entry.","source":"review"}]}'::jsonb, true) r),
  'false false false 1');

-- ── a new entry that corrects one thing and completes another ────────────────────────────────────
\set p1 '{"person_id":"00000000-0000-0000-0000-0000000969b1","entries":[{"entry_date":"2026-03-21","content":"The truck came back at 5:40, by the gate log.","source":"incident","corrects":"00000000-0000-0000-0000-0000000969e1","completes":[{"kind":"hr_evidence","id":"00000000-0000-0000-0000-0000000969f1"}]}]}'
SELECT pfa.same('the dry run names both links by their ends',
  (SELECT string_agg((l->>'how') || ' new entry ' || (l->'from'->>'new_entry') || ' → ' || (l->'to'->>'kind') || ' of ' || (l->'to'->>'day') || ': ' || (l->'to'->>'words'), ' | ' ORDER BY ord)
     FROM jsonb_array_elements(public.dev_hr_entry_write(:'p1'::jsonb, true)->'amendments') WITH ORDINALITY AS x(l, ord)),
  'corrects new entry 1 → hr_entry of 2026-03-02: The truck came back at 4:10. | completes new entry 1 → hr_evidence of 2026-03-02: Gate log, March 2');
SELECT pfa.same('and counts them', (SELECT (r->>'amendments_inserted') || ' ' || (r->>'dry_run') FROM public.dev_hr_entry_write(:'p1'::jsonb, true) r), '2 true');
RESET ROLE;
SELECT pfa.same('the dry run wrote nothing', pfa.entries('00000000-0000-0000-0000-0000000969b1') || ' entries, links ' || pfa.links('00000000-0000-0000-0000-0000000969b1'), '4 entries, links none');
SET LOCAL ROLE authenticated;
SELECT pfa.same('a second dry run answers the same, word for word',
  (public.dev_hr_entry_write(:'p1'::jsonb, true)::text = public.dev_hr_entry_write(:'p1'::jsonb, true)::text)::text, 'true');

SELECT public.dev_hr_entry_write(:'p1'::jsonb, false);
RESET ROLE;
SELECT pfa.same('the write landed the entry and its two links',
  pfa.entries('00000000-0000-0000-0000-0000000969b1') || ' entries, ' ||
  (SELECT count(*)::text || ' links from it, by ' || min(a.author_label) || ', ' || string_agg(a.how || ' ' || a.to_kind || ' ' || right(a.to_id::text, 2), ' and ' ORDER BY a.how DESC)
     FROM public.person_file_amendments a JOIN public.person_file_entries e ON e.id = a.from_id AND e.entry_date = '2026-03-21'
    WHERE a.person_id = '00000000-0000-0000-0000-0000000969b1' AND a.created_by = '00000000-0000-0000-0000-0000000969d1'),
  '5 entries, 2 links from it, by Amend Dev, corrects hr_entry e1 and completes hr_evidence f1');
SET LOCAL ROLE authenticated;

-- ── a link between two things already on the file ────────────────────────────────────────────────
SELECT pfa.same('a link between two standing entries is planned in words',
  (SELECT (l->>'how') || ': ' || (l->'from'->>'words') || ' → ' || (l->'to'->>'words')
     FROM jsonb_array_elements(public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e2","to_id":"00000000-0000-0000-0000-0000000969e1","how":"corrects"}]}'::jsonb, true)->'amendments') l),
  'corrects: Correction to the March 2 entry: the gate log reads 5:40. → The truck came back at 4:10.');
SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e2","to_id":"00000000-0000-0000-0000-0000000969e1","how":"corrects"},{"from_id":"00000000-0000-0000-0000-0000000969e4","to_id":"00000000-0000-0000-0000-0000000969e3","how":"completes"}]}'::jsonb, false);
SELECT pfa.same('a dev reads the four links', pfa.visible(), '4');

-- ── what the guard refuses ───────────────────────────────────────────────────────────────────────
SELECT pfa.refused('the same link twice',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e2","to_id":"00000000-0000-0000-0000-0000000969e1","how":"completes"}]}'::jsonb, true)$q$, 'that link already stands');
SELECT pfa.refused('a link from what was written first',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e1","to_id":"00000000-0000-0000-0000-0000000969e3","how":"corrects"}]}'::jsonb, true)$q$, 'written before the older one');
SELECT pfa.refused('a link back along a live one',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e3","to_id":"00000000-0000-0000-0000-0000000969e4","how":"corrects"}]}'::jsonb, true)$q$, 'runs the other way');
SELECT pfa.refused('a link onto another person''s file',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e2","to_id":"00000000-0000-0000-0000-0000000969e5","how":"corrects"}]}'::jsonb, true)$q$, 'the one person');
SELECT pfa.refused('a thing that amends itself',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e2","to_id":"00000000-0000-0000-0000-0000000969e2","how":"corrects"}]}'::jsonb, true)$q$, 'person_file_amendments_not_itself');
SELECT pfa.refused('a thing that is on no file',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e2","to_id":"00000000-0000-0000-0000-0000000969aa","how":"corrects"}]}'::jsonb, true)$q$, 'is not on any file');
SELECT pfa.refused('a how that is neither',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e2","to_id":"00000000-0000-0000-0000-0000000969e3","how":"replaces"}]}'::jsonb, true)$q$, 'corrects or completes');
SELECT pfa.refused('an id that is not one',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"the March entry","to_id":"00000000-0000-0000-0000-0000000969e3","how":"corrects"}]}'::jsonb, true)$q$, 'each an id');
SELECT pfa.refused('a kind the file does not hold',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","entries":[{"entry_date":"2026-03-22","content":"x","corrects":{"kind":"document","id":"00000000-0000-0000-0000-0000000969e1"}}]}'::jsonb, true)$q$, 'unknown kind');
SELECT pfa.refused('a correction that names nothing by id',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","entries":[{"entry_date":"2026-03-22","content":"x","corrects":[42]}]}'::jsonb, true)$q$, 'takes an entry id');

-- ── a link is what it was when made; a wrong one is withdrawn ────────────────────────────────────
SELECT pfa.refused('a dev cannot reword a link at the table',
  $q$UPDATE public.person_file_amendments SET how = 'completes' WHERE from_id = '00000000-0000-0000-0000-0000000969e2' AND to_id = '00000000-0000-0000-0000-0000000969e1'$q$, 'permission denied for table person_file_amendments');
RESET ROLE;
SELECT pfa.refused('and the guard refuses a reworded link to the owner who can still reach it',
  $q$UPDATE public.person_file_amendments SET how = 'completes' WHERE from_id = '00000000-0000-0000-0000-0000000969e2' AND to_id = '00000000-0000-0000-0000-0000000969e1'$q$, 'a link is what it was when made');
SET LOCAL ROLE authenticated;
SELECT pfa.refused('a withdrawal needs its reason',
  $q$SELECT public.dev_hr_entry_write(jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000969b1', 'withdraw_amendments', jsonb_build_array(jsonb_build_object('id', (SELECT id FROM public.person_file_amendments WHERE from_id = '00000000-0000-0000-0000-0000000969e4')))), true)$q$, 'needs id and why');
SELECT pfa.same('a withdrawal is planned with the link it takes off',
  (SELECT (w->>'how') || ': ' || (w->'from'->>'words') || ' → ' || (w->'to'->>'words') || ' — ' || (w->>'why')
     FROM jsonb_array_elements(public.dev_hr_entry_write(jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000969b1', 'withdraw_amendments',
       jsonb_build_array(jsonb_build_object('id', (SELECT id FROM public.person_file_amendments WHERE from_id = '00000000-0000-0000-0000-0000000969e4'), 'why', 'two separate talks'))), true)->'withdrawn') w),
  'completes: Friday was given. → Asked for Friday off. — two separate talks');
SELECT public.dev_hr_entry_write(jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000969b1', 'withdraw_amendments',
  jsonb_build_array(jsonb_build_object('id', (SELECT id FROM public.person_file_amendments WHERE from_id = '00000000-0000-0000-0000-0000000969e4'), 'why', 'two separate talks'))), false);
SELECT pfa.refused('a withdrawn link is not withdrawn twice',
  $q$SELECT public.dev_hr_entry_write(jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000969b1', 'withdraw_amendments', jsonb_build_array(jsonb_build_object('id', (SELECT id FROM public.person_file_amendments WHERE from_id = '00000000-0000-0000-0000-0000000969e4'), 'why', 'again'))), true)$q$, 'no live link');
RESET ROLE;
SELECT pfa.refused('and its stamps do not change, for the owner either',
  $q$UPDATE public.person_file_amendments SET withdrawn_why = 'another reason' WHERE from_id = '00000000-0000-0000-0000-0000000969e4'$q$, 'a withdrawn link stays withdrawn');
SET LOCAL ROLE authenticated;
SELECT pfa.refused('a link is never deleted', $q$DO $d$ DECLARE n int := 0; BEGIN BEGIN DELETE FROM public.person_file_amendments WHERE from_id = '00000000-0000-0000-0000-0000000969e4'; GET DIAGNOSTICS n = ROW_COUNT; EXCEPTION WHEN insufficient_privilege THEN n := 0; END; IF n = 0 THEN RAISE EXCEPTION 'nothing deleted'; END IF; END $d$$q$, 'nothing deleted');
-- The pair may be linked again, the other way round now that nothing live stands between them. Through the door, as
-- the tab writes a link since v2.8730.
SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e3","to_id":"00000000-0000-0000-0000-0000000969e4","how":"completes"}]}'::jsonb, false);
RESET ROLE;
SELECT pfa.same('the withdrawn link stays on the record beside the new one',
  (SELECT string_agg(a.how || ' ' || right(a.from_id::text, 2) || '>' || right(a.to_id::text, 2) || CASE WHEN a.withdrawn_at IS NULL THEN '' ELSE ' (withdrawn by ' || (SELECT u.name FROM public.users u WHERE u.id = a.withdrawn_by) || ': ' || a.withdrawn_why || ')' END, ', ' ORDER BY a.withdrawn_at NULLS LAST)
     -- By e3's whole id: the entry the write above made has a random id, and one time in 256 it ends in e3 too.
     FROM public.person_file_amendments a WHERE '00000000-0000-0000-0000-0000000969e3'::uuid IN (a.from_id, a.to_id)),
  'completes e4>e3 (withdrawn by Amend Dev: two separate talks), completes e3>e4');
SET LOCAL ROLE authenticated;

-- ── an estimator adds nothing ────────────────────────────────────────────────────────────────────
SELECT pfa.as_user('00000000-0000-0000-0000-0000000969d2');
-- Before 20261127075633 these four answered four ways (the row policy's words, already stands, not on any file, the
-- one person's file), so anyone signed in could ask the guard where an id stood. Now the privilege refuses first.
SELECT pfa.same('an estimator who names a pair the guard would pass is refused for want of the privilege',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e4', 'hr_entry', '00000000-0000-0000-0000-0000000969e1', 'corrects')$q$),
  '42501 permission denied for table person_file_amendments');
SELECT pfa.same('and in the same words for a standing link',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e2', 'hr_entry', '00000000-0000-0000-0000-0000000969e1', 'corrects')$q$),
  '42501 permission denied for table person_file_amendments');
SELECT pfa.same('and for a thing that is on no file',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e2', 'hr_entry', '00000000-0000-0000-0000-0000000969aa', 'corrects')$q$),
  '42501 permission denied for table person_file_amendments');
SELECT pfa.same('and for a thing on another person''s file',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e2', 'hr_entry', '00000000-0000-0000-0000-0000000969e5', 'corrects')$q$),
  '42501 permission denied for table person_file_amendments');
SELECT pfa.same('an estimator may not take a link off at the table',
  pfa.refusal($q$UPDATE public.person_file_amendments SET withdrawn_at = now(), withdrawn_why = 'x' WHERE person_id = '00000000-0000-0000-0000-0000000969b1'$q$), '42501 permission denied for table person_file_amendments');
SELECT pfa.refused('the door still refuses an estimator a link',
  $q$SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e4","to_id":"00000000-0000-0000-0000-0000000969e1","how":"corrects"}]}'::jsonb, true)$q$, 'devs only');
SELECT pfa.same('and still reads none', pfa.visible(), '0');

-- A dev is refused at the table too: the door is the one way in.
SELECT pfa.as_user('00000000-0000-0000-0000-0000000969d1');
SELECT pfa.same('a dev''s own insert at the table is refused the same way',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how, created_by) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e4', 'hr_entry', '00000000-0000-0000-0000-0000000969e1', 'corrects', '00000000-0000-0000-0000-0000000969d1')$q$),
  '42501 permission denied for table person_file_amendments');

-- ── the seat and a counsel-only record ───────────────────────────────────────────────────────────
SELECT pfa.as_user('00000000-0000-0000-0000-0000000969d1');
SELECT public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e2","to_id":"00000000-0000-0000-0000-0000000969f2","to_kind":"hr_evidence","how":"completes"}]}'::jsonb, false);
SELECT pfa.same('a dev signed in reads every link, the counsel-only one too', pfa.visible(), '6');
SELECT pfa.seat(true);
SELECT pfa.same('the seat is refused the link that touches a counsel-only record', pfa.visible(), '5');
SELECT pfa.same('and a plan that names one says so without its title',
  (SELECT l->'to'->>'words' FROM jsonb_array_elements(public.dev_hr_entry_write('{"person_id":"00000000-0000-0000-0000-0000000969b1","amendments":[{"from_id":"00000000-0000-0000-0000-0000000969e4","to_id":"00000000-0000-0000-0000-0000000969f2","to_kind":"hr_evidence","how":"completes"}]}'::jsonb, true)->'amendments') l),
  'a counsel-only record');
SELECT pfa.seat(false);
RESET ROLE;

-- ── the table's privileges (20261127075633) ──────────────────────────────────────────────────────
-- The table's own migration never took away what a new table is given by default, so anon and the signed-in role
-- each held every privilege, and the guard answers before the row policy. Since 20261127075633 anon holds nothing
-- and the signed-in role SELECT alone: the tab writes through the door since v2.8730.
SELECT pfa.same('anon holds nothing on the links',
  has_table_privilege('anon', 'public.person_file_amendments', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')::text, 'false');
SELECT pfa.same('the signed-in role may read the links and may write none',
  has_table_privilege('authenticated', 'public.person_file_amendments', 'SELECT')::text || ' ' ||
  has_table_privilege('authenticated', 'public.person_file_amendments', 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')::text, 'true false');
SELECT pfa.same('the guard and the two doors'' own function are the only writers that name the table',
  (SELECT string_agg(p.proname, ', ' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc ~* '(insert into|update) +public\.person_file_amendments'),
  'hr_agent_write');
SELECT pfa.same('the HR agent''s key reads and adds, as before',
  (has_table_privilege('hr_agent', 'public.person_file_amendments', 'SELECT') AND has_table_privilege('hr_agent', 'public.person_file_amendments', 'INSERT'))::text
  || ' ' || has_table_privilege('hr_agent', 'public.person_file_amendments', 'UPDATE, DELETE, TRUNCATE')::text, 'true false');

-- With no sign-in: one refusal, in the same words, whatever the insert names. Before the file these four answered
-- four ways (already stands, the policy's words, not on any file, the one person's file).
SELECT set_config('pfa.links_before', pfa.links('00000000-0000-0000-0000-0000000969b1'), true);
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE anon;
SELECT pfa.same('with no sign-in, an insert that names a standing link is refused for want of the privilege',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e2', 'hr_entry', '00000000-0000-0000-0000-0000000969e1', 'corrects')$q$),
  '42501 permission denied for table person_file_amendments');
SELECT pfa.same('and in the same words for a pair the guard would pass',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e4', 'hr_entry', '00000000-0000-0000-0000-0000000969e1', 'corrects')$q$),
  '42501 permission denied for table person_file_amendments');
SELECT pfa.same('and for a thing that is on no file',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e2', 'hr_entry', '00000000-0000-0000-0000-0000000969aa', 'corrects')$q$),
  '42501 permission denied for table person_file_amendments');
SELECT pfa.same('and for a thing on another person''s file',
  pfa.refusal($q$INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how) VALUES ('00000000-0000-0000-0000-0000000969b1', 'hr_entry', '00000000-0000-0000-0000-0000000969e2', 'hr_entry', '00000000-0000-0000-0000-0000000969e5', 'corrects')$q$),
  '42501 permission denied for table person_file_amendments');
SELECT pfa.same('and a read, an update and a delete with no sign-in are refused the same way',
  pfa.refusal($q$SELECT count(*) FROM public.person_file_amendments$q$) || ' | ' ||
  pfa.refusal($q$UPDATE public.person_file_amendments SET withdrawn_why = 'x' WHERE person_id = '00000000-0000-0000-0000-0000000969b1'$q$) || ' | ' ||
  pfa.refusal($q$DELETE FROM public.person_file_amendments WHERE person_id = '00000000-0000-0000-0000-0000000969b1'$q$),
  '42501 permission denied for table person_file_amendments | 42501 permission denied for table person_file_amendments | 42501 permission denied for table person_file_amendments');
RESET ROLE;
SELECT pfa.same('nothing of that landed or changed', (pfa.links('00000000-0000-0000-0000-0000000969b1') = current_setting('pfa.links_before'))::text, 'true');

DO $$ BEGIN RAISE NOTICE 'person_file_amendments PASSED'; END $$;
ROLLBACK;
