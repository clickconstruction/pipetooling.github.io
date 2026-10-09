-- The trades' money (v2.5084, the Building lane's U6a): a trade's pay application, from its portal or recorded by the
-- office when it came by email, approved, approved for less, sent back and sent again under its number, paid, its
-- unconditional waiver in; a back-charge taken off a draw; a signed change order sent to the trade and signed into a
-- line of its statement of work, a credit taken off once; a trade's report and the real days it sets. The money is
-- held to the kernels' payApplication and drawMoney: each number below is what src/lib/gc/building.ts gives for the
-- same statement of work and claims (a credit's line kept once it moves). Each press refuses in words, or the trade's
-- in keys, what the prototype's reducer refuses. A training account, a digital twin and a role outside Building's
-- dev door are refused; the trade's presses are the service role's only. Presses run through RLS, the fixture made as
-- postgres; everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, and an estimator (no policy on Building's
-- tables while they are built).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@draws.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@draws.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'twin@draws.test'),
  ('00000000-0000-0000-0000-0000000009d4', 'estimator@draws.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@draws.test', 'Draws Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@draws.test', 'Draws Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000009d3', 'twin@draws.test', 'Draws Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000009d4', 'estimator@draws.test', 'Draws Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000009d2';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000009d3';

-- Two GC jobs. A is being built: Concrete awarded to Ridgeway Concrete with a signed statement of work at 10%
-- retainage (Footings $12,000, Slab $18,000, and Walks $0, split into two parts on the schedule), Steel awarded to
-- Halverson Steel with a draft, and our own Plumbing. B is in buyout: Electrical awarded to Ridgeway, signed.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000009c1', 'Draws Test Owner', '00000000-0000-0000-0000-0000000009d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'Draws test A', '00000000-0000-0000-0000-0000000009c1'),
  ('00000000-0000-0000-0000-0000000009a2', 'Draws test B', '00000000-0000-0000-0000-0000000009c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'building', public.app_today() - 40),
  ('00000000-0000-0000-0000-0000000009a2', 'buyout', NULL);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000009e1', 'Ridgeway Concrete', ARRAY['Concrete']),
  ('00000000-0000-0000-0000-0000000009e2', 'Halverson Steel', ARRAY['Steel']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a1', 'Steel', 1, false),
  ('00000000-0000-0000-0000-0000000009b3', '00000000-0000-0000-0000-0000000009a1', 'Plumbing', 2, true),
  ('00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009a2', 'Electrical', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1'),
  ('00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009e2'),
  ('00000000-0000-0000-0000-0000000009f3', '00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009e1');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000009f1', awarded_on = public.app_today() - 35 WHERE id = '00000000-0000-0000-0000-0000000009b1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000009f2', awarded_on = public.app_today() - 35 WHERE id = '00000000-0000-0000-0000-0000000009b2';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000009f3', awarded_on = public.app_today() - 6 WHERE id = '00000000-0000-0000-0000-0000000009b4';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-000000090001', '00000000-0000-0000-0000-0000000009b1', 'Footings', 0),
  ('00000000-0000-0000-0000-000000090002', '00000000-0000-0000-0000-0000000009b1', 'Slab', 1),
  ('00000000-0000-0000-0000-000000090005', '00000000-0000-0000-0000-0000000009b1', 'Walks', 2),
  ('00000000-0000-0000-0000-000000090003', '00000000-0000-0000-0000-0000000009b2', 'Frame', 0),
  ('00000000-0000-0000-0000-000000090004', '00000000-0000-0000-0000-0000000009b4', 'Rough-in', 0);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009e1', 'signed', 30000, 10, public.app_today() - 32, public.app_today() - 30),
  ('00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-0000000009e2', 'draft', 5000, 10, NULL, NULL),
  ('00000000-0000-0000-0000-000000009103', '00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009f3', '00000000-0000-0000-0000-0000000009e1', 'signed', 8000, 10, public.app_today() - 6, public.app_today() - 5);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000009101', 0, 'Footings', 12000, '00000000-0000-0000-0000-000000090001'),
  ('00000000-0000-0000-0000-000000009202', '00000000-0000-0000-0000-000000009101', 1, 'Slab', 18000, '00000000-0000-0000-0000-000000090002'),
  ('00000000-0000-0000-0000-000000009205', '00000000-0000-0000-0000-000000009101', 2, 'Walks', 0, '00000000-0000-0000-0000-000000090005'),
  ('00000000-0000-0000-0000-000000009203', '00000000-0000-0000-0000-000000009102', 0, 'Frame', 5000, '00000000-0000-0000-0000-000000090003'),
  ('00000000-0000-0000-0000-000000009204', '00000000-0000-0000-0000-000000009103', 0, 'Rough-in', 8000, '00000000-0000-0000-0000-000000090004');
-- A's schedule, drawn as a plan write does (gc_schedule_bump's flag): Footings and Slab with no real days yet, and
-- Walks in two parts.
SELECT set_config('gc.schedule_plan_write', 'on', true);
INSERT INTO public.gc_schedules (project_id, drafted_on) VALUES ('00000000-0000-0000-0000-0000000009a1', public.app_today() - 35);
INSERT INTO public.gc_schedule_activities (id, project_id, kind, position, scope_item_id, package_id, start, finish) VALUES
  ('00000000-0000-0000-0000-000000009701', '00000000-0000-0000-0000-0000000009a1', 'line', 0, '00000000-0000-0000-0000-000000090001', '00000000-0000-0000-0000-0000000009b1', public.app_today() - 20, public.app_today() - 5),
  ('00000000-0000-0000-0000-000000009702', '00000000-0000-0000-0000-0000000009a1', 'line', 1, '00000000-0000-0000-0000-000000090002', '00000000-0000-0000-0000-0000000009b1', public.app_today() - 2, public.app_today() + 10),
  ('00000000-0000-0000-0000-000000009705', '00000000-0000-0000-0000-0000000009a1', 'line', 2, '00000000-0000-0000-0000-000000090005', '00000000-0000-0000-0000-0000000009b1', public.app_today() + 12, public.app_today() + 20);
INSERT INTO public.gc_schedule_activity_parts (activity_id, position, name, from_day, days, share) VALUES
  ('00000000-0000-0000-0000-000000009705', 0, 'North walks', 0, 4, 50),
  ('00000000-0000-0000-0000-000000009705', 1, 'South walks', 4, 4, 50);
SELECT set_config('gc.schedule_plan_write', '', true);
-- Change orders the customer signed: a $2,000 credit on Concrete, our own Plumbing's, and Steel's; and a Concrete draft.
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price, status, sent_on, answered_on, answered_how) VALUES
  ('00000000-0000-0000-0000-000000009301', '00000000-0000-0000-0000-0000000009a1', 1, 'Leave out the curb', 'owner', '00000000-0000-0000-0000-0000000009b1', -2000, -2200, 'signed', public.app_today() - 6, public.app_today() - 4, 'office'),
  ('00000000-0000-0000-0000-000000009302', '00000000-0000-0000-0000-0000000009a1', 2, 'Move the mop sink', 'field', '00000000-0000-0000-0000-0000000009b3', 1000, 1100, 'signed', public.app_today() - 6, public.app_today() - 4, 'office'),
  ('00000000-0000-0000-0000-000000009303', '00000000-0000-0000-0000-0000000009a1', 3, 'Thicker slab at grid C', 'plans', '00000000-0000-0000-0000-0000000009b1', 500, 550, 'draft', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-000000009304', '00000000-0000-0000-0000-0000000009a1', 4, 'Add a lintel', 'field', '00000000-0000-0000-0000-0000000009b2', 700, 770, 'signed', public.app_today() - 6, public.app_today() - 4, 'office');
-- Back-charges on Concrete: agreed, open and still in its days to answer, disputed, dropped, and kept for more than a
-- draw pays.
INSERT INTO public.gc_back_charges (id, project_id, package_id, company_id, sow_id, amount, reason, sent_on, status, answered_on, answer_note, settled_on, settled_note) VALUES
  ('00000000-0000-0000-0000-000000009401', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 500, 'Washout on the street', public.app_today() - 10, 'agreed', public.app_today() - 8, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-000000009402', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 300, 'Broken curb stop', public.app_today(), 'open', NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-000000009403', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 200, 'Cleanup', public.app_today() - 10, 'disputed', public.app_today() - 9, 'Not our mess', NULL, NULL),
  ('00000000-0000-0000-0000-000000009404', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 100, 'Dumpster', public.app_today() - 10, 'dropped', NULL, NULL, public.app_today() - 3, 'Our mistake'),
  ('00000000-0000-0000-0000-000000009405', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 6000, 'Finished the walks for them', public.app_today() - 20, 'kept', NULL, NULL, public.app_today() - 2, 'Photos show it');
-- What Ridgeway promised on Concrete: its pay application, and the unconditional waiver on draw 1.
INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-000000009601', '00000000-0000-0000-0000-0000000009e1', 'payApp', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', 'their first pay application', public.app_today() + 3, 'office'),
  ('00000000-0000-0000-0000-000000009602', '00000000-0000-0000-0000-0000000009e1', 'closeout', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', 'the unconditional waiver on draw 1', public.app_today() + 10, 'office');
-- An approved draw on B's Electrical, another statement of work.
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, approved_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-000000009501', '00000000-0000-0000-0000-000000009103', 1, public.app_today() - 1, 'approved', 1000, 100, 900, public.app_today() - 1, public.app_today() - 1, 'Pat Ridgeway', public.app_today() - 1);

CREATE SCHEMA gbt;
CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- A trade's refusal: its key, and the reason in plain words the key carries.
CREATE FUNCTION gbt.trade_refused(label text, stmt text, want_key text, want_detail text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF SQLERRM IS DISTINCT FROM want_key OR v_detail IS DISTINCT FROM want_detail THEN
      RAISE EXCEPTION '% was refused as % (%), not % (%)', label, SQLERRM, v_detail, want_key, want_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
END $$;
-- One line of a claim, by the kernels' id: its percent done, and stored dollars where given.
CREATE FUNCTION gbt.line(p_key uuid, p_pct numeric, p_stored numeric DEFAULT NULL) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('line', p_key, 'toPct', p_pct) || CASE WHEN p_stored IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('stored', p_stored) END $$;
-- A pay application as the window or the portal sends it.
CREATE FUNCTION gbt.app(p_lines jsonb, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('lines', p_lines, 'periodTo', public.app_today()::text, 'address', '12 Mill Rd, Boerne', 'license', 'TX-4471',
    'signedBy', ' Pat Ridgeway ', 'signedTitle', 'Owner') || extra $$;
-- The draw that stands on Concrete by its number.
CREATE FUNCTION gbt.draw(p_number integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_draws WHERE sow_id = '00000000-0000-0000-0000-000000009101' AND number = p_number AND status <> 'sent_back' $$;
-- The change order's line on Concrete, by its own id (the kernels' id for a change order's line).
CREATE FUNCTION gbt.change_line() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_sow_lines WHERE change_order_id = '00000000-0000-0000-0000-000000009301' $$;
-- What Concrete's draws read, in their order, one sent back before its resend: number, status, waiver, money, and
-- each line's percent, stored dollars (+) and the percent we see (~).
CREATE FUNCTION gbt.draws() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(
    'D' || d.number || ' ' || d.status || ' ' || d.waiver || ' ' || trim_scale(d.gross) || '/' || trim_scale(d.retainage) || '/' || trim_scale(d.net) || ' '
      || coalesce((SELECT string_agg(l.label || ':' || trim_scale(dl.to_pct) || CASE WHEN dl.stored > 0 THEN '+' || trim_scale(dl.stored) ELSE '' END
                                       || coalesce('~' || trim_scale(dl.we_see), ''), ',' ORDER BY l.position)
                   FROM public.gc_draw_lines dl JOIN public.gc_sow_lines l ON l.id = dl.sow_line_id WHERE dl.draw_id = d.id), '-'),
    E'\n' ORDER BY d.number, d.seq)
  FROM public.gc_draws d WHERE d.sow_id = '00000000-0000-0000-0000-000000009101' $$;
-- Each Concrete line's newest report.
CREATE FUNCTION gbt.reported() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(l.label || ':' || coalesce(trim_scale(r.pct)::text, '-'), ',' ORDER BY l.position)
  FROM public.gc_sow_lines l
  LEFT JOIN LATERAL (SELECT x.pct FROM public.gc_sow_line_reports x WHERE x.sow_line_id = l.id ORDER BY x.seq DESC LIMIT 1) r ON true
  WHERE l.sow_id = '00000000-0000-0000-0000-000000009101' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions themselves: invoker's rights; the office's presses and the shared helpers for signed-in callers, the
-- trade's for the service role only.
SELECT gbt.same('every function runs with the caller''s rights',
  (SELECT string_agg(DISTINCT prosecdef::text, ',') FROM pg_proc WHERE proname IN ('gc_sow_line_of', 'gc_draw_claim', 'gc_draw_money', 'gc_draw_came_in',
    'gc_approve_draw', 'gc_approve_draw_less', 'gc_send_draw_back', 'gc_pay_draw', 'gc_draw_waiver_signed', 'gc_draw_waiver_in', 'gc_take_back_charge',
    'gc_send_trade_change', 'gc_trade_sow_report', 'gc_trade_pay_app', 'gc_trade_unconditional_waiver', 'gc_trade_sign_change')),
  'false');
SELECT gbt.same('who runs each: signed out, signed in, the service role',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_draw_money(uuid, integer, jsonb)', 'public.gc_draw_came_in(uuid, jsonb)', 'public.gc_approve_draw_less(uuid, jsonb, text)',
     'public.gc_take_back_charge(uuid, uuid)', 'public.gc_trade_sow_report(uuid, uuid, uuid, numeric)', 'public.gc_trade_pay_app(uuid, uuid, jsonb)',
     'public.gc_trade_unconditional_waiver(uuid, uuid)', 'public.gc_trade_sign_change(uuid, uuid)']) f),
  'public.gc_draw_money(uuid, integer, jsonb):false/true/true,public.gc_draw_came_in(uuid, jsonb):false/true/true,public.gc_approve_draw_less(uuid, jsonb, text):false/true/true,public.gc_take_back_charge(uuid, uuid):false/true/true,public.gc_trade_sow_report(uuid, uuid, uuid, numeric):false/false/true,public.gc_trade_pay_app(uuid, uuid, jsonb):false/false/true,public.gc_trade_unconditional_waiver(uuid, uuid):false/false/true,public.gc_trade_sign_change(uuid, uuid):false/false/true');
SELECT gbt.same('a change order''s line may be a credit, and a back-charge''s draw is a draw',
  (SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint
   WHERE conname IN ('gc_sow_lines_amount_not_negative', 'gc_sow_lines_credit_by_change_order', 'gc_back_charges_taken_draw_fkey')),
  'gc_back_charges_taken_draw_fkey,gc_sow_lines_credit_by_change_order');

-- 1. The trade's first pay application from its portal, as the service role: Footings to 50%, Slab to 10% with
-- $2,500.40 of materials stored, counted in whole dollars. The kernel: $10,300 less $1,030 held, $9,270.
SET LOCAL ROLE service_role;
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 50), gbt.line('00000000-0000-0000-0000-000000090002', 10, 2500.4))));
SELECT gbt.trade_refused('a trade that does not exist', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009ff', gbt.app('[]'))$s$, 'notFound', 'No statement of work for that trade.');
SELECT gbt.trade_refused('another company''s trade', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b1', gbt.app('[]'))$s$, 'notOnTrade', 'Only the company we awarded this trade can send its pay application.');
SELECT gbt.trade_refused('a statement of work not signed', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b2', gbt.app('[]'))$s$, 'sowNotSigned', 'Sign your statement of work first.');
SELECT gbt.trade_refused('a job not being built', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b4', gbt.app('[]'))$s$, 'jobNotBuilding', 'Pay applications open once we are building the job.');
SELECT gbt.trade_refused('a second while one waits', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 60))))$s$, 'drawWaiting', 'Your last pay application is still with us.');
RESET ROLE;
SELECT gbt.same('the first pay application, its money by the kernels'' rules', gbt.draws(), 'D1 requested conditional 10300/1030/9270 Footings:50,Slab:10+2500');
SELECT gbt.same('what it claims is their report', gbt.reported(), 'Footings:50,Slab:10,Walks:-');
SELECT gbt.same('its words, and no one of ours named', (SELECT signed_by || ' | ' || address || ' | ' || license || ' | ' || (period_to = public.app_today()) || ' | ' || (recorded_by IS NULL) || ' | ' || (file_name IS NULL) FROM public.gc_draws WHERE id = gbt.draw(1)),
  'Pat Ridgeway | 12 Mill Rd, Boerne | TX-4471 | true | true | true');
SELECT gbt.same('it keeps their promise of a pay application', (SELECT (kept_on = public.app_today())::text FROM public.gc_trade_promises WHERE id = '00000000-0000-0000-0000-000000009601'), 'true');

-- 2. The office approves it, marks it paid, and records the unconditional waiver that came by email.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account approves', $s$SELECT public.gc_approve_draw(gbt.draw(1))$s$, 'A training account cannot approve a pay application');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin approves', $s$SELECT public.gc_approve_draw(gbt.draw(1))$s$, 'A digital twin cannot approve a pay application');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d4');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('an estimator approves, outside Building''s dev door', $s$SELECT public.gc_approve_draw(gbt.draw(1))$s$, 'No pay application with that id');
SELECT gbt.refused('a signed-in caller cannot be the trade', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app('[]'))$s$, 'permission denied');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('paid before it is approved', $s$SELECT public.gc_pay_draw(gbt.draw(1))$s$, 'Only an approved draw is marked paid');
SELECT gbt.same('approved today', (public.gc_approve_draw(gbt.draw(1)) - public.app_today())::text, '0');
SELECT gbt.refused('approved twice', $s$SELECT public.gc_approve_draw(gbt.draw(1))$s$, 'Only a pay application waiting on us is approved');
SELECT gbt.refused('the waiver before it is paid', $s$SELECT public.gc_draw_waiver_in(gbt.draw(1))$s$, 'The unconditional waiver comes after we pay the draw');
SELECT gbt.same('paid today', (public.gc_pay_draw(gbt.draw(1)) - public.app_today())::text, '0');
SELECT gbt.refused('paid twice', $s$SELECT public.gc_pay_draw(gbt.draw(1))$s$, 'Only an approved draw is marked paid');
SELECT public.gc_draw_waiver_in(gbt.draw(1));
SELECT gbt.refused('the waiver twice', $s$SELECT public.gc_draw_waiver_in(gbt.draw(1))$s$, 'Their unconditional waiver is in already');
SELECT gbt.same('the last paper owed keeps the promise of the waivers', (SELECT (kept_on = public.app_today())::text FROM public.gc_trade_promises WHERE id = '00000000-0000-0000-0000-000000009602'), 'true');
RESET ROLE;

-- The trade's other refusals, with nothing waiting.
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a line not on the statement of work', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090003', 50))))$s$, 'badRequest', 'Each line needs its percent done. The pay application needs its period.');
SELECT gbt.trade_refused('a percent that is not a number', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app('[{"line": "00000000-0000-0000-0000-000000090001", "toPct": "lots"}]'))$s$, 'badRequest', 'Each line needs its percent done. The pay application needs its period.');
SELECT gbt.trade_refused('no period', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 60)), '{"periodTo": " "}'))$s$, 'badRequest', 'Each line needs its percent done. The pay application needs its period.');
SELECT gbt.trade_refused('no one signs it', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 60)), '{"signedBy": " "}'))$s$, 'nameNeeded', 'Type the name of who signs it.');
SELECT gbt.trade_refused('nothing new: the stored materials are not asked again', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 40), gbt.line('00000000-0000-0000-0000-000000090002', 10, 2500))))$s$, 'nothingToBill', 'No work is new since your last pay application.');
RESET ROLE;

-- 3. A pay application that came by email, recorded by the office with its Drive link: Footings to 100%, Slab to
-- 40%, the stored materials built in. The kernel: $11,400 of work less the $2,500 no longer stored is $8,900, less
-- $890 held, $8,010.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 100), gbt.line('00000000-0000-0000-0000-000000090002', 40)),
  '{"fileName": "RCC-pay-2.pdf", "driveUrl": "https://drive.google.com/file/d/pay-2/view"}'));
SELECT gbt.refused('another while one waits', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090002', 50))))$s$, 'Pay application 2 is waiting on us. Approve it or send it back first');
SELECT gbt.refused('a job not being built', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b4', gbt.app('[]'))$s$, 'Pay applications are for a job we are building');
SELECT gbt.refused('a statement of work not signed', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b2', gbt.app('[]'))$s$, 'Their statement of work is not signed yet');
SELECT gbt.refused('a trade that does not exist', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009ff', gbt.app('[]'))$s$, 'No trade with that id');
SELECT gbt.same('the second, its money by the kernels'' rules', gbt.draws(),
  E'D1 paid unconditional 10300/1030/9270 Footings:50,Slab:10+2500\nD2 requested conditional 8900/890/8010 Footings:100,Slab:40');
SELECT gbt.same('the one that came by email names who of ours recorded it, and its file',
  (SELECT (recorded_by = '00000000-0000-0000-0000-0000000009d1') || ' ' || file_name || ' ' || drive_url FROM public.gc_draws WHERE id = gbt.draw(2)),
  'true RCC-pay-2.pdf https://drive.google.com/file/d/pay-2/view');
SELECT gbt.same('its claim is their report, typed by us', gbt.reported() || ' ' || (SELECT count(*) FROM public.gc_sow_line_reports WHERE recorded_by IS NOT NULL), 'Footings:100,Slab:40,Walks:- 2');

-- 4. Sent back: Slab is at 30%, not 40%. Footings at 100% is not doubted.
SELECT gbt.refused('sent back with nothing to fix', $s$SELECT public.gc_send_draw_back(gbt.draw(2), '{}', ' ')$s$, 'Say what to fix');
SELECT gbt.refused('a line it does not claim', $s$SELECT public.gc_send_draw_back(gbt.draw(2), '{"00000000-0000-0000-0000-000000090005": 0}', 'Walks')$s$, 'Mark only the lines this pay application claims');
SELECT gbt.refused('a percent over 100', $s$SELECT public.gc_send_draw_back(gbt.draw(2), '{"00000000-0000-0000-0000-000000090002": 150}', 'Slab')$s$, 'Give the percent we see on each line we doubt');
SELECT public.gc_send_draw_back(gbt.draw(2), '{"00000000-0000-0000-0000-000000090002": 30, "00000000-0000-0000-0000-000000090001": 100}', 'Slab is at 30%, not 40%.');
SELECT gbt.same('it stays as it went, with what we see', gbt.draws(),
  E'D1 paid unconditional 10300/1030/9270 Footings:50,Slab:10+2500\nD2 sent_back conditional 8900/890/8010 Footings:100,Slab:40~30');
SELECT gbt.refused('approving one sent back', $s$SELECT public.gc_approve_draw((SELECT id FROM public.gc_draws WHERE status = 'sent_back'))$s$, 'Only a pay application waiting on us is approved');
-- The office's other refusals, with nothing waiting.
SELECT gbt.refused('a line not on their statement of work', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090004', 50))))$s$, 'Each line must be on their statement of work, with its percent done');
SELECT gbt.refused('no period', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090002', 50)), '{"periodTo": "someday"}'))$s$, 'Say the day the pay application runs to');
SELECT gbt.refused('no one signed it', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090002', 50)), '{"signedBy": ""}'))$s$, 'Say who signed it');
SELECT gbt.refused('nothing to pay', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 50))))$s$, 'There is nothing to pay. No work is new since their last pay application');
RESET ROLE;

-- 5. The trade sends it again from its portal, fixed: Slab at 30%. It takes the same number. The kernel: $9,600 of
-- work less the $2,500 stored before is $7,100, less $710, $6,390. A resend can lower their report.
SET LOCAL ROLE service_role;
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 100), gbt.line('00000000-0000-0000-0000-000000090002', 30))));
RESET ROLE;
SELECT gbt.same('the resend under the same number', gbt.draws(),
  E'D1 paid unconditional 10300/1030/9270 Footings:50,Slab:10+2500\nD2 sent_back conditional 8900/890/8010 Footings:100,Slab:40~30\nD2 requested conditional 7100/710/6390 Footings:100,Slab:30');
SELECT gbt.same('their report lowered', gbt.reported(), 'Footings:100,Slab:30,Walks:-');

-- 6. Approved for less: Footings at 90%. The kernel: $4,800 and $3,600 of work less the $2,500 stored before is
-- $5,900, less $590, $5,310. The draw keeps what they asked.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('less with no reason', $s$SELECT public.gc_approve_draw_less(gbt.draw(2), '{"00000000-0000-0000-0000-000000090001": 90}', '')$s$, 'Say why we approve less');
SELECT gbt.refused('less with no percents', $s$SELECT public.gc_approve_draw_less(gbt.draw(2), '[]', 'Footings')$s$, 'Give the percent we approve on each line we doubt');
SELECT gbt.refused('less on a line it does not claim', $s$SELECT public.gc_approve_draw_less(gbt.draw(2), '{"00000000-0000-0000-0000-000000090005": 10}', 'Walks')$s$, 'Approve less only on a line this pay application claims');
SELECT gbt.refused('less that is not less', $s$SELECT public.gc_approve_draw_less(gbt.draw(2), '{"00000000-0000-0000-0000-000000090001": 100}', 'Footings')$s$, 'That is not less than they asked. Approve it as it is');
SELECT gbt.same('approved for less today', (public.gc_approve_draw_less(gbt.draw(2), '{"00000000-0000-0000-0000-000000090001": 90}', ' Footings is at 90%. ') - public.app_today())::text, '0');
SELECT gbt.same('approved for less, by the kernels'' rules', (SELECT string_agg(x, E'\n') FROM unnest(string_to_array(gbt.draws(), E'\n')) x WHERE x LIKE 'D2 approved%'),
  'D2 approved conditional 5900/590/5310 Footings:90,Slab:30');
SELECT gbt.same('what they asked, kept', (SELECT trim_scale((asked->>'gross')::numeric) || '/' || trim_scale((asked->>'retainage')::numeric) || '/' || trim_scale((asked->>'net')::numeric)
    || ' ' || jsonb_array_length(asked->'lines') || ' lines | ' || (asked->>'note') || ' | ' || ((asked->>'on')::date = public.app_today()) FROM public.gc_draws WHERE id = gbt.draw(2)),
  '7100/710/6390 2 lines | Footings is at 90%. | true');

-- 7. Back-charges off the approved draw: only one they agreed to, we kept, or never answered in time, and no more
-- than it pays after the charges on it.
SELECT gbt.refused('a charge still in its days to answer', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009402', gbt.draw(2))$s$, 'They have until');
SELECT gbt.refused('a charge they disputed', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009403', gbt.draw(2))$s$, 'They disputed that charge. Keep it or drop it first');
SELECT gbt.refused('a charge we dropped', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009404', gbt.draw(2))$s$, 'That charge was dropped');
SELECT gbt.refused('a charge more than the draw pays', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009405', gbt.draw(2))$s$, 'That draw pays less than the charge');
SELECT gbt.refused('a draw already paid', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009401', gbt.draw(1))$s$, 'Take a charge off a draw we approved and have not paid');
SELECT gbt.refused('another statement of work''s draw', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009401', '00000000-0000-0000-0000-000000009501')$s$, 'Take a charge off a draw on the same statement of work');
SELECT gbt.refused('a charge that does not exist', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-0000000094ff', gbt.draw(2))$s$, 'No back-charge with that id');
SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009401', gbt.draw(2));
SELECT gbt.refused('a charge twice', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009401', gbt.draw(2))$s$, 'That charge came off draw 2 already');
SELECT gbt.same('the charge names its draw, and the draw keeps what it pays', (SELECT (taken_draw_id = gbt.draw(2)) || ' ' || (taken_on = public.app_today()) FROM public.gc_back_charges WHERE id = '00000000-0000-0000-0000-000000009401')
    || ' ' || (SELECT trim_scale(net) FROM public.gc_draws WHERE id = gbt.draw(2)), 'true true 5310');
SELECT public.gc_pay_draw(gbt.draw(2));
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a waiver for a draw that does not exist', $s$SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000095ff')$s$, 'notFound', 'No pay application with that id.');
SELECT gbt.trade_refused('another company''s waiver', $s$SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e2', gbt.draw(2))$s$, 'notOnTrade', 'Only the company on this statement of work signs its waivers.');
SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e1', gbt.draw(2));
SELECT gbt.trade_refused('the waiver twice', $s$SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e1', gbt.draw(2))$s$, 'alreadySigned', 'You signed it already.');
RESET ROLE;

-- 8. The credit goes to the trade, who signs it into a line of its statement of work, done at once.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a draft change order', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009303')$s$, 'Only a change order the customer signed goes to the trade');
SELECT gbt.refused('our own work', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009302')$s$, 'This change is our own work. It goes to no trade');
SELECT gbt.refused('a trade with no signed statement of work', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009304')$s$, 'Their statement of work is not signed yet');
SELECT gbt.refused('a change order that does not exist', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-0000000093ff')$s$, 'No change order with that id');
SELECT gbt.same('sent today', (public.gc_send_trade_change('00000000-0000-0000-0000-000000009301') - public.app_today())::text, '0');
SELECT gbt.refused('sent twice', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009301')$s$, 'It went to them already');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a change never sent', $s$SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009303')$s$, 'notFound', 'No change was sent to you with that id.');
SELECT gbt.trade_refused('another company signs', $s$SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-000000009301')$s$, 'notOnTrade', 'Only the company on this statement of work signs its changes.');
SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009301');
SELECT gbt.trade_refused('signed twice', $s$SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009301')$s$, 'alreadySigned', 'You signed it already.');
RESET ROLE;
SELECT gbt.same('the credit is a line of their statement of work, done at once',
  (SELECT l.position || ' ' || l.label || ' ' || trim_scale(l.amount) FROM public.gc_sow_lines l WHERE l.id = gbt.change_line()) || ' | ' || gbt.reported()
    || ' | ' || (SELECT (s.signed_on = public.app_today()) || ' ' || (s.sow_line_id = gbt.change_line()) FROM public.gc_change_order_trade_sends s WHERE s.change_order_id = '00000000-0000-0000-0000-000000009301'),
  '3 Change order 1: Leave out the curb -2000 | Footings:100,Slab:30,Walks:-,Change order 1: Leave out the curb:100 | true true');

-- 9. The third: Footings to 100%, Slab to 40%, and the credit. The kernel: $1,200 + $1,800 - $2,000 = $1,000, less
-- $100, $900, and the credit's line kept, so it reads billed.
SET LOCAL ROLE service_role;
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 100), gbt.line('00000000-0000-0000-0000-000000090002', 40), gbt.line(gbt.change_line(), 100))));
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_approve_draw(gbt.draw(3));
SELECT public.gc_pay_draw(gbt.draw(3));
RESET ROLE;
SELECT gbt.same('the credit comes off once, its line kept', (SELECT string_agg(x, E'\n') FROM unnest(string_to_array(gbt.draws(), E'\n')) x WHERE x LIKE 'D3 %'),
  'D3 paid conditional 1000/100/900 Footings:100,Slab:40,Change order 1: Leave out the curb:100');

-- 10. The fourth: a claim below what is billed stays at billed, stored materials count up to what the line has
-- left in whole dollars, and the credit is not taken again. The kernel: Slab $1,800 and $9,000 stored, $10,800,
-- less $1,080, $9,720.
SET LOCAL ROLE service_role;
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 30), gbt.line('00000000-0000-0000-0000-000000090002', 50, 9999.6), gbt.line(gbt.change_line(), 100))));
SELECT gbt.trade_refused('a waiver before it is paid', $s$SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e1', gbt.draw(4))$s$, 'notPaidYet', 'The unconditional waiver comes after we pay the draw.');
RESET ROLE;
SELECT gbt.same('the fourth, by the kernels'' rules', (SELECT string_agg(x, E'\n') FROM unnest(string_to_array(gbt.draws(), E'\n')) x WHERE x LIKE 'D4 %'),
  'D4 requested conditional 10800/1080/9720 Slab:50+9000');
SELECT gbt.same('a claim over 100 is 100', (SELECT trim_scale(((public.gc_draw_money('00000000-0000-0000-0000-000000009101', 5,
  jsonb_build_array(jsonb_build_object('line', '00000000-0000-0000-0000-000000009202', 'toPct', 150))))->'lines'->0->>'toPct')::numeric)::text), '100');

-- 11. The trade's report from its portal: never below billed, and the real days it sets on the schedule.
SET LOCAL ROLE service_role;
SELECT gbt.same('below billed stays at billed', public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', 10)::text, '40');
SELECT gbt.same('a report as given', public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', 60)::text, '60');
SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090001', 100);
SELECT gbt.trade_refused('a line split into parts', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090005', 20)$s$, 'splitLine', 'This line is split into parts. Report each part.');
SELECT gbt.trade_refused('a line not theirs', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090003', 20)$s$, 'notFound', 'That line is not on your statement of work.');
SELECT gbt.trade_refused('no percent', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', NULL)$s$, 'badRequest', 'Say the percent done.');
SELECT gbt.trade_refused('another company reports', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', 20)$s$, 'notOnTrade', 'Only the company we awarded this trade can report its work.');
SELECT gbt.trade_refused('a statement of work not signed', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-000000090003', 20)$s$, 'sowNotSigned', 'Sign your statement of work first.');
SELECT gbt.trade_refused('a job not being built', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-000000090004', 20)$s$, 'jobNotBuilding', 'Reports open once we are building the job.');
SELECT gbt.trade_refused('a trade that does not exist', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009ff', '00000000-0000-0000-0000-000000090002', 20)$s$, 'notFound', 'No statement of work for that trade.');
RESET ROLE;
SELECT gbt.same('their reports, newest', gbt.reported(), 'Footings:100,Slab:60,Walks:-,Change order 1: Leave out the curb:100');
SELECT gbt.same('the real days the reports set: Footings started and finished today, Slab started today',
  (SELECT string_agg(i.label || ' ' || coalesce((a.actual_start - public.app_today())::text, '-') || ' ' || coalesce((a.actual_finish - public.app_today())::text, '-'), ', ' ORDER BY a.position)
   FROM public.gc_schedule_activities a JOIN public.gc_scope_items i ON i.id = a.scope_item_id WHERE a.project_id = '00000000-0000-0000-0000-0000000009a1'),
  'Footings 0 0, Slab 0 -, Walks - -');

-- Who may not, and what stays as it went.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a caller signed out', $s$SELECT public.gc_approve_draw(gbt.draw(4))$s$, 'Sign in first');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account records a pay application', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app('[]'))$s$, 'A training account cannot record a pay application');
SELECT gbt.refused('a training account sends a change', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009301')$s$, 'A training account cannot send a change to a trade');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin sends one back', $s$SELECT public.gc_send_draw_back(gbt.draw(4), '{}', 'x')$s$, 'A digital twin cannot send a pay application back');
SELECT gbt.refused('a digital twin takes a charge', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009405', gbt.draw(4))$s$, 'A digital twin cannot take a back-charge off a draw');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a report changed', $s$UPDATE public.gc_sow_line_reports SET pct = 0$s$, 'permission denied');
SELECT gbt.refused('a dev cannot be the trade', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', 70)$s$, 'permission denied');
RESET ROLE;
SELECT gbt.same('the draws on Concrete: five rows, one sent back', (SELECT count(*) || ' ' || count(*) FILTER (WHERE status = 'sent_back') FROM public.gc_draws WHERE sow_id = '00000000-0000-0000-0000-000000009101'), '5 1');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
