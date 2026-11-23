-- Every agreed write-down is a line on the job's activity (punch list #85, migration *_write_down_activity_each_step).
-- Each write-down here is a transaction of its own, as it is in the app: the writers stamp now(), which stands still
-- inside one transaction, and the trigger writes a line when the stamp moves. So this file COMMITS, and leans on the
-- bed's container being thrown away. Rosa, the assistant, writes an in-app bill of 500 down to 450, to 400 and to 380:
-- three lines, each with its own before and after, and the bill keeps 500. The Stripe writer, as the service role
-- with Rosa named, takes a bill of 900 down three times: three lines, each Rosa's. A stamp written again as it is
-- adds no line, and neither does a fee; the write-down after the fee starts from the amount the fee left, and one at
-- the amount the bill already stands at is a line with the same amount on both sides. A person with no users row can
-- still be named on a Stripe write-down, and that line is nobody's. A bill that arrives already written down has one
-- line, from its kept amount. Raises on the first failed assertion; ends with "write_down_each_step PASSED".
-- See scripts/pgtest-write-down-first-amount.sh. Never against prod.
\set ON_ERROR_STOP 1

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000fca03', 'rosa@eachstep.test'),
  ('00000000-0000-0000-0000-0000000fca07', 'mo@eachstep.test'),
  ('00000000-0000-0000-0000-0000000fca09', 'ghost@eachstep.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000fca03', 'rosa@eachstep.test', 'Each Step Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000fca07', 'mo@eachstep.test', 'Each Step Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
-- The ghost signs in but has no row among the users.
DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-0000000fca09';

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000fcb01', 'Each Step Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000fcc01', '00000000-0000-0000-0000-0000000fca07', 'Dana Whitfield');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000fcf01', '00000000-0000-0000-0000-0000000fca07', '00000000-0000-0000-0000-0000000fcb01', '4301', 'Diane Falls drain', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fcc01', 'customer', 2000, 0, 'billed');
-- e1 is an in-app bill. e3 and e5 are Stripe's.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id) VALUES
  ('00000000-0000-0000-0000-0000000fce01', '00000000-0000-0000-0000-0000000fcf01', 0, 'billed', 500, NULL),
  ('00000000-0000-0000-0000-0000000fce03', '00000000-0000-0000-0000-0000000fcf01', 1, 'billed', 900, 'in_bed_each_step_3'),
  ('00000000-0000-0000-0000-0000000fce05', '00000000-0000-0000-0000-0000000fcf01', 2, 'billed', 200, 'in_bed_each_step_5');

CREATE SCHEMA wde;
CREATE FUNCTION wde.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION wde.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION wde.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
CREATE FUNCTION wde.ask(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v jsonb;
BEGIN
  BEGIN
    EXECUTE 'select to_jsonb((' || p_sql || '))' INTO v;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'raised: ' || left(SQLERRM, 60);
  END;
  IF jsonb_typeof(v) = 'object' AND v->>'error' IS NOT NULL THEN RETURN 'refused: ' || left(v->>'error', 60); END IF;
  IF jsonb_typeof(v) = 'object' AND v->>'ok' = 'true' THEN RETURN 'ok'; END IF;
  RETURN left(v::text, 80);
END $$;
-- A bill's write-down lines on the job's activity, oldest first: the words, then whose.
CREATE FUNCTION wde.lines(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT string_agg(replace(e.summary, 'Agreed write-down: ', '') || ' · by ' || coalesce(right(e.actor_user_id::text, 2), 'nobody'), ' | ' ORDER BY e.occurred_at)
                   FROM public.job_activity_events e
                   WHERE e.event_type = 'invoice_write_down' AND e.detail ->> 'source_id' = p_id::text), 'none')
$$;
-- The newest line's numbers: this step's before and after, and the bill's first amount.
CREATE FUNCTION wde.newest(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT (e.detail ->> 'previous_amount') || ' to ' || (e.detail ->> 'amount') || ', first ' || (e.detail ->> 'first_amount')
  FROM public.job_activity_events e
  WHERE e.event_type = 'invoice_write_down' AND e.detail ->> 'source_id' = p_id::text
  ORDER BY e.occurred_at DESC LIMIT 1
$$;
CREATE FUNCTION wde.kept(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'was ' || i.agreed_write_down_previous_amount::text || ' · is ' || i.amount::text FROM public.jobs_ledger_invoices i WHERE i.id = p_id
$$;
-- The stamp written again as it is, the way a replayed save would.
CREATE FUNCTION wde.stamp_again(p_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.jobs_ledger_invoices SET agreed_write_down_at = agreed_write_down_at WHERE id = p_id
$$;
-- A fee lands on a bill the way the fee functions add one: the amount goes up, nothing else moves.
CREATE FUNCTION wde.add_fee(p_id uuid, p_fee numeric) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.jobs_ledger_invoices SET amount = amount + p_fee WHERE id = p_id
$$;
GRANT USAGE ON SCHEMA wde TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA wde TO anon, authenticated, service_role;

SELECT wde.same('e1 has no write-down line yet', wde.lines('00000000-0000-0000-0000-0000000fce01'), 'none');

-- 1 · The in-app writer, as Rosa: three write-downs, each a transaction of its own.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT wde.as_user('00000000-0000-0000-0000-0000000fca03');
SELECT wde.same('Rosa writes e1 down a first time', wde.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fce01', 450, 'first agreed')$$), 'ok');
COMMIT;
SELECT wde.same('the first write-down is a line', wde.lines('00000000-0000-0000-0000-0000000fce01'), '$500.00 → $450.00 — first agreed · by 03');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT wde.as_user('00000000-0000-0000-0000-0000000fca03');
SELECT wde.same('Rosa writes e1 down a second time', wde.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fce01', 400, 'second agreed')$$), 'ok');
COMMIT;
SELECT wde.same('the second write-down is a line of its own', wde.lines('00000000-0000-0000-0000-0000000fce01'), '$500.00 → $450.00 — first agreed · by 03 | $450.00 → $400.00 — second agreed · by 03');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT wde.as_user('00000000-0000-0000-0000-0000000fca03');
SELECT wde.same('Rosa writes e1 down a third time', wde.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fce01', 380, 'third agreed')$$), 'ok');
COMMIT;
SELECT wde.same('the third write-down is a line of its own', wde.lines('00000000-0000-0000-0000-0000000fce01'), '$500.00 → $450.00 — first agreed · by 03 | $450.00 → $400.00 — second agreed · by 03 | $400.00 → $380.00 — third agreed · by 03');
SELECT wde.same('the third line carries its step and the first amount', wde.newest('00000000-0000-0000-0000-0000000fce01'), '400.00 to 380.00, first 500.00');
SELECT wde.same('e1 keeps its first amount', wde.kept('00000000-0000-0000-0000-0000000fce01'), 'was 500.00 · is 380.00');

-- 2 · What is not a write-down adds no line: the stamp written again as it is, and a fee.
SELECT wde.stamp_again('00000000-0000-0000-0000-0000000fce01');
SELECT wde.add_fee('00000000-0000-0000-0000-0000000fce01', 35);
SELECT wde.same('a replayed stamp and a fee add no line', wde.lines('00000000-0000-0000-0000-0000000fce01'), '$500.00 → $450.00 — first agreed · by 03 | $450.00 → $400.00 — second agreed · by 03 | $400.00 → $380.00 — third agreed · by 03');
SELECT wde.same('the fee left e1 at 415 and its first amount alone', wde.kept('00000000-0000-0000-0000-0000000fce01'), 'was 500.00 · is 415.00');
-- The write-down after the fee is its own step: its before is the amount the fee left, not the last write-down's after.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT wde.as_user('00000000-0000-0000-0000-0000000fca03');
SELECT wde.same('Rosa writes e1 down after the fee', wde.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fce01', 410, 'after the fee')$$), 'ok');
COMMIT;
SELECT wde.same('the line after a fee starts from the amount the fee left', wde.newest('00000000-0000-0000-0000-0000000fce01'), '415.00 to 410.00, first 500.00');
-- A write-down at the amount the bill already stands at: the writer takes it, the bill's note becomes the new one, and
-- the line says the amount did not move. It must not read as a step from the first amount.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT wde.as_user('00000000-0000-0000-0000-0000000fca03');
SELECT wde.same('Rosa writes e1 down at the amount it stands at', wde.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fce01', 410, 'same amount, new words')$$), 'ok');
COMMIT;
SELECT wde.same('five write-downs of e1 are five lines, the last with one amount on both sides', wde.lines('00000000-0000-0000-0000-0000000fce01'), '$500.00 → $450.00 — first agreed · by 03 | $450.00 → $400.00 — second agreed · by 03 | $400.00 → $380.00 — third agreed · by 03 | $415.00 → $410.00 — after the fee · by 03 | $410.00 → $410.00 — same amount, new words · by 03');
SELECT wde.same('e1 still keeps its first amount', wde.kept('00000000-0000-0000-0000-0000000fce01'), 'was 500.00 · is 410.00');

-- 3 · The Stripe writer, as the service role with Rosa named: three lines, each hers.
BEGIN;
SET LOCAL ROLE service_role;
SELECT wde.as_service();
SELECT wde.same('Stripe writes e3 down a first time', wde.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fce03', 800, 'first agreed', 'cn_step_1', '00000000-0000-0000-0000-0000000fca03')$$), 'ok');
COMMIT;
BEGIN;
SET LOCAL ROLE service_role;
SELECT wde.as_service();
SELECT wde.same('Stripe writes e3 down a second time', wde.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fce03', 700, 'second agreed', 'cn_step_2', '00000000-0000-0000-0000-0000000fca03')$$), 'ok');
COMMIT;
BEGIN;
SET LOCAL ROLE service_role;
SELECT wde.as_service();
SELECT wde.same('Stripe writes e3 down a third time', wde.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fce03', 650, 'third agreed', 'cn_step_3', '00000000-0000-0000-0000-0000000fca03')$$), 'ok');
COMMIT;
SELECT wde.same('each Stripe write-down is a line, and Rosa''s', wde.lines('00000000-0000-0000-0000-0000000fce03'), '$900.00 → $800.00 — first agreed · by 03 | $800.00 → $700.00 — second agreed · by 03 | $700.00 → $650.00 — third agreed · by 03');
SELECT wde.same('e3 keeps its first amount', wde.kept('00000000-0000-0000-0000-0000000fce03'), 'was 900.00 · is 650.00');

-- 4 · A person with no users row is named on a Stripe write-down: it goes through, and the line is nobody's.
BEGIN;
SET LOCAL ROLE service_role;
SELECT wde.as_service();
SELECT wde.same('Stripe writes e5 down for the ghost', wde.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fce05', 150, 'first agreed', 'cn_step_4', '00000000-0000-0000-0000-0000000fca09')$$), 'ok');
COMMIT;
SELECT wde.same('the ghost''s write-down is a line with nobody on it', wde.lines('00000000-0000-0000-0000-0000000fce05'), '$200.00 → $150.00 — first agreed · by nobody');

-- 5 · A bill that arrives already written down, the way a copied row would: one line, its before the kept amount,
-- since the row held nothing before it. Nobody is signed in and nobody is named, so the line is nobody's.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id, agreed_write_down_previous_amount, agreed_write_down_note, agreed_write_down_at) VALUES
  ('00000000-0000-0000-0000-0000000fce07', '00000000-0000-0000-0000-0000000fcf01', 3, 'billed', 300, NULL, 350, 'carried over', now());
SELECT wde.same('a bill that arrives written down has one line, from its kept amount', wde.lines('00000000-0000-0000-0000-0000000fce07'), '$350.00 → $300.00 — carried over · by nobody');

-- 6 · The lines read whole: every write-down above is one line and no more.
SELECT wde.same('nine write-downs and one arrival are ten lines', (SELECT count(*)::text FROM public.job_activity_events e WHERE e.event_type = 'invoice_write_down' AND e.job_id = '00000000-0000-0000-0000-0000000fcf01'), '10');

DO $$ BEGIN RAISE NOTICE 'write_down_each_step PASSED'; END $$;
