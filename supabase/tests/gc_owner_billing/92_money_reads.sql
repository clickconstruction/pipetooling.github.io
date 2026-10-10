-- The money team reads the trades' money (GC mode, Owner Billing's O9): a FOR SELECT policy for gc_money_team() on
-- the seven tables Money and Bill the customer read a trade's work from (gc_sows, gc_sow_lines, gc_draws,
-- gc_draw_lines, gc_sow_line_reports, gc_change_order_trade_sends, gc_back_charges), each table's dev policy kept. The
-- controller, a leader, a leader in training mode and a controller who is a digital twin read every row a dev reads;
-- none of them writes one, and the draws' presses still refuse the controller while a dev's go through. An estimator
-- and an assistant read none. The fixture is made as postgres, the shape gc_building/60_draws.sql uses; the reads and
-- writes run through RLS; everything runs inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "gc_owner_billing_money_reads PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against
-- prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ad1', 'dev@moneyreads.test'),
  ('00000000-0000-0000-0000-000000000ad2', 'controller@moneyreads.test'),
  ('00000000-0000-0000-0000-000000000ad3', 'master@moneyreads.test'),
  ('00000000-0000-0000-0000-000000000ad4', 'estimator@moneyreads.test'),
  ('00000000-0000-0000-0000-000000000ad5', 'assistant@moneyreads.test'),
  ('00000000-0000-0000-0000-000000000ad6', 'trainee@moneyreads.test'),
  ('00000000-0000-0000-0000-000000000ad7', 'twin@moneyreads.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000ad1', 'dev@moneyreads.test', 'Reads Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000ad2', 'controller@moneyreads.test', 'Reads Controller', 'controller'),
  ('00000000-0000-0000-0000-000000000ad3', 'master@moneyreads.test', 'Reads Master', 'master_technician'),
  ('00000000-0000-0000-0000-000000000ad4', 'estimator@moneyreads.test', 'Reads Estimator', 'estimator'),
  ('00000000-0000-0000-0000-000000000ad5', 'assistant@moneyreads.test', 'Reads Assistant', 'assistant'),
  ('00000000-0000-0000-0000-000000000ad6', 'trainee@moneyreads.test', 'Reads Trainee', 'master_technician'),
  ('00000000-0000-0000-0000-000000000ad7', 'twin@moneyreads.test', 'Reads Twin', 'controller')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-000000000ad6';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-000000000ad7';

-- A GC job being built: Concrete awarded to Ridgeway with a signed statement of work at 10% retainage (Footings
-- $12,000 and Slab $18,000), Steel awarded to Halverson with its statement of work drafted, and Paint awarded to
-- Halverson with nothing drafted yet. Two change orders the customer signed
-- on Concrete: one sent to Ridgeway, one not yet. Ridgeway's reports, its draw 1 approved with a $500 back-charge taken
-- off it, and its draw 2 waiting on us.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-000000000ac1', 'Money Reads Owner', '00000000-0000-0000-0000-000000000ad1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-000000000aa1', 'Money reads test', '00000000-0000-0000-0000-000000000ac1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES ('00000000-0000-0000-0000-000000000aa1', 'building', public.app_today() - 40);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-000000000ae1', 'Ridgeway Concrete', ARRAY['Concrete']),
  ('00000000-0000-0000-0000-000000000ae2', 'Halverson Steel', ARRAY['Steel']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-000000000ab1', '00000000-0000-0000-0000-000000000aa1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-000000000ab2', '00000000-0000-0000-0000-000000000aa1', 'Steel', 1, false),
  ('00000000-0000-0000-0000-000000000ab3', '00000000-0000-0000-0000-000000000aa1', 'Paint', 2, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-000000000af1', '00000000-0000-0000-0000-000000000ab1', '00000000-0000-0000-0000-000000000ae1'),
  ('00000000-0000-0000-0000-000000000af2', '00000000-0000-0000-0000-000000000ab2', '00000000-0000-0000-0000-000000000ae2'),
  ('00000000-0000-0000-0000-000000000af3', '00000000-0000-0000-0000-000000000ab3', '00000000-0000-0000-0000-000000000ae2');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-000000000af1', awarded_on = public.app_today() - 35 WHERE id = '00000000-0000-0000-0000-000000000ab1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-000000000af2', awarded_on = public.app_today() - 35 WHERE id = '00000000-0000-0000-0000-000000000ab2';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-000000000af3', awarded_on = public.app_today() - 5 WHERE id = '00000000-0000-0000-0000-000000000ab3';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-000000000ab1', 'Footings', 0),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-000000000ab1', 'Slab', 1),
  ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-000000000ab2', 'Frame', 0);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-000000000ab1', '00000000-0000-0000-0000-000000000af1', '00000000-0000-0000-0000-000000000ae1', 'signed', 30000, 10, public.app_today() - 32, public.app_today() - 30),
  ('00000000-0000-0000-0000-00000000a102', '00000000-0000-0000-0000-000000000ab2', '00000000-0000-0000-0000-000000000af2', '00000000-0000-0000-0000-000000000ae2', 'draft', 5000, 10, NULL, NULL);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-00000000a201', '00000000-0000-0000-0000-00000000a101', 0, 'Footings', 12000, '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000a202', '00000000-0000-0000-0000-00000000a101', 1, 'Slab', 18000, '00000000-0000-0000-0000-00000000a002'),
  ('00000000-0000-0000-0000-00000000a203', '00000000-0000-0000-0000-00000000a102', 0, 'Frame', 5000, '00000000-0000-0000-0000-00000000a003');
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price, status, sent_on, answered_on, answered_how) VALUES
  ('00000000-0000-0000-0000-00000000a301', '00000000-0000-0000-0000-000000000aa1', 1, 'Thicker slab at grid C', 'plans', '00000000-0000-0000-0000-000000000ab1', 500, 550, 'signed', public.app_today() - 6, public.app_today() - 4, 'office'),
  ('00000000-0000-0000-0000-00000000a302', '00000000-0000-0000-0000-000000000aa1', 2, 'Add a sleeve', 'field', '00000000-0000-0000-0000-000000000ab1', 300, 330, 'signed', public.app_today() - 3, public.app_today() - 2, 'office');
INSERT INTO public.gc_change_order_trade_sends (change_order_id, sow_id, sent_on, sent_by) VALUES
  ('00000000-0000-0000-0000-00000000a301', '00000000-0000-0000-0000-00000000a101', public.app_today() - 3, '00000000-0000-0000-0000-000000000ad1');
INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id) VALUES
  ('00000000-0000-0000-0000-00000000a201', 50, public.app_today() - 12, '00000000-0000-0000-0000-000000000ae1'),
  ('00000000-0000-0000-0000-00000000a202', 20, public.app_today() - 12, '00000000-0000-0000-0000-000000000ae1');
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, approved_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-00000000a501', '00000000-0000-0000-0000-00000000a101', 1, public.app_today() - 12, 'approved', 9600, 960, 8640, public.app_today() - 10, public.app_today() - 12, 'Pat Ridgeway', public.app_today() - 12),
  ('00000000-0000-0000-0000-00000000a502', '00000000-0000-0000-0000-00000000a101', 2, public.app_today() - 1, 'requested', 1200, 120, 1080, NULL, public.app_today() - 1, 'Pat Ridgeway', public.app_today() - 1);
INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored) VALUES
  ('00000000-0000-0000-0000-00000000a501', '00000000-0000-0000-0000-00000000a201', 50, 0),
  ('00000000-0000-0000-0000-00000000a501', '00000000-0000-0000-0000-00000000a202', 20, 0),
  ('00000000-0000-0000-0000-00000000a502', '00000000-0000-0000-0000-00000000a201', 60, 0);
INSERT INTO public.gc_back_charges (id, project_id, package_id, company_id, sow_id, amount, reason, sent_on, status, answered_on, taken_draw_id, taken_on) VALUES
  ('00000000-0000-0000-0000-00000000a401', '00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-000000000ab1', '00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-00000000a101', 500, 'Washout on the street', public.app_today() - 14, 'agreed', public.app_today() - 13, '00000000-0000-0000-0000-00000000a501', public.app_today() - 10);

CREATE SCHEMA gmr;
CREATE FUNCTION gmr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gmr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The seven tables with the key their rows are ordered by: gc_draw_lines and gc_change_order_trade_sends have no id.
CREATE FUNCTION gmr.tables() RETURNS TABLE (t text, k text) LANGUAGE sql IMMUTABLE AS $$
  VALUES ('gc_sows', 'id'), ('gc_sow_lines', 'id'), ('gc_draws', 'id'), ('gc_draw_lines', 'draw_id, sow_line_id'),
         ('gc_sow_line_reports', 'id'), ('gc_change_order_trade_sends', 'change_order_id'), ('gc_back_charges', 'id') $$;
-- What the caller reads of the seven: each table's row count and an md5 of its rows in key order.
CREATE FUNCTION gmr.reads() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r record;
  v text;
  out text[] := '{}';
BEGIN
  FOR r IN SELECT * FROM gmr.tables() LOOP
    EXECUTE format('SELECT count(*) || '' '' || coalesce(md5(string_agg(row_to_json(x)::text, ''|'' ORDER BY %s)), ''-'') FROM public.%I x', r.k, r.t) INTO v;
    out := out || (r.t || ' ' || v);
  END LOOP;
  RETURN array_to_string(out, E'\n');
END $$;
-- Just the counts.
CREATE FUNCTION gmr.counts() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r record;
  n integer;
  out text[] := '{}';
BEGIN
  FOR r IN SELECT * FROM gmr.tables() LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.t) INTO n;
    out := out || (r.t || ' ' || n);
  END LOOP;
  RETURN array_to_string(out, ', ');
END $$;
-- A write as the caller, undone whatever it did: the rows it reached, or 'refused' when RLS or a grant stopped it
-- (42501), or the other error in its words.
CREATE FUNCTION gmr.try(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  n integer;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION 'gmr_undo %', n;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'gmr_undo %' THEN RETURN substr(SQLERRM, 10); END IF;
    IF SQLSTATE = '42501' THEN RETURN 'refused'; END IF;
    RETURN 'error: ' || SQLERRM;
  END;
END $$;
-- One insert, one update and one delete on each of the seven, each one a dev's policy lets through (an update and a
-- delete that reach one row). gc_sow_line_reports takes no update or delete from anyone signed in, nor
-- gc_back_charges a delete: those read 'refused' for a dev too.
CREATE FUNCTION gmr.write_results() RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE
  stmts text[] := ARRAY[
    $q$INSERT INTO public.gc_sows (package_id, invite_id, company_id, status, price, retainage_pct) VALUES ('00000000-0000-0000-0000-000000000ab3', '00000000-0000-0000-0000-000000000af3', '00000000-0000-0000-0000-000000000ae2', 'draft', 2000, 10)$q$,
    $q$UPDATE public.gc_sows SET price = price WHERE id = '00000000-0000-0000-0000-00000000a101'$q$,
    $q$DELETE FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-00000000a102'$q$,
    $q$INSERT INTO public.gc_sow_lines (sow_id, position, label, amount, change_order_id) VALUES ('00000000-0000-0000-0000-00000000a101', 2, 'Add a sleeve', 300, '00000000-0000-0000-0000-00000000a302')$q$,
    $q$UPDATE public.gc_sow_lines SET label = label WHERE id = '00000000-0000-0000-0000-00000000a201'$q$,
    $q$DELETE FROM public.gc_sow_lines WHERE id = '00000000-0000-0000-0000-00000000a203'$q$,
    $q$INSERT INTO public.gc_draws (sow_id, number, requested_on, status, gross, retainage, net, approved_on, paid_on, period_to, signed_by, signed_on) VALUES ('00000000-0000-0000-0000-00000000a101', 3, public.app_today(), 'paid', 100, 10, 90, public.app_today(), public.app_today(), public.app_today(), 'Pat Ridgeway', public.app_today())$q$,
    $q$UPDATE public.gc_draws SET signed_title = signed_title WHERE id = '00000000-0000-0000-0000-00000000a502'$q$,
    $q$DELETE FROM public.gc_draws WHERE id = '00000000-0000-0000-0000-00000000a502'$q$,
    $q$INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored) VALUES ('00000000-0000-0000-0000-00000000a502', '00000000-0000-0000-0000-00000000a202', 30, 0)$q$,
    $q$UPDATE public.gc_draw_lines SET stored = stored WHERE draw_id = '00000000-0000-0000-0000-00000000a502' AND sow_line_id = '00000000-0000-0000-0000-00000000a201'$q$,
    $q$DELETE FROM public.gc_draw_lines WHERE draw_id = '00000000-0000-0000-0000-00000000a502' AND sow_line_id = '00000000-0000-0000-0000-00000000a201'$q$,
    $q$INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id) VALUES ('00000000-0000-0000-0000-00000000a201', 70, public.app_today(), '00000000-0000-0000-0000-000000000ae1')$q$,
    $q$UPDATE public.gc_sow_line_reports SET pct = pct WHERE sow_line_id = '00000000-0000-0000-0000-00000000a201'$q$,
    $q$DELETE FROM public.gc_sow_line_reports WHERE sow_line_id = '00000000-0000-0000-0000-00000000a202'$q$,
    $q$INSERT INTO public.gc_change_order_trade_sends (change_order_id, sow_id, sent_on) VALUES ('00000000-0000-0000-0000-00000000a302', '00000000-0000-0000-0000-00000000a101', public.app_today())$q$,
    $q$UPDATE public.gc_change_order_trade_sends SET sent_on = sent_on WHERE change_order_id = '00000000-0000-0000-0000-00000000a301'$q$,
    $q$DELETE FROM public.gc_change_order_trade_sends WHERE change_order_id = '00000000-0000-0000-0000-00000000a301'$q$,
    $q$INSERT INTO public.gc_back_charges (project_id, package_id, company_id, sow_id, amount, reason, sent_on) VALUES ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-000000000ab1', '00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-00000000a101', 100, 'Dumpster', public.app_today())$q$,
    $q$UPDATE public.gc_back_charges SET taken_on = taken_on WHERE id = '00000000-0000-0000-0000-00000000a401'$q$,
    $q$DELETE FROM public.gc_back_charges WHERE id = '00000000-0000-0000-0000-00000000a401'$q$
  ];
  s text;
  out text[] := '{}';
BEGIN
  FOREACH s IN ARRAY stmts LOOP
    out := out || gmr.try(s);
  END LOOP;
  RETURN out;
END $$;
-- The writes' results in a line, and how many of them reached a row.
CREATE FUNCTION gmr.writes() RETURNS text LANGUAGE sql AS $$ SELECT array_to_string(gmr.write_results(), ' ') $$;
CREATE FUNCTION gmr.wrote() RETURNS integer LANGUAGE sql AS $$ SELECT count(*)::integer FROM unnest(gmr.write_results()) r WHERE r ~ '^[1-9][0-9]*$' $$;
-- A press as the caller, undone: what it returned, or its refusal's words.
CREATE FUNCTION gmr.press(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v text;
BEGIN
  BEGIN
    EXECUTE stmt INTO v;
    RAISE EXCEPTION 'gmr_undo %', v;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'gmr_undo %' THEN RETURN 'went: ' || substr(SQLERRM, 10); END IF;
    RETURN 'refused: ' || SQLERRM;
  END;
END $$;
GRANT USAGE ON SCHEMA gmr TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gmr TO authenticated;

-- 0 · The migration: each table's own read policy for the money team, SELECT only, beside its dev policy unchanged.
SELECT gmr.same('each of the seven: its dev policy for every verb, and the money team''s for reading',
  (SELECT string_agg(t.t || ': ' || (
     SELECT string_agg(p.policyname || ' ' || p.cmd || ' ' || array_to_string(p.roles, ',') || ' '
                       || CASE WHEN p.qual LIKE '%gc_money_team()%' THEN 'money' WHEN p.qual LIKE '%is_dev()%' THEN 'dev' ELSE p.qual END, '; ' ORDER BY p.policyname)
     FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.t AND p.permissive = 'PERMISSIVE'), E'\n' ORDER BY t.t)
   FROM gmr.tables() t),
  'gc_back_charges: gc_back_charges_dev ALL authenticated dev; gc_back_charges_money_read SELECT authenticated money
gc_change_order_trade_sends: gc_change_order_trade_sends_dev ALL authenticated dev; gc_change_order_trade_sends_money_read SELECT authenticated money
gc_draw_lines: gc_draw_lines_dev ALL authenticated dev; gc_draw_lines_money_read SELECT authenticated money
gc_draws: gc_draws_dev ALL authenticated dev; gc_draws_money_read SELECT authenticated money
gc_sow_line_reports: gc_sow_line_reports_dev ALL authenticated dev; gc_sow_line_reports_money_read SELECT authenticated money
gc_sow_lines: gc_sow_lines_dev ALL authenticated dev; gc_sow_lines_money_read SELECT authenticated money
gc_sows: gc_sows_dev ALL authenticated dev; gc_sows_money_read SELECT authenticated money');

-- 1 · A dev reads the fixture, and every write it tries reaches its row (undone).
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad1');
SET LOCAL ROLE authenticated;
SELECT gmr.same('a dev reads every row of the fixture', gmr.counts(),
  'gc_sows 2, gc_sow_lines 3, gc_draws 2, gc_draw_lines 3, gc_sow_line_reports 2, gc_change_order_trade_sends 1, gc_back_charges 1');
SELECT set_config('gmr.dev_reads', gmr.reads(), true);
SELECT gmr.same('a dev''s writes go through: an insert, an update and a delete on each, where its grants allow',
  gmr.writes(), '1 1 1 1 1 1 1 1 1 1 1 1 1 refused refused 1 1 1 1 1 refused');
RESET ROLE;

-- 2 · The money team reads what a dev reads, row for row: the controller, a leader, a leader in training mode, and a
-- controller who is a digital twin. The fences limit writes only.
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad2');
SET LOCAL ROLE authenticated;
SELECT gmr.same('the controller reads what a dev reads', gmr.reads(), current_setting('gmr.dev_reads'));
RESET ROLE;
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad3');
SET LOCAL ROLE authenticated;
SELECT gmr.same('a leader reads what a dev reads', gmr.reads(), current_setting('gmr.dev_reads'));
RESET ROLE;
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad6');
SET LOCAL ROLE authenticated;
SELECT gmr.same('a leader in training mode reads them too', gmr.reads(), current_setting('gmr.dev_reads'));
RESET ROLE;
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad7');
SET LOCAL ROLE authenticated;
SELECT gmr.same('a controller who is a digital twin reads them by its role', gmr.reads(), current_setting('gmr.dev_reads'));
RESET ROLE;

-- 3 · None of them writes a row: each insert is refused, each update and delete reaches none.
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad2');
SET LOCAL ROLE authenticated;
SELECT gmr.same('the controller writes none of the seven', gmr.writes(),
  'refused 0 0 refused 0 0 refused 0 0 refused 0 0 refused refused refused refused 0 0 refused 0 refused');
RESET ROLE;
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad3');
SET LOCAL ROLE authenticated;
SELECT gmr.same('nor a leader', gmr.writes(),
  'refused 0 0 refused 0 0 refused 0 0 refused 0 0 refused refused refused refused 0 0 refused 0 refused');
RESET ROLE;
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad6');
SET LOCAL ROLE authenticated;
SELECT gmr.same('nor a leader in training mode', gmr.wrote()::text, '0');
RESET ROLE;
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad7');
SET LOCAL ROLE authenticated;
SELECT gmr.same('nor the twin', gmr.wrote()::text, '0');
RESET ROLE;

-- 4 · The draws' presses stay a dev's: the controller's approval and change send are refused, a dev's approval goes.
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad2');
SET LOCAL ROLE authenticated;
SELECT gmr.same('the controller''s approval of draw 2 is refused',
  gmr.press($q$SELECT public.gc_approve_draw('00000000-0000-0000-0000-00000000a502')::text$q$), 'refused: No pay application with that id.');
SELECT gmr.same('the controller''s marking a draw paid is refused',
  gmr.press($q$SELECT public.gc_pay_draw('00000000-0000-0000-0000-00000000a501')::text$q$), 'refused: No pay application with that id.');
SELECT gmr.same('the controller''s send of a signed change to the trade is refused by the table''s policy',
  CASE WHEN gmr.press($q$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-00000000a302')::text$q$) LIKE 'refused: new row violates row-level security policy%' THEN 'refused' ELSE 'went' END, 'refused');
RESET ROLE;
SELECT gmr.same('so draw 2 still waits on us, and the second change has gone to no one',
  (SELECT status FROM public.gc_draws WHERE id = '00000000-0000-0000-0000-00000000a502') || ' '
    || (SELECT count(*) FROM public.gc_change_order_trade_sends WHERE change_order_id = '00000000-0000-0000-0000-00000000a302'),
  'requested 0');
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad1');
SET LOCAL ROLE authenticated;
SELECT gmr.same('a dev''s approval of draw 2 goes through', gmr.press($q$SELECT public.gc_approve_draw('00000000-0000-0000-0000-00000000a502')::text$q$),
  'went: ' || public.app_today()::text);
RESET ROLE;

-- 5 · Nobody outside the money team reads them: an estimator and an assistant, both in the office team.
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad4');
SET LOCAL ROLE authenticated;
SELECT gmr.same('an estimator reads none of the seven', gmr.counts(),
  'gc_sows 0, gc_sow_lines 0, gc_draws 0, gc_draw_lines 0, gc_sow_line_reports 0, gc_change_order_trade_sends 0, gc_back_charges 0');
RESET ROLE;
SELECT gmr.as_user('00000000-0000-0000-0000-000000000ad5');
SET LOCAL ROLE authenticated;
SELECT gmr.same('nor an assistant', gmr.counts(),
  'gc_sows 0, gc_sow_lines 0, gc_draws 0, gc_draw_lines 0, gc_sow_line_reports 0, gc_change_order_trade_sends 0, gc_back_charges 0');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_money_reads PASSED'; END $$;
ROLLBACK;
