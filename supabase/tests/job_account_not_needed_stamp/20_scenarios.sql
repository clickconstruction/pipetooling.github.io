-- Scenarios for 20261115230000_job_account_not_needed_stamp.sql: who marked a job's account not
-- needed, and when. Each block raises on its first failed assertion; the file ends with
-- "… PASSED". t_as(person) signs a person in for the transaction, as PostgREST does on prod.

CREATE OR REPLACE FUNCTION public.t_as(p uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p::text, ''), true)
$$;

-- 1 · The rows marked before the migration: the not-needed one takes its last write as its
--     day and nobody as its marker, and its updated_at is the time it was; the open one takes none.
DO $$
DECLARE r public.job_supply_house_accounts;
BEGIN
  SELECT * INTO r FROM public.job_supply_house_accounts WHERE supply_house_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  ASSERT r.not_needed_at = '2026-10-07 22:13:03+00', format('1a: the old row''s day is its last write, got %s', r.not_needed_at);
  ASSERT r.not_needed_by IS NULL, '1b: nobody is named on a row marked before the stamp';
  ASSERT r.updated_at = '2026-10-07 22:13:03+00', format('1c: the backfill left updated_at alone, got %s', r.updated_at);
  SELECT * INTO r FROM public.job_supply_house_accounts WHERE supply_house_id = 'aaaaaaaa-0000-4000-8000-000000000002';
  ASSERT r.not_needed_at IS NULL AND r.not_needed_by IS NULL, '1d: an open row carries no not-needed stamp';
  ASSERT r.updated_at = '2026-10-07 22:13:03+00', '1e: the open row was not touched';
END $$;

-- 2 · Tess marks a house not needed: her name and now. A stamp the client sends is not kept.
DO $$
DECLARE r public.job_supply_house_accounts;
BEGIN
  PERFORM public.t_as('00000000-0000-4000-8000-000000000002');
  INSERT INTO public.job_supply_house_accounts (job_id, supply_house_id, status, note, not_needed_by, not_needed_at)
  VALUES ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'not_needed', 'Service call',
          '00000000-0000-4000-8000-000000000001', '2020-01-01 00:00:00+00')
  RETURNING * INTO r;
  ASSERT r.not_needed_by = '00000000-0000-4000-8000-000000000002', '2a: the marker is the signed-in person, not the one sent';
  ASSERT r.not_needed_at = now(), '2b: the day is now, not the one sent';
  ASSERT r.requested_by IS NULL AND r.opened_by IS NULL, '2c: a not-needed row stamps neither of the other pairs';
END $$;

-- 3 · A write that changes neither the status nor the reason keeps the stamp, whoever makes it
--     and whatever they send.
DO $$
DECLARE was public.job_supply_house_accounts; r public.job_supply_house_accounts;
BEGIN
  SELECT * INTO was FROM public.job_supply_house_accounts WHERE job_id = '11111111-0000-4000-8000-000000000002';
  PERFORM public.t_as('00000000-0000-4000-8000-000000000001');
  UPDATE public.job_supply_house_accounts
     SET account_ref = 'x', not_needed_by = '00000000-0000-4000-8000-000000000001', not_needed_at = '2020-01-01 00:00:00+00'
   WHERE id = was.id
  RETURNING * INTO r;
  ASSERT r.not_needed_by = '00000000-0000-4000-8000-000000000002', '3a: the marker stays Tess';
  ASSERT r.not_needed_at = was.not_needed_at, '3b: the day stays the day she marked it';
END $$;

-- 4 · The Mark opened window's upsert with a new reason: the stamp moves to who changed it.
DO $$
DECLARE r public.job_supply_house_accounts;
BEGIN
  PERFORM public.t_as('00000000-0000-4000-8000-000000000001');
  INSERT INTO public.job_supply_house_accounts (job_id, supply_house_id, status, account_ref, opened_via, rep_contact_id, note)
  VALUES ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'not_needed', '', NULL, NULL, 'Builder’s own account')
  ON CONFLICT (job_id, supply_house_id) DO UPDATE
    SET status = EXCLUDED.status, account_ref = EXCLUDED.account_ref, opened_via = EXCLUDED.opened_via,
        rep_contact_id = EXCLUDED.rep_contact_id, note = EXCLUDED.note
  RETURNING * INTO r;
  ASSERT r.note = 'Builder’s own account', '4a: the reason changed';
  ASSERT r.not_needed_by = '00000000-0000-4000-8000-000000000001', '4b: the marker is who changed the reason';
  ASSERT r.not_needed_at = now(), '4c: the day is the change';
END $$;

-- 5 · The old one-press row gets a real reason: the stamp is no longer the backfill's.
DO $$
DECLARE r public.job_supply_house_accounts;
BEGIN
  PERFORM public.t_as('00000000-0000-4000-8000-000000000002');
  UPDATE public.job_supply_house_accounts SET note = 'Service call'
   WHERE job_id = '11111111-0000-4000-8000-000000000001' AND supply_house_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  RETURNING * INTO r;
  ASSERT r.not_needed_by = '00000000-0000-4000-8000-000000000002' AND r.not_needed_at = now(), '5: a reason given to an old row names who gave it and when';
END $$;

-- 6 · Marked opened: the not-needed stamp goes, the opened pair is filled. Marked not needed
--     again: a new stamp.
DO $$
DECLARE r public.job_supply_house_accounts;
BEGIN
  PERFORM public.t_as('00000000-0000-4000-8000-000000000002');
  UPDATE public.job_supply_house_accounts SET status = 'open', opened_via = 'phone', note = ''
   WHERE job_id = '11111111-0000-4000-8000-000000000002'
  RETURNING * INTO r;
  ASSERT r.not_needed_by IS NULL AND r.not_needed_at IS NULL, '6a: an opened row carries no not-needed stamp';
  ASSERT r.opened_by = '00000000-0000-4000-8000-000000000002' AND r.opened_at = now(), '6b: the opened pair is stamped as before';
  PERFORM public.t_as('00000000-0000-4000-8000-000000000001');
  UPDATE public.job_supply_house_accounts SET status = 'not_needed', note = 'House said no'
   WHERE id = r.id
  RETURNING * INTO r;
  ASSERT r.not_needed_by = '00000000-0000-4000-8000-000000000001' AND r.not_needed_at = now(), '6c: marked not needed again, stamped again';
END $$;

-- 7 · A requested row carries no not-needed stamp, even when one is sent; its own pair is as before.
DO $$
DECLARE r public.job_supply_house_accounts;
BEGIN
  PERFORM public.t_as('00000000-0000-4000-8000-000000000004');
  INSERT INTO public.job_supply_house_accounts (job_id, supply_house_id, status, not_needed_by, not_needed_at)
  VALUES ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 'requested',
          '00000000-0000-4000-8000-000000000004', now())
  RETURNING * INTO r;
  ASSERT r.not_needed_by IS NULL AND r.not_needed_at IS NULL, '7a: a requested row carries no not-needed stamp';
  ASSERT r.requested_by = '00000000-0000-4000-8000-000000000004' AND r.requested_at = now(), '7b: the requested pair is stamped as before';
END $$;

-- 8 · Nobody signed in (a migration, the service role): the day is kept, the marker is nobody.
DO $$
DECLARE r public.job_supply_house_accounts;
BEGIN
  PERFORM public.t_as(NULL);
  INSERT INTO public.job_supply_house_accounts (job_id, supply_house_id, status, note)
  VALUES ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000003', 'not_needed', 'Insurer pays the house')
  RETURNING * INTO r;
  ASSERT r.not_needed_by IS NULL AND r.not_needed_at = now(), '8: no session, no marker, the day still kept';
END $$;

-- 9 · The strip hands the crew the day and the marker's name; a house with no row, an open row
--     and a marker with a blank name answer null; the fifteen columns before them are as before.
DO $$
DECLARE r record; n int;
BEGIN
  PERFORM public.t_as('00000000-0000-4000-8000-000000000004');
  SELECT count(*) INTO n FROM public.list_job_account_strip(ARRAY['11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002']::uuid[]);
  ASSERT n = 6, format('9a: three houses on each of two jobs, got %s', n);

  SELECT * INTO r FROM public.list_job_account_strip(ARRAY['11111111-0000-4000-8000-000000000001']::uuid[]) WHERE house_name = 'Bluebonnet Supply';
  ASSERT r.status = 'not_needed' AND r.account_note = 'Service call', '9b: the row and its reason';
  ASSERT r.not_needed_by_name = 'Office Tess' AND r.not_needed_at IS NOT NULL, format('9c: the marker''s name and the day, got %s', r.not_needed_by_name);

  SELECT * INTO r FROM public.list_job_account_strip(ARRAY['11111111-0000-4000-8000-000000000001']::uuid[]) WHERE house_name = 'Cedar Pipe';
  ASSERT r.status = 'open' AND r.opened_via = 'phone' AND r.not_needed_at IS NULL AND r.not_needed_by_name IS NULL, '9d: an open row, no stamp';

  SELECT * INTO r FROM public.list_job_account_strip(ARRAY['11111111-0000-4000-8000-000000000001']::uuid[]) WHERE house_name = 'Mesquite Supply';
  ASSERT r.account_id IS NULL AND r.status IS NULL AND r.not_needed_at IS NULL AND r.not_needed_by_name IS NULL, '9e: none yet, no stamp';

  SELECT * INTO r FROM public.list_job_account_strip(ARRAY['11111111-0000-4000-8000-000000000002']::uuid[]) WHERE house_name = 'Mesquite Supply';
  ASSERT r.status = 'not_needed' AND r.not_needed_at IS NOT NULL AND r.not_needed_by_name IS NULL, '9f: marked with no session: the day, no name';

  -- A marker whose name is blank reads as no name.
  PERFORM public.t_as('00000000-0000-4000-8000-000000000005');
  UPDATE public.job_supply_house_accounts SET note = 'Warranty' WHERE job_id = '11111111-0000-4000-8000-000000000002' AND supply_house_id = 'aaaaaaaa-0000-4000-8000-000000000003';
  SELECT * INTO r FROM public.list_job_account_strip(ARRAY['11111111-0000-4000-8000-000000000002']::uuid[]) WHERE house_name = 'Mesquite Supply';
  ASSERT r.not_needed_by_name IS NULL AND r.not_needed_at IS NOT NULL, '9g: a blank name answers null';

  -- An estimator reads no strip for a job with no bid, as before.
  PERFORM public.t_as('00000000-0000-4000-8000-000000000003');
  SELECT count(*) INTO n FROM public.list_job_account_strip(ARRAY['11111111-0000-4000-8000-000000000001']::uuid[]);
  ASSERT n = 0, format('9h: the gate holds, got %s', n);
END $$;

-- 10 · The grants are the ones the function had: signed-in people and the service role, nobody else.
DO $$
BEGIN
  ASSERT has_function_privilege('authenticated', 'public.list_job_account_strip(uuid[])', 'EXECUTE'), '10a: authenticated may call the strip';
  ASSERT has_function_privilege('service_role', 'public.list_job_account_strip(uuid[])', 'EXECUTE'), '10b: the service role may call the strip';
  ASSERT NOT has_function_privilege('anon', 'public.list_job_account_strip(uuid[])', 'EXECUTE'), '10c: anon may not';
END $$;

DO $$ BEGIN RAISE NOTICE 'job_account_not_needed_stamp scenarios PASSED'; END $$;
