-- The bids of the day, the ground (punch list #445, migration *_bid_day_ground): the beat by bid, the list a person
-- keeps and the read of a person's own day. An estimator's beats land in five-minute buckets and stop at the cap;
-- a person in training mode, a twin and nobody write none; no client writes the beat's table; the beat is read by
-- the person, the owner, a dev and an app activity viewer and by nobody else; the day's read holds the person's own
-- changes and not another's, counts the app's own writes apart and leaves yesterday out; the list is kept, changed
-- and read back, is refused for an old day, and is read by whoever reads the person's clock sessions.
-- Everything rolls back. Raises on the first failed assertion; ends with "bid_day PASSED". See scripts/pgtest-bid-day.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Wendi and Kim (estimators), Rosa (assistant), Marcus (helper), Mo (the master), Dee (dev), Tess (an estimator in
-- training mode), Robo (a twin with the estimator role).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000bda01', 'wendi@bidday.test'),
  ('00000000-0000-0000-0000-0000000bda02', 'kim@bidday.test'),
  ('00000000-0000-0000-0000-0000000bda03', 'rosa@bidday.test'),
  ('00000000-0000-0000-0000-0000000bda04', 'marcus@bidday.test'),
  ('00000000-0000-0000-0000-0000000bda05', 'mo@bidday.test'),
  ('00000000-0000-0000-0000-0000000bda06', 'dee@bidday.test'),
  ('00000000-0000-0000-0000-0000000bda07', 'tess@bidday.test'),
  ('00000000-0000-0000-0000-0000000bda08', 'robo@bidday.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000bda01', 'wendi@bidday.test', 'Bidday Wendi', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000bda02', 'kim@bidday.test', 'Bidday Kim', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000bda03', 'rosa@bidday.test', 'Bidday Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000bda04', 'marcus@bidday.test', 'Bidday Marcus', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000bda05', 'mo@bidday.test', 'Bidday Mo', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000bda06', 'dee@bidday.test', 'Bidday Dee', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000bda07', 'tess@bidday.test', 'Bidday Tess', 'estimator', true, false),
  ('00000000-0000-0000-0000-0000000bda08', 'robo@bidday.test', 'Bidday Robo', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000bdb01', 'Bidday Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000bdc01', '00000000-0000-0000-0000-0000000bda05', 'Ridgeway Builders');
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, bid_number, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000bdd01', '00000000-0000-0000-0000-0000000bda03', '00000000-0000-0000-0000-0000000bda01', '00000000-0000-0000-0000-0000000bdb01', 'Ridgeway Clinic', '412', '00000000-0000-0000-0000-0000000bdc01'),
  ('00000000-0000-0000-0000-0000000bdd02', '00000000-0000-0000-0000-0000000bda03', '00000000-0000-0000-0000-0000000bda02', '00000000-0000-0000-0000-0000000bdb01', 'Harbor Lofts', '398', '00000000-0000-0000-0000-0000000bdc01');

-- The ledger, written here as the trigger would write it. The bids rows above made rows of their own (changed_by
-- null, since nobody is signed in yet), which belong to nobody's day.
--   Wendi changed B1 twice just now, and the app wrote B2 once in her name (the Labor tab's sync on open).
--   Wendi changed B2 two days ago. Kim changed B2 just now.
-- The old row goes in first: the ledger's id grows with time, and the day's read leans on that.
INSERT INTO public.bid_changes (bid_id, table_name, record_id, op, changed, changed_by, changed_at, by_app) VALUES
  ('00000000-0000-0000-0000-0000000bdd02', 'bids', '00000000-0000-0000-0000-0000000bdd02', 'update', '{notes}', '00000000-0000-0000-0000-0000000bda01', now() - interval '2 days', false);
INSERT INTO public.bid_changes (bid_id, table_name, record_id, op, changed, changed_by, changed_at, by_app) VALUES
  ('00000000-0000-0000-0000-0000000bdd01', 'bids_count_rows', gen_random_uuid(), 'update', '{count}', '00000000-0000-0000-0000-0000000bda01', now(), false),
  ('00000000-0000-0000-0000-0000000bdd01', 'bid_pricing_assignments', gen_random_uuid(), 'insert', '{price_book_entry_id}', '00000000-0000-0000-0000-0000000bda01', now(), NULL),
  ('00000000-0000-0000-0000-0000000bdd02', 'cost_estimate_labor_rows', gen_random_uuid(), 'update', '{rough_in_hrs_per_unit}', '00000000-0000-0000-0000-0000000bda01', now(), true),
  ('00000000-0000-0000-0000-0000000bdd02', 'bids', '00000000-0000-0000-0000-0000000bdd02', 'update', '{notes}', '00000000-0000-0000-0000-0000000bda02', now(), false);
-- Wendi clocked in an hour ago, and one session of hers was revoked.
INSERT INTO public.clock_sessions (user_id, clocked_in_at, work_date, notes) VALUES
  ('00000000-0000-0000-0000-0000000bda01', now() - interval '1 hour', public.app_today(), 'Bids');
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, notes, revoked_at) VALUES
  ('00000000-0000-0000-0000-0000000bda01', now() - interval '3 hours', now() - interval '2 hours', public.app_today(), 'Bids', now());

CREATE SCHEMA bdt;
CREATE FUNCTION bdt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The statement must fail, and its message must hold the given words.
CREATE FUNCTION bdt.refused(label text, stmt text, words text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(lower(words) IN lower(SQLERRM)) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% went through', label;
END $$;
CREATE FUNCTION bdt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The beats the signed-in person can read: "B1 pricing 180; B2 counts 60", or "none".
CREATE FUNCTION bdt.beats() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg('B' || right(a.bid_id::text, 1) || ' ' || a.tab || ' ' || a.active_seconds, '; ' ORDER BY a.bid_id, a.tab)
    FROM public.user_bid_activity a), 'none')
$$;
-- The kept lists the signed-in person can read: "wendi B1 kept app 180; wendi B2 off app -", or "none".
CREATE FUNCTION bdt.lists() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg(split_part(u.email, '@', 1) || ' B' || right(k.bid_id::text, 1) || ' ' || k.state || ' ' || k.source || ' ' || coalesce(k.seen_seconds::text, '-'), '; ' ORDER BY u.email, k.bid_id)
    FROM public.bid_day_entries k JOIN public.users u ON u.id = k.user_id), 'none')
$$;
-- The signed-in person's day, as the read hands it over: each bid with its own changes, the app's and its tables.
CREATE FUNCTION bdt.day_changes() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg('B' || right(c ->> 'bid_id', 1) || ' own ' || (c ->> 'own') || ' app ' || (c ->> 'app') || ' ' || (SELECT string_agg(t, ',') FROM jsonb_array_elements_text(c -> 'tables') AS t), '; ' ORDER BY c ->> 'bid_id')
    FROM jsonb_array_elements(public.get_my_bid_day() -> 'changes') AS c), 'none')
$$;
GRANT USAGE ON SCHEMA bdt TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bdt TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1) The beat
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda01');
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'pricing', 60);
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'pricing', 60);
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'Pricing!', 4000);
SELECT bdt.same('three beats on one bid and tab add up in one bucket, a long one cut to 60 seconds and its tab cleaned', bdt.beats(), 'B1 pricing 180');
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'pricing', 60);
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'pricing', 60);
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'pricing', 60);
SELECT bdt.same('a bucket stops at 300 seconds', bdt.beats(), 'B1 pricing 300');
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd02', NULL, 45);
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd02', 'counts', 0);
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-00000000dead', 'counts', 60);
SELECT public.bump_user_bid_activity(NULL, 'counts', 60);
SELECT bdt.same('a beat with no tab lands on the empty tab; no seconds, a bid that is not there and no bid write nothing and raise nothing', bdt.beats(), 'B1 pricing 300; B2  45');
SELECT bdt.refused('a client writing the beat table', $$INSERT INTO public.user_bid_activity (user_id, bid_id, tab, bucket_at, active_seconds) VALUES ('00000000-0000-0000-0000-0000000bda01', '00000000-0000-0000-0000-0000000bdd01', 'x', now(), 10)$$, 'permission denied');
SELECT bdt.refused('a client changing a beat', $$UPDATE public.user_bid_activity SET active_seconds = 1$$, 'permission denied');

SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda07');
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'pricing', 60);
SELECT bdt.same('a person in training mode writes no beat', bdt.beats(), 'none');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda08');
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'pricing', 60);
SELECT bdt.same('a twin writes no beat', bdt.beats(), 'none');
SELECT bdt.as_user(NULL);
SELECT public.bump_user_bid_activity('00000000-0000-0000-0000-0000000bdd01', 'pricing', 60);

-- Who reads the beat: the Activity tab's rule.
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda02');
SELECT bdt.same('another estimator reads none of her beats', bdt.beats(), 'none');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda03');
SELECT bdt.same('the office reads none with no grant', bdt.beats(), 'none');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda05');
SELECT bdt.same('the owner reads them', bdt.beats(), 'B1 pricing 300; B2  45');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda06');
SELECT bdt.same('a dev reads them', bdt.beats(), 'B1 pricing 300; B2  45');
RESET ROLE;
INSERT INTO public.user_app_activity_viewers (viewer_user_id, granted_by) VALUES ('00000000-0000-0000-0000-0000000bda03', '00000000-0000-0000-0000-0000000bda06');
SET LOCAL ROLE authenticated;
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda03');
SELECT bdt.same('the office reads them once put on the app activity viewers', bdt.beats(), 'B1 pricing 300; B2  45');

-- 2) The read of a day
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda01');
SELECT bdt.same('her day holds her own changes by bid, the app''s write counted apart, and not Kim''s or the day before yesterday''s', bdt.day_changes(),
  'B1 own 2 app 0 bid_pricing_assignments,bids_count_rows; B2 own 0 app 1 cost_estimate_labor_rows');
SELECT bdt.same('... her beats', (SELECT string_agg('B' || right(b ->> 'bid_id', 1) || ' ' || (b ->> 'tab') || ' ' || (b ->> 'seconds'), '; ' ORDER BY b ->> 'bid_id') FROM jsonb_array_elements(public.get_my_bid_day() -> 'beats') AS b), 'B1 pricing 300; B2  45');
SELECT bdt.same('... the names of the bids in it', (SELECT string_agg((b ->> 'bid_number') || ' ' || (b ->> 'project_name'), '; ' ORDER BY b ->> 'bid_number') FROM jsonb_array_elements(public.get_my_bid_day() -> 'bids') AS b), '398 Harbor Lofts; 412 Ridgeway Clinic');
SELECT bdt.same('... her open clock session and not the revoked one', (SELECT count(*)::text || ' ' || bool_and(s ->> 'out' IS NULL)::text FROM jsonb_array_elements(public.get_my_bid_day() -> 'sessions') AS s), '1 true');
SELECT bdt.same('... the company''s day', public.get_my_bid_day() ->> 'day', public.app_today()::text);
SELECT bdt.same('... and nothing kept yet', (public.get_my_bid_day() -> 'kept')::text, '[]');
SELECT bdt.same('the day before yesterday holds her one change of that day', (SELECT string_agg('B' || right(c ->> 'bid_id', 1) || ' own ' || (c ->> 'own'), '; ') FROM jsonb_array_elements(public.get_my_bid_day((public.app_today() - 2)) -> 'changes') AS c),
  'B2 own 1');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda02');
SELECT bdt.same('Kim''s day holds her own change', bdt.day_changes(), 'B2 own 1 app 0 bids');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda04');
SELECT bdt.same('a helper, who reads no bid, reads an empty day', bdt.day_changes(), 'none');
SELECT bdt.as_user(NULL);
SELECT bdt.same('nobody reads no day', coalesce(public.get_my_bid_day()::text, 'null'), 'null');

-- 3) The list
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda01');
SELECT bdt.same('she keeps a list of two, one kept and one taken off', public.save_my_bid_day(public.app_today(), '[
  {"bid_id": "00000000-0000-0000-0000-0000000bdd01", "state": "kept", "source": "app", "seen_seconds": 300, "tabs": ["pricing"], "changes": 2},
  {"bid_id": "00000000-0000-0000-0000-0000000bdd02", "state": "off", "source": "app"},
  {"bid_id": "not-a-bid"}, 7]'::jsonb)::text, '2');
SELECT bdt.same('... and reads it back', bdt.lists(), 'wendi B1 kept app 300; wendi B2 off app -');
SELECT bdt.same('... and the day''s read holds it', (SELECT string_agg('B' || right(k ->> 'bid_id', 1) || ' ' || (k ->> 'state'), '; ' ORDER BY k ->> 'bid_id') FROM jsonb_array_elements(public.get_my_bid_day() -> 'kept') AS k), 'B1 kept; B2 off');
SELECT bdt.same('she puts the second back as her own add, and a bid named twice keeps its last entry', public.save_my_bid_day(public.app_today(), '[
  {"bid_id": "00000000-0000-0000-0000-0000000bdd02", "state": "off", "source": "app"},
  {"bid_id": "00000000-0000-0000-0000-0000000bdd02", "state": "kept", "source": "person"}]'::jsonb)::text, '1');
SELECT bdt.same('... the first is untouched and the second is kept', bdt.lists(), 'wendi B1 kept app 300; wendi B2 kept person -');
SELECT bdt.same('yesterday''s list can be kept', public.save_my_bid_day(public.app_today() - 1, '[{"bid_id": "00000000-0000-0000-0000-0000000bdd01", "state": "kept", "source": "app"}]'::jsonb)::text, '1');
SELECT bdt.refused('a list for the day before yesterday', $$SELECT public.save_my_bid_day(public.app_today() - 2, '[]'::jsonb)$$, 'today''s list and yesterday''s');
SELECT bdt.refused('a list for tomorrow', $$SELECT public.save_my_bid_day(public.app_today() + 1, '[]'::jsonb)$$, 'today''s list and yesterday''s');
SELECT bdt.refused('a list that is not a list', $$SELECT public.save_my_bid_day(public.app_today(), '{}'::jsonb)$$, 'did not arrive as a list');
SELECT bdt.refused('her writing a row in Kim''s name', $$INSERT INTO public.bid_day_entries (user_id, work_date, bid_id, state, source) VALUES ('00000000-0000-0000-0000-0000000bda02', public.app_today(), '00000000-0000-0000-0000-0000000bdd01', 'kept', 'person')$$, 'row-level security');
SELECT bdt.refused('her writing a row for last week', $$INSERT INTO public.bid_day_entries (user_id, work_date, bid_id, state, source) VALUES ('00000000-0000-0000-0000-0000000bda01', public.app_today() - 7, '00000000-0000-0000-0000-0000000bdd01', 'kept', 'person')$$, 'row-level security');
SELECT bdt.refused('her deleting a row of her list', $$DELETE FROM public.bid_day_entries$$, 'permission denied');

SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda04');
SELECT bdt.same('a helper, who reads no bid, keeps none of a list that names one', public.save_my_bid_day(public.app_today(), '[{"bid_id": "00000000-0000-0000-0000-0000000bdd01", "state": "kept", "source": "person"}]'::jsonb)::text, '0');
SELECT bdt.same('... and reads no list', bdt.lists(), 'none');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda07');
SELECT bdt.refused('a person in training mode keeping a list', $$SELECT public.save_my_bid_day(public.app_today(), '[]'::jsonb)$$, 'cannot keep a list');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda08');
SELECT bdt.refused('a twin keeping a list', $$SELECT public.save_my_bid_day(public.app_today(), '[]'::jsonb)$$, 'cannot keep a list');
SELECT bdt.as_user(NULL);
SELECT bdt.refused('nobody keeping a list', $$SELECT public.save_my_bid_day(public.app_today(), '[]'::jsonb)$$, 'Sign in');

-- Who reads a kept list: whoever reads the person's clock sessions.
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda02');
SELECT bdt.same('another estimator reads none of her list', bdt.lists(), 'none');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda03');
SELECT bdt.same('the office reads it', (SELECT count(*)::text FROM public.bid_day_entries), '3');
SELECT bdt.as_user('00000000-0000-0000-0000-0000000bda06');
SELECT bdt.same('a dev reads it', (SELECT count(*)::text FROM public.bid_day_entries), '3');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'bid_day PASSED'; END $$;
ROLLBACK;
