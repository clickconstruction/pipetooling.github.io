-- Reopen a returned check's case (punch list #443, row 5, migration *_reopen_ar_return_case_two_reasons): the
-- database holds a replaced case closed, as the two sibling functions and the client already did. Rosa the assistant
-- closes three cases, one each way, and reopens: a case settled another way opens; a case not coming opens; a case a
-- new deposit replaced is refused and keeps the deposit it names; an open case is refused; a primary is refused at the
-- door. Everything rolls back. Raises on the first failed assertion; ends with "primary_money_desks PASSED". See
-- scripts/pgtest-primary-money-desks.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA rrc;
CREATE FUNCTION rrc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION rrc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A reopen's answer in a few words: ok, or the refusal's words.
CREATE FUNCTION rrc.reopen(p_case uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.reopen_ar_return_case(p_case);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A case as the table holds it: open or closed, its reason, and the deposit it names.
CREATE FUNCTION rrc.case_of(p_case uuid) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN closed_at IS NULL THEN 'open' ELSE 'closed' END || ' · ' || COALESCE(closed_reason, '-') || ' · ' || COALESCE(right(replaced_by_mercury_transaction_id::text, 2), '-')
  FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = p_case
$$;
GRANT USAGE ON SCHEMA rrc TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rrc TO authenticated, service_role;

-- Who: Rosa the assistant, Pat a primary on nothing.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000443a3', 'rosa@reopen.test'),
  ('00000000-0000-0000-0000-0000000443a5', 'pat@reopen.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000443a3', 'rosa@reopen.test', 'Reopen Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000443a5', 'pat@reopen.test', 'Reopen Pat', 'primary', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
-- Four deposits the bank sent back (R1 to R4) and the new deposit N1 that replaces R1.
INSERT INTO public.mercury_transactions (id, mercury_account_id, mercury_id, amount, created_at, status, kind) VALUES
  ('00000000-0000-0000-0000-0000000443e1', '00000000-0000-0000-0000-0000000443e0', '00000000-0000-0000-0000-0000000443f1', 300, now(), 'sent', 'checkDeposit'),
  ('00000000-0000-0000-0000-0000000443e2', '00000000-0000-0000-0000-0000000443e0', '00000000-0000-0000-0000-0000000443f2', 120, now(), 'sent', 'checkDeposit'),
  ('00000000-0000-0000-0000-0000000443e3', '00000000-0000-0000-0000-0000000443e0', '00000000-0000-0000-0000-0000000443f3', 80, now(), 'sent', 'checkDeposit'),
  ('00000000-0000-0000-0000-0000000443e4', '00000000-0000-0000-0000-0000000443e0', '00000000-0000-0000-0000-0000000443f4', 60, now(), 'sent', 'checkDeposit'),
  ('00000000-0000-0000-0000-0000000443e9', '00000000-0000-0000-0000-0000000443e0', '00000000-0000-0000-0000-0000000443f9', 300, now(), 'sent', 'checkDeposit');
INSERT INTO public.mercury_transaction_ar_returned (mercury_transaction_id, returned, source) VALUES
  ('00000000-0000-0000-0000-0000000443e1', true, 'hand'),
  ('00000000-0000-0000-0000-0000000443e2', true, 'hand'),
  ('00000000-0000-0000-0000-0000000443e3', true, 'hand'),
  ('00000000-0000-0000-0000-0000000443e4', true, 'hand')
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET returned = true;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Rosa closes three cases, one each way, through the office's own door.
SELECT rrc.as_user('00000000-0000-0000-0000-0000000443a3');
SET LOCAL ROLE authenticated;
SELECT public.close_ar_return_case('00000000-0000-0000-0000-0000000443e1', 'replaced', 'the customer sent a new check', '00000000-0000-0000-0000-0000000443e9');
SELECT public.close_ar_return_case('00000000-0000-0000-0000-0000000443e2', 'settled_other_way', 'paid in cash at the counter');
SELECT public.close_ar_return_case('00000000-0000-0000-0000-0000000443e3', 'not_coming', NULL);
SELECT rrc.same('R1 is closed as replaced and names N1', rrc.case_of('00000000-0000-0000-0000-0000000443e1'), 'closed · replaced · e9');
SELECT rrc.same('R2 is closed as settled another way', rrc.case_of('00000000-0000-0000-0000-0000000443e2'), 'closed · settled_other_way · -');
SELECT rrc.same('R3 is closed as not coming', rrc.case_of('00000000-0000-0000-0000-0000000443e3'), 'closed · not_coming · -');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Reopen: the two closes by hand open again, the replaced case is refused and keeps its deposit, the open case is refused.
SELECT rrc.same('a case settled another way opens again', rrc.reopen('00000000-0000-0000-0000-0000000443e2') || ' · ' || rrc.case_of('00000000-0000-0000-0000-0000000443e2'), 'ok · open · - · -');
SELECT rrc.same('a case not coming opens again', rrc.reopen('00000000-0000-0000-0000-0000000443e3') || ' · ' || rrc.case_of('00000000-0000-0000-0000-0000000443e3'), 'ok · open · - · -');
SELECT rrc.same('a replaced case is refused, with why', rrc.reopen('00000000-0000-0000-0000-0000000443e1'), 'This case cannot be opened again. A new deposit replaced it, and that deposit stands.');
SELECT rrc.same('the replaced case still names its deposit', rrc.case_of('00000000-0000-0000-0000-0000000443e1'), 'closed · replaced · e9');
SELECT rrc.same('an open case is refused', rrc.reopen('00000000-0000-0000-0000-0000000443e4'), 'This check has no closed case to reopen.');
SELECT rrc.same('a reopened case is refused a second reopen', rrc.reopen('00000000-0000-0000-0000-0000000443e2'), 'This check has no closed case to reopen.');
-- A reopened case can be closed again, the other way.
SELECT public.close_ar_return_case('00000000-0000-0000-0000-0000000443e2', 'not_coming', 'the payer is gone');
SELECT rrc.same('a reopened case closes again', rrc.case_of('00000000-0000-0000-0000-0000000443e2'), 'closed · not_coming · -');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. A primary is refused at the door, before any case is read.
SELECT rrc.as_user('00000000-0000-0000-0000-0000000443a5');
SET LOCAL ROLE authenticated;
SELECT rrc.same('a primary is refused at the door', rrc.reopen('00000000-0000-0000-0000-0000000443e2'), 'reopen_ar_return_case: not authorized');
SELECT rrc.same('a primary is refused on a replaced case too, at the door', rrc.reopen('00000000-0000-0000-0000-0000000443e1'), 'reopen_ar_return_case: not authorized');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'primary_money_desks PASSED'; END $$;
ROLLBACK;
