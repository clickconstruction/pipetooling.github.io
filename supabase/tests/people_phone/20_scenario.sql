-- The roster's numbers from each person's account (v2.5551, migration *_people_phone_from_account): a roster row with a
-- blank phone takes its account's phone, once for every row (people_phones_from_accounts) and from then on when an
-- account gains or changes its phone or a roster row gains an account; a phone typed on the roster is never written
-- over; a sample's or a twin's account fills nothing; an archived account's phone still counts. Written as postgres
-- (RLS off); everything rolls back. Raises on the first failed assertion; ends with "people_phone PASSED". See
-- scripts/pgtest-people-phone.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA pph;
CREATE FUNCTION pph.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The roster's phones, by name.
CREATE FUNCTION pph.phones() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(name || '=' || coalesce(phone, '-'), ', ' ORDER BY name) FROM public.people WHERE master_user_id = '00000000-0000-0000-0000-0000000009d1'
$$;

-- The accounts: a dev who owns the roster; a helper with a phone, one without, an archived sub with a phone, a sample
-- and a twin with phones.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@phone.test'),
  ('00000000-0000-0000-0000-0000000009a1', 'with@phone.test'),
  ('00000000-0000-0000-0000-0000000009a2', 'without@phone.test'),
  ('00000000-0000-0000-0000-0000000009a3', 'gone@phone.test'),
  ('00000000-0000-0000-0000-0000000009a4', 'sample@phone.test'),
  ('00000000-0000-0000-0000-0000000009a5', 'twin@phone.test');
INSERT INTO public.users (id, email, name, role, phone, archived_at, is_sample, is_digital_twin, read_only) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@phone.test', 'Phone Dev', 'dev', NULL, NULL, false, false, false),
  ('00000000-0000-0000-0000-0000000009a1', 'with@phone.test', 'Will With', 'helpers', ' (512) 555-0147 ', NULL, false, false, false),
  ('00000000-0000-0000-0000-0000000009a2', 'without@phone.test', 'Nat Without', 'helpers', NULL, NULL, false, false, false),
  ('00000000-0000-0000-0000-0000000009a3', 'gone@phone.test', 'Gus Gone', 'subcontractor', '(512) 555-0148', now(), false, false, false),
  ('00000000-0000-0000-0000-0000000009a4', 'sample@phone.test', 'Sam Sample', 'helpers', '(512) 555-0149', NULL, true, false, false),
  ('00000000-0000-0000-0000-0000000009a5', 'twin@phone.test', 'Tim Twin', 'helpers', '(512) 555-0150', NULL, false, true, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, phone = EXCLUDED.phone, archived_at = EXCLUDED.archived_at,
    is_sample = EXCLUDED.is_sample, is_digital_twin = EXCLUDED.is_digital_twin, read_only = EXCLUDED.read_only;

-- 1 · The roster as it stood before today: rows linked to those accounts with no phone, one with its own, one with no
-- account. The people trigger is off while they are made, as the rows made before the migration were.
ALTER TABLE public.people DISABLE TRIGGER people_phone_from_account;
INSERT INTO public.people (id, master_user_id, kind, name, phone, account_user_id) VALUES
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009d1', 'helper', 'Will With', NULL, '00000000-0000-0000-0000-0000000009a1'),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009d1', 'helper', 'Nat Without', NULL, '00000000-0000-0000-0000-0000000009a2'),
  ('00000000-0000-0000-0000-0000000009b3', '00000000-0000-0000-0000-0000000009d1', 'sub', 'Gus Gone', '  ', '00000000-0000-0000-0000-0000000009a3'),
  ('00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009d1', 'helper', 'Sam Sample', NULL, '00000000-0000-0000-0000-0000000009a4'),
  ('00000000-0000-0000-0000-0000000009b5', '00000000-0000-0000-0000-0000000009d1', 'helper', 'Tim Twin', NULL, '00000000-0000-0000-0000-0000000009a5'),
  ('00000000-0000-0000-0000-0000000009b6', '00000000-0000-0000-0000-0000000009d1', 'helper', 'Own Number', '(830) 555-0101', '00000000-0000-0000-0000-0000000009a1'),
  ('00000000-0000-0000-0000-0000000009b7', '00000000-0000-0000-0000-0000000009d1', 'sub', 'No Account', NULL, NULL);
ALTER TABLE public.people ENABLE TRIGGER people_phone_from_account;
SELECT pph.same('before: nothing filled', pph.phones(), 'Gus Gone=  , Nat Without=-, No Account=-, Own Number=(830) 555-0101, Sam Sample=-, Tim Twin=-, Will With=-');
SELECT pph.same('once, for the roster as it stands: two rows fill, trimmed, the archived account''s too', public.people_phones_from_accounts()::text, '2');
SELECT pph.same('and nobody the second time', public.people_phones_from_accounts()::text, '0');
SELECT pph.same('after: the account''s phone where the roster had none; a sample, a twin and an own number untouched', pph.phones(),
  'Gus Gone=(512) 555-0148, Nat Without=-, No Account=-, Own Number=(830) 555-0101, Sam Sample=-, Tim Twin=-, Will With=(512) 555-0147');

-- 2 · From here on: an account that gains a phone fills its roster rows' blank phone, and not one typed on the roster.
UPDATE public.users SET phone = '(737) 555-0102' WHERE id = '00000000-0000-0000-0000-0000000009a2';
UPDATE public.users SET phone = '(737) 555-0103' WHERE id = '00000000-0000-0000-0000-0000000009a1';
SELECT pph.same('the account''s new phone fills the blank row; a row with a phone keeps it',
  (SELECT string_agg(name || '=' || coalesce(phone, '-'), ', ' ORDER BY name) FROM public.people WHERE name IN ('Nat Without', 'Will With', 'Own Number')),
  'Nat Without=(737) 555-0102, Own Number=(830) 555-0101, Will With=(512) 555-0147');
UPDATE public.users SET phone = '(737) 555-0104' WHERE id = '00000000-0000-0000-0000-0000000009a4';
SELECT pph.same('a sample''s phone fills nothing', (SELECT coalesce(phone, '-') FROM public.people WHERE id = '00000000-0000-0000-0000-0000000009b4'), '-');

-- 3 · A roster row that gains an account takes the account's phone when it has none; one made with its own keeps it;
-- clearing a phone on the roster is left alone.
UPDATE public.people SET account_user_id = '00000000-0000-0000-0000-0000000009a2' WHERE id = '00000000-0000-0000-0000-0000000009b7';
SELECT pph.same('a row that gains an account takes its phone', (SELECT phone FROM public.people WHERE id = '00000000-0000-0000-0000-0000000009b7'), '(737) 555-0102');
INSERT INTO public.people (id, master_user_id, kind, name, phone, account_user_id) VALUES
  ('00000000-0000-0000-0000-0000000009b8', '00000000-0000-0000-0000-0000000009d1', 'helper', 'New Hire', NULL, '00000000-0000-0000-0000-0000000009a1'),
  ('00000000-0000-0000-0000-0000000009b9', '00000000-0000-0000-0000-0000000009d1', 'helper', 'New Typed', '(830) 555-0105', '00000000-0000-0000-0000-0000000009a1');
SELECT pph.same('a new row with an account takes its phone; one made with its own keeps it',
  (SELECT string_agg(name || '=' || phone, ', ' ORDER BY name) FROM public.people WHERE name IN ('New Hire', 'New Typed')), 'New Hire=(737) 555-0103, New Typed=(830) 555-0105');
UPDATE public.people SET phone = NULL WHERE id = '00000000-0000-0000-0000-0000000009b1';
SELECT pph.same('a phone cleared on the roster stays cleared', (SELECT coalesce(phone, '-') FROM public.people WHERE id = '00000000-0000-0000-0000-0000000009b1'), '-');

-- 4 · Nobody signed in calls the once-over or the triggers' functions.
SELECT pph.same('the functions are the database''s own',
  (SELECT string_agg(p.proname || '=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text, ', ' ORDER BY p.proname)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('people_phones_from_accounts', 'people_phone_from_account_on_users', 'people_phone_from_account_on_people')),
  'people_phone_from_account_on_people=false, people_phone_from_account_on_users=false, people_phones_from_accounts=false');

DO $$ BEGIN RAISE NOTICE 'people_phone PASSED'; END $$;
ROLLBACK;
