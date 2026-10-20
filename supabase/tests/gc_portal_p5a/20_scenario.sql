-- Files from the portal (P5a-m, the Portal lane): the ledger gc_trade_files, its grants and RLS, and the three
-- verbs that store a file's link and tie the company's uploaded file to its record. The fixture is made as
-- postgres; the trade's verbs run as the service role; everything rolls back. Raises on the first failed
-- assertion; ends with "gc_portal_p5a PASSED". See scripts/pgtest-gc-portal-p5a.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000fad1', 'dev@p5a.test'), ('00000000-0000-0000-0000-00000000fad2', 'crew@p5a.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-00000000fad1', 'dev@p5a.test', 'P5a Dev', 'dev'),
  ('00000000-0000-0000-0000-00000000fad2', 'crew@p5a.test', 'P5a Crew', 'subcontractor')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- The clinic, building: Electrical awarded to Bright Line and signed, with a submittal it owes. A second
-- project, bidding, where Bright Line opened the plans of its ask. Level Line is another company.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-00000000fac1', 'P5a Test Owner', '00000000-0000-0000-0000-00000000fad1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-00000000faa1', 'P5a test clinic', '00000000-0000-0000-0000-00000000fac1'),
  ('00000000-0000-0000-0000-00000000faa2', 'P5a test bid', '00000000-0000-0000-0000-00000000fac1');
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-00000000faa1', 'building'),
  ('00000000-0000-0000-0000-00000000faa2', 'bidding');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-00000000fab1', '00000000-0000-0000-0000-00000000faa1', 'Electrical', 0, 50000, false),
  ('00000000-0000-0000-0000-00000000fab2', '00000000-0000-0000-0000-00000000faa2', 'Electrical', 0, 40000, false);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-00000000fa11', 'Bright Line Electric', '{Electrical}'),
  ('00000000-0000-0000-0000-00000000fa12', 'Level Line Electric', '{Electrical}');
INSERT INTO public.gc_invites (id, package_id, company_id, status, seen_rev) VALUES
  ('00000000-0000-0000-0000-00000000fa21', '00000000-0000-0000-0000-00000000fab1', '00000000-0000-0000-0000-00000000fa11', 'bid', 0),
  ('00000000-0000-0000-0000-00000000fa22', '00000000-0000-0000-0000-00000000fab2', '00000000-0000-0000-0000-00000000fa11', 'opened', 0);
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-00000000fa21', awarded_on = DATE '2026-10-01' WHERE id = '00000000-0000-0000-0000-00000000fab1';
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-00000000fa31', '00000000-0000-0000-0000-00000000fab1', '00000000-0000-0000-0000-00000000fa21', '00000000-0000-0000-0000-00000000fa11', 'signed', 48000, DATE '2026-10-01', DATE '2026-10-02');
INSERT INTO public.gc_submittals (id, project_id, package_id, number, title, kind, asked_on) VALUES
  ('00000000-0000-0000-0000-00000000fa41', '00000000-0000-0000-0000-00000000faa1', '00000000-0000-0000-0000-00000000fab1', '26 24 16-01', 'Panelboards', 'product data', DATE '2026-10-03');

-- Three files Bright Line uploaded (as P5a-1's kind writes them), and one of Level Line's with the same link as
-- Bright Line's change photo.
INSERT INTO public.gc_trade_files (id, company_id, project_id, package_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES
  ('00000000-0000-0000-0000-00000000fa51', '00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', '00000000-0000-0000-0000-00000000fab1', 'change', 'chairs.jpg', 'image/jpeg', 812345, 'drv-change', 'https://drive.google.com/file/d/drv-change/view'),
  ('00000000-0000-0000-0000-00000000fa52', '00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa2', NULL, 'quote', 'quote.pdf', 'application/pdf', 204800, 'drv-quote', 'https://drive.google.com/file/d/drv-quote/view'),
  ('00000000-0000-0000-0000-00000000fa53', '00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', '00000000-0000-0000-0000-00000000fab1', 'submittal', 'panelboards.pdf', 'application/pdf', 3145728, 'drv-sub', 'https://drive.google.com/file/d/drv-sub/view'),
  ('00000000-0000-0000-0000-00000000fa54', '00000000-0000-0000-0000-00000000fa12', '00000000-0000-0000-0000-00000000faa1', '00000000-0000-0000-0000-00000000fab1', 'change', 'theirs.jpg', 'image/jpeg', 1000, 'drv-other', 'https://drive.google.com/file/d/drv-change/view');

CREATE SCHEMA p5a;
CREATE FUNCTION p5a.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION p5a.refused(label text, stmt text, want_key text, want_words text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
  v_words text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_words = PG_EXCEPTION_DETAIL;
    IF v_state IS DISTINCT FROM 'P0001' OR SQLERRM IS DISTINCT FROM want_key OR v_words IS DISTINCT FROM want_words THEN
      RAISE EXCEPTION E'% was refused another way.\n--- got ---\n% % / %\n--- want ---\nP0001 % / %', label, v_state, SQLERRM, v_words, want_key, want_words;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION p5a.refused_code(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF NOT (SQLSTATE = ANY (string_to_array(want, ','))) THEN RAISE EXCEPTION '% was refused as % (%), not %', label, SQLSTATE, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION p5a.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA p5a TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA p5a TO authenticated, service_role;

-- 1. The ledger's grants: the client reads, never writes; anon has nothing.
SELECT p5a.same('the client may read the ledger and not write it',
  (SELECT string_agg(p || ':' || has_table_privilege('authenticated', 'public.gc_trade_files', p), ',' ORDER BY p) FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p),
  'DELETE:false,INSERT:false,SELECT:true,UPDATE:false');
SELECT p5a.same('anon has nothing on the ledger', has_table_privilege('anon', 'public.gc_trade_files', 'SELECT')::text, 'false');
SELECT p5a.same('the trade''s verbs and helpers are the service role''s alone',
  (SELECT string_agg(f || ':' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',') FROM unnest(ARRAY[
    'public.gc_trade_file_link(text)', 'public.gc_trade_file_tie(uuid, text, text, uuid)',
    'public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer, text)', 'public.gc_trade_submit_quote(uuid, uuid, jsonb)',
    'public.gc_trade_submittal_send(uuid, uuid, text, text, text)']) f),
  'public.gc_trade_file_link(text):false/true,public.gc_trade_file_tie(uuid, text, text, uuid):false/true,public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer, text):false/true,public.gc_trade_submit_quote(uuid, uuid, jsonb):false/true,public.gc_trade_submittal_send(uuid, uuid, text, text, text):false/true');
SELECT p5a.same('the change request verb has one signature, the new one',
  (SELECT string_agg(p.oid::regprocedure::text, ',') FROM pg_proc p WHERE p.proname = 'gc_trade_ask_change' AND p.pronamespace = 'public'::regnamespace),
  'gc_trade_ask_change(uuid,uuid,text,text,numeric,integer,text)');

-- 2. RLS: the office team reads every row; a subcontractor reads none.
SET LOCAL ROLE authenticated;
SELECT p5a.as_user('00000000-0000-0000-0000-00000000fad1');
SELECT p5a.same('a dev reads the four files', (SELECT count(*)::text FROM public.gc_trade_files WHERE id::text LIKE '00000000-0000-0000-0000-00000000fa5%'), '4');
SELECT p5a.refused_code('a dev cannot write the ledger',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'change', 'x.jpg', 'image/jpeg', 1, 'x', 'https://x')$$,
  '42501');
SELECT p5a.as_user('00000000-0000-0000-0000-00000000fad2');
SELECT p5a.same('a subcontractor reads none', (SELECT count(*)::text FROM public.gc_trade_files), '0');
RESET ROLE;

-- 3. The ledger's CHECKs.
SELECT p5a.refused_code('a file over 10 MB',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'change', 'big.pdf', 'application/pdf', 10485761, 'x', 'https://x')$$, '23514');
SELECT p5a.refused_code('a type the portal does not take',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'change', 'a.zip', 'application/zip', 10, 'x', 'https://x')$$, '23514');
SELECT p5a.refused_code('a purpose that is not one of the four',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'coi', 'c.pdf', 'application/pdf', 10, 'x', 'https://x')$$, '23514');
SELECT p5a.refused_code('a link that is not https',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'change', 'c.pdf', 'application/pdf', 10, 'x', 'http://x')$$, '23514');
SELECT p5a.refused_code('a waiver without its form',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url, made_by) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'waiver', 'w.pdf', 'application/pdf', 10, 'x', 'https://x', 'portal')$$, '23514');
SELECT p5a.refused_code('a form on a file that is no waiver',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url, paper) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'change', 'c.pdf', 'application/pdf', 10, 'x', 'https://x', 'unconditional_progress')$$, '23514');
SELECT p5a.refused_code('a form that is not one of the four',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url, made_by, paper) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'waiver', 'w.pdf', 'application/pdf', 10, 'x', 'https://x', 'portal', 'partial_release')$$, '23514');
INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url, made_by, paper) VALUES ('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000faa1', 'waiver', 'w.pdf', 'application/pdf', 10, 'x', 'https://x', 'portal', 'unconditional_progress');
SELECT p5a.same('a waiver with its form is kept', (SELECT paper FROM public.gc_trade_files WHERE purpose = 'waiver'), 'unconditional_progress');

-- 4. The verbs, as the service role.
SET LOCAL ROLE service_role;

-- Each verb runs in its own statement, its id kept with \gset: a statement cannot see the rows its own call wrote.
-- A change request with its photo: the link is stored, and Bright Line's file is tied to it, never Level Line's.
SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000fab1', 'Two more circuits.', 'owner', 3400, 1, ' https://drive.google.com/file/d/drv-change/view ') AS change_id \gset
SELECT p5a.same('a change with its photo stores the link and ties Bright Line''s file',
  (SELECT file_url FROM public.gc_trade_change_requests WHERE id = :'change_id') || ' | ' ||
  ((SELECT record_id FROM public.gc_trade_files WHERE id = '00000000-0000-0000-0000-00000000fa51') = :'change_id')::text || ' | ' ||
  ((SELECT record_id FROM public.gc_trade_files WHERE id = '00000000-0000-0000-0000-00000000fa54') IS NULL)::text,
  'https://drive.google.com/file/d/drv-change/view | true | true');
-- The old call, without the new argument, as the function sends today: no link, nothing tied.
SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000fab1', 'Move a panel.', 'field', 900, 0) AS old_id \gset
SELECT p5a.same('the old call still works, with no link',
  (SELECT coalesce(file_url, 'none') FROM public.gc_trade_change_requests WHERE id = :'old_id'), 'none');
SELECT p5a.refused('a link that is not https',
  $$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000fab1', 'x', 'owner', 1, 0, 'http://drive.google.com/x')$$,
  'badRequest', 'A file''s link is an https link.');
SELECT p5a.refused('the change verb keeps its own refusals first',
  $$SELECT public.gc_trade_ask_change('00000000-0000-0000-0000-00000000fa12', '00000000-0000-0000-0000-00000000fab1', 'x', 'owner', 1, 0, 'https://x')$$,
  'notAwarded', 'A change is asked on work the company signed for, on a job that is ours.');

-- A quote with its PDF, and one with none.
SELECT public.gc_trade_submit_quote('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000fa22',
  jsonb_build_object('amount', 38000, 'includes', '{}'::jsonb, 'note', '', 'alternates', '[]'::jsonb, 'file', 'https://drive.google.com/file/d/drv-quote/view')) AS quote_id \gset
SELECT p5a.same('a quote with its PDF stores the link in quote_file and ties the file',
  (SELECT quote_file FROM public.gc_quotes WHERE id = :'quote_id') || ' | ' ||
  ((SELECT record_id FROM public.gc_trade_files WHERE id = '00000000-0000-0000-0000-00000000fa52') = :'quote_id')::text,
  'https://drive.google.com/file/d/drv-quote/view | true');
SELECT public.gc_trade_submit_quote('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000fa22',
  jsonb_build_object('amount', 37000, 'includes', '{}'::jsonb, 'note', '', 'alternates', '[]'::jsonb)) AS bare_quote_id \gset
SELECT p5a.same('a quote with no file keeps quote_file empty', (SELECT quote_file FROM public.gc_quotes WHERE id = :'bare_quote_id'), '');

-- A submittal round with its uploaded file.
SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-00000000fa11', '00000000-0000-0000-0000-00000000fa41', 'panelboards.pdf', 'https://drive.google.com/file/d/drv-sub/view', 'Square D.') AS round_id \gset
SELECT p5a.same('a round with its uploaded file ties the file to the round',
  ((SELECT record_id FROM public.gc_trade_files WHERE id = '00000000-0000-0000-0000-00000000fa53') = :'round_id')::text || ' | ' ||
  (SELECT drive_url FROM public.gc_submittal_rounds WHERE id = :'round_id'),
  'true | https://drive.google.com/file/d/drv-sub/view');
SELECT p5a.same('nothing else was tied',
  (SELECT count(*)::text FROM public.gc_trade_files WHERE record_id IS NOT NULL), '3');

RESET ROLE;

-- 5. The new table has the training-mode and digital-twin blocks, as every new table does.
SELECT p5a.same('the read-only and twin write blocks are on the ledger',
  ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gc_trade_files' AND permissive = 'RESTRICTIVE') > 0)::text,
  'true');

DO $$ BEGIN RAISE NOTICE 'gc_portal_p5a PASSED'; END $$;
ROLLBACK;
