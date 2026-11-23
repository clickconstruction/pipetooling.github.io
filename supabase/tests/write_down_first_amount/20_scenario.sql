-- A bill written down more than once keeps the amount before its FIRST write-down (punch list #85, migration
-- *_write_down_keeps_first_amount). Rosa, the assistant, writes an in-app bill of 500 down to 450, to 400 and to 380:
-- the kept amount reads 500 after each, and the note, the time and the person are the newest write-down's. The
-- Stripe writer, called as the service role the way the edge function calls it, takes a bill of 900 down to 800, to
-- 700 and to 650: the kept amount reads 900, and the credit note id is the newest. A fee that takes a written-down
-- bill above its kept amount moves the kept amount up to where the bill stands, on each writer. A refused write-down
-- changes nothing. Everything rolls back. Raises on the first failed assertion; ends with
-- "write_down_first_amount PASSED". See scripts/pgtest-write-down-first-amount.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000fba03', 'rosa@firstamount.test'),
  ('00000000-0000-0000-0000-0000000fba07', 'mo@firstamount.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000fba03', 'rosa@firstamount.test', 'First Amount Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000fba07', 'mo@firstamount.test', 'First Amount Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000fbb01', 'First Amount Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000fbc01', '00000000-0000-0000-0000-0000000fba07', 'Dana Whitfield');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000fbf01', '00000000-0000-0000-0000-0000000fba07', '00000000-0000-0000-0000-0000000fbb01', '4201', 'Linda Lou vanity', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fbc01', 'customer', 2000, 0, 'billed');
-- e1 and e2 are in-app bills. e3 and e4 are Stripe's.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id) VALUES
  ('00000000-0000-0000-0000-0000000fbe01', '00000000-0000-0000-0000-0000000fbf01', 0, 'billed', 500, NULL),
  ('00000000-0000-0000-0000-0000000fbe02', '00000000-0000-0000-0000-0000000fbf01', 1, 'billed', 300, NULL),
  ('00000000-0000-0000-0000-0000000fbe03', '00000000-0000-0000-0000-0000000fbf01', 2, 'billed', 900, 'in_bed_first_amount_3'),
  ('00000000-0000-0000-0000-0000000fbe04', '00000000-0000-0000-0000-0000000fbf01', 3, 'billed', 300, 'in_bed_first_amount_4');

CREATE SCHEMA wdf;
CREATE FUNCTION wdf.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION wdf.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION wdf.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
-- A writer's answer in a few words: "ok", "refused: <its error>", or "raised: <its exception>".
CREATE FUNCTION wdf.ask(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
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
-- A bill in a line: what it was, what it is, and whose write-down it carries.
CREATE FUNCTION wdf.bill(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'was ' || coalesce(i.agreed_write_down_previous_amount::text, 'null') || ' · is ' || i.amount::text
         || ' · ' || coalesce(i.agreed_write_down_note, 'no note')
         || ' · by ' || coalesce(right(i.agreed_write_down_by::text, 2), 'nobody')
         || ' · ' || coalesce(i.agreed_write_down_stripe_credit_note_id, 'no credit note')
  FROM public.jobs_ledger_invoices i WHERE i.id = p_id
$$;
-- A fee lands on a bill the way the fee functions add one: the amount goes up, nothing else moves.
CREATE FUNCTION wdf.add_fee(p_id uuid, p_fee numeric) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.jobs_ledger_invoices SET amount = amount + p_fee WHERE id = p_id
$$;
-- The first write-down's line on the job's activity.
CREATE FUNCTION wdf.first_event(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT string_agg(e.summary, ' | ' ORDER BY e.occurred_at, e.summary) FROM public.job_activity_events e
                   WHERE e.event_type = 'invoice_write_down' AND e.detail ->> 'source_id' = p_id::text AND (e.detail ->> 'previous_amount')::numeric = 500), 'none')
$$;
GRANT USAGE ON SCHEMA wdf TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA wdf TO anon, authenticated, service_role;

-- 1 · The in-app writer, as Rosa: a first write-down, a second and a third.
SET LOCAL ROLE authenticated;
SELECT wdf.as_user('00000000-0000-0000-0000-0000000fba03');
SELECT wdf.same('e1 before any write-down', wdf.bill('00000000-0000-0000-0000-0000000fbe01'), 'was null · is 500.00 · no note · by nobody · no credit note');
SELECT wdf.same('Rosa writes e1 down a first time', wdf.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fbe01', 450, 'first agreed')$$), 'ok');
SELECT wdf.same('e1 after the first', wdf.bill('00000000-0000-0000-0000-0000000fbe01'), 'was 500.00 · is 450.00 · first agreed · by 03 · no credit note');
SELECT wdf.same('the job''s activity holds the first write-down', wdf.first_event('00000000-0000-0000-0000-0000000fbe01'), 'Agreed write-down: $500.00 → $450.00 — first agreed');
SELECT wdf.same('Rosa writes e1 down a second time', wdf.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fbe01', 400, 'second agreed')$$), 'ok');
SELECT wdf.same('e1 after the second keeps 500', wdf.bill('00000000-0000-0000-0000-0000000fbe01'), 'was 500.00 · is 400.00 · second agreed · by 03 · no credit note');
SELECT wdf.same('Rosa writes e1 down a third time', wdf.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fbe01', 380, 'third agreed')$$), 'ok');
SELECT wdf.same('e1 after the third keeps 500', wdf.bill('00000000-0000-0000-0000-0000000fbe01'), 'was 500.00 · is 380.00 · third agreed · by 03 · no credit note');
SELECT wdf.same('a write-up is refused', wdf.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fbe01', 420, 'back up again')$$), 'refused: New amount cannot exceed the current billed amount');
SELECT wdf.same('e1 after the refusal is as it was', wdf.bill('00000000-0000-0000-0000-0000000fbe01'), 'was 500.00 · is 380.00 · third agreed · by 03 · no credit note');

-- 2 · A fee takes a written-down bill above its kept amount: the next write-down keeps where the bill stood.
SELECT wdf.same('Rosa writes e2 down', wdf.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fbe02', 250, 'first agreed')$$), 'ok');
SELECT wdf.add_fee('00000000-0000-0000-0000-0000000fbe02', 35);
SELECT wdf.same('Rosa writes e2 down under the kept amount', wdf.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fbe02', 270, 'second agreed')$$), 'ok');
SELECT wdf.same('a fee under the kept amount leaves it at 300', wdf.bill('00000000-0000-0000-0000-0000000fbe02'), 'was 300.00 · is 270.00 · second agreed · by 03 · no credit note');
SELECT wdf.add_fee('00000000-0000-0000-0000-0000000fbe02', 50);
SELECT wdf.same('Rosa writes e2 down from above the kept amount', wdf.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fbe02', 310, 'third agreed')$$), 'ok');
SELECT wdf.same('fees past the kept amount move it to 320', wdf.bill('00000000-0000-0000-0000-0000000fbe02'), 'was 320.00 · is 310.00 · third agreed · by 03 · no credit note');

-- 3 · The Stripe writer, as the service role with Rosa named as the person: a first, a second and a third.
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT wdf.as_service();
SELECT wdf.same('Stripe writes e3 down a first time', wdf.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fbe03', 800, 'first agreed', 'cn_bed_1', '00000000-0000-0000-0000-0000000fba03')$$), 'ok');
SELECT wdf.same('e3 after the first', wdf.bill('00000000-0000-0000-0000-0000000fbe03'), 'was 900.00 · is 800.00 · first agreed · by 03 · cn_bed_1');
SELECT wdf.same('Stripe writes e3 down a second time', wdf.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fbe03', 700, 'second agreed', 'cn_bed_2', '00000000-0000-0000-0000-0000000fba03')$$), 'ok');
SELECT wdf.same('e3 after the second keeps 900', wdf.bill('00000000-0000-0000-0000-0000000fbe03'), 'was 900.00 · is 700.00 · second agreed · by 03 · cn_bed_2');
SELECT wdf.same('Stripe writes e3 down a third time', wdf.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fbe03', 650, 'third agreed', 'cn_bed_3', '00000000-0000-0000-0000-0000000fba03')$$), 'ok');
SELECT wdf.same('e3 after the third keeps 900', wdf.bill('00000000-0000-0000-0000-0000000fbe03'), 'was 900.00 · is 650.00 · third agreed · by 03 · cn_bed_3');
SELECT wdf.same('Stripe''s writer refuses an in-app bill', wdf.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fbe01', 300, 'wrong door', 'cn_bed_4', '00000000-0000-0000-0000-0000000fba03')$$), 'refused: Invoice has no Stripe invoice');

-- 4 · The same fee rule on the Stripe writer.
SELECT wdf.same('Stripe writes e4 down', wdf.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fbe04', 250, 'first agreed', 'cn_bed_5', '00000000-0000-0000-0000-0000000fba03')$$), 'ok');
SELECT wdf.add_fee('00000000-0000-0000-0000-0000000fbe04', 70);
SELECT wdf.same('Stripe writes e4 down from above the kept amount', wdf.ask($$public.service_apply_agreed_write_down_from_stripe('00000000-0000-0000-0000-0000000fbe04', 310, 'second agreed', 'cn_bed_6', '00000000-0000-0000-0000-0000000fba03')$$), 'ok');
SELECT wdf.same('fees past the kept amount move it to 320 on Stripe''s writer too', wdf.bill('00000000-0000-0000-0000-0000000fbe04'), 'was 320.00 · is 310.00 · second agreed · by 03 · cn_bed_6');

-- 5 · The in-app writer still refuses a Stripe bill.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT wdf.as_user('00000000-0000-0000-0000-0000000fba03');
SELECT wdf.same('the in-app writer refuses a Stripe bill', wdf.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fbe03', 600, 'wrong door')$$), 'refused: Stripe-hosted invoices must use the write-down flow (credit ');

DO $$ BEGIN RAISE NOTICE 'write_down_first_amount PASSED'; END $$;
ROLLBACK;
