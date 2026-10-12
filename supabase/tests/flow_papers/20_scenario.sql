-- Flow papers (Messages, cut 4, the New paper window, migration *_flow_papers): a paper the flow editor adds is a
-- Contract library document in its audience's Flow papers packet. The office adds one (a controller and an estimator too,
-- whom the library's own insert policy leaves out); nobody outside the office, signed out, in training mode or a digital
-- twin does; each kind keeps only what it has (an upload its days, a notice its words); a contract's clauses wait for a
-- controller through cluster 9's edit_clause; the packets are seeded once; the columns hold their checks. The fixture is
-- made as postgres; presses run as each user; everything rolls back. Raises on the first failed assertion; ends with
-- "flow_papers PASSED". See scripts/pgtest-flow-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000f0a1', 'rosa@flowpapers.test'),
  ('00000000-0000-0000-0000-00000000f0a2', 'maria@flowpapers.test'),
  ('00000000-0000-0000-0000-00000000f0a3', 'ed@flowpapers.test'),
  ('00000000-0000-0000-0000-00000000f0a4', 'wendi@flowpapers.test'),
  ('00000000-0000-0000-0000-00000000f0a5', 'tess@flowpapers.test'),
  ('00000000-0000-0000-0000-00000000f0a6', 'twin@flowpapers.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000f0a1', 'rosa@flowpapers.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000000f0a2', 'maria@flowpapers.test', 'Maria', 'controller', false, false),
  ('00000000-0000-0000-0000-00000000f0a3', 'ed@flowpapers.test', 'Ed', 'estimator', false, false),
  ('00000000-0000-0000-0000-00000000f0a4', 'wendi@flowpapers.test', 'Wendi', 'superintendent', false, false),
  ('00000000-0000-0000-0000-00000000f0a5', 'tess@flowpapers.test', 'Tess', 'estimator', true, false),
  ('00000000-0000-0000-0000-00000000f0a6', 'twin@flowpapers.test', 'Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA fpb;
CREATE FUNCTION fpb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION fpb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION fpb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A paper as it was written: its packet, audience, kind, names, days, words and tags. Read as postgres.
CREATE FUNCTION fpb.paper(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT t.name || ' | ' || d.audience || ' | ' || d.flow_kind || ' | ' || d.document_name || ' / ' || coalesce(d.name_es, '-')
    || ' | ' || coalesce(d.renew_ask_days::text, '-') || ' | ' || coalesce(d.book_body_html, '-') || ' / ' || coalesce(d.book_body_es, '-')
    || ' | ' || array_to_string(d.tags, ',') || ' | ' || (d.book_version_date = public.app_today())::text
  FROM public.contract_template_documents d JOIN public.contract_templates t ON t.id = d.template_id WHERE d.id = p_id
$$;
GRANT USAGE ON SCHEMA fpb TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA fpb TO anon, authenticated;
CREATE TEMP TABLE made (label text PRIMARY KEY, id uuid);
GRANT ALL ON made TO authenticated;

-- 0 · The packets are there once each, after the migration ran twice.
SELECT fpb.same('one Flow papers packet each', (SELECT string_agg(name || ':' || n, ', ' ORDER BY name) FROM (SELECT name, count(*) AS n FROM public.contract_templates WHERE name LIKE 'Flow papers%' GROUP BY name) x),
  'Flow papers · customers:1, Flow papers · trade partners:1');

-- 1 · Nobody outside the office adds a paper.
SET LOCAL ROLE anon;
SELECT fpb.refused('no sign-in adds no paper', $q$SELECT public.flow_paper_create('trade', 'upload', 'their bond')$q$, 'permission denied for function flow_paper_create');
RESET ROLE;
SELECT fpb.as_user('00000000-0000-0000-0000-00000000f0a4');
SET LOCAL ROLE authenticated;
SELECT fpb.refused('the superintendent adds no paper', $q$SELECT public.flow_paper_create('trade', 'upload', 'their bond')$q$, 'Only the office adds a paper.');
RESET ROLE;
SELECT fpb.as_user('00000000-0000-0000-0000-00000000f0a5');
SET LOCAL ROLE authenticated;
SELECT fpb.refused('training mode adds no paper', $q$SELECT public.flow_paper_create('trade', 'upload', 'their bond')$q$, 'Training mode cannot add a paper.');
RESET ROLE;
SELECT fpb.as_user('00000000-0000-0000-0000-00000000f0a6');
SET LOCAL ROLE authenticated;
SELECT fpb.refused('a digital twin adds no paper', $q$SELECT public.flow_paper_create('trade', 'upload', 'their bond')$q$, 'A digital twin cannot add a paper.');
RESET ROLE;

-- 2 · Maria the controller adds an upload to the trade partner flow: their bond, which runs out, asked for 45 days ahead.
SELECT fpb.as_user('00000000-0000-0000-0000-00000000f0a2');
SET LOCAL ROLE authenticated;
INSERT INTO made SELECT 'bond', public.flow_paper_create('trade', 'upload', ' their bond ', ' su fianza ', 45);
RESET ROLE;
SELECT fpb.same('the bond is a trade partners'' upload with its days', fpb.paper((SELECT id FROM made WHERE label = 'bond')),
  'Flow papers · trade partners | sub | upload | their bond / su fianza | 45 | - / - | flow-paper | true');

-- 3 · Ed the estimator adds a notice to the customer flow, in both languages.
SELECT fpb.as_user('00000000-0000-0000-0000-00000000f0a3');
SET LOCAL ROLE authenticated;
INSERT INTO made SELECT 'start', public.flow_paper_create('customer', 'notice', 'the start letter', 'la carta de inicio', NULL, 'Dear {person}, we start on {start}.', 'Estimado {person}, empezamos el {start}.');
RESET ROLE;
SELECT fpb.same('the start letter is a customers'' notice with its words', fpb.paper((SELECT id FROM made WHERE label = 'start')),
  'Flow papers · customers | customer | notice | the start letter / la carta de inicio | - | Dear {person}, we start on {start}. / Estimado {person}, empezamos el {start}. | flow-paper | true');

-- 4 · Rosa adds a contract to the architect flow; its first clause waits for a controller, through cluster 9's edit_clause.
SELECT fpb.as_user('00000000-0000-0000-0000-00000000f0a1');
SET LOCAL ROLE authenticated;
INSERT INTO made SELECT 'certify', public.flow_paper_create('arch', 'contract', 'the certification agreement', '', NULL, 'not kept for a contract', 'nor this');
SELECT fpb.same('Rosa''s first clause waits for approval', (SELECT public.edit_clause((SELECT id FROM made WHERE label = 'certify'), 'new', NULL, 'The architect certifies each pay application within seven days.')->>'state'), 'proposed');
RESET ROLE;
SELECT fpb.same('the agreement is a customers'' contract with no words of its own', fpb.paper((SELECT id FROM made WHERE label = 'certify')),
  'Flow papers · customers | customer | contract | the certification agreement / - | - | - / - | flow-paper | true');
SELECT fpb.same('each new paper comes after the last in its packet', (
  SELECT string_agg(document_name, ', ' ORDER BY sequence_order) FROM public.contract_template_documents d JOIN public.contract_templates t ON t.id = d.template_id WHERE t.name = 'Flow papers · customers'),
  'the start letter, the certification agreement');

-- 5 · What a paper must say.
SELECT fpb.as_user('00000000-0000-0000-0000-00000000f0a1');
SET LOCAL ROLE authenticated;
SELECT fpb.refused('a paper needs a name', $q$SELECT public.flow_paper_create('trade', 'upload', '   ')$q$, 'Give it a name.');
SELECT fpb.refused('a kind it knows', $q$SELECT public.flow_paper_create('trade', 'memo', 'a memo')$q$, 'That is not a kind of paper.');
SELECT fpb.refused('a flow it knows', $q$SELECT public.flow_paper_create('vendor', 'upload', 'a form')$q$, 'That is not one of the flows.');
SELECT fpb.refused('a notice needs its words', $q$SELECT public.flow_paper_create('customer', 'notice', 'the holiday notice')$q$, 'Write the notice.');
SELECT fpb.refused('only an upload runs out', $q$SELECT public.flow_paper_create('trade', 'contract', 'the safety agreement', '', 30)$q$, 'Only a paper they give us runs out');
SELECT fpb.refused('within a year', $q$SELECT public.flow_paper_create('trade', 'upload', 'their license', '', 400)$q$, 'Only a paper they give us runs out');
RESET ROLE;

-- 6 · The columns hold their checks, whoever writes them.
SELECT fpb.refused('a library document is only a flow paper of a known kind', $q$UPDATE public.contract_template_documents SET flow_kind = 'memo' WHERE id = (SELECT id FROM made WHERE label = 'bond')$q$, 'contract_template_documents_flow_kind_known');
SELECT fpb.refused('its days are within a year', $q$UPDATE public.contract_template_documents SET renew_ask_days = 0 WHERE id = (SELECT id FROM made WHERE label = 'bond')$q$, 'contract_template_documents_renew_ask_days_sane');

DO $$ BEGIN RAISE NOTICE 'flow_papers PASSED'; END $$;
ROLLBACK;
