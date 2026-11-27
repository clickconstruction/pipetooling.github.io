-- One hold, read by the Remove press's function and by the Trade partners list (20261127165916, punch list #443's
-- finding 338): gc_bench_company_hold, gc_remove_bench_company and gc_bench_holds. Here: one made-up company for each
-- kind of history, one with every kind, and two with none. The list's read answers each company's reason and NULL for
-- the two; the remove refuses each held company in the same words and takes a clean one off; the hold itself is
-- nobody's to call; the office reads the list, a training account too; a field role, a digital twin, an archived
-- caller and a caller with no sign-in read no row. Fixtures made as postgres; the calls run as signed-in users,
-- inside one transaction that rolls back. Raises on the first failed assertion; ends with "gc_bench_hold PASSED".
-- See scripts/pgtest-gc-bench-hold.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA gbh;
CREATE FUNCTION gbh.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gbh.answer(stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RETURN SQLSTATE || ' ' || SQLERRM;
  END;
  RETURN 'allowed';
END $$;
CREATE FUNCTION gbh.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The list's read as the caller gets it, one line a bed company in name order: "<name>: <hold or ->".
CREATE FUNCTION gbh.list() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(c.name || ': ' || COALESCE(h.hold, '-'), E'\n' ORDER BY c.name COLLATE "C"), 'no row')
  FROM public.gc_bench_holds() h JOIN public.gc_companies c ON c.id = h.company_id WHERE c.name LIKE 'ZZ Test Hold %' $$;
-- The same read counted, for a caller who may not read the bench's names.
CREATE FUNCTION gbh.rows() RETURNS text LANGUAGE sql STABLE AS $$ SELECT count(*)::text FROM public.gc_bench_holds() $$;
-- What the bed reads past RLS: whether a company is still on the bench.
CREATE FUNCTION gbh.on_bench(p uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.gc_companies c WHERE c.id = p)::text $$;
GRANT USAGE ON SCHEMA gbh TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbh TO authenticated, anon;

-- Who: a dev, an assistant, a dev in training mode, a helper, a digital twin and an archived dev.

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000338d001', 'dev@hold.test'),
  ('00000000-0000-0000-0000-00000338d002', 'assistant@hold.test'),
  ('00000000-0000-0000-0000-00000338d003', 'trainee@hold.test'),
  ('00000000-0000-0000-0000-00000338d004', 'helper@hold.test'),
  ('00000000-0000-0000-0000-00000338d005', 'twin@hold.test'),
  ('00000000-0000-0000-0000-00000338d006', 'gone@hold.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00000338d001', 'dev@hold.test', 'Hold dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-00000338d002', 'assistant@hold.test', 'Hold assistant', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-00000338d003', 'trainee@hold.test', 'Hold trainee', 'dev', true, false, NULL),
  ('00000000-0000-0000-0000-00000338d004', 'helper@hold.test', 'Hold helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-00000338d005', 'twin@hold.test', 'Hold twin', 'estimator', false, true, NULL),
  ('00000000-0000-0000-0000-00000338d006', 'gone@hold.test', 'Hold gone', 'dev', false, false, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

-- A made-up project with one trade, and the companies.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-00000338e001', 'ZZ Test Hold Owner', '00000000-0000-0000-0000-00000338d001');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-00000338a001', 'ZZ Test Hold Clinic', '00000000-0000-0000-0000-00000338e001');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-00000338a001', 'bidding');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES ('00000000-0000-0000-0000-00000338b001', '00000000-0000-0000-0000-00000338a001', 'Electrical', 0, 100, false);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-00000338c001', 'ZZ Test Hold A Work Order', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c002', 'ZZ Test Hold An Ask', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c003', 'ZZ Test Hold A Contact', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c004', 'ZZ Test Hold A Promise', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c005', 'ZZ Test Hold A Paper Sent', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c006', 'ZZ Test Hold A Company Paper', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c007', 'ZZ Test Hold A Portal File', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c008', 'ZZ Test Hold An Email', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c009', 'ZZ Test Hold A Thread', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c010', 'ZZ Test Hold A Form', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c011', 'ZZ Test Hold An Opened Portal', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c012', 'ZZ Test Hold An Rfi', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c013', 'ZZ Test Hold None', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c014', 'ZZ Test Hold None Too', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000338c015', 'ZZ Test Hold Everything', ARRAY['Electrical']);

-- One kind of history each, in the hold's own order.
INSERT INTO public.gc_invites (id, package_id, company_id, status) VALUES ('00000000-0000-0000-0000-00000338f001', '00000000-0000-0000-0000-00000338b001', '00000000-0000-0000-0000-00000338c001', 'bid'), ('00000000-0000-0000-0000-00000338f002', '00000000-0000-0000-0000-00000338b001', '00000000-0000-0000-0000-00000338c002', 'invited'), ('00000000-0000-0000-0000-00000338f015', '00000000-0000-0000-0000-00000338b001', '00000000-0000-0000-0000-00000338c015', 'bid');
INSERT INTO public.gc_sows (package_id, invite_id, company_id, price) VALUES ('00000000-0000-0000-0000-00000338b001', '00000000-0000-0000-0000-00000338f001', '00000000-0000-0000-0000-00000338c001', 100);
INSERT INTO public.gc_company_contacts (company_id, contacted_on, by_name, how, note) VALUES ('00000000-0000-0000-0000-00000338c003', DATE '2026-11-20', 'Hold dev', 'call', 'Left a voicemail.'), ('00000000-0000-0000-0000-00000338c015', DATE '2026-11-20', 'Hold dev', 'call', 'Left a voicemail.');
INSERT INTO public.gc_trade_promises (company_id, kind, project_id, package_id, what, due_on, source) VALUES ('00000000-0000-0000-0000-00000338c004', 'start', '00000000-0000-0000-0000-00000338a001', '00000000-0000-0000-0000-00000338b001', 'the start', current_date + 2, 'office');
INSERT INTO public.gc_paper_sends (company_id, paper, project_id, package_id, due_on) VALUES ('00000000-0000-0000-0000-00000338c005', 'sow', '00000000-0000-0000-0000-00000338a001', '00000000-0000-0000-0000-00000338b001', current_date + 5);
INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status, doc_type, company_id) VALUES ('gc-company:00000000-0000-0000-0000-00000338c006', 'Master subcontract', gen_random_uuid(), 1, 'sent', 'agreement', '00000000-0000-0000-0000-00000338c006');
INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000338c007', '00000000-0000-0000-0000-00000338a001', 'quote', 'quote.pdf', 'application/pdf', 204800, 'drv-hold', 'https://drive.google.com/file/d/drv-hold/view'), ('00000000-0000-0000-0000-00000338c015', '00000000-0000-0000-0000-00000338a001', 'quote', 'quote.pdf', 'application/pdf', 204800, 'drv-hold-2', 'https://drive.google.com/file/d/drv-hold-2/view');
INSERT INTO public.gc_trade_messages (company_id, kind, mail_group, msg_key, subject, sent_on) VALUES ('00000000-0000-0000-0000-00000338c008', 'invite', 'pay', 'hold:8', 'ZZ Test', DATE '2026-11-20'), ('00000000-0000-0000-0000-00000338c015', 'invite', 'pay', 'hold:15', 'ZZ Test', DATE '2026-11-20');
INSERT INTO public.contacts (kind, gc_company_id) VALUES ('trade', '00000000-0000-0000-0000-00000338c009'), ('trade', '00000000-0000-0000-0000-00000338c015');
INSERT INTO public.gc_company_vetting_forms (company_id, license) VALUES ('00000000-0000-0000-0000-00000338c010', 'ZZ-1');
UPDATE public.gc_companies SET portal_opened_on = DATE '2026-11-21' WHERE id IN ('00000000-0000-0000-0000-00000338c011', '00000000-0000-0000-0000-00000338c015');
INSERT INTO public.gc_rfis (project_id, number, question, package_id, asked_by_company_id, asked_on) VALUES ('00000000-0000-0000-0000-00000338a001', 1, 'Where does the lot drain?', '00000000-0000-0000-0000-00000338b001', '00000000-0000-0000-0000-00000338c012', current_date);

SELECT gbh.same('the hold is nobody''s to call, the list is the signed-in role''s, and neither is anon''s',
  has_function_privilege('authenticated', 'public.gc_bench_company_hold(uuid)', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.gc_bench_company_hold(uuid)', 'EXECUTE')::text
  || ' / ' || has_function_privilege('authenticated', 'public.gc_bench_holds()', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.gc_bench_holds()', 'EXECUTE')::text,
  'false false / true false');
SELECT gbh.same('all three run as their one owner',
  (SELECT count(DISTINCT p.proowner)::text || ' ' || bool_and(p.prosecdef)::text FROM pg_proc p WHERE p.oid IN ('public.gc_bench_company_hold(uuid)'::regprocedure, 'public.gc_bench_holds()'::regprocedure, 'public.gc_remove_bench_company(uuid)'::regprocedure)), '1 true');

SET LOCAL ROLE authenticated;

-- ── the list's read, as the office ───────────────────────────────────────────────────────────────
SELECT gbh.as_user('00000000-0000-0000-0000-00000338d001');

SELECT gbh.same('a dev reads every company''s hold, the first piece of history in the function''s order, and none for the two with no history',
  gbh.list(),
  E'ZZ Test Hold A Company Paper: papers went to them or came in\nZZ Test Hold A Contact: a contact is logged on them\nZZ Test Hold A Form: they sent us their form\nZZ Test Hold A Paper Sent: papers went to them or came in\nZZ Test Hold A Portal File: they sent us a file from their portal\nZZ Test Hold A Promise: they gave us a promise\nZZ Test Hold A Thread: they have a Messages thread\nZZ Test Hold A Work Order: they hold a work order with us\nZZ Test Hold An Ask: they were asked to quote\nZZ Test Hold An Email: we emailed them\nZZ Test Hold An Opened Portal: they opened their portal\nZZ Test Hold An Rfi: they have a record on a job\nZZ Test Hold Everything: they were asked to quote\nZZ Test Hold None: -\nZZ Test Hold None Too: -');
SELECT gbh.as_user('00000000-0000-0000-0000-00000338d002');
SELECT gbh.same('an assistant reads the same list, word for word', gbh.list(),
  E'ZZ Test Hold A Company Paper: papers went to them or came in\nZZ Test Hold A Contact: a contact is logged on them\nZZ Test Hold A Form: they sent us their form\nZZ Test Hold A Paper Sent: papers went to them or came in\nZZ Test Hold A Portal File: they sent us a file from their portal\nZZ Test Hold A Promise: they gave us a promise\nZZ Test Hold A Thread: they have a Messages thread\nZZ Test Hold A Work Order: they hold a work order with us\nZZ Test Hold An Ask: they were asked to quote\nZZ Test Hold An Email: we emailed them\nZZ Test Hold An Opened Portal: they opened their portal\nZZ Test Hold An Rfi: they have a record on a job\nZZ Test Hold Everything: they were asked to quote\nZZ Test Hold None: -\nZZ Test Hold None Too: -');
SELECT gbh.same('the hold itself is refused to a signed-in caller',
  gbh.answer($q$SELECT public.gc_bench_company_hold('00000000-0000-0000-0000-00000338c008')$q$), '42501 permission denied for function gc_bench_company_hold');

-- ── the remove refuses the same companies, in the same words ─────────────────────────────────────
SELECT gbh.as_user('00000000-0000-0000-0000-00000338d001');
SELECT gbh.same('a work order holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c001')$q$), 'P0001 ZZ Test Hold A Work Order stays on the bench, since they hold a work order with us.');
SELECT gbh.same('an ask holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c002')$q$), 'P0001 ZZ Test Hold An Ask stays on the bench, since they were asked to quote.');
SELECT gbh.same('a contact holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c003')$q$), 'P0001 ZZ Test Hold A Contact stays on the bench, since a contact is logged on them.');
SELECT gbh.same('a promise holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c004')$q$), 'P0001 ZZ Test Hold A Promise stays on the bench, since they gave us a promise.');
SELECT gbh.same('a paper sent holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c005')$q$), 'P0001 ZZ Test Hold A Paper Sent stays on the bench, since papers went to them or came in.');
SELECT gbh.same('a company paper holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c006')$q$), 'P0001 ZZ Test Hold A Company Paper stays on the bench, since papers went to them or came in.');
SELECT gbh.same('a portal file holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c007')$q$), 'P0001 ZZ Test Hold A Portal File stays on the bench, since they sent us a file from their portal.');
SELECT gbh.same('an email holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c008')$q$), 'P0001 ZZ Test Hold An Email stays on the bench, since we emailed them.');
SELECT gbh.same('a thread holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c009')$q$), 'P0001 ZZ Test Hold A Thread stays on the bench, since they have a Messages thread.');
SELECT gbh.same('a form holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c010')$q$), 'P0001 ZZ Test Hold A Form stays on the bench, since they sent us their form.');
SELECT gbh.same('an opened portal holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c011')$q$), 'P0001 ZZ Test Hold An Opened Portal stays on the bench, since they opened their portal.');
SELECT gbh.same('an RFI holds it at the press too', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c012')$q$), 'P0001 ZZ Test Hold An Rfi stays on the bench, since they have a record on a job.');
SELECT gbh.same('the company with every kind is refused for the first the list named', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c015')$q$), 'P0001 ZZ Test Hold Everything stays on the bench, since they were asked to quote.');
SELECT gbh.same('for every bed company the list''s word and the press''s answer agree: a hold refuses, none removes',
  (SELECT count(*)::text || ' of ' || count(*) FILTER (WHERE (h.hold IS NOT NULL) = (gbh.answer(format('SELECT public.gc_remove_bench_company(%L)', h.company_id)) LIKE 'P0001 % stays on the bench, since ' || COALESCE(h.hold, '<none>') || '.'))::text
     FROM public.gc_bench_holds() h JOIN public.gc_companies c ON c.id = h.company_id WHERE c.name LIKE 'ZZ Test Hold %'),
  '15 of 15');
RESET ROLE;
SELECT gbh.same('the two with no history left the bench, and every held one stands', gbh.on_bench('00000000-0000-0000-0000-00000338c013') || ' ' || gbh.on_bench('00000000-0000-0000-0000-00000338c014') || ' / ' || (SELECT count(*)::text FROM public.gc_companies WHERE name LIKE 'ZZ Test Hold %'), 'false false / 13');
SET LOCAL ROLE authenticated;

-- ── who reads the list ───────────────────────────────────────────────────────────────────────────
SELECT gbh.as_user('00000000-0000-0000-0000-00000338d003');
SELECT gbh.same('a training account reads the list, as it reads the bench', (gbh.rows()::int >= 13)::text, 'true');
SELECT gbh.same('and is still refused the remove', gbh.answer($q$SELECT public.gc_remove_bench_company('00000000-0000-0000-0000-00000338c008')$q$), '42501 A training account cannot remove a company from the bench.');
SELECT gbh.as_user('00000000-0000-0000-0000-00000338d004');
SELECT gbh.same('a helper reads no row', gbh.rows(), '0');
SELECT gbh.as_user('00000000-0000-0000-0000-00000338d005');
SELECT gbh.same('a digital twin reads no row, though its role is the office''s', gbh.rows(), '0');
SELECT gbh.as_user('00000000-0000-0000-0000-00000338d006');
SELECT gbh.same('an archived caller reads no row', gbh.rows(), '0');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'anon', true);
SET LOCAL ROLE anon;
SELECT gbh.same('with no sign-in the list is not callable', gbh.answer($q$SELECT count(*) FROM public.gc_bench_holds()$q$), '42501 permission denied for function gc_bench_holds');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_bench_hold PASSED'; END $$;
ROLLBACK;
