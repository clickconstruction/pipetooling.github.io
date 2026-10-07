-- Scenarios for the card-charges window with the purchase time (20261006061356), after the three
-- migrations as they ship. Raises on the first failed assertion; ends with "… PASSED".
-- t_as(person) signs a person in for the transaction, as PostgREST does on prod.

\set dev    '''00000000-0000-4000-8000-000000000001'''
\set tess   '''00000000-0000-4000-8000-000000000002'''
\set mike   '''00000000-0000-4000-8000-000000000003'''
\set card_a '''aaaaaaaa-0000-4000-8000-000000000001'''
\set card_b '''bbbbbbbb-0000-4000-8000-000000000002'''

INSERT INTO public.users (id, name, role) VALUES
  (:dev,  'Owner Dev',   'dev'),
  (:tess, 'Office Tess', 'assistant'),
  (:mike, 'Field Mike',  'subcontractor');
INSERT INTO public.mercury_debit_card_user_links (mercury_debit_card_id, user_id) VALUES (:card_a, :mike);

INSERT INTO public.mercury_transactions (id, posted_at, amount, counterparty_name, kind, status, raw, duplicate_of_transaction_id) VALUES
  -- t1: bought the evening of the 14th (Central), posted the 15th: in the window by posted_at.
  ('10000000-0000-4000-8000-000000000001', '2026-09-15T16:00:00Z', -84.20, 'Shell', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a), 'createdAt', '2026-09-15T02:30:00.123456Z'), NULL),
  -- t2: a refund to the card (kind other), its createdAt written with an offset.
  ('10000000-0000-4000-8000-000000000002', '2026-09-16T15:00:00Z', 25.00, 'The Home Depot', 'other', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a), 'createdAt', '2026-09-16T09:00:00-05:00'), NULL),
  -- t3: no createdAt at all.
  ('10000000-0000-4000-8000-000000000003', '2026-09-17T15:00:00Z', -10, 'Ferguson', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a)), NULL),
  -- t4: a createdAt that is not a timestamp (the cast alone would read it as a real day).
  ('10000000-0000-4000-8000-000000000004', '2026-09-18T15:00:00Z', -11, 'Lowe''s', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a), 'createdAt', 'yesterday'), NULL),
  -- t5: shaped like a timestamp, but there is no such day (the cast alone would fail the read).
  ('10000000-0000-4000-8000-000000000005', '2026-09-19T15:00:00Z', -12, 'QuikTrip', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a), 'createdAt', '2026-02-30T10:00:00Z'), NULL),
  -- t6: an ACH, no card: not a card charge.
  ('10000000-0000-4000-8000-000000000006', '2026-09-20T15:00:00Z', -500, 'Supplier', 'externalTransfer', 'sent',
    jsonb_build_object('createdAt', '2026-09-20T12:00:00Z'), NULL),
  -- t7: bought inside the window, posted after it: the window keys on posted_at.
  ('10000000-0000-4000-8000-000000000007', '2026-10-02T15:00:00Z', -13, 'Shell', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a), 'createdAt', '2026-09-30T20:00:00Z'), NULL),
  -- t8: a duplicate of t1.
  ('10000000-0000-4000-8000-000000000008', '2026-09-15T16:00:00Z', -84.20, 'Shell', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a), 'createdAt', '2026-09-15T02:30:00Z'), '10000000-0000-4000-8000-000000000001'),
  -- t9: card B (no holder), settled by a payroll mark alone.
  ('10000000-0000-4000-8000-000000000009', '2026-09-21T15:00:00Z', -52, 'Shell', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_b), 'createdAt', '2026-09-21T13:00:00Z'), NULL),
  -- t10: hour 24, which Postgres alone would read as the next midnight.
  ('10000000-0000-4000-8000-000000000010', '2026-09-22T15:00:00Z', -14, 'Shell', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a), 'createdAt', '2026-09-22T24:00:00Z'), NULL),
  -- t11: second 60, which Postgres alone would roll into the next minute.
  ('10000000-0000-4000-8000-000000000011', '2026-09-23T15:00:00Z', -15, 'Shell', 'debitCardTransaction', 'sent',
    jsonb_build_object('debitCardInfo', jsonb_build_object('id', :card_a), 'createdAt', '2026-09-23T10:00:60Z'), NULL);
INSERT INTO public.mercury_tally_payroll_flags (mercury_transaction_id, is_payroll) VALUES ('10000000-0000-4000-8000-000000000009', true);

CREATE OR REPLACE FUNCTION public.t_tx(p_n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('10000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid
$$;

-- ── S1: the shape — both functions return the same 23 columns, purchased_at after posted_at ────
SELECT public.t_assert(
  pg_get_function_result('public._card_charges_window_rows(timestamptz, timestamptz, uuid, boolean)'::regprocedure)
    = pg_get_function_result('public.list_card_charges_window(date, date)'::regprocedure),
  'S1: the wrapper returns exactly the rows function''s columns');
SELECT public.t_assert(
  pg_get_function_result('public.list_card_charges_window(date, date)'::regprocedure)
    LIKE 'TABLE(mercury_transaction_id uuid, posted_at timestamp with time zone, purchased_at timestamp with time zone, amount numeric,%',
  'S1: purchased_at sits after posted_at');
SELECT public.t_assert(
  (SELECT l.lanname FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.oid = 'public._card_charges_window_rows(timestamptz, timestamptz, uuid, boolean)'::regprocedure) = 'sql'
  AND (SELECT prosecdef FROM pg_proc WHERE oid = 'public._card_charges_window_rows(timestamptz, timestamptz, uuid, boolean)'::regprocedure)
  AND (SELECT prosecdef FROM pg_proc WHERE oid = 'public.list_card_charges_window(date, date)'::regprocedure),
  'S1: the rows function stays sql, and both stay security definer');

-- ── S2: who may call what, as before ─────────────────────────────────────────────────────────
SELECT public.t_assert(has_function_privilege('authenticated', 'public.list_card_charges_window(date, date)', 'EXECUTE'), 'S2: the app role calls the wrapper');
SELECT public.t_assert(NOT has_function_privilege('anon', 'public.list_card_charges_window(date, date)', 'EXECUTE'), 'S2: anon cannot call the wrapper');
SELECT public.t_assert(NOT has_function_privilege('authenticated', 'public._card_charges_window_rows(timestamptz, timestamptz, uuid, boolean)', 'EXECUTE'), 'S2: the rows function is closed to the app');
SELECT public.t_assert(NOT has_function_privilege('anon', 'public._card_charges_window_rows(timestamptz, timestamptz, uuid, boolean)', 'EXECUTE'), 'S2: and to anon');
SELECT public.t_assert(obj_description('public.list_card_charges_window(date, date)'::regprocedure, 'pg_proc') LIKE '%purchase time%'
  AND obj_description('public._card_charges_window_rows(timestamptz, timestamptz, uuid, boolean)'::regprocedure, 'pg_proc') LIKE '%purchased_at, when the card was used%',
  'S2: both comments are back and name the purchase time');

-- ── S3: the dev reads the window: the purchase time where it is good, NULL where it is not ────
BEGIN; SELECT public.t_as(:dev);
CREATE TEMP TABLE r_dev ON COMMIT DROP AS SELECT * FROM public.list_card_charges_window('2026-09-15', '2026-09-30');
SELECT public.t_assert((SELECT array_agg(mercury_transaction_id ORDER BY posted_at, mercury_transaction_id) FROM r_dev)
  = ARRAY[public.t_tx(1), public.t_tx(2), public.t_tx(3), public.t_tx(4), public.t_tx(5), public.t_tx(9), public.t_tx(10), public.t_tx(11)],
  'S3: the card charges posted in the window, by posted_at: no ACH, nothing posted after, no duplicate');
SELECT public.t_assert((SELECT purchased_at FROM r_dev WHERE mercury_transaction_id = public.t_tx(1)) = '2026-09-15T02:30:00.123456Z'::timestamptz,
  'S3: t1 carries its purchase time, the evening before it posted');
SELECT public.t_assert((SELECT purchased_at FROM r_dev WHERE mercury_transaction_id = public.t_tx(2)) = '2026-09-16T14:00:00Z'::timestamptz,
  'S3: a refund''s offset createdAt reads as the same instant');
SELECT public.t_assert((SELECT purchased_at FROM r_dev WHERE mercury_transaction_id = public.t_tx(3)) IS NULL, 'S3: no createdAt reads NULL, not the row''s insert time');
SELECT public.t_assert((SELECT purchased_at FROM r_dev WHERE mercury_transaction_id = public.t_tx(4)) IS NULL, 'S3: a createdAt that is not a timestamp reads NULL');
SELECT public.t_assert((SELECT purchased_at FROM r_dev WHERE mercury_transaction_id = public.t_tx(5)) IS NULL, 'S3: a day that does not exist reads NULL and fails nothing');
SELECT public.t_assert((SELECT purchased_at FROM r_dev WHERE mercury_transaction_id = public.t_tx(10)) IS NULL, 'S3: hour 24 reads NULL, as the client refuses it');
SELECT public.t_assert((SELECT purchased_at FROM r_dev WHERE mercury_transaction_id = public.t_tx(11)) IS NULL, 'S3: second 60 reads NULL, as the client refuses it');
SELECT public.t_assert((SELECT payroll_marked AND holder_user_id IS NULL FROM r_dev WHERE mercury_transaction_id = public.t_tx(9)), 'S3: payroll access sees the payroll-marked charge');
SELECT public.t_assert((SELECT holder_user_id = :mike AND kind = 'other' AND amount = 25.00 FROM r_dev WHERE mercury_transaction_id = public.t_tx(2)), 'S3: the refund keeps its card, holder, kind and sign');
COMMIT;

-- ── S4: an office login without payroll access: the payroll-only charge is left out, as before ─
BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert((SELECT count(*) FROM public.list_card_charges_window('2026-09-15', '2026-09-30')) = 7, 'S4: the payroll-only charge is left out');
SELECT public.t_assert(NOT EXISTS (SELECT 1 FROM public.list_card_charges_window('2026-09-15', '2026-09-30') WHERE payroll_marked), 'S4: and no row reads payroll-marked');
COMMIT;

-- ── S5: a field login is refused before anything is read ─────────────────────────────────────
BEGIN; SELECT public.t_as(:mike);
DO $$
BEGIN
  PERFORM * FROM public.list_card_charges_window('2026-09-15', '2026-09-30');
  RAISE EXCEPTION 'FAILED: S5: a field login read the window';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE '%not authorized%' THEN RAISE; END IF;
END $$;
COMMIT;

DO $$ BEGIN RAISE NOTICE 'card_charges_window scenarios PASSED'; END $$;
