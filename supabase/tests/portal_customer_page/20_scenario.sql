-- The customer's page (Messages, cut 8, migration *_portal_customer_page): nobody signed out reads its words or the
-- office's read-back; the words are seeded from the code, as many as the newest seed holds (:seeded, from the bed);
-- the office edits a sentence, keeps its blanks and is stamped with who and when; nobody outside the office, in
-- training mode or a digital twin edits one; the migration and the newest seed run once more at the -- @reseed line
-- (the bed script streams them in there, as a later push would) and follow the code only for sentences nobody edited;
-- a paper view is read back per customer and paper, outside opens only, office only; a paper row names its paper, and
-- the usage readout still counts page loads only; the three switches per job start off and the office turns one on.
-- Presses run as each user through RLS; the fixture is made as postgres; everything rolls back. Raises on the first
-- failed assertion; ends with "portal_customer_page PASSED". See scripts/pgtest-portal-customer-page.sh. Never against
-- prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an assistant, an estimator), two outside it (a superintendent, a subcontractor), an assistant in
-- training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'dev@page.test'),
  ('00000000-0000-0000-0000-0000000008a2', 'assistant@page.test'),
  ('00000000-0000-0000-0000-0000000008a3', 'estimator@page.test'),
  ('00000000-0000-0000-0000-0000000008a4', 'super@page.test'),
  ('00000000-0000-0000-0000-0000000008a5', 'sub@page.test'),
  ('00000000-0000-0000-0000-0000000008a6', 'training@page.test'),
  ('00000000-0000-0000-0000-0000000008a7', 'twin@page.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'dev@page.test', 'Page Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000008a2', 'assistant@page.test', 'Page Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000008a3', 'estimator@page.test', 'Page Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000008a4', 'super@page.test', 'Page Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000008a5', 'sub@page.test', 'Page Sub', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-0000000008a6', 'training@page.test', 'Page Training', 'assistant', true, false),
  ('00000000-0000-0000-0000-0000000008a7', 'twin@page.test', 'Page Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A customer we build for, with a GC job, and another customer.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000008c1', 'Page Owner', '00000000-0000-0000-0000-0000000008a1'),
  ('00000000-0000-0000-0000-0000000008c2', 'Page Other', '00000000-0000-0000-0000-0000000008a1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000008b1', 'Page Clinic', '00000000-0000-0000-0000-0000000008c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000008b1', 'building');

CREATE SCHEMA pcp;
CREATE FUNCTION pcp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION pcp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- How many rows a statement changed.
CREATE FUNCTION pcp.changed(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
CREATE FUNCTION pcp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION pcp.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
GRANT USAGE ON SCHEMA pcp TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pcp TO anon, authenticated;

-- 0 · Nobody signed out reads the words or the read-back.
SET LOCAL ROLE anon;
SELECT pcp.refused('no sign-in reads no words', $q$SELECT count(*) FROM public.customer_page_words$q$, 'permission denied for table customer_page_words');
SELECT pcp.refused('no sign-in reads no read-back', $q$SELECT count(*) FROM public.customer_portal_views(ARRAY['00000000-0000-0000-0000-0000000008c1'::uuid])$q$,
  'permission denied for function customer_portal_views');
RESET ROLE;

-- 1 · The words are seeded from the code (pageWords.ts), and nobody has edited one yet.
SELECT pcp.same('every sentence of the customer''s page is seeded', (SELECT count(*)::text FROM public.customer_page_words), :'seeded');
SELECT pcp.same('a sentence in both languages', (SELECT concat_ws('|', en, es) FROM public.customer_page_words WHERE key = 'nothingToday'),
  'Nothing from you today.|Hoy no necesitamos nada de usted.');
SELECT pcp.same('a paper''s press in both languages', (SELECT concat_ws('|', en, es) FROM public.customer_page_words WHERE key = 'paper.contract.button'),
  'Sign the contract|Firme el contrato');
SELECT pcp.same('a sentence with a blank', (SELECT concat_ws('|', en, es) FROM public.customer_page_words WHERE key = 'weAreOn'), 'We are on {step}.|Estamos en {step}.');
SELECT pcp.same('nobody edited one yet', (SELECT count(*)::text FROM public.customer_page_words WHERE edited_by IS NOT NULL OR edited_at IS NOT NULL), '0');

-- 2 · An assistant edits a sentence: the edit is theirs, stamped by the table. A blank stays; nothing else is theirs.
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a2');
SET LOCAL ROLE authenticated;
SELECT pcp.same('the assistant edits one sentence',
  pcp.changed($q$UPDATE public.customer_page_words SET en = 'Nothing needed from you today.', es = 'Hoy no le pedimos nada.' WHERE key = 'nothingToday'$q$), '1');
SELECT pcp.same('the edit is the assistant''s, stamped now',
  (SELECT concat_ws('|', en, es, edited_by, edited_at IS NOT NULL) FROM public.customer_page_words WHERE key = 'nothingToday'),
  'Nothing needed from you today.|Hoy no le pedimos nada.|00000000-0000-0000-0000-0000000008a2|t');
SELECT pcp.same('an edit may reword around a blank', pcp.changed($q$UPDATE public.customer_page_words SET en = 'Right now we are on {step}.' WHERE key = 'weAreOn'$q$), '1');
SELECT pcp.refused('an edit that drops a blank', $q$UPDATE public.customer_page_words SET en = 'We are on it.' WHERE key = 'weAreOn'$q$,
  'keeps the sentence''s blanks: {step}');
SELECT pcp.refused('a Spanish edit that drops the blank', $q$UPDATE public.customer_page_words SET es = 'Estamos en ello.' WHERE key = 'weAreOn'$q$,
  'keeps the sentence''s blanks: {step}');
SELECT pcp.refused('an edit that adds a blank', $q$UPDATE public.customer_page_words SET es = 'Hoy {nada}.' WHERE key = 'nothingToday'$q$,
  'keeps the sentence''s blanks: none');
SELECT pcp.refused('a sentence that says nothing', $q$UPDATE public.customer_page_words SET es = '   ' WHERE key = 'fewer'$q$, 'customer_page_words_es_said');
SELECT pcp.refused('who edited is not the client''s to say', $q$UPDATE public.customer_page_words SET edited_by = '00000000-0000-0000-0000-0000000008a1' WHERE key = 'fewer'$q$,
  'permission denied for table customer_page_words');
SELECT pcp.refused('a key is the code''s', $q$UPDATE public.customer_page_words SET key = 'fewerStill' WHERE key = 'fewer'$q$, 'permission denied for table customer_page_words');
SELECT pcp.refused('no new sentence', $q$INSERT INTO public.customer_page_words (key, en, es) VALUES ('newOne', 'New.', 'Nuevo.')$q$, 'permission denied for table customer_page_words');
SELECT pcp.refused('no sentence taken away', $q$DELETE FROM public.customer_page_words WHERE key = 'fewer'$q$, 'permission denied for table customer_page_words');
RESET ROLE;

-- 3 · Outside the office: reads none, edits nothing.
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a4');
SET LOCAL ROLE authenticated;
SELECT pcp.same('a superintendent reads none', (SELECT count(*)::text FROM public.customer_page_words), '0');
SELECT pcp.same('a superintendent edits nothing', pcp.changed($q$UPDATE public.customer_page_words SET en = 'Hi.' WHERE key = 'fewer'$q$), '0');
RESET ROLE;
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a5');
SET LOCAL ROLE authenticated;
SELECT pcp.same('a subcontractor reads none', (SELECT count(*)::text FROM public.customer_page_words), '0');
SELECT pcp.same('a subcontractor edits nothing', pcp.changed($q$UPDATE public.customer_page_words SET en = 'Hi.' WHERE key = 'fewer'$q$), '0');
RESET ROLE;

-- 4 · Training mode and a digital twin read, and edit nothing.
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a6');
SET LOCAL ROLE authenticated;
SELECT pcp.same('a training account reads the words', (SELECT count(*)::text FROM public.customer_page_words), :'seeded');
SELECT pcp.refused('a training account edits nothing', $q$UPDATE public.customer_page_words SET en = 'Practice.' WHERE key = 'fewer'$q$, 'Read-only (training) mode');
RESET ROLE;
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a7');
SET LOCAL ROLE authenticated;
SELECT pcp.same('a digital twin edits nothing', pcp.changed($q$UPDATE public.customer_page_words SET en = 'Twin.' WHERE key = 'fewer'$q$), '0');
RESET ROLE;
SELECT pcp.same('only the assistant''s two edits stand',
  (SELECT string_agg(key || ':' || en, ',' ORDER BY key) FROM public.customer_page_words WHERE edited_at IS NOT NULL),
  'nothingToday:Nothing needed from you today.,weAreOn:Right now we are on {step}.');

-- 5 · A later seed follows the code only where nobody edited. An older shipped wording stands in for a code change
-- (written as a migration writes, signed out, so it stays unstamped); then the migration runs again here.
SELECT pcp.signed_out();
UPDATE public.customer_page_words SET en = 'Less', es = 'Menos ya' WHERE key = 'fewer';
SELECT pcp.same('the older wording is nobody''s edit', (SELECT concat_ws('|', en, es, edited_at IS NULL) FROM public.customer_page_words WHERE key = 'fewer'), 'Less|Menos ya|t');
-- @reseed
SELECT pcp.same('an unedited sentence follows the code', (SELECT concat_ws('|', en, es, edited_at IS NULL) FROM public.customer_page_words WHERE key = 'fewer'), 'Fewer|Menos|t');
SELECT pcp.same('an edited sentence stays the office''s',
  (SELECT concat_ws('|', en, edited_by) FROM public.customer_page_words WHERE key = 'nothingToday'),
  'Nothing needed from you today.|00000000-0000-0000-0000-0000000008a2');
SELECT pcp.same('the seed stamped nothing', (SELECT count(*)::text FROM public.customer_page_words WHERE edited_at IS NOT NULL), '2');
SELECT pcp.same('still every sentence, once', (SELECT count(*)::text FROM public.customer_page_words), :'seeded');

-- 6 · A view per paper. The customer-portal function writes these with the service role; here, as postgres. Two page
-- loads, change order 2 opened twice, the contract once, a staff look at the contract (never counted), and another
-- customer's pay application.
INSERT INTO public.public_page_views (surface, entity_id, via, viewer, occurred_at, paper_kind, paper_id) VALUES
  ('portal', '00000000-0000-0000-0000-0000000008c1', 'token', 'outside', now() - interval '3 days', NULL, NULL),
  ('portal', '00000000-0000-0000-0000-0000000008c1', 'token', NULL, now() - interval '1 day', NULL, NULL),
  ('portal_paper', '00000000-0000-0000-0000-0000000008c1', 'token', 'outside', now() - interval '1 day' + interval '1 minute', 'change_order', '00000000-0000-0000-0000-0000000008d2'),
  ('portal_paper', '00000000-0000-0000-0000-0000000008c1', 'token', 'outside', now() - interval '2 hours', 'change_order', '00000000-0000-0000-0000-0000000008d2'),
  ('portal_paper', '00000000-0000-0000-0000-0000000008c1', 'token', 'outside', now() - interval '13 days', 'contract', '00000000-0000-0000-0000-0000000008d1'),
  ('portal_paper', '00000000-0000-0000-0000-0000000008c1', 'token', 'staff', now() - interval '12 days', 'contract', '00000000-0000-0000-0000-0000000008d1'),
  ('portal_paper', '00000000-0000-0000-0000-0000000008c2', 'token', 'outside', now() - interval '5 days', 'pay_app', '00000000-0000-0000-0000-0000000008d3');
SELECT pcp.refused('a paper row with no paper', $q$INSERT INTO public.public_page_views (surface, entity_id) VALUES ('portal_paper', '00000000-0000-0000-0000-0000000008c1')$q$,
  'public_page_views_paper_check');
SELECT pcp.refused('a paper row with an id and no kind', $q$INSERT INTO public.public_page_views (surface, entity_id, paper_id) VALUES ('portal_paper', '00000000-0000-0000-0000-0000000008c1', '00000000-0000-0000-0000-0000000008d1')$q$,
  'public_page_views_paper_check');
SELECT pcp.refused('a page row that names a paper', $q$INSERT INTO public.public_page_views (surface, entity_id, paper_kind, paper_id) VALUES ('portal', '00000000-0000-0000-0000-0000000008c1', 'contract', '00000000-0000-0000-0000-0000000008d1')$q$,
  'public_page_views_paper_check');
SELECT pcp.refused('a paper it does not know', $q$INSERT INTO public.public_page_views (surface, entity_id, paper_kind, paper_id) VALUES ('portal_paper', '00000000-0000-0000-0000-0000000008c1', 'invoice', '00000000-0000-0000-0000-0000000008d1')$q$,
  'public_page_views_paper_check');
SELECT pcp.refused('a paper row with no customer', $q$INSERT INTO public.public_page_views (surface, paper_kind, paper_id) VALUES ('portal_paper', 'contract', '00000000-0000-0000-0000-0000000008d1')$q$,
  'public_page_views_paper_check');
SELECT pcp.refused('a surface it does not know', $q$INSERT INTO public.public_page_views (surface, entity_id) VALUES ('portal_papers', '00000000-0000-0000-0000-0000000008c1')$q$,
  'public_page_views_surface_check');

SELECT pcp.same('the surface column names the readers that count its rows as loads',
  (SELECT col_description('public.public_page_views'::regclass, a.attnum) LIKE '%customer-portal%usage_customer_views%journey_health_counts%'
   FROM pg_attribute a WHERE a.attrelid = 'public.public_page_views'::regclass AND a.attname = 'surface')::text, 'true');

SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a2');
SET LOCAL ROLE authenticated;
SELECT pcp.same('the assistant reads the page and each paper back: first, last and how many outside opens',
  (SELECT string_agg(concat_ws('|', coalesce(v.paper_kind, 'page'), coalesce(v.paper_id::text, '-'), (now() - v.first_opened_at)::text, (now() - v.last_opened_at)::text, v.opens), ',' ORDER BY v.ord)
   FROM public.customer_portal_views(ARRAY['00000000-0000-0000-0000-0000000008c1'::uuid]) WITH ORDINALITY AS v(customer_id, paper_kind, paper_id, first_opened_at, last_opened_at, opens, ord)),
  'page|-|3 days|1 day|2,change_order|00000000-0000-0000-0000-0000000008d2|23:59:00|02:00:00|2,contract|00000000-0000-0000-0000-0000000008d1|13 days|13 days|1');
RESET ROLE;
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a1');
SET LOCAL ROLE authenticated;
SELECT pcp.same('a dev reads both customers',
  (SELECT string_agg(customer_id::text || ':' || coalesce(paper_kind, 'page'), ',' ORDER BY customer_id, paper_kind NULLS FIRST)
   FROM public.customer_portal_views(ARRAY['00000000-0000-0000-0000-0000000008c1'::uuid, '00000000-0000-0000-0000-0000000008c2'::uuid])),
  '00000000-0000-0000-0000-0000000008c1:page,00000000-0000-0000-0000-0000000008c1:change_order,00000000-0000-0000-0000-0000000008c1:contract,00000000-0000-0000-0000-0000000008c2:pay_app');
SELECT pcp.same('the usage readout still counts page loads only',
  (SELECT sum(views)::text FROM public.usage_customer_views(30) WHERE surface = 'portal'), '2');
RESET ROLE;
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a4');
SET LOCAL ROLE authenticated;
SELECT pcp.same('a superintendent reads nothing back', (SELECT count(*)::text FROM public.customer_portal_views(ARRAY['00000000-0000-0000-0000-0000000008c1'::uuid])), '0');
RESET ROLE;

-- 7 · The switches per job start off; the office turns one on; nobody outside the office does.
SELECT pcp.same('a job starts with photos, the forecast and Spanish off',
  (SELECT concat_ws('|', portal_photos_on, portal_forecast_on, portal_spanish_on) FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000008b1'), 'f|f|f');
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a2');
SET LOCAL ROLE authenticated;
SELECT pcp.same('the assistant turns photos on',
  pcp.changed($q$UPDATE public.gc_projects SET portal_photos_on = true WHERE project_id = '00000000-0000-0000-0000-0000000008b1'$q$), '1');
RESET ROLE;
SELECT pcp.as_user('00000000-0000-0000-0000-0000000008a4');
SET LOCAL ROLE authenticated;
SELECT pcp.same('a superintendent turns nothing on',
  pcp.changed($q$UPDATE public.gc_projects SET portal_spanish_on = true WHERE project_id = '00000000-0000-0000-0000-0000000008b1'$q$), '0');
RESET ROLE;
SELECT pcp.same('photos on, the rest off',
  (SELECT concat_ws('|', portal_photos_on, portal_forecast_on, portal_spanish_on) FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000008b1'), 't|f|f');

-- 8 · The house fences and the grants on the words, as the migration leaves them: the office's one policy, the
-- read-only write blocks and statement trigger, the twin fence, the edit trigger; signed in reads and updates the two
-- languages and nothing else; signed out, nothing.
SELECT pcp.same('the policies',
  (SELECT string_agg(policyname || ':' || permissive || ':' || cmd, ',' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customer_page_words'),
  'customer_page_words_team:PERMISSIVE:ALL,digital_twin_write_fence_delete:RESTRICTIVE:DELETE,digital_twin_write_fence_insert:RESTRICTIVE:INSERT,digital_twin_write_fence_update:RESTRICTIVE:UPDATE,read_only_users_cannot_delete:RESTRICTIVE:DELETE,read_only_users_cannot_insert:RESTRICTIVE:INSERT,read_only_users_cannot_update:RESTRICTIVE:UPDATE');
SELECT pcp.same('the triggers',
  (SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relname = 'customer_page_words' AND NOT t.tgisinternal),
  'customer_page_words_edit,read_only_block_stmt');
SELECT pcp.same('signed in reads the table, and changes nothing at the table level',
  (SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'customer_page_words' AND grantee = 'authenticated' AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  'SELECT');
SELECT pcp.same('signed in updates the two languages only',
  (SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges WHERE table_schema = 'public' AND table_name = 'customer_page_words' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'),
  'en,es');
SELECT pcp.same('signed out has nothing',
  (SELECT count(*)::text FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'customer_page_words' AND grantee = 'anon'),
  '0');

DO $$ BEGIN RAISE NOTICE 'portal_customer_page PASSED'; END $$;
ROLLBACK;
