-- Settings on the job, the ground (punch list #389 step 3, migration *_settings_on_the_job). A job carries the picks of
-- a paper built from settings on its required paper's row, and that row alone lifts step 1's refusal. One set of cases
-- runs through the database here and through the kernel in src/lib/contracts/jobPaperSettings.cases.test.ts, which
-- reads the JSON of jps.cases out of this file: which way a change of picks goes, the picks in plain words, and the
-- seal. Then the presses: a job with no settings behaves as before; settings are taken on an entry built from them and
-- refused on a plain one; the read-revision rule; who may set them; a copy is made for the job and never bare; a copy
-- is signed only with the paper frozen as the database reads it; the lock at the first signature; a change after it,
-- tighter or looser, makes a new row that everyone signs again (migration *_settings_page_ground, the ground under
-- step 4); a later clause edit leaves the signed words as they were; and the page's ground: the shape of a choice's
-- breach and site lines, the notice's box ticked once for a paper on a job, and the basis. Every word is a
-- made-up placeholder: no clause wording is here. Presses run as each user; the fixture is made as postgres;
-- everything rolls back. Raises on the first failed assertion; ends with "job_paper_settings PASSED". See
-- scripts/pgtest-job-paper-settings.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA jps;
-- Every id in this bed: one prefix and two characters.
CREATE FUNCTION jps.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000003893' || p)::uuid $$;
CREATE FUNCTION jps.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jps.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION jps.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The service key: a role and no person.
CREATE FUNCTION jps.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
-- Nobody: no claims at all.
CREATE FUNCTION jps.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A job's live required paper for a Book entry, whoever asks (the table itself is the office's to read).
CREATE FUNCTION jps.row_of(p_job uuid, p_book uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT r.id FROM public.job_required_papers r WHERE r.job_id = p_job AND r.book_document_id = p_book AND r.removed_at IS NULL
$$;
-- A person's copy of a required paper.
CREATE FUNCTION jps.copy_of(p_row uuid, p_person uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT d.id FROM public.person_contract_documents d WHERE d.job_required_paper_id = p_row AND d.person_id = p_person
$$;
-- What accept-contract does to a job's copy when its person signs: the paper it just read, frozen under the copy's
-- heading, with its revision. p_paper is what the function read; the database refuses anything but what it reads now.
CREATE FUNCTION jps.sign(p_copy uuid, p_paper jsonb) RETURNS void LANGUAGE sql AS $$
  UPDATE public.person_contract_documents d
    SET status = 'signed', signed_at = public.app_today(), paper_revision = (p_paper ->> 'revision')::integer,
        clause_versions = p_paper || jsonb_build_object('title', d.document_name, 'between', NULL)
  WHERE d.id = p_copy
$$;
-- A paper as one line: each clause with its number, then the picks said, then whether it carries a seal.
CREATE FUNCTION jps.line(p jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT string_agg((x ->> 'n') || ' ' || (x ->> 'text'), ' | ' ORDER BY (x ->> 'n')::integer) FROM jsonb_array_elements((p -> 'clauses') || (p -> 'exhibit')) AS x)
    || ' ; ' || (SELECT string_agg((s ->> 'label') || ': ' || (s ->> 'choice'), ', ' ORDER BY at) FROM jsonb_array_elements(p -> 'said') WITH ORDINALITY AS t(s, at))
    || ' ; ' || CASE WHEN p ->> 'sha256' ~ '^[0-9a-f]{64}$' THEN 'sealed' ELSE 'no seal' END
$$;
GRANT USAGE ON SCHEMA jps TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jps TO authenticated, anon, service_role;

-- The cases. `def` is the settings list. `changes` are changes of picks with the way each goes. `said` are picks with
-- the plain words they say. `seals` are papers with the seal each must carry: the kernel and the database both make
-- it, so a signed copy's seal can be checked by either.
CREATE TABLE jps.cases AS SELECT $cases$
{
  "def": {
    "settings": [
      { "key": "photos", "label": "Photos and video", "labelEs": "Fotos y video", "choices": [
        { "key": "off", "label": "Off", "says": "Nothing is asked about photos.", "out": true },
        { "key": "standard", "label": "Standard", "labelEs": "Estándar", "says": "Placeholder line for the standard choice.", "saysEs": "Línea de muestra para la opción estándar." },
        { "key": "strict", "label": "Strict", "says": "Placeholder line for the strict choice." } ] },
      { "key": "term", "label": "How long secrecy lasts", "choices": [
        { "key": "short", "label": "Short", "says": "Placeholder line for a short term.", "fills": { "term_words": "one year" }, "fillsEs": { "term_words": "un año" } },
        { "key": "long", "label": "Long", "says": "Placeholder line for a long term.", "fills": { "term_words": "three years" }, "fillsEs": { "term_words": "tres años" } } ] },
      { "key": "enforce", "label": "Direct enforcement", "choices": [
        { "key": "no", "label": "No", "says": "Placeholder line for no." },
        { "key": "yes", "label": "Yes", "says": "Placeholder line for yes." } ] }
    ],
    "fields": [ { "key": "term_words", "label": "How long" }, { "key": "party", "label": "Protected party" } ],
    "levels": [ { "key": "standard", "label": "Standard", "alignedWith": "Aligned with regular businesses", "picks": { "photos": "standard", "term": "short", "enforce": "no" } } ]
  },
  "changes": [
    { "name": "the same picks", "from": { "photos": "standard", "term": "short", "enforce": "no" }, "to": { "photos": "standard", "term": "short", "enforce": "no" }, "change": "same" },
    { "name": "one setting tighter", "from": { "photos": "standard", "term": "short", "enforce": "no" }, "to": { "photos": "strict", "term": "short", "enforce": "no" }, "change": "stricter" },
    { "name": "two settings tighter", "from": { "photos": "off", "term": "short", "enforce": "no" }, "to": { "photos": "strict", "term": "long", "enforce": "no" }, "change": "stricter" },
    { "name": "one setting looser", "from": { "photos": "standard", "term": "long", "enforce": "no" }, "to": { "photos": "standard", "term": "short", "enforce": "no" }, "change": "looser" },
    { "name": "a topic switched off is looser", "from": { "photos": "standard", "term": "short", "enforce": "no" }, "to": { "photos": "off", "term": "short", "enforce": "no" }, "change": "looser" },
    { "name": "one tighter and one looser", "from": { "photos": "standard", "term": "long", "enforce": "no" }, "to": { "photos": "strict", "term": "short", "enforce": "no" }, "change": "mixed" },
    { "name": "a setting the old picks never had counts from the loosest", "from": { "photos": "standard", "term": "short" }, "to": { "photos": "standard", "term": "short", "enforce": "yes" }, "change": "stricter" },
    { "name": "and stays the same on the loosest", "from": { "photos": "standard", "term": "short" }, "to": { "photos": "standard", "term": "short", "enforce": "no" }, "change": "same" },
    { "name": "an old pick the list no longer has cannot be placed", "from": { "photos": "loud", "term": "short", "enforce": "no" }, "to": { "photos": "strict", "term": "short", "enforce": "no" }, "change": "mixed" },
    { "name": "a new pick that is no choice cannot be placed", "from": { "photos": "standard", "term": "short", "enforce": "no" }, "to": { "photos": "standard", "term": "short" }, "change": "mixed" }
  ],
  "said": [
    { "name": "the standard mix", "picks": { "photos": "standard", "term": "short", "enforce": "no" }, "lang": "en",
      "lines": ["Photos and video | Standard | Placeholder line for the standard choice. | in", "How long secrecy lasts | Short | Placeholder line for a short term. | in", "Direct enforcement | No | Placeholder line for no. | in"] },
    { "name": "in Spanish, with the English where there is none", "picks": { "photos": "standard", "term": "long", "enforce": "yes" }, "lang": "es",
      "lines": ["Fotos y video | Estándar | Línea de muestra para la opción estándar. | in", "How long secrecy lasts | Long | Placeholder line for a long term. | in", "Direct enforcement | Yes | Placeholder line for yes. | in"] },
    { "name": "a topic left out, and a setting with no pick", "picks": { "photos": "off", "term": "short" }, "lang": "en",
      "lines": ["Photos and video | Off | Nothing is asked about photos. | out", "How long secrecy lasts | Short | Placeholder line for a short term. | in"] }
  ],
  "seals": [
    { "name": "a paper", "sha256": "75e6d0e9fe8a14a2d68ea9d324162c317716f291c9e2b2858e0732b82fc6f4b7",
      "paper": { "paperId": "00000000-0000-0000-0000-0000003893c1", "revision": 3, "lang": "en", "settings": { "term": "short", "photos": "standard", "enforce": "no" }, "fields": { "term_words": "one year" },
        "clauses": [ { "id": "00000000-0000-0000-0000-0000003893d1", "v": 1, "n": 1, "text": "Fixed placeholder one." }, { "id": "00000000-0000-0000-0000-0000003893d3", "v": 2, "n": 2, "text": "Secrecy lasts one year." } ],
        "exhibit": [], "exhibitFor": [] } },
    { "name": "the same paper at a later revision, under a heading, its keys in another order", "sha256": "75e6d0e9fe8a14a2d68ea9d324162c317716f291c9e2b2858e0732b82fc6f4b7",
      "paper": { "title": "Settings bed paper (test) (job J900)", "between": null, "exhibitFor": [], "exhibit": [], "lang": "en", "revision": 9, "fields": { "term_words": "one year" }, "settings": { "enforce": "no", "photos": "standard", "term": "short" },
        "clauses": [ { "n": 1, "v": 1, "text": "Fixed placeholder one.", "id": "00000000-0000-0000-0000-0000003893d1" }, { "id": "00000000-0000-0000-0000-0000003893d3", "v": 2, "n": 2, "text": "Secrecy lasts one year." } ],
        "paperId": "00000000-0000-0000-0000-0000003893c1" } },
    { "name": "one pick changed", "sha256": "ef8ede7512983f71da6ca10512f950bbf5343cac54424784ac1a0676790ca80d",
      "paper": { "paperId": "00000000-0000-0000-0000-0000003893c1", "revision": 3, "lang": "en", "settings": { "term": "short", "photos": "strict", "enforce": "no" }, "fields": { "term_words": "one year" },
        "clauses": [ { "id": "00000000-0000-0000-0000-0000003893d1", "v": 1, "n": 1, "text": "Fixed placeholder one." }, { "id": "00000000-0000-0000-0000-0000003893d3", "v": 2, "n": 2, "text": "Secrecy lasts one year." } ],
        "exhibit": [], "exhibitFor": [] } },
    { "name": "one clause at a later version", "sha256": "39d2382204e6dbe989f9a1e830bbca6fada1465258ee5795298ae2d46a6ecb39",
      "paper": { "paperId": "00000000-0000-0000-0000-0000003893c1", "revision": 3, "lang": "en", "settings": { "term": "short", "photos": "standard", "enforce": "no" }, "fields": { "term_words": "one year" },
        "clauses": [ { "id": "00000000-0000-0000-0000-0000003893d1", "v": 2, "n": 1, "text": "Fixed placeholder one." }, { "id": "00000000-0000-0000-0000-0000003893d3", "v": 2, "n": 2, "text": "Secrecy lasts one year." } ],
        "exhibit": [], "exhibitFor": [] } },
    { "name": "in Spanish, with a line break, an exhibit and no typed blank", "sha256": "3f10340a4ecad11b3a4bcded345aa6874e08f3b3f77e6437ee16e8f3278d0f7b",
      "paper": { "paperId": "00000000-0000-0000-0000-0000003893c1", "revision": 3, "lang": "es", "settings": { "photos": "strict", "term": "long", "enforce": "yes" }, "fields": {},
        "clauses": [ { "id": "00000000-0000-0000-0000-0000003893d3", "v": 1, "n": 1, "text": "El secreto dura tres años.\nSegunda línea, con “comillas”." } ],
        "exhibit": [ { "id": "00000000-0000-0000-0000-0000003893d7", "v": 1, "n": 2, "text": "Sitework placeholder." } ], "exhibitFor": ["Sitework"] } }
  ]
}
$cases$::jsonb AS j;

-- The people. Devon is a dev, Dana the office, Cora the controller. Hector helps, with a file tied to his login. Tall
-- Pine is a sub with no login. Tara is the office in training, Tess an office twin, Gwen left.
INSERT INTO auth.users (id, email) VALUES
  (jps.id('a1'), 'devon@jobsettings.test'), (jps.id('a2'), 'dana@jobsettings.test'), (jps.id('a3'), 'cora@jobsettings.test'),
  (jps.id('a4'), 'hector@jobsettings.test'), (jps.id('a6'), 'tara@jobsettings.test'), (jps.id('a7'), 'tess@jobsettings.test'),
  (jps.id('a8'), 'gwen@jobsettings.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at, login_attached_at) VALUES
  (jps.id('a1'), 'devon@jobsettings.test', 'Devon Dev Jps', 'dev', false, false, NULL, now()),
  (jps.id('a2'), 'dana@jobsettings.test', 'Dana Office Jps', 'assistant', false, false, NULL, now()),
  (jps.id('a3'), 'cora@jobsettings.test', 'Cora Controller Jps', 'controller', false, false, NULL, now()),
  (jps.id('a4'), 'hector@jobsettings.test', 'Hector Helper Jps', 'helpers', false, false, NULL, now()),
  (jps.id('a6'), 'tara@jobsettings.test', 'Tara Training Jps', 'assistant', true, false, NULL, now()),
  (jps.id('a7'), 'tess@jobsettings.test', 'Tess Twin Jps', 'assistant', false, true, NULL, now()),
  (jps.id('a8'), 'gwen@jobsettings.test', 'Gwen Gone Jps', 'assistant', false, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at, login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.users (id, email, name, role, login_attached_at) VALUES
  (jps.id('a9'), 'tallpine@jobsettings.test', 'Tall Pine Jps', 'subcontractor', NULL);
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (jps.id('b2'), jps.id('a1'), 'assistant', 'Dana Office Jps', jps.id('a2')),
  (jps.id('b4'), jps.id('a1'), 'helper', 'Hector Helper Jps', jps.id('a4')),
  (jps.id('b9'), jps.id('a1'), 'sub', 'Tall Pine Jps', jps.id('a9'));

-- Two jobs: a ZZ Test job, which takes a paper nobody has read, and a job that does not.
INSERT INTO public.service_types (id, name) VALUES (jps.id('f9'), 'Job Settings Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  (jps.id('e1'), jps.id('a1'), jps.id('f9'), ' zz Test settings bed job', 'J900'),
  (jps.id('e2'), jps.id('a1'), jps.id('f9'), 'Cedar Bluff Lofts', 'J901');

-- The Contract Book: a paper built from settings, with its clauses, and site rules in prose.
INSERT INTO public.contract_templates (id, name) VALUES (jps.id('c0'), 'Job settings bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, revision, published_at, settings_def) VALUES
  (jps.id('c1'), jps.id('c0'), 'Settings bed paper (test)', 1, now(), (SELECT j -> 'def' FROM jps.cases));
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (jps.id('c2'), jps.id('c0'), 'Site rules (test)', '<p>Placeholder rules.</p>', 'html');
-- A second paper built from settings, for the page's ground: its list has levels, a choice with breach and site lines,
-- a notice and a site note. Every word is a made-up placeholder.
CREATE TABLE jps.notice_def AS SELECT $def${
  "settings": [ { "key": "photos", "label": "Photos and video", "choices": [
    { "key": "off", "label": "Off", "says": "Placeholder: no photo rule.", "out": true },
    { "key": "standard", "label": "Standard", "says": "Placeholder: ask first.", "breach": ["Placeholder breach line one.", "Placeholder breach line two."], "site": ["Placeholder site line."] },
    { "key": "elevated", "label": "Elevated", "says": "Placeholder: no photos.", "breach": ["Placeholder breach line three."], "site": [] } ] } ],
  "fields": [],
  "levels": [ { "key": "standard", "label": "Standard", "alignedWith": "Aligned with a placeholder place", "picks": { "photos": "standard" } },
              { "key": "elevated", "label": "Elevated", "alignedWith": "Aligned with another placeholder place", "picks": { "photos": "elevated" } } ],
  "notice": { "title": "Before you start", "lines": ["Placeholder notice line one.", "Placeholder notice line two."], "tick": "I have read this." },
  "siteNote": { "title": "Match the paper to the site", "lead": "Placeholder lead.", "lines": ["Placeholder site note line."] }
}$def$::jsonb AS d;
INSERT INTO public.contract_template_documents (id, template_id, document_name, revision, published_at, settings_def) VALUES
  (jps.id('c3'), jps.id('c0'), 'Notice bed paper (test)', 1, now(), (SELECT d FROM jps.notice_def));
INSERT INTO public.contract_clauses (id, paper_id, sequence_order, text_en, text_es, scope, slot, when_opts) VALUES
  (jps.id('d1'), jps.id('c1'), 1, 'Fixed placeholder one.', '', ARRAY['all'], NULL, NULL),
  (jps.id('d2'), jps.id('c1'), 2, 'Photo placeholder A.', '', ARRAY['all'], 'photos', '{"photos":"standard"}'),
  (jps.id('d3'), jps.id('c1'), 3, 'Secrecy lasts {term_words}.', 'El secreto dura {term_words}.', ARRAY['all'], NULL, NULL),
  (jps.id('d4'), jps.id('c1'), 4, 'Enforce placeholder A, for {party}.', '', ARRAY['all'], 'enforce', '{"enforce":"yes"}'),
  (jps.id('d5'), jps.id('c1'), 5, 'Enforce placeholder B.', '', ARRAY['all'], 'enforce', '{"enforce":"no"}'),
  (jps.id('d6'), jps.id('c1'), 6, 'Photo placeholder B.', '', ARRAY['all'], 'photos', '{"photos":"strict"}'),
  (jps.id('d7'), jps.id('c3'), 1, 'Notice paper, fixed placeholder.', '', ARRAY['all'], NULL, NULL),
  (jps.id('d8'), jps.id('c3'), 2, 'Notice paper, photo placeholder A.', '', ARRAY['all'], 'photos', '{"photos":"standard"}'),
  (jps.id('d9'), jps.id('c3'), 3, 'Notice paper, photo placeholder B.', '', ARRAY['all'], 'photos', '{"photos":"elevated"}');

-- 1 · The cases, through the database.
DO $$
DECLARE
  k jsonb;
  v_def jsonb := (SELECT j -> 'def' FROM jps.cases);
BEGIN
  FOR k IN SELECT c FROM jps.cases, jsonb_array_elements(j -> 'changes') AS c LOOP
    PERFORM jps.same('change, ' || (k ->> 'name'), public.contract_paper_picks_change(v_def, k -> 'from', k -> 'to'), k ->> 'change');
  END LOOP;
  FOR k IN SELECT c FROM jps.cases, jsonb_array_elements(j -> 'said') AS c LOOP
    PERFORM jps.same('said, ' || (k ->> 'name'),
      (SELECT coalesce(string_agg((s ->> 'label') || ' | ' || (s ->> 'choice') || ' | ' || (s ->> 'says') || ' | ' || CASE WHEN (s ->> 'out')::boolean THEN 'out' ELSE 'in' END, ' ; ' ORDER BY at), '')
       FROM jsonb_array_elements(public.contract_paper_said(v_def, k -> 'picks', k ->> 'lang')) WITH ORDINALITY AS t(s, at)),
      (SELECT coalesce(string_agg(l, ' ; ' ORDER BY at), '') FROM jsonb_array_elements_text(k -> 'lines') WITH ORDINALITY AS t(l, at)));
  END LOOP;
  FOR k IN SELECT c FROM jps.cases, jsonb_array_elements(j -> 'seals') AS c LOOP
    PERFORM jps.same('seal, ' || (k ->> 'name'), public.contract_paper_seal(k -> 'paper'), k ->> 'sha256');
  END LOOP;
END $$;
SELECT jps.same('the ZZ rule reads a name that starts with ZZ, in any case, after trimming', public.job_is_zz_test(jps.id('e1'))::text || public.job_is_zz_test(jps.id('e2'))::text || public.job_is_zz_test(jps.id('ee'))::text, 'truefalsefalse');

-- 2 · A job with no settings behaves as before: the old two names require a plain paper, its copy is made and signed
-- with nothing frozen, and the job opens.
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.same('Dana requires the site rules by the old two names', public.job_papers_require(jps.id('e2'), ARRAY[jps.id('c2')])::text, '1');
SELECT jps.same('the row carries no settings', (SELECT (r.settings IS NULL AND r.fields IS NULL AND r.book_revision IS NULL AND r.settings_revision IS NULL AND r.revision_of IS NULL)::text || '|' || r.body_html FROM public.job_required_papers r WHERE r.id = jps.row_of(jps.id('e2'), jps.id('c2'))), 'true|<p>Placeholder rules.</p>');
SELECT jps.refused('a plain paper takes no settings', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid], %L::jsonb)$q$, jps.id('e1'), jps.id('c2'), jsonb_build_object(jps.id('c2')::text, '{"settings":{"photos":"off"}}'::jsonb)), 'Site rules (test) is not built from settings. It takes none.');
SELECT jps.refused('nor has any to set', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"off"}'::jsonb)$q$, jps.row_of(jps.id('e2'), jps.id('c2'))), 'That paper is not built from settings. It has none to set.');
SELECT jps.refused('nor a paper to read here', format($q$SELECT public.job_paper_clauses(%L)$q$, jps.row_of(jps.id('e2'), jps.id('c2'))), 'This paper is built from settings. It goes from a job, with its settings.');
RESET ROLE;
SELECT jps.as_user(jps.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jps.same('the job is closed to Hector', public.job_closed_to_me(jps.id('e2'))::text, 'true');
SELECT jps.same('Hector starts his copy', (public.job_paper_start(jps.row_of(jps.id('e2'), jps.id('c2'))) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jps.signed_out();
UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today() WHERE id = jps.copy_of(jps.row_of(jps.id('e2'), jps.id('c2')), jps.id('b4'));
SELECT jps.same('his copy is signed as the body it is, with nothing frozen', (SELECT d.status || '|' || d.signing_body_html || '|' || (d.clause_versions IS NULL)::text FROM public.person_contract_documents d WHERE d.id = jps.copy_of(jps.row_of(jps.id('e2'), jps.id('c2')), jps.id('b4'))), 'signed|<p>Placeholder rules.</p>|true');
SELECT jps.as_user(jps.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jps.same('and the job is open to him', public.job_closed_to_me(jps.id('e2'))::text, 'false');
RESET ROLE;

-- 3 · A paper built from settings is required with its picks, and checked whole before the job takes it.
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('by the old two names it is refused', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid])$q$, jps.id('e1'), jps.id('c1')), 'Settings bed paper (test) is built from settings. Require it with its settings.');
SELECT jps.refused('a setting unpicked', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid], %L::jsonb)$q$, jps.id('e1'), jps.id('c1'), jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"standard","term":"short"}}'::jsonb)), 'Pick Direct enforcement.');
SELECT jps.refused('a blank with no value', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid], %L::jsonb)$q$, jps.id('e1'), jps.id('c1'), jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"standard","term":"short","enforce":"yes"},"fields":{"party":"  "}}'::jsonb)), 'has a blank with no value: Protected party.');
-- The read-revision rule: nobody has read this paper, so only the ZZ Test job takes it.
SELECT jps.refused('a job that is not a ZZ Test job does not take an unread paper', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid], %L::jsonb)$q$, jps.id('e2'), jps.id('c1'), jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"standard","term":"short","enforce":"no"}}'::jsonb)), 'Settings bed paper (test) has not been read by an attorney as it reads today. Until it is, only a ZZ Test job takes it.');
SELECT jps.same('the ZZ Test job takes it, with a pick that is not on the list left behind', public.job_papers_require(jps.id('e1'), ARRAY[jps.id('c1'), jps.id('c2')], jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"standard","term":"short","enforce":"no","badges":"on"},"fields":{"party":"  ","nope":"x"}}'::jsonb))::text, '2');
SELECT jps.same('the row carries the picks, the Book''s revision and its own first number, and no body',
  (SELECT r.settings::text || '|' || coalesce(r.fields::text, 'none') || '|' || r.book_revision || '|' || r.settings_revision || '|' || (r.body_html IS NULL)::text || '|' || (r.settings_set_by = jps.id('a2'))::text
   FROM public.job_required_papers r WHERE r.id = jps.row_of(jps.id('e1'), jps.id('c1'))),
  '{"term": "short", "photos": "standard", "enforce": "no"}|none|1|1|true|true');
SELECT jps.same('the same again adds nothing', public.job_papers_require(jps.id('e1'), ARRAY[jps.id('c1')], jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"standard","term":"short","enforce":"no"}}'::jsonb))::text, '0');
SELECT jps.refused('other settings for a paper the job requires already', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid], %L::jsonb)$q$, jps.id('e1'), jps.id('c1'), jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"strict","term":"short","enforce":"no"}}'::jsonb)), 'This job requires Settings bed paper (test) already, with other settings. Change them on that paper.');
RESET ROLE;

-- 4 · Who sets a job's settings: the office. Not a helper, a twin, training, someone who left or nobody.
SELECT jps.as_user(jps.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('a helper sets none', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"strict","term":"short","enforce":"no"}'::jsonb)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'Only the office sets the papers a job requires.');
SELECT jps.refused('a helper requires none', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid], '{}'::jsonb)$q$, jps.id('e1'), jps.id('c1')), 'Only the office sets the papers a job requires.');
SELECT jps.refused('a helper does not read the job''s paper here', format($q$SELECT public.job_paper_clauses(%L)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'Only the office reads a job''s paper here.');
RESET ROLE;
SELECT jps.as_user(jps.id('a7'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('a twin sets none', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"strict","term":"short","enforce":"no"}'::jsonb)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'A digital twin cannot set a job''s paper settings.');
SELECT jps.refused('a twin requires none with settings', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid], %L::jsonb)$q$, jps.id('e2'), jps.id('c1'), jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"standard","term":"short","enforce":"no"}}'::jsonb)), 'A digital twin cannot set a job''s paper settings.');
RESET ROLE;
SELECT jps.as_user(jps.id('a6'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('training sets none', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"strict","term":"short","enforce":"no"}'::jsonb)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'Training mode is read-only. Nothing was changed.');
RESET ROLE;
SELECT jps.as_user(jps.id('a8'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('someone who left sets none', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"strict","term":"short","enforce":"no"}'::jsonb)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'This account is archived.');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.refused('signed out, nobody sets any', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"strict","term":"short","enforce":"no"}'::jsonb)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'Sign in to set a job''s paper settings.');
SET LOCAL ROLE anon;
SELECT jps.refused('nor reads the job''s paper', format($q$SELECT public.job_paper_clauses(%L)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'permission denied for function job_paper_clauses');
RESET ROLE;
SELECT jps.as_user(jps.id('a1'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('nobody signed in writes the picks by hand', format($q$UPDATE public.job_required_papers SET settings = '{"photos":"off","term":"short","enforce":"no"}'::jsonb WHERE id = %L$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'permission denied for table job_required_papers');
SELECT jps.refused('nor reaches the helpers', $q$SELECT public.job_paper_clauses_now(NULL, 'en')$q$, 'permission denied for function job_paper_clauses_now');
RESET ROLE;

-- 5 · A copy is made for the job, and still never bare. The job's paper reads as its picks ask.
SELECT jps.as_user(jps.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jps.same('Hector starts his copy of the job''s paper', (public.job_paper_start(jps.row_of(jps.id('e1'), jps.id('c1'))) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.same('Dana starts one for Tall Pine', (public.job_paper_start(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b9')) IS NOT NULL)::text, 'true');
SELECT jps.same('and one of her own', (public.job_paper_start(jps.row_of(jps.id('e1'), jps.id('c1'))) IS NOT NULL)::text, 'true');
SELECT jps.same('the office reads the job''s paper', jps.line(public.job_paper_clauses(jps.row_of(jps.id('e1'), jps.id('c1')))),
  '1 Fixed placeholder one. | 2 Photo placeholder A. | 3 Secrecy lasts one year. | 4 Enforce placeholder B. ; Photos and video: Standard, How long secrecy lasts: Short, Direct enforcement: No ; sealed');
RESET ROLE;
SELECT jps.as_service();
SET LOCAL ROLE service_role;
SELECT jps.same('the service key reads it in Spanish', jps.line(public.job_paper_clauses(jps.row_of(jps.id('e1'), jps.id('c1')), 'es')),
  '1 Fixed placeholder one. | 2 Photo placeholder A. | 3 El secreto dura un año. | 4 Enforce placeholder B. ; Fotos y video: Estándar, How long secrecy lasts: Short, Direct enforcement: No ; sealed');
SELECT jps.same('its seal is the seal of what it carries, and it names its row', (SELECT (p ->> 'sha256' = public.contract_paper_seal(p))::text || '|' || (p ->> 'jobPaperId' = jps.row_of(jps.id('e1'), jps.id('c1'))::text)::text || '|' || (p ->> 'settingsRevision') || '|' || (p -> 'settings')::text
  FROM public.job_paper_clauses(jps.row_of(jps.id('e1'), jps.id('c1'))) AS p), 'true|true|1|{"term": "short", "photos": "standard", "enforce": "no"}');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.same('the copy carries the job and no body', (SELECT d.document_name || '|' || d.status || '|' || (d.signing_body_html IS NULL)::text || '|' || (d.applied_contract_template_document_id = jps.id('c1'))::text FROM public.person_contract_documents d WHERE d.id = jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4'))),
  'Settings bed paper (test) (job J900)|unsent|true|true');
SELECT jps.refused('a copy with no job is still refused', format($q$INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status, applied_contract_template_document_id) VALUES ('Jobless Jordan Jps', 'Settings bed paper (test)', gen_random_uuid(), 1, 'unsent', %L)$q$, jps.id('c1')), 'This paper is built from settings. It goes from a job, with its settings.');
SELECT jps.refused('and so is one hung on a plain paper''s row', format($q$INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status, applied_contract_template_document_id, job_required_paper_id) VALUES ('Jobless Jordan Jps', 'Settings bed paper (test)', gen_random_uuid(), 1, 'unsent', %L, %L)$q$, jps.id('c1'), jps.row_of(jps.id('e1'), jps.id('c2'))), 'This paper is built from settings. It goes from a job, with its settings.');

-- 6 · Until someone signs, a change is made in place, and a page that showed the old paper cannot sign it.
CREATE TEMP TABLE jps_read ON COMMIT DROP AS SELECT public.job_paper_clauses_now(jps.row_of(jps.id('e1'), jps.id('c1')), 'en') AS p;
SELECT jps.refused('a copy is never signed bare', format($q$UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today() WHERE id = %L$q$, jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4'))), 'The paper changed since you opened it. Reload to read the new version.');
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('the same settings again is nothing changed', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"standard","term":"short","enforce":"no"}'::jsonb)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'Nothing changed.');
CREATE TEMP TABLE jps_set1 ON COMMIT DROP AS SELECT public.job_paper_set_settings(jps.row_of(jps.id('e1'), jps.id('c1')), '{"photos":"off","term":"long","enforce":"no"}'::jsonb) AS r;
SELECT jps.same('before any signature Dana loosens one setting and tightens another, in place', (SELECT (r ->> 'state') || '|' || (r ->> 'change') || '|' || (r ->> 'revision') || '|' || (r ->> 'sign_again') || '|' || (r ->> 'id' = jps.row_of(jps.id('e1'), jps.id('c1'))::text)::text FROM jps_set1), 'saved|mixed|1|0|true');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.refused('the paper the page showed before the change is not signed', format($q$SELECT jps.sign(%L, (SELECT p FROM jps_read))$q$, jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4'))), 'The paper changed since you opened it. Reload to read the new version.');
SELECT jps.refused('nor a paper with a word changed', format($q$SELECT jps.sign(%L, jsonb_set(public.job_paper_clauses_now(%L, 'en'), '{clauses,0,text}', '"Another placeholder."'))$q$, jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4')), jps.row_of(jps.id('e1'), jps.id('c1'))), 'The paper changed since you opened it. Reload to read the new version.');
SELECT jps.refused('nor one at another revision', format($q$UPDATE public.person_contract_documents SET status = 'signed', paper_revision = 7, clause_versions = public.job_paper_clauses_now(%L, 'en') WHERE id = %L$q$, jps.row_of(jps.id('e1'), jps.id('c1')), jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4'))), 'The paper changed since you opened it. Reload to read the new version.');

-- 7 · Hector signs what the job's paper reads now. His copy keeps the settings, the words and the seal.
SELECT jps.sign(jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4')), public.job_paper_clauses_now(jps.row_of(jps.id('e1'), jps.id('c1')), 'en'));
SELECT jps.same('his signed copy keeps the picks, the words, the revision and the seal',
  (SELECT d.status || '|' || d.paper_revision || '|' || jps.line(d.clause_versions) || '|' || (d.clause_versions -> 'settings')::text || '|' || (d.clause_versions ->> 'title')
     || '|' || (d.clause_versions ->> 'sha256' = public.contract_paper_seal(d.clause_versions))::text
   FROM public.person_contract_documents d WHERE d.id = jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4'))),
  'signed|1|1 Fixed placeholder one. | 2 Secrecy lasts three years. | 3 Enforce placeholder B. ; Photos and video: Off, How long secrecy lasts: Long, Direct enforcement: No ; sealed|{"term": "long", "photos": "off", "enforce": "no"}|Settings bed paper (test) (job J900)|true');
SELECT jps.refused('a signed copy keeps the words it was signed with', format($q$UPDATE public.person_contract_documents SET clause_versions = clause_versions || '{"sha256":"0"}'::jsonb WHERE id = %L$q$, jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4'))), 'A signed copy keeps the words it was signed with.');
CREATE TEMP TABLE jps_first ON COMMIT DROP AS SELECT jps.row_of(jps.id('e1'), jps.id('c1')) AS id;
GRANT SELECT ON jps_first TO authenticated, anon, service_role;

-- 8 · The lock. With one signature in, the row keeps its settings, whatever writes the table. Any change after it,
-- tighter or looser, makes a new row that everyone signs again (Taunya's call, 2026-11-21). Step 3 held it to
-- stricter only. The two looser changes below are each tried and rolled back, so the rest of the bed stands on the
-- stricter one as before.
SELECT jps.refused('the row keeps its settings as signed, even from the database''s owner', format($q$UPDATE public.job_required_papers SET settings = '{"photos":"strict","term":"long","enforce":"no"}'::jsonb WHERE id = %L$q$, (SELECT id FROM jps_first)), 'People have signed this paper. Its settings stay as they signed them.');
SELECT jps.refused('and its kind', format($q$UPDATE public.job_required_papers SET settings = NULL, fields = NULL, book_revision = NULL, settings_revision = NULL WHERE id = %L$q$, (SELECT id FROM jps_first)), 'A required paper keeps its kind.');
UPDATE public.job_required_papers SET removed_at = now() WHERE id = (SELECT id FROM jps_first);
UPDATE public.job_required_papers SET removed_at = NULL WHERE id = (SELECT id FROM jps_first);
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SAVEPOINT jps_looser;
SELECT jps.same('a looser change after a signature is taken, as a new row that everyone signs again', (SELECT (r ->> 'state') || '|' || (r ->> 'change') || '|' || (r ->> 'revision') || '|' || (r ->> 'sign_again') || '|' || (r ->> 'id' <> (SELECT id FROM jps_first)::text)::text FROM public.job_paper_set_settings((SELECT id FROM jps_first), '{"photos":"off","term":"short","enforce":"no"}'::jsonb) AS r), 'revised|looser|2|1|true');
ROLLBACK TO SAVEPOINT jps_looser;
SAVEPOINT jps_mixed;
SELECT jps.same('and so is one that tightens one setting and loosens another', (SELECT (r ->> 'state') || '|' || (r ->> 'change') || '|' || (r ->> 'revision') || '|' || (r ->> 'sign_again') FROM public.job_paper_set_settings((SELECT id FROM jps_first), '{"photos":"strict","term":"short","enforce":"no"}'::jsonb) AS r), 'revised|mixed|2|1');
ROLLBACK TO SAVEPOINT jps_mixed;
SELECT jps.refused('nothing changed is still nothing changed', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"off","term":"long","enforce":"no"}'::jsonb)$q$, (SELECT id FROM jps_first)), 'Nothing changed.');
CREATE TEMP TABLE jps_set2 ON COMMIT DROP AS SELECT public.job_paper_set_settings((SELECT id FROM jps_first), '{"photos":"standard","term":"long","enforce":"yes"}'::jsonb, '{"party":" Ridgeway Sample Holdings "}'::jsonb) AS r;
SELECT jps.same('a stricter change after a signature makes the next row, and says who signs again', (SELECT (r ->> 'state') || '|' || (r ->> 'change') || '|' || (r ->> 'revision') || '|' || (r ->> 'sign_again') || '|' || (r ->> 'id' <> (SELECT id FROM jps_first)::text)::text || '|' || (r ->> 'id' = jps.row_of(jps.id('e1'), jps.id('c1'))::text)::text FROM jps_set2), 'revised|stricter|2|1|true|true');
SELECT jps.same('the new row names the one it replaced and keeps its place in the job''s order, and the old one is off with its signature',
  (SELECT (n.revision_of = o.id)::text || '|' || (n.required_at = o.required_at)::text || '|' || n.settings_revision || '|' || n.fields::text || '|' || (o.removed_at IS NOT NULL)::text || '|' || o.settings::text
     || '|' || (SELECT count(*) FROM public.person_contract_documents d WHERE d.job_required_paper_id = o.id AND d.status = 'signed')
   FROM public.job_required_papers n JOIN public.job_required_papers o ON o.id = (SELECT id FROM jps_first) WHERE n.id = jps.row_of(jps.id('e1'), jps.id('c1'))),
  'true|true|2|{"party": "Ridgeway Sample Holdings"}|true|{"term": "long", "photos": "off", "enforce": "no"}|1');
SELECT jps.same('the job''s paper now reads its new picks, with the typed blank', jps.line(public.job_paper_clauses(jps.row_of(jps.id('e1'), jps.id('c1')))),
  '1 Fixed placeholder one. | 2 Photo placeholder A. | 3 Secrecy lasts three years. | 4 Enforce placeholder A, for Ridgeway Sample Holdings. ; Photos and video: Standard, How long secrecy lasts: Long, Direct enforcement: Yes ; sealed');
SELECT jps.refused('the old row has no paper to read', format($q$SELECT public.job_paper_clauses(%L)$q$, (SELECT id FROM jps_first)), 'This job no longer requires that paper.');
RESET ROLE;
SELECT jps.as_user(jps.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jps.same('the job is closed to Hector again, who signs the new paper', public.job_closed_to_me(jps.id('e1'))::text, 'true');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.refused('Tall Pine''s copy of the old row is not signed', format($q$UPDATE public.person_contract_documents SET status = 'signed', paper_revision = 1, clause_versions = (SELECT p FROM jps_read) WHERE id = %L$q$, jps.copy_of((SELECT id FROM jps_first), jps.id('b9'))), 'This job no longer requires that paper.');
SELECT jps.same('Hector''s first signature is as he made it', (SELECT d.status || '|' || (d.clause_versions -> 'settings')::text FROM public.person_contract_documents d WHERE d.id = jps.copy_of((SELECT id FROM jps_first), jps.id('b4'))), 'signed|{"term": "long", "photos": "off", "enforce": "no"}');

-- 9 · A typed blank alone, after a signature, is a change too. And a later clause edit leaves the signed words alone.
SELECT jps.as_user(jps.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jps.same('Hector starts his copy of the new row', (public.job_paper_start(jps.row_of(jps.id('e1'), jps.id('c1'))) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.sign(jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4')), public.job_paper_clauses_now(jps.row_of(jps.id('e1'), jps.id('c1')), 'es'));
SELECT jps.same('he signs it in Spanish, and the copy keeps the language he read', (SELECT (d.clause_versions ->> 'lang') || '|' || (d.clause_versions -> 'clauses' -> 2 ->> 'text') || '|' || (d.clause_versions ->> 'settingsRevision') FROM public.person_contract_documents d WHERE d.id = jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4'))), 'es|El secreto dura tres años.|2');
SELECT jps.as_user(jps.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jps.same('the job is open to Hector once the site rules are signed too', public.job_closed_to_me(jps.id('e1'))::text || '|' || (SELECT count(*) FROM jsonb_array_elements(public.job_papers_mine(jps.id('e1')) -> 'papers') AS p WHERE p ->> 'status' = 'signed'), 'true|1');
RESET ROLE;
SELECT jps.as_user(jps.id('a3'));
SET LOCAL ROLE authenticated;
SELECT jps.same('the controller edits a clause, and the Book moves on', (SELECT r ->> 'state' || ' r' || (r ->> 'revision') FROM public.edit_clause(jps.id('c1'), 'edit', jps.id('d1'), 'Fixed placeholder one, reworded.') AS r), 'published r2');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.same('Hector''s signed words are as they were, at the revision he signed', (SELECT d.paper_revision || '|' || (d.clause_versions -> 'clauses' -> 0 ->> 'text') || '|' || (d.clause_versions -> 'clauses' -> 0 ->> 'v') FROM public.person_contract_documents d WHERE d.id = jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c1')), jps.id('b4'))), '1|Fixed placeholder one.|1');
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.same('the job''s paper reads the new words for whoever signs next', (SELECT (p ->> 'revision') || '|' || (p -> 'clauses' -> 0 ->> 'text') || '|' || (p -> 'clauses' -> 0 ->> 'v') FROM public.job_paper_clauses(jps.row_of(jps.id('e1'), jps.id('c1'))) AS p), '2|Fixed placeholder one, reworded.|2');
CREATE TEMP TABLE jps_set3 ON COMMIT DROP AS SELECT public.job_paper_set_settings(jps.row_of(jps.id('e1'), jps.id('c1')), '{"photos":"standard","term":"long","enforce":"yes"}'::jsonb, '{"party":"Ridgeway Sample Group"}'::jsonb) AS r;
SELECT jps.same('a typed blank alone, after a signature, makes the next row', (SELECT (r ->> 'state') || '|' || (r ->> 'change') || '|' || (r ->> 'revision') || '|' || (r ->> 'sign_again') FROM jps_set3), 'revised|same|3|1');
SELECT jps.same('and the row notes the Book revision it was set against', (SELECT r.book_revision::text FROM public.job_required_papers r WHERE r.id = jps.row_of(jps.id('e1'), jps.id('c1'))), '2');
RESET ROLE;

-- 10 · The read-revision rule, on a job that is not a ZZ Test job: only the revision an attorney read.
SELECT jps.as_user(jps.id('a3'));
SET LOCAL ROLE authenticated;
SELECT jps.same('the controller marks the revision as read', (SELECT r ->> 'state' FROM public.mark_paper_read(jps.id('c1'), 'Avery Stone', current_date) AS r), 'read');
RESET ROLE;
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.same('now the other job takes the paper', public.job_papers_require(jps.id('e2'), ARRAY[jps.id('c1')], jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"strict","term":"short","enforce":"no"}}'::jsonb))::text, '1');
SELECT jps.same('and Dana starts her copy of it', (public.job_paper_start(jps.row_of(jps.id('e2'), jps.id('c1'))) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jps.as_user(jps.id('a3'));
SET LOCAL ROLE authenticated;
SELECT jps.same('the controller edits a clause again, so the paper is unread again', (SELECT r ->> 'state' || ' r' || (r ->> 'revision') FROM public.edit_clause(jps.id('c1'), 'edit', jps.id('d6'), 'Photo placeholder B, reworded.', '', ARRAY['all'], '', 'photos', '{"photos":"strict"}'::jsonb) AS r), 'published r3');
RESET ROLE;
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('the other job''s paper is not read until an attorney has read the new revision', format($q$SELECT public.job_paper_clauses(%L)$q$, jps.row_of(jps.id('e2'), jps.id('c1'))), 'Settings bed paper (test) has not been read by an attorney as it reads today.');
SELECT jps.refused('nor are its settings changed', format($q$SELECT public.job_paper_set_settings(%L, '{"photos":"strict","term":"long","enforce":"no"}'::jsonb)$q$, jps.row_of(jps.id('e2'), jps.id('c1'))), 'Settings bed paper (test) has not been read by an attorney as it reads today.');
SELECT jps.same('the ZZ Test job''s paper still reads', (SELECT p ->> 'revision' FROM public.job_paper_clauses(jps.row_of(jps.id('e1'), jps.id('c1'))) AS p), '3');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.refused('and nobody signs the other job''s paper meanwhile', format($q$UPDATE public.person_contract_documents SET status = 'signed', paper_revision = 3, clause_versions = '{"lang":"en"}'::jsonb WHERE id = %L$q$, jps.copy_of(jps.row_of(jps.id('e2'), jps.id('c1')), jps.id('b2'))), 'Settings bed paper (test) has not been read by an attorney as it reads today.');
SELECT jps.as_user(jps.id('a3'));
SET LOCAL ROLE authenticated;
SELECT jps.same('the controller marks the new revision as read', (SELECT r ->> 'state' FROM public.mark_paper_read(jps.id('c1'), 'Avery Stone', current_date) AS r), 'read');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.sign(jps.copy_of(jps.row_of(jps.id('e2'), jps.id('c1')), jps.id('b2')), public.job_paper_clauses_now(jps.row_of(jps.id('e2'), jps.id('c1')), 'en'));
SELECT jps.same('and Dana signs it', (SELECT d.status || '|' || d.paper_revision || '|' || (d.clause_versions -> 'clauses' -> 1 ->> 'text') FROM public.person_contract_documents d WHERE d.id = jps.copy_of(jps.row_of(jps.id('e2'), jps.id('c1')), jps.id('b2'))), 'signed|3|Photo placeholder B, reworded.');

-- 11 · Taking the paper off and requiring it again. The same settings at the same Book revision bring the row back
-- with its signatures. A Book that has moved on, or other settings, make a new row, and that is the way to a looser
-- paper.
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE jps_off ON COMMIT DROP AS SELECT jps.row_of(jps.id('e2'), jps.id('c1')) AS id;
GRANT SELECT ON jps_off TO authenticated, anon, service_role;
SELECT public.job_paper_remove((SELECT id FROM jps_off));
SELECT jps.same('the Book has moved on since that row was set, so the same settings are a paper added',
  public.job_papers_require(jps.id('e2'), ARRAY[jps.id('c1')], jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"strict","term":"short","enforce":"no"}}'::jsonb))::text, '1');
SELECT jps.same('it is a new row at the Book''s revision of today, which nobody has signed',
  (SELECT (r.id <> (SELECT id FROM jps_off))::text || '|' || r.book_revision || '|' || r.settings_revision || '|' || (SELECT count(*) FROM public.person_contract_documents d WHERE d.job_required_paper_id = r.id)
   FROM public.job_required_papers r WHERE r.id = jps.row_of(jps.id('e2'), jps.id('c1'))), 'true|3|1|0');
CREATE TEMP TABLE jps_back ON COMMIT DROP AS SELECT jps.row_of(jps.id('e2'), jps.id('c1')) AS id;
GRANT SELECT ON jps_back TO authenticated, anon, service_role;
SELECT jps.same('Dana starts her copy of it', (public.job_paper_start((SELECT id FROM jps_back)) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.sign(jps.copy_of((SELECT id FROM jps_back), jps.id('b2')), public.job_paper_clauses_now((SELECT id FROM jps_back), 'en'));
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove((SELECT id FROM jps_back));
SELECT jps.same('at the same revision the same settings are a paper added',
  public.job_papers_require(jps.id('e2'), ARRAY[jps.id('c1')], jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"strict","term":"short","enforce":"no"}}'::jsonb))::text, '1');
SELECT jps.same('it is the row that was taken off, back with her signature',
  (jps.row_of(jps.id('e2'), jps.id('c1')) = (SELECT id FROM jps_back))::text
  || '|' || (SELECT count(*) FROM public.person_contract_documents d WHERE d.job_required_paper_id = (SELECT id FROM jps_back) AND d.status = 'signed'), 'true|1');
SELECT public.job_paper_remove((SELECT id FROM jps_back));
SELECT jps.same('looser settings are a paper added',
  public.job_papers_require(jps.id('e2'), ARRAY[jps.id('c1')], jsonb_build_object(jps.id('c1')::text, '{"settings":{"photos":"off","term":"short","enforce":"no"}}'::jsonb))::text, '1');
SELECT jps.same('it is a new row, which nobody has signed',
  (jps.row_of(jps.id('e2'), jps.id('c1')) <> (SELECT id FROM jps_back))::text
  || '|' || (SELECT count(*) FROM public.person_contract_documents d WHERE d.job_required_paper_id = jps.row_of(jps.id('e2'), jps.id('c1'))), 'true|0');
RESET ROLE;
SELECT jps.signed_out();

-- 12 · A paper that loses its settings list strands no signature and signs nothing new.
UPDATE public.contract_clauses SET when_opts = NULL, slot = NULL WHERE paper_id = jps.id('c1');
UPDATE public.contract_template_documents SET settings_def = NULL WHERE id = jps.id('c1');
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('a job''s row whose paper lost its list says so', format($q$SELECT public.job_paper_clauses(%L)$q$, jps.row_of(jps.id('e1'), jps.id('c1'))), 'That paper is no longer built from settings in the Contract Book. Take it off the job.');
RESET ROLE;
SELECT jps.signed_out();

-- 13 · What is in place.
-- 12 · The ground under the office's settings page (migration *_settings_page_ground). A settings list may hold a
-- choice's breach lines and site lines, a notice and a site note, and the database stops a shape that is not lines.
-- A paper whose list opens on a notice is required only with its box ticked, once for the paper on the job. The
-- basis marks the page and never the paper.
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.same('a list with lines, a notice and a site note reads', coalesce(public.contract_paper_settings_def_problem((SELECT d FROM jps.notice_def)), 'reads'), 'reads');
SELECT jps.same('breach lines that are not a list do not', public.contract_paper_settings_def_problem(jsonb_set((SELECT d FROM jps.notice_def), '{settings,0,choices,1,breach}', '"one line"')),
  'A choice''s breach lines and site lines are lists of plain lines: twenty at most, each with words and 400 characters at most.');
SELECT jps.same('nor a site line with no words', public.contract_paper_settings_def_problem(jsonb_set((SELECT d FROM jps.notice_def), '{settings,0,choices,1,site}', '["  "]')),
  'A choice''s breach lines and site lines are lists of plain lines: twenty at most, each with words and 400 characters at most.');
SELECT jps.same('nor a notice whose lines are a sentence', public.contract_paper_settings_def_problem(jsonb_set((SELECT d FROM jps.notice_def), '{notice,lines}', '"Not legal advice."')),
  'The notice and the site note are a title, twelve plain lines at most, and a few plain words.');
SELECT jps.same('nor a site note that is a list', public.contract_paper_settings_def_problem(jsonb_set((SELECT d FROM jps.notice_def), '{siteNote}', '[]')),
  'The notice and the site note are a title, twelve plain lines at most, and a few plain words.');
SELECT jps.same('the first paper''s list, with none of the new keys, reads as before', coalesce(public.contract_paper_settings_def_problem((SELECT j -> 'def' FROM jps.cases)), 'reads'), 'reads');
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('a paper that opens on a notice is not required with its box unticked', format($q$SELECT public.job_papers_require(%L, ARRAY[%L::uuid], %L::jsonb)$q$, jps.id('e1'), jps.id('c3'),
  jsonb_build_object(jps.id('c3')::text, '{"settings":{"photos":"standard"},"basis":"standard"}'::jsonb)), 'Notice bed paper (test) opens on a notice. Tick its box before you require it.');
SELECT jps.same('ticked, Dana requires it with its basis', public.job_papers_require(jps.id('e1'), ARRAY[jps.id('c3')],
  jsonb_build_object(jps.id('c3')::text, '{"settings":{"photos":"standard"},"basis":"standard","notice_read":true}'::jsonb))::text, '1');
SELECT jps.refused('a level that is not on the list is no basis', format($q$SELECT public.job_paper_set_basis(%L, 'fortress')$q$, jps.row_of(jps.id('e1'), jps.id('c3'))), 'That level is not on this paper''s list.');
SELECT jps.refused('a plain paper has no basis to set', format($q$SELECT public.job_paper_set_basis(%L, 'standard')$q$, jps.row_of(jps.id('e2'), jps.id('c2'))), 'That paper is not built from settings. It has none to set.');
RESET ROLE;
SELECT jps.same('the row keeps the basis, and who ticked the box and when',
  (SELECT r.basis || '|' || (r.notice_read_by = jps.id('a2'))::text || '|' || (r.notice_read_at IS NOT NULL)::text FROM public.job_required_papers r WHERE r.id = jps.row_of(jps.id('e1'), jps.id('c3'))), 'standard|true|true');
SELECT jps.same('the first paper, whose list has no notice, was required with no tick and kept none',
  (SELECT bool_and(r.notice_read_by IS NULL AND r.notice_read_at IS NULL AND r.basis IS NULL)::text FROM public.job_required_papers r WHERE r.job_id = jps.id('e1') AND r.book_document_id = jps.id('c1')), 'true');
SELECT jps.as_user(jps.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jps.refused('a helper moves no basis', format($q$SELECT public.job_paper_set_basis(%L, 'elevated')$q$, jps.row_of(jps.id('e1'), jps.id('c3'))), 'Only the office sets the papers a job requires.');
SELECT jps.same('Hector starts his copy of it', (public.job_paper_start(jps.row_of(jps.id('e1'), jps.id('c3'))) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jps.signed_out();
SELECT jps.sign(jps.copy_of(jps.row_of(jps.id('e1'), jps.id('c3')), jps.id('b4')), public.job_paper_clauses_now(jps.row_of(jps.id('e1'), jps.id('c3')), 'en'));
CREATE TEMP TABLE jps_noticed ON COMMIT DROP AS SELECT jps.row_of(jps.id('e1'), jps.id('c3')) AS id;
GRANT SELECT ON jps_noticed TO authenticated, anon, service_role;
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.same('with a signature in, the basis still moves in place', public.job_paper_set_basis((SELECT id FROM jps_noticed), 'elevated') || '|' || (jps.row_of(jps.id('e1'), jps.id('c3')) = (SELECT id FROM jps_noticed))::text, 'elevated|true');
SELECT jps.same('a looser change then makes the next row, with no second tick asked', (SELECT (r ->> 'state') || '|' || (r ->> 'change') || '|' || (r ->> 'revision') || '|' || (r ->> 'sign_again') FROM public.job_paper_set_settings((SELECT id FROM jps_noticed), '{"photos":"off"}'::jsonb) AS r), 'revised|looser|2|1');
RESET ROLE;
SELECT jps.same('the new row keeps the basis and the first tick',
  (SELECT n.basis || '|' || (n.notice_read_by = jps.id('a2'))::text || '|' || (n.notice_read_at = o.notice_read_at)::text || '|' || (n.revision_of = o.id)::text || '|' || n.settings::text
   FROM public.job_required_papers n JOIN public.job_required_papers o ON o.id = (SELECT id FROM jps_noticed) WHERE n.id = jps.row_of(jps.id('e1'), jps.id('c3'))), 'elevated|true|true|true|{"photos": "off"}');
SELECT jps.as_user(jps.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jps.same('an empty basis clears it', coalesce(public.job_paper_set_basis(jps.row_of(jps.id('e1'), jps.id('c3')), ''), 'none'), 'none');
RESET ROLE;
SELECT jps.signed_out();

SELECT jps.same('the lock is on the gate''s table, and the bare refusal still on the copies', (
  SELECT string_agg(c.relname || ':' || t.tgname, ' ' ORDER BY c.relname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgname IN ('job_paper_settings_locked', 'contract_copy_refuses_bare_settings')),
  'job_required_papers:job_paper_settings_locked person_contract_documents:contract_copy_refuses_bare_settings');
SELECT jps.same('one job_papers_require, with three names', (
  SELECT string_agg(p.proname || '/' || p.pronargs, ' ' ORDER BY p.proname) FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('job_papers_require', 'job_paper_set_settings', 'job_paper_clauses', 'job_paper_set_basis')),
  'job_paper_clauses/2 job_paper_set_basis/2 job_paper_set_settings/3 job_papers_require/3');
SELECT jps.same('who may call what', (
  SELECT string_agg(p.proname || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '/' || has_function_privilege('anon', p.oid, 'EXECUTE'), ' ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('job_papers_require', 'job_paper_set_settings', 'job_paper_clauses', 'job_paper_clauses_now', 'job_paper_settings_check', 'job_paper_read_problem',
    'job_paper_picks_clean', 'job_paper_typed_clean', 'job_is_zz_test', 'contract_paper_picks_change', 'contract_paper_said', 'contract_paper_seal', 'job_paper_settings_locked', 'contract_copy_refuses_bare_settings',
    'job_paper_set_basis', 'job_paper_basis_clean', 'contract_paper_lines_bad', 'contract_paper_note_bad', 'contract_paper_has_notice', 'contract_paper_settings_def_problem')),
  'contract_copy_refuses_bare_settings:false/false contract_paper_has_notice:false/false contract_paper_lines_bad:false/false contract_paper_note_bad:false/false contract_paper_picks_change:false/false contract_paper_said:false/false contract_paper_seal:false/false contract_paper_settings_def_problem:false/false job_is_zz_test:false/false job_paper_basis_clean:false/false job_paper_clauses:true/false job_paper_clauses_now:false/false job_paper_picks_clean:false/false job_paper_read_problem:false/false job_paper_set_basis:true/false job_paper_set_settings:true/false job_paper_settings_check:false/false job_paper_settings_locked:false/false job_paper_typed_clean:false/false job_papers_require:true/false');

DO $$ BEGIN RAISE NOTICE 'job_paper_settings PASSED'; END $$;
ROLLBACK;
