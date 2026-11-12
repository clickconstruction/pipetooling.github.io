-- One approvals list (20261112090000, punch list #315): dev_kept_plans and its four functions. Here: a dev keeps a
-- plan and the same plan kept twice answers the row that waits; only the HR file's dry-run doors may be kept; apply
-- runs the stored function with the stored payload as the dev and marks the row applied in one write, and a second
-- press is refused; a function that refuses leaves the plan waiting; a plan is dropped or marked stale only with its
-- reason, and a decided plan never changes; the seat's own apply marks the kept copy by its hash and is not held up
-- by a hash nobody kept; an estimator reads and writes nothing, and nobody writes the table directly. Made-up people
-- and words. Fixtures made as postgres; the doors run as signed-in users through RLS, inside one transaction that
-- rolls back. Raises on the first failed assertion; ends with "dev_kept_plans PASSED". See
-- scripts/pgtest-dev-kept-plans.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA dkp;
CREATE FUNCTION dkp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION dkp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION dkp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the bed reads past RLS: the kept plans in a few words, oldest first.
CREATE FUNCTION dkp.plans() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(right(k.plan_hash, 2) || ' ' || k.state || COALESCE(' (' || k.decided_why || ')', '')
    || CASE WHEN k.decided_by IS NOT NULL THEN ' by ' || (SELECT u.name FROM public.users u WHERE u.id = k.decided_by) ELSE '' END, ' | ' ORDER BY k.kept_at, k.plan_hash, k.state), 'none')
  FROM public.dev_kept_plans k WHERE k.person_id = '00000000-0000-0000-0000-0000000973b1' $$;
CREATE FUNCTION dkp.items() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(i.item_no || ' ' || i.title, ' | ' ORDER BY i.item_no), 'none') FROM public.person_case_items i WHERE i.person_id = '00000000-0000-0000-0000-0000000973b1' $$;
-- A plan to keep: the case door adding one item. The hash is made up here; the seat's code computes the real one.
CREATE FUNCTION dkp.keep(p_title text, p_hash_tail text, p_rpc text DEFAULT 'dev_case_write') RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.dev_kept_plan_keep(jsonb_build_object(
    'person_id', '00000000-0000-0000-0000-0000000973b1', 'verb', 'plan_case', 'rpc', p_rpc,
    'args', jsonb_build_object('case', jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000973b1')),
    'p', jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000973b1', 'items', jsonb_build_array(jsonb_build_object('add', jsonb_build_object('title', p_title)))),
    'plan_hash', repeat('a', 62) || p_hash_tail, 'words', 'Open one item: ' || p_title, 'reads', jsonb_build_object('items', 1), 'session', 'bed session')) $$;
GRANT USAGE ON SCHEMA dkp TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dkp TO authenticated;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000973d1', 'dev@kept.test'),
  ('00000000-0000-0000-0000-0000000973d2', 'estimator@kept.test'),
  ('00000000-0000-0000-0000-0000000973d3', 'owner@kept.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000973d1', 'dev@kept.test', 'Kept Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000973d2', 'estimator@kept.test', 'Kept Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000973d3', 'owner@kept.test', 'Kept Owner', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000973b1', '00000000-0000-0000-0000-0000000973d1', 'helper', 'Pat Sample');

SET LOCAL ROLE authenticated;

-- ── who may ───────────────────────────────────────────────────────────────────────────────────────
SELECT dkp.as_user('00000000-0000-0000-0000-0000000973d2');
SELECT dkp.refused('an estimator cannot keep a plan', $q$SELECT dkp.keep('x', '01')$q$, 'devs only');
SELECT dkp.refused('an estimator cannot apply one', $q$SELECT public.dev_kept_plan_apply('00000000-0000-0000-0000-000000000000')$q$, 'devs only');
SELECT dkp.refused('or drop one', $q$SELECT public.dev_kept_plan_decide('00000000-0000-0000-0000-000000000000', 'dropped', 'x')$q$, 'devs only');
SELECT dkp.refused('or mark one applied', $q$SELECT public.dev_kept_plan_mark_applied(repeat('a', 64))$q$, 'devs only');

-- ── keep ──────────────────────────────────────────────────────────────────────────────────────────
SELECT dkp.as_user('00000000-0000-0000-0000-0000000973d1');
SELECT dkp.same('a dev keeps a plan', (SELECT (r->>'already') || ' ' || (r->'person'->>'name') || ' ' || (r->>'waiting_on_this_file') FROM dkp.keep('Pull the gate logs', '01') r), 'false Pat Sample 1');
SELECT dkp.same('the same plan kept twice answers the one that waits', (SELECT (r->>'already') || ' ' || (r->>'waiting_on_this_file') FROM dkp.keep('Pull the gate logs', '01') r), 'true 1');
SELECT dkp.keep('Ask about Friday', '02');
SELECT dkp.keep('Call the supply house', '03');
SELECT dkp.keep('A plan the file will refuse', '04');
SELECT dkp.refused('a function outside the list cannot be kept', $q$SELECT dkp.keep('x', '05', 'hr_agent_write')$q$, 'cannot be kept');
SELECT dkp.refused('a plan needs its hash', $q$SELECT public.dev_kept_plan_keep('{"person_id":"00000000-0000-0000-0000-0000000973b1","verb":"plan_case","rpc":"dev_case_write","args":{},"p":{},"plan_hash":"abc","words":"x"}'::jsonb)$q$, 'plan_hash is the hash');
SELECT dkp.refused('and its words', $q$SELECT public.dev_kept_plan_keep(jsonb_build_object('person_id','00000000-0000-0000-0000-0000000973b1','verb','plan_case','rpc','dev_case_write','args','{}'::jsonb,'p','{}'::jsonb,'plan_hash',repeat('b',64),'words','  '))$q$, 'words says what');
SELECT dkp.refused('and a person', $q$SELECT public.dev_kept_plan_keep(jsonb_build_object('verb','plan_case','rpc','dev_case_write','args','{}'::jsonb,'p','{}'::jsonb,'plan_hash',repeat('b',64),'words','x'))$q$, 'person_id is required');
SELECT dkp.same('a dev reads the four that wait, kept by the dev from the session',
  (SELECT count(*)::text || ' ' || min(author_label) || ' ' || min(session_label) || ' ' || min(verb) FROM public.dev_kept_plans WHERE state = 'waiting'), '4 Kept Dev bed session plan_case');

-- ── apply ─────────────────────────────────────────────────────────────────────────────────────────
-- Another dev presses: the function runs as that dev and the row says who decided.
SELECT dkp.as_user('00000000-0000-0000-0000-0000000973d3');
SELECT dkp.same('apply runs the stored function with the stored payload',
  (SELECT (r->>'state') || ' ' || (r->'result'->'items'->0->>'op') || ' ' || (r->'result'->'items'->0->>'item_no') || ' ' || (r->'result'->>'dry_run') || ' ' || (r->'result'->>'author_label')
     FROM public.dev_kept_plan_apply((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '01')) r),
  'applied add 1 false Kept Owner');
RESET ROLE;
SELECT dkp.same('the item is on the file and the plan reads applied', dkp.items() || ' / ' || dkp.plans(),
  '1 Pull the gate logs / 01 applied by Kept Owner | 02 waiting | 03 waiting | 04 waiting');
SET LOCAL ROLE authenticated;
SELECT dkp.refused('a second press writes nothing', $q$SELECT public.dev_kept_plan_apply((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '01'))$q$, 'already applied');
-- A plan whose function refuses: nothing lands and it still waits.
RESET ROLE;
UPDATE public.dev_kept_plans SET p = jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000973b1', 'items', jsonb_build_array(jsonb_build_object('item_no', 99, 'reopen', true))) WHERE plan_hash = repeat('a', 62) || '04';
SET LOCAL ROLE authenticated;
SELECT dkp.refused('a plan the function refuses is refused in its words', $q$SELECT public.dev_kept_plan_apply((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '04'))$q$, 'no item 99');
RESET ROLE;
SELECT dkp.same('and it still waits', dkp.plans(), '01 applied by Kept Owner | 02 waiting | 03 waiting | 04 waiting');
SET LOCAL ROLE authenticated;

-- ── drop, stale ───────────────────────────────────────────────────────────────────────────────────
SELECT dkp.refused('a drop needs its reason', $q$SELECT public.dev_kept_plan_decide((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '02'), 'dropped', ' ')$q$, 'say why');
SELECT dkp.refused('a plan is not applied through the decide door', $q$SELECT public.dev_kept_plan_decide((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '02'), 'applied', 'x')$q$, 'dropped or marked stale');
SELECT public.dev_kept_plan_decide((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '02'), 'dropped', 'Not needed after all.');
SELECT public.dev_kept_plan_decide((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '04'), 'stale', 'The file changed since this was planned.');
SELECT dkp.refused('a decided plan is not decided again', $q$SELECT public.dev_kept_plan_decide((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '02'), 'stale', 'x')$q$, 'already dropped');
SELECT dkp.refused('or applied', $q$SELECT public.dev_kept_plan_apply((SELECT id FROM public.dev_kept_plans WHERE plan_hash = repeat('a', 62) || '04'))$q$, 'already stale');
-- A plan dropped can be kept again as a new row: its hash is free once nothing waits under it.
SELECT dkp.same('a dropped plan''s hash can be kept again', (SELECT r->>'already' FROM dkp.keep('Ask about Friday', '02') r), 'false');

-- ── the seat applied one itself ───────────────────────────────────────────────────────────────────
SELECT dkp.same('the seat''s own apply marks the kept copy by its hash', (SELECT (r->>'marked') FROM public.dev_kept_plan_mark_applied(repeat('a', 62) || '03', '{"ok":true}'::jsonb) r), 'true');
SELECT dkp.same('a hash nobody kept marks nothing and raises nothing', (SELECT (r->>'marked') FROM public.dev_kept_plan_mark_applied(repeat('c', 64)) r), 'false');
RESET ROLE;
SELECT dkp.same('the list reads as it should',
  dkp.plans(), '01 applied by Kept Owner | 02 dropped (Not needed after all.) by Kept Owner | 02 waiting | 03 applied by Kept Owner | 04 stale (The file changed since this was planned.) by Kept Owner');
SET LOCAL ROLE authenticated;

-- ── the table is nobody's to write, and an estimator's to read never ─────────────────────────────
SELECT dkp.refused('a dev cannot insert a row by hand',
  $q$DO $d$ BEGIN INSERT INTO public.dev_kept_plans (person_id, verb, rpc, args, p, plan_hash, words) VALUES ('00000000-0000-0000-0000-0000000973b1', 'plan_case', 'dev_case_write', '{}', '{}', repeat('d', 64), 'x'); EXCEPTION WHEN insufficient_privilege THEN RAISE EXCEPTION 'not allowed'; END $d$$q$, 'not allowed');
SELECT dkp.refused('or flip a state by hand',
  $q$DO $d$ DECLARE n int := 0; BEGIN BEGIN UPDATE public.dev_kept_plans SET state = 'applied', decided_at = now() WHERE state = 'waiting'; GET DIAGNOSTICS n = ROW_COUNT; EXCEPTION WHEN insufficient_privilege THEN n := 0; END; IF n = 0 THEN RAISE EXCEPTION 'nothing flipped'; END IF; END $d$$q$, 'nothing flipped');
SELECT dkp.as_user('00000000-0000-0000-0000-0000000973d2');
SELECT dkp.same('an estimator reads no kept plan', (SELECT count(*)::text FROM public.dev_kept_plans), '0');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'dev_kept_plans PASSED'; END $$;
ROLLBACK;
