SET lock_timeout = '3s';

-- A colleague's stale calling lock can be taken over (quirk 38 of docs/PROSPECTS_TABS_ARCHITECTURE.md).
--
-- A row of prospect_calling_locks says "this person is on this prospect right now". It is advisory: a live row held
-- by somebody else hides the prospect from the other callers' Follow Up deck, and it blocks nothing. A row older than
-- 30 minutes is stale (CALLING_LOCK_TTL_MS in src/lib/prospects/callingLock.ts): readers ignore it, and the next
-- caller is meant to take it over. The table has one row per prospect, so taking it over is an upsert on prospect_id,
-- which updates the old holder's row.
--
-- The update policy let a caller change only their own row, so the database refused that upsert with 42501 ("new row
-- violates row-level security policy (USING expression)"), proven on a whole-schema bed on 2026-11-19 as a second
-- signed-in caller. The client treats the lock as advisory and carried on with none, so on a prospect a colleague had
-- ever dialed and never released, nobody but that colleague could hold the lock again. Until v2.7656 no release was
-- ever sent, so every dial left such a row.
--
-- Two changes, both on this one table (23 rows on prod when this was written, every one of them stale):
--
--   1. The update policy also passes a row that is stale. USING reads the row as it stands: mine, or older than the
--      30 minutes, or with no time at all. WITH CHECK reads the row as written: it must be mine. So a caller can
--      take a stale row and can never write a row in somebody else's name, and a colleague's live row is still
--      refused, now by the database as well as by the client's own check. The 30 minutes here is the client's TTL;
--      src/lib/prospects/callingLock.test.ts holds the two together.
--   2. The rows already stale are deleted. Nothing reads a stale row, so nothing on screen changes.
--
-- The restrictive fences on the table (read-only, digital twin, archived) are untouched and still apply to every
-- update. No function, no new table, no grant changes. Idempotent: DROP POLICY IF EXISTS before the CREATE, and a
-- second run of the delete finds only what went stale since.

DROP POLICY IF EXISTS "Users can update their own prospect calling lock" ON public.prospect_calling_locks;
DROP POLICY IF EXISTS "Callers refresh their own calling lock or take a stale one" ON public.prospect_calling_locks;

CREATE POLICY "Callers refresh their own calling lock or take a stale one"
  ON public.prospect_calling_locks
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR locked_at IS NULL
    OR locked_at < now() - interval '30 minutes'
  )
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON POLICY "Callers refresh their own calling lock or take a stale one" ON public.prospect_calling_locks IS
  'A caller updates their own row, or takes over one older than 30 minutes (CALLING_LOCK_TTL_MS in the client); the row written must be their own. A colleague''s live row is never overwritten.';

DELETE FROM public.prospect_calling_locks
 WHERE locked_at IS NULL
    OR locked_at < now() - interval '30 minutes';
