-- Contracts from clauses (Messages, cut 4c, migration *_contract_clauses): Rosa in the office proposes a change, Maria
-- the controller approves it, and the paper's revision and the clause's version each move one up; a proposal the clause
-- has moved on from is refused, so a newer publish is never overwritten; a decline needs a why; a dev's own change
-- publishes at once and is its own history row; nobody outside the office, signed out, in training mode or a digital
-- twin changes a clause, and nobody writes the tables but the RPCs; the paper assembles per trade with one numbering
-- and nothing inherited; and a signed copy keeps its words after a retire and cannot be rewritten. Presses run as each
-- user; the fixture is made as postgres; everything rolls back. Raises on the first failed assertion; ends with
-- "contract_clauses PASSED". See scripts/pgtest-contract-clauses.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The prototype's team: Robert the dev, Rosa the office, Maria the controller, Wendi the superintendent; a leader who
-- edits and does not approve; an estimator in training mode; a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000c1a1', 'robert@clauses.test'),
  ('00000000-0000-0000-0000-00000000c1a2', 'rosa@clauses.test'),
  ('00000000-0000-0000-0000-00000000c1a3', 'maria@clauses.test'),
  ('00000000-0000-0000-0000-00000000c1a4', 'wendi@clauses.test'),
  ('00000000-0000-0000-0000-00000000c1a5', 'mark@clauses.test'),
  ('00000000-0000-0000-0000-00000000c1a6', 'tess@clauses.test'),
  ('00000000-0000-0000-0000-00000000c1a7', 'twin@clauses.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000c1a1', 'robert@clauses.test', 'Robert', 'dev', false, false),
  ('00000000-0000-0000-0000-00000000c1a2', 'rosa@clauses.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000000c1a3', 'maria@clauses.test', 'Maria', 'controller', false, false),
  ('00000000-0000-0000-0000-00000000c1a4', 'wendi@clauses.test', 'Wendi', 'superintendent', false, false),
  ('00000000-0000-0000-0000-00000000c1a5', 'mark@clauses.test', 'Mark', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000000c1a6', 'tess@clauses.test', 'Tess', 'estimator', true, false),
  ('00000000-0000-0000-0000-00000000c1a7', 'twin@clauses.test', 'Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- The master agreement in the library, published once, with the prototype's clauses: five for everyone, then one each
-- for Sitework, Electrical and Structural steel.
INSERT INTO public.contract_templates (id, name) VALUES ('00000000-0000-0000-0000-00000000c1b1', 'Clause bed Subs');
INSERT INTO public.contract_template_documents (id, template_id, document_name, revision, published_at) VALUES
  ('00000000-0000-0000-0000-00000000c1c1', '00000000-0000-0000-0000-00000000c1b1', 'Master services agreement', 1, now());
INSERT INTO public.contract_clauses (id, paper_id, sequence_order, text_en, scope) VALUES
  ('00000000-0000-0000-0000-00000000c1d1', '00000000-0000-0000-0000-00000000c1c1', 1, 'Term: one year from signing.', ARRAY['all']),
  ('00000000-0000-0000-0000-00000000c1d2', '00000000-0000-0000-0000-00000000c1c1', 2, 'Insurance: $1,000,000 per occurrence.', ARRAY['all']),
  ('00000000-0000-0000-0000-00000000c1d3', '00000000-0000-0000-0000-00000000c1c1', 3, 'Payment: a draw per approved pay application.', ARRAY['all']),
  ('00000000-0000-0000-0000-00000000c1d4', '00000000-0000-0000-0000-00000000c1c1', 4, 'Safety: OSHA 30 for the foreman.', ARRAY['all']),
  ('00000000-0000-0000-0000-00000000c1d5', '00000000-0000-0000-0000-00000000c1c1', 5, 'Work: each job under its own statement of work.', ARRAY['all']),
  ('00000000-0000-0000-0000-00000000c1d6', '00000000-0000-0000-0000-00000000c1c1', 6, 'Utilities: a locate is called in before any dig.', ARRAY['Sitework']),
  ('00000000-0000-0000-0000-00000000c1d7', '00000000-0000-0000-0000-00000000c1c1', 7, 'Licensing: a master electrician of record on every permit.', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000000c1d8', '00000000-0000-0000-0000-00000000c1c1', 8, 'Fall protection: tied off above six feet.', ARRAY['Structural steel']);

CREATE SCHEMA ccl;
CREATE FUNCTION ccl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION ccl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION ccl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The clause as it stands: version, then words. The readers run as postgres, so a check made as a user reads the fixture.
CREATE FUNCTION ccl.clause(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT version || ' ' || text_en || CASE WHEN retired_at IS NULL THEN '' ELSE ' (retired)' END FROM public.contract_clauses WHERE id = p_id
$$;
CREATE FUNCTION ccl.revision() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT revision::text FROM public.contract_template_documents WHERE id = '00000000-0000-0000-0000-00000000c1c1'
$$;
-- A clause by the end of its fixture id (d1 to d8), or "new" for one made in the bed.
CREATE FUNCTION ccl.tag(p_id text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN p_id LIKE '00000000-0000-0000-0000-00000000c1d_' THEN right(p_id, 2) ELSE 'new' END
$$;
-- A paper as assembled for these trades: each clause as n:tag, the exhibit after a bar, then who it carries.
CREATE FUNCTION ccl.paper(p_trades text[], p_lang text DEFAULT 'en') RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  WITH p AS (SELECT public.contract_paper_clauses('00000000-0000-0000-0000-00000000c1c1', p_trades, p_lang) AS j)
  SELECT (SELECT string_agg((c->>'n') || ':' || ccl.tag(c->>'id'), ' ' ORDER BY (c->>'n')::int) FROM p, jsonb_array_elements(p.j->'clauses') c)
    || ' |' || coalesce((SELECT ' ' || string_agg((c->>'n') || ':' || ccl.tag(c->>'id'), ' ' ORDER BY (c->>'n')::int) FROM p, jsonb_array_elements(p.j->'exhibit') c), '')
    || ' | ' || (SELECT (p.j->'exhibitFor')::text FROM p)
$$;
GRANT USAGE ON SCHEMA ccl TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ccl TO anon, authenticated;

-- 0 · Nobody signed out reads a clause or changes one; outside the office there is nothing to read and no change to make.
SET LOCAL ROLE anon;
SELECT ccl.refused('no sign-in reads no clause', $q$SELECT count(*) FROM public.contract_clauses$q$, 'permission denied for table contract_clauses');
SELECT ccl.refused('no sign-in changes no clause', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'new', NULL, 'x')$q$, 'permission denied for function edit_clause');
RESET ROLE;
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a4');
SET LOCAL ROLE authenticated;
SELECT ccl.same('the superintendent reads no clause', (SELECT count(*)::text FROM public.contract_clauses), '0');
SELECT ccl.refused('the superintendent changes no clause', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'edit', '00000000-0000-0000-0000-00000000c1d2', 'Insurance: none.')$q$, 'Only the office changes a clause.');
SELECT ccl.refused('nor approves one', $q$SELECT public.approve_clause_proposal(gen_random_uuid())$q$, 'Only a controller or a dev approves a clause.');
SELECT ccl.refused('nor reaches the assembly', $q$SELECT public.contract_paper_clauses('00000000-0000-0000-0000-00000000c1c1', ARRAY['Sitework'])$q$, 'permission denied for function contract_paper_clauses');
RESET ROLE;

-- 1 · Rosa proposes a change to clause 2. It waits: the clause and the paper are as they were.
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a2');
SET LOCAL ROLE authenticated;
SELECT ccl.same('Rosa reads the eight clauses', (SELECT count(*)::text FROM public.contract_clauses), '8');
SELECT ccl.same('Rosa''s change waits for approval', (
  SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'edit', '00000000-0000-0000-0000-00000000c1d2', ' Insurance: $2,000,000 per occurrence. ', '', ARRAY['all'], 'the insurer asked for it')->>'state'), 'proposed');
SELECT ccl.same('clause 2 is as it was', ccl.clause('00000000-0000-0000-0000-00000000c1d2'), '1 Insurance: $1,000,000 per occurrence.');
SELECT ccl.same('the paper is as it was', ccl.revision(), '1');
SELECT ccl.same('the proposal is Rosa''s, made against version 1, with her why', (
  SELECT concat_ws('|', kind, by_name, base_v, text_en, why, state) FROM public.contract_clause_proposals WHERE state = 'proposed'),
  'edit|Rosa|1|Insurance: $2,000,000 per occurrence.|the insurer asked for it|proposed');
-- 2 · Nobody writes the tables but the RPCs, and Rosa does not approve, nor does a leader.
SELECT ccl.refused('Rosa adds no clause by hand', $q$INSERT INTO public.contract_clauses (paper_id, sequence_order, text_en) VALUES ('00000000-0000-0000-0000-00000000c1c1', 9, 'Mine.')$q$, 'permission denied for table contract_clauses');
SELECT ccl.refused('Rosa approves nothing by hand', $q$UPDATE public.contract_clause_proposals SET state = 'approved'$q$, 'permission denied for table contract_clause_proposals');
SELECT ccl.refused('Rosa does not approve her own change', $q$SELECT public.approve_clause_proposal((SELECT id FROM public.contract_clause_proposals WHERE state = 'proposed'))$q$, 'Only a controller or a dev approves a clause.');
SELECT ccl.refused('Rosa reaches no apply', $q$SELECT public.contract_clause_apply(gen_random_uuid(), gen_random_uuid(), 'x')$q$, 'permission denied for function contract_clause_apply');
RESET ROLE;
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a5');
SET LOCAL ROLE authenticated;
SELECT ccl.refused('a leader edits and does not approve', $q$SELECT public.approve_clause_proposal((SELECT id FROM public.contract_clause_proposals WHERE state = 'proposed'))$q$, 'Only a controller or a dev approves a clause.');
RESET ROLE;

-- 3 · Maria approves: clause 2 is Rosa's words as version 2, and the paper is revision 2.
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a3');
SET LOCAL ROLE authenticated;
SELECT ccl.same('Maria''s approval publishes it', (
  SELECT r->>'state' || ' v' || (r->>'version') || ' r' || (r->>'revision')
  FROM (SELECT public.approve_clause_proposal((SELECT id FROM public.contract_clause_proposals WHERE state = 'proposed')) AS r) x), 'published v2 r2');
SELECT ccl.same('clause 2 is Rosa''s words as version 2', ccl.clause('00000000-0000-0000-0000-00000000c1d2'), '2 Insurance: $2,000,000 per occurrence.');
SELECT ccl.same('the paper is revision 2', ccl.revision(), '2');
SELECT ccl.same('the change is approved by Maria, with what it made', (
  SELECT concat_ws('|', state, decided_by_name, result_v, paper_revision) FROM public.contract_clause_proposals WHERE clause_id = '00000000-0000-0000-0000-00000000c1d2'),
  'approved|Maria|2|2');
SELECT ccl.refused('a decided change is decided once', $q$SELECT public.approve_clause_proposal((SELECT id FROM public.contract_clause_proposals WHERE clause_id = '00000000-0000-0000-0000-00000000c1d2'))$q$, 'This change is decided already.');
RESET ROLE;

-- 4 · A stale proposal: Rosa proposes a change to clause 3, Robert publishes his own first, and Maria cannot approve
-- Rosa's over it. Robert's change is its own approved history row.
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a2');
SET LOCAL ROLE authenticated;
SELECT ccl.same('Rosa proposes a change to clause 3', (
  SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'edit', '00000000-0000-0000-0000-00000000c1d3', 'Payment: net thirty.', '', ARRAY['all'], '')->>'state'), 'proposed');
RESET ROLE;
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a1');
SET LOCAL ROLE authenticated;
SELECT ccl.same('Robert''s own change publishes at once', (
  SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'edit', '00000000-0000-0000-0000-00000000c1d3', 'Payment: net forty-five.', '', ARRAY['all'], 'the owner pays late')->>'state'), 'published');
SELECT ccl.same('and is its own approved row', (
  SELECT concat_ws('|', by_name, decided_by_name, base_v, result_v, paper_revision) FROM public.contract_clause_proposals WHERE clause_id = '00000000-0000-0000-0000-00000000c1d3' AND state = 'approved'),
  'Robert|Robert|1|2|3');
RESET ROLE;
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a3');
SET LOCAL ROLE authenticated;
SELECT ccl.refused('Rosa''s stale change is refused', $q$SELECT public.approve_clause_proposal((SELECT id FROM public.contract_clause_proposals WHERE clause_id = '00000000-0000-0000-0000-00000000c1d3' AND state = 'proposed'))$q$,
  'That clause changed since Rosa proposed this. Decline it and ask Rosa to propose it again.');
SELECT ccl.same('clause 3 keeps Robert''s words', ccl.clause('00000000-0000-0000-0000-00000000c1d3'), '2 Payment: net forty-five.');
-- 5 · A decline needs a why.
SELECT ccl.refused('a decline with no why', $q$SELECT public.decline_clause_proposal((SELECT id FROM public.contract_clause_proposals WHERE state = 'proposed'), '  ')$q$, 'Say why, for Rosa.');
SELECT ccl.same('Maria declines it with a why', (
  SELECT public.decline_clause_proposal((SELECT id FROM public.contract_clause_proposals WHERE state = 'proposed'), 'Robert changed it first; propose it again if you still want it.')->>'state'), 'declined');
SELECT ccl.same('the decline keeps its why and who', (
  SELECT concat_ws('|', state, decided_by_name, decline_why) FROM public.contract_clause_proposals WHERE state = 'declined'),
  'declined|Maria|Robert changed it first; propose it again if you still want it.');
RESET ROLE;

-- 6 · What a change must say, in the editor's words.
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a2');
SET LOCAL ROLE authenticated;
SELECT ccl.refused('an empty clause', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'new', NULL, '   ')$q$, 'Write the clause.');
SELECT ccl.refused('a clause for nobody', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'new', NULL, 'Paving: a proof roll.', '', ARRAY[' ', ''])$q$, 'Pick who it applies to.');
SELECT ccl.refused('the same words and trades are no change', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'edit', '00000000-0000-0000-0000-00000000c1d6', 'Utilities: a locate is called in before any dig.', '', ARRAY[' sitework '])$q$, 'Nothing changed.');
SELECT ccl.refused('a clause of another paper', $q$SELECT public.edit_clause(gen_random_uuid(), 'edit', '00000000-0000-0000-0000-00000000c1d6', 'x')$q$, 'That paper is not in the Contract library.');
SELECT ccl.refused('a kind that is not a change', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'delete', '00000000-0000-0000-0000-00000000c1d6')$q$, 'That is not a change to a clause.');
SELECT ccl.same('every refusal wrote nothing', (SELECT count(*)::text FROM public.contract_clause_proposals), '3');
RESET ROLE;
-- 7 · Training mode and a digital twin change nothing.
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a6');
SET LOCAL ROLE authenticated;
SELECT ccl.refused('training mode changes no clause', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'new', NULL, 'Practice clause.')$q$, 'Read-only (training) mode');
RESET ROLE;
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a7');
SET LOCAL ROLE authenticated;
SELECT ccl.refused('a digital twin changes no clause', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'new', NULL, 'Twin clause.')$q$, 'A digital twin cannot change a clause.');
RESET ROLE;

-- 8 · The paper per trade, with one numbering and nothing inherited. Greg's Sitework, matched trimmed and case-blind;
-- Bill's Electrical, low voltage gets no Electrical clause; a company with two trades gets both exhibits, each once.
SELECT ccl.same('Greg''s paper: five, then his Sitework clause as 6', ccl.paper(ARRAY['Sitework']), '1:d1 2:d2 3:d3 4:d4 5:d5 | 6:d6 | ["Sitework"]');
SELECT ccl.same('his trade matched trimmed and case-blind, in his own spelling', ccl.paper(ARRAY['  sitework ']), '1:d1 2:d2 3:d3 4:d4 5:d5 | 6:d6 | ["sitework"]');
SELECT ccl.same('Bill''s low voltage inherits nothing from Electrical', ccl.paper(ARRAY['Electrical, low voltage']), '1:d1 2:d2 3:d3 4:d4 5:d5 | | []');
SELECT ccl.same('two trades, both exhibits, in order', ccl.paper(ARRAY['Structural steel', 'Electrical']), '1:d1 2:d2 3:d3 4:d4 5:d5 | 6:d7 7:d8 | ["Structural steel", "Electrical"]');
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a1');
SET LOCAL ROLE authenticated;
SELECT ccl.same('Robert adds a clause for both electrical trades', (
  SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'new', NULL, 'Arc flash: labels on every panel.', '', ARRAY['Electrical', ' electrical,  low voltage', 'Electrical'], '')->>'version'), '1');
SELECT ccl.same('it goes after the last, its trades each once', (
  SELECT sequence_order || ' ' || array_to_string(scope, ';') FROM public.contract_clauses WHERE text_en LIKE 'Arc flash%'), '9 Electrical;electrical, low voltage');
SELECT ccl.same('a Spanish clause shows on the Spanish page, the English where there is none', (
  SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'edit', '00000000-0000-0000-0000-00000000c1d1', 'Term: one year from signing.', 'Plazo: un año desde la firma.', ARRAY['all'])->>'version'), '2');
RESET ROLE;
SELECT ccl.same('Bill''s paper now carries the clause naming his trade', ccl.paper(ARRAY['Electrical, low voltage']), '1:d1 2:d2 3:d3 4:d4 5:d5 | 6:new | ["Electrical, low voltage"]');
SELECT ccl.same('in Spanish', (
  SELECT (j->'clauses'->0->>'text') || ' / ' || (j->'clauses'->1->>'text')
  FROM (SELECT public.contract_paper_clauses('00000000-0000-0000-0000-00000000c1c1', ARRAY['Sitework'], 'es') AS j) x),
  'Plazo: un año desde la firma. / Insurance: $2,000,000 per occurrence.');

-- 9 · Greg signs, then Robert retires the Sitework clause: the next paper leaves it out, the signed copy keeps it, and
-- nobody rewrites the copy.
INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status, paper_revision, clause_versions)
SELECT 'Clause bed Greg', 'Master services agreement', gen_random_uuid(), 1, 'signed', (j->>'revision')::int, j
FROM (SELECT public.contract_paper_clauses('00000000-0000-0000-0000-00000000c1c1', ARRAY['Sitework']) AS j) x;
SELECT ccl.as_user('00000000-0000-0000-0000-00000000c1a1');
SET LOCAL ROLE authenticated;
SELECT ccl.same('Robert retires the Sitework clause', (
  SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'retire', '00000000-0000-0000-0000-00000000c1d6', '', '', NULL, 'the yard closed')->>'state'), 'published');
SELECT ccl.refused('a retired clause is retired once', $q$SELECT public.edit_clause('00000000-0000-0000-0000-00000000c1c1', 'retire', '00000000-0000-0000-0000-00000000c1d6')$q$, 'That clause is retired already.');
RESET ROLE;
SELECT ccl.same('the clause is kept, retired', ccl.clause('00000000-0000-0000-0000-00000000c1d6'), '1 Utilities: a locate is called in before any dig. (retired)');
SELECT ccl.same('the next paper leaves it out', ccl.paper(ARRAY['Sitework']), '1:d1 2:d2 3:d3 4:d4 5:d5 | | []');
SELECT ccl.same('the signed copy keeps its words, its revision and each version', (
  SELECT paper_revision || ' ' || (clause_versions->'exhibit'->0->>'text') || ' v' || (clause_versions->'exhibit'->0->>'v')
    || ' ' || (clause_versions->'clauses'->0->>'text') || ' v' || (clause_versions->'clauses'->0->>'v')
  FROM public.person_contract_documents WHERE person_name = 'Clause bed Greg'),
  '5 Utilities: a locate is called in before any dig. v1 Term: one year from signing. v2');
SELECT ccl.same('the paper moved on to revision 6', ccl.revision(), '6');
SELECT ccl.refused('nobody rewrites a signed copy''s words', $q$UPDATE public.person_contract_documents SET clause_versions = '{}'::jsonb WHERE person_name = 'Clause bed Greg'$q$, 'A signed copy keeps the words it was signed with.');
SELECT ccl.refused('nor its revision', $q$UPDATE public.person_contract_documents SET paper_revision = 6 WHERE person_name = 'Clause bed Greg'$q$, 'A signed copy keeps the words it was signed with.');
UPDATE public.person_contract_documents SET note = 'Filed.' WHERE person_name = 'Clause bed Greg';
SELECT ccl.same('the rest of the copy still takes a note', (SELECT note FROM public.person_contract_documents WHERE person_name = 'Clause bed Greg'), 'Filed.');

-- 10 · The history: clause 3's changes, the approved and the declined, in order.
SELECT ccl.same('clause 3''s history', (
  SELECT string_agg(concat_ws(' ', by_name, state, coalesce(result_v::text, '-')), ', ' ORDER BY created_at) FROM public.contract_clause_proposals WHERE clause_id = '00000000-0000-0000-0000-00000000c1d3'),
  'Rosa declined -, Robert approved 2');

-- 11 · The two tables carry their read policy and the training-mode and twin blocks; the signed copies their freeze.
SELECT ccl.same('both tables carry the training-mode block', (
  SELECT string_agg(c.relname, ' ' ORDER BY c.relname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgname = 'read_only_block_stmt' AND c.relname IN ('contract_clauses', 'contract_clause_proposals')),
  'contract_clause_proposals contract_clauses');
SELECT ccl.same('both tables carry their read policy and the twin fence', (
  SELECT string_agg(c.relname || ':' || p.polname, ' ' ORDER BY c.relname, p.polname) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
  WHERE c.relname IN ('contract_clauses', 'contract_clause_proposals') AND (p.polname LIKE '%office_reads' OR p.polname LIKE 'digital_twin_write_fence_%')),
  'contract_clause_proposals:contract_clause_proposals_office_reads contract_clause_proposals:digital_twin_write_fence_delete contract_clause_proposals:digital_twin_write_fence_insert contract_clause_proposals:digital_twin_write_fence_update contract_clauses:contract_clauses_office_reads contract_clauses:digital_twin_write_fence_delete contract_clauses:digital_twin_write_fence_insert contract_clauses:digital_twin_write_fence_update');
SELECT ccl.same('the three signed copies freeze their clauses', (
  SELECT string_agg(c.relname, ' ' ORDER BY c.relname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE t.tgname = 'contract_signed_clauses_frozen'),
  'gc_owner_contract_sends gc_sows person_contract_documents');

DO $$ BEGIN RAISE NOTICE 'contract_clauses PASSED'; END $$;
ROLLBACK;
