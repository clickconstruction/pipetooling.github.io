-- A GC's statement leaves out a bill an in kind deal pays (v2.8309, punch list #301, migration
-- *_gc_statement_in_kind_apart): get_gc_statement_email_payload keeps such a bill off a group's rows and every sum, in
-- in_kind_rows, and get_statement_week_for_office, which calls it, follows. Everything rolls back. Ends with
-- "in_kind_gc_statement PASSED". See scripts/pgtest-in-kind.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000003040a1', 'dee@inkindgc.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000003040a1', 'dee@inkindgc.test', 'Dee Dev', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
-- Harlow Builders and Tamsin Construction are GCs. Ridge Owner is the customer on every job.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000003040c1', 'Harlow Builders', '00000000-0000-0000-0000-0000003040a1'),
  ('00000000-0000-0000-0000-0000003040c2', 'Tamsin Construction', '00000000-0000-0000-0000-0000003040a1'),
  ('00000000-0000-0000-0000-0000003040c3', 'Ridge Owner', '00000000-0000-0000-0000-0000003040a1');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003040f9', 'In Kind GC Statement Bed');
INSERT INTO public.in_kind_arrangements (id, customer_id, what_given) VALUES
  ('00000000-0000-0000-0000-000000304001', '00000000-0000-0000-0000-0000003040c1', 'Gravel'),
  ('00000000-0000-0000-0000-000000304002', '00000000-0000-0000-0000-0000003040c2', 'Concrete');
-- D1: Harlow pays with money. D2 and D3: Harlow, on its deal, D3 billed with no bill row. D4: Tamsin, on its deal, its
-- only job. D5: no GC pays it.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, gc_customer_id, bill_to_party, revenue, payments_made, status, in_kind_arrangement_id) VALUES
  ('00000000-0000-0000-0000-0000003040d1', '00000000-0000-0000-0000-0000003040a1', '00000000-0000-0000-0000-0000003040f9', '4101', 'Rough in', 'Ridge Owner', '00000000-0000-0000-0000-0000003040c3', '00000000-0000-0000-0000-0000003040c1', 'gc', 12000.00, 0, 'billed', NULL),
  ('00000000-0000-0000-0000-0000003040d2', '00000000-0000-0000-0000-0000003040a1', '00000000-0000-0000-0000-0000003040f9', '4102', 'Top out', 'Ridge Owner', '00000000-0000-0000-0000-0000003040c3', '00000000-0000-0000-0000-0000003040c1', 'gc', 900.00, 0, 'billed', '00000000-0000-0000-0000-000000304001'),
  ('00000000-0000-0000-0000-0000003040d3', '00000000-0000-0000-0000-0000003040a1', '00000000-0000-0000-0000-0000003040f9', '4103', 'Trim', 'Ridge Owner', '00000000-0000-0000-0000-0000003040c3', '00000000-0000-0000-0000-0000003040c1', 'gc', 600.00, 0, 'billed', '00000000-0000-0000-0000-000000304001'),
  ('00000000-0000-0000-0000-0000003040d4', '00000000-0000-0000-0000-0000003040a1', '00000000-0000-0000-0000-0000003040f9', '4104', 'Sewer tap', 'Ridge Owner', '00000000-0000-0000-0000-0000003040c3', '00000000-0000-0000-0000-0000003040c2', 'gc', 20000.00, 0, 'billed', '00000000-0000-0000-0000-000000304002'),
  ('00000000-0000-0000-0000-0000003040d5', '00000000-0000-0000-0000-0000003040a1', '00000000-0000-0000-0000-0000003040f9', '4105', 'Hose bibs', 'Ridge Owner', '00000000-0000-0000-0000-0000003040c3', NULL, 'customer', 100.00, 0, 'billed', NULL);
-- The deal's bill on D2 is the oldest of Harlow's: it must not set the group's age.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000003040e1', '00000000-0000-0000-0000-0000003040d1', 0, 'billed', 12000.00, (public.app_today() - 100)::timestamptz + interval '18 hours'),
  ('00000000-0000-0000-0000-0000003040e2', '00000000-0000-0000-0000-0000003040d2', 0, 'billed', 900.00, (public.app_today() - 200)::timestamptz + interval '18 hours'),
  ('00000000-0000-0000-0000-0000003040e4', '00000000-0000-0000-0000-0000003040d4', 0, 'billed', 20000.00, (public.app_today() - 120)::timestamptz + interval '18 hours'),
  ('00000000-0000-0000-0000-0000003040e5', '00000000-0000-0000-0000-0000003040d5', 0, 'billed', 100.00, (public.app_today() - 10)::timestamptz + interval '18 hours');
-- A credit of $200 on D2's bill: $700 is still open on it.
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, sequence_order, paid_on, payment_type, note) VALUES
  ('00000000-0000-0000-0000-0000003040b1', '00000000-0000-0000-0000-0000003040d2', '00000000-0000-0000-0000-0000003040e2', 200, 0, public.app_today() - 30, 'In kind', 'A load of gravel');

CREATE SCHEMA ikg;
CREATE FUNCTION ikg.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- One payer's group out of a payload.
CREATE FUNCTION ikg.grp(p jsonb, p_entity uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT g FROM jsonb_array_elements(p -> 'groups') g WHERE g ->> 'entity_id' = p_entity::text;
$$;
-- The job numbers a list of rows names, in the list's order.
CREATE FUNCTION ikg.jobs(p_rows jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(r ->> 'display_number', ', ' ORDER BY ord), 'none') FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ord);
$$;
CREATE TABLE ikg.kept (k text PRIMARY KEY, v jsonb);

-- Harlow's own statement.
INSERT INTO ikg.kept VALUES ('harlow', public.get_gc_statement_email_payload('gc', '00000000-0000-0000-0000-0000003040c1', false));
SELECT ikg.same('the statement lists the money bill alone', (SELECT ikg.jobs(ikg.grp(v, '00000000-0000-0000-0000-0000003040c1') -> 'rows') FROM ikg.kept WHERE k = 'harlow'), '4101');
SELECT ikg.same('every sum of the group counts the money bill alone', (
  SELECT concat_ws(' | ', g ->> 'subtotal', g ->> 'job_count', g ->> 'oldest_age_days') FROM (SELECT ikg.grp(v, '00000000-0000-0000-0000-0000003040c1') AS g FROM ikg.kept WHERE k = 'harlow') t
), '12000.00 | 1 | 100');
SELECT ikg.same('the grand total is the money', (SELECT v ->> 'grand_total' FROM ikg.kept WHERE k = 'harlow'), '12000.00');
SELECT ikg.same('the deal''s bills ride beside them, a bill and a job balance', (SELECT ikg.jobs(ikg.grp(v, '00000000-0000-0000-0000-0000003040c1') -> 'in_kind_rows') FROM ikg.kept WHERE k = 'harlow'), '4102, 4103');
SELECT ikg.same('each in the row''s own shape, netted by its linked payments', (
  SELECT concat_ws(' | ', r ->> 'remaining', r ->> 'invoice_amount', jsonb_array_length(r -> 'job_bills')::text, jsonb_array_length(r -> 'job_payments')::text, r ->> 'row_key')
  FROM (SELECT ikg.grp(v, '00000000-0000-0000-0000-0000003040c1') -> 'in_kind_rows' -> 0 AS r FROM ikg.kept WHERE k = 'harlow') t
), '700.00 | 900.00 | 1 | 1 | 00000000-0000-0000-0000-0000003040e2');
SELECT ikg.same('the group counts them', (SELECT (ikg.grp(v, '00000000-0000-0000-0000-0000003040c1') -> 'in_kind')::text FROM ikg.kept WHERE k = 'harlow'), '{"count": 2, "dollars": 1300.00}');
SELECT ikg.same('and so does the payload', (SELECT (v -> 'in_kind')::text FROM ikg.kept WHERE k = 'harlow'), '{"count": 2, "dollars": 1300.00}');

-- Tamsin's every bill is on its deal.
INSERT INTO ikg.kept VALUES ('tamsin', public.get_gc_statement_email_payload('gc', '00000000-0000-0000-0000-0000003040c2', false));
SELECT ikg.same('a payer wholly on a deal keeps its group, with no rows and nothing owed', (
  SELECT concat_ws(' | ', ikg.jobs(g -> 'rows'), g ->> 'subtotal', g ->> 'job_count', COALESCE(g ->> 'oldest_age_days', 'null'), ikg.jobs(g -> 'in_kind_rows'), (g -> 'in_kind')::text)
  FROM (SELECT ikg.grp(v, '00000000-0000-0000-0000-0000003040c2') AS g FROM ikg.kept WHERE k = 'tamsin') t
), 'none | 0.00 | 0 | null | 4104 | {"count": 1, "dollars": 20000.00}');
SELECT ikg.same('its grand total is zero', (SELECT v ->> 'grand_total' FROM ikg.kept WHERE k = 'tamsin'), '0.00');

-- The whole report: a bill no GC pays is as before.
INSERT INTO ikg.kept VALUES ('all', public.get_gc_statement_email_payload('gc', NULL, false));
SELECT ikg.same('a bill with no deal is listed and summed as before', (
  SELECT string_agg((r ->> 'display_number') || ':' || (r ->> 'remaining'), ', ') FROM ikg.kept, jsonb_array_elements(v -> 'groups') g, jsonb_array_elements(g -> 'rows') r
  WHERE k = 'all' AND (g ->> 'is_no_entity')::boolean AND r ->> 'display_number' = '4105'
), '4105:100.00');
SELECT ikg.same('no deal''s bill is in any group''s rows', (
  SELECT count(*)::text FROM ikg.kept, jsonb_array_elements(v -> 'groups') g, jsonb_array_elements(g -> 'rows') r
  WHERE k = 'all' AND r ->> 'display_number' IN ('4102', '4103', '4104')
), '0');

-- The office's statement week calls the same payload.
INSERT INTO ikg.kept VALUES ('week', public.get_statement_week_for_office());
SELECT ikg.same('the week counts Harlow by its money: the amount, over 90 days, the oldest bill', (
  SELECT concat_ws(' | ', i ->> 'amount', i ->> 'over_90', i ->> 'oldest_age_days', i ->> 'job_count')
  FROM ikg.kept, jsonb_array_elements(v -> 'items') i WHERE k = 'week' AND i ->> 'gc_id' = '00000000-0000-0000-0000-0000003040c1'
), '12000.00 | 12000.00 | 100 | 1');
SELECT ikg.same('a GC with $20,000 on a deal and no money owed is not on the week', (
  SELECT count(*)::text FROM ikg.kept, jsonb_array_elements(v -> 'items') i WHERE k = 'week' AND i ->> 'gc_id' = '00000000-0000-0000-0000-0000003040c2'
), '0');

-- A deal that ends lets its jobs go, and their bills read as owed again.
UPDATE public.in_kind_arrangements SET ended_at = now() WHERE id = '00000000-0000-0000-0000-000000304001';
SELECT ikg.same('an ended deal''s bills are back on the statement', (
  SELECT concat_ws(' | ', g ->> 'subtotal', g ->> 'job_count', g ->> 'oldest_age_days', jsonb_array_length(g -> 'rows')::text, (g -> 'in_kind')::text)
  FROM (SELECT ikg.grp(public.get_gc_statement_email_payload('gc', '00000000-0000-0000-0000-0000003040c1', false), '00000000-0000-0000-0000-0000003040c1') AS g) t
), '13300.00 | 3 | 200 | 3 | {"count": 0, "dollars": 0.00}');

DO $$ BEGIN RAISE NOTICE 'in_kind_gc_statement PASSED'; END $$;
ROLLBACK;
