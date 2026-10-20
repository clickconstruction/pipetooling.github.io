-- The punch list's presses (v2.5131, the Building lane's U3b-i): an item added on a trade we hired, taken off while
-- nothing was pressed on it (kept, never deleted), marked fixed by the trade from its portal or by the office on the
-- trade's word, then checked fixed or sent back with what is still wrong. The last item fixed keeps the trade's punch
-- promise, and Accept the work counts no item taken off. Each office press refuses in words, the trade's in keys, what
-- the prototype's reducer refuses. A training account, a digital twin and a role outside Building's dev door are
-- refused; the trade's press is the service role's only. Presses run through RLS, the fixture made as postgres;
-- everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000b0d01', 'dev@punch.test'),
  ('00000000-0000-0000-0000-0000000b0d02', 'trainee@punch.test'),
  ('00000000-0000-0000-0000-0000000b0d03', 'twin@punch.test'),
  ('00000000-0000-0000-0000-0000000b0d04', 'estimator@punch.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000b0d01', 'dev@punch.test', 'Punch Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000b0d02', 'trainee@punch.test', 'Punch Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000b0d03', 'twin@punch.test', 'Punch Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000b0d04', 'estimator@punch.test', 'Punch Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000b0d02';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000b0d03';

-- Two GC jobs. A is being built: Concrete awarded to Ridgeway Concrete with a signed statement of work, every line
-- billed on a paid draw; Framing awarded to Ridgeway too, its work accepted; Electrical with a statement of work sent,
-- not signed; and our own Plumbing. B is still bidding, with Masonry awarded and signed.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000b0c01', 'Punch Test Owner', '00000000-0000-0000-0000-0000000b0d01');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000b0a01', 'Punch test A', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0a02', 'Punch test B', '00000000-0000-0000-0000-0000000b0c01');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000b0a01', 'building', public.app_today() - 60),
  ('00000000-0000-0000-0000-0000000b0a02', 'bidding', NULL);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000b0e01', 'Ridgeway Concrete', ARRAY['Concrete', 'Framing', 'Masonry']),
  ('00000000-0000-0000-0000-0000000b0e02', 'Volt Brothers', ARRAY['Electrical']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000b0b01', '00000000-0000-0000-0000-0000000b0a01', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000b0b02', '00000000-0000-0000-0000-0000000b0a01', 'Framing', 1, false),
  ('00000000-0000-0000-0000-0000000b0b03', '00000000-0000-0000-0000-0000000b0a01', 'Electrical', 2, false),
  ('00000000-0000-0000-0000-0000000b0b04', '00000000-0000-0000-0000-0000000b0a01', 'Plumbing', 3, true),
  ('00000000-0000-0000-0000-0000000b0b05', '00000000-0000-0000-0000-0000000b0a02', 'Masonry', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000b0f01', '00000000-0000-0000-0000-0000000b0b01', '00000000-0000-0000-0000-0000000b0e01'),
  ('00000000-0000-0000-0000-0000000b0f02', '00000000-0000-0000-0000-0000000b0b02', '00000000-0000-0000-0000-0000000b0e01'),
  ('00000000-0000-0000-0000-0000000b0f03', '00000000-0000-0000-0000-0000000b0b03', '00000000-0000-0000-0000-0000000b0e02'),
  ('00000000-0000-0000-0000-0000000b0f05', '00000000-0000-0000-0000-0000000b0b05', '00000000-0000-0000-0000-0000000b0e01');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b0f01', awarded_on = public.app_today() - 55 WHERE id = '00000000-0000-0000-0000-0000000b0b01';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b0f02', awarded_on = public.app_today() - 55 WHERE id = '00000000-0000-0000-0000-0000000b0b02';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b0f03', awarded_on = public.app_today() - 55 WHERE id = '00000000-0000-0000-0000-0000000b0b03';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b0f05', awarded_on = public.app_today() - 5 WHERE id = '00000000-0000-0000-0000-0000000b0b05';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-0000000b0101', '00000000-0000-0000-0000-0000000b0b01', 'Footings', 0);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on, accepted_on) VALUES
  ('00000000-0000-0000-0000-0000000b0201', '00000000-0000-0000-0000-0000000b0b01', '00000000-0000-0000-0000-0000000b0f01', '00000000-0000-0000-0000-0000000b0e01', 'signed', 10000, 10, public.app_today() - 52, public.app_today() - 50, NULL),
  ('00000000-0000-0000-0000-0000000b0202', '00000000-0000-0000-0000-0000000b0b02', '00000000-0000-0000-0000-0000000b0f02', '00000000-0000-0000-0000-0000000b0e01', 'signed', 8000, 10, public.app_today() - 52, public.app_today() - 50, public.app_today() - 2),
  ('00000000-0000-0000-0000-0000000b0203', '00000000-0000-0000-0000-0000000b0b03', '00000000-0000-0000-0000-0000000b0f03', '00000000-0000-0000-0000-0000000b0e02', 'sent', 9000, 10, public.app_today() - 52, NULL, NULL),
  ('00000000-0000-0000-0000-0000000b0205', '00000000-0000-0000-0000-0000000b0b05', '00000000-0000-0000-0000-0000000b0f05', '00000000-0000-0000-0000-0000000b0e01', 'signed', 7000, 10, public.app_today() - 4, public.app_today() - 3, NULL);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-0000000b0301', '00000000-0000-0000-0000-0000000b0201', 0, 'Footings', 10000, '00000000-0000-0000-0000-0000000b0101');
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, waiver, waiver_on, approved_on, paid_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000b0401', '00000000-0000-0000-0000-0000000b0201', 1, public.app_today() - 20, 'paid', 10000, 1000, 9000, 'unconditional', public.app_today() - 15, public.app_today() - 19, public.app_today() - 16, public.app_today() - 20, 'Pat Ridgeway', public.app_today() - 20);
INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct) VALUES
  ('00000000-0000-0000-0000-0000000b0401', '00000000-0000-0000-0000-0000000b0301', 100);
-- Ridgeway's promise to fix its punch items on Concrete, and its start on Masonry, which a punch press never keeps.
INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-0000000b0701', '00000000-0000-0000-0000-0000000b0e01', 'punch', '00000000-0000-0000-0000-0000000b0a01', '00000000-0000-0000-0000-0000000b0b01', 'the punch items fixed', public.app_today() + 5, 'office'),
  ('00000000-0000-0000-0000-0000000b0702', '00000000-0000-0000-0000-0000000b0e01', 'start', '00000000-0000-0000-0000-0000000b0a02', '00000000-0000-0000-0000-0000000b0b05', 'the start', public.app_today() + 30, 'office');

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
-- A trade's punch list, one line an item in its order: its words, where, and its state with days from today.
CREATE FUNCTION gbt.punch(p_package uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(
    i.position || ' ' || i.text || coalesce(' @ ' || i.where_on, '')
      || CASE WHEN i.removed_at IS NOT NULL THEN ' removed' || CASE WHEN i.removed_by IS NOT NULL THEN ' by ' || u.name ELSE '' END
              WHEN i.checked_on IS NOT NULL THEN ' checked ' || (i.checked_on - public.app_today()) || CASE WHEN i.checked_by IS NOT NULL THEN ' by ' || c.name ELSE '' END
              WHEN i.fixed_on IS NOT NULL THEN ' fixed ' || (i.fixed_on - public.app_today())
              ELSE ' open' END
      || CASE WHEN i.sent_back_times > 0 THEN ' back ' || i.sent_back_times || ' "' || i.sent_back_note || '"' ELSE '' END,
    E'\n' ORDER BY i.position), '-')
  FROM public.gc_punch_items i
  LEFT JOIN public.users u ON u.id = i.removed_by
  LEFT JOIN public.users c ON c.id = i.checked_by
  WHERE i.package_id = p_package $$;
-- Ridgeway's promises: each kind with its day kept, from today.
CREATE FUNCTION gbt.promises() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(kind || ' ' || coalesce((kept_on - public.app_today())::text, 'open'), ', ' ORDER BY kind)
  FROM public.gc_trade_promises WHERE company_id = '00000000-0000-0000-0000-0000000b0e01' $$;
CREATE FUNCTION gbt.item(p_text text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_punch_items WHERE text = p_text $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions: invoker's rights; signed-out callers run none; the trade's press is the service role's alone.
SELECT gbt.same('every press runs with the caller''s rights',
  (SELECT string_agg(proname || ':' || prosecdef, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('gc_add_punch_item', 'gc_remove_punch_item', 'gc_check_punch_item', 'gc_punch_fixed_ask', 'gc_trade_punch_fixed', 'gc_punch_fixed_in', 'gc_accept_work', 'gc_save_daily_log')),
  'gc_accept_work:false,gc_add_punch_item:false,gc_check_punch_item:false,gc_punch_fixed_ask:false,gc_punch_fixed_in:false,gc_remove_punch_item:false,gc_save_daily_log:false,gc_trade_punch_fixed:false');
SELECT gbt.same('who may run each: signed out / signed in / the service role',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_add_punch_item(jsonb)', 'public.gc_remove_punch_item(uuid)', 'public.gc_check_punch_item(uuid, boolean, text)', 'public.gc_punch_fixed_in(uuid)', 'public.gc_punch_fixed_ask(uuid, uuid)', 'public.gc_trade_punch_fixed(uuid, uuid)']) f),
  'public.gc_add_punch_item(jsonb):false/true/true,public.gc_remove_punch_item(uuid):false/true/true,public.gc_check_punch_item(uuid, boolean, text):false/true/true,public.gc_punch_fixed_in(uuid):false/true/true,public.gc_punch_fixed_ask(uuid, uuid):false/true/true,public.gc_trade_punch_fixed(uuid, uuid):false/false/true');
SELECT gbt.same('a signed-in caller may not delete a punch item, only take it off',
  has_table_privilege('authenticated', 'public.gc_punch_items', 'DELETE') || '/' || has_table_privilege('authenticated', 'public.gc_punch_items', 'UPDATE'), 'false/true');

SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d01');
SET LOCAL ROLE authenticated;

-- 1. Adding: three items on Concrete, the words tidied, each after the last.
SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', '  Patch   the slab edge ', 'where', ' Grid  C-4 '));
SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', 'Grind the high spot by the door'));
SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', 'Seal the expansion joint', 'photoUrl', 'https://drive.google.com/file/d/joint'));
SELECT gbt.same('three items on Concrete, in order', gbt.punch('00000000-0000-0000-0000-0000000b0b01'),
  E'0 Patch the slab edge @ Grid C-4 open\n1 Grind the high spot by the door open\n2 Seal the expansion joint open');
SELECT gbt.same('who added it, when, and its photo', (SELECT (added_by = '00000000-0000-0000-0000-0000000b0d01') || ' ' || (added_on - public.app_today()) || ' ' || coalesce(photo_url, '-') FROM public.gc_punch_items WHERE id = gbt.item('Seal the expansion joint')),
  'true 0 https://drive.google.com/file/d/joint');
SELECT gbt.refused('our own crew', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b04', 'text', 'Cap the cleanout'))$s$, 'Our own crew has no punch list here');
SELECT gbt.refused('a statement of work not signed', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b03', 'text', 'Label the panel'))$s$, 'Their statement of work is not signed yet');
SELECT gbt.refused('work accepted already', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b02', 'text', 'Shim the header'))$s$, 'under their warranty');
SELECT gbt.refused('a job still bidding', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b05', 'text', 'Point the joints'))$s$, 'for a job we are building');
SELECT gbt.refused('blank words', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', '   '))$s$, 'Say what is left to fix');
SELECT gbt.refused('no such trade', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0bff', 'text', 'Anything'))$s$, 'No trade with that id');

-- 2. Taking one off, added by mistake: kept with who and when, never deleted, and only while untouched.
SELECT public.gc_remove_punch_item(gbt.item('Grind the high spot by the door'));
SELECT gbt.same('the item is kept, taken off by the dev', gbt.punch('00000000-0000-0000-0000-0000000b0b01'),
  E'0 Patch the slab edge @ Grid C-4 open\n1 Grind the high spot by the door removed by Punch Dev\n2 Seal the expansion joint open');
SELECT gbt.refused('taken off twice', format('SELECT public.gc_remove_punch_item(%L)', gbt.item('Grind the high spot by the door')), 'No punch item with that id');
SELECT gbt.refused('a delete, which is not ours to make', format('DELETE FROM public.gc_punch_items WHERE id = %L', gbt.item('Patch the slab edge')), 'permission denied');
SELECT gbt.refused('checking one nobody said is fixed', format('SELECT public.gc_check_punch_item(%L, true)', gbt.item('Patch the slab edge')), 'Only an item they say is fixed gets checked');

-- 3. The trade marks one fixed from its portal, as the service role.
RESET ROLE;
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_punch_fixed('00000000-0000-0000-0000-0000000b0e01', gbt.item('Patch the slab edge'));
SELECT gbt.same('fixed today, one still open, so the promise waits', gbt.punch('00000000-0000-0000-0000-0000000b0b01') || E'\n' || gbt.promises(),
  E'0 Patch the slab edge @ Grid C-4 fixed 0\n1 Grind the high spot by the door removed by Punch Dev\n2 Seal the expansion joint open\npunch open, start open');
SELECT gbt.trade_refused('fixed twice', format('SELECT public.gc_trade_punch_fixed(%L, %L)', '00000000-0000-0000-0000-0000000b0e01', gbt.item('Patch the slab edge')), 'punchNotOpen', 'That item is marked fixed already.');
SELECT gbt.trade_refused('another company', format('SELECT public.gc_trade_punch_fixed(%L, %L)', '00000000-0000-0000-0000-0000000b0e02', gbt.item('Seal the expansion joint')), 'notOnTrade', 'Only the company we awarded this trade can fix its punch items.');
SELECT gbt.trade_refused('an item taken off', format('SELECT public.gc_trade_punch_fixed(%L, %L)', '00000000-0000-0000-0000-0000000b0e01', gbt.item('Grind the high spot by the door')), 'notFound', 'No punch item with that id.');
SELECT gbt.trade_refused('no such item', $s$SELECT public.gc_trade_punch_fixed('00000000-0000-0000-0000-0000000b0e01', '00000000-0000-0000-0000-0000000b06ff')$s$, 'notFound', 'No punch item with that id.');
RESET ROLE;
-- An item on a job no longer being built: the trade fixes nothing there.
INSERT INTO public.gc_punch_items (id, project_id, package_id, text, added_on) VALUES
  ('00000000-0000-0000-0000-0000000b0601', '00000000-0000-0000-0000-0000000b0a02', '00000000-0000-0000-0000-0000000b0b05', 'Point the joints', public.app_today());
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a job not being built', $s$SELECT public.gc_trade_punch_fixed('00000000-0000-0000-0000-0000000b0e01', '00000000-0000-0000-0000-0000000b0601')$s$, 'jobNotBuilding', 'Punch items are fixed while we build the job.');
RESET ROLE;
DELETE FROM public.gc_punch_items WHERE id = '00000000-0000-0000-0000-0000000b0601';

-- 4. The office checks it: not fixed, back to the trade with what is still wrong, counted.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('sent back with no words', format('SELECT public.gc_check_punch_item(%L, false, %L)', gbt.item('Patch the slab edge'), '  '), 'Say what is still wrong');
SELECT gbt.refused('neither fixed nor not', format('SELECT public.gc_check_punch_item(%L, NULL)', gbt.item('Patch the slab edge')), 'Say whether it is fixed');
SELECT public.gc_check_punch_item(gbt.item('Patch the slab edge'), false, 'The edge still crumbles.');
SELECT gbt.same('back to the trade, once, with the note', gbt.punch('00000000-0000-0000-0000-0000000b0b01'),
  E'0 Patch the slab edge @ Grid C-4 open back 1 "The edge still crumbles."\n1 Grind the high spot by the door removed by Punch Dev\n2 Seal the expansion joint open');
SELECT gbt.refused('an item sent back is not taken off', format('SELECT public.gc_remove_punch_item(%L)', gbt.item('Patch the slab edge')), 'They have worked on this item already');

-- 5. The trade says by phone that both are fixed; the office records it, and the last one keeps the punch promise.
SELECT public.gc_punch_fixed_in(gbt.item('Patch the slab edge'));
SELECT gbt.refused('recorded fixed twice', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Patch the slab edge')), 'It is marked fixed already. Check it.');
SELECT gbt.same('one still open: the promise waits', gbt.promises(), 'punch open, start open');
SELECT public.gc_punch_fixed_in(gbt.item('Seal the expansion joint'));
SELECT gbt.same('the last one fixed keeps the punch promise, today; the start on Masonry stays open', gbt.promises(), 'punch 0, start open');
SELECT gbt.refused('an item taken off, on the office''s word', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Grind the high spot by the door')), 'No punch item with that id');

-- 6. Accept the work waits on every item but the one taken off, then goes.
SELECT gbt.refused('accepted with two fixed, not checked', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000b0b01')$s$, 'Their punch list has 2 items to fix or check first');
SELECT public.gc_check_punch_item(gbt.item('Patch the slab edge'), true);
SELECT public.gc_check_punch_item(gbt.item('Seal the expansion joint'), true, 'Looks right.');
SELECT gbt.refused('checked twice', format('SELECT public.gc_check_punch_item(%L, true)', gbt.item('Seal the expansion joint')), 'It is checked already');
SELECT gbt.same('both checked by the dev; the one taken off stays as it was', gbt.punch('00000000-0000-0000-0000-0000000b0b01'),
  E'0 Patch the slab edge @ Grid C-4 checked 0 by Punch Dev back 1 "The edge still crumbles."\n1 Grind the high spot by the door removed by Punch Dev\n2 Seal the expansion joint checked 0 by Punch Dev');
SELECT gbt.same('the work is accepted: the item taken off held nothing up', public.gc_accept_work('00000000-0000-0000-0000-0000000b0b01')::text, public.app_today()::text);
SELECT gbt.refused('added after the work was accepted', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', 'One more'))$s$, 'under their warranty');

-- 7. Who may not.
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d02');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account adds', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b02', 'text', 'x'))$s$, 'A training account cannot add to a punch list');
SELECT gbt.refused('a training account takes off', format('SELECT public.gc_remove_punch_item(%L)', gbt.item('Seal the expansion joint')), 'A training account cannot take an item off a punch list');
SELECT gbt.refused('a training account checks', format('SELECT public.gc_check_punch_item(%L, true)', gbt.item('Seal the expansion joint')), 'A training account cannot check a punch item');
SELECT gbt.refused('a training account records one fixed', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Seal the expansion joint')), 'A training account cannot record a punch item fixed');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d03');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin adds', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b02', 'text', 'x'))$s$, 'A digital twin cannot add to a punch list');
SELECT gbt.refused('a digital twin records one fixed', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Seal the expansion joint')), 'A digital twin cannot record a punch item fixed');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d04');
SET LOCAL ROLE authenticated;
-- An estimator reads the job's trades (door 1) but no statement of work and no punch item: Building's and the
-- Board's tables let only a dev in while they are built.
SELECT gbt.refused('an estimator adds, reading no statement of work', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', 'x'))$s$, 'Their statement of work is not signed yet');
SELECT gbt.refused('an estimator checks, reading no punch item', format('SELECT public.gc_check_punch_item(%L, true)', gbt.item('Seal the expansion joint')), 'No punch item with that id');
SELECT gbt.refused('an estimator records one fixed, reading no punch item', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Seal the expansion joint')), 'No punch item with that id');
SELECT gbt.refused('a signed-in caller of the trade''s press', $s$SELECT public.gc_trade_punch_fixed('00000000-0000-0000-0000-0000000b0e01', '00000000-0000-0000-0000-0000000b06ff')$s$, 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
