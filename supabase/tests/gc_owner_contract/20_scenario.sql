-- Our contract to the customer (the Board's B6-d-i, migration *_gc_owner_contract_sends): gc_send_owner_contract refuses
-- in words who may not send it, a job that cannot have it and a send that is not whole; the first send stamps the day
-- it went; the sends and their files are a dev's alone; the customer signs the newest send as the service role, keeping
-- its price by line; and Mark it signed (Owner Billing's, restated on gc_owner_contract_keep) neither undoes nor moves a
-- contract they signed in their portal, while signing on paper works as it did. Presses run as each user through RLS;
-- the fixture is made as postgres; everything rolls back. Raises on the first failed assertion; ends with
-- "gc_owner_contract PASSED". See scripts/pgtest-gc-owner-contract.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- A dev, an estimator, an assistant, a leader (the money team, not a dev), a dev in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@contract.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'estimator@contract.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'assistant@contract.test'),
  ('00000000-0000-0000-0000-0000000009d4', 'master@contract.test'),
  ('00000000-0000-0000-0000-0000000009d5', 'training@contract.test'),
  ('00000000-0000-0000-0000-0000000009d6', 'twin@contract.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@contract.test', 'Contract Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000009d2', 'estimator@contract.test', 'Contract Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000009d3', 'assistant@contract.test', 'Contract Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000009d4', 'master@contract.test', 'Contract Leader', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000009d5', 'training@contract.test', 'Contract Training', 'dev', true, false),
  ('00000000-0000-0000-0000-0000000009d6', 'twin@contract.test', 'Contract Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Two customers. The clinic is won with two trades; one job still bidding, one lost; a job signed on paper; a job
-- that is lost after its contract went.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000009c1', 'Contract Owner', '00000000-0000-0000-0000-0000000009d1'),
  ('00000000-0000-0000-0000-0000000009c2', 'Other Owner', '00000000-0000-0000-0000-0000000009d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'Contract Clinic', '00000000-0000-0000-0000-0000000009c1'),
  ('00000000-0000-0000-0000-0000000009a2', 'Contract Bidding Clinic', '00000000-0000-0000-0000-0000000009c1'),
  ('00000000-0000-0000-0000-0000000009a3', 'Contract Lost Clinic', '00000000-0000-0000-0000-0000000009c1'),
  ('00000000-0000-0000-0000-0000000009a4', 'Contract Paper Clinic', '00000000-0000-0000-0000-0000000009c1'),
  ('00000000-0000-0000-0000-0000000009a5', 'Contract Gone Clinic', '00000000-0000-0000-0000-0000000009c1');
INSERT INTO public.gc_projects (project_id, stage, lost_on) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'buyout', NULL),
  ('00000000-0000-0000-0000-0000000009a2', 'bidding', NULL),
  ('00000000-0000-0000-0000-0000000009a3', 'bidding', DATE '2026-10-01'),
  ('00000000-0000-0000-0000-0000000009a4', 'buyout', NULL),
  ('00000000-0000-0000-0000-0000000009a5', 'buyout', NULL);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a1', 'Plumbing', 1),
  ('00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009a4', 'Roofing', 0),
  ('00000000-0000-0000-0000-0000000009b5', '00000000-0000-0000-0000-0000000009a5', 'Painting', 0);
-- The files the office attached, as the client's upload leaves them.
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('gc-owner-contracts', '00000000-0000-0000-0000-0000000009a1/contract-1.pdf'),
  ('gc-owner-contracts', '00000000-0000-0000-0000-0000000009a1/contract-2.pdf'),
  ('gc-owner-contracts', '00000000-0000-0000-0000-0000000009a5/contract.pdf');

CREATE SCHEMA goc;
CREATE TABLE goc.ids (k text PRIMARY KEY, id uuid);
CREATE FUNCTION goc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with exactly these words; its writes go with the refusal (a subtransaction).
CREATE FUNCTION goc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM want THEN RAISE EXCEPTION E'% was refused with other words.\n--- got ---\n%\n--- want ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- The portal's refusals: a key the page says in the customer's words, and the reason as its DETAIL.
CREATE FUNCTION goc.refused_key(label text, stmt text, want_key text, want_detail text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF SQLERRM IS DISTINCT FROM want_key OR v_detail IS DISTINCT FROM want_detail THEN
      RAISE EXCEPTION E'% was refused otherwise.\n--- got ---\n% / %\n--- want ---\n% / %', label, SQLERRM, v_detail, want_key, want_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION goc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The clinic's price by line as it first went, and its new price (the fee moved from 10,000 to 12,000).
CREATE FUNCTION goc.w1() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT '{"00000000-0000-0000-0000-0000000009b1": 100000, "00000000-0000-0000-0000-0000000009b2": 50000, "gc": 20000, "contingency": 5000, "fee": 10000}'::jsonb $$;
CREATE FUNCTION goc.w2() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT goc.w1() || '{"fee": 12000}'::jsonb $$;
CREATE FUNCTION goc.sha() RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT repeat('ab', 32) $$;
GRANT USAGE ON SCHEMA goc TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA goc TO authenticated, service_role;
GRANT ALL ON goc.ids TO authenticated, service_role;

-- 0 · Who may send: no sign-in, a training account, a digital twin, an estimator and a leader are refused in words.
SET LOCAL ROLE authenticated;
SELECT goc.refused('no sign-in sends nothing', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Sign in first.');
SELECT goc.refused('no sign-in marks nothing signed', $q$SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a4', DATE '2026-10-05', goc.w1())$q$,
  'Sign in to mark the contract signed.');
RESET ROLE;
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d5');
SET LOCAL ROLE authenticated;
SELECT goc.refused('a training account sends nothing', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'A training account cannot send our contract.');
RESET ROLE;
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d6');
SET LOCAL ROLE authenticated;
SELECT goc.refused('a digital twin sends nothing', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'A digital twin cannot send our contract.');
RESET ROLE;
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
SELECT goc.refused('an estimator sends nothing', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Only a dev sends our contract while GC mode is built.');
RESET ROLE;
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d4');
SET LOCAL ROLE authenticated;
SELECT goc.refused('a leader sends nothing until award''s door', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Only a dev sends our contract while GC mode is built.');
RESET ROLE;
SELECT goc.same('nothing went and no day is stamped', (
  SELECT (SELECT count(*) FROM public.gc_owner_contract_sends)::text || ' ' || coalesce(owner_contract_sent_on::text, 'not sent')
  FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000009a1'), '0 not sent');
SELECT goc.same('anon calls none of the five', (
  SELECT string_agg(has_function_privilege('anon', f, 'EXECUTE')::text, ' ') FROM unnest(ARRAY[
    'public.gc_send_owner_contract(uuid, date, text, jsonb, text, text, text)',
    'public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text)',
    'public.gc_owner_contract_keep(uuid, date, jsonb)',
    'public.gc_owner_contract_worth_ok(uuid, jsonb)',
    'public.gc_owner_contract_portal_signed_on(uuid)']) AS f), 'false false false false false');
-- The customer's portal runs as the service role: it signs (B6-d-iii's kind) and checks a send's price ahead of time
-- (customer-portal's loader), so a missing grant would leave the price warning failing quietly.
SELECT goc.same('the service role signs and checks the price', (
  SELECT string_agg(has_function_privilege('service_role', f, 'EXECUTE')::text, ' ') FROM unnest(ARRAY[
    'public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text)',
    'public.gc_owner_contract_worth_ok(uuid, jsonb)',
    'public.gc_owner_contract_keep(uuid, date, jsonb)']) AS f), 'true true true');

-- 1 · As a dev: a job that is not there, one still bidding and a lost one, each in words.
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT goc.refused('a job that is not there', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a9', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a9/c.pdf', 'c.pdf', goc.sha())$q$,
  'That GC project is not there.');
SELECT goc.refused('a job still bidding', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a2', public.app_today() + 7, '', '{}', '00000000-0000-0000-0000-0000000009a2/c.pdf', 'c.pdf', goc.sha())$q$,
  'Contract Bidding Clinic is still bidding. Press We won this first.');
SELECT goc.refused('a lost job', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a3', public.app_today() + 7, '', '{}', '00000000-0000-0000-0000-0000000009a3/c.pdf', 'c.pdf', goc.sha())$q$,
  'Contract Lost Clinic is lost. Bring it back before you send our contract.');

-- 2 · A send that is not whole: the day, the line, the price by line in Owner Billing's words, and the file.
SELECT goc.refused('no sign-by day', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', NULL, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Pick the day to ask them to sign by.');
SELECT goc.refused('a sign-by day gone by', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() - 1, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Pick a sign-by day from today on.');
SELECT goc.refused('a line over 500 characters', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, repeat('x', 501), goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Keep your line under 500 characters.');
SELECT goc.refused('no price by line', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', NULL, '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Send the price by line: each trade, then general conditions, contingency and fee.');
SELECT goc.refused('a line with no dollar amount', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1() || '{"fee": "ten"}', '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Each line of the price needs a dollar amount.');
SELECT goc.refused('a line below zero', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1() || '{"fee": -1}', '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'A line of the price cannot be below zero.');
SELECT goc.refused('a line that is not ours or a trade of the job', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1() || '{"00000000-0000-0000-0000-0000000009b4": 1}', '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'Each line of the price must be one of this project''s trades, general conditions, contingency or fee.');
SELECT goc.refused('a trade left out', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1() - '00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'The price must name every trade on the project.');
SELECT goc.refused('our fee left out', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1() - 'fee', '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', goc.sha())$q$,
  'The price must have general conditions, contingency and fee.');
SELECT goc.refused('no file', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '  ', 'contract-1.pdf', goc.sha())$q$,
  'Attach the contract file first.');
SELECT goc.refused('another job''s file', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a5/contract.pdf', 'contract.pdf', goc.sha())$q$,
  'That file is not this project''s.');
SELECT goc.refused('a fingerprint that is not one', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', 'abc')$q$,
  'The file''s fingerprint is not right. Attach it again.');
SELECT goc.refused('a file never uploaded', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w1(), '00000000-0000-0000-0000-0000000009a1/contract-9.pdf', 'contract-9.pdf', goc.sha())$q$,
  'Upload the contract file first.');

-- 3 · The first send: the price by line, the file and its fingerprint, our line trimmed, and the day it went.
INSERT INTO goc.ids SELECT 's1', public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '  Thank you for the job.  ', goc.w1(),
  '00000000-0000-0000-0000-0000000009a1/contract-1.pdf', 'contract-1.pdf', upper(goc.sha()));
RESET ROLE;
SELECT goc.same('the first send keeps what went', (
  SELECT first || ' | ' || (sent_on = public.app_today()) || ' | ' || (sign_by = public.app_today() + 7) || ' | ' || note || ' | ' || total
      || ' | ' || file_name || ' | ' || (file_sha256 = goc.sha()) || ' | ' || (sent_by = '00000000-0000-0000-0000-0000000009d1') || ' | '
      || (customer_id = '00000000-0000-0000-0000-0000000009c1') || ' | ' || coalesce(signed_on::text, 'unsigned')
  FROM public.gc_owner_contract_sends WHERE id = (SELECT id FROM goc.ids WHERE k = 's1')),
  'true | true | true | Thank you for the job. | 185000 | contract-1.pdf | true | true | true | unsigned');
SELECT goc.same('the first send stamps the day it went', (
  SELECT (owner_contract_sent_on = public.app_today())::text FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000009a1'), 'true');

-- 4 · The new price: a second send, not the first, and the day the first went stays.
UPDATE public.gc_projects SET owner_contract_sent_on = DATE '2026-10-01' WHERE project_id = '00000000-0000-0000-0000-0000000009a1';
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
INSERT INTO goc.ids SELECT 's2', public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 3, '', goc.w2(),
  '00000000-0000-0000-0000-0000000009a1/contract-2.pdf', 'contract-2.pdf', goc.sha());
INSERT INTO goc.ids SELECT 's5', public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a5', public.app_today() + 7, '',
  '{"00000000-0000-0000-0000-0000000009b5": 900, "gc": 0, "contingency": 0, "fee": 100}', '00000000-0000-0000-0000-0000000009a5/contract.pdf', 'contract.pdf', goc.sha());
RESET ROLE;
SELECT goc.same('the new price is a send after the first, and the first day stays', (
  SELECT s.first || ' ' || s.total || ' ' || g.owner_contract_sent_on
  FROM public.gc_owner_contract_sends s JOIN public.gc_projects g ON g.project_id = s.project_id
  WHERE s.id = (SELECT id FROM goc.ids WHERE k = 's2')), 'false 187000 2026-10-01');

-- 5 · The sends and their files are a dev's alone: the price by line is our markup. No one signed in changes a send,
-- writes a signature or takes one back.
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
SELECT goc.same('an estimator reads no send', (SELECT count(*)::text FROM public.gc_owner_contract_sends), '0');
SELECT goc.same('an estimator reads no file', (SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'gc-owner-contracts'), '0');
SELECT goc.refused('an estimator adds no file', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('gc-owner-contracts', '00000000-0000-0000-0000-0000000009a1/mine.pdf')$q$,
  'new row violates row-level security policy for table "objects"');
SELECT goc.same('an estimator reads no portal day', (SELECT coalesce(public.gc_owner_contract_portal_signed_on('00000000-0000-0000-0000-0000000009a1')::text, 'none')), 'none');
RESET ROLE;
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d3');
SET LOCAL ROLE authenticated;
SELECT goc.same('an assistant reads no send', (SELECT count(*)::text FROM public.gc_owner_contract_sends), '0');
SELECT goc.same('an assistant reads no file', (SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'gc-owner-contracts'), '0');
RESET ROLE;
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d4');
SET LOCAL ROLE authenticated;
SELECT goc.same('a leader reads no send until award''s door', (SELECT count(*)::text FROM public.gc_owner_contract_sends), '0');
RESET ROLE;
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT goc.same('a dev reads the three sends and the three files', (
  SELECT (SELECT count(*) FROM public.gc_owner_contract_sends) || ' ' || (SELECT count(*) FROM storage.objects WHERE bucket_id = 'gc-owner-contracts')), '3 3');
SELECT goc.refused('a dev writes no signature', $q$UPDATE public.gc_owner_contract_sends SET signed_on = public.app_today(), signer_printed_name = 'Forged', signer_consented_at = now() WHERE id = (SELECT id FROM goc.ids WHERE k = 's2')$q$,
  'permission denied for table gc_owner_contract_sends');
SELECT goc.refused('a dev inserts no signed send', $q$INSERT INTO public.gc_owner_contract_sends (project_id, sign_by, worth, file_path, file_name, file_sha256, signed_on) VALUES ('00000000-0000-0000-0000-0000000009a1', public.app_today(), goc.w1(), 'x', 'x', goc.sha(), public.app_today())$q$,
  'permission denied for table gc_owner_contract_sends');
SELECT goc.refused('a dev takes back no send', $q$DELETE FROM public.gc_owner_contract_sends WHERE id = (SELECT id FROM goc.ids WHERE k = 's1')$q$,
  'permission denied for table gc_owner_contract_sends');
SELECT goc.refused('a signed-in person signs nothing for the customer', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', (SELECT id FROM goc.ids WHERE k = 's2'), 'Pat Owner', '', '', '')$q$,
  'permission denied for function gc_customer_sign_owner_contract');
SELECT goc.same('no portal day before they sign', (SELECT coalesce(public.gc_owner_contract_portal_signed_on('00000000-0000-0000-0000-0000000009a1')::text, 'none')), 'none');
RESET ROLE;

-- 6 · The customer signs in their portal, as the service role after their link: each refusal by its key and reason.
SET LOCAL ROLE service_role;
SELECT goc.refused_key('a contract that is not there', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009ff', 'Pat Owner', '', '', '')$q$,
  'notFound', 'No contract with that id.');
SELECT goc.refused_key('another customer''s contract', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c2', (SELECT id FROM goc.ids WHERE k = 's2'), 'Pat Owner', '', '', '')$q$,
  'notYours', 'That contract is another customer''s.');
SELECT goc.refused_key('a send a newer one replaced', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', (SELECT id FROM goc.ids WHERE k = 's1'), 'Pat Owner', '', '', '')$q$,
  'notNewest', 'We sent you a newer one. Sign that one.');
RESET ROLE;
-- A trade added after the send makes its price not whole: the customer reads priceChanged, never the office's words.
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES ('00000000-0000-0000-0000-0000000009b3', '00000000-0000-0000-0000-0000000009a1', 'Concrete', 2);
SET LOCAL ROLE service_role;
SELECT goc.refused_key('a trade added since it went', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', (SELECT id FROM goc.ids WHERE k = 's2'), 'Pat Owner', '', '', '')$q$,
  'priceChanged', 'Our price changed after we sent this. We will send you the new one.');
RESET ROLE;
DELETE FROM public.gc_trade_packages WHERE id = '00000000-0000-0000-0000-0000000009b3';
SET LOCAL ROLE service_role;
SELECT goc.refused_key('no name', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', (SELECT id FROM goc.ids WHERE k = 's2'), '   ', '', '', '')$q$,
  'nameNeeded', 'Type your name to sign.');
SELECT goc.refused_key('a name over 200 characters', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', (SELECT id FROM goc.ids WHERE k = 's2'), repeat('x', 201), '', '', '')$q$,
  'tooLong', 'Keep the name under 200 characters.');
SELECT goc.same('the newest send signs, at the time it gives back', (
  SELECT (public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', (SELECT id FROM goc.ids WHERE k = 's2'), '  Pat Owner  ',
    'contract-signer-signatures/gc-owner-contracts/s2/sig.png', '203.0.113.9', 'Portal Browser') = now())::text), 'true');
SELECT goc.refused_key('a second signature', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', (SELECT id FROM goc.ids WHERE k = 's2'), 'Pat Owner', '', '', '')$q$,
  'alreadySigned', 'That contract is signed already.');
RESET ROLE;
UPDATE public.gc_projects SET lost_on = public.app_today() WHERE project_id = '00000000-0000-0000-0000-0000000009a5';
SET LOCAL ROLE service_role;
SELECT goc.refused_key('a job lost after it went', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-0000000009c1', (SELECT id FROM goc.ids WHERE k = 's5'), 'Pat Owner', '', '', '')$q$,
  'lost', 'That job is not going ahead.');
RESET ROLE;
SELECT goc.same('the signature is kept on the send it signed', (
  SELECT (signed_on = public.app_today()) || ' | ' || signer_printed_name || ' | ' || signer_signature_storage_path || ' | ' || signer_ip || ' | '
      || signer_user_agent || ' | ' || (signer_consented_at = now())
  FROM public.gc_owner_contract_sends WHERE id = (SELECT id FROM goc.ids WHERE k = 's2')),
  'true | Pat Owner | contract-signer-signatures/gc-owner-contracts/s2/sig.png | 203.0.113.9 | Portal Browser | true');
SELECT goc.same('the price kept is the newest send''s, line by line, and the contract is signed today', (
  SELECT string_agg(l.line || ':' || coalesce(k.trade, '-') || ':' || l.worth::numeric(12, 0), ' ' ORDER BY l.line, k.trade)
      || ' | ' || (SELECT (owner_contract_signed_on = public.app_today())::text FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000009a1')
  FROM public.gc_owner_contract_lines l LEFT JOIN public.gc_trade_packages k ON k.id = l.package_id
  WHERE l.project_id = '00000000-0000-0000-0000-0000000009a1'),
  'contingency:-:5000 fee:-:12000 gc:-:20000 trade:Electrical:100000 trade:Plumbing:50000 | true');
SELECT goc.same('the first send stays unsigned', (
  SELECT coalesce(signed_on::text, 'unsigned') FROM public.gc_owner_contract_sends WHERE id = (SELECT id FROM goc.ids WHERE k = 's1')), 'unsigned');

-- 7 · Mark it signed after their signature: neither undone nor moved, and no send after it. A fixed day reads in words.
UPDATE public.gc_owner_contract_sends SET signed_on = DATE '2026-10-12' WHERE id = (SELECT id FROM goc.ids WHERE k = 's2');
UPDATE public.gc_projects SET owner_contract_signed_on = DATE '2026-10-12' WHERE project_id = '00000000-0000-0000-0000-0000000009a1';
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT goc.same('a dev reads the day they signed', (SELECT public.gc_owner_contract_portal_signed_on('00000000-0000-0000-0000-0000000009a1')::text), '2026-10-12');
SELECT goc.refused('Undo after their signature', $q$SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a1', NULL)$q$,
  'They signed it in their portal, so it stays signed.');
SELECT goc.refused('moving the day they signed', $q$SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a1', DATE '2026-10-13')$q$,
  'They signed it in their portal on Oct 12, so its day stays.');
SELECT goc.refused('a send after it is signed', $q$SELECT public.gc_send_owner_contract('00000000-0000-0000-0000-0000000009a1', public.app_today() + 7, '', goc.w2(), '00000000-0000-0000-0000-0000000009a1/contract-2.pdf', 'contract-2.pdf', goc.sha())$q$,
  'Our contract for Contract Clinic is signed already.');
SELECT goc.refused('the shared first sign on a signed contract', $q$SELECT public.gc_owner_contract_keep('00000000-0000-0000-0000-0000000009a1', public.app_today(), goc.w2())$q$,
  'That contract is signed already.');
SELECT goc.refused('the shared first sign with no day', $q$SELECT public.gc_owner_contract_keep('00000000-0000-0000-0000-0000000009a4', NULL, '{}')$q$,
  'Pick the day it was signed.');
RESET ROLE;
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d4');
SET LOCAL ROLE authenticated;
SELECT goc.refused('a leader cannot undo their signature either', $q$SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a1', NULL)$q$,
  'They signed it in their portal, so it stays signed.');
RESET ROLE;
SELECT goc.same('their signature, the day and the price all stay', (
  SELECT g.owner_contract_signed_on || ' ' || (SELECT count(*) FROM public.gc_owner_contract_lines l WHERE l.project_id = g.project_id)
  FROM public.gc_projects g WHERE g.project_id = '00000000-0000-0000-0000-0000000009a1'), '2026-10-12 5');

-- 8 · Mark it signed on paper works as it did: Owner Billing's words, a first sign by line, the day moved, then Undo.
SELECT goc.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT goc.refused('Mark it signed with no price by line', $q$SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a4', DATE '2026-10-05')$q$,
  'Send the price by line: each trade, then general conditions, contingency and fee.');
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a4', DATE '2026-10-05',
  '{"00000000-0000-0000-0000-0000000009b4": 40000, "gc": 3000, "contingency": 500, "fee": 2500}');
SELECT goc.same('signed on paper by line', (
  SELECT owner_contract_signed_on || ' ' || (SELECT sum(worth)::numeric(12, 0) FROM public.gc_owner_contract_lines WHERE project_id = '00000000-0000-0000-0000-0000000009a4')
  FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000009a4'), '2026-10-05 46000');
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a4', DATE '2026-10-06', '{"gc": 1}');
SELECT goc.same('signed already: only the day moves', (
  SELECT owner_contract_signed_on || ' ' || (SELECT sum(worth)::numeric(12, 0) FROM public.gc_owner_contract_lines WHERE project_id = '00000000-0000-0000-0000-0000000009a4')
  FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000009a4'), '2026-10-06 46000');
SELECT goc.refused('Mark it signed on a job that is not there', $q$SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a9', NULL)$q$,
  'That GC project is not there.');
RESET ROLE;
-- A pay application on the price keeps it signed, as Owner Billing wrote it; taken away, Undo works.
INSERT INTO public.gc_owner_pay_apps (project_id, number, period_to, sent_on, retainage_pct, retainage, work_to_date, due)
VALUES ('00000000-0000-0000-0000-0000000009a4', 1, DATE '2026-10-31', DATE '2026-10-31', 10, 100, 1000, 900);
SET LOCAL ROLE authenticated;
SELECT goc.refused('Undo once a pay application went out', $q$SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a4', NULL)$q$,
  'A pay application went out on this price, so the contract stays signed.');
RESET ROLE;
DELETE FROM public.gc_owner_pay_apps WHERE project_id = '00000000-0000-0000-0000-0000000009a4';
SET LOCAL ROLE authenticated;
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000009a4', NULL);
SELECT goc.same('Undo on paper takes the day and the price', (
  SELECT coalesce(owner_contract_signed_on::text, 'unsigned') || ' ' || (SELECT count(*) FROM public.gc_owner_contract_lines WHERE project_id = '00000000-0000-0000-0000-0000000009a4')
  FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000009a4'), 'unsigned 0');
RESET ROLE;

-- 9 · The e-sign ledger takes our contract, and still takes every record type it took before.
INSERT INTO public.esign_consents (record_type, record_id, consent_version, lang, audience, document_noun, clause_text, printed_name, method)
SELECT t, (SELECT id FROM goc.ids WHERE k = 's2'), 1, 'en', 'customer', 'contract', 'I agree to sign electronically.', 'Pat Owner', 'draw'
FROM unnest(ARRAY['gc_owner_contract', 'estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room', 'lien_owner_record_request', 'gc_sow', 'gc_draw', 'gc_trade_change']) AS t;
SELECT goc.same('the ledger kept all ten', (SELECT count(*)::text FROM public.esign_consents WHERE record_id = (SELECT id FROM goc.ids WHERE k = 's2')), '10');
SELECT goc.refused('a record type it never had', $q$INSERT INTO public.esign_consents (record_type, record_id, consent_version, lang, audience, document_noun, clause_text) VALUES ('gc_nonsense', gen_random_uuid(), 1, 'en', 'customer', 'x', 'x')$q$,
  'new row for relation "esign_consents" violates check constraint "esign_consents_record_type_check"');

DO $$ BEGIN RAISE NOTICE 'gc_owner_contract PASSED'; END $$;
ROLLBACK;
