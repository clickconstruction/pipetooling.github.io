-- Old payments typed one per sheet, gathered into the sending they were (migration *_sub_gather_sendings, punch list
-- #347's residue): the rows the office picks get one numbered sending and nothing else about them changes, not an
-- amount, a date, a sheet, a tick or a bank match. Rows matched to different bank lines are refused: a sending is one
-- money movement. Fixtures are written as postgres; the press runs as each user; everything rolls back. Raises on the
-- first failed assertion; ends with "sub_gather_sendings PASSED". See scripts/pgtest-sub-gather-sendings.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Devon is a dev, the office. Priya estimates and is not office staff. Pat Sub has four sheets. Olive Other has one.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000347d0a1', 'devon@subgather.test'),
  ('00000000-0000-0000-0000-00000347d0a2', 'priya@subgather.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at) VALUES
  ('00000000-0000-0000-0000-00000347d0a1', 'devon@subgather.test', 'Devon Dev', 'dev', false, false, false, NULL),
  ('00000000-0000-0000-0000-00000347d0a2', 'priya@subgather.test', 'Priya Estimator', 'estimator', false, false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-00000347d0e1', '00000000-0000-0000-0000-00000347d0a1', 'sub', 'Pat Sub Gatherbed'),
  ('00000000-0000-0000-0000-00000347d0e2', '00000000-0000-0000-0000-00000347d0a1', 'sub', 'Olive Other Gatherbed');
-- The sheets. Each name resolves to its person, so the assignee trigger puts them on it.
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name) VALUES
  ('00000000-0000-0000-0000-00000347d0b1', '00000000-0000-0000-0000-00000347d0a1', 'Pat Sub Gatherbed'),
  ('00000000-0000-0000-0000-00000347d0b2', '00000000-0000-0000-0000-00000347d0a1', 'Pat Sub Gatherbed'),
  ('00000000-0000-0000-0000-00000347d0b3', '00000000-0000-0000-0000-00000347d0a1', 'Pat Sub Gatherbed'),
  ('00000000-0000-0000-0000-00000347d0b4', '00000000-0000-0000-0000-00000347d0a1', 'Pat Sub Gatherbed'),
  ('00000000-0000-0000-0000-00000347d0b5', '00000000-0000-0000-0000-00000347d0a1', 'Olive Other Gatherbed');
-- Two bank lines: the $2,100 check and another payment of $200.
INSERT INTO public.mercury_transactions (id, mercury_account_id, mercury_id, amount, created_at, status, kind) VALUES
  ('00000000-0000-0000-0000-00000347d0d1', '00000000-0000-0000-0000-00000347d0d7', '00000000-0000-0000-0000-00000347d0d8', -2100, '2026-08-14T15:00:00Z', 'sent', 'outgoingPayment'),
  ('00000000-0000-0000-0000-00000347d0d2', '00000000-0000-0000-0000-00000347d0d7', '00000000-0000-0000-0000-00000347d0d9', -200, '2026-08-14T15:00:00Z', 'sent', 'outgoingPayment');
-- A sending that already exists, for the row that is in one.
INSERT INTO public.sub_payment_sendings (id, person_id) VALUES
  ('00000000-0000-0000-0000-00000347d0f1', '00000000-0000-0000-0000-00000347d0e1');
-- c1, c2, c3: one $2,100 check typed as three rows. c2 is ticked and matched to its bank line. c3 keeps a $25 credit.
-- c4: $200 on a fourth sheet, ticked and matched to the other bank line. c5: a back-charge. c6: paid from a credit.
-- c7: already in a sending. c8: on Olive's sheet. c9: $40 on the fourth sheet, neither ticked nor matched.
INSERT INTO public.people_labor_job_payments (id, job_id, amount, sequence_order, payment_date, method, method_ref, sending_id, checked_at, checked_by, checked_by_name) VALUES
  ('00000000-0000-0000-0000-00000347d0c1', '00000000-0000-0000-0000-00000347d0b1', 500, 0, '2026-08-14', 'check', '1167', NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347d0c2', '00000000-0000-0000-0000-00000347d0b2', 700, 0, '2026-08-14', 'check', '1167', NULL, '2026-11-01T15:00:00Z', '00000000-0000-0000-0000-00000347d0a1', 'Devon Dev'),
  ('00000000-0000-0000-0000-00000347d0c3', '00000000-0000-0000-0000-00000347d0b3', 900, 0, '2026-08-14', 'check', '1167', NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347d0c4', '00000000-0000-0000-0000-00000347d0b4', 200, 0, '2026-08-14', 'check', '1168', NULL, '2026-11-02T15:00:00Z', '00000000-0000-0000-0000-00000347d0a1', 'Devon Dev'),
  ('00000000-0000-0000-0000-00000347d0c5', '00000000-0000-0000-0000-00000347d0b1', -50, 1, '2026-08-14', NULL, NULL, NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347d0c6', '00000000-0000-0000-0000-00000347d0b2', 30, 1, '2026-08-14', 'credit', NULL, NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347d0c7', '00000000-0000-0000-0000-00000347d0b3', 100, 1, '2026-08-14', 'check', '1167', '00000000-0000-0000-0000-00000347d0f1', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347d0c8', '00000000-0000-0000-0000-00000347d0b5', 60, 0, '2026-08-14', 'check', '1167', NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347d0c9', '00000000-0000-0000-0000-00000347d0b4', 40, 1, '2026-08-14', 'check', '1168', NULL, NULL, NULL, NULL);
INSERT INTO public.sub_credit_entries (person_id, amount, payment_id) VALUES
  ('00000000-0000-0000-0000-00000347d0e1', 25, '00000000-0000-0000-0000-00000347d0c3');
INSERT INTO public.sub_payment_bank_matches (payment_id, mercury_transaction_id, matched_by, matched_by_name, matched_at) VALUES
  ('00000000-0000-0000-0000-00000347d0c2', '00000000-0000-0000-0000-00000347d0d1', '00000000-0000-0000-0000-00000347d0a1', 'Devon Dev', '2026-11-01T15:00:00Z'),
  ('00000000-0000-0000-0000-00000347d0c4', '00000000-0000-0000-0000-00000347d0d2', '00000000-0000-0000-0000-00000347d0a1', 'Devon Dev', '2026-11-02T15:00:00Z');

CREATE SCHEMA sgs;
CREATE FUNCTION sgs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sgs.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION sgs.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A payment's id from its last two characters: sgs.c('c1').
CREATE FUNCTION sgs.c(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-00000347d0' || p)::uuid $$;
-- The press as Pat's: how many payments the new sending took.
CREATE FUNCTION sgs.press(p_person uuid, p_ids uuid[]) RETURNS text LANGUAGE sql AS $$
  SELECT r->>'payments' FROM public.gather_sub_payments_into_sending(p_person, p_ids) AS r
$$;
-- Every payment in one line, by id: its amount, its day, and whether it is in a sending and ticked.
CREATE FUNCTION sgs.rows() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(concat_ws(':', right(p.id::text, 2), p.amount, p.payment_date, right(p.job_id::text, 2), (p.sending_id IS NOT NULL)::text, (p.checked_at IS NOT NULL)::text), ' ' ORDER BY p.id)
  FROM public.people_labor_job_payments p WHERE p.id::text LIKE '00000000-0000-0000-0000-00000347d0c%'
$$;
GRANT USAGE ON SCHEMA sgs TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sgs TO authenticated, anon;

-- 0 · The fixture is the shape the function reads, and the function is the office's to call.
SELECT sgs.same('Pat is on four sheets and Olive on one',
  (SELECT string_agg(right(a.person_id::text, 2) || ':' || n, ' ' ORDER BY a.person_id) FROM (SELECT person_id, count(*) AS n FROM public.people_labor_job_assignees WHERE labor_job_id::text LIKE '00000000-0000-0000-0000-00000347d0b%' GROUP BY person_id) a),
  'e1:4 e2:1');
SELECT sgs.same('a signed-in login may call it', has_function_privilege('authenticated', 'public.gather_sub_payments_into_sending(uuid, uuid[])', 'EXECUTE')::text, 'true');
SELECT sgs.same('nobody signed out may', has_function_privilege('anon', 'public.gather_sub_payments_into_sending(uuid, uuid[])', 'EXECUTE')::text, 'false');
SELECT sgs.same('the rows before',
  sgs.rows(),
  'c1:500.00:2026-08-14:b1:false:false c2:700.00:2026-08-14:b2:false:true c3:900.00:2026-08-14:b3:false:false c4:200.00:2026-08-14:b4:false:true c5:-50.00:2026-08-14:b1:false:false c6:30.00:2026-08-14:b2:false:false c7:100.00:2026-08-14:b3:true:false c8:60.00:2026-08-14:b5:false:false c9:40.00:2026-08-14:b4:false:false');

-- 1 · An estimator is refused: sub pay is the office's.
SELECT sgs.as_user('00000000-0000-0000-0000-00000347d0a2');
SET LOCAL ROLE authenticated;
SELECT sgs.refused('Priya''s press', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('c2')])$q$, 'Only the office roles');
RESET ROLE;

-- 2 · Each refusal, as Devon, with its reason.
SELECT sgs.as_user('00000000-0000-0000-0000-00000347d0a1');
SET LOCAL ROLE authenticated;
SELECT sgs.refused('no person', $q$SELECT sgs.press(NULL, ARRAY[sgs.c('c1'), sgs.c('c2')])$q$, 'a sending is to one person on the roster');
SELECT sgs.refused('one payment', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1')])$q$, 'gather two or more payments');
SELECT sgs.refused('one payment named twice', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('c1')])$q$, 'gather two or more payments');
SELECT sgs.refused('a payment that is gone', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('cf')])$q$, 'one of those payments is gone');
SELECT sgs.refused('a row already in a sending', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('c7')])$q$, 'a payment of 100.00 is already part of a sending');
SELECT sgs.refused('a back-charge', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('c5')])$q$, 'a back-charge is not part of a sending');
SELECT sgs.refused('a payment made from a credit', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('c6')])$q$, 'made from a credit is not money that left');
SELECT sgs.refused('a row on another person''s sheet', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('c8')])$q$, 'a payment of 60.00 is on a sheet that person is not on');
SELECT sgs.refused('rows matched to two bank lines', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c2'), sgs.c('c4')])$q$, 'matched to 2 different bank lines, so they were not one payment');
RESET ROLE;
SELECT sgs.same('the refusals made no sending', (SELECT count(*) FROM public.sub_payment_sendings WHERE person_id = '00000000-0000-0000-0000-00000347d0e1')::text, '1');
SELECT sgs.same('and moved no row',
  sgs.rows(),
  'c1:500.00:2026-08-14:b1:false:false c2:700.00:2026-08-14:b2:false:true c3:900.00:2026-08-14:b3:false:false c4:200.00:2026-08-14:b4:false:true c5:-50.00:2026-08-14:b1:false:false c6:30.00:2026-08-14:b2:false:false c7:100.00:2026-08-14:b3:true:false c8:60.00:2026-08-14:b5:false:false c9:40.00:2026-08-14:b4:false:false');

-- 3 · The press on the three rows of the $2,100 check: one sending, and nothing else about them moves.
SET LOCAL ROLE authenticated;
SELECT sgs.same('Devon''s press', sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('c2'), sgs.c('c3')]), '3');
RESET ROLE;
SELECT sgs.same('the three share one sending, which is Pat''s and has a number',
  (SELECT concat_ws('|', count(DISTINCT p.sending_id), count(*), bool_and(s.person_id = '00000000-0000-0000-0000-00000347d0e1')::text, bool_and(s.number IS NOT NULL)::text)
   FROM public.people_labor_job_payments p JOIN public.sub_payment_sendings s ON s.id = p.sending_id
   WHERE p.id IN (sgs.c('c1'), sgs.c('c2'), sgs.c('c3'))),
  '1|3|true|true');
SELECT sgs.same('no amount, day, sheet or tick moved',
  sgs.rows(),
  'c1:500.00:2026-08-14:b1:true:false c2:700.00:2026-08-14:b2:true:true c3:900.00:2026-08-14:b3:true:false c4:200.00:2026-08-14:b4:false:true c5:-50.00:2026-08-14:b1:false:false c6:30.00:2026-08-14:b2:false:false c7:100.00:2026-08-14:b3:true:false c8:60.00:2026-08-14:b5:false:false c9:40.00:2026-08-14:b4:false:false');
SELECT sgs.same('the tick on the second row is as it was set',
  (SELECT concat_ws('|', (checked_at = '2026-11-01T15:00:00Z'::timestamptz)::text, checked_by_name) FROM public.people_labor_job_payments WHERE id = sgs.c('c2')), 'true|Devon Dev');
SELECT sgs.same('its bank match is as it was made',
  (SELECT concat_ws('|', right(mercury_transaction_id::text, 2), matched_by_name, (matched_at = '2026-11-01T15:00:00Z'::timestamptz)::text) FROM public.sub_payment_bank_matches WHERE payment_id = sgs.c('c2')), 'd1|Devon Dev|true');
SELECT sgs.same('no match appears on the other two',
  (SELECT count(*) FROM public.sub_payment_bank_matches WHERE payment_id IN (sgs.c('c1'), sgs.c('c3')))::text, '0');
SELECT sgs.same('the credit the third row kept is under the sending now',
  (SELECT concat_ws('|', e.amount, (e.sending_id = p.sending_id)::text) FROM public.sub_credit_entries e JOIN public.people_labor_job_payments p ON p.id = e.payment_id WHERE e.payment_id = sgs.c('c3')), '25.00|true');

-- 4 · They are one sending now: a tick on one ticks the three, and a second press on them is refused.
SELECT sgs.same('a tick on the first row ticks the three', public.set_sub_payment_checked(sgs.c('c1'), true)::text, '3');
SET LOCAL ROLE authenticated;
SELECT sgs.refused('a second press', $q$SELECT sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c1'), sgs.c('c2')])$q$, 'is already part of a sending');

-- 5 · One row matched and one not is still one payment: gathered as they are, and the match stays.
SELECT sgs.same('the press on a matched row and an unmatched one', sgs.press('00000000-0000-0000-0000-00000347d0e1', ARRAY[sgs.c('c4'), sgs.c('c9')]), '2');
RESET ROLE;
SELECT sgs.same('the matched row keeps its line and the other has none',
  (SELECT string_agg(right(m.payment_id::text, 2) || ':' || right(m.mercury_transaction_id::text, 2), ' ' ORDER BY m.payment_id) FROM public.sub_payment_bank_matches m WHERE m.payment_id IN (sgs.c('c4'), sgs.c('c9'))), 'c4:d2');
SELECT sgs.same('three sendings are Pat''s: the one that was there and the two gathered',
  (SELECT count(*) FROM public.sub_payment_sendings WHERE person_id = '00000000-0000-0000-0000-00000347d0e1')::text, '3');

DO $$ BEGIN RAISE NOTICE 'sub_gather_sendings PASSED'; END $$;
ROLLBACK;
