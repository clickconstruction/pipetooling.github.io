-- A second link to an estimate per share (punch list #127 PR 3, migration *_estimate_share_links; #281 PR 2, migration
-- *_estimate_short_codes): the office makes a link to a sent and to an approved estimate through share_estimate_link,
-- each its own ten-letter code from the alphabet with no 0, O, 1, l or I, kept only as its SHA-256 in hex (what the
-- edge functions compute from the code in the link), fourteen days long, with who made it; the emailed link's hash on
-- the estimate is untouched; a draft, a missing estimate, a primary, a training account, a twin and anon are refused;
-- whoever reads the estimate reads its links and nobody signed in writes them; the read-only fences are on the new
-- tables; the guard on guessing (estimate_link_miss) counts by source and hour, the 21st miss reads 21, the service
-- role alone calls it and nobody signed in reads the table. Everything rolls back. Raises on the first failed
-- assertion; ends with "estimate_share_links PASSED". See scripts/pgtest-estimate-share-links.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (an assistant), a primary, an assistant in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e4a01', 'assistant@share.test'),
  ('00000000-0000-0000-0000-0000000e4a02', 'primary@share.test'),
  ('00000000-0000-0000-0000-0000000e4a03', 'training@share.test'),
  ('00000000-0000-0000-0000-0000000e4a04', 'twin@share.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e4a01', 'assistant@share.test', 'Share Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e4a02', 'primary@share.test', 'Share Primary', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000e4a03', 'training@share.test', 'Share Training', 'assistant', true, false),
  ('00000000-0000-0000-0000-0000000e4a04', 'twin@share.test', 'Share Twin', 'assistant', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Three estimates: e1 sent (with the emailed link's hash), e2 approved, e3 a draft. Made-up titles.
INSERT INTO public.estimates (id, master_user_id, created_by, title) VALUES
  ('00000000-0000-0000-0000-0000000e4b01', '00000000-0000-0000-0000-0000000e4a01', '00000000-0000-0000-0000-0000000e4a01', 'Kitchen re-pipe'),
  ('00000000-0000-0000-0000-0000000e4b02', '00000000-0000-0000-0000-0000000e4a01', '00000000-0000-0000-0000-0000000e4a01', 'Water heater swap'),
  ('00000000-0000-0000-0000-0000000e4b03', '00000000-0000-0000-0000-0000000e4a01', '00000000-0000-0000-0000-0000000e4a01', 'A draft');
UPDATE public.estimates SET status = 'sent', public_token_hash = repeat('a', 64) WHERE id = '00000000-0000-0000-0000-0000000e4b01';
UPDATE public.estimates SET status = 'customer_accepted' WHERE id = '00000000-0000-0000-0000-0000000e4b02';

CREATE SCHEMA esl;
CREATE FUNCTION esl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION esl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION esl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION esl.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
END $$;
-- The tokens the office got back, kept beside the run for the checks below.
CREATE TABLE esl.tokens (n int PRIMARY KEY, estimate_id uuid, token text);
GRANT USAGE ON SCHEMA esl TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA esl TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON esl.tokens TO authenticated;

-- 1 · The assistant makes two links to the sent estimate and one to the approved one.
SET LOCAL ROLE authenticated;
SELECT esl.as_user('00000000-0000-0000-0000-0000000e4a01');
INSERT INTO esl.tokens VALUES
  (1, '00000000-0000-0000-0000-0000000e4b01', public.share_estimate_link('00000000-0000-0000-0000-0000000e4b01')),
  (2, '00000000-0000-0000-0000-0000000e4b01', public.share_estimate_link('00000000-0000-0000-0000-0000000e4b01')),
  (3, '00000000-0000-0000-0000-0000000e4b02', public.share_estimate_link('00000000-0000-0000-0000-0000000e4b02'));
SELECT esl.same('each code reads aloud: ten letters from the 31 with no look-alikes, three different ones (#281)',
  (SELECT count(DISTINCT token)::text || ' ' || bool_and(token ~ '^[23456789abcdefghjkmnpqrstuvwxyz]{10}$')::text FROM esl.tokens), '3 true');

RESET ROLE;
SELECT esl.same('each link keeps only the SHA-256 of its token, in hex, as the edge functions compute it',
  (SELECT string_agg((s.estimate_id = t.estimate_id)::text, ',' ORDER BY t.n)
   FROM esl.tokens t JOIN public.estimate_share_links s ON s.token_hash = encode(extensions.digest(t.token, 'sha256'), 'hex')),
  'true,true,true');
SELECT esl.same('no token is kept anywhere in the row', (SELECT count(*)::text FROM public.estimate_share_links s, esl.tokens t WHERE s.token_hash = t.token), '0');
SELECT esl.same('fourteen days long, made by the assistant', (
  SELECT bool_and(expires_at BETWEEN now() + interval '13 days 23 hours' AND now() + interval '14 days 1 hour')::text || ' ' ||
         bool_and(made_by = '00000000-0000-0000-0000-0000000e4a01')::text
  FROM public.estimate_share_links), 'true true');
SELECT esl.same('the emailed link''s hash on the estimate is untouched',
  (SELECT public_token_hash FROM public.estimates WHERE id = '00000000-0000-0000-0000-0000000e4b01'), repeat('a', 64));

-- 2 · Refusals in the function's words.
SET LOCAL ROLE authenticated;
SELECT esl.as_user('00000000-0000-0000-0000-0000000e4a01');
SELECT esl.refused('a draft is not shared', $q$SELECT public.share_estimate_link('00000000-0000-0000-0000-0000000e4b03')$q$, 'Only a sent estimate can be shared.');
SELECT esl.refused('an estimate not there', $q$SELECT public.share_estimate_link('00000000-0000-0000-0000-0000000e4bff')$q$, 'That estimate is not there.');
SELECT esl.refused('nobody signed in writes a link past the function',
  $q$INSERT INTO public.estimate_share_links (estimate_id, token_hash, expires_at) VALUES ('00000000-0000-0000-0000-0000000e4b01', repeat('b', 64), now())$q$, 'permission denied');
SELECT esl.as_user('00000000-0000-0000-0000-0000000e4a02');
SELECT esl.refused('a primary is off the office', $q$SELECT public.share_estimate_link('00000000-0000-0000-0000-0000000e4b01')$q$, 'Only the office can share an estimate.');
SELECT esl.as_user('00000000-0000-0000-0000-0000000e4a03');
SELECT esl.refused('a training account cannot', $q$SELECT public.share_estimate_link('00000000-0000-0000-0000-0000000e4b01')$q$, 'A training account cannot share an estimate.');
SELECT esl.as_user('00000000-0000-0000-0000-0000000e4a04');
SELECT esl.refused('a twin cannot', $q$SELECT public.share_estimate_link('00000000-0000-0000-0000-0000000e4b01')$q$, 'A digital twin cannot share an estimate.');

-- 3 · Who reads the links: whoever reads the estimate; anon nothing.
SELECT esl.as_user('00000000-0000-0000-0000-0000000e4a01');
SELECT esl.same('the office reads the three links', (SELECT count(*)::text FROM public.estimate_share_links), '3');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT esl.as_anon();
SELECT esl.refused('anon cannot make a link', $q$SELECT public.share_estimate_link('00000000-0000-0000-0000-0000000e4b01')$q$, 'permission denied');
SELECT esl.refused('anon reads no link', $q$SELECT count(*) FROM public.estimate_share_links$q$, 'permission denied');

-- 4 · The fences on the new tables.
RESET ROLE;
SELECT esl.same('the read-only and twin fences are on the table',
  (SELECT (count(*) FILTER (WHERE permissive = 'RESTRICTIVE') > 0)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'estimate_share_links'), 'true');
SELECT esl.same('the fences are on the misses table too, and no permissive policy opens it',
  (SELECT (count(*) FILTER (WHERE permissive = 'RESTRICTIVE') > 0)::text || ' ' || (count(*) FILTER (WHERE permissive = 'PERMISSIVE') = 0)::text
   FROM pg_policies WHERE schemaname = 'public' AND tablename = 'estimate_link_misses'), 'true true');

-- 5 · The guard on guessing (#281 PR 2): a miss counts against its source by the hour; the service role alone bumps it.
CREATE FUNCTION esl.misses(p_hash text, n int) RETURNS int LANGUAGE plpgsql AS $$
DECLARE r int;
BEGIN
  FOR i IN 1..n LOOP r := public.estimate_link_miss(p_hash); END LOOP;
  RETURN r;
END $$;
SELECT esl.same('the twenty-first miss from one source in the hour reads 21', esl.misses(repeat('c', 64), 21)::text, '21');
SELECT esl.same('another source starts at one', esl.misses(repeat('d', 64), 1)::text, '1');
SELECT esl.same('one row per source and hour, the hour on the hour',
  (SELECT count(*)::text || ' ' || bool_and(hour = date_trunc('hour', now()))::text FROM public.estimate_link_misses WHERE source_hash IN (repeat('c', 64), repeat('d', 64))), '2 true');
SELECT esl.refused('a source that is not a hash is refused', $q$SELECT public.estimate_link_miss('203.0.113.9')$q$, 'estimate_link_misses_source_hash_shape');
SELECT esl.same('the service role alone may bump it; nobody signed in and no anon',
  has_function_privilege('service_role', 'public.estimate_link_miss(text)', 'execute')::text || ' ' ||
  has_function_privilege('authenticated', 'public.estimate_link_miss(text)', 'execute')::text || ' ' ||
  has_function_privilege('anon', 'public.estimate_link_miss(text)', 'execute')::text, 'true false false');
SET LOCAL ROLE authenticated;
SELECT esl.as_user('00000000-0000-0000-0000-0000000e4a01');
SELECT esl.refused('the office reads no count', $q$SELECT count(*) FROM public.estimate_link_misses$q$, 'permission denied');
SELECT esl.refused('the office bumps no count', $q$SELECT public.estimate_link_miss(repeat('e', 64))$q$, 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'estimate_share_links PASSED'; END $$;
ROLLBACK;
