-- Bill day's walk (v2.5265, Messages cut 9): the superintendent's taps on a draw waiting on us, read back as the draw
-- line's we_see the way the Draws window reads a doubted line; a trade's word that it sends nothing this period; the
-- cut-off setting; where a line is on site. The kernels that read them are src/lib/gc/billDay/ (v2.5248). Presses run
-- through RLS as a dev, the controller (the money team reads, and sets the cut-off), an estimator, a dev in training
-- mode and a digital twin; the fixture is made as postgres; everything runs inside one transaction that rolls back.
-- Raises on the first failed assertion; ends with "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, the controller and an estimator.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000bd01', 'dev@walk.test'),
  ('00000000-0000-0000-0000-00000000bd02', 'trainee@walk.test'),
  ('00000000-0000-0000-0000-00000000bd03', 'twin@walk.test'),
  ('00000000-0000-0000-0000-00000000bd04', 'controller@walk.test'),
  ('00000000-0000-0000-0000-00000000bd05', 'estimator@walk.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-00000000bd01', 'dev@walk.test', 'Walk Dev', 'dev'),
  ('00000000-0000-0000-0000-00000000bd02', 'trainee@walk.test', 'Walk Trainee', 'dev'),
  ('00000000-0000-0000-0000-00000000bd03', 'twin@walk.test', 'Walk Twin', 'dev'),
  ('00000000-0000-0000-0000-00000000bd04', 'controller@walk.test', 'Walk Controller', 'controller'),
  ('00000000-0000-0000-0000-00000000bd05', 'estimator@walk.test', 'Walk Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-00000000bd02';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-00000000bd03';

-- A job being built. Mechanical awarded to Lone Star Mechanical with a signed statement of work at 10% retainage:
-- Rough-in, level 1 $58,000 and Equipment $61,000. Its draw 1 waits on us: level 1 to 90% and $4,100 of equipment
-- stored, $56,300 less $5,630 held. Electrical awarded to Kerr Electric, signed, with draw 1 approved. Steel to
-- Alamo Steel, a draft.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-00000000bdc1', 'Walk Test Owner', '00000000-0000-0000-0000-00000000bd01');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-00000000bda1', 'Walk test', '00000000-0000-0000-0000-00000000bdc1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES ('00000000-0000-0000-0000-00000000bda1', 'building', public.app_today() - 60);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-00000000bde1', 'Lone Star Mechanical', ARRAY['Mechanical']),
  ('00000000-0000-0000-0000-00000000bde2', 'Kerr Electric', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000000bde3', 'Alamo Steel', ARRAY['Steel']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-00000000bdb1', '00000000-0000-0000-0000-00000000bda1', 'Mechanical', 0, false),
  ('00000000-0000-0000-0000-00000000bdb2', '00000000-0000-0000-0000-00000000bda1', 'Electrical', 1, false),
  ('00000000-0000-0000-0000-00000000bdb3', '00000000-0000-0000-0000-00000000bda1', 'Steel', 2, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-00000000bdf1', '00000000-0000-0000-0000-00000000bdb1', '00000000-0000-0000-0000-00000000bde1'),
  ('00000000-0000-0000-0000-00000000bdf2', '00000000-0000-0000-0000-00000000bdb2', '00000000-0000-0000-0000-00000000bde2'),
  ('00000000-0000-0000-0000-00000000bdf3', '00000000-0000-0000-0000-00000000bdb3', '00000000-0000-0000-0000-00000000bde3');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-00000000bdf1', awarded_on = public.app_today() - 50 WHERE id = '00000000-0000-0000-0000-00000000bdb1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-00000000bdf2', awarded_on = public.app_today() - 50 WHERE id = '00000000-0000-0000-0000-00000000bdb2';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-00000000bdf3', awarded_on = public.app_today() - 5 WHERE id = '00000000-0000-0000-0000-00000000bdb3';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-0000000bd001', '00000000-0000-0000-0000-00000000bdb1', 'Rough-in, level 1', 0),
  ('00000000-0000-0000-0000-0000000bd002', '00000000-0000-0000-0000-00000000bdb1', 'Equipment', 1),
  ('00000000-0000-0000-0000-0000000bd003', '00000000-0000-0000-0000-00000000bdb2', 'Rough-in', 0),
  ('00000000-0000-0000-0000-0000000bd004', '00000000-0000-0000-0000-00000000bdb3', 'Erection', 0);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-00000000bd51', '00000000-0000-0000-0000-00000000bdb1', '00000000-0000-0000-0000-00000000bdf1', '00000000-0000-0000-0000-00000000bde1', 'signed', 119000, 10, public.app_today() - 48, public.app_today() - 47),
  ('00000000-0000-0000-0000-00000000bd52', '00000000-0000-0000-0000-00000000bdb2', '00000000-0000-0000-0000-00000000bdf2', '00000000-0000-0000-0000-00000000bde2', 'signed', 20000, 10, public.app_today() - 48, public.app_today() - 47),
  ('00000000-0000-0000-0000-00000000bd53', '00000000-0000-0000-0000-00000000bdb3', '00000000-0000-0000-0000-00000000bdf3', '00000000-0000-0000-0000-00000000bde3', 'draft', 90000, 10, NULL, NULL);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-00000000bd61', '00000000-0000-0000-0000-00000000bd51', 0, 'Rough-in, level 1', 58000, '00000000-0000-0000-0000-0000000bd001'),
  ('00000000-0000-0000-0000-00000000bd62', '00000000-0000-0000-0000-00000000bd51', 1, 'Equipment', 61000, '00000000-0000-0000-0000-0000000bd002'),
  ('00000000-0000-0000-0000-00000000bd63', '00000000-0000-0000-0000-00000000bd52', 0, 'Rough-in', 20000, '00000000-0000-0000-0000-0000000bd003'),
  ('00000000-0000-0000-0000-00000000bd64', '00000000-0000-0000-0000-00000000bd53', 0, 'Erection', 90000, '00000000-0000-0000-0000-0000000bd004');
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, approved_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-00000000bd51', 1, public.app_today() - 3, 'requested', 56300, 5630, 50670, NULL, public.app_today() - 3, 'Luis Ortega', public.app_today() - 3),
  ('00000000-0000-0000-0000-00000000bd72', '00000000-0000-0000-0000-00000000bd52', 1, public.app_today() - 9, 'approved', 10000, 1000, 9000, public.app_today() - 2, public.app_today() - 9, 'Dana Kerr', public.app_today() - 9);
INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored) VALUES
  ('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-00000000bd61', 90, 0),
  ('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-00000000bd62', 0, 4100),
  ('00000000-0000-0000-0000-00000000bd72', '00000000-0000-0000-0000-00000000bd63', 50, 0);

CREATE SCHEMA gbw;
CREATE FUNCTION gbw.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbw.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone: the claims auth.uid() reads, and the role auth.role() reads, which app_settings' read policy
-- checks (the card switch's bed signs in the same way). Without it only a dev's own policy sees the cut-off's row.
CREATE FUNCTION gbw.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Lone Star's draw 1 as the Draws window reads it: each line's percent, stored dollars (+) and the percent we see (~).
CREATE FUNCTION gbw.lines() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(l.label || ':' || trim_scale(dl.to_pct) || CASE WHEN dl.stored > 0 THEN '+' || trim_scale(dl.stored) ELSE '' END
                      || coalesce('~' || trim_scale(dl.we_see), ''), ',' ORDER BY l.position)
  FROM public.gc_draw_lines dl JOIN public.gc_sow_lines l ON l.id = dl.sow_line_id
  WHERE dl.draw_id = '00000000-0000-0000-0000-00000000bd71' $$;
-- The newest tap on each of its lines, as the kernels read them (LineCheck): the percent, or on site yes or no.
CREATE FUNCTION gbw.newest() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(label || ':' || coalesce(trim_scale(c.we_see_pct)::text, CASE WHEN c.stored_on_site THEN 'on site' ELSE 'not on site' END), ',' ORDER BY position)
  FROM (SELECT DISTINCT ON (k.sow_line_id) k.*, l.label, l.position
        FROM public.gc_superintendent_checks k JOIN public.gc_sow_lines l ON l.id = k.sow_line_id
        WHERE k.draw_id = '00000000-0000-0000-0000-00000000bd71' ORDER BY k.sow_line_id, k.seq DESC) c $$;
-- The cut-off as the setting holds it.
CREATE FUNCTION gbw.cutoff() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT trim_scale(value_num)::text FROM public.app_settings WHERE key = 'gc_bill_day_cutoff_days' $$;
GRANT USAGE ON SCHEMA gbw TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbw TO authenticated, service_role;

-- The functions, the grants and the fences, as the migration leaves them.
SELECT gbw.same('every function runs with the caller''s rights',
  (SELECT string_agg(DISTINCT prosecdef::text, ',') FROM pg_proc WHERE proname IN ('gc_record_line_check', 'gc_say_nothing_this_period', 'gc_set_bill_day_cutoff')),
  'false');
SELECT gbw.same('who runs each: signed out, signed in',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_record_line_check(uuid, uuid, numeric, boolean, text, text)', 'public.gc_say_nothing_this_period(uuid, date, text)',
     'public.gc_set_bill_day_cutoff(integer)']) f),
  'public.gc_record_line_check(uuid, uuid, numeric, boolean, text, text):false/true,public.gc_say_nothing_this_period(uuid, date, text):false/true,public.gc_set_bill_day_cutoff(integer):false/true');
SELECT gbw.same('the policies on both tables',
  (SELECT string_agg(tablename || '.' || policyname || ':' || permissive || ':' || cmd, ',' ORDER BY tablename, policyname) FROM pg_policies
   WHERE schemaname = 'public' AND tablename IN ('gc_superintendent_checks', 'gc_bill_day_nothing')),
  'gc_bill_day_nothing.digital_twin_write_fence_delete:RESTRICTIVE:DELETE,gc_bill_day_nothing.digital_twin_write_fence_insert:RESTRICTIVE:INSERT,gc_bill_day_nothing.digital_twin_write_fence_update:RESTRICTIVE:UPDATE,gc_bill_day_nothing.gc_bill_day_nothing_dev:PERMISSIVE:ALL,gc_bill_day_nothing.gc_bill_day_nothing_money_read:PERMISSIVE:SELECT,gc_bill_day_nothing.read_only_users_cannot_delete:RESTRICTIVE:DELETE,gc_bill_day_nothing.read_only_users_cannot_insert:RESTRICTIVE:INSERT,gc_bill_day_nothing.read_only_users_cannot_update:RESTRICTIVE:UPDATE,gc_superintendent_checks.digital_twin_write_fence_delete:RESTRICTIVE:DELETE,gc_superintendent_checks.digital_twin_write_fence_insert:RESTRICTIVE:INSERT,gc_superintendent_checks.digital_twin_write_fence_update:RESTRICTIVE:UPDATE,gc_superintendent_checks.gc_superintendent_checks_dev:PERMISSIVE:ALL,gc_superintendent_checks.gc_superintendent_checks_money_read:PERMISSIVE:SELECT,gc_superintendent_checks.read_only_users_cannot_delete:RESTRICTIVE:DELETE,gc_superintendent_checks.read_only_users_cannot_insert:RESTRICTIVE:INSERT,gc_superintendent_checks.read_only_users_cannot_update:RESTRICTIVE:UPDATE');
SELECT gbw.same('the read-only statement trigger on both tables',
  (SELECT string_agg(c.relname || '.' || t.tgname, ',' ORDER BY c.relname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname IN ('gc_superintendent_checks', 'gc_bill_day_nothing') AND NOT t.tgisinternal),
  'gc_bill_day_nothing.read_only_block_stmt,gc_superintendent_checks.read_only_block_stmt');
SELECT gbw.same('a tap stays as it went: signed in may not change or delete one, signed out reaches neither table',
  (SELECT string_agg(t || ':' || has_table_privilege('authenticated', t, 'UPDATE') || '/' || has_table_privilege('authenticated', t, 'DELETE') || '/' || has_table_privilege('anon', t, 'SELECT'), ' ' ORDER BY t)
   FROM unnest(ARRAY['public.gc_bill_day_nothing', 'public.gc_superintendent_checks']) t),
  'public.gc_bill_day_nothing:true/true/false public.gc_superintendent_checks:false/false/false');
SELECT gbw.same('the cut-off starts at 6 days', gbw.cutoff(), '6');

-- 1. Wendi walks Lone Star's draw 1 as a dev: level 1 at 75% with a photo and a note. Under the 90% claimed, so it is
-- the line's we_see, the way the Draws window reads a doubted line.
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd01');
SET LOCAL ROLE authenticated;
SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 75, NULL,
  ' https://drive.example.test/photo-1 ', ' East wing branch lines not hung. ');
RESET ROLE;
SELECT gbw.same('a tap under the claim is the line''s we_see', gbw.lines(), 'Rough-in, level 1:90~75,Equipment:0+4100');
SELECT gbw.same('the tap as it went, with who',
  (SELECT trim_scale(we_see_pct) || '|' || photo_url || '|' || note || '|' || (checked_by = '00000000-0000-0000-0000-00000000bd01') FROM public.gc_superintendent_checks),
  '75|https://drive.example.test/photo-1|East wing branch lines not hung.|true');

-- 2. A tap at the claim clears it, one over the claim never reads above it, and the newest tap counts.
SET LOCAL ROLE authenticated;
SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 90, NULL);
RESET ROLE;
SELECT gbw.same('a tap at the claim clears we_see', gbw.lines(), 'Rough-in, level 1:90,Equipment:0+4100');
SET LOCAL ROLE authenticated;
SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 95, NULL);
RESET ROLE;
SELECT gbw.same('a tap over the claim leaves it clear', gbw.lines(), 'Rough-in, level 1:90,Equipment:0+4100');
SET LOCAL ROLE authenticated;
SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 80, NULL, NULL, 'Most of it hung');
-- 3. The stored equipment, seen in the yard: we_see stays as it was.
SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd002', NULL, true);
RESET ROLE;
SELECT gbw.same('the newest tap counts, and a stored-material tap leaves we_see alone', gbw.lines(), 'Rough-in, level 1:90~80,Equipment:0+4100');
SELECT gbw.same('the newest tap on each line, as the kernels read them', gbw.newest(), 'Rough-in, level 1:80,Equipment:on site');
SELECT gbw.same('every tap is kept', (SELECT count(*)::text FROM public.gc_superintendent_checks), '5');

-- 4. What a tap refuses, in words.
SET LOCAL ROLE authenticated;
SELECT gbw.refused('a tap with no reading', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', NULL, NULL)$s$, 'Give the percent you see, or whether the stored material is on site');
SELECT gbw.refused('a tap with both readings', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd002', 10, true)$s$, 'Give the percent you see, or whether the stored material is on site');
SELECT gbw.refused('a percent over 100', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 101, NULL)$s$, 'The percent you see runs from 0 to 100');
SELECT gbw.refused('on site on a line with nothing stored', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', NULL, false)$s$, 'This line claims no stored material');
SELECT gbw.refused('a line the draw does not claim', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd003', 50, NULL)$s$, 'Check only the lines this pay application claims');
SELECT gbw.refused('a draw already approved', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd72', '00000000-0000-0000-0000-0000000bd003', 40, NULL)$s$, 'Only a pay application waiting on us is walked');
SELECT gbw.refused('no such draw', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-0000000bd999', '00000000-0000-0000-0000-0000000bd001', 40, NULL)$s$, 'No pay application with that id');
SELECT gbw.refused('a tap changed', $s$UPDATE public.gc_superintendent_checks SET we_see_pct = 0$s$, 'permission denied');
SELECT gbw.refused('a tap deleted', $s$DELETE FROM public.gc_superintendent_checks$s$, 'permission denied');
RESET ROLE;

-- 5. Who may not tap: training mode, a twin, the controller (the money team reads the walk, and writes nothing on it).
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd02');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('a training account taps', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 50, NULL)$s$, 'A training account cannot record a check');
SELECT gbw.refused('a training account writes the table itself', $s$INSERT INTO public.gc_bill_day_nothing (sow_id, period_to, said_by) VALUES ('00000000-0000-0000-0000-00000000bd51', '2026-10-25', 'x')$s$, 'Read-only (training) mode');
RESET ROLE;
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd03');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('a digital twin taps', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 50, NULL)$s$, 'A digital twin cannot record a check');
RESET ROLE;
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd04');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('the controller taps', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 50, NULL)$s$, 'Only a dev records a check while Bill day is built');
SELECT gbw.same('the controller reads the walk', (SELECT count(*)::text FROM public.gc_superintendent_checks), '5');
RESET ROLE;
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd05');
SET LOCAL ROLE authenticated;
SELECT gbw.same('an estimator reads none of it', (SELECT count(*)::text FROM public.gc_superintendent_checks), '0');
RESET ROLE;

-- 6. Sent back with nothing named: the line keeps the walk's doubt, and a draw sent back is not walked.
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd01');
SET LOCAL ROLE authenticated;
SELECT public.gc_send_draw_back('00000000-0000-0000-0000-00000000bd71', '{}', 'Line 1, Rough-in, level 1, reads 90%. We see 80%. Send it again.');
RESET ROLE;
SELECT gbw.same('the sent-back line keeps the walk''s doubt', gbw.lines(), 'Rough-in, level 1:90~80,Equipment:0+4100');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('a draw sent back is not walked', $s$SELECT public.gc_record_line_check('00000000-0000-0000-0000-00000000bd71', '00000000-0000-0000-0000-0000000bd001', 85, NULL)$s$, 'Only a pay application waiting on us is walked');

-- 7. Nothing this period: said with who said it, said again replaces who, and Put it back deletes the row.
SELECT public.gc_say_nothing_this_period('00000000-0000-0000-0000-00000000bd52', '2026-10-25', ' Dana Kerr, by phone ');
SELECT public.gc_say_nothing_this_period('00000000-0000-0000-0000-00000000bd52', '2026-10-25', 'Dana Kerr, by text');
RESET ROLE;
SELECT gbw.same('one row for the bill day, with who said it last and who wrote it down',
  (SELECT count(*) || '|' || max(said_by) || '|' || bool_and(recorded_by = '00000000-0000-0000-0000-00000000bd01') FROM public.gc_bill_day_nothing),
  '1|Dana Kerr, by text|true');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('no one said', $s$SELECT public.gc_say_nothing_this_period('00000000-0000-0000-0000-00000000bd52', '2026-10-25', '  ')$s$, 'Say who said it');
SELECT gbw.refused('no bill day', $s$SELECT public.gc_say_nothing_this_period('00000000-0000-0000-0000-00000000bd52', NULL, 'Dana')$s$, 'Say which bill day');
SELECT gbw.refused('a statement of work not signed', $s$SELECT public.gc_say_nothing_this_period('00000000-0000-0000-0000-00000000bd53', '2026-10-25', 'Pat')$s$, 'Only a signed statement of work draws');
SELECT gbw.refused('no such statement of work', $s$SELECT public.gc_say_nothing_this_period('00000000-0000-0000-0000-0000000bd999', '2026-10-25', 'Pat')$s$, 'No statement of work with that id');
RESET ROLE;
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd04');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('the controller records nothing', $s$SELECT public.gc_say_nothing_this_period('00000000-0000-0000-0000-00000000bd52', '2026-11-25', 'Dana')$s$, 'Only a dev records nothing this period while Bill day is built');
SELECT gbw.same('the controller reads it', (SELECT said_by FROM public.gc_bill_day_nothing), 'Dana Kerr, by text');
RESET ROLE;
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd01');
SET LOCAL ROLE authenticated;
DELETE FROM public.gc_bill_day_nothing WHERE sow_id = '00000000-0000-0000-0000-00000000bd52';
RESET ROLE;
SELECT gbw.same('Put it back leaves no row', (SELECT count(*)::text FROM public.gc_bill_day_nothing), '0');

-- 8. The cut-off: a dev and the controller set it, 2 to 20 days; an estimator and training mode may not.
SET LOCAL ROLE authenticated;
SELECT public.gc_set_bill_day_cutoff(8);
RESET ROLE;
SELECT gbw.same('a dev sets the cut-off', gbw.cutoff(), '8');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('a cut-off of 1 day', $s$SELECT public.gc_set_bill_day_cutoff(1)$s$, 'The cut-off is 2 to 20 days before bill day');
SELECT gbw.refused('a cut-off of 21 days', $s$SELECT public.gc_set_bill_day_cutoff(21)$s$, 'The cut-off is 2 to 20 days before bill day');
RESET ROLE;
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd04');
SET LOCAL ROLE authenticated;
SELECT public.gc_set_bill_day_cutoff(7);
RESET ROLE;
SELECT gbw.same('the controller sets the cut-off', gbw.cutoff(), '7');
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd05');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('an estimator sets the cut-off', $s$SELECT public.gc_set_bill_day_cutoff(5)$s$, 'Only the money team sets the cut-off');
-- Behind the function: no policy lets an estimator update the row, so this reaches none.
UPDATE public.app_settings SET value_num = 3 WHERE key = 'gc_bill_day_cutoff_days';
RESET ROLE;
SELECT gbw.same('an estimator cannot set it behind the function', gbw.cutoff(), '7');
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd02');
SET LOCAL ROLE authenticated;
SELECT gbw.refused('a training account sets the cut-off', $s$SELECT public.gc_set_bill_day_cutoff(5)$s$, 'A training account cannot change the cut-off');
RESET ROLE;
SELECT gbw.same('the cut-off stands at what the controller set', gbw.cutoff(), '7');

-- 9. Where a line is on site: a dev names it; a blank is not a place.
SELECT gbw.as_user('00000000-0000-0000-0000-00000000bd01');
SET LOCAL ROLE authenticated;
UPDATE public.gc_sow_lines SET where_on_site = 'Level 1' WHERE id = '00000000-0000-0000-0000-00000000bd61';
SELECT gbw.refused('a blank place', $s$UPDATE public.gc_sow_lines SET where_on_site = '  ' WHERE id = '00000000-0000-0000-0000-00000000bd62'$s$, 'gc_sow_lines_where_said');
RESET ROLE;
SELECT gbw.same('the places as named', (SELECT string_agg(label || ':' || coalesce(where_on_site, '-'), ',' ORDER BY position) FROM public.gc_sow_lines WHERE sow_id = '00000000-0000-0000-0000-00000000bd51'),
  'Rough-in, level 1:Level 1,Equipment:-');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
