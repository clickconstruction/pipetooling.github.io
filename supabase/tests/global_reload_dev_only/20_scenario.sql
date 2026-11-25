-- The scenario (v2.8532): after the migration ran twice, anyone signed in hears Global Reload's channel, a dev alone
-- sends on it, nobody signed out does either, and the two policies open no other channel. In one transaction that
-- rolls back.
\set ON_ERROR_STOP on
BEGIN;

-- 1. What the migration made, and nothing doubled by the second run.
SELECT bedt.ok('the table holds the two policies and no third',
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages') = 2);
SELECT bedt.ok('one is a read for the signed-in, one is a write for the signed-in, and both are permissive',
  (SELECT cmd = 'SELECT' AND roles = '{authenticated}' AND permissive = 'PERMISSIVE'
   FROM pg_policies WHERE schemaname = 'realtime' AND policyname = 'force_reload_signed_in_hear')
  AND (SELECT cmd = 'INSERT' AND roles = '{authenticated}' AND permissive = 'PERMISSIVE'
       FROM pg_policies WHERE schemaname = 'realtime' AND policyname = 'force_reload_dev_send'));

-- 2. Who sends.
SELECT bedt.ok('a dev sends the signal',
  bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000d1', 'force-reload'));
SELECT bedt.ok('a master cannot send it',
  NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000a1', 'force-reload'));
SELECT bedt.ok('an assistant cannot send it',
  NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000a2', 'force-reload'));
SELECT bedt.ok('a controller cannot send it',
  NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000a3', 'force-reload'));
SELECT bedt.ok('a subcontractor cannot send it',
  NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000a4', 'force-reload'));
SELECT bedt.ok('a signed-in person with no row in users cannot send it',
  NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000ff', 'force-reload'));
SELECT bedt.ok('a token that names nobody cannot send it',
  NOT bedt.sends('authenticated', NULL, 'force-reload'));
SELECT bedt.ok('nobody signed out sends it, and a dev''s id on a signed-out token changes nothing',
  NOT bedt.sends('anon', NULL, 'force-reload')
  AND NOT bedt.sends('anon', '00000000-0000-0000-0000-0000000000d1', 'force-reload'));

-- 3. Who hears.
SELECT bedt.ok('a dev, a master, an assistant, a controller and a subcontractor all hear it',
  bedt.hears('authenticated', '00000000-0000-0000-0000-0000000000d1', 'force-reload')
  AND bedt.hears('authenticated', '00000000-0000-0000-0000-0000000000a1', 'force-reload')
  AND bedt.hears('authenticated', '00000000-0000-0000-0000-0000000000a2', 'force-reload')
  AND bedt.hears('authenticated', '00000000-0000-0000-0000-0000000000a3', 'force-reload')
  AND bedt.hears('authenticated', '00000000-0000-0000-0000-0000000000a4', 'force-reload'));
SELECT bedt.ok('nobody signed out hears it',
  NOT bedt.hears('anon', NULL, 'force-reload')
  AND NOT bedt.hears('anon', '00000000-0000-0000-0000-0000000000d1', 'force-reload'));

-- 4. The two policies open this channel's broadcasts and nothing else.
SELECT bedt.ok('a dev can neither send on nor hear a private channel of another name',
  NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000d1', 'force-reload-2')
  AND NOT bedt.hears('authenticated', '00000000-0000-0000-0000-0000000000d1', 'force-reload-2')
  AND NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000d1', 'Force-Reload')
  AND NOT bedt.hears('authenticated', '00000000-0000-0000-0000-0000000000a1', 'jobs'));
SELECT bedt.ok('the channel carries broadcasts only: its presence is closed to a dev too',
  NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000d1', 'force-reload', 'presence')
  AND NOT bedt.hears('authenticated', '00000000-0000-0000-0000-0000000000d1', 'force-reload', 'presence'));

-- 5. The role a person holds now is what counts: a dev made a master stops sending, and a master made a dev starts.
UPDATE public.users SET role = 'master_technician' WHERE id = '00000000-0000-0000-0000-0000000000d1';
UPDATE public.users SET role = 'dev' WHERE id = '00000000-0000-0000-0000-0000000000a1';
SELECT bedt.ok('a person who is no longer a dev cannot send, and one who became a dev can',
  NOT bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000d1', 'force-reload')
  AND bedt.sends('authenticated', '00000000-0000-0000-0000-0000000000a1', 'force-reload'));

DO $$ BEGIN RAISE NOTICE 'global_reload_dev_only PASSED'; END $$;
ROLLBACK;
