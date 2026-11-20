
-- The takeover probe (quirk 38 of docs/PROSPECTS_TABS_ARCHITECTURE.md, migration *_calling_lock_stale_takeover). It runs
-- inside the transaction 10_seed.sql opened, after the migration's second run. It reads what that run left, then signs
-- in as each caller and tries the locks the way the app does: the upsert on prospect_id that takeCallingLock sends.
-- Fixtures are written as postgres; the tries run as each account under RLS; everything rolls back. Raises on the
-- first failed assertion; ends with "calling_lock_takeover PASSED". Never against prod.
\set ON_ERROR_STOP 1

CREATE SCHEMA lockbed;
GRANT USAGE ON SCHEMA lockbed TO authenticated, anon;
CREATE FUNCTION lockbed.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION lockbed.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION lockbed.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
CREATE FUNCTION lockbed.p(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000000c10b' || n)::uuid $$;
CREATE FUNCTION lockbed.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000000c10a' || n)::uuid $$;
-- The app's take: upsert on prospect_id, in the name given (the caller's own unless a test says otherwise).
-- 'taken', or 'refused' with the sqlstate.
CREATE FUNCTION lockbed.take(n int, p_as uuid DEFAULT auth.uid()) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.prospect_calling_locks (prospect_id, user_id, locked_at) VALUES (lockbed.p(n), p_as, now())
  ON CONFLICT (prospect_id) DO UPDATE SET user_id = EXCLUDED.user_id, locked_at = EXCLUDED.locked_at;
  RETURN 'taken';
EXCEPTION WHEN OTHERS THEN
  RETURN 'refused ' || SQLSTATE;
END $$;
-- A bare update of a row, keeping or changing the name on it. The rows it changed, or 'refused' with the sqlstate.
CREATE FUNCTION lockbed.restamp(n int, p_name uuid DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE c bigint;
BEGIN
  UPDATE public.prospect_calling_locks SET locked_at = now(), user_id = COALESCE(p_name, user_id) WHERE prospect_id = lockbed.p(n);
  GET DIAGNOSTICS c = ROW_COUNT;
  RETURN c::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'refused ' || SQLSTATE;
END $$;
CREATE FUNCTION lockbed.release(n int) RETURNS text LANGUAGE plpgsql AS $$
DECLARE c bigint;
BEGIN
  DELETE FROM public.prospect_calling_locks WHERE prospect_id = lockbed.p(n);
  GET DIAGNOSTICS c = ROW_COUNT;
  RETURN c::text;
EXCEPTION WHEN OTHERS THEN
  RETURN 'refused ' || SQLSTATE;
END $$;
-- Who holds a prospect's lock and whether it is live, as any caller reads it.
CREATE FUNCTION lockbed.holder(n int) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE((
    SELECT (SELECT split_part(u.name, ' ', 1) FROM public.users u WHERE u.id = l.user_id)
           || CASE WHEN l.locked_at >= now() - interval '30 minutes' THEN ' live' ELSE ' stale' END
      FROM public.prospect_calling_locks l WHERE l.prospect_id = lockbed.p(n)), 'nobody')
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lockbed TO authenticated, anon;

-- ---------- What the migration's second run left ----------

SELECT lockbed.same('the table has one update policy of its own, the new one, for signed-in callers', (
  SELECT string_agg(policyname || ' ' || roles::text, ' | ' ORDER BY policyname)
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'prospect_calling_locks' AND cmd = 'UPDATE' AND permissive = 'PERMISSIVE'),
  'Callers refresh their own calling lock or take a stale one {authenticated}');
SELECT lockbed.same('the fences on updates still stand', (
  SELECT string_agg(policyname, ' | ' ORDER BY policyname)
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'prospect_calling_locks' AND permissive = 'RESTRICTIVE' AND cmd IN ('UPDATE', 'ALL')),
  'archived_fence | digital_twin_write_fence_update | read_only_users_cannot_update');
SELECT lockbed.same('the migration deleted the row three weeks old', lockbed.holder(1), 'nobody');
SELECT lockbed.same('the migration deleted the row with no time', lockbed.holder(2), 'nobody');
SELECT lockbed.same('the migration kept the live row', lockbed.holder(3), 'Ann live');

-- ---------- The tries ----------

-- Ann's rows as a second caller meets them: long stale, no time, just past the 30 minutes, just inside them.
INSERT INTO public.prospect_calling_locks (prospect_id, user_id, locked_at) VALUES
  (lockbed.p(1), lockbed.u(1), now() - interval '21 days'),
  (lockbed.p(2), lockbed.u(1), NULL),
  (lockbed.p(4), lockbed.u(1), now() - interval '31 minutes'),
  (lockbed.p(5), lockbed.u(1), now() - interval '29 minutes'),
  (lockbed.p(6), lockbed.u(1), now() - interval '2 days');

SELECT lockbed.sign_in(lockbed.u(2));
SET LOCAL ROLE authenticated;
SELECT lockbed.same('Bo takes over a lock three weeks old', lockbed.take(1), 'taken');
SELECT lockbed.same('and it is Bo''s, live', lockbed.holder(1), 'Bo live');
SELECT lockbed.same('Bo takes over a lock with no time', lockbed.take(2), 'taken');
SELECT lockbed.same('Bo takes over a lock 31 minutes old', lockbed.take(4), 'taken');
SELECT lockbed.same('Bo is refused a lock 29 minutes old', lockbed.take(5), 'refused 42501');
SELECT lockbed.same('and it is still Ann''s', lockbed.holder(5), 'Ann live');
SELECT lockbed.same('Bo is refused Ann''s live lock', lockbed.take(3), 'refused 42501');
SELECT lockbed.same('Bo takes a prospect nobody holds', lockbed.take(7), 'taken');
SELECT lockbed.same('Bo refreshes his own lock', lockbed.take(1), 'taken');
SELECT lockbed.same('Bo cannot restamp Ann''s stale lock in Ann''s name', lockbed.restamp(6), 'refused 42501');
SELECT lockbed.same('Bo cannot hand Ann''s stale lock to Di', lockbed.restamp(6, lockbed.u(4)), 'refused 42501');
SELECT lockbed.same('Bo cannot take a free prospect in Ann''s name', lockbed.take(6, lockbed.u(1)), 'refused 42501');
SELECT lockbed.same('the stale lock nobody could misuse is still Ann''s', lockbed.holder(6), 'Ann stale');
SELECT lockbed.same('Bo cannot delete Ann''s stale lock', lockbed.release(6), '0');
SELECT lockbed.same('Bo releases his own', lockbed.release(7), '1');
RESET ROLE;

-- Ann comes back: her old prospect is Bo's now, and live.
SELECT lockbed.sign_in(lockbed.u(1));
SET LOCAL ROLE authenticated;
SELECT lockbed.same('Ann is refused the lock Bo took over', lockbed.take(1), 'refused 42501');
SELECT lockbed.same('Ann refreshes her own stale lock', lockbed.take(6), 'taken');
RESET ROLE;

-- The fences. Ann's row on prospect 6 goes stale again first.
UPDATE public.prospect_calling_locks SET locked_at = now() - interval '2 days' WHERE prospect_id = lockbed.p(6);
SELECT lockbed.sign_in(lockbed.u(3));
SET LOCAL ROLE authenticated;
SELECT lockbed.same('an archived caller takes nothing', left(lockbed.take(6), 7), 'refused');
RESET ROLE;
SELECT lockbed.sign_in(lockbed.u(4));
SET LOCAL ROLE authenticated;
SELECT lockbed.same('a read-only caller takes nothing', left(lockbed.take(6), 7), 'refused');
RESET ROLE;
SELECT lockbed.sign_out();
SET LOCAL ROLE anon;
SELECT lockbed.same('a signed-out visitor takes nothing', left(lockbed.take(6, lockbed.u(1)), 7), 'refused');
SELECT lockbed.same('a signed-out visitor updates no row', lockbed.restamp(6), '0');
RESET ROLE;
SELECT lockbed.same('after the fences the stale lock is still Ann''s', lockbed.holder(6), 'Ann stale');

SELECT 'calling_lock_takeover PASSED';
ROLLBACK;
