-- A change order's non-money half for the office (v2.5156, the schedule's PR 16b; Owner Billing's door, call C): the
-- view gc_change_orders_office carries twelve columns and never cost, price or pct_done; it is a security barrier; the
-- office team reads every change order through it while the table itself stays the money team's; anyone outside the
-- office reads none; nobody signed in writes through it; anon reads nothing. The fixture is made as postgres; the reads
-- run through RLS; everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends
-- with "gc_owner_billing_office_view PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@officeview.test'),
  ('00000000-0000-0000-0000-000000000bd2', 'estimator@officeview.test'),
  ('00000000-0000-0000-0000-000000000bd3', 'assistant@officeview.test'),
  ('00000000-0000-0000-0000-000000000bd4', 'super@officeview.test'),
  ('00000000-0000-0000-0000-000000000bd5', 'sub@officeview.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000bd1', 'dev@officeview.test', 'View Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000bd2', 'estimator@officeview.test', 'View Estimator', 'estimator'),
  ('00000000-0000-0000-0000-000000000bd3', 'assistant@officeview.test', 'View Assistant', 'assistant'),
  ('00000000-0000-0000-0000-000000000bd4', 'super@officeview.test', 'View Super', 'superintendent'),
  ('00000000-0000-0000-0000-000000000bd5', 'sub@officeview.test', 'View Sub', 'subcontractor')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- A GC job being built with two change orders on Concrete: a signed one with money, and a time extension of 4 days.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-000000000bc1', 'Office View Owner', '00000000-0000-0000-0000-000000000bd1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-000000000ba1', 'Office view test', '00000000-0000-0000-0000-000000000bc1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES ('00000000-0000-0000-0000-000000000ba1', 'building', public.app_today() - 40);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-000000000bb1', '00000000-0000-0000-0000-000000000ba1', 'Concrete', 0, false);
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price, status, sent_on, answered_on, answered_how, pct_done, days) VALUES
  ('00000000-0000-0000-0000-00000000b301', '00000000-0000-0000-0000-000000000ba1', 1, 'Thicker slab at grid C', 'plans', '00000000-0000-0000-0000-000000000bb1', 500, 550, 'signed', public.app_today() - 6, public.app_today() - 4, 'office', 40, 2),
  ('00000000-0000-0000-0000-00000000b302', '00000000-0000-0000-0000-000000000ba1', 2, 'Four days for the rain', 'field', NULL, 0, 0, 'sent', public.app_today() - 1, NULL, NULL, 0, 4);

CREATE SCHEMA gvt;
CREATE FUNCTION gvt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gvt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gvt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What a reader sees of the job's change orders through the view, and in the table itself.
CREATE FUNCTION gvt.seen() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(number || ':' || status || ':' || days, ' ' ORDER BY number), 'none')
  FROM public.gc_change_orders_office WHERE project_id = '00000000-0000-0000-0000-000000000ba1' $$;
CREATE FUNCTION gvt.table_rows() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-000000000ba1' $$;
GRANT USAGE ON SCHEMA gvt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gvt TO authenticated, anon;

-- 1) The view's shape: twelve columns, none of the three money ones, behind a security barrier.
SELECT gvt.same('the view carries its twelve columns', (SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office'),
  'id,project_id,number,description,reason,schedule_words,package_id,status,sent_on,answered_on,days,days_on_chart');
SELECT gvt.same('never cost, price or pct_done', (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office' AND column_name IN ('cost', 'price', 'pct_done')), '0');
SELECT gvt.same('a security barrier', (SELECT coalesce(array_to_string(reloptions, ','), '') FROM pg_class WHERE oid = 'public.gc_change_orders_office'::regclass), 'security_barrier=true');
SELECT gvt.same('authenticated may only read it', (SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office' AND grantee = 'authenticated'), 'SELECT');
SELECT gvt.same('anon may do nothing with it', (SELECT count(*)::text FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office' AND grantee IN ('anon', 'PUBLIC')), '0');

-- 2) The reads.
SET LOCAL ROLE authenticated;
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd2');
SELECT gvt.same('an estimator reads both through the view', gvt.seen(), '1:signed:2 2:sent:4');
SELECT gvt.same('and none from the money team''s table', gvt.table_rows(), '0');
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd3');
SELECT gvt.same('an assistant reads both through the view', gvt.seen(), '1:signed:2 2:sent:4');
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd1');
SELECT gvt.same('a dev reads the view and the table', gvt.seen() || ' / ' || gvt.table_rows(), '1:signed:2 2:sent:4 / 2');
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd4');
SELECT gvt.same('a superintendent outside the office reads none', gvt.seen(), 'none');
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd5');
SELECT gvt.same('a subcontractor reads none', gvt.seen(), 'none');

-- 3) Nobody signed in writes through it, not even the office team.
SELECT gvt.as_user('00000000-0000-0000-0000-000000000bd2');
SELECT gvt.refused('an estimator''s update through the view', $s$UPDATE public.gc_change_orders_office SET days = 9 WHERE number = 1$s$, 'permission denied');
SELECT gvt.refused('an estimator''s delete through the view', $s$DELETE FROM public.gc_change_orders_office WHERE number = 2$s$, 'permission denied');
SELECT gvt.refused('an estimator''s insert through the view', $s$INSERT INTO public.gc_change_orders_office (project_id, number, description, reason, status, days) VALUES ('00000000-0000-0000-0000-000000000ba1', 3, 'x', 'field', 'draft', 1)$s$, 'permission denied');
RESET ROLE;
SELECT gvt.same('the change orders are as they were', (SELECT string_agg(number || ':' || days || ':' || price, ' ' ORDER BY number) FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-000000000ba1'), '1:2:550 2:4:0');
SET LOCAL ROLE anon;
SELECT gvt.refused('anon reads nothing', $s$SELECT gvt.seen()$s$, 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_office_view PASSED'; END $$;
ROLLBACK;
