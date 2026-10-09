-- The submittal register's presses (v2.5037, the Building lane's U4a): gc_add_submittal numbers a
-- submittal by its spec section and keeps the work it holds; gc_submittal_came_in, gc_send_submittal_to_architect
-- and gc_answer_submittal walk its rounds; gc_trade_submittal_send is the trade's round from its portal. Each
-- refuses in words what the prototype's reducer refuses, and the last round a trade owed keeps its promise.
-- A training account, a digital twin and a role outside Building's dev door are refused; the trade's verb is
-- the service role's only. Presses run through RLS, the fixture made as postgres; everything runs inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with "gc_building PASSED". See
-- scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, and an estimator (no policy on
-- Building's tables while they are built).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@submittals.test'),
  ('00000000-0000-0000-0000-0000000007d2', 'trainee@submittals.test'),
  ('00000000-0000-0000-0000-0000000007d3', 'twin@submittals.test'),
  ('00000000-0000-0000-0000-0000000007d4', 'estimator@submittals.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@submittals.test', 'Submittals Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000007d2', 'trainee@submittals.test', 'Submittals Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000007d3', 'twin@submittals.test', 'Submittals Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000007d4', 'estimator@submittals.test', 'Submittals Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000007d2';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000007d3';

-- One GC job being built: Concrete awarded to Ridgeway Concrete, Steel still asked of Halverson Steel and
-- not awarded, and our own Plumbing. Concrete holds two scope lines, Steel one.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000007c1', 'Submittals Test Owner', '00000000-0000-0000-0000-0000000007d1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000007a1', 'Submittals test A', '00000000-0000-0000-0000-0000000007c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES ('00000000-0000-0000-0000-0000000007a1', 'building', public.app_today() - 3);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000007e1', 'Ridgeway Concrete', ARRAY['Concrete']),
  ('00000000-0000-0000-0000-0000000007e2', 'Halverson Steel', ARRAY['Steel']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007a1', 'Steel', 1, false),
  ('00000000-0000-0000-0000-0000000007b3', '00000000-0000-0000-0000-0000000007a1', 'Plumbing', 2, true);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000007f1', '00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007e1'),
  ('00000000-0000-0000-0000-0000000007f2', '00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007e2');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000007f1', awarded_on = public.app_today() - 10
WHERE id = '00000000-0000-0000-0000-0000000007b1';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-000000070001', '00000000-0000-0000-0000-0000000007b1', 'Footings', 0),
  ('00000000-0000-0000-0000-000000070002', '00000000-0000-0000-0000-0000000007b1', 'Slab', 1),
  ('00000000-0000-0000-0000-000000070003', '00000000-0000-0000-0000-0000000007b2', 'Frame', 0);
-- Ridgeway gave a day to send its submittals.
INSERT INTO public.gc_trade_promises (company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-0000000007e1', 'submittals', '00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000007b1', 'the concrete submittals', public.app_today() + 7, 'office');
-- The email gc-architect-email logs for a send.
INSERT INTO public.email_send_log (id) VALUES ('00000000-0000-0000-0000-0000000007ee');

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
-- A submittal on job A by its number.
CREATE FUNCTION gbt.sub(p_number text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_submittals WHERE project_id = '00000000-0000-0000-0000-0000000007a1' AND number = p_number $$;
-- A submittal as the window sends it, for Concrete unless `extra` says otherwise.
CREATE FUNCTION gbt.add(title text, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000007b1', 'title', title, 'kind', 'product data', 'lineIds', '[]'::jsonb, 'leadDays', 0) || extra $$;
-- What job A's register reads: each submittal's number, whose move, the work it holds and its rounds.
CREATE FUNCTION gbt.register() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(
    s.number || ' ' || public.gc_submittal_move(s.id)
      || ' holds ' || coalesce((SELECT string_agg(i.label, ',' ORDER BY i.position) FROM public.gc_submittal_holds h JOIN public.gc_scope_items i ON i.id = h.scope_item_id WHERE h.submittal_id = s.id), '-')
      || ' rounds ' || coalesce((SELECT string_agg(r.round || ':' || r.sent_by || ':' || r.file_name || CASE WHEN r.to_architect_on IS NOT NULL THEN ':sent' ELSE '' END || coalesce(':' || r.answer, ''), ',' ORDER BY r.round) FROM public.gc_submittal_rounds r WHERE r.submittal_id = s.id), '-'),
    E'\n' ORDER BY s.number)
  FROM public.gc_submittals s WHERE s.project_id = '00000000-0000-0000-0000-0000000007a1' $$;
-- Ridgeway's promise to send its submittals: open, or kept on a day counted from today.
CREATE FUNCTION gbt.promise() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce('kept ' || (kept_on - public.app_today()), 'open') FROM public.gc_trade_promises
  WHERE company_id = '00000000-0000-0000-0000-0000000007e1' AND kind = 'submittals' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions themselves: invoker's rights; the office's presses for signed-in callers, the trade's for the
-- service role only.
SELECT gbt.same('every press runs with the caller''s rights',
  (SELECT string_agg(proname || ':' || prosecdef, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('gc_submittal_move', 'gc_add_submittal', 'gc_submittal_came_in', 'gc_send_submittal_to_architect', 'gc_answer_submittal', 'gc_trade_submittal_send')),
  'gc_add_submittal:false,gc_answer_submittal:false,gc_send_submittal_to_architect:false,gc_submittal_came_in:false,gc_submittal_move:false,gc_trade_submittal_send:false');
SELECT gbt.same('a signed-out caller runs none of them',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE'), ',') FROM unnest(ARRAY['public.gc_add_submittal(jsonb)', 'public.gc_submittal_came_in(jsonb)', 'public.gc_send_submittal_to_architect(uuid, uuid)', 'public.gc_answer_submittal(uuid, text, text)', 'public.gc_trade_submittal_send(uuid, uuid, text, text, text)']) f),
  'public.gc_add_submittal(jsonb):false,public.gc_submittal_came_in(jsonb):false,public.gc_send_submittal_to_architect(uuid, uuid):false,public.gc_answer_submittal(uuid, text, text):false,public.gc_trade_submittal_send(uuid, uuid, text, text, text):false');
SELECT gbt.same('a signed-in caller runs the office''s presses, not the trade''s',
  (SELECT string_agg(f || ':' || has_function_privilege('authenticated', f, 'EXECUTE'), ',') FROM unnest(ARRAY['public.gc_add_submittal(jsonb)', 'public.gc_submittal_came_in(jsonb)', 'public.gc_send_submittal_to_architect(uuid, uuid)', 'public.gc_answer_submittal(uuid, text, text)', 'public.gc_trade_submittal_send(uuid, uuid, text, text, text)']) f),
  'public.gc_add_submittal(jsonb):true,public.gc_submittal_came_in(jsonb):true,public.gc_send_submittal_to_architect(uuid, uuid):true,public.gc_answer_submittal(uuid, text, text):true,public.gc_trade_submittal_send(uuid, uuid, text, text, text):false');
SELECT gbt.same('the service role runs the trade''s', has_function_privilege('service_role', 'public.gc_trade_submittal_send(uuid, uuid, text, text, text)', 'EXECUTE')::text, 'true');

SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;

-- Three on Concrete: two numbered by their spec section, one plainly by the register's count.
SELECT public.gc_add_submittal(gbt.add('Rebar shop drawings', jsonb_build_object('kind', 'shop drawings', 'specSection', ' 03 21 00 ', 'leadDays', 10.4,
  'lineIds', jsonb_build_array('00000000-0000-0000-0000-000000070002', '00000000-0000-0000-0000-000000070001', '00000000-0000-0000-0000-000000070002'))));
SELECT public.gc_add_submittal(gbt.add('Rebar mill certificates', jsonb_build_object('specSection', '03 21 00')));
SELECT public.gc_add_submittal(gbt.add('Concrete mix design', jsonb_build_object('lineIds', jsonb_build_array('00000000-0000-0000-0000-000000070002'), 'leadDays', -4,
  'neededBy', to_char(public.app_today() + 20, 'YYYY-MM-DD'))));
SELECT gbt.same('the register numbers by section, then plainly, each the trade''s move', gbt.register(),
  E'003 trade holds Slab rounds -\n03 21 00-01 trade holds Footings,Slab rounds -\n03 21 00-02 trade holds - rounds -');
SELECT gbt.same('what a new submittal keeps', (SELECT string_agg(number || ' ' || kind || ' lead ' || lead_days || ' needed ' || coalesce((needed_by - public.app_today())::text, '-') || ' asked ' || (asked_on - public.app_today()) || ' by ' || (created_by = '00000000-0000-0000-0000-0000000007d1'), E'\n' ORDER BY number) FROM public.gc_submittals),
  E'003 product data lead 0 needed 20 asked 0 by true\n03 21 00-01 shop drawings lead 10 needed - asked 0 by true\n03 21 00-02 product data lead 0 needed - asked 0 by true');

-- The refusals of a new submittal, in words.
SELECT gbt.refused('our own crew''s trade', $s$SELECT public.gc_add_submittal(gbt.add('Water heaters', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000007b3')))$s$, 'Our own crew sends no submittals');
SELECT gbt.refused('a trade not awarded', $s$SELECT public.gc_add_submittal(gbt.add('Steel shop drawings', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000007b2')))$s$, 'This trade is not awarded yet');
SELECT gbt.refused('a blank title', $s$SELECT public.gc_add_submittal(gbt.add('   '))$s$, 'Say what the submittal covers');
SELECT gbt.refused('a kind the register does not know', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs', jsonb_build_object('kind', 'brochure')))$s$, 'Pick product data, shop drawings or samples');
SELECT gbt.refused('a hold on another trade''s work', $s$SELECT public.gc_add_submittal(gbt.add('Anchor bolts', jsonb_build_object('lineIds', jsonb_build_array('00000000-0000-0000-0000-000000070003'))))$s$, 'holds only its own trade');
SELECT gbt.refused('no trade named', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs', jsonb_build_object('packageId', '')))$s$, 'Which trade the submittal is for is missing');
SELECT gbt.refused('a trade that does not exist', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000007ff')))$s$, 'No trade with that id');

-- One submittal's rounds, as the office walks them: nothing to send or answer before it comes in.
SELECT gbt.refused('send before anything came in', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01'))$s$, 'Nothing has come in from the trade to send');
SELECT gbt.refused('an answer before anything came in', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'approved')$s$, 'Nothing is with the architect');
SELECT gbt.refused('a round with no file', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', ' '))$s$, 'Name the file that came in');
SELECT gbt.refused('no submittal named', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('file', 'rebar.pdf'))$s$, 'Which submittal this is for is missing');
SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', ' rebar-shop-r1.pdf ', 'driveUrl', 'https://drive.google.com/file/d/r1', 'note', 'Laps per S-201.'));
SELECT gbt.same('the round that came by email', (SELECT round || ' ' || sent_by || ' ' || file_name || ' ' || drive_url || ' ' || note || ' ' || (sent_on - public.app_today()) || ' ' || (recorded_by = '00000000-0000-0000-0000-0000000007d1') FROM public.gc_submittal_rounds WHERE submittal_id = gbt.sub('03 21 00-01')),
  '1 office rebar-shop-r1.pdf https://drive.google.com/file/d/r1 Laps per S-201. 0 true');
SELECT gbt.same('two still owed: the promise stays open', gbt.promise(), 'open');
SELECT gbt.refused('a second round while it is ours', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', 'rebar.pdf'))$s$, 'It came in already. Send it to the architect next');
SELECT gbt.refused('an answer before it went to the architect', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'approved')$s$, 'It has not gone to the architect yet');
SELECT gbt.same('sent another way, today', (public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01')) - public.app_today())::text, '0');
SELECT gbt.refused('sent twice', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01'))$s$, 'It went to the architect already');
SELECT gbt.refused('a round while it is with the architect', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', 'rebar.pdf'))$s$, 'It is with the architect. Record their answer next');
SELECT gbt.refused('an answer the register does not know', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'maybe')$s$, 'Pick approved, approved as noted or revise');
SELECT gbt.refused('revise with nothing to change', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'revise', '  ')$s$, 'Say what to change before you send it back');
SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'revise', ' Show the lap splices. ');
SELECT gbt.same('revise makes it the trade''s move again', public.gc_submittal_move(gbt.sub('03 21 00-01')), 'trade');
SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', 'rebar-shop-r2.pdf'));
SELECT public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01'), '00000000-0000-0000-0000-0000000007ee');
SELECT gbt.same('the email that took round 2 is kept on it', (SELECT string_agg(round || ':' || coalesce(email_send_log_id::text, '-') || ':' || answer_note, ',' ORDER BY round) FROM public.gc_submittal_rounds WHERE submittal_id = gbt.sub('03 21 00-01')),
  '1:-:Show the lap splices.,2:00000000-0000-0000-0000-0000000007ee:');
SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'approved as noted', 'Field verify the dowels.');
SELECT gbt.refused('a round once approved', $s$SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', gbt.sub('03 21 00-01'), 'file', 'rebar.pdf'))$s$, 'It is approved already');
SELECT gbt.refused('a send once approved', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('03 21 00-01'))$s$, 'It is approved already');
SELECT gbt.refused('an answer once approved', $s$SELECT public.gc_answer_submittal(gbt.sub('03 21 00-01'), 'revise', 'Again.')$s$, 'It is approved already');
SELECT gbt.refused('a submittal that does not exist', $s$SELECT public.gc_answer_submittal('00000000-0000-0000-0000-0000000007ff', 'approved')$s$, 'No submittal with that id');

-- The trade's round from its portal, as the service role, after the submit function turned the link into
-- its company. A refusal is a key and its reason.
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a submittal that does not exist', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007ff', 'certs.pdf')$s$, 'notFound', 'No submittal with that id.');
SELECT gbt.trade_refused('another company', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e2', gbt.sub('03 21 00-02'), 'certs.pdf')$s$, 'notYours', 'That submittal is on another company’s work.');
SELECT gbt.trade_refused('no file', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('03 21 00-02'), '  ')$s$, 'fileNeeded', 'Name the file you are sending.');
SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('03 21 00-02'), 'certs.pdf', 'https://drive.google.com/file/d/certs', 'Mill certs, heat 4471.');
SELECT gbt.trade_refused('a second round while it is ours', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('03 21 00-02'), 'certs.pdf')$s$, 'notYourMove', 'It came in already. It is with us or the architect now.');
SELECT gbt.trade_refused('a round once approved', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('03 21 00-01'), 'rebar.pdf')$s$, 'notYourMove', 'It is approved already.');
SELECT gbt.same('one still owed: the promise stays open', gbt.promise(), 'open');
SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('003'), 'mix.pdf');
SELECT gbt.same('the last one owed keeps the promise today', gbt.promise(), 'kept 0');
SELECT gbt.same('the register after the rounds', gbt.register(),
  E'003 us holds Slab rounds 1:trade:mix.pdf\n03 21 00-01 approved holds Footings,Slab rounds 1:office:rebar-shop-r1.pdf:sent:revise,2:office:rebar-shop-r2.pdf:sent:approved as noted\n03 21 00-02 us holds - rounds 1:trade:certs.pdf');

-- Who may not.
RESET ROLE;
SELECT gbt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a caller signed out', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs'))$s$, 'Sign in first');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account adds', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs'))$s$, 'A training account cannot add a submittal');
SELECT gbt.refused('a training account records', $s$SELECT public.gc_answer_submittal(gbt.sub('003'), 'approved')$s$, 'A training account cannot record a submittal');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin adds', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs'))$s$, 'A digital twin cannot add a submittal');
SELECT gbt.refused('a digital twin records', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('003'))$s$, 'A digital twin cannot record a submittal');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d4');
SET LOCAL ROLE authenticated;
-- An estimator reads the job but neither adds nor sees a submittal: Building's tables let only a dev in.
SELECT gbt.refused('an estimator adds, outside Building''s dev door', $s$SELECT public.gc_add_submittal(gbt.add('Rebar chairs'))$s$, 'row-level security');
SELECT gbt.refused('an estimator records, outside the door', $s$SELECT public.gc_send_submittal_to_architect(gbt.sub('003'))$s$, 'No submittal with that id');
SELECT gbt.refused('a signed-in caller cannot be the trade', $s$SELECT public.gc_trade_submittal_send('00000000-0000-0000-0000-0000000007e1', gbt.sub('003'), 'mix.pdf')$s$, 'permission denied');
RESET ROLE;

-- A number a removed submittal left is skipped, never taken twice.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_add_submittal(gbt.add('Curing compound', jsonb_build_object('specSection', '03 39 00')));
SELECT public.gc_add_submittal(gbt.add('Sealer', jsonb_build_object('specSection', '03 39 00')));
RESET ROLE;
DELETE FROM public.gc_submittals WHERE id = gbt.sub('03 39 00-01');
SET LOCAL ROLE authenticated;
SELECT public.gc_add_submittal(gbt.add('Joint filler', jsonb_build_object('specSection', '03 39 00')));
RESET ROLE;
SELECT gbt.same('the section''s count skips the number still taken', (SELECT string_agg(number || ' ' || title, ',' ORDER BY number) FROM public.gc_submittals WHERE spec_section = '03 39 00'),
  '03 39 00-02 Sealer,03 39 00-03 Joint filler');
SELECT gbt.same('nobody but the dev and the trade wrote a round', gbt.register(),
  E'003 us holds Slab rounds 1:trade:mix.pdf\n03 21 00-01 approved holds Footings,Slab rounds 1:office:rebar-shop-r1.pdf:sent:revise,2:office:rebar-shop-r2.pdf:sent:approved as noted\n03 21 00-02 us holds - rounds 1:trade:certs.pdf\n03 39 00-02 trade holds - rounds -\n03 39 00-03 trade holds - rounds -');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
