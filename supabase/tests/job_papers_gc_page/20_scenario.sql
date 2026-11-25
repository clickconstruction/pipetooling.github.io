-- What a GC reads about a job's papers (punch list #389 step 5, migration *_job_papers_gc_page). The service key reads,
-- for a job that requires a paper built from settings: its settings in plain words, the level they come to, how many
-- on the roster have signed, and each sub business with its day. The count is the office's own roster. A sub's
-- business is the trade company they work for, or their own roster name with none on file, and a helper is never
-- named. A change after a signature starts the count again on the new row. A job with no such paper is left out.
-- The office sets what the GC sees (migration *_job_paper_gc_view): the count alone, the businesses too, or every
-- signer by name, in place whoever has signed, and the next row keeps it.
-- The office marks a required form as the GC's own (migration *_job_paper_gc_own): a job with only such a form is
-- answered, the form sits in a list of its own with its count and its sub businesses, and the mark comes off in place.
-- Nobody signed in reads it, and the office's roster answers as it did. Every word is a made-up placeholder. The
-- fixture is made as postgres; presses run as each user; everything rolls back. Raises on the first failed
-- assertion; ends with "job_papers_gc_page PASSED". See scripts/pgtest-job-papers-gc-page.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA jgc;
CREATE FUNCTION jgc.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000003895' || p)::uuid $$;
CREATE FUNCTION jgc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jgc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION jgc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION jgc.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
CREATE FUNCTION jgc.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A job's live required paper for a Book entry, whoever asks.
CREATE FUNCTION jgc.row_of(p_job uuid, p_book uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT r.id FROM public.job_required_papers r WHERE r.job_id = p_job AND r.book_document_id = p_book AND r.removed_at IS NULL
$$;
CREATE FUNCTION jgc.copy_of(p_row uuid, p_person uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT d.id FROM public.person_contract_documents d WHERE d.job_required_paper_id = p_row AND d.person_id = p_person
$$;
-- What accept-contract does to a job's copy when its person signs: the paper as the database reads it now, frozen.
CREATE FUNCTION jgc.sign(p_row uuid, p_person uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE public.person_contract_documents d
    SET status = 'signed', signed_at = public.app_today(), paper_revision = (p.j ->> 'revision')::integer,
        clause_versions = p.j || jsonb_build_object('title', d.document_name, 'between', NULL)
  FROM (SELECT public.job_paper_clauses_now(p_row, 'en') AS j) p
  WHERE d.id = jgc.copy_of(p_row, p_person)
$$;
-- The one paper of one job, as the service key reads it, as one line:
-- level ; said ; signed of total-is-the-roster's ; each business as name people/signed/day.
CREATE FUNCTION jgc.page(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT coalesce(p ->> 'paper_name', '?') || ' r' || (p ->> 'settings_revision')
      || ' ; ' || coalesce((p -> 'level' ->> 'label') || ' (' || (p -> 'level' ->> 'aligned_with') || ')', 'a mix')
      || ' ; ' || (SELECT string_agg((s ->> 'label') || ': ' || (s ->> 'choice') || CASE WHEN (s ->> 'out')::boolean THEN ' out' ELSE '' END, ', ' ORDER BY at) FROM jsonb_array_elements(p -> 'said') WITH ORDINALITY AS t(s, at))
      || ' ; ' || (p ->> 'signed') || ' signed'
      || ' ; ' || coalesce((SELECT string_agg((b ->> 'name') || ' ' || (b ->> 'people') || '/' || (b ->> 'signed') || '/' || CASE WHEN b ->> 'signed_on' IS NULL THEN '-' WHEN b ->> 'signed_on' = public.app_today()::text THEN 'today' ELSE 'another day' END, ', ' ORDER BY at) FROM jsonb_array_elements(p -> 'businesses') WITH ORDINALITY AS t(b, at)), 'no sub')
    FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[p_job])) AS j, jsonb_array_elements(j -> 'papers') AS p
  ), 'nothing')
$$;
-- What the office set the GC to see, then each signer as name/business.
CREATE FUNCTION jgc.seen(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT (p ->> 'view') || ' ; ' || jsonb_array_length(p -> 'businesses') || ' businesses ; '
      || coalesce((SELECT string_agg((g ->> 'name') || '/' || coalesce(g ->> 'business', '-') || '/' || CASE WHEN g ->> 'signed_on' = public.app_today()::text THEN 'today' ELSE 'another day' END, ', ' ORDER BY at) FROM jsonb_array_elements(p -> 'signers') WITH ORDINALITY AS t(g, at)), 'no signer')
    FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[p_job])) AS j, jsonb_array_elements(j -> 'papers') AS p
  ), 'nothing')
$$;
CREATE FUNCTION jgc.kept(p_row uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(r.gc_view, 'null') || '|' || coalesce(r.gc_view_set_by::text, 'nobody') || '|' || (r.gc_view_set_at IS NOT NULL)::text FROM public.job_required_papers r WHERE r.id = p_row
$$;
-- A job's own forms, as the service key reads them: how many papers sit beside them, then each form as
-- name ; signed ; each business as name people/signed/day.
CREATE FUNCTION jgc.own(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT jsonb_array_length(j -> 'papers') || ' papers ; ' || coalesce((
      SELECT string_agg((f ->> 'paper_name') || ' ; ' || (f ->> 'signed') || ' signed ; '
        || coalesce((SELECT string_agg((b ->> 'name') || ' ' || (b ->> 'people') || '/' || (b ->> 'signed') || '/' || CASE WHEN b ->> 'signed_on' IS NULL THEN '-' WHEN b ->> 'signed_on' = public.app_today()::text THEN 'today' ELSE 'another day' END, ', ' ORDER BY bat) FROM jsonb_array_elements(f -> 'businesses') WITH ORDINALITY AS t(b, bat)), 'no business'), ' | ' ORDER BY fat)
      FROM jsonb_array_elements(j -> 'own_forms') WITH ORDINALITY AS o(f, fat)), 'no own form')
    FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[p_job])) AS j
  ), 'nothing')
$$;
CREATE FUNCTION jgc.own_kept(p_row uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT r.gc_own::text || '|' || coalesce(r.gc_own_set_by::text, 'nobody') || '|' || (r.gc_own_set_at IS NOT NULL)::text FROM public.job_required_papers r WHERE r.id = p_row
$$;
-- What accept-contract does to a form's copy when its person signs.
CREATE FUNCTION jgc.sign_form(p_row uuid, p_person uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE public.person_contract_documents d SET status = 'signed', signed_at = public.app_today() WHERE d.id = jgc.copy_of(p_row, p_person)
$$;
GRANT USAGE ON SCHEMA jgc TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jgc TO authenticated, anon, service_role;

-- Dana is the office. Hector helps and is on the job's team. Tall Pine and Tia work for one trade company, and Sam is a
-- sub with no company on file. None of the three subs has a login.
INSERT INTO auth.users (id, email) VALUES (jgc.id('a1'), 'devon@jobgcpage.test'), (jgc.id('a2'), 'dana@jobgcpage.test'), (jgc.id('a4'), 'hector@jobgcpage.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at, login_attached_at) VALUES
  (jgc.id('a1'), 'devon@jobgcpage.test', 'Devon Dev Jgc', 'dev', false, false, NULL, now()),
  (jgc.id('a2'), 'dana@jobgcpage.test', 'Dana Office Jgc', 'assistant', false, false, NULL, now()),
  (jgc.id('a4'), 'hector@jobgcpage.test', 'Hector Helper Jgc', 'helpers', false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at, login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.users (id, email, name, role, login_attached_at) VALUES
  (jgc.id('a7'), 'tallpine@jobgcpage.test', 'Tall Pine Jgc', 'subcontractor', NULL),
  (jgc.id('a8'), 'tia@jobgcpage.test', 'Tia Two Jgc', 'subcontractor', NULL),
  (jgc.id('a9'), 'sam@jobgcpage.test', 'Sam Sole Jgc', 'subcontractor', NULL);
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (jgc.id('b2'), jgc.id('a1'), 'assistant', 'Dana Office Jgc', jgc.id('a2')),
  (jgc.id('b4'), jgc.id('a1'), 'helper', 'Hector Helper Jgc', jgc.id('a4')),
  (jgc.id('b7'), jgc.id('a1'), 'sub', 'Tall Pine Jgc', jgc.id('a7')),
  (jgc.id('b8'), jgc.id('a1'), 'sub', 'Tia Two Jgc', jgc.id('a8')),
  (jgc.id('b9'), jgc.id('a1'), 'sub', 'Sam Sole Jgc', jgc.id('a9'));
INSERT INTO public.gc_companies (id, name, trades) VALUES (jgc.id('70'), 'Pine Ridge Excavating Jgc', ARRAY['Excavation']);
INSERT INTO public.person_trade_companies (person_id, company_id) VALUES (jgc.id('b7'), jgc.id('70')), (jgc.id('b8'), jgc.id('70'));

-- Three jobs: a ZZ Test job, which takes a paper nobody has read, one with a paper in prose, and one with none.
INSERT INTO public.service_types (id, name) VALUES (jgc.id('f9'), 'Job GC Page Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  (jgc.id('e1'), jgc.id('a1'), jgc.id('f9'), 'ZZ Test gc page bed job', 'J910'),
  (jgc.id('e2'), jgc.id('a1'), jgc.id('f9'), 'ZZ Test prose paper job', 'J911'),
  (jgc.id('e3'), jgc.id('a1'), jgc.id('f9'), 'ZZ Test no paper job', 'J912');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES (jgc.id('e1'), jgc.id('a4')) ON CONFLICT DO NOTHING;
-- Each sub has a sheet on the first job, which is what puts a sub on its roster.
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_ledger_id) VALUES
  (jgc.id('51'), jgc.id('a1'), 'Tall Pine Jgc', jgc.id('e1')),
  (jgc.id('52'), jgc.id('a1'), 'Tia Two Jgc', jgc.id('e1')),
  (jgc.id('53'), jgc.id('a1'), 'Sam Sole Jgc', jgc.id('e1'));
INSERT INTO public.people_labor_job_assignees (labor_job_id, person_id) VALUES
  (jgc.id('51'), jgc.id('b7')), (jgc.id('52'), jgc.id('b8')), (jgc.id('53'), jgc.id('b9'))
  ON CONFLICT DO NOTHING;

-- The Contract Book: a paper built from settings with one level, and site rules in prose.
INSERT INTO public.contract_templates (id, name) VALUES (jgc.id('c0'), 'Job gc page bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, revision, published_at, settings_def) VALUES
  (jgc.id('c1'), jgc.id('c0'), 'GC page bed paper (test)', 1, now(), $def${
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
      { "key": "strict", "label": "Strict", "alignedWith": "Aligned with another placeholder place", "picks": { "photos": "strict", "term": "long" } } ]
  }$def$::jsonb);
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (jgc.id('c2'), jgc.id('c0'), 'GC page bed site rules (test)', '<p>Placeholder rules.</p>', 'html');
INSERT INTO public.contract_clauses (id, paper_id, sequence_order, text_en, text_es, scope, slot, when_opts) VALUES
  (jgc.id('d1'), jgc.id('c1'), 1, 'Fixed placeholder one.', '', ARRAY['all'], NULL, NULL);

-- Dana requires the paper at its Standard level on the first job, and the prose paper on the second.
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana requires the paper built from settings', public.job_papers_require(jgc.id('e1'), ARRAY[jgc.id('c1')],
  jsonb_build_object(jgc.id('c1')::text, '{"settings":{"photos":"standard","term":"short"},"basis":"standard"}'::jsonb))::text, '1');
SELECT jgc.same('and the prose paper on another job', public.job_papers_require(jgc.id('e2'), ARRAY[jgc.id('c2')])::text, '1');
CREATE TEMP TABLE jgc_roster ON COMMIT DROP AS SELECT jsonb_array_length(public.job_papers_roster(jgc.id('e1')) -> 'people') AS n;
GRANT SELECT ON jgc_roster TO authenticated, anon, service_role;
SELECT jgc.same('the roster holds the office, the helper on the team and the three subs', ((SELECT n FROM jgc_roster) >= 5)::text, 'true');

-- Nobody signed in reads the GC's page or the roster's body.
SELECT jgc.refused('the office does not read the GC''s page', format($q$SELECT public.job_papers_gc_page(ARRAY[%L::uuid])$q$, jgc.id('e1')), 'permission denied');
SELECT jgc.refused('nor the roster''s body', format($q$SELECT public.job_papers_roster_now(%L)$q$, jgc.id('e1')), 'permission denied');
RESET ROLE;
SELECT jgc.as_user(jgc.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jgc.refused('a helper still reads no roster', format($q$SELECT public.job_papers_roster(%L)$q$, jgc.id('e1')), 'Only the office reads who has signed');
RESET ROLE;
SELECT jgc.signed_out();
SET LOCAL ROLE anon;
SELECT jgc.refused('signed out, nobody reads the GC''s page', format($q$SELECT public.job_papers_gc_page(ARRAY[%L::uuid])$q$, jgc.id('e1')), 'permission denied');
RESET ROLE;

-- The service key reads it. Nobody has signed.
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('before anyone signs: the level, the plain words, and each sub business with nobody signed', jgc.page(jgc.id('e1')),
  'GC page bed paper (test) r1 ; Standard (Aligned with a placeholder place) ; Photos and video: Standard, How long: Short ; 0 signed ; Pine Ridge Excavating Jgc 2/0/-, Sam Sole Jgc 1/0/-');
SELECT jgc.same('the total is the office''s own roster', (SELECT (p ->> 'total') FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[jgc.id('e1')])) AS j, jsonb_array_elements(j -> 'papers') AS p), (SELECT n::text FROM jgc_roster));
SELECT jgc.same('a helper is never named', (public.job_papers_gc_page(ARRAY[jgc.id('e1')])::text LIKE '%Hector%')::text, 'false');
SELECT jgc.same('a job whose paper is prose is left out', jgc.page(jgc.id('e2')), 'nothing');
SELECT jgc.same('and so is a job with no paper', jgc.page(jgc.id('e3')), 'nothing');
SELECT jgc.same('asked about all three, with one twice and a null, it answers the one job once',
  (SELECT string_agg(j ->> 'job_id', ',') FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[jgc.id('e3'), jgc.id('e1'), NULL, jgc.id('e2'), jgc.id('e1')])) AS j), jgc.id('e1')::text);
SELECT jgc.same('asked about nothing, it answers nothing', public.job_papers_gc_page(NULL)::text || public.job_papers_gc_page('{}')::text, '[][]');
RESET ROLE;

-- Tall Pine signs: one of the company's two people.
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana starts each sub''s copy', (public.job_paper_start(jgc.row_of(jgc.id('e1'), jgc.id('c1')), jgc.id('b7')) IS NOT NULL AND public.job_paper_start(jgc.row_of(jgc.id('e1'), jgc.id('c1')), jgc.id('b8')) IS NOT NULL
  AND public.job_paper_start(jgc.row_of(jgc.id('e1'), jgc.id('c1')), jgc.id('b9')) IS NOT NULL AND public.job_paper_start(jgc.row_of(jgc.id('e1'), jgc.id('c1')), jgc.id('b4')) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jgc.signed_out();
SELECT jgc.sign(jgc.row_of(jgc.id('e1'), jgc.id('c1')), jgc.id('b7'));
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('one of a business''s two people signed: the business has no day yet', jgc.page(jgc.id('e1')),
  'GC page bed paper (test) r1 ; Standard (Aligned with a placeholder place) ; Photos and video: Standard, How long: Short ; 1 signed ; Pine Ridge Excavating Jgc 2/1/-, Sam Sole Jgc 1/0/-');
RESET ROLE;

-- Tia and the helper sign. The business is whole, and the helper counts without a name.
SELECT jgc.signed_out();
SELECT jgc.sign(jgc.row_of(jgc.id('e1'), jgc.id('c1')), jgc.id('b8'));
SELECT jgc.sign(jgc.row_of(jgc.id('e1'), jgc.id('c1')), jgc.id('b4'));
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('both signed: the business reads its day, and the helper''s signature counts', jgc.page(jgc.id('e1')),
  'GC page bed paper (test) r1 ; Standard (Aligned with a placeholder place) ; Photos and video: Standard, How long: Short ; 3 signed ; Pine Ridge Excavating Jgc 2/2/today, Sam Sole Jgc 1/0/-');
RESET ROLE;

-- What the GC sees is the office's to set, whoever has signed. Every row starts on the count and the businesses.
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('a row nobody set shows the businesses and names no signer', jgc.seen(jgc.id('e1')), 'businesses ; 2 businesses ; no signer');
RESET ROLE;
SELECT jgc.as_user(jgc.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jgc.refused('a helper sets nothing a GC sees', format($q$SELECT public.job_paper_set_gc_view(%L, 'names')$q$, jgc.row_of(jgc.id('e1'), jgc.id('c1'))), 'Only the office sets the papers a job requires');
RESET ROLE;
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana sets the count alone, on a row three people signed', public.job_paper_set_gc_view(jgc.row_of(jgc.id('e1'), jgc.id('c1')), 'count'), 'count');
SELECT jgc.same('the row keeps who set it and when', jgc.kept(jgc.row_of(jgc.id('e1'), jgc.id('c1'))), 'count|' || jgc.id('a2')::text || '|true');
SELECT jgc.refused('a word that is none of the three is refused', format($q$SELECT public.job_paper_set_gc_view(%L, 'everything')$q$, jgc.row_of(jgc.id('e1'), jgc.id('c1'))), 'not one of the three ways');
SELECT jgc.refused('a paper in prose has nothing a GC reads', format($q$SELECT public.job_paper_set_gc_view(%L, 'count')$q$, jgc.row_of(jgc.id('e2'), jgc.id('c2'))), 'not built from settings');
RESET ROLE;
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('under the count alone no business is sent, and the count stays', jgc.seen(jgc.id('e1')) || ' ; ' || (SELECT p ->> 'signed' FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[jgc.id('e1')])) AS j, jsonb_array_elements(j -> 'papers') AS p), 'count ; 0 businesses ; no signer ; 3');
RESET ROLE;
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana sets every signer by name', public.job_paper_set_gc_view(jgc.row_of(jgc.id('e1'), jgc.id('c1')), ' Names '), 'names');
RESET ROLE;
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('by name: the businesses, and each signer with the company of a sub', jgc.seen(jgc.id('e1')),
  'names ; 2 businesses ; Hector Helper Jgc/-/today, Tall Pine Jgc/Pine Ridge Excavating Jgc/today, Tia Two Jgc/Pine Ridge Excavating Jgc/today');
SELECT jgc.same('a person who has not signed is not named', (public.job_papers_gc_page(ARRAY[jgc.id('e1')])::text LIKE '%Sam Sole Jgc%' AND (SELECT count(*) FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[jgc.id('e1')])) AS j, jsonb_array_elements(j -> 'papers') AS p, jsonb_array_elements(p -> 'signers') AS g WHERE g ->> 'name' = 'Sam Sole Jgc') = 0)::text, 'true');
RESET ROLE;

-- A change after a signature makes the next row, which nobody has signed, and these picks are no level of the list.
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana changes one topic after the signatures', (SELECT (r ->> 'state') || '|' || (r ->> 'sign_again') FROM public.job_paper_set_settings(jgc.row_of(jgc.id('e1'), jgc.id('c1')), '{"photos":"off","term":"short"}'::jsonb) AS r), 'revised|3');
RESET ROLE;
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('the new row: a mix of its own, a topic left out, and the count starts again', jgc.page(jgc.id('e1')),
  'GC page bed paper (test) r2 ; a mix ; Photos and video: Off out, How long: Short ; 0 signed ; Pine Ridge Excavating Jgc 2/0/-, Sam Sole Jgc 1/0/-');
SELECT jgc.same('the new row keeps what the GC sees, with nobody to name yet', jgc.seen(jgc.id('e1')), 'names ; 2 businesses ; no signer');
RESET ROLE;
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('and who set it', jgc.kept(jgc.row_of(jgc.id('e1'), jgc.id('c1'))), 'names|' || jgc.id('a2')::text || '|true');
SELECT jgc.same('an empty view is the businesses again', public.job_paper_set_gc_view(jgc.row_of(jgc.id('e1'), jgc.id('c1')), '') || '|' || split_part(jgc.kept(jgc.row_of(jgc.id('e1'), jgc.id('c1'))), '|', 1), 'businesses|null');
RESET ROLE;

-- Taken off, the job says nothing.
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove(jgc.row_of(jgc.id('e1'), jgc.id('c1')));
RESET ROLE;
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('a paper taken off the job is not read', jgc.page(jgc.id('e1')), 'nothing');
RESET ROLE;
SELECT jgc.signed_out();

-- The GC's own form. The first job now requires no paper built from settings. Dana requires a form on it, and a form
-- nobody marked is not read.
INSERT INTO public.contract_form_templates (id, name, pdf_storage_path, status, doc_type, published_at) VALUES
  (jgc.id('cf'), 'GC page bed GC form', 'bed/gc-form.pdf', 'published', 'agreement', now());
INSERT INTO public.contract_template_documents (id, template_id, document_name, form_template_id) VALUES
  (jgc.id('c3'), jgc.id('c0'), 'GC page bed GC form (test)', jgc.id('cf'));
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana requires a form on the first job', public.job_papers_require(jgc.id('e1'), ARRAY[jgc.id('c3')])::text, '1');
SELECT jgc.same('every row starts unmarked, set by nobody', jgc.own_kept(jgc.row_of(jgc.id('e1'), jgc.id('c3'))), 'false|nobody|false');
RESET ROLE;
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('a form nobody marked is not read', jgc.own(jgc.id('e1')), 'nothing');
RESET ROLE;

-- Who marks it, and what takes the mark.
SELECT jgc.as_user(jgc.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jgc.refused('a helper does not mark a form', format($q$SELECT public.job_paper_set_gc_own(%L, true)$q$, jgc.row_of(jgc.id('e1'), jgc.id('c3'))), 'Only the office sets the papers a job requires');
RESET ROLE;
SELECT jgc.signed_out();
SET LOCAL ROLE anon;
SELECT jgc.refused('signed out, nobody marks a form', format($q$SELECT public.job_paper_set_gc_own(%L, true)$q$, jgc.row_of(jgc.id('e1'), jgc.id('c3'))), 'permission denied');
RESET ROLE;
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.refused('a paper in prose is not a form', format($q$SELECT public.job_paper_set_gc_own(%L, true)$q$, jgc.row_of(jgc.id('e2'), jgc.id('c2'))), 'is not a form');
SELECT jgc.refused('the mark is yes or no', format($q$SELECT public.job_paper_set_gc_own(%L, NULL)$q$, jgc.row_of(jgc.id('e1'), jgc.id('c3'))), 'Say whether');
SELECT jgc.refused('a row that is gone takes no mark', format($q$SELECT public.job_paper_set_gc_own(%L, true)$q$, jgc.id('99')), 'no longer requires');
SELECT jgc.same('Dana marks the form as the GC''s own', public.job_paper_set_gc_own(jgc.row_of(jgc.id('e1'), jgc.id('c3')), true)::text, 'true');
SELECT jgc.same('and the row keeps who set it', jgc.own_kept(jgc.row_of(jgc.id('e1'), jgc.id('c3'))), 'true|' || jgc.id('a2')::text || '|true');
RESET ROLE;
SELECT jgc.refused('the table holds the mark to a form, whatever writes it', format($q$UPDATE public.job_required_papers SET gc_own = true WHERE id = %L$q$, jgc.row_of(jgc.id('e2'), jgc.id('c2'))), 'job_required_papers_gc_own_is_a_form');

-- The service key reads the job now, though it requires no paper built from settings.
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('a marked form is read with nobody signed: its name, the count and each sub business', jgc.own(jgc.id('e1')),
  '0 papers ; GC page bed GC form (test) ; 0 signed ; Pine Ridge Excavating Jgc 2/0/-, Sam Sole Jgc 1/0/-');
SELECT jgc.same('an own form says its name, its count and its businesses, and nothing of settings',
  (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[jgc.id('e1')])) AS j, jsonb_array_elements(j -> 'own_forms') AS f, jsonb_object_keys(f) AS k),
  'businesses,id,paper_name,signed,total');
SELECT jgc.same('its total is the office''s own roster', (SELECT (f ->> 'total') FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[jgc.id('e1')])) AS j, jsonb_array_elements(j -> 'own_forms') AS f), (SELECT n::text FROM jgc_roster));
SELECT jgc.same('a helper is still never named', (public.job_papers_gc_page(ARRAY[jgc.id('e1')])::text LIKE '%Hector%')::text, 'false');
SELECT jgc.same('the prose job is still left out', jgc.own(jgc.id('e2')), 'nothing');
RESET ROLE;

-- Sam and the helper sign the form.
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana starts two copies of the form', (public.job_paper_start(jgc.row_of(jgc.id('e1'), jgc.id('c3')), jgc.id('b9')) IS NOT NULL
  AND public.job_paper_start(jgc.row_of(jgc.id('e1'), jgc.id('c3')), jgc.id('b4')) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jgc.signed_out();
SELECT jgc.sign_form(jgc.row_of(jgc.id('e1'), jgc.id('c3')), jgc.id('b9'));
SELECT jgc.sign_form(jgc.row_of(jgc.id('e1'), jgc.id('c3')), jgc.id('b4'));
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('two signed: the sole sub reads its day, and the helper''s signature counts', jgc.own(jgc.id('e1')),
  '0 papers ; GC page bed GC form (test) ; 2 signed ; Pine Ridge Excavating Jgc 2/0/-, Sam Sole Jgc 1/1/today');
RESET ROLE;

-- A paper built from settings beside it: each sits in its own list.
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana requires the paper built from settings again', public.job_papers_require(jgc.id('e1'), ARRAY[jgc.id('c1')],
  jsonb_build_object(jgc.id('c1')::text, '{"settings":{"photos":"standard","term":"short"},"basis":"standard"}'::jsonb))::text, '1');
RESET ROLE;
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('the job answers one paper and one own form', jgc.own(jgc.id('e1')),
  '1 papers ; GC page bed GC form (test) ; 2 signed ; Pine Ridge Excavating Jgc 2/0/-, Sam Sole Jgc 1/1/today');
SELECT jgc.same('the form is never among the papers', (SELECT string_agg(p ->> 'paper_name', ',') FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[jgc.id('e1')])) AS j, jsonb_array_elements(j -> 'papers') AS p), 'GC page bed paper (test)');
RESET ROLE;

-- The mark comes off in place, though two have signed. The job then answers its paper alone.
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jgc.same('Dana takes the mark off', public.job_paper_set_gc_own(jgc.row_of(jgc.id('e1'), jgc.id('c3')), false)::text, 'false');
SELECT jgc.same('taken off twice, it answers the same', public.job_paper_set_gc_own(jgc.row_of(jgc.id('e1'), jgc.id('c3')), false)::text, 'false');
SELECT jgc.same('both signatures are kept', (SELECT count(*) FROM public.person_contract_documents d WHERE d.job_required_paper_id = jgc.row_of(jgc.id('e1'), jgc.id('c3')) AND d.status = 'signed')::text, '2');
RESET ROLE;
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('unmarked, the form is not read and the paper still is', jgc.own(jgc.id('e1')), '1 papers ; no own form');
RESET ROLE;

-- Marked again and the form taken off the job: nothing of it is read.
SELECT jgc.as_user(jgc.id('a2'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_set_gc_own(jgc.row_of(jgc.id('e1'), jgc.id('c3')), true);
SELECT public.job_paper_remove(jgc.row_of(jgc.id('e1'), jgc.id('c3')));
SELECT public.job_paper_remove(jgc.row_of(jgc.id('e1'), jgc.id('c1')));
RESET ROLE;
SELECT jgc.as_service();
SET LOCAL ROLE service_role;
SELECT jgc.same('a marked form taken off the job is not read', jgc.own(jgc.id('e1')), 'nothing');
RESET ROLE;
SELECT jgc.signed_out();

SELECT jgc.same('who may call what', (
  SELECT string_agg(p.proname || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '/' || has_function_privilege('anon', p.oid, 'EXECUTE') || '/' || has_function_privilege('service_role', p.oid, 'EXECUTE'), ' ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('job_papers_roster', 'job_papers_roster_now', 'job_papers_gc_page', 'job_paper_set_gc_view', 'job_paper_set_gc_own')),
  'job_paper_set_gc_own:true/false/true job_paper_set_gc_view:true/false/true job_papers_gc_page:false/false/true job_papers_roster:true/false/true job_papers_roster_now:false/false/false');

DO $$ BEGIN RAISE NOTICE 'job_papers_gc_page PASSED'; END $$;
ROLLBACK;
