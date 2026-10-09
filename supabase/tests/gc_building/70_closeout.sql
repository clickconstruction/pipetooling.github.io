-- Closeout (v2.5115, the Building lane's U6c): every line billed, the work accepted once the punch list is done, the
-- trade's final pay application for the retainage we hold (never less a back-charge taken off a draw), its release
-- approved 10 days after the customer pays us ours (the day by billMoney's rule), paid, its unconditional final
-- release keeping the promise of the closeout papers, and the job closed. A change the trade signed on paper,
-- recorded by the office into a line of its statement of work. Each press refuses in words, or the trade's in keys,
-- what the prototype's reducer refuses. A training account, a digital twin and a role outside Building's dev door are
-- refused; the trade's press is the service role's only. Presses run through RLS, the fixture made as postgres;
-- everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000acd01', 'dev@closeout.test'),
  ('00000000-0000-0000-0000-0000000acd02', 'trainee@closeout.test'),
  ('00000000-0000-0000-0000-0000000acd03', 'twin@closeout.test'),
  ('00000000-0000-0000-0000-0000000acd04', 'estimator@closeout.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000acd01', 'dev@closeout.test', 'Closeout Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000acd02', 'trainee@closeout.test', 'Closeout Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000acd03', 'twin@closeout.test', 'Closeout Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000acd04', 'estimator@closeout.test', 'Closeout Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000acd02';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000acd03';

-- Three GC jobs. A is being built: Concrete awarded to Ridgeway Concrete with a signed statement of work at 10%
-- retainage (Footings $12,000, Slab $18,000), and our own Plumbing. B is still bidding. C is being built, for the
-- customer's bill paid for less.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000acc01', 'Closeout Test Owner', '00000000-0000-0000-0000-0000000acd01');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000aca01', 'Closeout test A', '00000000-0000-0000-0000-0000000acc01'),
  ('00000000-0000-0000-0000-0000000aca02', 'Closeout test B', '00000000-0000-0000-0000-0000000acc01'),
  ('00000000-0000-0000-0000-0000000aca03', 'Closeout test C', '00000000-0000-0000-0000-0000000acc01');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000aca01', 'building', public.app_today() - 90),
  ('00000000-0000-0000-0000-0000000aca02', 'bidding', NULL),
  ('00000000-0000-0000-0000-0000000aca03', 'building', public.app_today() - 120);
INSERT INTO public.gc_companies (id, name, trades) VALUES ('00000000-0000-0000-0000-0000000ace01', 'Ridgeway Concrete', ARRAY['Concrete']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000acb01', '00000000-0000-0000-0000-0000000aca01', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000acb02', '00000000-0000-0000-0000-0000000aca01', 'Plumbing', 1, true),
  ('00000000-0000-0000-0000-0000000acb03', '00000000-0000-0000-0000-0000000aca02', 'Electrical', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000acf01', '00000000-0000-0000-0000-0000000acb01', '00000000-0000-0000-0000-0000000ace01');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000acf01', awarded_on = public.app_today() - 85 WHERE id = '00000000-0000-0000-0000-0000000acb01';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-0000000ac101', '00000000-0000-0000-0000-0000000acb01', 'Footings', 0),
  ('00000000-0000-0000-0000-0000000ac102', '00000000-0000-0000-0000-0000000acb01', 'Slab', 1);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000ac201', '00000000-0000-0000-0000-0000000acb01', '00000000-0000-0000-0000-0000000acf01', '00000000-0000-0000-0000-0000000ace01', 'signed', 30000, 10, public.app_today() - 82, public.app_today() - 80);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-0000000ac301', '00000000-0000-0000-0000-0000000ac201', 0, 'Footings', 12000, '00000000-0000-0000-0000-0000000ac101'),
  ('00000000-0000-0000-0000-0000000ac302', '00000000-0000-0000-0000-0000000ac201', 1, 'Slab', 18000, '00000000-0000-0000-0000-0000000ac102');
-- Its draws so far: 1 paid with its unconditional waiver in (Footings and Slab to 50%), and 2 approved (Footings to
-- 100%, Slab to 90%), with a $500 back-charge taken off it.
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, waiver, waiver_on, approved_on, paid_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000ac401', '00000000-0000-0000-0000-0000000ac201', 1, public.app_today() - 31, 'paid', 15000, 1500, 13500, 'unconditional', public.app_today() - 27, public.app_today() - 30, public.app_today() - 28, public.app_today() - 31, 'Pat Ridgeway', public.app_today() - 31),
  ('00000000-0000-0000-0000-0000000ac402', '00000000-0000-0000-0000-0000000ac201', 2, public.app_today() - 6, 'approved', 13200, 1320, 11880, 'conditional', NULL, public.app_today() - 5, NULL, public.app_today() - 6, 'Pat Ridgeway', public.app_today() - 6);
INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct) VALUES
  ('00000000-0000-0000-0000-0000000ac401', '00000000-0000-0000-0000-0000000ac301', 50),
  ('00000000-0000-0000-0000-0000000ac401', '00000000-0000-0000-0000-0000000ac302', 50),
  ('00000000-0000-0000-0000-0000000ac402', '00000000-0000-0000-0000-0000000ac301', 100),
  ('00000000-0000-0000-0000-0000000ac402', '00000000-0000-0000-0000-0000000ac302', 90);
INSERT INTO public.gc_back_charges (id, project_id, package_id, company_id, sow_id, amount, reason, sent_on, status, answered_on, taken_draw_id, taken_on) VALUES
  ('00000000-0000-0000-0000-0000000ac501', '00000000-0000-0000-0000-0000000aca01', '00000000-0000-0000-0000-0000000acb01', '00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000ac201', 500, 'Washout on the street', public.app_today() - 12, 'agreed', public.app_today() - 10, '00000000-0000-0000-0000-0000000ac402', public.app_today() - 4);
-- C's Masonry, awarded to Ridgeway with a signed statement of work, and two change orders the customer signed on it:
-- a $400 credit and a $900 add.
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000acb05', '00000000-0000-0000-0000-0000000aca03', 'Masonry', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000acf03', '00000000-0000-0000-0000-0000000acb05', '00000000-0000-0000-0000-0000000ace01');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000acf03', awarded_on = public.app_today() - 110 WHERE id = '00000000-0000-0000-0000-0000000acb05';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-0000000ac105', '00000000-0000-0000-0000-0000000acb05', 'Block walls', 0);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000ac205', '00000000-0000-0000-0000-0000000acb05', '00000000-0000-0000-0000-0000000acf03', '00000000-0000-0000-0000-0000000ace01', 'signed', 20000, 10, public.app_today() - 105, public.app_today() - 100);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-0000000ac305', '00000000-0000-0000-0000-0000000ac205', 0, 'Block walls', 20000, '00000000-0000-0000-0000-0000000ac105');
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price, status, sent_on, answered_on, answered_how) VALUES
  ('00000000-0000-0000-0000-0000000ad301', '00000000-0000-0000-0000-0000000aca03', 1, 'Leave out the lintel', 'owner', '00000000-0000-0000-0000-0000000acb05', -400, -440, 'signed', public.app_today() - 9, public.app_today() - 7, 'office'),
  ('00000000-0000-0000-0000-0000000ad302', '00000000-0000-0000-0000-0000000aca03', 2, 'Add a bond beam', 'field', '00000000-0000-0000-0000-0000000acb05', 900, 990, 'signed', public.app_today() - 9, public.app_today() - 7, 'office');
-- One punch item on Concrete, still to fix.
INSERT INTO public.gc_punch_items (id, project_id, package_id, text, added_on) VALUES
  ('00000000-0000-0000-0000-0000000ac601', '00000000-0000-0000-0000-0000000aca01', '00000000-0000-0000-0000-0000000acb01', 'Patch the slab edge at grid C', public.app_today() - 3);
-- Ridgeway's promise of its closeout papers.
INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-0000000ac701', '00000000-0000-0000-0000-0000000ace01', 'closeout', '00000000-0000-0000-0000-0000000aca01', '00000000-0000-0000-0000-0000000acb01', 'the final pay application and the waivers', public.app_today() + 10, 'office');

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
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
END $$;
-- A final pay application as the window or the portal sends it.
CREATE FUNCTION gbt.final(extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('periodTo', public.app_today()::text, 'address', '12 Mill Rd, Boerne', 'license', 'TX-4471', 'signedBy', 'Pat Ridgeway', 'signedTitle', 'Owner') || extra $$;
-- The draw that stands on Concrete by its number.
CREATE FUNCTION gbt.draw(p_number integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_draws WHERE sow_id = '00000000-0000-0000-0000-0000000ac201' AND number = p_number AND status <> 'sent_back' $$;
-- Concrete's draws: number, final, status, waiver and money.
CREATE FUNCTION gbt.draws() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg('D' || number || CASE WHEN final THEN ' release' ELSE '' END || ' ' || status || ' ' || waiver || ' '
    || trim_scale(gross) || '/' || trim_scale(retainage) || '/' || trim_scale(net), E'\n' ORDER BY number, seq)
  FROM public.gc_draws WHERE sow_id = '00000000-0000-0000-0000-0000000ac201' $$;
-- Whether Ridgeway's closeout promise is kept today, or still open.
CREATE FUNCTION gbt.promise() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN kept_on IS NULL THEN 'open' WHEN kept_on = public.app_today() THEN 'kept today' ELSE 'kept ' || kept_on END
  FROM public.gc_trade_promises WHERE id = '00000000-0000-0000-0000-0000000ac701' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions themselves: invoker's rights; the office's presses and the helpers for signed-in callers, the
-- trade's for the service role only. The closed day is new, and only on a closed job.
SELECT gbt.same('every function runs with the caller''s rights',
  (SELECT string_agg(DISTINCT prosecdef::text, ',') FROM pg_proc WHERE proname IN ('gc_retainage_held', 'gc_sow_all_billed', 'gc_owner_retainage_paid_on',
    'gc_accept_work', 'gc_final_pay_app_ask', 'gc_trade_final_pay_app', 'gc_final_pay_app_came_in', 'gc_approve_retainage', 'gc_close_job')),
  'false');
SELECT gbt.same('who runs each: signed out, signed in, the service role',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_accept_work(uuid)', 'public.gc_approve_retainage(uuid)', 'public.gc_close_job(uuid)', 'public.gc_trade_final_pay_app(uuid, uuid, jsonb)']) f),
  'public.gc_accept_work(uuid):false/true/true,public.gc_approve_retainage(uuid):false/true/true,public.gc_close_job(uuid):false/true/true,public.gc_trade_final_pay_app(uuid, uuid, jsonb):false/false/true');
SELECT gbt.same('the day we closed a job, kept only on a closed one',
  (SELECT string_agg(conname, ',') FROM pg_constraint WHERE conname = 'gc_projects_closed_on_when_closed') || ' '
    || (SELECT count(*) FROM information_schema.columns WHERE table_name = 'gc_projects' AND column_name = 'closed_on'),
  'gc_projects_closed_on_when_closed 1');
SELECT gbt.same('what we hold before the last draw: draw 1''s and draw 2''s retainage, the charge taken off draw 2 aside',
  trim_scale(public.gc_retainage_held('00000000-0000-0000-0000-0000000ac201'))::text || ' ' || public.gc_sow_all_billed('00000000-0000-0000-0000-0000000ac201'), '2820 false');

-- 1. Not every line is billed yet: Slab is at 90%.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('accepted before every line is billed', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'Accept the work once every line is billed');
RESET ROLE;
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('the final before every line is billed', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final())$s$, 'finalNotYet', 'The final pay application opens once every line is billed and the work is accepted.');
-- The last of the Slab: $1,800 less $180 held.
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01',
  jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('line', '00000000-0000-0000-0000-0000000ac102', 'toPct', 100)),
    'periodTo', public.app_today()::text, 'signedBy', 'Pat Ridgeway'));
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT public.gc_approve_draw(gbt.draw(3));
SELECT public.gc_pay_draw(gbt.draw(2));
SELECT public.gc_pay_draw(gbt.draw(3));
SELECT gbt.same('every line billed, and what we hold', public.gc_sow_all_billed('00000000-0000-0000-0000-0000000ac201') || ' ' || trim_scale(public.gc_retainage_held('00000000-0000-0000-0000-0000000ac201')), 'true 3000');

-- 2. The punch list holds the acceptance until its item is fixed and checked.
SELECT gbt.refused('accepted with the punch list open', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'Their punch list has 1 item to fix or check first');
RESET ROLE;
UPDATE public.gc_punch_items SET fixed_on = public.app_today() - 1 WHERE id = '00000000-0000-0000-0000-0000000ac601';
SET LOCAL ROLE authenticated;
SELECT gbt.refused('accepted with an item fixed, not checked', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'Their punch list has 1 item to fix or check first');
RESET ROLE;
UPDATE public.gc_punch_items SET checked_on = public.app_today(), checked_by = '00000000-0000-0000-0000-0000000acd01' WHERE id = '00000000-0000-0000-0000-0000000ac601';
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd02');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account accepts', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'A training account cannot accept a trade''s work');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd03');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin accepts', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'A digital twin cannot accept a trade''s work');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.same('accepted today', (public.gc_accept_work('00000000-0000-0000-0000-0000000acb01') - public.app_today())::text, '0');
SELECT gbt.refused('accepted twice', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'We accepted their work already');
SELECT gbt.refused('our own work', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb02')$s$, 'Their statement of work is not signed yet');
RESET ROLE;

-- 3. The waivers come in for draws 2 and 3. The promise asked for the final pay application too, so it stays open.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000ace01', gbt.draw(2));
SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000ace01', gbt.draw(3));
RESET ROLE;
SELECT gbt.same('the final pay application is still owed', gbt.promise(), 'open');

-- 4. The final pay application's refusals, both ways in.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('no period', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final('{"periodTo": " "}'))$s$, 'badRequest', 'The pay application needs its period.');
SELECT gbt.trade_refused('no one signs it', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final('{"signedBy": ""}'))$s$, 'nameNeeded', 'Type the name of who signs it.');
SELECT gbt.trade_refused('a trade with no statement of work', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb03', gbt.final())$s$, 'notFound', 'No statement of work for that trade.');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('no period', $s$SELECT public.gc_final_pay_app_came_in('00000000-0000-0000-0000-0000000acb01', gbt.final('{"periodTo": "someday"}'))$s$, 'Say the day the pay application runs to');
SELECT gbt.refused('no one signed it', $s$SELECT public.gc_final_pay_app_came_in('00000000-0000-0000-0000-0000000acb01', gbt.final('{"signedBy": " "}'))$s$, 'Say who signed it');
SELECT gbt.refused('a job not being built', $s$SELECT public.gc_final_pay_app_came_in('00000000-0000-0000-0000-0000000acb03', gbt.final())$s$, 'Pay applications are for a job we are building');
SELECT gbt.refused('one of ours recording it as someone else', $s$SELECT public.gc_final_pay_app_ask('00000000-0000-0000-0000-0000000ac201', gbt.final(), '00000000-0000-0000-0000-0000000acd04')$s$, 'badRequest');
RESET ROLE;

-- 5. The final pay application from the portal: the $3,000 we hold, the $500 charge never paid back. With no waiver
-- owed, it keeps the promise.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final());
SELECT gbt.trade_refused('a second final', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final())$s$, 'finalSent', 'The final pay application went already.');
RESET ROLE;
SELECT gbt.same('the release: the retainage we hold', gbt.draws(),
  E'D1 paid unconditional 15000/1500/13500\nD2 paid unconditional 13200/1320/11880\nD3 paid unconditional 1800/180/1620\nD4 release requested conditional 0/-3000/3000');
SELECT gbt.same('the final pay application keeps the promise', gbt.promise(), 'kept today');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a final that came by email, twice', $s$SELECT public.gc_final_pay_app_came_in('00000000-0000-0000-0000-0000000acb01', gbt.final())$s$, 'Their final pay application is in already');

-- 6. Its approval waits for the customer to pay us ours, and 10 days.
SELECT gbt.refused('a draw that is not the release', $s$SELECT public.gc_approve_retainage(gbt.draw(3))$s$, 'Only a retainage release is approved here');
SELECT gbt.refused('the customer has not paid us', $s$SELECT public.gc_approve_retainage(gbt.draw(4))$s$, 'The customer has not paid us our retainage yet');
RESET ROLE;
-- Our final pay application to the customer, its bill on the billing job, and $20,000 of the $50,000 paid.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000ac801', 'Closeout Bed Billing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000000ac901', '00000000-0000-0000-0000-0000000acd01', '00000000-0000-0000-0000-0000000ac801', 'Closeout test A (GC)'),
  ('00000000-0000-0000-0000-0000000ac902', '00000000-0000-0000-0000-0000000acd01', '00000000-0000-0000-0000-0000000ac801', 'Closeout test C (GC)');
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, sequence_order, status) VALUES
  ('00000000-0000-0000-0000-0000000ad001', '00000000-0000-0000-0000-0000000ac901', 50000, 1, 'billed'),
  ('00000000-0000-0000-0000-0000000ad002', '00000000-0000-0000-0000-0000000ac902', 50000, 1, 'paid');
INSERT INTO public.gc_owner_pay_apps (id, project_id, number, final, period_to, sent_on, retainage_pct, retainage, work_to_date, due, invoice_id) VALUES
  ('00000000-0000-0000-0000-0000000ad201', '00000000-0000-0000-0000-0000000aca01', 4, true, public.app_today() - 25, public.app_today() - 25, 10, 0, 500000, 50000, '00000000-0000-0000-0000-0000000ad001'),
  ('00000000-0000-0000-0000-0000000ad202', '00000000-0000-0000-0000-0000000aca03', 6, true, public.app_today() - 40, public.app_today() - 40, 10, 0, 500000, 50000, '00000000-0000-0000-0000-0000000ad002');
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000ad101', '00000000-0000-0000-0000-0000000ac901', '00000000-0000-0000-0000-0000000ad001', 20000, public.app_today() - 20);
SELECT gbt.same('a bill paid in part is not paid', coalesce(public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca01')::text, 'not paid'), 'not paid');
-- The rest comes in 5 days ago: too soon.
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000ad102', '00000000-0000-0000-0000-0000000ac901', '00000000-0000-0000-0000-0000000ad001', 30000, public.app_today() - 5);
SELECT gbt.same('paid the day the payments reach the bill', (public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca01') - public.app_today())::text, '-5');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('the release before its 10 days', $s$SELECT public.gc_approve_retainage(gbt.draw(4))$s$, 'We pay their retainage from');
RESET ROLE;
UPDATE public.jobs_ledger_payments SET paid_on = public.app_today() - 12 WHERE id = '00000000-0000-0000-0000-0000000ad102';
SELECT gbt.same('the payments reach A''s bill 12 days ago, and C''s has none yet', (SELECT string_agg(x, ' ') FROM (VALUES
  ((public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca01') - public.app_today())::text),
  (coalesce((public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca03') - public.app_today())::text, 'none'))) v(x)), '-12 none');
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000ad103', '00000000-0000-0000-0000-0000000ac902', '00000000-0000-0000-0000-0000000ad002', 20000, public.app_today() - 30),
  ('00000000-0000-0000-0000-0000000ad104', '00000000-0000-0000-0000-0000000ac902', '00000000-0000-0000-0000-0000000ad002', 25000, public.app_today() - 18);
SELECT gbt.same('C''s bill, marked paid at $45,000 of $50,000: paid on its last payment', (public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca03') - public.app_today())::text, '-18');
-- B's progress bill, paid in full, opens no trade's retainage: only our final pay application's bill does (Helper 15).
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000000ac903', '00000000-0000-0000-0000-0000000acd01', '00000000-0000-0000-0000-0000000ac801', 'Closeout test B (GC)');
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, sequence_order, status) VALUES
  ('00000000-0000-0000-0000-0000000ad003', '00000000-0000-0000-0000-0000000ac903', 40000, 1, 'paid');
INSERT INTO public.gc_owner_pay_apps (id, project_id, number, final, period_to, sent_on, retainage_pct, retainage, work_to_date, due, invoice_id) VALUES
  ('00000000-0000-0000-0000-0000000ad203', '00000000-0000-0000-0000-0000000aca02', 1, false, public.app_today() - 30, public.app_today() - 30, 10, 4000, 44000, 40000, '00000000-0000-0000-0000-0000000ad003');
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000ad105', '00000000-0000-0000-0000-0000000ac903', '00000000-0000-0000-0000-0000000ad003', 40000, public.app_today() - 20);
SELECT gbt.same('a paid progress bill and no final: not paid', coalesce(public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca02')::text, 'not paid'), 'not paid');
SET LOCAL ROLE authenticated;
SELECT gbt.same('the release approved 12 days after the customer paid us', (public.gc_approve_retainage(gbt.draw(4)) - public.app_today())::text, '0');
SELECT gbt.refused('approved twice', $s$SELECT public.gc_approve_retainage(gbt.draw(4))$s$, 'Only a pay application waiting on us is approved');
SELECT public.gc_pay_draw(gbt.draw(4));
RESET ROLE;
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000ace01', gbt.draw(4));
RESET ROLE;
SELECT gbt.same('paid back: nothing held, the final release in', trim_scale(public.gc_retainage_held('00000000-0000-0000-0000-0000000ac201'))::text || ' | '
  || (SELECT string_agg(x, E'\n') FROM unnest(string_to_array(gbt.draws(), E'\n')) x WHERE x LIKE 'D4 %'), '0 | D4 release paid unconditional 0/-3000/3000');

-- 7. Close the job: a dev's while Building is built, once.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd04');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('an estimator closes a job', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca01')$s$, 'Closing a job is a dev''s while Building is built');
SELECT gbt.refused('a signed-in caller cannot be the trade', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final())$s$, 'permission denied');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd02');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account closes a job', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca01')$s$, 'A training account cannot close a job');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd03');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin closes a job', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca01')$s$, 'A digital twin cannot close a job');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a job still bidding', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca02')$s$, 'Only a job we are building is closed');
SELECT gbt.refused('a job that does not exist', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000acaff')$s$, 'No GC project with that id');
SELECT gbt.same('closed today', (public.gc_close_job('00000000-0000-0000-0000-0000000aca01') - public.app_today())::text, '0');
SELECT gbt.refused('closed twice', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca01')$s$, 'This job is closed already');
RESET ROLE;
SELECT gbt.same('the job reads closed today', (SELECT stage || ' ' || (closed_on = public.app_today()) FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000aca01'), 'closed true');
SELECT gbt.refused('a closed day on a job not closed', $s$UPDATE public.gc_projects SET closed_on = public.app_today() WHERE project_id = '00000000-0000-0000-0000-0000000aca03'$s$, 'gc_projects_closed_on_when_closed');

-- 8. A change Ridgeway signed on paper: the office records it into a line of their Masonry statement of work.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT public.gc_send_trade_change('00000000-0000-0000-0000-0000000ad301');
SELECT gbt.refused('a change never sent to them', $s$SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad302')$s$, 'Send the change to the trade first');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd02');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account records a signature', $s$SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad301')$s$, 'A training account cannot record a signature');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd03');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin records a signature', $s$SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad301')$s$, 'A digital twin cannot record a signature');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad301', ' CO-1 signed.pdf ', 'https://drive.google.com/file/d/co1/view');
SELECT gbt.refused('signed in twice', $s$SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad301')$s$, 'They signed it already');
RESET ROLE;
SELECT gbt.same('the credit is a line of their statement of work, done at once, recorded by us with its file',
  (SELECT l.position || ' ' || l.label || ' ' || trim_scale(l.amount) FROM public.gc_sow_lines l WHERE l.change_order_id = '00000000-0000-0000-0000-0000000ad301')
    || ' | ' || (SELECT trim_scale(r.pct) || ' ' || (r.recorded_by = '00000000-0000-0000-0000-0000000acd01') FROM public.gc_sow_line_reports r JOIN public.gc_sow_lines l ON l.id = r.sow_line_id WHERE l.change_order_id = '00000000-0000-0000-0000-0000000ad301')
    || ' | ' || (SELECT (t.signed_on = public.app_today()) || ' ' || (t.recorded_by = '00000000-0000-0000-0000-0000000acd01') || ' ' || t.file_name || ' ' || t.drive_url
                 FROM public.gc_change_order_trade_sends t WHERE t.change_order_id = '00000000-0000-0000-0000-0000000ad301'),
  '1 Change order 1: Leave out the lintel -400 | 100 true | true true CO-1 signed.pdf https://drive.google.com/file/d/co1/view');
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('the trade signs one we recorded', $s$SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000ad301')$s$, 'alreadySigned', 'You signed it already.');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
