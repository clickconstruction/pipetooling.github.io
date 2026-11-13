-- One approvals list (20261113120000, punch list #315): a plan the dev seat made on a person's HR file, kept for a
-- yes. Here: keep stores the verb, the arguments, the hash and the words for the person the arguments write to;
-- refused are a verb off the list, a file's bytes, anything marked counsel-only, a change to a counsel-only document,
-- another person's file and the same plan twice; a kept plan is decided once (applied, dropped with a reason, stale
-- with the mismatch) and is what it was when kept; who may read and write (a dev through the two doors; an estimator
-- nothing; nobody the table directly). Made-up people and words. Fixtures made as postgres; the doors run as signed-in
-- users through RLS, inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "dev_seat_kept_plans PASSED". See scripts/pgtest-dev-seat-kept-plans.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA kp;
CREATE FUNCTION kp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION kp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION kp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the bed reads past RLS: every kept plan as "verb state", by verb then state (the rows share one clock here).
CREATE FUNCTION kp.rows() RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(k.verb || ' ' || k.state, ' | ' ORDER BY k.verb, k.state), 'none') FROM public.dev_seat_kept_plans k $$;
-- A keep payload for Pat's file: an HR entry whose words vary with the hash's first character.
CREATE FUNCTION kp.entry_plan(p_hash_char text, p_extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'person_id', '00000000-0000-0000-0000-0000000991b1',
    'verb', 'plan_hr_entry',
    'args', jsonb_build_object('entry', jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000991b1', 'entries', jsonb_build_array(jsonb_build_object('entry_date', '2026-11-03', 'source', 'incident', 'content', 'Made up.')))),
    'plan_hash', repeat(p_hash_char, 64),
    'reply', '{"entries_inserted": 1}'::jsonb,
    'words', 'One entry dated Nov 3, 2026, as an incident.',
    'session', 'morning session') || p_extra $$;
GRANT USAGE ON SCHEMA kp TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA kp TO authenticated;

-- Who: a dev and an estimator; two people; a waiting field report on Pat; a plain and a counsel-only document of Pat's.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000991d1', 'dev@kept.test'),
  ('00000000-0000-0000-0000-0000000991d2', 'estimator@kept.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000991d1', 'dev@kept.test', 'Kept Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000991d2', 'estimator@kept.test', 'Kept Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000991b1', '00000000-0000-0000-0000-0000000991d1', 'helper', 'Pat Sample'),
  ('00000000-0000-0000-0000-0000000991b2', '00000000-0000-0000-0000-0000000991d1', 'helper', 'Sam Sample');
INSERT INTO public.person_reports (id, subject_person_id, author_user_id, author_name, occurred_date, content) VALUES
  ('00000000-0000-0000-0000-0000000991e1', '00000000-0000-0000-0000-0000000991b1', '00000000-0000-0000-0000-0000000991d1', 'Kept Dev', '2026-11-02', 'Made up: late twice.');
INSERT INTO public.documents (id, person_id, title, content, counsel_only) VALUES
  ('00000000-0000-0000-0000-0000000991c1', '00000000-0000-0000-0000-0000000991b1', 'A plain note', 'Made up.', false),
  ('00000000-0000-0000-0000-0000000991c2', '00000000-0000-0000-0000-0000000991b1', 'A note for counsel', 'Made up.', true);

-- ── as the dev, through the doors ────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT kp.as_user('00000000-0000-0000-0000-0000000991d1');

SELECT kp.same('keep answers the row it made, waiting, and how many wait on the person',
  (SELECT (r->>'state') || ' ' || (r->>'verb') || ' ' || (r->>'waiting') || ' ' || (r->'person'->>'name') || ' ' || ((r->>'kept_id') ~ '^[0-9a-f-]{36}$')::text FROM (SELECT public.dev_kept_plan_keep(kp.entry_plan('a')) AS r) x),
  'waiting plan_hr_entry 1 Pat Sample true');
SELECT kp.same('the dev reads the row through RLS: the words, who kept it, the session',
  (SELECT k.words || ' / ' || k.author_label || ' / ' || k.session_label || ' / ' || (k.args->'entry'->'entries'->0->>'content') FROM public.dev_seat_kept_plans k),
  'One entry dated Nov 3, 2026, as an incident. / Kept Dev / morning session / Made up.');
SELECT kp.refused('the same plan kept twice while it waits',
  $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('a'))$q$, 'already kept and waiting');

-- What may not be kept.
SELECT kp.refused('a verb off the list',
  $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('b', '{"verb":"plan_person_evidence"}'::jsonb))$q$, 'not a plan that can be kept');
SELECT kp.refused('a verb that is not about a person''s file',
  $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('b', '{"verb":"plan_bill"}'::jsonb))$q$, 'not a plan that can be kept');
SELECT kp.refused('arguments that carry a file''s bytes, however deep',
  $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('b', '{"args":{"entry":{"person_id":"00000000-0000-0000-0000-0000000991b1","files":[{"name":"a.pdf","content_base64":"AAAA"}]}}}'::jsonb))$q$, 'bytes is not kept');
SELECT kp.refused('a plan marked counsel-only',
  $q$SELECT public.dev_kept_plan_keep('{"person_id":"00000000-0000-0000-0000-0000000991b1","verb":"plan_person_doc","args":{"doc":{"person_id":"00000000-0000-0000-0000-0000000991b1","title":"For counsel","markdown":"Made up.","counsel_only":true}},"plan_hash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","words":"A new document."}'::jsonb)$q$,
  'counsel-only plan is not kept');
SELECT kp.refused('a change to a counsel-only document, which the arguments do not say',
  $q$SELECT public.dev_kept_plan_keep('{"person_id":"00000000-0000-0000-0000-0000000991b1","verb":"plan_person_doc","args":{"doc":{"person_id":"00000000-0000-0000-0000-0000000991b1","doc_id":"00000000-0000-0000-0000-0000000991c2","ops":[{"op":"append","markdown":"More."}]}},"plan_hash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","words":"One line added."}'::jsonb)$q$,
  'change to a counsel-only document is not kept');
SELECT kp.refused('a plan whose arguments write to another person''s file',
  $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('b', '{"person_id":"00000000-0000-0000-0000-0000000991b2"}'::jsonb))$q$, 'do not write to this person');
SELECT kp.refused('a plan with no words',
  $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('b', '{"words":"  "}'::jsonb))$q$, 'words is one paragraph');
SELECT kp.refused('a hash that is not a plan''s',
  $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('b', '{"plan_hash":"not-a-hash"}'::jsonb))$q$, 'plan_hash is the hash');
SELECT kp.refused('a person who is not on the roster',
  $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('b', '{"person_id":"00000000-0000-0000-0000-0000000991bf"}'::jsonb))$q$, 'not found');

-- The other two verbs: a plain document by id, and a field report by the person it is about.
SELECT kp.same('a change to a plain document is kept',
  (SELECT r->>'waiting' FROM (SELECT public.dev_kept_plan_keep('{"person_id":"00000000-0000-0000-0000-0000000991b1","verb":"plan_person_doc","args":{"doc":{"person_id":"00000000-0000-0000-0000-0000000991b1","doc_id":"00000000-0000-0000-0000-0000000991c1","ops":[{"op":"append","markdown":"More."}]}},"plan_hash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","words":"One line added to A plain note."}'::jsonb) AS r) x),
  '2');
SELECT kp.same('a field report is kept for the person it is about',
  (SELECT r->>'waiting' FROM (SELECT public.dev_kept_plan_keep('{"person_id":"00000000-0000-0000-0000-0000000991b1","verb":"plan_person_report","args":{"report":{"report_id":"00000000-0000-0000-0000-0000000991e1","action":"file"}},"plan_hash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","words":"File the report of Nov 2."}'::jsonb) AS r) x),
  '3');
SELECT kp.refused('a field report kept under another person',
  $q$SELECT public.dev_kept_plan_keep('{"person_id":"00000000-0000-0000-0000-0000000991b2","verb":"plan_person_report","args":{"report":{"report_id":"00000000-0000-0000-0000-0000000991e1"}},"plan_hash":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","words":"File it."}'::jsonb)$q$,
  'do not write to this person');

-- Decided once.
SELECT kp.refused('a drop with no reason',
  format($q$SELECT public.dev_kept_plan_decide('%s', 'dropped', ' ')$q$, (SELECT k.id FROM public.dev_seat_kept_plans k WHERE k.verb = 'plan_person_report')), 'say why');
SELECT kp.refused('a decision that is not one of the three',
  format($q$SELECT public.dev_kept_plan_decide('%s', 'waiting', 'x')$q$, (SELECT k.id FROM public.dev_seat_kept_plans k WHERE k.verb = 'plan_person_report')), 'applied, dropped or stale');
SELECT kp.same('dropped with its reason, and one fewer waits',
  (SELECT (r->>'state') || ' ' || (r->>'waiting') FROM (SELECT public.dev_kept_plan_decide((SELECT k.id FROM public.dev_seat_kept_plans k WHERE k.verb = 'plan_person_report'), 'dropped', 'Made up: filed by hand.') AS r) x),
  'dropped 2');
SELECT kp.same('the row keeps who decided and why',
  (SELECT k.state || ' / ' || k.decided_label || ' / ' || k.decided_why || ' / ' || (k.decided_at IS NOT NULL)::text FROM public.dev_seat_kept_plans k WHERE k.verb = 'plan_person_report'),
  'dropped / Kept Dev / Made up: filed by hand. / true');
SELECT kp.refused('a second decision on the same plan',
  format($q$SELECT public.dev_kept_plan_decide('%s', 'applied')$q$, (SELECT k.id FROM public.dev_seat_kept_plans k WHERE k.verb = 'plan_person_report')), 'already decided (dropped)');
SELECT kp.same('applied needs no reason',
  (SELECT r->>'state' FROM (SELECT public.dev_kept_plan_decide((SELECT k.id FROM public.dev_seat_kept_plans k WHERE k.verb = 'plan_hr_entry'), 'applied') AS r) x), 'applied');
SELECT kp.same('stale holds the mismatch in words',
  (SELECT r->>'state' FROM (SELECT public.dev_kept_plan_decide((SELECT k.id FROM public.dev_seat_kept_plans k WHERE k.verb = 'plan_person_doc'), 'stale', 'The document was saved after this plan was made.') AS r) x), 'stale');
SELECT kp.same('a plan that was decided may be kept again as a new row',
  (SELECT r->>'waiting' FROM (SELECT public.dev_kept_plan_keep(kp.entry_plan('a')) AS r) x), '1');
SELECT kp.refused('a decision on a plan that is not there',
  $q$SELECT public.dev_kept_plan_decide('00000000-0000-0000-0000-0000000991ff', 'dropped', 'x')$q$, 'no such kept plan');

-- The table itself: a dev reads, and nobody writes it directly.
SELECT kp.refused('a dev inserting straight into the table',
  $q$INSERT INTO public.dev_seat_kept_plans (person_id, verb, args, plan_hash, words) VALUES ('00000000-0000-0000-0000-0000000991b1', 'plan_hr_entry', '{}'::jsonb, repeat('1', 64), 'x')$q$, 'permission denied');
SELECT kp.refused('a dev updating the table', $q$UPDATE public.dev_seat_kept_plans SET state = 'applied', decided_at = now()$q$, 'permission denied');
SELECT kp.refused('a dev deleting from the table', $q$DELETE FROM public.dev_seat_kept_plans$q$, 'permission denied');

-- ── as an estimator: nothing ─────────────────────────────────────────────────────────────────────
SELECT kp.as_user('00000000-0000-0000-0000-0000000991d2');
SELECT kp.same('an estimator reads no kept plan', (SELECT count(*)::text FROM public.dev_seat_kept_plans), '0');
SELECT kp.refused('an estimator keeping a plan', $q$SELECT public.dev_kept_plan_keep(kp.entry_plan('9'))$q$, 'devs only');
SELECT kp.refused('an estimator deciding a plan',
  format($q$SELECT public.dev_kept_plan_decide('%s', 'dropped', 'x')$q$, '00000000-0000-0000-0000-0000000991ff'), 'devs only');
RESET ROLE;

-- ── the guard, past the doors (as the table's owner) ─────────────────────────────────────────────
SELECT kp.same('four rows stand, each in its state', kp.rows(), 'plan_hr_entry applied | plan_hr_entry waiting | plan_person_doc stale | plan_person_report dropped');
SELECT kp.refused('a kept plan reworded',
  $q$UPDATE public.dev_seat_kept_plans SET words = 'other words' WHERE state = 'waiting'$q$, 'what it was when kept');
SELECT kp.refused('a kept plan given other arguments',
  $q$UPDATE public.dev_seat_kept_plans SET args = '{"entry":{}}'::jsonb WHERE state = 'waiting'$q$, 'what it was when kept');
SELECT kp.refused('a decided plan decided again, past the door',
  $q$UPDATE public.dev_seat_kept_plans SET state = 'applied', decided_why = NULL WHERE state = 'dropped'$q$, 'already decided');
SELECT kp.refused('a drop with no reason, past the door',
  $q$UPDATE public.dev_seat_kept_plans SET state = 'dropped', decided_at = now() WHERE state = 'waiting'$q$, 'dev_seat_kept_plans_decided_whole');
SELECT kp.refused('a waiting row that carries a decision, past the door',
  $q$UPDATE public.dev_seat_kept_plans SET decided_at = now() WHERE state = 'waiting'$q$, 'dev_seat_kept_plans_decided_whole');

DO $$ BEGIN RAISE NOTICE 'dev_seat_kept_plans PASSED'; END $$;
ROLLBACK;
