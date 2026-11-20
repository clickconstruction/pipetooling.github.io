-- The Contract Book takes settings (punch list #389 step 1, migration *_paper_settings). A paper may carry a settings
-- list; a clause is tied to one choice of one setting and may be one wording of a place; the paper for a job is put
-- together from the job's picks. One set of cases runs through the database here and through the kernel in
-- src/lib/contracts/paperSettings.cases.test.ts, which reads the JSON of pst.cases out of this file, so
-- the preview and the sign page cannot drift. Then: who sets a list and marks a read, what a clause's Only when may
-- name, what nobody signed in writes by hand, and that a copy of such a paper is never made bare. Every word is a
-- made-up placeholder: no clause wording is here. Presses run as each user; the fixture is made as postgres;
-- everything rolls back. Raises on the first failed assertion; ends with "paper_settings PASSED". See
-- scripts/pgtest-paper-settings.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000389a1', 'dev@settings.test'),
  ('00000000-0000-0000-0000-0000000389a2', 'office@settings.test'),
  ('00000000-0000-0000-0000-0000000389a3', 'controller@settings.test'),
  ('00000000-0000-0000-0000-0000000389a4', 'super@settings.test'),
  ('00000000-0000-0000-0000-0000000389a6', 'training@settings.test'),
  ('00000000-0000-0000-0000-0000000389a7', 'twin@settings.test'),
  ('00000000-0000-0000-0000-0000000389a8', 'left@settings.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000000389a1', 'dev@settings.test', 'Dev Sample', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000000389a2', 'office@settings.test', 'Office Sample', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000000389a3', 'controller@settings.test', 'Controller Sample', 'controller', false, false, NULL),
  ('00000000-0000-0000-0000-0000000389a4', 'super@settings.test', 'Super Sample', 'superintendent', false, false, NULL),
  ('00000000-0000-0000-0000-0000000389a6', 'training@settings.test', 'Training Sample', 'controller', true, false, NULL),
  ('00000000-0000-0000-0000-0000000389a7', 'twin@settings.test', 'Twin Sample', 'controller', false, true, NULL),
  ('00000000-0000-0000-0000-0000000389a8', 'left@settings.test', 'Left Sample', 'dev', false, false, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

CREATE SCHEMA pst;
CREATE FUNCTION pst.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pst.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION pst.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION pst.paper(p_col text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v text;
BEGIN
  EXECUTE format('SELECT %I::text FROM public.contract_template_documents WHERE id = %L', p_col, '00000000-0000-0000-0000-0000000389c1') INTO v;
  RETURN v;
END $$;

GRANT USAGE ON SCHEMA pst TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pst TO anon, authenticated;

-- The cases. `def` is the settings list, `clauses` the paper's clauses, and each case names the clauses it uses, the
-- picks, the typed blanks, the trades and the language, with what the paper must read or the words that stop it.
CREATE TABLE pst.cases AS SELECT $cases$
{
  "def": {
    "settings": [
      { "key": "photos", "label": "Photos and video", "choices": [
        { "key": "off", "label": "Off", "says": "Nothing is asked about photos.", "out": true },
        { "key": "standard", "label": "Standard", "says": "Placeholder line for the standard choice." },
        { "key": "strict", "label": "Strict", "says": "Placeholder line for the strict choice." } ] },
      { "key": "term", "label": "How long secrecy lasts", "choices": [
        { "key": "short", "label": "Short", "says": "Placeholder line for a short term.", "fills": { "term_words": "one year" }, "fillsEs": { "term_words": "un año" } },
        { "key": "long", "label": "Long", "says": "Placeholder line for a long term.", "fills": { "term_words": "three years" }, "fillsEs": { "term_words": "tres años" } } ] },
      { "key": "enforce", "label": "Direct enforcement", "choices": [
        { "key": "no", "label": "No", "says": "Placeholder line for no." },
        { "key": "yes", "label": "Yes", "says": "Placeholder line for yes." } ] }
    ],
    "fields": [ { "key": "term_words", "label": "How long" }, { "key": "other", "label": "Other rules" } ],
    "levels": [ { "key": "standard", "label": "Standard", "alignedWith": "Aligned with regular businesses", "picks": { "photos": "standard", "term": "short", "enforce": "no" } } ]
  },
  "clauses": [
    { "id": "d1", "order": 1, "en": "Fixed placeholder one.", "es": "", "scope": ["all"], "slot": null, "when": null },
    { "id": "d2", "order": 2, "en": "Photo placeholder A.", "es": "", "scope": ["all"], "slot": "photos", "when": { "photos": "standard" } },
    { "id": "d3", "order": 3, "en": "Secrecy lasts {term_words}.", "es": "El secreto dura {term_words}.", "scope": ["all"], "slot": null, "when": null },
    { "id": "d4", "order": 4, "en": "Enforce placeholder A.", "es": "", "scope": ["all"], "slot": "enforce", "when": { "enforce": "yes" } },
    { "id": "d5", "order": 5, "en": "Enforce placeholder B.", "es": "", "scope": ["all"], "slot": "enforce", "when": { "enforce": "no" } },
    { "id": "d6", "order": 6, "en": "Photo placeholder B.", "es": "", "scope": ["all"], "slot": "photos", "when": { "photos": "strict" } },
    { "id": "d7", "order": 7, "en": "Sitework placeholder.", "es": "", "scope": ["Sitework"], "slot": null, "when": { "photos": "strict" } },
    { "id": "d8", "order": 8, "en": "Other rules: {other}", "es": "", "scope": ["all"], "slot": null, "when": null },
    { "id": "d9", "order": 9, "en": "Photo placeholder C.", "es": "", "scope": ["all"], "slot": "photos", "when": { "photos": "strict" } }
  ],
  "cases": [
    { "name": "the standard mix", "use": ["d1","d2","d3","d4","d5","d6","d7"], "picks": { "photos": "standard", "term": "short", "enforce": "no" }, "fields": null, "trades": ["Sitework"], "lang": "en",
      "problem": null, "lines": ["1 Fixed placeholder one.", "2 Photo placeholder A.", "3 Secrecy lasts one year.", "4 Enforce placeholder B."], "exhibitFor": [] },
    { "name": "the strict mix in Spanish, with the trade's own clause", "use": ["d1","d2","d3","d4","d5","d6","d7"], "picks": { "photos": "strict", "term": "long", "enforce": "yes" }, "fields": null, "trades": [" sitework ", "Paving"], "lang": "es",
      "problem": null, "lines": ["1 Fixed placeholder one.", "2 Photo placeholder B.", "3 El secreto dura tres años.", "4 Enforce placeholder A.", "5 Sitework placeholder."], "exhibitFor": ["sitework"] },
    { "name": "a topic left out", "use": ["d1","d2","d3","d4","d5","d6","d7"], "picks": { "photos": "off", "term": "short", "enforce": "no" }, "fields": null, "trades": [], "lang": "en",
      "problem": null, "lines": ["1 Fixed placeholder one.", "2 Secrecy lasts one year.", "3 Enforce placeholder B."], "exhibitFor": [] },
    { "name": "a typed blank", "use": ["d1","d2","d3","d4","d5","d6","d8"], "picks": { "photos": "standard", "term": "short", "enforce": "no" }, "fields": { "other": " No drones. " }, "trades": [], "lang": "en",
      "problem": null, "lines": ["1 Fixed placeholder one.", "2 Photo placeholder A.", "3 Secrecy lasts one year.", "4 Enforce placeholder B.", "5 Other rules: No drones."], "exhibitFor": [] },
    { "name": "what was typed for the job wins over what a choice fills", "use": ["d1","d3"], "picks": { "photos": "off", "term": "short", "enforce": "no" }, "fields": { "term_words": "ten years", "not_on_the_list": "x" }, "trades": [], "lang": "en",
      "problem": null, "lines": ["1 Fixed placeholder one.", "2 Secrecy lasts ten years."], "exhibitFor": [] },
    { "name": "no settings at all", "use": ["d1","d2","d3","d4","d5","d6"], "picks": null, "fields": null, "trades": [], "lang": "en",
      "problem": "This paper is built from settings. It goes with its settings.", "lines": [], "exhibitFor": [] },
    { "name": "a setting unpicked", "use": ["d1","d2","d3","d4","d5","d6"], "picks": { "photos": "standard", "term": "short" }, "fields": null, "trades": [], "lang": "en",
      "problem": "Pick Direct enforcement.", "lines": [], "exhibitFor": [] },
    { "name": "a pick that is not a choice", "use": ["d1","d2","d3","d4","d5","d6"], "picks": { "photos": "nope", "term": "short", "enforce": "no" }, "fields": null, "trades": [], "lang": "en",
      "problem": "Pick Photos and video.", "lines": [], "exhibitFor": [] },
    { "name": "a place with no wording for the pick", "use": ["d1","d2","d3","d4","d5"], "picks": { "photos": "strict", "term": "short", "enforce": "no" }, "fields": null, "trades": [], "lang": "en",
      "problem": "Photos and video has no wording for Strict.", "lines": [], "exhibitFor": [] },
    { "name": "a place with two wordings for the pick", "use": ["d1","d2","d3","d4","d5","d6","d9"], "picks": { "photos": "strict", "term": "short", "enforce": "no" }, "fields": null, "trades": [], "lang": "en",
      "problem": "Photos and video has two wordings for Strict.", "lines": [], "exhibitFor": [] },
    { "name": "the first place that stops it is the one named", "use": ["d1","d2","d3","d4"], "picks": { "photos": "strict", "term": "short", "enforce": "no" }, "fields": null, "trades": [], "lang": "en",
      "problem": "Photos and video has no wording for Strict.", "lines": [], "exhibitFor": [] },
    { "name": "a blank with no value", "use": ["d1","d2","d3","d4","d5","d6","d8"], "picks": { "photos": "standard", "term": "short", "enforce": "no" }, "fields": { "other": "  " }, "trades": [], "lang": "en",
      "problem": "Clause 5 has a blank with no value: Other rules.", "lines": [], "exhibitFor": [] }
  ]
}
$cases$::jsonb AS j;

-- The paper, with its list and its clauses, made as postgres.
INSERT INTO public.contract_templates (id, name) VALUES ('00000000-0000-0000-0000-0000000389b1', 'Settings bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, revision, published_at, settings_def) VALUES
  ('00000000-0000-0000-0000-0000000389c1', '00000000-0000-0000-0000-0000000389b1', 'Settings bed paper (test)', 1, now(), (SELECT j -> 'def' FROM pst.cases)),
  ('00000000-0000-0000-0000-0000000389c2', '00000000-0000-0000-0000-0000000389b1', 'Ordinary bed paper (test)', 1, now(), NULL);
INSERT INTO public.contract_clauses (id, paper_id, sequence_order, text_en, text_es, scope, slot, when_opts)
SELECT ('00000000-0000-0000-0000-0000000389' || (c ->> 'id'))::uuid, '00000000-0000-0000-0000-0000000389c1', (c ->> 'order')::integer, c ->> 'en', c ->> 'es',
       ARRAY(SELECT jsonb_array_elements_text(c -> 'scope')), c ->> 'slot', nullif(c -> 'when', 'null'::jsonb)
FROM pst.cases, jsonb_array_elements(j -> 'clauses') AS c;
INSERT INTO public.contract_clauses (id, paper_id, sequence_order, text_en) VALUES
  ('00000000-0000-0000-0000-0000000389e1', '00000000-0000-0000-0000-0000000389c2', 1, 'Ordinary placeholder one.'),
  ('00000000-0000-0000-0000-0000000389e2', '00000000-0000-0000-0000-0000000389c2', 2, 'Ordinary placeholder {other}.');

-- 1 · The cases, through the database's assembly.
DO $$
DECLARE
  k jsonb;
  v_got jsonb;
  v_problem text;
  v_lines text;
BEGIN
  FOR k IN SELECT c FROM pst.cases, jsonb_array_elements(j -> 'cases') AS c LOOP
    UPDATE public.contract_clauses SET retired_at = CASE WHEN right(id::text, 2) IN (SELECT jsonb_array_elements_text(k -> 'use')) THEN NULL ELSE now() END
      WHERE paper_id = '00000000-0000-0000-0000-0000000389c1';
    v_problem := NULL;
    v_got := NULL;
    BEGIN
      v_got := public.contract_paper_clauses('00000000-0000-0000-0000-0000000389c1', ARRAY(SELECT jsonb_array_elements_text(k -> 'trades')), k ->> 'lang',
        nullif(k -> 'picks', 'null'::jsonb), nullif(k -> 'fields', 'null'::jsonb));
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      v_problem := SQLERRM;
    END;
    PERFORM pst.same('case, ' || (k ->> 'name') || ': what stops it', coalesce(v_problem, '(goes)'), coalesce(k ->> 'problem', '(goes)'));
    IF v_problem IS NULL THEN
      SELECT coalesce(string_agg((x ->> 'n') || ' ' || (x ->> 'text'), ' | ' ORDER BY (x ->> 'n')::integer), '') INTO v_lines
      FROM jsonb_array_elements((v_got -> 'clauses') || (v_got -> 'exhibit')) AS x;
      PERFORM pst.same('case, ' || (k ->> 'name') || ': the paper', v_lines, (SELECT coalesce(string_agg(l, ' | ' ORDER BY at), '') FROM jsonb_array_elements_text(k -> 'lines') WITH ORDINALITY AS t(l, at)));
      PERFORM pst.same('case, ' || (k ->> 'name') || ': the exhibit is for', (v_got -> 'exhibitFor')::text, (k -> 'exhibitFor')::text);
    END IF;
  END LOOP;
  UPDATE public.contract_clauses SET retired_at = CASE WHEN right(id::text, 2) IN ('d8', 'd9') THEN now() ELSE NULL END WHERE paper_id = '00000000-0000-0000-0000-0000000389c1';
END $$;

-- 2 · An ordinary paper reads as before: no settings asked for, nothing filled, the old three names still call it.
SELECT pst.same('an ordinary paper is as it was', (
  SELECT string_agg((x ->> 'n') || ' ' || (x ->> 'text'), ' | ' ORDER BY (x ->> 'n')::integer)
  FROM jsonb_array_elements(public.contract_paper_clauses('00000000-0000-0000-0000-0000000389c2', ARRAY[]::text[], 'en') -> 'clauses') AS x),
  '1 Ordinary placeholder one. | 2 Ordinary placeholder {other}.');
SELECT pst.same('and carries no settings', (public.contract_paper_clauses('00000000-0000-0000-0000-0000000389c2', ARRAY[]::text[]) ? 'settings')::text, 'false');
SELECT pst.same('a paper built from settings keeps the picks and the blanks it went with', (
  SELECT (p -> 'settings' ->> 'term') || ' ' || (p -> 'fields' ->> 'term_words')
  FROM public.contract_paper_clauses('00000000-0000-0000-0000-0000000389c1', ARRAY[]::text[], 'en', '{"photos":"off","term":"long","enforce":"no"}'::jsonb) AS p),
  'long three years');
SELECT pst.same('one assembly, and the old one is gone', (
  SELECT string_agg(p.proname || '/' || p.pronargs, ' ' ORDER BY p.proname) FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('contract_paper_clauses', 'edit_clause')),
  'contract_paper_clauses/5 edit_clause/9');

-- 3 · Nobody signed in reaches the assembly or the helpers, and nobody writes the list, the mark or the revision by hand.
SELECT pst.as_user('00000000-0000-0000-0000-0000000389a1');
SET LOCAL ROLE authenticated;
SELECT pst.refused('a dev does not call the assembly', $q$SELECT public.contract_paper_clauses('00000000-0000-0000-0000-0000000389c1', ARRAY[]::text[])$q$, 'permission denied for function contract_paper_clauses');
SELECT pst.refused('nor the caller check', $q$SELECT public.contract_paper_settings_caller('x')$q$, 'permission denied for function contract_paper_settings_caller');
SELECT pst.refused('a dev does not write the list by hand', $q$UPDATE public.contract_template_documents SET settings_def = NULL WHERE id = '00000000-0000-0000-0000-0000000389c1'$q$, 'are set from Contracts and clauses');
SELECT pst.refused('nor the revision', $q$UPDATE public.contract_template_documents SET revision = 9 WHERE id = '00000000-0000-0000-0000-0000000389c1'$q$, 'are set from Contracts and clauses');
SELECT pst.refused('nor the read mark', $q$UPDATE public.contract_template_documents SET read_revision = 1, read_by_name = 'Avery Stone', read_on = current_date WHERE id = '00000000-0000-0000-0000-0000000389c1'$q$, 'are set from Contracts and clauses');
SELECT pst.refused('nor makes a paper that starts with a list', $q$INSERT INTO public.contract_template_documents (template_id, document_name, settings_def) VALUES ('00000000-0000-0000-0000-0000000389b1', 'Hand made (test)', '{"settings":[]}'::jsonb)$q$, 'A new paper starts with no settings list');
UPDATE public.contract_template_documents SET document_name = 'Settings bed paper (test), renamed' WHERE id = '00000000-0000-0000-0000-0000000389c1';
RESET ROLE;
SELECT pst.same('the rest of the row is still the Book''s to change', pst.paper('document_name'), 'Settings bed paper (test), renamed');

-- 4 · Who sets a settings list: a controller or a dev. Not the office, a twin, training or someone who left.
SELECT pst.as_user('00000000-0000-0000-0000-0000000389a2');
SET LOCAL ROLE authenticated;
SELECT pst.refused('the office sets no list', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":[]}'::jsonb)$q$, 'Only a controller or a dev can set a paper''s settings list.');
SELECT pst.refused('the office marks no read', $q$SELECT public.mark_paper_read('00000000-0000-0000-0000-0000000389c1', 'Avery Stone', current_date)$q$, 'Only a controller or a dev can mark a paper as read.');
RESET ROLE;
SELECT pst.as_user('00000000-0000-0000-0000-0000000389a7');
SET LOCAL ROLE authenticated;
SELECT pst.refused('a twin sets no list', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', NULL)$q$, 'A digital twin cannot set a paper''s settings list.');
RESET ROLE;
SELECT pst.as_user('00000000-0000-0000-0000-0000000389a6');
SET LOCAL ROLE authenticated;
SELECT pst.refused('training sets no list', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', NULL)$q$, 'Training mode is read-only. Nothing was changed.');
SELECT pst.refused('training marks no read', $q$SELECT public.mark_paper_read('00000000-0000-0000-0000-0000000389c1', 'Avery Stone', current_date)$q$, 'Training mode is read-only. Nothing was changed.');
RESET ROLE;
SELECT pst.as_user('00000000-0000-0000-0000-0000000389a8');
SET LOCAL ROLE authenticated;
SELECT pst.refused('someone who left sets no list', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', NULL)$q$, 'This account is archived.');
RESET ROLE;
SELECT pst.refused('signed out, nobody sets a list', $q$SELECT set_config('request.jwt.claim.sub', '', true), public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', NULL)$q$, 'Sign in to set a paper''s settings list.');

SELECT pst.as_user('00000000-0000-0000-0000-0000000389a3');
SET LOCAL ROLE authenticated;
SELECT pst.refused('a list that does not read is refused', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":"x"}'::jsonb)$q$, 'That settings list does not read.');
SELECT pst.refused('an empty list is refused', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":[]}'::jsonb)$q$, 'Add a setting.');
SELECT pst.refused('a setting needs two choices', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":[{"key":"a","label":"A","choices":[{"key":"x","label":"X"}]}]}'::jsonb)$q$, 'Every setting needs a key, a name and two to twelve choices.');
SELECT pst.refused('two settings share no key', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":[{"key":"a","label":"A","choices":[{"key":"x","label":"X"},{"key":"y","label":"Y"}]},{"key":"a","label":"B","choices":[{"key":"x","label":"X"},{"key":"y","label":"Y"}]}]}'::jsonb)$q$, 'Two settings share a key.');
SELECT pst.refused('a blank is not named job', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":[{"key":"a","label":"A","choices":[{"key":"x","label":"X"},{"key":"y","label":"Y"}]}],"fields":[{"key":"job","label":"Job"}]}'::jsonb)$q$, 'Every blank needs a key and a name.');
SELECT pst.refused('a level picks every setting', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":[{"key":"a","label":"A","choices":[{"key":"x","label":"X"},{"key":"y","label":"Y"}]}],"levels":[{"key":"l","label":"L","picks":{}}]}'::jsonb)$q$, 'Every level needs a key, a name and a pick for every setting.');
SELECT pst.same('the controller gives the ordinary paper a list, and its revision moves', (
  SELECT r ->> 'state' || ' r' || (r ->> 'revision')
  FROM public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":[{"key":"a","label":"Topic A","choices":[{"key":"x","label":"X"},{"key":"y","label":"Y"}]}]}'::jsonb) AS r), 'saved r2');
SELECT pst.refused('the same list again is nothing changed', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c2', '{"settings":[{"key":"a","label":"Topic A","choices":[{"key":"x","label":"X"},{"key":"y","label":"Y"}]}]}'::jsonb)$q$, 'Nothing changed.');
SELECT pst.refused('a list that drops a setting a live clause is tied to is refused', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c1', '{"settings":[{"key":"term","label":"How long","choices":[{"key":"short","label":"S"},{"key":"long","label":"L"}]}]}'::jsonb)$q$, 'A live clause is tied to a setting or a choice this list drops.');
SELECT pst.refused('and so is taking the list away from it', $q$SELECT public.set_paper_settings('00000000-0000-0000-0000-0000000389c1', NULL)$q$, 'A live clause is tied to a setting or a choice this list drops.');

-- 5 · A clause's Only when, through edit_clause.
SELECT pst.refused('a choice the setting does not have', $q$SELECT public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'new', NULL, 'Placeholder.', '', ARRAY['all'], '', NULL, '{"photos":"loud"}'::jsonb)$q$, 'Photos and video has no choice loud.');
SELECT pst.refused('a setting the list does not have', $q$SELECT public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'new', NULL, 'Placeholder.', '', ARRAY['all'], '', NULL, '{"badges":"on"}'::jsonb)$q$, 'badges is not on this paper''s settings list.');
SELECT pst.refused('a place with no Only when', $q$SELECT public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'new', NULL, 'Placeholder.', '', ARRAY['all'], '', 'photos', NULL)$q$, 'A wording of a place needs its Only when.');
SELECT pst.refused('a place that does not read', $q$SELECT public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'new', NULL, 'Placeholder.', '', ARRAY['all'], '', 'Not A Key', '{"photos":"off"}'::jsonb)$q$, 'That place does not read. Pick it again.');
SELECT pst.same('the controller ties a new clause to a choice, as a wording of a place', (
  SELECT r ->> 'state' FROM public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'new', NULL, 'Term placeholder long.', '', ARRAY['all'], '', 'term', '{"term":"long"}'::jsonb) AS r), 'published');
SELECT pst.same('the clause keeps its place and its Only when', (
  SELECT slot || ' ' || when_opts::text FROM public.contract_clauses WHERE text_en = 'Term placeholder long.'), 'term {"term": "long"}');
SELECT pst.refused('the same again is nothing changed', $q$SELECT public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'edit', (SELECT id FROM public.contract_clauses WHERE text_en = 'Term placeholder long.'), 'Term placeholder long.', '', ARRAY['all'], '', 'term', '{"term":"long"}'::jsonb)$q$, 'Nothing changed.');
SELECT pst.same('a change to the Only when alone is a change', (
  SELECT r ->> 'state' || ' v' || (r ->> 'version') FROM public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'edit', (SELECT id FROM public.contract_clauses WHERE text_en = 'Term placeholder long.'), 'Term placeholder long.', '', ARRAY['all'], '', 'term', '{"term":"short"}'::jsonb) AS r), 'published v2');
SELECT pst.same('the old seven names still call it, and leave a clause in every paper', (
  SELECT r ->> 'state' FROM public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'new', NULL, 'Fixed placeholder two.', '', ARRAY['all'], 'why') AS r), 'published');
SELECT pst.same('that clause is tied to nothing', (SELECT coalesce(slot, '-') || coalesce(when_opts::text, '-') FROM public.contract_clauses WHERE text_en = 'Fixed placeholder two.'), '--');
RESET ROLE;
SELECT pst.as_user('00000000-0000-0000-0000-0000000389a2');
SET LOCAL ROLE authenticated;
SELECT pst.same('the office proposes a tied clause, and it waits', (
  SELECT r ->> 'state' FROM public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'new', NULL, 'Photo placeholder D.', '', ARRAY['all'], 'asked for', NULL, '{"photos":"off"}'::jsonb) AS r), 'proposed');
SELECT pst.same('the proposal carries the Only when', (SELECT when_opts::text FROM public.contract_clause_proposals WHERE text_en = 'Photo placeholder D.'), '{"photos": "off"}');
RESET ROLE;
SELECT pst.as_user('00000000-0000-0000-0000-0000000389a3');
SET LOCAL ROLE authenticated;
SELECT pst.same('the controller approves it', (SELECT r ->> 'state' FROM public.approve_clause_proposal((SELECT id FROM public.contract_clause_proposals WHERE text_en = 'Photo placeholder D.')) AS r), 'published');
SELECT pst.same('and the clause is tied as proposed', (SELECT when_opts::text FROM public.contract_clauses WHERE text_en = 'Photo placeholder D.'), '{"photos": "off"}');
SELECT pst.refused('an ordinary paper ties nothing', $q$SELECT public.edit_clause('00000000-0000-0000-0000-0000000389c2', 'new', NULL, 'Placeholder.', '', ARRAY['all'], '', NULL, '{"photos":"off"}'::jsonb)$q$, 'photos is not on this paper''s settings list.');

-- 6 · The read mark belongs to a revision.
SELECT pst.refused('a read needs a name', $q$SELECT public.mark_paper_read('00000000-0000-0000-0000-0000000389c1', '  ', current_date)$q$, 'Name the attorney who read it.');
SELECT pst.refused('a read is not on a day to come', $q$SELECT public.mark_paper_read('00000000-0000-0000-0000-0000000389c1', 'Avery Stone', current_date + 5)$q$, 'It cannot be a day to come.');
SELECT pst.same('the controller marks the revision as read', (
  SELECT (r ->> 'state') || ' ' || (r ->> 'by') || ' r' || (r ->> 'revision') FROM public.mark_paper_read('00000000-0000-0000-0000-0000000389c1', '  Avery   Stone ', current_date) AS r),
  'read Avery Stone r' || pst.paper('revision'));
SELECT pst.same('the mark names the revision it was made on', pst.paper('read_revision'), pst.paper('revision'));
SELECT pst.same('a later publish leaves the mark behind, so the paper is unread again', (
  SELECT (r ->> 'state') FROM public.edit_clause('00000000-0000-0000-0000-0000000389c1', 'new', NULL, 'Fixed placeholder three.') AS r)
  || ' ' || (pst.paper('read_revision')::integer < pst.paper('revision')::integer)::text, 'published true');
RESET ROLE;
INSERT INTO public.contract_template_documents (id, template_id, document_name) VALUES ('00000000-0000-0000-0000-0000000389c3', '00000000-0000-0000-0000-0000000389b1', 'Draft bed paper (test)');
SELECT pst.as_user('00000000-0000-0000-0000-0000000389a1');
SET LOCAL ROLE authenticated;
SELECT pst.refused('a draft has no revision to read', $q$SELECT public.mark_paper_read('00000000-0000-0000-0000-0000000389c3', 'Avery Stone', current_date)$q$, 'Publish a clause first.');
RESET ROLE;

-- 7 · A copy of a paper built from settings is never made bare, by anyone. An ordinary paper's copy is as before.
SELECT pst.refused('a copy of a settings paper is refused', $q$INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status, applied_contract_template_document_id) VALUES ('Settings bed Jordan', 'Settings bed paper (test)', gen_random_uuid(), 1, 'unsent', '00000000-0000-0000-0000-0000000389c1')$q$, 'This paper is built from settings. It goes from a job, with its settings.');
INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status, applied_contract_template_document_id)
  VALUES ('Settings bed Jordan', 'Draft bed paper (test)', gen_random_uuid(), 1, 'unsent', '00000000-0000-0000-0000-0000000389c3');
SELECT pst.refused('nor is a copy moved onto one', $q$UPDATE public.person_contract_documents SET applied_contract_template_document_id = '00000000-0000-0000-0000-0000000389c1' WHERE person_name = 'Settings bed Jordan'$q$, 'This paper is built from settings. It goes from a job, with its settings.');
SELECT pst.same('an ordinary paper''s copy is made as before', (SELECT count(*)::text FROM public.person_contract_documents WHERE person_name = 'Settings bed Jordan'), '1');

-- 8 · What is in place.
SELECT pst.same('the guard and the bare refusal are on their tables', (
  SELECT string_agg(c.relname || ':' || t.tgname, ' ' ORDER BY c.relname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgname IN ('contract_paper_settings_guard', 'contract_copy_refuses_bare_settings')),
  'contract_template_documents:contract_paper_settings_guard person_contract_documents:contract_copy_refuses_bare_settings');
SELECT pst.same('who may call what', (
  SELECT string_agg(p.proname || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '/' || has_function_privilege('anon', p.oid, 'EXECUTE'), ' ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('set_paper_settings', 'mark_paper_read', 'edit_clause', 'contract_paper_clauses', 'contract_paper_fields', 'contract_paper_picks_problem', 'contract_clause_when_problem', 'contract_paper_settings_def_problem', 'contract_clause_apply')),
  'contract_clause_apply:false/false contract_clause_when_problem:false/false contract_paper_clauses:false/false contract_paper_fields:false/false contract_paper_picks_problem:false/false contract_paper_settings_def_problem:false/false edit_clause:true/false mark_paper_read:true/false set_paper_settings:true/false');

DO $$ BEGIN RAISE NOTICE 'paper_settings PASSED'; END $$;
ROLLBACK;
