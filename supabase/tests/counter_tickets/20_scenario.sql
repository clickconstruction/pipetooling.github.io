-- Counter tickets (v2.6812, punch list #295 PR 1, migration *_counter_tickets): the two tables, who reads a ticket, and
-- what the person who took it may not do. Fixtures are written as postgres; the tries run as each account under RLS;
-- everything rolls back. Raises on the first failed assertion; ends with "counter_tickets PASSED". See
-- scripts/pgtest-counter-tickets.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev; Tess is the office (an assistant); Jordan is a helper with a card; Sam is a lead with a card; Hal is a
-- helper with none.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000002950a1', 'dee@tickets.test'),
  ('00000000-0000-0000-0000-0000002950a2', 'tess@tickets.test'),
  ('00000000-0000-0000-0000-0000002950a3', 'jordan@tickets.test'),
  ('00000000-0000-0000-0000-0000002950a4', 'sam@tickets.test'),
  ('00000000-0000-0000-0000-0000002950a5', 'hal@tickets.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000002950a1', 'dee@tickets.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000002950a2', 'tess@tickets.test', 'Tess Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000002950a3', 'jordan@tickets.test', 'Jordan Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000002950a4', 'sam@tickets.test', 'Sam Lead', 'subcontractor', false, false, NULL),
  ('00000000-0000-0000-0000-0000002950a5', 'hal@tickets.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000002950f9', 'Ticket Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000002950b1', '00000000-0000-0000-0000-0000002950a1', '00000000-0000-0000-0000-0000002950f9', 'Oak Hollow', NULL),
  ('00000000-0000-0000-0000-0000002950b2', '00000000-0000-0000-0000-0000002950a1', '00000000-0000-0000-0000-0000002950f9', 'Cedar Bend', NULL);
INSERT INTO public.mercury_debit_card_user_links (mercury_debit_card_id, user_id) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000295', '00000000-0000-0000-0000-0000002950a3'),
  ('bbbbbbbb-0000-4000-8000-000000000295', '00000000-0000-0000-0000-0000002950a4');
INSERT INTO public.mercury_transactions (id, mercury_id, mercury_account_id, amount, created_at, status, kind, counterparty_name, raw) VALUES
  ('00000000-0000-0000-0000-0000002950c1', '00000000-0000-0000-0000-0000002950d1', '00000000-0000-0000-0000-0000002950e1', -228.58, '2026-11-04 16:00+00', 'pending', 'debitCardTransaction', 'Ridgeway Supply',
    jsonb_build_object('details', jsonb_build_object('debitCardInfo', jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000295')))),
  ('00000000-0000-0000-0000-0000002950c2', '00000000-0000-0000-0000-0000002950d2', '00000000-0000-0000-0000-0000002950e1', -163.96, '2026-11-04 17:00+00', 'pending', 'debitCardTransaction', 'The Home Depot',
    jsonb_build_object('details', jsonb_build_object('debitCardInfo', jsonb_build_object('id', 'bbbbbbbb-0000-4000-8000-000000000295'))));

-- A PO code the office made for Jordan at Ridgeway, and one for Sam at another house (migration *_po_code_read_by_its_person).
INSERT INTO public.supply_houses (id, name) VALUES
  ('00000000-0000-0000-0000-0000002950f1', 'Ridgeway Supply'),
  ('00000000-0000-0000-0000-0000002950f2', 'Cedar Bend Hardware');
INSERT INTO public.material_po_generator_entries (id, po_code, job_ledger_id, for_user_id, supply_house_id, created_by) VALUES
  ('00000000-0000-0000-0000-0000002950e3', 41207, '00000000-0000-0000-0000-0000002950b1', '00000000-0000-0000-0000-0000002950a3', '00000000-0000-0000-0000-0000002950f1', '00000000-0000-0000-0000-0000002950a2'),
  ('00000000-0000-0000-0000-0000002950e4', 41208, '00000000-0000-0000-0000-0000002950b2', '00000000-0000-0000-0000-0000002950a4', '00000000-0000-0000-0000-0000002950f2', '00000000-0000-0000-0000-0000002950a2');

CREATE SCHEMA tk;
GRANT USAGE ON SCHEMA tk TO authenticated;
CREATE FUNCTION tk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tk.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A write's outcome as a word: 'ok', or the sqlstate it raised. Runs as the caller, under RLS.
CREATE FUNCTION tk.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tk TO authenticated;

-- The structure.
SELECT tk.same('counter_tickets carries the twin fence and the archived seal', (
  SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'counter_tickets' AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
), 'archived_fence, digital_twin_write_fence_delete, digital_twin_write_fence_insert, digital_twin_write_fence_update');
SELECT tk.same('counter_ticket_pages carries them too', (
  SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'counter_ticket_pages' AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
), 'archived_fence, digital_twin_write_fence_delete, digital_twin_write_fence_insert, digital_twin_write_fence_update');
SELECT tk.same('nobody deletes a ticket', has_table_privilege('authenticated', 'public.counter_tickets', 'DELETE')::text, 'false');
SELECT tk.same('anon reads nothing', has_table_privilege('anon', 'public.counter_tickets', 'SELECT')::text || ' ' || has_table_privilege('anon', 'public.counter_ticket_pages', 'SELECT')::text, 'false false');
SELECT tk.same('the bucket is private and takes a PDF', (SELECT public::text || ' ' || ('application/pdf' = ANY (allowed_mime_types))::text FROM storage.buckets WHERE id = 'counter-tickets'), 'false true');
SELECT tk.same('the cron names the ticket pages', (SELECT (command LIKE '%counter_ticket_pages%' AND command LIKE '%task_photos%' AND command LIKE '%photo_saves%')::text FROM cron.job WHERE jobname = 'photo-save'), 'true');
SELECT tk.same('one photo-save cron row', (SELECT count(*)::text FROM cron.job WHERE jobname = 'photo-save'), '1');

-- Jordan takes two tickets at the counter.
SET ROLE authenticated;
SELECT tk.sign_in('00000000-0000-0000-0000-0000002950a3');
SELECT tk.same('Jordan saves his own ticket', tk.try($$INSERT INTO public.counter_tickets (id, taken_by, taken_by_name, job_id, added_at, used_at) VALUES ('00000000-0000-0000-0000-000000295111', '00000000-0000-0000-0000-0000002950a3', 'Jordan', '00000000-0000-0000-0000-0000002950b1', now(), now())$$), 'ok');
SELECT tk.same('a ticket he saves is never already used', (SELECT coalesce(used_at::text, 'null') FROM public.counter_tickets WHERE id = '00000000-0000-0000-0000-000000295111'), 'null');
SELECT tk.same('Jordan saves a second', tk.try($$INSERT INTO public.counter_tickets (id, taken_by, taken_by_name, job_id, added_at) VALUES ('00000000-0000-0000-0000-000000295112', '00000000-0000-0000-0000-0000002950a3', 'Jordan', '00000000-0000-0000-0000-0000002950b1', now())$$), 'ok');
SELECT tk.same('Jordan cannot save a ticket as Sam', tk.try($$INSERT INTO public.counter_tickets (taken_by, taken_by_name) VALUES ('00000000-0000-0000-0000-0000002950a4', 'Sam')$$), '42501');
SELECT tk.same('Jordan adds a page to his ticket', tk.try($$INSERT INTO public.counter_ticket_pages (id, ticket_id, by_user_id, storage_path) VALUES ('00000000-0000-0000-0000-000000295211', '00000000-0000-0000-0000-000000295112', '00000000-0000-0000-0000-0000002950a3', 'u/t/p.jpg')$$), 'ok');
SELECT tk.same('a ticket not for one job names no job', tk.try($$INSERT INTO public.counter_tickets (taken_by, no_one_job, job_id) VALUES ('00000000-0000-0000-0000-0000002950a3', true, '00000000-0000-0000-0000-0000002950b1')$$), '23514');

-- The match: his own card's charge, and never another person's.
SELECT tk.same('Jordan matches the charge on his card', tk.try($$UPDATE public.counter_tickets SET mercury_transaction_id = '00000000-0000-0000-0000-0000002950c1', match_kind = 'minute' WHERE id = '00000000-0000-0000-0000-000000295111'$$), 'ok');
SELECT tk.same('the match is stamped with who and when', (SELECT matched_by::text || ' ' || (matched_at IS NOT NULL)::text FROM public.counter_tickets WHERE id = '00000000-0000-0000-0000-000000295111'), '00000000-0000-0000-0000-0000002950a3 true');
SELECT tk.same('one live ticket a charge', tk.try($$UPDATE public.counter_tickets SET mercury_transaction_id = '00000000-0000-0000-0000-0000002950c1', match_kind = 'minute' WHERE id = '00000000-0000-0000-0000-000000295112'$$), '23505');
SELECT tk.same('Jordan cannot match a charge on Sam''s card', tk.try($$UPDATE public.counter_tickets SET mercury_transaction_id = '00000000-0000-0000-0000-0000002950c2', match_kind = 'asked' WHERE id = '00000000-0000-0000-0000-000000295112'$$), '42501');
SELECT tk.same('a match with no kind is refused', tk.try($$UPDATE public.counter_tickets SET match_kind = NULL WHERE id = '00000000-0000-0000-0000-000000295111'$$), '23514');
SELECT tk.same('Jordan cannot write the office''s columns', tk.try($$UPDATE public.counter_tickets SET used_at = now(), paid_other = 'cash' WHERE id = '00000000-0000-0000-0000-000000295112'$$), 'ok');
SELECT tk.same('they stay as they were', (SELECT coalesce(used_at::text, 'null') || ' ' || coalesce(paid_other, 'null') FROM public.counter_tickets WHERE id = '00000000-0000-0000-0000-000000295112'), 'null null');
SELECT tk.same('Jordan reads his two tickets', (SELECT count(*)::text FROM public.counter_tickets), '2');

-- The PO code made for him, and its house by name; never Sam's code or Sam's house.
SELECT tk.same('Jordan reads the PO code made for him', (SELECT string_agg(po_code::text, ',') FROM public.material_po_generator_entries), '41207');
SELECT tk.same('Jordan reads the house his code names', (SELECT string_agg(name, ',') FROM public.supply_houses), 'Ridgeway Supply');
SELECT tk.same('Jordan saves a ticket on his PO code', tk.try($$UPDATE public.counter_tickets SET po_entry_id = '00000000-0000-0000-0000-0000002950e3' WHERE id = '00000000-0000-0000-0000-000000295112'$$), 'ok');

-- Hal, a helper with no ticket: reads nothing.
SELECT tk.sign_in('00000000-0000-0000-0000-0000002950a5');
SELECT tk.same('Hal reads no PO code and no house', (SELECT count(*)::text FROM public.material_po_generator_entries) || ' ' || (SELECT count(*)::text FROM public.supply_houses), '0 0');
SELECT tk.same('Hal reads no ticket and no page', (SELECT count(*)::text FROM public.counter_tickets) || ' ' || (SELECT count(*)::text FROM public.counter_ticket_pages), '0 0');
SELECT tk.same('Hal cannot add a page to Jordan''s ticket', tk.try($$INSERT INTO public.counter_ticket_pages (ticket_id, by_user_id, storage_path) VALUES ('00000000-0000-0000-0000-000000295112', '00000000-0000-0000-0000-0000002950a5', 'h/t/p.jpg')$$), '42501');
SELECT tk.same('Hal changes nothing on Jordan''s ticket', tk.try($$UPDATE public.counter_tickets SET note = 'mine now' WHERE id = '00000000-0000-0000-0000-000000295112'$$), 'ok');
-- Sam, before any ticket is on his card: reads nothing.
SELECT tk.sign_in('00000000-0000-0000-0000-0000002950a4');
SELECT tk.same('Sam reads no ticket yet', (SELECT count(*)::text FROM public.counter_tickets), '0');

-- Tess, the office: reads both, ties the second to Sam's charge, and uses the first.
SELECT tk.sign_in('00000000-0000-0000-0000-0000002950a2');
SELECT tk.same('Tess reads both tickets, Hal''s write having changed nothing', (SELECT count(*)::text || ' ' || string_agg(DISTINCT note, '|') FROM public.counter_tickets), '2 ');
SELECT tk.same('Tess ties the second ticket to Sam''s charge', tk.try($$UPDATE public.counter_tickets SET mercury_transaction_id = '00000000-0000-0000-0000-0000002950c2', match_kind = 'picked' WHERE id = '00000000-0000-0000-0000-000000295112'$$), 'ok');
SELECT tk.same('Tess uses the first ticket', tk.try($$UPDATE public.counter_tickets SET used_at = '2020-01-01' WHERE id = '00000000-0000-0000-0000-000000295111'$$), 'ok');
SELECT tk.same('the first use is stamped now, by her', (SELECT (used_at > now() - interval '1 hour')::text || ' ' || used_by::text FROM public.counter_tickets WHERE id = '00000000-0000-0000-0000-000000295111'), 'true 00000000-0000-0000-0000-0000002950a2');

-- Sam, the holder of the card: reads the ticket on his charge and its page, and no other.
SELECT tk.sign_in('00000000-0000-0000-0000-0000002950a4');
SELECT tk.same('Sam reads the ticket on his card', (SELECT string_agg(id::text, ',') FROM public.counter_tickets), '00000000-0000-0000-0000-000000295112');
SELECT tk.same('Sam reads its page', (SELECT count(*)::text FROM public.counter_ticket_pages), '1');
SELECT tk.same('Sam sees it through the bucket''s gate', public.counter_ticket_visible('00000000-0000-0000-0000-000000295112')::text || ' ' || public.counter_ticket_visible('00000000-0000-0000-0000-000000295111')::text, 'true false');

-- Jordan again: the ticket the office used is no longer his to move or remove; its note still is.
SELECT tk.sign_in('00000000-0000-0000-0000-0000002950a3');
SELECT tk.same('Jordan cannot move a used ticket to another job', tk.try($$UPDATE public.counter_tickets SET job_id = '00000000-0000-0000-0000-0000002950b2' WHERE id = '00000000-0000-0000-0000-000000295111'$$), '42501');
SELECT tk.same('Jordan cannot remove a used ticket', tk.try($$UPDATE public.counter_tickets SET removed_at = now() WHERE id = '00000000-0000-0000-0000-000000295111'$$), '42501');
SELECT tk.same('Jordan still writes its note', tk.try($$UPDATE public.counter_tickets SET note = 'two boxes of fittings' WHERE id = '00000000-0000-0000-0000-000000295111'$$), 'ok');
RESET ROLE;

-- The sweep (the service role) files the second ticket's page.
UPDATE public.counter_ticket_pages SET drive_file_id = 'drive-file-1', drive_folder_id = 'folder-oak', filed_at = now() WHERE id = '00000000-0000-0000-0000-000000295211';

-- Jordan moves the second ticket, which the office has not used: its page files again, and keeps its Drive file.
SET ROLE authenticated;
SELECT tk.sign_in('00000000-0000-0000-0000-0000002950a3');
SELECT tk.same('Jordan moves an unused ticket to another job', tk.try($$UPDATE public.counter_tickets SET job_id = '00000000-0000-0000-0000-0000002950b2' WHERE id = '00000000-0000-0000-0000-000000295112'$$), 'ok');
SELECT tk.same('its page waits to be moved, with its Drive file kept', (SELECT coalesce(filed_at::text, 'null') || ' ' || drive_file_id || ' ' || drive_folder_id FROM public.counter_ticket_pages WHERE id = '00000000-0000-0000-0000-000000295211'), 'null drive-file-1 folder-oak');
SELECT tk.same('Jordan removes it', tk.try($$UPDATE public.counter_tickets SET removed_at = '2020-01-01' WHERE id = '00000000-0000-0000-0000-000000295112'$$), 'ok');
SELECT tk.same('the removal is stamped now, by him', (SELECT (removed_at > now() - interval '1 hour')::text || ' ' || removed_by::text FROM public.counter_tickets WHERE id = '00000000-0000-0000-0000-000000295112'), 'true 00000000-0000-0000-0000-0000002950a3');
SELECT tk.same('a page no longer joins a removed ticket', tk.try($$INSERT INTO public.counter_ticket_pages (ticket_id, by_user_id, storage_path) VALUES ('00000000-0000-0000-0000-000000295112', '00000000-0000-0000-0000-0000002950a3', 'u/t/p2.jpg')$$), '42501');

-- Tess says the first ticket is not that charge: the match comes off whole, and the charge is free again.
SELECT tk.sign_in('00000000-0000-0000-0000-0000002950a2');
SELECT tk.same('Tess takes the match off', tk.try($$UPDATE public.counter_tickets SET mercury_transaction_id = NULL, declined_transaction_ids = declined_transaction_ids || '00000000-0000-0000-0000-0000002950c1'::uuid WHERE id = '00000000-0000-0000-0000-000000295111'$$), 'ok');
SELECT tk.same('the match is cleared whole', (SELECT coalesce(match_kind, 'null') || ' ' || coalesce(matched_by::text, 'null') || ' ' || cardinality(declined_transaction_ids)::text FROM public.counter_tickets WHERE id = '00000000-0000-0000-0000-000000295111'), 'null null 1');
SELECT tk.same('Tess records how it was paid', tk.try($$UPDATE public.counter_tickets SET paid_other = 'cash' WHERE id = '00000000-0000-0000-0000-000000295111'$$), 'ok');
SELECT tk.same('a ticket is paid one way', tk.try($$UPDATE public.counter_tickets SET mercury_transaction_id = '00000000-0000-0000-0000-0000002950c1', match_kind = 'picked' WHERE id = '00000000-0000-0000-0000-000000295111'$$), '23514');
RESET ROLE;

SELECT 'counter_tickets PASSED';
ROLLBACK;
