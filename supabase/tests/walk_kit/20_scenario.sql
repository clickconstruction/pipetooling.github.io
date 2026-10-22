-- The walk kit's rows (v2.5725, punch list #142 PR 4, migration *_walk_kit): walk_setup makes ZZ Walk Messages Desk
-- once from Settings' boxes row and answers the same kit twice; it refuses, in words, a maker who is not the tester, a
-- bids box with no address or number, the two boxes on one number, the kit's phone on the team number, and any
-- contact carrying the kit's email, the kit's phone, the team box's address or number, or the app's sender;
-- walk_cleanup deletes only the kit's rows, children first and the contact before the customer, while a real customer
-- beside it keeps every row, and refuses a line folded in on a stranger's channel, a file kept on the thread, another
-- carrier of the kit's address, and a foreign key from a table it does not know (pg_constraint); after cleanup no
-- contact carries bids@ or the bids number, and a second cleanup has nothing to clean. The owner's-cell fallback
-- (p_phone shared with a contact, p_shared_phone_ok) and a dev as the maker (the walk with the owner's presses) each
-- make and clean a kit. Everything as postgres, standing in for the service role, inside one transaction that rolls
-- back. Raises on the first failed assertion; ends with "walk_kit PASSED". See scripts/pgtest-walk-kit.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The owner (a dev), the company's master (the owner account every new record is stamped with), the walk tester (a
-- training-mode assistant; is_walk_tester too once PR 2's column is there), a plain assistant, a sample in training
-- mode and a twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a1d01', 'dev@walk.test'),
  ('00000000-0000-0000-0000-0000000a1d02', 'master@walk.test'),
  ('00000000-0000-0000-0000-0000000a1d03', 'walk-tester@walk.test'),
  ('00000000-0000-0000-0000-0000000a1d04', 'assistant@walk.test'),
  ('00000000-0000-0000-0000-0000000a1d05', 'sample@walk.test'),
  ('00000000-0000-0000-0000-0000000a1d06', 'twin@walk.test');
INSERT INTO public.users (id, email, name, role, read_only, is_sample, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000a1d01', 'dev@walk.test', 'Walk Dev', 'dev', false, false, false),
  ('00000000-0000-0000-0000-0000000a1d02', 'master@walk.test', 'Walk Master', 'master_technician', false, false, false),
  ('00000000-0000-0000-0000-0000000a1d03', 'walk-tester@walk.test', 'ZZ Walk tester', 'assistant', true, false, false),
  ('00000000-0000-0000-0000-0000000a1d04', 'assistant@walk.test', 'Walk Assistant', 'assistant', false, false, false),
  ('00000000-0000-0000-0000-0000000a1d05', 'sample@walk.test', 'Walk Sample', 'assistant', true, true, false),
  ('00000000-0000-0000-0000-0000000a1d06', 'twin@walk.test', 'Walk Twin', 'estimator', false, false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_sample = EXCLUDED.is_sample, is_digital_twin = EXCLUDED.is_digital_twin;
-- PR 2's flag, when its migration is in the chain (the function reads the column only when it exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_walk_tester') THEN
    EXECUTE 'UPDATE public.users SET is_walk_tester = true WHERE id = ''00000000-0000-0000-0000-0000000a1d03''';
  END IF;
END $$;

-- Settings: the owner account, and the two boxes with their own numbers.
INSERT INTO public.app_settings (key, value_text) VALUES
  ('company_owner_user_id', '00000000-0000-0000-0000-0000000a1d02'),
  ('messages_boxes_v1', '{"team":{"address":"team@walk.test","phone":"(512) 555-0100","numberId":"PNteam"},"bids":{"address":"bids@walk.test","phone":"(737) 555-0101","numberId":"PNbids"}}')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
DELETE FROM public.app_settings WHERE key = 'walk_kit_v1';

-- A real customer beside the kit: its contact with two channels, a line in, an estimate and a sent copy. Every one of
-- these rows must still be there after cleanup.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000a1c01', 'Real Oak Dental', '00000000-0000-0000-0000-0000000a1d02', '{"email": "real@oak.test", "phone": "(512) 555-0199"}');
INSERT INTO public.contacts (id, kind, customer_id) VALUES ('00000000-0000-0000-0000-0000000a1c11', 'customer', '00000000-0000-0000-0000-0000000a1c01');
INSERT INTO public.contact_channels (id, contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-0000000a1c21', '00000000-0000-0000-0000-0000000a1c11', 'email', 'real@oak.test'),
  ('00000000-0000-0000-0000-0000000a1c22', '00000000-0000-0000-0000-0000000a1c11', 'phone', '(512) 555-0199');
INSERT INTO public.messages (id, contact_id, channel_id, channel, direction, body) VALUES
  ('00000000-0000-0000-0000-0000000a1c31', '00000000-0000-0000-0000-0000000a1c11', '00000000-0000-0000-0000-0000000a1c21', 'email', 'in', 'Can you come Tuesday?');
INSERT INTO public.estimates (id, master_user_id, created_by, customer_id, title) VALUES
  ('00000000-0000-0000-0000-0000000a1c41', '00000000-0000-0000-0000-0000000a1d02', '00000000-0000-0000-0000-0000000a1d01', '00000000-0000-0000-0000-0000000a1c01', 'Real estimate');
INSERT INTO public.sent_documents (id, kind, how, customer_id, source_table, source_id) VALUES
  ('00000000-0000-0000-0000-0000000a1c51', 'estimate', 'email', '00000000-0000-0000-0000-0000000a1c01', 'estimates', '00000000-0000-0000-0000-0000000a1c41');

CREATE SCHEMA wk;
CREATE FUNCTION wk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION wk.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- The real customer's rows, counted: customer|contact|channels|lines|estimate|sent copy.
CREATE FUNCTION wk.real_rows() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (SELECT count(*) FROM public.customers WHERE id = '00000000-0000-0000-0000-0000000a1c01')
    || '|' || (SELECT count(*) FROM public.contacts WHERE id = '00000000-0000-0000-0000-0000000a1c11')
    || '|' || (SELECT count(*) FROM public.contact_channels WHERE contact_id = '00000000-0000-0000-0000-0000000a1c11')
    || '|' || (SELECT count(*) FROM public.messages WHERE contact_id = '00000000-0000-0000-0000-0000000a1c11')
    || '|' || (SELECT count(*) FROM public.estimates WHERE id = '00000000-0000-0000-0000-0000000a1c41')
    || '|' || (SELECT count(*) FROM public.sent_documents WHERE id = '00000000-0000-0000-0000-0000000a1c51') $$;
-- How many contacts carry an address or number, by key.
CREATE FUNCTION wk.carriers(p_kind text, p_value text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT ch.contact_id)::text FROM public.contact_channels ch
  WHERE ch.kind = p_kind AND ch.key = public.contact_channel_key(p_kind, p_value) $$;
-- The kit's rows, counted: customer|contact|channels|estimate|setting.
CREATE FUNCTION wk.kit_rows(p_kit jsonb) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (SELECT count(*) FROM public.customers WHERE id = (p_kit ->> 'customerId')::uuid)
    || '|' || (SELECT count(*) FROM public.contacts WHERE id = (p_kit ->> 'contactId')::uuid)
    || '|' || (SELECT count(*) FROM public.contact_channels WHERE contact_id = (p_kit ->> 'contactId')::uuid)
    || '|' || (SELECT count(*) FROM public.estimates WHERE id = (p_kit ->> 'estimateId')::uuid)
    || '|' || (SELECT count(*) FROM public.app_settings WHERE key = 'walk_kit_v1') $$;

-- 0 · The ground: the two functions, the service role's alone.
SELECT wk.same('the two functions are there',
  (SELECT string_agg(p.proname, ',' ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('walk_setup', 'walk_cleanup')), 'walk_cleanup,walk_setup');
SELECT wk.same('nobody signed in or signed out may call them',
  has_function_privilege('anon', 'public.walk_setup(uuid, text, text, boolean)', 'EXECUTE')::text
  || '|' || has_function_privilege('authenticated', 'public.walk_setup(uuid, text, text, boolean)', 'EXECUTE')::text
  || '|' || has_function_privilege('anon', 'public.walk_cleanup()', 'EXECUTE')::text
  || '|' || has_function_privilege('authenticated', 'public.walk_cleanup()', 'EXECUTE')::text, 'false|false|false|false');
SELECT wk.same('the service role may',
  has_function_privilege('service_role', 'public.walk_setup(uuid, text, text, boolean)', 'EXECUTE')::text
  || '|' || has_function_privilege('service_role', 'public.walk_cleanup()', 'EXECUTE')::text, 'true|true');
SELECT wk.same('no kit: nothing to clean', (public.walk_cleanup()) ->> 'words', 'nothing to clean');

-- 1 · Setup's refusals, before any kit exists: the maker, the boxes, the carriers.
SELECT wk.refused('a plain assistant is not the walk tester',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d04', 'team@noreply.walk.test')$$, 'is not the walk tester');
SELECT wk.refused('a sample in training mode is not',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d05', 'team@noreply.walk.test')$$, 'is not the walk tester');
SELECT wk.refused('a twin is not',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d06', 'team@noreply.walk.test')$$, 'is not the walk tester');
SELECT wk.refused('nobody is not',
  $$SELECT public.walk_setup(NULL, 'team@noreply.walk.test')$$, 'nobody is not the walk tester');
UPDATE public.app_settings SET value_text = '{"team":{"address":"team@walk.test","phone":"(512) 555-0100","numberId":"PNteam"},"bids":{"address":"  ","phone":"(737) 555-0101","numberId":"PNbids"}}' WHERE key = 'messages_boxes_v1';
SELECT wk.refused('the bids box with no address',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$, 'the bids box has no address in Settings');
UPDATE public.app_settings SET value_text = '{"team":{"address":"team@walk.test","phone":"(512) 555-0100","numberId":"PNteam"},"bids":{"address":"bids@walk.test","phone":"","numberId":"PNbids"}}' WHERE key = 'messages_boxes_v1';
SELECT wk.refused('the bids box with no number',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$, 'the bids box has no number in Settings');
SELECT wk.refused('a number given that is not one',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test', 'call me')$$, 'the number given (call me) is not one');
UPDATE public.app_settings SET value_text = '{"team":{"address":"team@walk.test","phone":"(512) 555-0100","numberId":"PNteam"},"bids":{"address":"bids@walk.test","phone":"+1 512 555 0100","numberId":"PNbids"}}' WHERE key = 'messages_boxes_v1';
SELECT wk.refused('the two boxes on one number',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$, 'the two boxes share one number');
UPDATE public.app_settings SET value_text = 'not json' WHERE key = 'messages_boxes_v1';
SELECT wk.refused('a boxes row that is not JSON reads as no boxes',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$, 'the bids box has no address in Settings');
UPDATE public.app_settings SET value_text = '{"team":{"address":"team@walk.test","phone":"(512) 555-0100","numberId":"PNteam"},"bids":{"address":"bids@walk.test","phone":"(737) 555-0101","numberId":"PNbids"}}' WHERE key = 'messages_boxes_v1';
SELECT wk.refused('the kit''s phone on the team box''s number',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test', '512-555-0100')$$, 'is the team box''s own number');

-- A stray contact carrying each of the five, one at a time.
INSERT INTO public.contacts (id, kind) VALUES ('00000000-0000-0000-0000-0000000a1e01', 'unknown');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-0000000a1e01', 'email', ' Bids@Walk.test ');
SELECT wk.refused('a contact carrying the kit''s email',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$,
  'the kit''s email (bids@walk.test) is carried by contact 00000000-0000-0000-0000-0000000a1e01, kind unknown, no record');
DELETE FROM public.contact_channels WHERE contact_id = '00000000-0000-0000-0000-0000000a1e01';
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-0000000a1e01', 'phone', '+1 (737) 555-0101');
SELECT wk.refused('a contact carrying the kit''s phone',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$, 'the kit''s phone ((737) 555-0101) is carried by contact');
DELETE FROM public.contact_channels WHERE contact_id = '00000000-0000-0000-0000-0000000a1e01';
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-0000000a1e01', 'phone', '5125550100');
SELECT wk.refused('a contact carrying the team box''s number',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$, 'the team box''s number ((512) 555-0100) is carried by contact');
DELETE FROM public.contact_channels WHERE contact_id = '00000000-0000-0000-0000-0000000a1e01';
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-0000000a1e01', 'email', 'team@walk.test');
SELECT wk.refused('a contact carrying the team box''s address',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$, 'the team box''s address (team@walk.test) is carried by contact');
DELETE FROM public.contact_channels WHERE contact_id = '00000000-0000-0000-0000-0000000a1e01';
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-0000000a1e01', 'email', 'team@noreply.walk.test');
SELECT wk.refused('a contact carrying the app''s sender',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$, 'the app''s sender (team@noreply.walk.test) is carried by contact');
-- The real customer's own record is named when it is the carrier.
UPDATE public.contact_channels SET value = 'bids@walk.test' WHERE contact_id = '00000000-0000-0000-0000-0000000a1e01';
UPDATE public.contact_channels SET contact_id = '00000000-0000-0000-0000-0000000a1c11' WHERE contact_id = '00000000-0000-0000-0000-0000000a1e01';
SELECT wk.refused('a customer''s record carrying the kit''s email is named',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test')$$,
  'is carried by contact 00000000-0000-0000-0000-0000000a1c11, kind customer, customers 00000000-0000-0000-0000-0000000a1c01');
DELETE FROM public.contact_channels WHERE contact_id = '00000000-0000-0000-0000-0000000a1c11' AND kind = 'email' AND value = 'bids@walk.test';
DELETE FROM public.contacts WHERE id = '00000000-0000-0000-0000-0000000a1e01';
SELECT wk.same('a refused setup wrote nothing',
  (SELECT count(*)::text FROM public.customers WHERE name = 'ZZ Walk Messages Desk') || '|' || (SELECT count(*)::text FROM public.app_settings WHERE key = 'walk_kit_v1'), '0|0');

-- 2 · The kit.
CREATE TEMP TABLE kit AS SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test') AS j;
SELECT wk.same('setup made the kit', (SELECT j ->> 'made' FROM kit), 'true');
SELECT wk.same('the kit''s keys',
  (SELECT string_agg(k, ',' ORDER BY k) FROM kit, jsonb_object_keys(j) AS k),
  'contactId,customerId,email,emailChannelId,estimateId,made,madeAt,phone,phoneChannelId,sharedPhone,testerId');
SELECT wk.same('its words', (SELECT (j ->> 'email') || '|' || (j ->> 'phone') || '|' || (j ->> 'testerId') || '|' || (j ->> 'sharedPhone') FROM kit),
  'bids@walk.test|(737) 555-0101|00000000-0000-0000-0000-0000000a1d03|false');
SELECT wk.same('madeAt is a time', (SELECT ((j ->> 'madeAt')::timestamptz BETWEEN now() - interval '1 minute' AND now() + interval '1 minute')::text FROM kit), 'true');
SELECT wk.same('the customer: ZZ, residential, the owner''s, with the kit''s email and phone',
  (SELECT c.name || '|' || c.customer_type || '|' || c.master_user_id || '|' || (c.contact_info ->> 'email') || '|' || (c.contact_info ->> 'phone')
   FROM kit, public.customers c WHERE c.id = (j ->> 'customerId')::uuid),
  'ZZ Walk Messages Desk|residential|00000000-0000-0000-0000-0000000a1d02|bids@walk.test|(737) 555-0101');
SELECT wk.same('the contact: the customer''s own, no name',
  (SELECT x.kind || '|' || (x.name IS NULL)::text || '|' || (x.customer_id = (j ->> 'customerId')::uuid)::text FROM kit, public.contacts x WHERE x.id = (j ->> 'contactId')::uuid),
  'customer|true|true');
SELECT wk.same('the two channels, keyed as the readers key them',
  (SELECT string_agg(ch.kind || ':' || ch.value || ':' || ch.key || ':' || (ch.id = (CASE ch.kind WHEN 'email' THEN j ->> 'emailChannelId' ELSE j ->> 'phoneChannelId' END)::uuid)::text, '|' ORDER BY ch.kind)
   FROM kit, public.contact_channels ch WHERE ch.contact_id = (j ->> 'contactId')::uuid),
  'email:bids@walk.test:bids@walk.test:true|phone:(737) 555-0101:7375550101:true');
SELECT wk.same('the readers find the kit''s contact by its address and its number',
  (SELECT (public.contact_for_channel('email', 'BIDS@walk.test') = (j ->> 'contactId')::uuid)::text || '|' || (public.contact_for_channel('phone', '+17375550101') = (j ->> 'contactId')::uuid)::text FROM kit),
  'true|true');
SELECT wk.same('the estimate: a $1.00 draft to the kit''s email, the tester''s, the owner''s, good 14 days',
  (SELECT e.status || '|' || e.title || '|' || e.total_cents || '|' || e.customer_email || '|' || e.created_by || '|' || e.master_user_id || '|' || (e.valid_until = current_date + 14)::text
     || '|' || jsonb_array_length(e.line_items_snapshot) || '|' || (e.line_items_snapshot -> 0 ->> 'unit_price_cents') || '|' || (e.customer_id = (j ->> 'customerId')::uuid)::text || '|' || (e.estimate_number > 0)::text
   FROM kit, public.estimates e WHERE e.id = (j ->> 'estimateId')::uuid),
  'draft|ZZ walk estimate (delete me)|100|bids@walk.test|00000000-0000-0000-0000-0000000a1d03|00000000-0000-0000-0000-0000000a1d02|true|1|100|true|true');
SELECT wk.same('the setting holds the kit', (SELECT (public.walk_setting_json('walk_kit_v1') = (j - 'made'))::text FROM kit), 'true');

-- 3 · Twice makes one kit.
SELECT wk.same('a second setup answers the same kit, not made',
  (SELECT (public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test') = (j - 'made') || '{"made": false}'::jsonb)::text FROM kit), 'true');
SELECT wk.same('still one ZZ customer and one setting',
  (SELECT count(*)::text FROM public.customers WHERE name = 'ZZ Walk Messages Desk') || '|' || (SELECT count(*)::text FROM public.app_settings WHERE key = 'walk_kit_v1'), '1|1');

-- 4 · The walk's rows on the kit, as the loop leaves them: the estimate text out (tied to the estimate, STOP marked on
--     the number), the email reply in, an event line; a highlight, a link; what we owe, a call task, a nudge offer
--     and hold, a skipped step; the open on the estimate; the sent copies.
INSERT INTO public.messages (id, contact_id, channel_id, channel, direction, body, estimate_id, who_user_id) VALUES
  ('00000000-0000-0000-0000-0000000a1f01', (SELECT (j ->> 'contactId')::uuid FROM kit), (SELECT (j ->> 'phoneChannelId')::uuid FROM kit), 'text', 'out', 'Your estimate is ready.', (SELECT (j ->> 'estimateId')::uuid FROM kit), '00000000-0000-0000-0000-0000000a1d03'),
  ('00000000-0000-0000-0000-0000000a1f02', (SELECT (j ->> 'contactId')::uuid FROM kit), (SELECT (j ->> 'emailChannelId')::uuid FROM kit), 'email', 'in', 'Can you do it Thursday?', NULL, NULL),
  ('00000000-0000-0000-0000-0000000a1f03', (SELECT (j ->> 'contactId')::uuid FROM kit), NULL, 'event', 'team', '👀 ZZ opened the estimate.', (SELECT (j ->> 'estimateId')::uuid FROM kit), NULL);
UPDATE public.contact_channels SET opted_out_at = now() WHERE id = (SELECT (j ->> 'phoneChannelId')::uuid FROM kit);
INSERT INTO public.message_highlights (message_id, text) VALUES ('00000000-0000-0000-0000-0000000a1f02', 'Thursday');
INSERT INTO public.message_attachments (message_id, kind, name, url, host) VALUES ('00000000-0000-0000-0000-0000000a1f02', 'link', 'the plans', 'https://drive.example/plans', 'drive');
INSERT INTO public.contact_owed (contact_id, what) VALUES ((SELECT (j ->> 'contactId')::uuid FROM kit), 'A call back');
INSERT INTO public.call_tasks (contact_id, due_on, what) VALUES ((SELECT (j ->> 'contactId')::uuid FROM kit), current_date, 'Call about Thursday');
INSERT INTO public.nudge_offers (contact_id, step_key, body) VALUES ((SELECT (j ->> 'contactId')::uuid FROM kit), 'estimate', 'Any questions on the estimate?');
INSERT INTO public.nudge_holds (contact_id, step_key, until_on) VALUES ((SELECT (j ->> 'contactId')::uuid FROM kit), 'estimate', current_date + 3);
INSERT INTO public.nudge_sent (contact_id, step_key, how, sent_by, message_id) VALUES ((SELECT (j ->> 'contactId')::uuid FROM kit), 'estimate', 'text', 'app', '00000000-0000-0000-0000-0000000a1f01');
INSERT INTO public.contact_step_skips (contact_id, step_key, why) VALUES ((SELECT (j ->> 'contactId')::uuid FROM kit), 'estimate', 'A walk');
INSERT INTO public.estimate_customer_events (estimate_id, event_type, source, user_agent) VALUES ((SELECT (j ->> 'estimateId')::uuid FROM kit), 'public_link_view', 'get-estimate-for-customer', 'Mozilla/5.0 (walk)');
INSERT INTO public.sent_documents (kind, how, customer_id, source_table, source_id) VALUES
  ('estimate', 'email', (SELECT (j ->> 'customerId')::uuid FROM kit), 'estimates', (SELECT (j ->> 'estimateId')::uuid FROM kit)),
  ('estimate_text', 'link', (SELECT (j ->> 'customerId')::uuid FROM kit), '', NULL);
SELECT wk.same('the walk''s rows are on the kit', (SELECT count(*)::text FROM kit, public.messages m WHERE m.contact_id = (j ->> 'contactId')::uuid), '3');

-- 5 · Cleanup's refusals, each deleting nothing.
-- 5a. A line folded in on a stranger's channel.
INSERT INTO public.messages (id, contact_id, channel_id, channel, direction, body) VALUES
  ('00000000-0000-0000-0000-0000000a1f04', (SELECT (j ->> 'contactId')::uuid FROM kit), '00000000-0000-0000-0000-0000000a1c22', 'text', 'in', 'Who is this?');
SELECT wk.refused('a line on a number that is not the kit''s', $$SELECT public.walk_cleanup()$$, 'came in on a number or address that is not the kit''s');
DELETE FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000a1f04';
-- 5b. A file kept on the thread.
INSERT INTO public.message_attachments (id, message_id, kind, name, bucket_path) VALUES
  ('00000000-0000-0000-0000-0000000a1f05', '00000000-0000-0000-0000-0000000a1f02', 'file', 'photo.jpg', 'abc/1-photo.jpg');
SELECT wk.refused('a file kept on the thread', $$SELECT public.walk_cleanup()$$, 'a file was kept on the kit''s thread');
DELETE FROM public.message_attachments WHERE id = '00000000-0000-0000-0000-0000000a1f05';
-- 5c. Another contact carrying the kit's address.
INSERT INTO public.contacts (id, kind) VALUES ('00000000-0000-0000-0000-0000000a1e02', 'unknown');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-0000000a1e02', 'email', 'bids@walk.test');
SELECT wk.refused('another contact carrying the kit''s address', $$SELECT public.walk_cleanup()$$,
  'another contact carries the kit''s address or number (contact 00000000-0000-0000-0000-0000000a1e02, kind unknown, no record carries email bids@walk.test)');
DELETE FROM public.contact_channels WHERE contact_id = '00000000-0000-0000-0000-0000000a1e02';
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-0000000a1e02', 'phone', '(737) 555-0101');
SELECT wk.refused('another contact carrying the kit''s number', $$SELECT public.walk_cleanup()$$, 'carries phone (737) 555-0101');
DELETE FROM public.contacts WHERE id = '00000000-0000-0000-0000-0000000a1e02';
-- 5d. Another contact or estimate on the kit's customer; another thread's line on the kit's estimate.
INSERT INTO public.contacts (id, kind, customer_id, name) VALUES ('00000000-0000-0000-0000-0000000a1e03', 'customer', (SELECT (j ->> 'customerId')::uuid FROM kit), 'Dee');
SELECT wk.refused('another contact on the kit''s customer', $$SELECT public.walk_cleanup()$$, 'another contact points at the kit''s customer');
DELETE FROM public.contacts WHERE id = '00000000-0000-0000-0000-0000000a1e03';
INSERT INTO public.estimates (id, master_user_id, created_by, customer_id, title) VALUES
  ('00000000-0000-0000-0000-0000000a1e04', '00000000-0000-0000-0000-0000000a1d02', '00000000-0000-0000-0000-0000000a1d01', (SELECT (j ->> 'customerId')::uuid FROM kit), 'A second draft');
SELECT wk.refused('another estimate on the kit''s customer', $$SELECT public.walk_cleanup()$$, 'another estimate is on the kit''s customer');
DELETE FROM public.estimates WHERE id = '00000000-0000-0000-0000-0000000a1e04';
UPDATE public.messages SET estimate_id = (SELECT (j ->> 'estimateId')::uuid FROM kit) WHERE id = '00000000-0000-0000-0000-0000000a1c31';
SELECT wk.refused('another thread''s line on the kit''s estimate', $$SELECT public.walk_cleanup()$$, 'a line on another thread points at the kit''s estimate');
UPDATE public.messages SET estimate_id = NULL WHERE id = '00000000-0000-0000-0000-0000000a1c31';
-- 5e. A foreign key the function does not know, read from the catalog: at the customer, at the contact, and a known
--     table's row from another thread at a kit line.
CREATE TABLE public.bed_walk_extra (id serial PRIMARY KEY, customer_id uuid REFERENCES public.customers(id), contact_id uuid REFERENCES public.contacts(id));
INSERT INTO public.bed_walk_extra (customer_id) VALUES ((SELECT (j ->> 'customerId')::uuid FROM kit));
SELECT wk.refused('a table added later, at the kit''s customer', $$SELECT public.walk_cleanup()$$, 'a row in public.bed_walk_extra (customer_id) points at the kit''s customer');
UPDATE public.bed_walk_extra SET customer_id = NULL, contact_id = (SELECT (j ->> 'contactId')::uuid FROM kit);
SELECT wk.refused('a table added later, at the kit''s contact', $$SELECT public.walk_cleanup()$$, 'a row in public.bed_walk_extra (contact_id) points at the kit''s contact');
DROP TABLE public.bed_walk_extra;
INSERT INTO public.nudge_sent (id, contact_id, step_key, how, sent_by, message_id) VALUES
  ('00000000-0000-0000-0000-0000000a1f06', '00000000-0000-0000-0000-0000000a1c11', 'estimate', 'text', 'app', '00000000-0000-0000-0000-0000000a1f02');
SELECT wk.refused('another thread''s reminder sent as a kit line', $$SELECT public.walk_cleanup()$$, 'a row in public.nudge_sent (message_id) points at the kit''s thread');
DELETE FROM public.nudge_sent WHERE id = '00000000-0000-0000-0000-0000000a1f06';
SELECT wk.same('every refusal deleted nothing',
  (SELECT wk.kit_rows(j) FROM kit) || '|' || (SELECT count(*)::text FROM kit, public.messages m WHERE m.contact_id = (j ->> 'contactId')::uuid) || '|' || wk.real_rows(),
  '1|1|2|1|1|3|1|1|2|1|1|1');

-- 6 · Cleanup: the kit's rows and nothing else.
CREATE TEMP TABLE done AS SELECT public.walk_cleanup() AS j;
SELECT wk.same('cleaned', (SELECT j ->> 'cleaned' FROM done), 'true');
SELECT wk.same('the counts per table',
  (SELECT string_agg(k || '=' || v, ',' ORDER BY k) FROM done, jsonb_each_text(j -> 'counts') AS t(k, v)),
  'app_settings=1,call_tasks=1,contact_channels=2,contact_jobs=0,contact_owed=1,contact_step_skips=1,contacts=1,customers=1,estimate_customer_events=1,estimates=1,message_attachments=1,message_highlights=1,message_promises=0,messages=3,nudge_holds=1,nudge_offers=1,nudge_sent=1,quick_reply_uses=0,sent_documents=2');
SELECT wk.same('the answer names the kit it removed', (SELECT ((j -> 'kit') = (SELECT k.j - 'made' FROM kit k))::text FROM done), 'true');
SELECT wk.same('the kit''s rows are gone', (SELECT wk.kit_rows(j) FROM kit), '0|0|0|0|0');
SELECT wk.same('no contact carries bids@ or the bids number', wk.carriers('email', 'bids@walk.test') || '|' || wk.carriers('phone', '(737) 555-0101'), '0|0');
SELECT wk.same('no ZZ customer is left, and no unknown contact was made by the customer''s delete',
  (SELECT count(*)::text FROM public.customers WHERE name LIKE 'ZZ Walk%') || '|' || (SELECT count(*)::text FROM public.contacts WHERE kind = 'unknown' AND name LIKE 'ZZ Walk%'), '0|0');
SELECT wk.same('the real customer keeps every row', wk.real_rows(), '1|1|2|1|1|1');
SELECT wk.same('the tester is kept', (SELECT count(*)::text FROM public.users WHERE id = '00000000-0000-0000-0000-0000000a1d03'), '1');
SELECT wk.same('a second cleanup has nothing to clean', (public.walk_cleanup()) ->> 'nothing', 'true');

-- 7 · The owner's-cell fallback: the kit's phone is a number a contact already carries, with p_shared_phone_ok.
INSERT INTO public.contacts (id, kind) VALUES ('00000000-0000-0000-0000-0000000a1e05', 'unknown');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-0000000a1e05', 'phone', '(512) 555-0177');
SELECT wk.refused('a shared phone without the fallback''s word',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test', '(512) 555-0177')$$, 'the kit''s phone ((512) 555-0177) is carried by contact');
CREATE TEMP TABLE kit2 AS SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test', '(512) 555-0177', true) AS j;
SELECT wk.same('the fallback kit carries the shared phone and says so',
  (SELECT (j ->> 'made') || '|' || (j ->> 'phone') || '|' || (j ->> 'sharedPhone') || '|' || (j ->> 'email') FROM kit2), 'true|(512) 555-0177|true|bids@walk.test');
SELECT wk.same('two contacts carry the number while the fallback kit stands', wk.carriers('phone', '(512) 555-0177'), '2');
-- The cleanup in its own statement: a STABLE read in the same statement would still see the rows.
CREATE TEMP TABLE done2 AS SELECT public.walk_cleanup() AS j;
SELECT wk.same('cleanup takes the kit''s channel and leaves the other contact''s',
  (SELECT j ->> 'cleaned' FROM done2) || '|' || wk.carriers('phone', '(512) 555-0177') || '|' || (SELECT wk.kit_rows(j) FROM kit2), 'true|1|0|0|0|0|0');
DELETE FROM public.contacts WHERE id = '00000000-0000-0000-0000-0000000a1e05';

-- 8 · A dev as the maker: the walk with the owner's two presses (BUILD_PLAN § 4).
CREATE TEMP TABLE kit3 AS SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d01', 'team@noreply.walk.test') AS j;
SELECT wk.same('a dev makes the kit, as the estimate''s maker',
  (SELECT (j ->> 'made') || '|' || (SELECT e.created_by::text FROM public.estimates e WHERE e.id = (j ->> 'estimateId')::uuid) FROM kit3), 'true|00000000-0000-0000-0000-0000000a1d01');
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000a1d01';
SELECT wk.same('and the same kit again, dev or tester', (SELECT (public.walk_setup('00000000-0000-0000-0000-0000000a1d03', 'team@noreply.walk.test') ->> 'customerId' = (j ->> 'customerId'))::text FROM kit3), 'true');
SELECT wk.same('cleaned again', (public.walk_cleanup()) ->> 'cleaned', 'true');
SELECT wk.refused('a dev in training mode is not a maker',
  $$SELECT public.walk_setup('00000000-0000-0000-0000-0000000a1d01', 'team@noreply.walk.test')$$, 'is not the walk tester');
UPDATE public.users SET read_only = false WHERE id = '00000000-0000-0000-0000-0000000a1d01';
SELECT wk.same('nothing of the kit is left', (SELECT count(*)::text FROM public.customers WHERE name LIKE 'ZZ Walk%') || '|' || (SELECT count(*)::text FROM public.app_settings WHERE key = 'walk_kit_v1') || '|' || wk.real_rows(), '0|0|1|1|2|1|1|1');

DO $$ BEGIN RAISE NOTICE 'walk_kit PASSED'; END $$;
ROLLBACK;
