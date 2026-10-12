-- Messages, cut 5, the Quo link (migration *_quo_messages): a line from Quo is one row by its Quo id however many
-- times Quo sends it; quo_write_line writes the kernels' merge only over the revision it read, so two events for one
-- call never write over each other; the new columns keep their rules; the webhook's memory takes a delivery once,
-- gives one back after a failure, takes an id past 28 hours again and forgets the old ones; the office reads the new
-- columns and writes none of them; nobody signed in reaches the memory or the webhook's functions. The writes are made
-- as postgres, standing in for the service role; everything rolls back. Raises on the first failed assertion; ends
-- with "quo_messages PASSED". See scripts/pgtest-quo-messages.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an estimator).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@quo.test'),
  ('00000000-0000-0000-0000-0000000006d2', 'estimator@quo.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@quo.test', 'Quo Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000006d2', 'estimator@quo.test', 'Quo Estimator', 'estimator', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A trade partner whose main contact is Greg, and his contact as the spine's seed makes it (no name of its own).
INSERT INTO public.gc_companies (id, name, contact_name, phone) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'Quo Hillside', 'Greg Paulk', '(210) 555-0113');
INSERT INTO public.contacts (id, kind, gc_company_id, goes_by) VALUES
  ('00000000-0000-0000-0000-0000000006c2', 'trade', '00000000-0000-0000-0000-0000000006a1', NULL);
INSERT INTO public.contact_channels (id, contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-0000000006e2', '00000000-0000-0000-0000-0000000006c2', 'phone', '(210) 555-0113');

-- A number nobody knew, as the webhook makes one: an unknown contact with its phone.
INSERT INTO public.contacts (id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000006c1', 'unknown', '(830) 555-0172');
INSERT INTO public.contact_channels (id, contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-0000000006e1', '00000000-0000-0000-0000-0000000006c1', 'phone', '+18305550172');

CREATE SCHEMA mqo;
CREATE FUNCTION mqo.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mqo.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mqo.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- quo_write_line's answer in one word a field: written, then the revision ('-' when nothing was written).
CREATE FUNCTION mqo.wrote(p_quo_id text, p_rev integer, p_row jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', w.written::text, coalesce(w.rev::text, '-')) FROM public.quo_write_line(p_quo_id, p_rev, p_row) w
$$;
GRANT USAGE ON SCHEMA mqo TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mqo TO anon, authenticated;

-- A call line as the kernels merge it, with one field over the rest.
CREATE FUNCTION mqo.call(extra jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'contact_id', '00000000-0000-0000-0000-0000000006c1',
    'channel_id', '00000000-0000-0000-0000-0000000006e1',
    'channel', 'call', 'direction', 'in', 'who_text', 'answered on the company number',
    'at', '2026-10-02T14:00:00Z', 'body', 'Call.', 'duration_seconds', 252) || extra
$$;

-- 1 · A line by its Quo id.
INSERT INTO public.messages (contact_id, channel_id, channel, direction, who_text, at, body, quo_id) VALUES
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006e1', 'text', 'in', '(830) 555-0172',
   '2026-10-02 14:12:00+00', 'Hi this is Dee at Alamo Concrete, new cell.', 'MS-1')
  ON CONFLICT (quo_id) DO NOTHING;
INSERT INTO public.messages (contact_id, channel_id, channel, direction, who_text, at, body, quo_id) VALUES
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006e1', 'text', 'in', '(830) 555-0172',
   '2026-10-02 14:12:00+00', 'Hi this is Dee at Alamo Concrete, new cell.', 'MS-1')
  ON CONFLICT (quo_id) DO NOTHING;
SELECT mqo.same('a text Quo sent twice is one line', (SELECT count(*)::text FROM public.messages WHERE quo_id = 'MS-1'), '1');
SELECT mqo.refused('a second line under one Quo id',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, quo_id) VALUES ('00000000-0000-0000-0000-0000000006c1', 'text', 'in', 'again', 'MS-1')$q$,
  'messages_quo_id_key');
INSERT INTO public.messages (contact_id, channel, direction, body) VALUES
  ('00000000-0000-0000-0000-0000000006c1', 'note', 'team', 'Dee is new at Alamo Concrete.'),
  ('00000000-0000-0000-0000-0000000006c1', 'note', 'team', 'Ask Robert about Pad B.');
SELECT mqo.same('lines with no Quo id never collide',
  (SELECT count(*)::text FROM public.messages WHERE quo_id IS NULL AND contact_id = '00000000-0000-0000-0000-0000000006c1'), '2');

-- 2 · The webhook's one write, over the revision it read.
SELECT mqo.same('the first event of a call writes its line', mqo.wrote('CA-1', NULL, mqo.call('{}')), 'true|1');
SELECT mqo.same('a second first write changes nothing', mqo.wrote('CA-1', NULL, mqo.call('{"body": "Other."}')), 'false|-');
SELECT mqo.same('the call is one line, as first written',
  (SELECT concat_ws('|', count(*), max(body)) FROM public.messages WHERE quo_id = 'CA-1'), '1|Call.');
SELECT mqo.same('the summary over revision 1 is written',
  mqo.wrote('CA-1', 1, mqo.call('{"body": "Greg will price it by Wednesday.", "summary": "Greg will price it by Wednesday."}')), 'true|2');
-- The transcript was merged from revision 1 at the same moment: refused, so the webhook reads again.
SELECT mqo.same('a write over a stale revision is refused',
  mqo.wrote('CA-1', 1, mqo.call('{"transcript": "Greg: I will price it by Wednesday."}')), 'false|-');
SELECT mqo.same('the summary stands, nothing written over it',
  (SELECT concat_ws('|', quo_rev, summary, coalesce(transcript, '-')) FROM public.messages WHERE quo_id = 'CA-1'),
  '2|Greg will price it by Wednesday.|-');
SELECT mqo.same('read again and merged again, the transcript is written',
  mqo.wrote('CA-1', 2, mqo.call('{"body": "Greg will price it by Wednesday.", "summary": "Greg will price it by Wednesday.", "transcript": "Greg: I will price it by Wednesday."}')),
  'true|3');
SELECT mqo.same('the line holds both',
  (SELECT concat_ws('|', quo_rev, summary, transcript, duration_seconds) FROM public.messages WHERE quo_id = 'CA-1'),
  '3|Greg will price it by Wednesday.|Greg: I will price it by Wednesday.|252');
SELECT mqo.refused('a line from Quo needs its Quo id', $q$SELECT * FROM public.quo_write_line('  ', NULL, '{}'::jsonb)$q$, 'needs its Quo id');

-- 3 · The new columns keep their rules.
SELECT mqo.refused('an ending rides only on a text we sent',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, delivery) VALUES ('00000000-0000-0000-0000-0000000006c1', 'text', 'in', 'x', 'delivered')$q$,
  'messages_delivery_on_texts');
SELECT mqo.refused('an ending is one of the three',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, delivery) VALUES ('00000000-0000-0000-0000-0000000006c1', 'text', 'out', 'x', 'lost')$q$,
  'messages_delivery_known');
SELECT mqo.refused('a recording belongs to a call',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, recording_url) VALUES ('00000000-0000-0000-0000-0000000006c1', 'text', 'in', 'x', 'https://files.example/1.mp3')$q$,
  'messages_call_columns_on_calls');
SELECT mqo.refused('a length is never below nothing',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, duration_seconds) VALUES ('00000000-0000-0000-0000-0000000006c1', 'call', 'in', 'x', -1)$q$,
  'messages_duration_known');
SELECT mqo.refused('a Quo id is never blank',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, quo_id) VALUES ('00000000-0000-0000-0000-0000000006c1', 'text', 'in', 'x', '  ')$q$,
  'messages_quo_id_usable');
SELECT mqo.same('a text of ours keeps how it ended',
  mqo.wrote('MS-2', NULL, jsonb_build_object('contact_id', '00000000-0000-0000-0000-0000000006c1', 'channel_id', '00000000-0000-0000-0000-0000000006e1',
    'channel', 'text', 'direction', 'out', 'who_text', 'Robert · from the company number', 'body', 'Dee, we have your number now.',
    'optout_line', 'first', 'delivery', 'failed')), 'true|1');
SELECT mqo.same('with its opt-out line',
  (SELECT concat_ws('|', delivery, optout_line) FROM public.messages WHERE quo_id = 'MS-2'), 'failed|first');

-- 4 · The contact a number lands on.
-- One statement places the number; the next reads the rows it made (a statement never sees what it writes itself).
CREATE TEMP TABLE mqo_placed AS SELECT * FROM public.quo_place_number('+12105550199', '(210) 555-0199');
SELECT mqo.same('a number nobody has makes an unknown contact with that phone',
  (SELECT concat_ws('|', p.made::text, c.kind, c.name, ch.value, coalesce(p.stopped_at::text, '-'), p.placed_kind, p.placed_name)
   FROM mqo_placed p
   JOIN public.contacts c ON c.id = p.placed_contact
   JOIN public.contact_channels ch ON ch.id = p.placed_channel),
  'true|unknown|(210) 555-0199|+12105550199|-|unknown|(210) 555-0199');
SELECT mqo.same('the same number again lands on that contact',
  (SELECT concat_ws('|', p.made::text, (p.placed_contact = c.id)::text)
   FROM public.quo_place_number('(210) 555-0199', 'ignored') p, public.contacts c WHERE c.name = '(210) 555-0199'),
  'false|true');
SELECT mqo.same('one contact holds that number',
  (SELECT count(*)::text FROM public.contact_channels WHERE key = '2105550199'), '1');
SELECT mqo.same('a known number lands on its contact, with its STOP',
  (SELECT concat_ws('|', p.made::text, p.placed_contact::text, p.placed_channel::text)
   FROM public.quo_place_number('830-555-0172', 'ignored') p),
  'false|00000000-0000-0000-0000-0000000006c1|00000000-0000-0000-0000-0000000006e1');
UPDATE public.contact_channels SET opted_out_at = '2026-10-01 15:00:00+00' WHERE id = '00000000-0000-0000-0000-0000000006e1';
SELECT mqo.same('a stopped number says when',
  (SELECT (p.stopped_at = '2026-10-01 15:00:00+00'::timestamptz)::text FROM public.quo_place_number('+18305550172', 'ignored') p), 'true');
SELECT mqo.same('a trade partner''s number reads the name on its record',
  (SELECT concat_ws('|', p.made::text, p.placed_contact::text, p.placed_kind, p.placed_name, coalesce(p.placed_goes_by, '-'))
   FROM public.quo_place_number('+12105550113', 'ignored') p),
  'false|00000000-0000-0000-0000-0000000006c2|trade|Greg Paulk|-');
UPDATE public.contacts SET goes_by = 'Gregory' WHERE id = '00000000-0000-0000-0000-0000000006c2';
SELECT mqo.same('and what he goes by',
  (SELECT p.placed_goes_by FROM public.quo_place_number('+12105550113', 'ignored') p), 'Gregory');
SELECT mqo.refused('a word is not a number', $q$SELECT * FROM public.quo_place_number('call me', 'x')$q$, 'not a phone number');

-- 5 · The deliveries the webhook took.
SELECT mqo.same('a new delivery is taken', public.quo_webhook_claim('msg_quo_1')::text, 'true');
SELECT mqo.same('the same delivery again is a repeat', public.quo_webhook_claim('msg_quo_1')::text, 'false');
INSERT INTO public.quo_webhook_ids (id, seen_at) VALUES
  ('msg_quo_old', clock_timestamp() - interval '29 hours'),
  ('msg_quo_older', clock_timestamp() - interval '40 hours');
SELECT mqo.same('an id past 28 hours is taken again', public.quo_webhook_claim('msg_quo_old')::text, 'true');
SELECT mqo.same('the forget drops what is past 28 hours', public.quo_webhook_ids_forget()::text, '1');
SELECT mqo.same('and keeps the rest',
  (SELECT string_agg(id, ',' ORDER BY id) FROM public.quo_webhook_ids), 'msg_quo_1,msg_quo_old');
SELECT mqo.same('a failure gives the delivery back', public.quo_webhook_release('msg_quo_1')::text, 'true');
SELECT mqo.same('and Quo''s retry is taken', public.quo_webhook_claim('msg_quo_1')::text, 'true');
SELECT mqo.same('a release of nothing says so', public.quo_webhook_release('msg_quo_none')::text, 'false');
SELECT mqo.refused('a delivery needs its id', $q$SELECT public.quo_webhook_claim(' ')$q$, 'needs its webhook-id');

-- 6 · Who reads and writes.
SELECT mqo.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mqo.same('the office reads the new columns',
  (SELECT concat_ws('|', quo_id, duration_seconds, summary) FROM public.messages WHERE quo_id = 'CA-1'),
  'CA-1|252|Greg will price it by Wednesday.');
SELECT mqo.refused('the office writes no Quo column', $q$UPDATE public.messages SET summary = 'x' WHERE quo_id = 'CA-1'$q$, 'permission denied for table messages');
SELECT mqo.refused('the office reads no delivery memory', $q$SELECT count(*) FROM public.quo_webhook_ids$q$, 'permission denied for table quo_webhook_ids');
SELECT mqo.refused('the office takes no delivery', $q$SELECT public.quo_webhook_claim('msg_quo_2')$q$, 'permission denied for function quo_webhook_claim');
SELECT mqo.refused('the office writes no line through the webhook''s door', $q$SELECT * FROM public.quo_write_line('CA-9', NULL, '{}'::jsonb)$q$, 'permission denied for function quo_write_line');
SELECT mqo.refused('the office places no number', $q$SELECT * FROM public.quo_place_number('+12105550198', 'x')$q$, 'permission denied for function quo_place_number');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT mqo.refused('no sign-in reads the memory', $q$SELECT count(*) FROM public.quo_webhook_ids$q$, 'permission denied for table quo_webhook_ids');
SELECT mqo.refused('no sign-in forgets anything', $q$SELECT public.quo_webhook_ids_forget()$q$, 'permission denied for function quo_webhook_ids_forget');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'quo_messages PASSED'; END $$;
ROLLBACK;
