-- Messages, residential R5's push, PR 3 (migration *_messages_notify_cron): the owner's switch ships off, and only the
-- owner or a dev turns it on or off; the cron row posts the sweep to messages-notify every minute, and only while the
-- switch is on. Presses run as each user through RLS; everything rolls back. Raises on the first failed assertion; ends
-- with "messages_notify_cron PASSED". See scripts/pgtest-messages-notify-cron.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- A dev, the owner (a master) and an assistant.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@push.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'master@push.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'assistant@push.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@push.test', 'Push Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000009d2', 'master@push.test', 'Push Master', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000009d3', 'assistant@push.test', 'Push Assistant', 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA mnc;
CREATE FUNCTION mnc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION mnc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  -- auth.role(), which app_settings' read policy asks, reads this one.
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION mnc.switch() RETURNS text LANGUAGE sql AS $$
  SELECT value_text FROM public.app_settings WHERE key = 'messages_reply_push_on_v1'
$$;
-- The rows the cron's own statement selects to post, run as cron runs it. The bed's image may have no vault: a stand-in
-- table lets the statement read its secrets' names; its WHERE decides before any secret is read.
DO $$
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS vault;
    CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
  END IF;
END $$;
CREATE FUNCTION mnc.cron_posts() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_rows integer;
BEGIN
  EXECUTE btrim((SELECT command FROM cron.job WHERE jobname = 'messages-reply-push'), E' \n\t;');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows::text;
END $$;
GRANT USAGE ON SCHEMA mnc TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mnc TO authenticated;

-- 1 · As shipped: the switch off, one cron row a minute, posting the sweep to messages-notify only while it is on.
SELECT mnc.same('the switch ships off', mnc.switch(), 'false');
SELECT mnc.same('one cron row, every minute, run twice or not',
  (SELECT concat_ws('|', count(*), min(schedule)) FROM cron.job WHERE jobname = 'messages-reply-push'), '1|* * * * *');
SELECT mnc.same('it posts the sweep to messages-notify with the cron secret, and reads the switch',
  (SELECT concat_ws('|',
    (position('/functions/v1/messages-notify' IN command) > 0)::text,
    (position('{"sweep": true}' IN command) > 0)::text,
    (position('X-Cron-Secret' IN command) > 0)::text,
    (position('messages_reply_push_on_v1' IN command) > 0)::text)
   FROM cron.job WHERE jobname = 'messages-reply-push'),
  'true|true|true|true');
SELECT mnc.same('with the switch off, the cron''s own statement selects nothing to post', mnc.cron_posts(), '0');

-- 2 · The owner or a dev turns it on or off from the app; nobody else does.
SELECT mnc.as_user('00000000-0000-0000-0000-0000000009d3');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = 'true' WHERE key = 'messages_reply_push_on_v1';
RESET ROLE;
SELECT mnc.same('an assistant does not turn it on', mnc.switch(), 'false');
SELECT mnc.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = 'true' WHERE key = 'messages_reply_push_on_v1';
RESET ROLE;
SELECT mnc.same('a dev turns it on', mnc.switch(), 'true');
SELECT mnc.as_user('00000000-0000-0000-0000-0000000009d3');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = 'false' WHERE key = 'messages_reply_push_on_v1';
RESET ROLE;
SELECT mnc.same('an assistant does not turn it off', mnc.switch(), 'true');
SELECT mnc.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = 'false' WHERE key = 'messages_reply_push_on_v1';
RESET ROLE;
SELECT mnc.same('the owner turns it off', mnc.switch(), 'false');

DO $$ BEGIN RAISE NOTICE 'messages_notify_cron PASSED'; END $$;
ROLLBACK;
