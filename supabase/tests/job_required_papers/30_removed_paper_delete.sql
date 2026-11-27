-- The developer deletes a taken-off paper of a test job (punch list #443, row 10, migration
-- *_test_job_removed_paper_delete). On a job named ZZ a dev requires three papers and takes them off: the list answers
-- the three, newest taken off first, with nothing pointing at any, a delete answers ok and the row is gone, and the list
-- answers two. Each tie refuses in its own sentence and the row stays, with its count in the list: a person's copy,
-- unsigned or signed, one or two; a GC proposal made on the paper; a GC proposal taken as it; a later revision that
-- names it, which goes once the later one is deleted first. The other refusals, each in its own sentence: nobody
-- signed in, the office and a helper, a paper that is not there, a paper still on its job, a taken-off paper of a job
-- not named ZZ, which stands afterwards, and for the list a job that is not there and a real job. A direct DELETE as
-- the dev still reaches no row. Every name is a made-up placeholder. Fixtures are written as postgres; presses run as
-- each user; everything rolls back. Raises on the first failed assertion; ends with "removed_paper_delete PASSED".
-- See scripts/pgtest-job-required-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA rpd;
-- Every id in this bed: one prefix and two characters.
CREATE FUNCTION rpd.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004431' || p)::uuid $$;
CREATE FUNCTION rpd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION rpd.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION rpd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The service key: a role and no person.
CREATE FUNCTION rpd.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
-- Nobody: no claims at all.
CREATE FUNCTION rpd.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A job's live required paper for a Book entry, whoever asks.
CREATE FUNCTION rpd.row_of(p_job uuid, p_book uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT r.id FROM public.job_required_papers r WHERE r.job_id = p_job AND r.book_document_id = p_book AND r.removed_at IS NULL
$$;
-- The ids this bed keeps by a name of its own, so a paper is still named once it is off its job or gone.
CREATE TABLE rpd.ids (key text PRIMARY KEY, id uuid NOT NULL);
CREATE FUNCTION rpd.keep(p_key text, p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_id IS NULL THEN RAISE EXCEPTION 'no paper to keep as %', p_key; END IF;
  INSERT INTO rpd.ids (key, id) VALUES (p_key, p_id);
END $$;
CREATE FUNCTION rpd.kept(p_key text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT i.id FROM rpd.ids i WHERE i.key = p_key $$;
-- A fixture: the hour a kept paper came off, so the list's order is the bed's own. Take off stamps the transaction's
-- start, which is one instant for this whole file.
CREATE FUNCTION rpd.came_off(p_key text, p_hours_ago integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.job_required_papers SET removed_at = now() - make_interval(hours => p_hours_ago) WHERE id = rpd.kept(p_key) AND removed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION '% is not a taken-off paper', p_key; END IF;
END $$;
-- Which of the bed's kept papers stand, past RLS, by their keys in order.
CREATE FUNCTION rpd.standing() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(i.key, ' ' ORDER BY i.key), 'none') FROM rpd.ids i JOIN public.job_required_papers r ON r.id = i.id
$$;
-- What the delete answers, as words: "ok <paper name>", or the refusal's own sentence.
CREATE FUNCTION rpd.try_delete(p_paper uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a jsonb;
BEGIN
  a := public.delete_test_job_required_paper(p_paper);
  RETURN CASE WHEN (a ->> 'ok') = 'true' THEN 'ok ' ELSE 'not ok ' END || (a ->> 'paper_name');
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- What the list answers, as one line: each paper in the order given, its name without the bed's prefix and suffix,
-- then its four counts as copies/proposals/taken as/revisions. "none" for an empty list, or the refusal's sentence.
CREATE FUNCTION rpd.listed(p_job uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a jsonb;
BEGIN
  a := public.list_test_job_removed_papers(p_job);
  IF (a ->> 'ok') IS DISTINCT FROM 'true' OR (a ->> 'job_id') IS DISTINCT FROM p_job::text OR jsonb_typeof(a -> 'papers') IS DISTINCT FROM 'array' THEN
    RETURN 'a wrong answer: ' || a::text;
  END IF;
  RETURN coalesce((
    SELECT string_agg(replace(replace(t.p ->> 'paper_name', 'Removed bed ', ''), ' (test)', '')
      || ' ' || (t.p ->> 'copies') || '/' || (t.p ->> 'proposals') || '/' || (t.p ->> 'taken_as') || '/' || (t.p ->> 'revisions'), ', ' ORDER BY t.ord)
    FROM jsonb_array_elements(a -> 'papers') WITH ORDINALITY AS t(p, ord)), 'none');
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A direct DELETE of one required paper, tried as the signed-in person: how many rows it reached, or the refusal.
CREATE FUNCTION rpd.try_direct(p_paper uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.job_required_papers WHERE id = p_paper;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text || ' row';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- What accept-contract does to a copy of a paper in prose when its person signs.
CREATE FUNCTION rpd.sign(p_paper uuid, p_person uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today()
  WHERE job_required_paper_id = p_paper AND person_id = p_person
$$;
-- And to a copy of a paper built from settings: the paper as the database reads it now, frozen on the copy.
CREATE FUNCTION rpd.sign_built(p_paper uuid, p_person uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE public.person_contract_documents d
    SET status = 'signed', signed_at = public.app_today(), paper_revision = (p.j ->> 'revision')::integer,
        clause_versions = p.j || jsonb_build_object('title', d.document_name, 'between', NULL)
  FROM (SELECT public.job_paper_clauses_now(p_paper, 'en') AS j) p
  WHERE d.job_required_paper_id = p_paper AND d.person_id = p_person
$$;
-- How many copies on people's files name a paper, and how many of them are signed, past RLS.
CREATE FUNCTION rpd.copies(p_paper uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT count(*)::text || ' named, ' || count(*) FILTER (WHERE d.status = 'signed')::text || ' signed' FROM public.person_contract_documents d WHERE d.job_required_paper_id = p_paper
$$;
GRANT USAGE ON SCHEMA rpd TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rpd TO authenticated, anon, service_role;

-- The people. Devon is the developer and Dana the office. Hector helps and is on the first job's team.
INSERT INTO auth.users (id, email) VALUES (rpd.id('a1'), 'devon@removedpaper.test'), (rpd.id('a2'), 'dana@removedpaper.test'), (rpd.id('a4'), 'hector@removedpaper.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at, login_attached_at) VALUES
  (rpd.id('a1'), 'devon@removedpaper.test', 'Devon Dev Rpd', 'dev', false, false, NULL, now()),
  (rpd.id('a2'), 'dana@removedpaper.test', 'Dana Office Rpd', 'assistant', false, false, NULL, now()),
  (rpd.id('a4'), 'hector@removedpaper.test', 'Hector Helper Rpd', 'helpers', false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at, login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (rpd.id('b2'), rpd.id('a1'), 'assistant', 'Dana Office Rpd', rpd.id('a2')),
  (rpd.id('b4'), rpd.id('a1'), 'helper', 'Hector Helper Rpd', rpd.id('a4'));

-- One customer, the GC on the two test jobs. The third job is a real one: nothing about it starts with ZZ.
INSERT INTO public.customers (id, name, master_user_id) VALUES (rpd.id('91'), 'ZZ Test removed paper GC', rpd.id('a1'));
INSERT INTO public.service_types (id, name) VALUES (rpd.id('f9'), 'Removed Paper Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, gc_customer_id) VALUES
  (rpd.id('e1'), rpd.id('a1'), rpd.id('f9'), 'ZZ Test removed paper job', 'J930', rpd.id('91')),
  (rpd.id('e3'), rpd.id('a1'), rpd.id('f9'), 'zz test second removed paper job', 'J932', rpd.id('91'));
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  (rpd.id('e2'), rpd.id('a1'), rpd.id('f9'), 'Cedar Hollow Lofts', 'J931');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES (rpd.id('e1'), rpd.id('a4')) ON CONFLICT DO NOTHING;

-- The Contract Book: a paper built from settings that opens on a notice, and five papers in prose.
INSERT INTO public.contract_templates (id, name) VALUES (rpd.id('c0'), 'Removed paper bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, revision, published_at, settings_def) VALUES
  (rpd.id('c1'), rpd.id('c0'), 'Removed bed settings paper (test)', 1, now(), $def${
    "settings": [
      { "key": "photos", "label": "Photos and video", "choices": [
        { "key": "off", "label": "Off", "says": "Placeholder: no photo rule.", "out": true },
        { "key": "standard", "label": "Standard", "says": "Placeholder: ask first." },
        { "key": "strict", "label": "Strict", "says": "Placeholder: no photos." } ] },
      { "key": "term", "label": "How long", "choices": [
        { "key": "short", "label": "Short", "says": "Placeholder: a short term." },
        { "key": "long", "label": "Long", "says": "Placeholder: a long term." } ] } ],
    "fields": [],
    "levels": [
      { "key": "standard", "label": "Standard", "alignedWith": "Aligned with a placeholder place", "picks": { "photos": "standard", "term": "short" } },
      { "key": "strict", "label": "Strict", "alignedWith": "Aligned with another placeholder place", "picks": { "photos": "strict", "term": "long" } } ],
    "notice": { "title": "Before you start", "lines": ["Placeholder notice line one."], "tick": "I have read this." }
  }$def$::jsonb);
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (rpd.id('c2'), rpd.id('c0'), 'Removed bed site rules (test)', '<p>Placeholder site rules.</p>', 'html'),
  (rpd.id('c3'), rpd.id('c0'), 'Removed bed photo rules (test)', '<p>Placeholder photo rules.</p>', 'html'),
  (rpd.id('c4'), rpd.id('c0'), 'Removed bed gate rules (test)', '<p>Placeholder gate rules.</p>', 'html'),
  (rpd.id('c5'), rpd.id('c0'), 'Removed bed copy rules (test)', '<p>Placeholder copy rules.</p>', 'html'),
  (rpd.id('c6'), rpd.id('c0'), 'Removed bed crew rules (test)', '<p>Placeholder crew rules.</p>', 'html');
INSERT INTO public.contract_clauses (id, paper_id, sequence_order, text_en, text_es, scope, slot, when_opts) VALUES
  (rpd.id('d1'), rpd.id('c1'), 1, 'Fixed placeholder one.', '', ARRAY['all'], NULL, NULL);

-- 0 · Who may call the two functions: a signed-in person and the service key, never nobody. The table still takes no
--     delete from a signed-in person.
SELECT rpd.same('who may call what', (
  SELECT string_agg(p.proname || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '/' || has_function_privilege('anon', p.oid, 'EXECUTE'), ' ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('list_test_job_removed_papers', 'delete_test_job_required_paper')),
  'delete_test_job_required_paper:true/false list_test_job_removed_papers:true/false');
SELECT rpd.same('the table grants a signed-in person no delete', has_table_privilege('authenticated', 'public.job_required_papers', 'DELETE')::text, 'false');

-- 1 · The main path. On a job named ZZ the dev requires three papers and takes them off. The list answers the three,
--     newest taken off first, with nothing pointing at any. A delete answers ok, the row is gone, and the list answers two.
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the dev requires three papers on the test job', public.job_papers_require(rpd.id('e1'), ARRAY[rpd.id('c2'), rpd.id('c3'), rpd.id('c4')])::text, '3');
SELECT rpd.same('while all three are on the job the list is empty', rpd.listed(rpd.id('e1')), 'none');
RESET ROLE;
SELECT rpd.keep('site', rpd.row_of(rpd.id('e1'), rpd.id('c2')));
SELECT rpd.keep('photo', rpd.row_of(rpd.id('e1'), rpd.id('c3')));
SELECT rpd.keep('gate', rpd.row_of(rpd.id('e1'), rpd.id('c4')));
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('a paper still on its job is not deleted', rpd.try_delete(rpd.kept('site')), 'This paper is still on its job. Take it off first.');
SELECT public.job_paper_remove(rpd.kept('site'));
SELECT public.job_paper_remove(rpd.kept('photo'));
SELECT public.job_paper_remove(rpd.kept('gate'));
RESET ROLE;
SELECT rpd.came_off('site', 30);
SELECT rpd.came_off('photo', 20);
SELECT rpd.came_off('gate', 10);
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the job requires nothing now', (SELECT count(*)::text FROM public.job_required_papers r WHERE r.job_id = rpd.id('e1') AND r.removed_at IS NULL), '0');
SELECT rpd.same('the list answers the three, newest taken off first, nothing pointing at any', rpd.listed(rpd.id('e1')), 'gate rules 0/0/0/0, photo rules 0/0/0/0, site rules 0/0/0/0');
SELECT rpd.same('each row carries its id, its name and its two days', (
  SELECT string_agg(((t.p ->> 'id') = rpd.kept(t.k)::text)::text || '|' || ((t.p ->> 'required_at') IS NOT NULL)::text || '|' || (((t.p ->> 'removed_at')::timestamptz) < now())::text, ', ' ORDER BY t.ord)
  FROM (SELECT x.p, x.ord, (ARRAY['gate', 'photo', 'site'])[x.ord::integer] AS k FROM jsonb_array_elements(public.list_test_job_removed_papers(rpd.id('e1')) -> 'papers') WITH ORDINALITY AS x(p, ord)) t),
  'true|true|true, true|true|true, true|true|true');
SELECT rpd.same('the delete answers ok with the job and the paper''s name', (SELECT (a ->> 'ok') || '|' || ((a ->> 'job_id') = rpd.id('e1')::text)::text || '|' || (a ->> 'paper_name') FROM public.delete_test_job_required_paper(rpd.kept('gate')) AS a), 'true|true|Removed bed gate rules (test)');
SELECT rpd.same('the row is gone and the other two stand', rpd.standing(), 'photo site');
SELECT rpd.same('the list answers two', rpd.listed(rpd.id('e1')), 'photo rules 0/0/0/0, site rules 0/0/0/0');
SELECT rpd.same('a paper already deleted is not there', rpd.try_delete(rpd.kept('gate')), 'The paper is not there any more. Read the list again.');
SELECT rpd.same('a paper that never was is not there', rpd.try_delete(rpd.id('7e')), 'The paper is not there any more. Read the list again.');
RESET ROLE;

-- 2 · A person's copy. One unsigned copy holds its paper. Two copies, one of them signed, hold theirs. Each row stays
--     and each copy still names its paper.
SELECT rpd.as_user(rpd.id('a2'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('Dana requires two more papers', public.job_papers_require(rpd.id('e1'), ARRAY[rpd.id('c5'), rpd.id('c6')])::text, '2');
SELECT rpd.same('she starts Hector''s copy of the first', (public.job_paper_start(rpd.row_of(rpd.id('e1'), rpd.id('c5')), rpd.id('b4')) IS NOT NULL)::text, 'true');
SELECT rpd.same('and Hector''s and her own of the second', (public.job_paper_start(rpd.row_of(rpd.id('e1'), rpd.id('c6')), rpd.id('b4')) IS NOT NULL)::text || '|' || (public.job_paper_start(rpd.row_of(rpd.id('e1'), rpd.id('c6'))) IS NOT NULL)::text, 'true|true');
RESET ROLE;
SELECT rpd.keep('copy', rpd.row_of(rpd.id('e1'), rpd.id('c5')));
SELECT rpd.keep('crew', rpd.row_of(rpd.id('e1'), rpd.id('c6')));
SELECT rpd.signed_out();
SELECT rpd.sign(rpd.kept('crew'), rpd.id('b4'));
SELECT rpd.same('one copy unsigned, and two with one signed', rpd.copies(rpd.kept('copy')) || ' ; ' || rpd.copies(rpd.kept('crew')), '1 named, 0 signed ; 2 named, 1 signed');
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove(rpd.kept('copy'));
SELECT public.job_paper_remove(rpd.kept('crew'));
RESET ROLE;
SELECT rpd.came_off('copy', 9);
SELECT rpd.came_off('crew', 8);
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the list counts the copies on each', rpd.listed(rpd.id('e1')), 'crew rules 2/0/0/0, copy rules 1/0/0/0, photo rules 0/0/0/0, site rules 0/0/0/0');
SELECT rpd.same('a paper an unsigned copy names stays', rpd.try_delete(rpd.kept('copy')), 'A copy on a person’s file names this paper. It stays.');
SELECT rpd.same('a paper two copies name stays, one of them signed', rpd.try_delete(rpd.kept('crew')), '2 copies on people’s files name this paper. It stays.');
RESET ROLE;
SELECT rpd.same('both rows stand', rpd.standing(), 'copy crew photo site');
SELECT rpd.same('and every copy still names its paper', rpd.copies(rpd.kept('copy')) || ' ; ' || rpd.copies(rpd.kept('crew')), '1 named, 0 signed ; 2 named, 1 signed');

-- 3 · A later revision, and a proposal taken as a paper. Dana requires the paper built from settings, Hector signs it,
--     the GC proposes and Dana takes it: the signed row comes off and a new version stands in its place. The old row
--     is named by a signed copy, by the proposal made on it and by the version after it. The new one is what the
--     proposal was taken as.
SELECT rpd.as_user(rpd.id('a2'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('Dana requires the paper built from settings', public.job_papers_require(rpd.id('e1'), ARRAY[rpd.id('c1')],
  jsonb_build_object(rpd.id('c1')::text, '{"settings":{"photos":"standard","term":"short"},"basis":"standard","notice_read":true}'::jsonb))::text, '1');
SELECT rpd.same('and starts Hector''s copy', (public.job_paper_start(rpd.row_of(rpd.id('e1'), rpd.id('c1')), rpd.id('b4')) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT rpd.keep('first', rpd.row_of(rpd.id('e1'), rpd.id('c1')));
SELECT rpd.signed_out();
SELECT rpd.sign_built(rpd.kept('first'), rpd.id('b4'));
SELECT rpd.as_service();
SET LOCAL ROLE service_role;
SELECT rpd.same('the GC proposes a longer term', (public.job_paper_propose(rpd.kept('first'), rpd.id('91'), NULL, '{"photos":"standard","term":"long"}'::jsonb, 'Greta Gc', true) ? 'id')::text, 'true');
RESET ROLE;
SELECT rpd.as_user(rpd.id('a2'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('Dana takes it, and one person signs again', (SELECT (r ->> 'proposal') || '|' || (r ->> 'state') || '|' || (r ->> 'sign_again') FROM public.job_paper_proposal_decide((SELECT x.id FROM public.job_paper_proposals x WHERE x.job_id = rpd.id('e1') AND x.state = 'waiting'), true) AS r), 'taken|revised|1');
RESET ROLE;
SELECT rpd.keep('second', rpd.row_of(rpd.id('e1'), rpd.id('c1')));
SELECT rpd.same('the second version names the first, and the take names the second', (
  SELECT (r.revision_of = rpd.kept('first'))::text || '|' || (x.required_paper_id = rpd.kept('first'))::text || '|' || (x.taken_as = rpd.kept('second'))::text
  FROM public.job_required_papers r, public.job_paper_proposals x WHERE r.id = rpd.kept('second') AND x.job_id = rpd.id('e1')), 'true|true|true');
SELECT rpd.came_off('first', 7);
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the list counts the copy, the proposal and the revision on the first version', rpd.listed(rpd.id('e1')), 'settings paper 1/1/0/1, crew rules 2/0/0/0, copy rules 1/0/0/0, photo rules 0/0/0/0, site rules 0/0/0/0');
SELECT rpd.same('the first version stays, held by its signed copy before anything else', rpd.try_delete(rpd.kept('first')), 'A copy on a person’s file names this paper. It stays.');
SELECT rpd.same('the second version is still on its job', rpd.try_delete(rpd.kept('second')), 'This paper is still on its job. Take it off first.');
SELECT public.job_paper_remove(rpd.kept('second'));
RESET ROLE;
SELECT rpd.came_off('second', 6);
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('taken off, the second version reads the proposal taken as it', rpd.listed(rpd.id('e1')), 'settings paper 0/0/1/0, settings paper 1/1/0/1, crew rules 2/0/0/0, copy rules 1/0/0/0, photo rules 0/0/0/0, site rules 0/0/0/0');
SELECT rpd.same('a paper a proposal was taken as stays', rpd.try_delete(rpd.kept('second')), 'A GC proposal was taken as this paper. It stays.');
RESET ROLE;
SELECT rpd.same('both versions stand, and the proposal with what it names', rpd.standing() || ' | ' || (SELECT count(*)::text || ' ' || bool_and(x.required_paper_id = rpd.kept('first') AND x.taken_as = rpd.kept('second'))::text FROM public.job_paper_proposals x WHERE x.job_id = rpd.id('e1')), 'copy crew first photo second site | 1 true');

-- 4 · A proposal made on a paper, alone. On the second test job the GC proposes and the paper comes off before the
--     office answers: the proposal is overtaken and still names the paper it was made on.
SELECT rpd.as_user(rpd.id('a2'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('Dana requires the paper on the second test job', public.job_papers_require(rpd.id('e3'), ARRAY[rpd.id('c1')],
  jsonb_build_object(rpd.id('c1')::text, '{"settings":{"photos":"standard","term":"short"},"basis":"standard","notice_read":true}'::jsonb))::text, '1');
RESET ROLE;
SELECT rpd.keep('proposed', rpd.row_of(rpd.id('e3'), rpd.id('c1')));
SELECT rpd.as_service();
SET LOCAL ROLE service_role;
SELECT rpd.same('the GC proposes on it', (public.job_paper_propose(rpd.kept('proposed'), rpd.id('91'), NULL, '{"photos":"strict","term":"short"}'::jsonb, 'Greta Gc', true) ? 'id')::text, 'true');
RESET ROLE;
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove(rpd.kept('proposed'));
RESET ROLE;
SELECT rpd.came_off('proposed', 5);
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the second job''s list counts the proposal made on the paper', rpd.listed(rpd.id('e3')), 'settings paper 0/1/0/0');
SELECT rpd.same('a paper a proposal was made on stays', rpd.try_delete(rpd.kept('proposed')), 'A GC proposal was made on this paper. It stays.');
RESET ROLE;
SELECT rpd.same('the proposal stands, overtaken, and still names its paper', (SELECT string_agg(x.state || ' ' || (x.required_paper_id = rpd.kept('proposed'))::text, ', ') FROM public.job_paper_proposals x WHERE x.job_id = rpd.id('e3')), 'overtaken true');

-- 5 · A later revision, alone. A revision is made when somebody has signed, so the paper before it is held by that
--     copy first. Here the copy is gone: two taken-off rows of one chain, written as fixtures, the later naming the
--     earlier. The earlier stays until the later is deleted.
SELECT rpd.signed_out();
INSERT INTO public.job_required_papers (id, job_id, book_document_id, paper_name, body_format, required_at, removed_at, settings, book_revision, settings_revision, revision_of) VALUES
  (rpd.id('71'), rpd.id('e3'), rpd.id('c1'), 'Removed bed chain paper (test)', 'html', now() - interval '3 days', now() - interval '50 hours', '{"photos":"standard","term":"short"}'::jsonb, 1, 1, NULL),
  (rpd.id('72'), rpd.id('e3'), rpd.id('c1'), 'Removed bed chain paper (test)', 'html', now() - interval '3 days', now() - interval '40 hours', '{"photos":"standard","term":"long"}'::jsonb, 1, 2, rpd.id('71'));
SELECT rpd.keep('earlier', rpd.id('71'));
SELECT rpd.keep('later', rpd.id('72'));
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the list counts the revision on the earlier row', rpd.listed(rpd.id('e3')), 'settings paper 0/1/0/0, chain paper 0/0/0/0, chain paper 0/0/0/1');
SELECT rpd.same('a paper a later revision names stays', rpd.try_delete(rpd.kept('earlier')), 'Another paper is a revision of this one. Delete the later one first.');
SELECT rpd.same('the later one goes first', rpd.try_delete(rpd.kept('later')), 'ok Removed bed chain paper (test)');
SELECT rpd.same('and then the earlier one', rpd.try_delete(rpd.kept('earlier')), 'ok Removed bed chain paper (test)');
SELECT rpd.same('the second job''s list is back to the one held paper', rpd.listed(rpd.id('e3')), 'settings paper 0/1/0/0');
RESET ROLE;

-- 6 · Who is refused. The office and a helper, by both functions. A job that is not there. A real job: its taken-off
--     paper is neither listed nor deleted, and stands afterwards.
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the dev requires a paper on the real job', public.job_papers_require(rpd.id('e2'), ARRAY[rpd.id('c2')])::text, '1');
RESET ROLE;
SELECT rpd.keep('real', rpd.row_of(rpd.id('e2'), rpd.id('c2')));
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove(rpd.kept('real'));
SELECT rpd.same('a real job''s taken-off papers are not listed', rpd.listed(rpd.id('e2')), 'Only a test job’s taken-off papers are listed. This job is a real one.');
SELECT rpd.same('a real job''s taken-off paper is not deleted', rpd.try_delete(rpd.kept('real')), 'Only a paper of a test job can be deleted. This job is a real one.');
SELECT rpd.same('a job that is not there has no list', rpd.listed(rpd.id('ee')), 'The job is not there any more.');
RESET ROLE;
SELECT rpd.same('the real job''s paper stands, taken off', (SELECT (r.removed_at IS NOT NULL)::text FROM public.job_required_papers r WHERE r.id = rpd.kept('real')), 'true');
SELECT rpd.as_user(rpd.id('a2'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the office does not delete a taken-off paper', rpd.try_delete(rpd.kept('photo')), 'Only a developer can delete a taken-off paper.');
SELECT rpd.same('the office does not read the list', rpd.listed(rpd.id('e1')), 'Only a developer can read a job’s taken-off papers.');
SELECT rpd.same('the office''s direct delete reaches nothing', (rpd.try_direct(rpd.kept('photo')) ~ '^(0 row|permission denied)')::text, 'true');
RESET ROLE;
SELECT rpd.as_user(rpd.id('a4'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('a helper does not delete a taken-off paper', rpd.try_delete(rpd.kept('photo')), 'Only a developer can delete a taken-off paper.');
SELECT rpd.same('a helper does not read the list', rpd.listed(rpd.id('e1')), 'Only a developer can read a job’s taken-off papers.');
RESET ROLE;

-- 7 · The table's revoked writes stand: the dev's own direct DELETE reaches no row, on a paper the function would take.
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the dev''s direct delete reaches nothing', (rpd.try_direct(rpd.kept('photo')) ~ '^(0 row|permission denied)')::text, 'true');
RESET ROLE;
SELECT rpd.same('every paper that was held or refused stands', rpd.standing(), 'copy crew first photo proposed real second site');

-- 8 · Nobody signed in. With no claims the functions say so. As anon the call is refused at the door, since both are
--     revoked from anon.
SELECT rpd.signed_out();
SELECT rpd.same('with nobody signed in the delete says so', rpd.try_delete(rpd.kept('photo')), 'Sign in first.');
SELECT rpd.same('with nobody signed in the list says so', rpd.listed(rpd.id('e1')), 'Sign in first.');
SET LOCAL ROLE anon;
SELECT rpd.refused('signed out, the delete refuses', format($q$SELECT public.delete_test_job_required_paper(%L)$q$, rpd.kept('photo')), 'permission denied');
SELECT rpd.refused('signed out, the list refuses', format($q$SELECT public.list_test_job_removed_papers(%L)$q$, rpd.id('e1')), 'permission denied');
RESET ROLE;

-- 9 · And the dev still deletes what nothing points at, to the end: the two plain papers of the first job.
SELECT rpd.as_user(rpd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT rpd.same('the dev deletes the photo rules', rpd.try_delete(rpd.kept('photo')), 'ok Removed bed photo rules (test)');
SELECT rpd.same('and the site rules', rpd.try_delete(rpd.kept('site')), 'ok Removed bed site rules (test)');
SELECT rpd.same('the first job''s list holds the four something points at', rpd.listed(rpd.id('e1')), 'settings paper 0/0/1/0, settings paper 1/1/0/1, crew rules 2/0/0/0, copy rules 1/0/0/0');
RESET ROLE;
SELECT rpd.signed_out();
SELECT rpd.same('what stands at the end', rpd.standing(), 'copy crew first proposed real second');

DO $$ BEGIN RAISE NOTICE 'removed_paper_delete PASSED'; END $$;
ROLLBACK;
