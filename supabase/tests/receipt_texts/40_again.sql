-- Text again (v2.8697, punch list #299, migration *_receipt_text_again): what the database holds for the office's press
-- and what the office's list reads after it. Fixtures are written as postgres; the reads run as each account;
-- everything rolls back. Raises on the first failed assertion; ends with "receipt_again PASSED". See
-- scripts/pgtest-receipt-texts.sh. Never against prod, and it sends nothing: the bed has no function to call.
\set ON_ERROR_STOP 1
BEGIN;

-- Tess is the office (an assistant); Jordan is a helper with a card.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000002994a1', 'tess@again.test'),
  ('00000000-0000-0000-0000-0000002994a5', 'jordan@again.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000002994a1', 'tess@again.test', 'Tess Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000002994a5', 'jordan@again.test', 'Jordan Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, archived_at = EXCLUDED.archived_at;

CREATE SCHEMA ra;
GRANT USAGE ON SCHEMA ra TO authenticated;
CREATE FUNCTION ra.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ra.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION ra.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- What the caller's list holds, as "store count rested" lines in the order the function gives them.
CREATE FUNCTION ra.list() RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(c.store || ' ' || c.again_count::text || ' ' || (c.again_at IS NOT NULL)::text, ' | '), '') FROM public.receipt_requests_to_chase() c WHERE c.why = 'no_answer'
$$;
-- A word a link is made for, tried: 'ok', or the sqlstate the table raised.
CREATE FUNCTION ra.link(p_for text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.receipt_links (code_hash, request_ids, made_for, made_by, expires_at)
  VALUES (md5(p_for) || md5(p_for || 'x'), ARRAY['00000000-0000-0000-0000-0000002994d1']::uuid[], p_for, '00000000-0000-0000-0000-0000002994a1', now() + interval '1 day');
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The press on the first request, as the function writes it: claimed by the count it read. Answers how many rows moved.
CREATE FUNCTION ra.claim(p_read integer) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.receipt_requests SET again_at = now(), again_by = '00000000-0000-0000-0000-0000002994a1', again_count = p_read + 1
  WHERE id = '00000000-0000-0000-0000-0000002994d1' AND again_count = p_read;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count::text;
END $$;
GRANT EXECUTE ON FUNCTION ra.same(text, text, text), ra.sign_in(uuid), ra.sign_out(), ra.list() TO authenticated;

-- One charge and one request a case, each texted thirty hours ago and reminded thirteen hours ago; n is 1 to 5 and the
-- charge posts n minutes ago, so the list's order is n.
CREATE FUNCTION ra.seed(p_n text, p_store text, p_set text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_charge uuid := ('00000000-0000-0000-0000-0000002994c' || p_n)::uuid;
  v_request uuid := ('00000000-0000-0000-0000-0000002994d' || p_n)::uuid;
BEGIN
  INSERT INTO public.mercury_transactions (id, mercury_id, mercury_account_id, amount, created_at, posted_at, status, kind, counterparty_name, raw)
  VALUES (v_charge, ('00000000-0000-0000-0000-0000002994e' || p_n)::uuid, '00000000-0000-0000-0000-0000002994f1', -10.00 - p_n::int, now() - interval '40 hours',
    now() - make_interval(mins => p_n::int), 'sent', 'debitCardTransaction', p_store, '{}'::jsonb);
  INSERT INTO public.receipt_requests (id, mercury_transaction_id, holder_user_id, holder_name, texted_at, reminded_at, cell)
  VALUES (v_request, v_charge, '00000000-0000-0000-0000-0000002994a5', 'Jordan Helper', now() - interval '30 hours', now() - interval '13 hours', '+15125550100');
  IF p_set IS NOT NULL THEN
    EXECUTE format('UPDATE public.receipt_requests SET %s WHERE id = %L', p_set, v_request);
  END IF;
  RETURN v_request;
END $$;

SELECT ra.sign_out();
SELECT ra.seed('1', 'Never Again Supply');
SELECT ra.seed('2', 'Again Long Ago', $$again_at = now() - interval '13 hours', again_by = '00000000-0000-0000-0000-0000002994a1', again_count = 1$$);
SELECT ra.seed('3', 'Again At The Cap', $$again_at = now() - interval '20 hours', again_by = '00000000-0000-0000-0000-0000002994a1', again_count = 2$$);
SELECT ra.seed('4', 'Again Just Now', $$again_at = now() - interval '1 hour', again_by = '00000000-0000-0000-0000-0000002994a1', again_count = 1$$);
SELECT ra.seed('5', 'Again Eleven Hours', $$again_at = now() - interval '11 hours 59 minutes', again_by = '00000000-0000-0000-0000-0000002994a1', again_count = 2$$);

-- The structure.
SELECT ra.same('a request carries the office''s Text again', (
  SELECT string_agg(column_name || ' ' || data_type || ' ' || is_nullable, ', ' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipt_requests' AND column_name IN ('again_at', 'again_by', 'again_count')
), 'again_at timestamp with time zone YES, again_by uuid YES, again_count integer NO');
SELECT ra.same('a request starts at no presses', (SELECT again_count::text || ' ' || (again_at IS NULL)::text FROM public.receipt_requests WHERE id = '00000000-0000-0000-0000-0000002994d1'), '0 true');
SELECT ra.same('a count below nothing is refused', (
  SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.receipt_requests'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ~ 'again_count >= 0'
), '1');
SELECT ra.same('a link is made for one of four words, under one check', (
  SELECT count(*)::text || ' ' || string_agg(conname, ',') FROM pg_constraint WHERE conrelid = 'public.receipt_links'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ~ 'made_for'
), '1 receipt_links_made_for_check');
SELECT ra.same('again is one of them, the three before it stand, and any other word is refused',
  ra.link('again') || ' ' || ra.link('office') || ' ' || ra.link('text') || ' ' || ra.link('reminder') || ' ' || ra.link('whenever'), 'ok ok ok ok 23514');
SELECT ra.same('nobody signed out may ask the list, made again as it was', (
  SELECT has_function_privilege('anon', 'public.receipt_requests_to_chase()', 'EXECUTE')::text || ' ' || has_function_privilege('authenticated', 'public.receipt_requests_to_chase()', 'EXECUTE')::text || ' ' || has_function_privilege('service_role', 'public.receipt_requests_to_chase()', 'EXECUTE')::text
), 'false true true');
SELECT ra.same('the list is the definer''s, and reads only public', (
  SELECT prosecdef::text || ' ' || provolatile::text || ' ' || array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.receipt_requests_to_chase()'::regprocedure
), 'true s search_path=public');

-- The office's list: a charge texted again rests twelve hours, then comes back with its count.
SET LOCAL ROLE authenticated;
SELECT ra.sign_in('00000000-0000-0000-0000-0000002994a1');
SELECT ra.same('the office reads the three that have rested, each with its count, and neither of the two inside twelve hours', ra.list(),
  'Never Again Supply 0 false | Again Long Ago 1 true | Again At The Cap 2 true');
SELECT ra.same('the row hands back when the office last pressed', (
  SELECT (c.again_at < now() - interval '12 hours')::text || ' ' || (c.reminded_at IS NOT NULL)::text FROM public.receipt_requests_to_chase() c WHERE c.store = 'Again Long Ago'
), 'true true');
RESET ROLE;
-- The press, as the function writes it: the count moves by one, claimed by the count it read.
SELECT ra.same('a press claimed by the count lands once', ra.claim(0), '1');
SELECT ra.same('and a second press that read the old count changes nothing', ra.claim(0), '0');
SET LOCAL ROLE authenticated;
SELECT ra.same('the charge just texted again leaves the list', ra.list(), 'Again Long Ago 1 true | Again At The Cap 2 true');
SELECT ra.same('the office cannot write the press itself: every write is the function''s', (
  SELECT has_table_privilege('authenticated', 'public.receipt_requests', 'UPDATE')::text || ' ' || has_table_privilege('authenticated', 'public.receipt_links', 'INSERT')::text
), 'false false');

-- Who may not read.
SELECT ra.sign_in('00000000-0000-0000-0000-0000002994a5');
SELECT ra.same('the holder reads none of the office''s list', (SELECT count(*)::text FROM public.receipt_requests_to_chase()), '0');
RESET ROLE;
SELECT ra.sign_out();

SELECT 'receipt_again PASSED';
ROLLBACK;
