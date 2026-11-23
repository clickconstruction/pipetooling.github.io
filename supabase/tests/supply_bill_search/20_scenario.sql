-- One search across every supply house bill (punch list #431, PR 5, migration *_supply_bill_search): what a word
-- finds, by a bill's own facts and by a line read from its paper; how a day, a month and a year narrow; that a % and a
-- _ are never wild; the line a hit names; and who finds anything at all, since the function runs as the caller.
-- Fixtures are written as postgres; the tries run as each account under RLS; everything rolls back. Every house,
-- number, part and amount is made up. Raises on the first failed assertion; ends with "supply_bill_search PASSED".
-- See scripts/pgtest-supply-bill-search.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev, Mara a leader, Tess the office (an assistant), Eve an estimator and Hal a helper.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000004310a0', 'dee@billsearch.test'),
  ('00000000-0000-0000-0000-0000004310a1', 'mara@billsearch.test'),
  ('00000000-0000-0000-0000-0000004310a2', 'tess@billsearch.test'),
  ('00000000-0000-0000-0000-0000004310a3', 'eve@billsearch.test'),
  ('00000000-0000-0000-0000-0000004310a4', 'hal@billsearch.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000004310a0', 'dee@billsearch.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000004310a1', 'mara@billsearch.test', 'Mara Leader', 'master_technician', false, false, NULL),
  ('00000000-0000-0000-0000-0000004310a2', 'tess@billsearch.test', 'Tess Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000004310a3', 'eve@billsearch.test', 'Eve Estimator', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000004310a4', 'hal@billsearch.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;

INSERT INTO public.supply_houses (id, name) VALUES
  ('00000000-0000-0000-0000-0000004310f1', 'Brightwater Pipe & Valve'),
  ('00000000-0000-0000-0000-0000004310f2', 'Harlow Supply');
INSERT INTO public.supply_house_invoices (id, supply_house_id, invoice_number, invoice_date, amount, link, purchase_order_number, is_paid, bill_read) VALUES
  ('00000000-0000-0000-0000-0000004310b1', '00000000-0000-0000-0000-0000004310f2', 'HS-204418', '2026-11-16', 560.00, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view', 'LC-C 114', false, NULL),
  ('00000000-0000-0000-0000-0000004310b2', '00000000-0000-0000-0000-0000004310f1', 'BW 7731-02', '2026-11-01', 40.48, NULL, 'LC-C 113', false, '{"file": {"path": "bills/f1/b2.pdf"}}'),
  ('00000000-0000-0000-0000-0000004310b3', '00000000-0000-0000-0000-0000004310f1', 'BW 7602-01', '2026-10-15', 1085.58, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view', NULL, false, NULL),
  ('00000000-0000-0000-0000-0000004310b4', '00000000-0000-0000-0000-0000004310f1', 'BW 7500_01', '2025-12-18', 1160.00, '   ', '100% rebate', false, NULL);
INSERT INTO public.supply_papers (id, supply_house_id, invoice_id, kind, number, read_by, check_state, text_layer) VALUES
  ('00000000-0000-0000-0000-0000004310c1', '00000000-0000-0000-0000-0000004310f2', '00000000-0000-0000-0000-0000004310b1', 'invoice', 'HS-204418', 'sweep:test', 'adds_up', true),
  ('00000000-0000-0000-0000-0000004310c2', '00000000-0000-0000-0000-0000004310f1', '00000000-0000-0000-0000-0000004310b2', 'invoice', 'BW 7731-02', 'sweep:test', 'adds_up', true),
  ('00000000-0000-0000-0000-0000004310c3', '00000000-0000-0000-0000-0000004310f1', '00000000-0000-0000-0000-0000004310b3', 'invoice', 'BW 7602-01', 'sweep:test', 'adds_up', true);
INSERT INTO public.supply_paper_lines (paper_id, line_no, description, house_code, mfr_number) VALUES
  ('00000000-0000-0000-0000-0000004310c1', 1, '50 gal gas water heater', 'WH-50-GAS', 'XG50T06'),
  ('00000000-0000-0000-0000-0000004310c2', 1, 'Purple primer, pint', 'PRIMER-PT', ''),
  ('00000000-0000-0000-0000-0000004310c2', 2, '3/4 in. ball valve, full port', 'BV-FP-075', ''),
  ('00000000-0000-0000-0000-0000004310c3', 1, '2 in. ball valve, full port', 'BV-FP-200', 'T-900-2'),
  ('00000000-0000-0000-0000-0000004310c3', 2, '', 'NH-CPL-4', '');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000004310e1', 'Bill Search Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000004310d1', '00000000-0000-0000-0000-0000004310a1', '00000000-0000-0000-0000-0000004310e1', 'ZZ Test Larkspur Commons', NULL);
INSERT INTO public.supply_house_invoice_job_allocations (invoice_id, job_id, pct) VALUES
  ('00000000-0000-0000-0000-0000004310b3', '00000000-0000-0000-0000-0000004310d1', 100);

CREATE SCHEMA sb;
GRANT USAGE ON SCHEMA sb TO authenticated, anon;
CREATE FUNCTION sb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sb.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A call's outcome as a word: 'ok', or the sqlstate it raised. Runs as the caller.
CREATE FUNCTION sb.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The numbers a search finds, newest first as the function orders them, among this scenario's own bills.
CREATE FUNCTION sb.found(p_words text[], p_year integer DEFAULT NULL, p_month integer DEFAULT NULL, p_day integer DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(r.invoice_number, ' | '), '') FROM public.search_supply_bills(p_words, p_year, p_month, p_day, 200) r WHERE r.invoice_id::text LIKE '00000000-0000-0000-0000-0000004310b%'
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sb TO authenticated, anon;

-- ---------- What a word finds, read as a dev, who reads every bill and every job ----------

SET LOCAL ROLE authenticated;
SELECT sb.sign_in('00000000-0000-0000-0000-0000004310a0');
SELECT sb.same('a house finds its bills, newest first', sb.found(ARRAY['brightwater']), 'BW 7731-02 | BW 7602-01 | BW 7500_01');
SELECT sb.same('a number, with its marks or without', sb.found(ARRAY['hs-204418']) || ' / ' || sb.found(ARRAY['hs204418']) || ' / ' || sb.found(ARRAY['bw7731']), 'HS-204418 / HS-204418 / BW 7731-02');
SELECT sb.same('a PO', sb.found(ARRAY['lc-c', '114']), 'HS-204418');
SELECT sb.same('an amount, plain, with a $ and with commas', sb.found(ARRAY['1085.58']) || ' / ' || sb.found(ARRAY['$1,085.58']) || ' / ' || sb.found(ARRAY['40.48']), 'BW 7602-01 / BW 7602-01 / BW 7731-02');
SELECT sb.same('an amount with no cents typed', sb.found(ARRAY['1160']), 'BW 7500_01');
SELECT sb.same('a part on the paper', sb.found(ARRAY['ball', 'valve']), 'BW 7731-02 | BW 7602-01');
SELECT sb.same('a house code and a maker''s number, with their marks or without', sb.found(ARRAY['bv-fp-200']) || ' / ' || sb.found(ARRAY['bvfp']) || ' / ' || sb.found(ARRAY['xg50t06']) || ' / ' || sb.found(ARRAY['t9002']), 'BW 7602-01 / BW 7731-02 | BW 7602-01 / HS-204418 / BW 7602-01');
SELECT sb.same('every word must be met, by a fact or by a line', sb.found(ARRAY['valve', 'harlow']) || ' / ' || sb.found(ARRAY['valve', '7602']), ' / BW 7602-01');
SELECT sb.same('a month narrows', sb.found(ARRAY['valve'], NULL, 10), 'BW 7602-01');
SELECT sb.same('a day alone is that day', sb.found('{}'::text[], 2026, 11, 16), 'HS-204418');
SELECT sb.same('a year alone', sb.found('{}'::text[], 2025), 'BW 7500_01');
SELECT sb.same('a % and a _ are themselves and never wild', sb.found(ARRAY['100%']) || ' / ' || sb.found(ARRAY['7500_01']) || ' / ' || sb.found(ARRAY['7_02']), 'BW 7500_01 / BW 7500_01 / ');
SELECT sb.same('a word nothing holds finds nothing', sb.found(ARRAY['zzzz']), '');
SELECT sb.same('blank words are no words', sb.found(ARRAY['', '  ', 'harlow']), 'HS-204418');
SELECT sb.same('the line that found a bill is named, with its code', (SELECT on_paper || ' ~ ' || on_paper_code FROM public.search_supply_bills(ARRAY['primer', '7731'])), 'Purple primer, pint ~ PRIMER-PT');
SELECT sb.same('a word the house''s own name holds names no line', (SELECT coalesce(on_paper, 'none') FROM public.search_supply_bills(ARRAY['valve', '7731'])), 'none');
SELECT sb.same('a line with no description is named by its code', (SELECT on_paper FROM public.search_supply_bills(ARRAY['nhcpl'])), 'NH-CPL-4');
SELECT sb.same('a bill its own facts found names no line', (SELECT coalesce(on_paper, 'none') FROM public.search_supply_bills(ARRAY['harlow'])), 'none');
SELECT sb.same('a PDF is a link or a copy of ours, and a blank link is none', (SELECT string_agg(invoice_number || '=' || has_pdf::text, ' ' ORDER BY invoice_number) FROM public.search_supply_bills('{}'::text[], NULL, NULL, NULL, 200) WHERE invoice_id::text LIKE '00000000-0000-0000-0000-0000004310b%'), 'BW 7500_01=false BW 7602-01=true BW 7731-02=true HS-204418=true');
SELECT sb.same('the jobs a bill is on come with it', (SELECT jsonb_array_length(jobs) || ' | ' || (jobs->0->>'job_name') || ' | ' || (jobs->0->>'id') || ' | ' || ((jobs->0->>'pct')::numeric = 100)::text FROM public.search_supply_bills(ARRAY['7602'])), '1 | ZZ Test Larkspur Commons | 00000000-0000-0000-0000-0000004310d1 | true');
SELECT sb.same('a bill on no job has an empty list', (SELECT jobs::text FROM public.search_supply_bills(ARRAY['harlow'])), '[]');
SELECT sb.same('the limit holds, and a silly one is one', (SELECT count(*)::text FROM public.search_supply_bills(ARRAY['brightwater'], NULL, NULL, NULL, 2)) || ' / ' || (SELECT count(*)::text FROM public.search_supply_bills(ARRAY['brightwater'], NULL, NULL, NULL, 0)), '2 / 1');

-- ---------- Who finds anything: the function runs as the caller ----------

SELECT sb.sign_in('00000000-0000-0000-0000-0000004310a2');
SELECT sb.same('the office finds bills, and a part on their paper', sb.found(ARRAY['harlow']) || ' / ' || sb.found(ARRAY['water', 'heater']), 'HS-204418 / HS-204418');
SELECT sb.sign_in('00000000-0000-0000-0000-0000004310a1');
SELECT sb.same('a leader finds bills', sb.found(ARRAY['harlow']), 'HS-204418');
SELECT sb.sign_in('00000000-0000-0000-0000-0000004310a3');
SELECT sb.same('an estimator finds none: bills are not theirs to read', sb.found(ARRAY['harlow']) || '/' || sb.found('{}'::text[]), '/');
SELECT sb.sign_in('00000000-0000-0000-0000-0000004310a4');
SELECT sb.same('a helper finds none', sb.found(ARRAY['harlow']) || '/' || sb.found('{}'::text[]), '/');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT sb.same('nobody signed out may call it', sb.try($$SELECT * FROM public.search_supply_bills(ARRAY['harlow'])$$), '42501');
RESET ROLE;

SELECT sb.same('the function runs as its caller', (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.search_supply_bills(text[], integer, integer, integer, integer)'::regprocedure), 'false');

DO $$ BEGIN RAISE NOTICE 'supply_bill_search PASSED'; END $$;
ROLLBACK;
