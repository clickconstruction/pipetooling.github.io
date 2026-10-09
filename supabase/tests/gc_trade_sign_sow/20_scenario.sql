-- The trade signs its statement of work (P2c-i, the Portal lane): gc_trade_sign_sow as the service role, each refusal by
-- its key and words, the master agreement first, the writes and the promise kept. The fixture is made as postgres;
-- everything rolls back. Raises on the first failed assertion; ends with "gc_trade_sign_sow PASSED". See
-- scripts/pgtest-gc-trade-sign-sow.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000cd1', 'dev@signsow.test');
INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-000000000cd1', 'dev@signsow.test', 'Sign-sow Dev', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- The clinic, building, with five trades: Electrical sent to Iron Horse, which signed our master agreement; Plumbing sent
-- to Brushstroke, whose agreement went but is not signed; Drywall a draft and Paint signed, both Iron Horse's; Concrete
-- sent to Level Line, then cancelled.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-000000000cc1', 'Sign-sow Test Owner', '00000000-0000-0000-0000-000000000cd1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-000000000ca1', 'Sign-sow test clinic', '00000000-0000-0000-0000-000000000cc1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-000000000ca1', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000ca1', 'Electrical', 0, 50000, false),
  ('00000000-0000-0000-0000-000000000cb2', '00000000-0000-0000-0000-000000000ca1', 'Plumbing', 1, 30000, false),
  ('00000000-0000-0000-0000-000000000cb3', '00000000-0000-0000-0000-000000000ca1', 'Drywall', 2, 20000, false),
  ('00000000-0000-0000-0000-000000000cb4', '00000000-0000-0000-0000-000000000ca1', 'Paint', 3, 10000, false),
  ('00000000-0000-0000-0000-000000000cb5', '00000000-0000-0000-0000-000000000ca1', 'Concrete', 4, 40000, false);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-000000000c11', 'Iron Horse Electric', '{Electrical,Drywall,Paint}'),
  ('00000000-0000-0000-0000-000000000c12', 'Brushstroke Plumbing', '{Plumbing}'),
  ('00000000-0000-0000-0000-000000000c13', 'Level Line Concrete', '{Concrete}');
INSERT INTO public.gc_invites (id, package_id, company_id, status) VALUES
  ('00000000-0000-0000-0000-000000000c21', '00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000c11', 'bid'),
  ('00000000-0000-0000-0000-000000000c22', '00000000-0000-0000-0000-000000000cb2', '00000000-0000-0000-0000-000000000c12', 'bid'),
  ('00000000-0000-0000-0000-000000000c23', '00000000-0000-0000-0000-000000000cb3', '00000000-0000-0000-0000-000000000c11', 'bid'),
  ('00000000-0000-0000-0000-000000000c24', '00000000-0000-0000-0000-000000000cb4', '00000000-0000-0000-0000-000000000c11', 'bid'),
  ('00000000-0000-0000-0000-000000000c25', '00000000-0000-0000-0000-000000000cb5', '00000000-0000-0000-0000-000000000c13', 'bid');
UPDATE public.gc_trade_packages k SET awarded_invite_id = i.id, awarded_on = DATE '2026-10-01'
FROM public.gc_invites i WHERE i.package_id = k.id AND k.project_id = '00000000-0000-0000-0000-000000000ca1';
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-000000000c31', '00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000c21', '00000000-0000-0000-0000-000000000c11', 'sent', 48000, DATE '2026-10-02', NULL),
  ('00000000-0000-0000-0000-000000000c32', '00000000-0000-0000-0000-000000000cb2', '00000000-0000-0000-0000-000000000c22', '00000000-0000-0000-0000-000000000c12', 'sent', 28000, DATE '2026-10-02', NULL),
  ('00000000-0000-0000-0000-000000000c33', '00000000-0000-0000-0000-000000000cb3', '00000000-0000-0000-0000-000000000c23', '00000000-0000-0000-0000-000000000c11', 'draft', 19000, NULL, NULL),
  ('00000000-0000-0000-0000-000000000c34', '00000000-0000-0000-0000-000000000cb4', '00000000-0000-0000-0000-000000000c24', '00000000-0000-0000-0000-000000000c11', 'signed', 9500, DATE '2026-09-20', DATE '2026-09-22'),
  ('00000000-0000-0000-0000-000000000c35', '00000000-0000-0000-0000-000000000cb5', '00000000-0000-0000-0000-000000000c25', '00000000-0000-0000-0000-000000000c13', 'cancelled', 39000, DATE '2026-10-02', NULL);
-- The papers (B6-b-i): Iron Horse's master agreement signed, with a W-9 beside it; Brushstroke's agreement only sent.
INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status, doc_type) VALUES
  ('gc-company:00000000-0000-0000-0000-000000000c11', 'Master Subcontract Agreement', gen_random_uuid(), 1, 'signed', 'agreement'),
  ('gc-company:00000000-0000-0000-0000-000000000c11', 'W-9', gen_random_uuid(), 1, 'signed', 'w9'),
  ('gc-company:00000000-0000-0000-0000-000000000c12', 'Master Subcontract Agreement', gen_random_uuid(), 1, 'sent', 'agreement');
-- Iron Horse promised its signed statement of work on Electrical by Friday.
INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, made_on, source) VALUES
  ('00000000-0000-0000-0000-000000000c41', '00000000-0000-0000-0000-000000000c11', 'sow', '00000000-0000-0000-0000-000000000ca1', '00000000-0000-0000-0000-000000000cb1', 'the signed statement of work', DATE '2026-10-09', DATE '2026-10-02', 'trade');

CREATE SCHEMA gss;
CREATE FUNCTION gss.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A verb's refusal: P0001 with the key as its message and the words as its DETAIL. Its writes go with the refusal.
CREATE FUNCTION gss.refused(label text, stmt text, want_key text, want_words text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
  v_words text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_words = PG_EXCEPTION_DETAIL;
    IF v_state IS DISTINCT FROM 'P0001' OR SQLERRM IS DISTINCT FROM want_key OR v_words IS DISTINCT FROM want_words THEN
      RAISE EXCEPTION E'% was refused another way.\n--- got ---\n% % / %\n--- want ---\nP0001 % / %', label, v_state, SQLERRM, v_words, want_key, want_words;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gss.refused_code(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF NOT (SQLSTATE = ANY (string_to_array(want, ','))) THEN RAISE EXCEPTION '% was refused as % (%), not %', label, SQLSTATE, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gss.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION gss.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
GRANT USAGE ON SCHEMA gss TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gss TO anon, authenticated, service_role;

-- 0 · The service role's alone.
SELECT gss.same('only the service role signs for a trade', (
  SELECT has_function_privilege('service_role', f, 'EXECUTE')::text || '/' || has_function_privilege('authenticated', f, 'EXECUTE')::text || '/' || has_function_privilege('anon', f, 'EXECUTE')::text
  FROM (VALUES ('public.gc_trade_sign_sow(uuid, uuid, text, text, text, text)')) v(f)), 'true/false/false');

-- 1 · The refusals, each in its words.
SELECT gss.as_service();
SET LOCAL ROLE service_role;
SELECT gss.refused('a statement of work that is not there', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-000000000999', 'Dana Whitfield', NULL, NULL, NULL)$q$,
  'notFound', 'No statement of work with that id.');
SELECT gss.refused('another company''s statement of work', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c13', '00000000-0000-0000-0000-000000000c31', 'Dana Whitfield', NULL, NULL, NULL)$q$,
  'notYours', 'That statement of work is another company''s.');
SELECT gss.refused('one signed already', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-000000000c34', 'Dana Whitfield', NULL, NULL, NULL)$q$,
  'alreadySigned', 'That statement of work is signed already.');
SELECT gss.refused('a draft the office has not sent', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-000000000c33', 'Dana Whitfield', NULL, NULL, NULL)$q$,
  'sowNotSent', 'That statement of work is not sent to sign.');
SELECT gss.refused('one the office cancelled', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c13', '00000000-0000-0000-0000-000000000c35', 'Pat Rivera', NULL, NULL, NULL)$q$,
  'sowNotSent', 'That statement of work is not sent to sign.');
SELECT gss.refused('a company whose master agreement is sent but not signed', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c12', '00000000-0000-0000-0000-000000000c32', 'Sam Ortiz', NULL, NULL, NULL)$q$,
  'msaFirst', 'Sign our master agreement first.');
SELECT gss.refused('no name', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-000000000c31', '   ', NULL, NULL, NULL)$q$,
  'nameNeeded', 'Type your name to sign.');
SELECT gss.refused('a name past 200 characters', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-000000000c31', repeat('x', 201), NULL, NULL, NULL)$q$,
  'tooLong', 'Keep the name under 200 characters.');
SELECT gss.same('nothing is signed by a refusal', (SELECT count(*)::text FROM public.gc_sows WHERE status = 'signed'), '1');

-- 2 · Iron Horse signs Electrical: the status, the day, the signer's fields, and its promise kept. It returns the
--     consent time it wrote, which the submit function gives the e-sign ledger row (one transaction: now() holds).
SELECT gss.same('it returns the consent time it wrote', (public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-000000000c31',
  '  Dana Whitfield  ', 'gc-sows/00000000-0000-0000-0000-000000000c31/sig.png', '203.0.113.7', 'Mozilla/5.0 (iPhone)') = now())::text, 'true');
RESET ROLE;
SELECT gss.same('signed, with who, the drawn signature, when, from where and on what', (
  SELECT status || ' ' || (signed_on = public.app_today()) || ' [' || signer_printed_name || '] ' || signer_signature_storage_path || ' ' || (signer_consented_at = now()) || ' ' || signer_ip || ' [' || signer_user_agent || ']'
  FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-000000000c31'),
  'signed true [Dana Whitfield] gc-sows/00000000-0000-0000-0000-000000000c31/sig.png true 203.0.113.7 [Mozilla/5.0 (iPhone)]');
SELECT gss.same('the statement of work it promised is kept', (SELECT (kept_on = public.app_today())::text FROM public.gc_trade_promises WHERE id = '00000000-0000-0000-0000-000000000c41'), 'true');

SELECT gss.as_service();
SET LOCAL ROLE service_role;
SELECT gss.refused('a second signature', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-000000000c31', 'Dana Whitfield', NULL, NULL, NULL)$q$,
  'alreadySigned', 'That statement of work is signed already.');
RESET ROLE;

-- 3 · Typed, with no image: Brushstroke signs once its master agreement is signed.
UPDATE public.person_contract_documents SET status = 'signed' WHERE person_name = 'gc-company:00000000-0000-0000-0000-000000000c12';
SELECT gss.as_service();
SET LOCAL ROLE service_role;
SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c12', '00000000-0000-0000-0000-000000000c32', 'Sam Ortiz', '', '', '') IS NOT NULL AS signed;
RESET ROLE;
SELECT gss.same('a typed signature keeps no image, and no blank IP or browser', (
  SELECT status || ' ' || coalesce(signer_signature_storage_path, 'none') || ' ' || coalesce(signer_ip, 'none') || ' ' || coalesce(signer_user_agent, 'none') FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-000000000c32'),
  'signed none none none');

-- 4 · A signed-in user never signs for a trade.
SELECT gss.as_user('00000000-0000-0000-0000-000000000cd1');
SET LOCAL ROLE authenticated;
SELECT gss.refused_code('a signed-in dev cannot sign for the trade', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-000000000c11', '00000000-0000-0000-0000-000000000c33', 'Dana', NULL, NULL, NULL)$q$, '42501');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_trade_sign_sow PASSED'; END $$;
ROLLBACK;
