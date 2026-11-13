-- The bill lines sweep (v2.6882, punch list #298 PR 2, migration *_bill_lines_sweep): the holds table and who reads it,
-- one paper a bill, whose read a read is, the switch and the cron; and since v2.7103 (PR 1c, migration
-- *_supply_paper_check_rules) the rules a paper was checked under and the charge the subtotal leaves out. Fixtures are written as postgres; the tries run as
-- each account under RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "bill_lines_sweep PASSED". See scripts/pgtest-bill-lines-sweep.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Tess is the office (an assistant); Hal is a helper. Made-up house and bills.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000002980a1', 'tess@sweep.test'),
  ('00000000-0000-0000-0000-0000002980a2', 'hal@sweep.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000002980a1', 'tess@sweep.test', 'Tess Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000002980a2', 'hal@sweep.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;
INSERT INTO public.supply_houses (id, name) VALUES ('00000000-0000-0000-0000-0000002980f1', 'Ridgeway Supply');
INSERT INTO public.supply_house_invoices (id, supply_house_id, invoice_number, invoice_date, amount, link) VALUES
  ('00000000-0000-0000-0000-0000002980b1', '00000000-0000-0000-0000-0000002980f1', 'S100200', '2026-10-01', 112.60, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view'),
  ('00000000-0000-0000-0000-0000002980b2', '00000000-0000-0000-0000-0000002980f1', 'S100201', '2026-10-02', 48.10, 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view');

CREATE SCHEMA bs;
GRANT USAGE ON SCHEMA bs TO authenticated;
CREATE FUNCTION bs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bs.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A write's outcome as a word: 'ok', or the sqlstate it raised. Runs as the caller, under RLS.
CREATE FUNCTION bs.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bs TO authenticated;

-- ---------- The sweep's own writes, as the service role does them ----------

INSERT INTO public.supply_bill_holds (invoice_id, why, note, drive_file_id, seen_key) VALUES
  ('00000000-0000-0000-0000-0000002980b1', 'reading', '', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345|S100200'),
  ('00000000-0000-0000-0000-0000002980b2', 'number_not_in_file', 'The file holds S100200.', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345|S100201');
SELECT bs.same('a second run cannot claim a bill a run is reading', bs.try($$INSERT INTO public.supply_bill_holds (invoice_id, why) VALUES ('00000000-0000-0000-0000-0000002980b1', 'reading')$$), '23505');
SELECT bs.same('a reason outside the list is refused', bs.try($$UPDATE public.supply_bill_holds SET why = 'lost' WHERE invoice_id = '00000000-0000-0000-0000-0000002980b1'$$), '23514');

INSERT INTO public.supply_papers (id, supply_house_id, invoice_id, kind, number, read_by, check_state, text_layer) VALUES
  ('00000000-0000-0000-0000-0000002980c1', '00000000-0000-0000-0000-0000002980f1', '00000000-0000-0000-0000-0000002980b1', 'invoice', 'S100200', 'sweep:claude-sonnet-5-5', 'adds_up', true);
SELECT bs.same('a bill takes one paper', bs.try($$INSERT INTO public.supply_papers (supply_house_id, invoice_id, kind, number) VALUES ('00000000-0000-0000-0000-0000002980f1', '00000000-0000-0000-0000-0000002980b1', 'invoice', 'S100200')$$), '23505');
SELECT bs.same('papers with no bill are as many as the file holds', bs.try($$INSERT INTO public.supply_papers (supply_house_id, kind, number, drive_file_id) VALUES ('00000000-0000-0000-0000-0000002980f1', 'ship_ticket', 'T1', 'x'), ('00000000-0000-0000-0000-0000002980f1', 'ship_ticket', 'T2', 'x')$$), 'ok');
SELECT bs.same('a paper the form wrote has no text layer on record', (SELECT text_layer::text FROM public.supply_papers WHERE number = 'T1'), NULL);
SELECT bs.same('the old plain index is gone', (SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'supply_papers_invoice_idx'), '0');

INSERT INTO public.supply_bill_reads (file_path, file_name, model, ok) VALUES ('bills/x/y/z.pdf', 'z.pdf', 'claude-sonnet-5-5', true);
INSERT INTO public.supply_bill_reads (source, file_path, file_name, model, ok) VALUES ('sweep', 'drive:1AbC', 'z.pdf', 'claude-sonnet-5-5', true);
SELECT bs.same('a read is the form''s unless it says the sweep''s', (SELECT string_agg(source, ',' ORDER BY source) FROM public.supply_bill_reads WHERE file_name = 'z.pdf'), 'form,sweep');
SELECT bs.same('a read from anywhere else is refused', bs.try($$INSERT INTO public.supply_bill_reads (source, file_path, file_name, model, ok) VALUES ('cron', 'a', 'b', 'c', true)$$), '23514');

SELECT bs.same('the switch is on', (SELECT value_text FROM public.app_settings WHERE key = 'bill_lines_sweep_on_v1'), 'true');
SELECT bs.same('the cron is one row, every ten minutes', (SELECT string_agg(schedule, '|') FROM cron.job WHERE jobname = 'bill-lines-sweep'), '6,16,26,36,46,56 * * * *');
SELECT bs.same('the cron posts to the sweep with the secret', (SELECT (command LIKE '%/functions/v1/bill-lines-sweep%' AND command LIKE '%X-Cron-Secret%')::text FROM cron.job WHERE jobname = 'bill-lines-sweep'), 'true');

-- ---------- Who reads a hold ----------

SELECT bs.same('the holds table is under RLS', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.supply_bill_holds'::regclass), 'true');
SELECT bs.same('the holds table carries the twin fence and the archived seal', (
  SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supply_bill_holds' AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
), 'archived_fence, digital_twin_write_fence_delete, digital_twin_write_fence_insert, digital_twin_write_fence_update');

SET LOCAL ROLE authenticated;
SELECT bs.sign_in('00000000-0000-0000-0000-0000002980a1');
SELECT bs.same('the office reads the holds', (SELECT string_agg(why, ',' ORDER BY why) FROM public.supply_bill_holds), 'number_not_in_file,reading');
SELECT bs.same('the office writes no hold', bs.try($$INSERT INTO public.supply_bill_holds (invoice_id, why) VALUES ('00000000-0000-0000-0000-0000002980b2', 'failed')$$), '42501');
SELECT bs.same('the office lifts no hold', bs.try($$DELETE FROM public.supply_bill_holds$$), '42501');
SELECT bs.sign_in('00000000-0000-0000-0000-0000002980a2');
SELECT bs.same('a helper reads no hold', (SELECT count(*)::text FROM public.supply_bill_holds), '0');
RESET ROLE;

-- ---------- The checks the measure asked for (v2.7103, migration *_supply_paper_check_rules) ----------

SELECT bs.same('a paper on file was checked under the first rules', (SELECT check_rules::text FROM public.supply_papers WHERE id = '00000000-0000-0000-0000-0000002980c1'), '1');

SET LOCAL ROLE authenticated;
SELECT bs.sign_in('00000000-0000-0000-0000-0000002980a1');
-- The bill is $48.10. One part at $43.10 and a shipping charge of $5.00 printed under a subtotal of $43.10.
SELECT bs.same('the office saves a paper with a charge outside the subtotal', bs.try($$SELECT public.supply_paper_save('00000000-0000-0000-0000-0000002980b2',
  '{"kind":"invoice","number":"S100201","subtotal_cents":4310,"tax_cents":0,"total_cents":4810,"check_state":"adds_up"}'::jsonb,
  '[{"line_no":1,"line_kind":"part","description":"PVC 2 DWV 90","qty_shipped":10,"unit_price":4.31,"extended_cents":4310},{"line_no":2,"line_kind":"charge","description":"SHIPPING","extended_cents":500}]'::jsonb)$$), 'ok');
SELECT bs.same('a charge the subtotal leaves out and the total takes back in adds up', (SELECT check_state || '|' || check_note || '|' || check_rules FROM public.supply_papers WHERE invoice_id = '00000000-0000-0000-0000-0000002980b2'), 'adds_up||2');
-- The same lines against a total that never took the charge in: the charge is not outside, the lines are over.
SELECT bs.same('the same paper with a total of the subtotal', bs.try($$SELECT public.supply_paper_save('00000000-0000-0000-0000-0000002980b2',
  '{"kind":"invoice","number":"S100201","subtotal_cents":4310,"tax_cents":0,"total_cents":4310,"check_state":"adds_up"}'::jsonb,
  '[{"line_no":1,"line_kind":"part","description":"PVC 2 DWV 90","qty_shipped":10,"unit_price":4.31,"extended_cents":4310},{"line_no":2,"line_kind":"charge","description":"SHIPPING","extended_cents":500}]'::jsonb)$$), 'ok');
SELECT bs.same('a charge the total does not take in is not outside', (SELECT check_state || '|' || check_note FROM public.supply_papers WHERE invoice_id = '00000000-0000-0000-0000-0000002980b2'), 'off|The lines are $5.00 over the subtotal.');
-- Two charges that are outside together: a part at $40.10, shipping $3.00 and a fuel charge $5.00.
SELECT bs.same('the office saves a paper with two charges outside', bs.try($$SELECT public.supply_paper_save('00000000-0000-0000-0000-0000002980b2',
  '{"kind":"invoice","number":"S100201","subtotal_cents":4010,"tax_cents":0,"total_cents":4810,"check_state":"adds_up"}'::jsonb,
  '[{"line_no":1,"line_kind":"part","description":"PVC 2 DWV 90","extended_cents":4010},{"line_no":2,"line_kind":"charge","description":"SHIPPING","extended_cents":300},{"line_no":3,"line_kind":"charge","description":"FUEL","extended_cents":500}]'::jsonb)$$), 'ok');
SELECT bs.same('every charge together may be outside', (SELECT check_state FROM public.supply_papers WHERE invoice_id = '00000000-0000-0000-0000-0000002980b2'), 'adds_up');
-- A rebate among the parts is a negative line: $50.00 less $1.90 is the subtotal.
SELECT bs.same('the office saves a paper with a rebate line', bs.try($$SELECT public.supply_paper_save('00000000-0000-0000-0000-0000002980b2',
  '{"kind":"invoice","number":"S100201","subtotal_cents":4810,"tax_cents":0,"total_cents":4810,"check_state":"adds_up"}'::jsonb,
  '[{"line_no":1,"line_kind":"part","description":"DRILL KIT","extended_cents":5000},{"line_no":2,"line_kind":"part","description":"INSTANT REBATE","extended_cents":-190}]'::jsonb)$$), 'ok');
SELECT bs.same('a negative line takes its money off the sum', (SELECT p.check_state || '|' || (SELECT sum(extended_cents) FROM public.supply_paper_lines l WHERE l.paper_id = p.id) FROM public.supply_papers p WHERE p.invoice_id = '00000000-0000-0000-0000-0000002980b2'), 'adds_up|4810');
RESET ROLE;

-- ---------- A hold goes with its bill ----------

DELETE FROM public.supply_house_invoices WHERE id = '00000000-0000-0000-0000-0000002980b2';
SELECT bs.same('a deleted bill takes its hold with it', (SELECT count(*)::text FROM public.supply_bill_holds WHERE invoice_id = '00000000-0000-0000-0000-0000002980b2'), '0');

DO $$ BEGIN RAISE NOTICE 'bill_lines_sweep PASSED'; END $$;
ROLLBACK;
