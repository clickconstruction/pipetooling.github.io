-- Messages, residential R6 (migration *_messages_two_boxes): the lines from before have their box, a note none; the
-- webhook's and the reader's writes carry a box, today's when they send none; a STOP per box keeps its rules, nobody
-- signed in writes one, and a fold keeps a STOP to either box without ever starting one; the boxes ship empty in
-- Settings and only the owner or a dev changes them; the reader keeps one row per box, the bids row found by its old
-- key. The webhook's and the reader's writes are made as postgres, standing in for the service role; everything rolls
-- back. Raises on the first failed assertion; ends with "messages_two_boxes PASSED". See
-- scripts/pgtest-messages-email.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an assistant), a superintendent outside it and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@boxes.test'),
  ('00000000-0000-0000-0000-0000000008d2', 'assistant@boxes.test'),
  ('00000000-0000-0000-0000-0000000008d3', 'super@boxes.test'),
  ('00000000-0000-0000-0000-0000000008d5', 'twin@boxes.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@boxes.test', 'Boxes Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000008d2', 'assistant@boxes.test', 'Boxes Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000008d3', 'super@boxes.test', 'Boxes Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000008d5', 'twin@boxes.test', 'Boxes Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA mtb;
CREATE FUNCTION mtb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mtb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mtb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The box of the line a write answered with.
CREATE FUNCTION mtb.quo_box(p_quo_id text, p_rev integer, p_row jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(m.mailbox, '-') FROM public.quo_write_line(p_quo_id, p_rev, p_row) w JOIN public.messages m ON m.id = w.id
$$;
CREATE FUNCTION mtb.email_box(p_gmail_id text, p_row jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(m.mailbox, '-') FROM public.email_write_line(p_gmail_id, p_row, '[]'::jsonb, NULL) w JOIN public.messages m ON m.id = w.id
$$;
-- A number's STOPs per box, and whether it carries the older stamp.
CREATE FUNCTION mtb.stops(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT concat_ws('|', ch.opted_out_by_box::text, (ch.opted_out_at IS NOT NULL)::text) FROM public.contact_channels ch WHERE ch.id = p_id
$$;
GRANT USAGE ON SCHEMA mtb TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mtb TO anon, authenticated;

-- 1 · The lines from before (25_two_boxes_before.sql, committed before the migration) have their box.
SELECT mtb.same('a text and a call on the company number are team, an email from bids@ is bids, an event and a note none',
  (SELECT string_agg(channel || '=' || coalesce(mailbox, '-'), ', ' ORDER BY channel) FROM public.messages WHERE contact_id = '00000000-0000-0000-0000-0000000008c0'),
  'email=bids, event=-, missed=team, note=-, text=team');
SELECT mtb.refused('a note has no box',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, mailbox) VALUES ('00000000-0000-0000-0000-0000000008c0', 'note', 'team', 'x', 'team')$q$,
  'messages_mailbox_known');
SELECT mtb.refused('a box we do not have',
  $q$INSERT INTO public.messages (contact_id, channel, direction, body, mailbox) VALUES ('00000000-0000-0000-0000-0000000008c0', 'text', 'in', 'x', 'office')$q$,
  'messages_mailbox_known');

-- 2 · The webhook's and the reader's writes carry the box.
SELECT mtb.same('a Quo line with no box is team, today''s one number',
  mtb.quo_box('AC-r6-1', NULL, '{"contact_id":"00000000-0000-0000-0000-0000000008c0","channel":"text","direction":"in","body":"On my way?"}'), 'team');
SELECT mtb.same('a Quo line to the bids number is bids',
  mtb.quo_box('AC-r6-2', NULL, '{"contact_id":"00000000-0000-0000-0000-0000000008c0","channel":"text","direction":"in","body":"Bid due?","mailbox":"bids"}'), 'bids');
SELECT mtb.same('a later write with no box keeps the box the line has',
  mtb.quo_box('AC-r6-2', 1, '{"contact_id":"00000000-0000-0000-0000-0000000008c0","channel":"text","direction":"in","body":"Bid due Friday?"}'), 'bids');
SELECT mtb.same('an email with no box is bids, today''s one reader',
  mtb.email_box('g-r6-1', '{"contact_id":"00000000-0000-0000-0000-0000000008c0","direction":"in","body":"x"}'), 'bids');
SELECT mtb.same('an email to the team box is team',
  mtb.email_box('g-r6-2', '{"contact_id":"00000000-0000-0000-0000-0000000008c0","direction":"in","body":"x","mailbox":"team"}'), 'team');
SELECT public.email_write_line('g-r6-3', '{"contact_id":"00000000-0000-0000-0000-0000000008c0","direction":"in","body":"x"}'::jsonb, '[]'::jsonb,
  '{"who_text":"Robert","body":"For the Hill job."}'::jsonb);
SELECT mtb.same('a forwarded copy''s note has no box',
  (SELECT coalesce(mailbox, '-') FROM public.messages WHERE contact_id = '00000000-0000-0000-0000-0000000008c0' AND body = 'For the Hill job.'), '-');

-- 3 · A STOP per box keeps its rules.
INSERT INTO public.contacts (id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'unknown', 'Boxes A'), ('00000000-0000-0000-0000-0000000008b1', 'unknown', 'Boxes B'),
  ('00000000-0000-0000-0000-0000000008a2', 'unknown', 'Boxes C'), ('00000000-0000-0000-0000-0000000008b2', 'unknown', 'Boxes D'),
  ('00000000-0000-0000-0000-0000000008a3', 'unknown', 'Boxes E');
INSERT INTO public.contact_channels (id, contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-0000000008e0', '00000000-0000-0000-0000-0000000008a3', 'phone', '2105550199');
SELECT mtb.same('a number starts with no STOP per box', mtb.stops('00000000-0000-0000-0000-0000000008e0'), '{}|false');
SELECT mtb.refused('an address never says STOP',
  $q$INSERT INTO public.contact_channels (contact_id, kind, value, opted_out_by_box) VALUES ('00000000-0000-0000-0000-0000000008a1', 'email', 'a@boxes.example', '{"team":"2026-10-13T00:00:00Z"}')$q$,
  'contact_channels_stop_by_box_known');
SELECT mtb.refused('a STOP to a box we do not have',
  $q$INSERT INTO public.contact_channels (contact_id, kind, value, opted_out_by_box) VALUES ('00000000-0000-0000-0000-0000000008a1', 'phone', '2105550100', '{"office":null}')$q$,
  'contact_channels_stop_by_box_known');
SELECT mtb.refused('a STOP that is not a stamp',
  $q$INSERT INTO public.contact_channels (contact_id, kind, value, opted_out_by_box) VALUES ('00000000-0000-0000-0000-0000000008a1', 'phone', '2105550100', '{"team":1}')$q$,
  'contact_channels_stop_by_box_known');
SELECT mtb.refused('STOPs that are not by box',
  $q$INSERT INTO public.contact_channels (contact_id, kind, value, opted_out_by_box) VALUES ('00000000-0000-0000-0000-0000000008a1', 'phone', '2105550100', '[]')$q$,
  'contact_channels_stop_by_box_known');
INSERT INTO public.contact_channels (id, contact_id, kind, value, opted_out_at, opted_out_by_box) VALUES
  -- One number on two contacts: A stopped the team box and started bids; B stopped bids.
  ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008a1', 'phone', '(210) 555-0111', NULL, '{"team":"2026-10-01T15:00:00+00:00","bids":null}'),
  ('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008b1', 'phone', '210-555-0111', NULL, '{"bids":"2026-10-02T15:00:00+00:00"}'),
  -- One number on two more: C said STOP before there were two boxes; D started bids since.
  ('00000000-0000-0000-0000-0000000008e3', '00000000-0000-0000-0000-0000000008a2', 'phone', '2105550122', '2026-09-01T15:00:00+00:00', '{}'),
  ('00000000-0000-0000-0000-0000000008e4', '00000000-0000-0000-0000-0000000008b2', 'phone', '2105550122', NULL, '{"bids":null}'),
  -- E's copy of B's number stopped the team box later.
  ('00000000-0000-0000-0000-0000000008e5', '00000000-0000-0000-0000-0000000008a3', 'phone', '2105550111', NULL, '{"team":"2026-10-05T15:00:00+00:00"}');

-- 4 · Nobody signed in writes a box or a STOP.
SELECT mtb.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT mtb.refused('the office marks no STOP by box', $q$UPDATE public.contact_channels SET opted_out_by_box = '{}'$q$, 'permission denied for table contact_channels');
SELECT mtb.refused('the office moves no line to another box', $q$UPDATE public.messages SET mailbox = 'team'$q$, 'permission denied for table messages');
-- 5 · A fold by the office keeps a STOP to either box, through the definer, and still runs the later cuts' folds.
SELECT public.contacts_fold('00000000-0000-0000-0000-0000000008a1', '00000000-0000-0000-0000-0000000008b1');
RESET ROLE;
SELECT mtb.same('one copy is left: B''s, with A''s STOP to the team box beside its own to bids',
  (SELECT string_agg(id::text, ',') FROM public.contact_channels WHERE kind = 'phone' AND key = '2105550111' AND contact_id <> '00000000-0000-0000-0000-0000000008a3')
    || '|' || mtb.stops('00000000-0000-0000-0000-0000000008e2'),
  '00000000-0000-0000-0000-0000000008e2|{"bids": "2026-10-02T15:00:00+00:00", "team": "2026-10-01T15:00:00+00:00"}|false');
SELECT public.contacts_fold('00000000-0000-0000-0000-0000000008a2', '00000000-0000-0000-0000-0000000008b2');
SELECT mtb.same('the copy with the older STOP is kept whole, and D''s start to bids does not lift it',
  (SELECT string_agg(id::text, ',') FROM public.contact_channels WHERE kind = 'phone' AND key = '2105550122') || '|' || mtb.stops('00000000-0000-0000-0000-0000000008e3'),
  '00000000-0000-0000-0000-0000000008e3|{}|true');

-- 6 · The definer changes nothing for someone off the office team or a twin, and only copies one number's STOP.
UPDATE public.contact_channels SET opted_out_by_box = '{}' WHERE id = '00000000-0000-0000-0000-0000000008e2';
SELECT mtb.as_user('00000000-0000-0000-0000-0000000008d3');
SET LOCAL ROLE authenticated;
SELECT public.contact_channels_keep_stops('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008e5');
RESET ROLE;
SELECT mtb.as_user('00000000-0000-0000-0000-0000000008d5');
SET LOCAL ROLE authenticated;
SELECT public.contact_channels_keep_stops('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008e5');
RESET ROLE;
SELECT mtb.same('a superintendent''s call and a twin''s change nothing', mtb.stops('00000000-0000-0000-0000-0000000008e2'), '{}|false');
SELECT mtb.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT public.contact_channels_keep_stops('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008e5');
SELECT public.contact_channels_keep_stops('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008e3');
RESET ROLE;
SELECT mtb.same('the office copies the same number''s STOP, never another number''s',
  mtb.stops('00000000-0000-0000-0000-0000000008e2'), '{"team": "2026-10-05T15:00:00+00:00"}|false');
SET LOCAL ROLE anon;
SELECT mtb.refused('nobody signed in reaches it', $q$SELECT public.contact_channels_keep_stops('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008e5')$q$,
  'permission denied for function contact_channels_keep_stops');
RESET ROLE;

-- 7 · The two boxes in Settings ship empty; the owner or a dev fills them, nobody else.
SELECT mtb.same('every field ships empty',
  (SELECT value_text FROM public.app_settings WHERE key = 'messages_boxes_v1'),
  '{"team":{"address":"","phone":"","numberId":""},"bids":{"address":"","phone":"","numberId":""}}');
SELECT mtb.as_user('00000000-0000-0000-0000-0000000008d1');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = '{"team":{"address":"team@boxes.example","phone":"(512) 555-0144","numberId":"PN-team"},"bids":{"address":"bids@boxes.example","phone":"","numberId":""}}'
WHERE key = 'messages_boxes_v1';
RESET ROLE;
SELECT mtb.same('a dev fills the team box', (SELECT value_text::jsonb #>> '{team,address}' FROM public.app_settings WHERE key = 'messages_boxes_v1'), 'team@boxes.example');
SELECT mtb.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = '{}' WHERE key = 'messages_boxes_v1';
SELECT mtb.same('the office reads the boxes', (SELECT value_text::jsonb #>> '{team,numberId}' FROM public.app_settings WHERE key = 'messages_boxes_v1'), 'PN-team');
RESET ROLE;
SELECT mtb.same('an assistant does not change them', (SELECT value_text::jsonb #>> '{team,address}' FROM public.app_settings WHERE key = 'messages_boxes_v1'), 'team@boxes.example');

-- 8 · The reader keeps one row per box; the deployed reader still finds the bids row by its old key.
SELECT mtb.same('today''s row is the bids row, found by its old key',
  (SELECT concat_ws('|', count(*), string_agg(mailbox, ',')) FROM public.gmail_sync_state WHERE id), '1|bids');
SELECT mtb.same('the key is the box',
  (SELECT string_agg(a.attname, ',') FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
   WHERE i.indrelid = 'public.gmail_sync_state'::regclass AND i.indisprimary), 'mailbox');
INSERT INTO public.gmail_sync_state (mailbox) VALUES ('team');
SELECT mtb.same('a team row has no old key, so the bids row is still the only one it finds',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.gmail_sync_state WHERE id), (SELECT coalesce(id::text, 'none') FROM public.gmail_sync_state WHERE mailbox = 'team'))), '1|none');
SELECT mtb.refused('one row a box', $q$INSERT INTO public.gmail_sync_state (mailbox) VALUES ('team')$q$, 'gmail_sync_state_pkey');
SELECT mtb.refused('the old key is the bids row''s alone', $q$UPDATE public.gmail_sync_state SET id = true WHERE mailbox = 'team'$q$, 'gmail_sync_state_id_is_bids');
SELECT mtb.refused('a box we do not have', $q$INSERT INTO public.gmail_sync_state (mailbox) VALUES ('office')$q$, 'gmail_sync_state_mailbox_known');
SELECT mtb.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT mtb.same('the office reads both rows', (SELECT string_agg(mailbox, ',' ORDER BY mailbox) FROM public.gmail_sync_state), 'bids,team');
SELECT mtb.refused('the office writes no row', $q$UPDATE public.gmail_sync_state SET last_error = 'x'$q$, 'permission denied for table gmail_sync_state');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'messages_two_boxes PASSED'; END $$;
ROLLBACK;
