-- The papers each customer was sent, for the office's read-back (Messages cut 8, migration *_customer_portal_papers):
-- an assistant reads every paper as its non-money half, with whether it was answered and the customer's first outside
-- open; a staff look never counts; another customer and a draft never show; anyone outside the office reads nothing and
-- nobody signed out calls it; and the read's columns hold no money and no token. The fixture is made as postgres;
-- everything rolls back. Raises on the first failed assertion; ends with "customer_portal_papers PASSED". See
-- scripts/pgtest-customer-portal-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000007a1', 'dev@papers.test'),
  ('00000000-0000-0000-0000-0000000007a2', 'assistant@papers.test'),
  ('00000000-0000-0000-0000-0000000007a3', 'super@papers.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000007a1', 'dev@papers.test', 'Papers Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000007a2', 'assistant@papers.test', 'Papers Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000007a3', 'super@papers.test', 'Papers Super', 'superintendent', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A customer with one GC job, and another customer with one of their own.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000007c1', 'Papers Owner', '00000000-0000-0000-0000-0000000007a1'),
  ('00000000-0000-0000-0000-0000000007c2', 'Papers Other', '00000000-0000-0000-0000-0000000007a1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000007b1', 'Papers Clinic', '00000000-0000-0000-0000-0000000007c1'),
  ('00000000-0000-0000-0000-0000000007b2', 'Papers Office', '00000000-0000-0000-0000-0000000007c2');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000007b1', 'building', DATE '2026-09-14'),
  ('00000000-0000-0000-0000-0000000007b2', 'building', DATE '2026-09-14');

-- Our contract sent twice on the clinic (the second, newer one signed), and once to the other customer.
INSERT INTO public.gc_owner_contract_sends (id, project_id, sent_on, sign_by, worth, file_path, file_name, file_sha256, created_at) VALUES
  ('00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007b1', DATE '2026-09-01', DATE '2026-09-10', '{"trade": 400000}', 'c/1.pdf', 'Contract.pdf', repeat('a', 64), TIMESTAMPTZ '2026-09-01 15:00Z'),
  ('00000000-0000-0000-0000-0000000007d9', '00000000-0000-0000-0000-0000000007b2', DATE '2026-09-02', DATE '2026-09-12', '{"trade": 90000}', 'c/9.pdf', 'Contract.pdf', repeat('c', 64), TIMESTAMPTZ '2026-09-02 15:00Z');
INSERT INTO public.gc_owner_contract_sends (id, project_id, sent_on, sign_by, worth, file_path, file_name, file_sha256, created_at, signed_on, signer_printed_name, signer_consented_at) VALUES
  ('00000000-0000-0000-0000-0000000007d2', '00000000-0000-0000-0000-0000000007b1', DATE '2026-09-15', DATE '2026-09-22', '{"trade": 412000}', 'c/2.pdf', 'Contract.pdf', repeat('b', 64), TIMESTAMPTZ '2026-09-15 15:00Z',
   DATE '2026-09-19', 'Papers Owner', TIMESTAMPTZ '2026-09-19 13:00Z');
-- A change order still a draft, one sent and waiting, one signed; and two pay applications.
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, price, cost, status, sent_on, answered_on, answered_how) VALUES
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007b1', 1, 'Exam 2 cabinets', 'owner', 6300, 5000, 'signed', DATE '2026-09-25', DATE '2026-09-28', 'portal'),
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-0000000007b1', 2, 'A sink in exam 3', 'owner', 2150, 1700, 'sent', DATE '2026-09-30', NULL, NULL);
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, price, cost) VALUES
  ('00000000-0000-0000-0000-0000000007e3', '00000000-0000-0000-0000-0000000007b1', 3, 'A draft nobody sent', 'owner', 900, 700);
INSERT INTO public.gc_owner_pay_apps (id, project_id, number, period_to, sent_on, retainage_pct, retainage, work_to_date, due) VALUES
  ('00000000-0000-0000-0000-0000000007f1', '00000000-0000-0000-0000-0000000007b1', 1, DATE '2026-09-30', DATE '2026-10-01', 10, 7000, 70000, 63000),
  ('00000000-0000-0000-0000-0000000007f2', '00000000-0000-0000-0000-0000000007b1', 2, DATE '2026-10-31', DATE '2026-11-01', 10, 13000, 130000, 54000);
-- The customer's opens on their page: change order 2 twice, the contract by a staff look only, pay application 1 once.
INSERT INTO public.public_page_views (surface, entity_id, via, viewer, occurred_at, paper_kind, paper_id) VALUES
  ('portal_paper', '00000000-0000-0000-0000-0000000007c1', 'token', 'outside', TIMESTAMPTZ '2026-10-01 21:41Z', 'change_order', '00000000-0000-0000-0000-0000000007e2'),
  ('portal_paper', '00000000-0000-0000-0000-0000000007c1', 'token', NULL, TIMESTAMPTZ '2026-10-02 08:00Z', 'change_order', '00000000-0000-0000-0000-0000000007e2'),
  ('portal_paper', '00000000-0000-0000-0000-0000000007c1', 'token', 'staff', TIMESTAMPTZ '2026-09-20 15:00Z', 'contract', '00000000-0000-0000-0000-0000000007d2'),
  ('portal_paper', '00000000-0000-0000-0000-0000000007c1', 'token', 'outside', TIMESTAMPTZ '2026-10-03 16:00Z', 'pay_app', '00000000-0000-0000-0000-0000000007f1');

CREATE SCHEMA cpp;
CREATE FUNCTION cpp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION cpp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION cpp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION cpp.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
GRANT USAGE ON SCHEMA cpp TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cpp TO anon, authenticated;

-- 0 · Nobody signed out calls it.
SET LOCAL ROLE anon;
SELECT cpp.refused('no sign-in reads no papers', $q$SELECT count(*) FROM public.customer_portal_papers(ARRAY['00000000-0000-0000-0000-0000000007c1'::uuid])$q$,
  'permission denied for function customer_portal_papers');
RESET ROLE;

-- 1 · An assistant, off the money team, reads every paper sent to the customer as its non-money half.
SELECT cpp.as_user('00000000-0000-0000-0000-0000000007a2');
SET LOCAL ROLE authenticated;
SELECT cpp.same('the assistant reads the contract''s newest send, the change orders that went and the pay applications',
  (SELECT string_agg(concat_ws('|', job, paper_kind, coalesce(number::text, '-'), coalesce(description, '-'), sent_on, answered, coalesce(first_opened_at::text, '-')), E'\n')
   FROM public.customer_portal_papers(ARRAY['00000000-0000-0000-0000-0000000007c1'::uuid])),
  concat_ws(E'\n',
    'Papers Clinic|change_order|1|Exam 2 cabinets|2026-09-25|t|-',
    'Papers Clinic|change_order|2|A sink in exam 3|2026-09-30|f|2026-10-01 21:41:00+00',
    'Papers Clinic|contract|-|-|2026-09-15|t|-',
    'Papers Clinic|pay_app|1|-|2026-10-01|f|2026-10-03 16:00:00+00',
    'Papers Clinic|pay_app|2|-|2026-11-01|f|-'));
SELECT cpp.same('the paper ids are the papers'' own',
  (SELECT string_agg(paper_id::text, ',' ORDER BY paper_kind, number NULLS FIRST)
   FROM public.customer_portal_papers(ARRAY['00000000-0000-0000-0000-0000000007c1'::uuid])),
  '00000000-0000-0000-0000-0000000007e1,00000000-0000-0000-0000-0000000007e2,00000000-0000-0000-0000-0000000007d2,00000000-0000-0000-0000-0000000007f1,00000000-0000-0000-0000-0000000007f2');
SELECT cpp.same('the other customer''s contract waits, before anyone marks it',
  (SELECT count(*)::text FROM public.customer_portal_papers(ARRAY['00000000-0000-0000-0000-0000000007c2'::uuid]) WHERE paper_kind = 'contract' AND NOT answered), '1');
RESET ROLE;
-- The office marks the other customer's contract signed (as the service role writes it: nobody signed in).
SELECT cpp.signed_out();
UPDATE public.gc_projects SET owner_contract_signed_on = DATE '2026-09-20' WHERE project_id = '00000000-0000-0000-0000-0000000007b2';
SELECT cpp.as_user('00000000-0000-0000-0000-0000000007a2');
SET LOCAL ROLE authenticated;
SELECT cpp.same('the other customer''s contract, marked signed at the office, reads answered',
  (SELECT string_agg(concat_ws('|', job, paper_kind, answered), ',') FROM public.customer_portal_papers(ARRAY['00000000-0000-0000-0000-0000000007c2'::uuid])),
  'Papers Office|contract|t');
SELECT cpp.same('two customers read in one batch, each with its own',
  (SELECT string_agg(DISTINCT customer_id::text, ',') FROM public.customer_portal_papers(ARRAY['00000000-0000-0000-0000-0000000007c1'::uuid, '00000000-0000-0000-0000-0000000007c2'::uuid])),
  '00000000-0000-0000-0000-0000000007c1,00000000-0000-0000-0000-0000000007c2');
RESET ROLE;

-- 2 · Outside the office, nothing.
SELECT cpp.as_user('00000000-0000-0000-0000-0000000007a3');
SET LOCAL ROLE authenticated;
SELECT cpp.same('a superintendent reads no papers', (SELECT count(*)::text FROM public.customer_portal_papers(ARRAY['00000000-0000-0000-0000-0000000007c1'::uuid])), '0');
RESET ROLE;

-- 3 · The read's columns hold no money and no token: exactly these ten.
SELECT cpp.same('the columns, and no cost, price, worth, total, amount, due or token among them',
  (SELECT string_agg(p.parameter_name, ',' ORDER BY p.ordinal_position)
   FROM information_schema.parameters p
   JOIN information_schema.routines r ON r.specific_name = p.specific_name
   WHERE r.routine_schema = 'public' AND r.routine_name = 'customer_portal_papers' AND p.parameter_mode = 'OUT'),
  'customer_id,project_id,job,paper_kind,paper_id,number,description,sent_on,answered,first_opened_at');
SELECT cpp.same('no output column names money or a token',
  (SELECT count(*)::text
   FROM information_schema.parameters p
   JOIN information_schema.routines r ON r.specific_name = p.specific_name
   WHERE r.routine_schema = 'public' AND r.routine_name = 'customer_portal_papers' AND p.parameter_mode = 'OUT'
     AND p.parameter_name ~ '(cost|price|worth|total|amount|due|retainage|token|file)'),
  '0');

DO $$ BEGIN RAISE NOTICE 'customer_portal_papers PASSED'; END $$;
ROLLBACK;
