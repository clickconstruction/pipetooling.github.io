-- A sheet paid past its total becomes a credit (migration *_sub_overpayment_to_credit, punch list #347's residue):
-- the payment reads less on its sheet, the rest is kept as the sub's credit with that payment, and what left the
-- bank is the figure it was. So a tick against the bank stands and a match to a bank line stands, though the amount
-- edit clears both on the way (clear_sub_payment_check_on_change, 20261114040000). Fixtures are written as postgres;
-- the press runs as each user; everything rolls back. Raises on the first failed assertion; ends with
-- "sub_over_to_credit PASSED". See scripts/pgtest-sub-over-to-credit.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Devon is a dev, the office. Priya estimates and is not office staff. Pat Sub is the sheet's one person. Olive
-- Other is on the roster and on no sheet.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000347c0a1', 'devon@subovertocredit.test'),
  ('00000000-0000-0000-0000-00000347c0a2', 'priya@subovertocredit.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at) VALUES
  ('00000000-0000-0000-0000-00000347c0a1', 'devon@subovertocredit.test', 'Devon Dev', 'dev', false, false, false, NULL),
  ('00000000-0000-0000-0000-00000347c0a2', 'priya@subovertocredit.test', 'Priya Estimator', 'estimator', false, false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0a1', 'sub', 'Pat Sub Overbed'),
  ('00000000-0000-0000-0000-00000347c0e2', '00000000-0000-0000-0000-00000347c0a1', 'sub', 'Olive Other Overbed');
-- The sheet. Its name resolves to Pat, so the assignee trigger puts Pat on it.
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name) VALUES
  ('00000000-0000-0000-0000-00000347c0b1', '00000000-0000-0000-0000-00000347c0a1', 'Pat Sub Overbed');
-- The bank line the $250 check left on.
-- The columns the combine_rows bed gives a bank line: its account, Mercury's own id, the day, a status and a kind.
INSERT INTO public.mercury_transactions (id, mercury_account_id, mercury_id, amount, created_at, status, kind) VALUES
  ('00000000-0000-0000-0000-00000347c0d1', '00000000-0000-0000-0000-00000347c0d7', '00000000-0000-0000-0000-00000347c0d8', -250, '2026-10-03T15:00:00Z', 'sent', 'outgoingPayment');
-- p1 $100, not ticked. p2 $250, ticked and matched to the bank line. p3 $20 paid from a credit. p4 $80 that already
-- keeps a $5 credit. p5 $40, a later payment for the overfill check.
INSERT INTO public.people_labor_job_payments (id, job_id, amount, sequence_order, payment_date, method, checked_at, checked_by, checked_by_name) VALUES
  ('00000000-0000-0000-0000-00000347c0c1', '00000000-0000-0000-0000-00000347c0b1', 100, 0, '2026-10-01', 'check', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347c0c2', '00000000-0000-0000-0000-00000347c0b1', 250, 1, '2026-10-03', 'check', '2026-11-01T15:00:00Z', '00000000-0000-0000-0000-00000347c0a1', 'Devon Dev'),
  ('00000000-0000-0000-0000-00000347c0c3', '00000000-0000-0000-0000-00000347c0b1', 20, 2, '2026-10-05', 'credit', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347c0c4', '00000000-0000-0000-0000-00000347c0b1', 80, 3, '2026-10-06', 'zelle', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000347c0c5', '00000000-0000-0000-0000-00000347c0b1', 40, 4, '2026-10-07', 'check', NULL, NULL, NULL);
INSERT INTO public.sub_credit_entries (person_id, amount, payment_id) VALUES
  ('00000000-0000-0000-0000-00000347c0e1', 5, '00000000-0000-0000-0000-00000347c0c4');
INSERT INTO public.sub_payment_bank_matches (payment_id, mercury_transaction_id, matched_by, matched_by_name, matched_at) VALUES
  ('00000000-0000-0000-0000-00000347c0c2', '00000000-0000-0000-0000-00000347c0d1', '00000000-0000-0000-0000-00000347c0a1', 'Devon Dev', '2026-11-01T15:00:00Z');

CREATE SCHEMA sotc;
CREATE FUNCTION sotc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sotc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION sotc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The press, as one line: what the payment reads on its sheet, the credit kept, and whether a bank match was kept.
CREATE FUNCTION sotc.press(p_person uuid, p_payment uuid, p_amount numeric) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', r->>'amount_on_sheet', r->>'credit', r->>'bank_match_kept')
  FROM public.convert_sub_overpayment_to_credit(p_person, p_payment, p_amount) AS r
$$;
GRANT USAGE ON SCHEMA sotc TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sotc TO authenticated, anon;

-- 0 · The fixture is the shape the function reads, and the function is the office's to call.
SELECT sotc.same('Pat is on the sheet',
  (SELECT count(*) FROM public.people_labor_job_assignees WHERE labor_job_id = '00000000-0000-0000-0000-00000347c0b1' AND person_id = '00000000-0000-0000-0000-00000347c0e1')::text, '1');
SELECT sotc.same('a signed-in login may call it', has_function_privilege('authenticated', 'public.convert_sub_overpayment_to_credit(uuid, uuid, numeric)', 'EXECUTE')::text, 'true');
SELECT sotc.same('nobody signed out may', has_function_privilege('anon', 'public.convert_sub_overpayment_to_credit(uuid, uuid, numeric)', 'EXECUTE')::text, 'false');

-- 1 · An estimator is refused: sub pay is the office's.
SELECT sotc.as_user('00000000-0000-0000-0000-00000347c0a2');
SET LOCAL ROLE authenticated;
SELECT sotc.refused('Priya''s press', $q$SELECT sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0c2', 50)$q$, 'Only the office roles');
RESET ROLE;

-- 2 · Each refusal, as Devon, with its reason.
SELECT sotc.as_user('00000000-0000-0000-0000-00000347c0a1');
SET LOCAL ROLE authenticated;
SELECT sotc.refused('no person', $q$SELECT sotc.press(NULL, '00000000-0000-0000-0000-00000347c0c2', 50)$q$, 'a credit needs a person on the roster');
SELECT sotc.refused('no amount', $q$SELECT sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0c2', 0)$q$, 'must be above zero');
SELECT sotc.refused('a payment that is gone', $q$SELECT sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0ff', 50)$q$, 'that payment is gone');
SELECT sotc.refused('a payment made from a credit', $q$SELECT sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0c3', 5)$q$, 'made from a credit cannot carry one');
SELECT sotc.refused('all of a payment', $q$SELECT sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0c1', 100)$q$, 'must stay above zero on its sheet');
SELECT sotc.refused('a payment that already keeps a credit', $q$SELECT sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0c4', 10)$q$, 'already carries a credit');
SELECT sotc.refused('a person who is not on the sheet', $q$SELECT sotc.press('00000000-0000-0000-0000-00000347c0e2', '00000000-0000-0000-0000-00000347c0c2', 50)$q$, 'not on the sheet this payment is on');
RESET ROLE;
SELECT sotc.same('the refusals changed nothing',
  (SELECT string_agg(amount::text, ',' ORDER BY sequence_order) FROM public.people_labor_job_payments WHERE job_id = '00000000-0000-0000-0000-00000347c0b1'), '100.00,250.00,20.00,80.00,40.00');

-- 3 · The press on the ticked, matched $250 payment: $200 on the sheet, $50 kept, and the bank match kept.
SET LOCAL ROLE authenticated;
SELECT sotc.same('Devon''s press', sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0c2', 50), '200.00|50.00|true');
RESET ROLE;
SELECT sotc.same('the payment reads what the sheet needed',
  (SELECT amount::text FROM public.people_labor_job_payments WHERE id = '00000000-0000-0000-0000-00000347c0c2'), '200.00');
SELECT sotc.same('the rest is Pat''s credit, kept with that payment',
  (SELECT concat_ws('|', person_id, amount, note) FROM public.sub_credit_entries WHERE payment_id = '00000000-0000-0000-0000-00000347c0c2'),
  '00000000-0000-0000-0000-00000347c0e1|50.00|Paid past the sheet''s total before credits existed');
SELECT sotc.same('what left the bank is the figure it was',
  (SELECT (p.amount + e.amount)::text FROM public.people_labor_job_payments p JOIN public.sub_credit_entries e ON e.payment_id = p.id WHERE p.id = '00000000-0000-0000-0000-00000347c0c2'), '250.00');
SELECT sotc.same('the tick stands, as it was set',
  (SELECT concat_ws('|', (checked_at = '2026-11-01T15:00:00Z'::timestamptz)::text, checked_by, checked_by_name) FROM public.people_labor_job_payments WHERE id = '00000000-0000-0000-0000-00000347c0c2'),
  'true|00000000-0000-0000-0000-00000347c0a1|Devon Dev');
SELECT sotc.same('the bank match stands, as it was made',
  (SELECT concat_ws('|', mercury_transaction_id, matched_by, matched_by_name, (matched_at = '2026-11-01T15:00:00Z'::timestamptz)::text) FROM public.sub_payment_bank_matches WHERE payment_id = '00000000-0000-0000-0000-00000347c0c2'),
  '00000000-0000-0000-0000-00000347c0d1|00000000-0000-0000-0000-00000347c0a1|Devon Dev|true');

-- 4 · A second press on the same payment is refused: it carries its credit now.
SET LOCAL ROLE authenticated;
SELECT sotc.refused('a second press', $q$SELECT sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0c2', 10)$q$, 'already carries a credit');
RESET ROLE;

-- 5 · A payment that was never ticked stays unticked and unmatched.
SET LOCAL ROLE authenticated;
SELECT sotc.same('the press on an unticked payment', sotc.press('00000000-0000-0000-0000-00000347c0e1', '00000000-0000-0000-0000-00000347c0c1', 10), '90.00|10.00|false');
RESET ROLE;
SELECT sotc.same('no tick appears',
  (SELECT (checked_at IS NULL)::text FROM public.people_labor_job_payments WHERE id = '00000000-0000-0000-0000-00000347c0c1'), 'true');
SELECT sotc.same('no match appears',
  (SELECT count(*) FROM public.sub_payment_bank_matches WHERE payment_id = '00000000-0000-0000-0000-00000347c0c1')::text, '0');
SELECT sotc.same('Pat''s credit is the three kept',
  (SELECT sum(amount)::text FROM public.sub_credit_entries WHERE person_id = '00000000-0000-0000-0000-00000347c0e1'), '65.00');

-- 6 · The kept credit still counts against the bank line. The same match made again fits the $250 line exactly, and
-- a $40 payment more is refused: $200 on the sheet, $50 kept and $40 would come to $290.
SELECT sotc.same('the match made again fits its line', public.match_sub_payment('00000000-0000-0000-0000-00000347c0c2', '00000000-0000-0000-0000-00000347c0d1')::text, '1');
SELECT sotc.refused('another payment on that bank line', $q$SELECT public.match_sub_payment('00000000-0000-0000-0000-00000347c0c5', '00000000-0000-0000-0000-00000347c0d1')$q$, 'the payments on it would come to 290.00');

DO $$ BEGIN RAISE NOTICE 'sub_over_to_credit PASSED'; END $$;
ROLLBACK;
