SET lock_timeout = '3s';

-- A sticker remembers when its strips last came out of the printer (punch list #373; the owner's words of 2026-11-16
-- on Print future stickers: "add Recording that a run's strips came out. It needs a new column").
--
-- The app reserves a run of stickers at the press (mint_sticker_run), before any strip leaves the printer, and kept
-- no record that one did. sticker_runs.printed_at is NOT NULL DEFAULT now(): the moment the run was made. A printer
-- that fails, a stop, a closed window or a cancelled print dialog all leave stickers with no strip, and every screen
-- still read "Printed Nov 16 by Dana". The twin of job_containers.label_printed_at (20261117110000), on a sticker.
--
-- One column on the sticker. NULL means the app has not seen this sticker's strips go out. A time means it has: the
-- moment the last copy of its strip left the P-touch, or the print window closed on it. A sticker made before this
-- column cannot be told apart from one that is waiting, so the client counts a NULL as "not printed yet" only for a
-- sticker made after the mark began, and says nothing about the older ones until they print.
--
-- How it is written. No client writes box_stickers: it has a SELECT policy and no other, and a sticker moves only
-- through a box_sticker_events row whose definer trigger updates it. The mark is the one column a client changes,
-- the way sticker_runs.job_id is the one column of a run (20261113020000, section 7):
--
--   1. Table-level UPDATE is taken from anon and authenticated and given back on printed_at alone, so the new policy
--      opens this column and no other. The events trigger, the mint trigger and the foreign key's SET NULL run as the
--      table's owner and are not touched by the revoke.
--   2. box_stickers_update, the SELECT policy's own predicate in USING and WITH CHECK: a sticker on a box follows
--      its box's job, a reserved one its run's job, both through on_site_can_touch_job, which stays SECURITY INVOKER
--      and so judges the caller. No definer function writes the mark: one would judge its owner instead.
--   3. box_stickers_stamp_printed, BEFORE UPDATE OF printed_at: from a direct caller (current_user is authenticated
--      or anon, the on-site guards' own test, 20261114013000) a time that is not null becomes now(), so a client
--      cannot write a day of its own. NULL is let through: a person saying the strips did not print after all.
--
-- The read-only blocks, the twin fence and the archived seal already stand on box_stickers, so a training account, a
-- digital twin and an archived caller leave no mark.
--
-- Additive and idempotent. A nullable column with no default is a catalog change alone: no row is rewritten. No
-- CREATE TABLE, so no fence calls. Nothing reads or writes the column until the client that follows, and that client
-- must not merge before this is pushed: it names the column in the read of every sticker.

ALTER TABLE public.box_stickers
  ADD COLUMN IF NOT EXISTS printed_at timestamptz;

COMMENT ON COLUMN public.box_stickers.printed_at IS 'Stickers (#373): when this sticker''s strips last came out, by the P-touch or by the print window closing on it. NULL: the app has not seen it printed. The server''s own time, whatever a client sends. Cleared when a person says the strips did not print.';
COMMENT ON TABLE public.box_stickers IS 'Stickers before boxes (#329): a printed sticker. It points at one box (container_id) or at nothing yet (blank). It changes only through a box_sticker_events row, but for printed_at (#373), the one column a client writes.';

-- 1. The one column a client may change.
REVOKE UPDATE ON public.box_stickers FROM anon;
REVOKE UPDATE ON public.box_stickers FROM authenticated;
GRANT UPDATE (printed_at) ON public.box_stickers TO authenticated;

-- Fail loudly if the grants are not what the policy below relies on: a REVOKE run by a role without the owner's
-- rights only warns, and this migration would record as applied with every column of a sticker open to its job.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.box_stickers', 'UPDATE') OR has_table_privilege('anon', 'public.box_stickers', 'UPDATE') THEN
    RAISE EXCEPTION 'box_stickers is still updatable as a whole table: the REVOKE did not take effect';
  END IF;
  IF has_column_privilege('authenticated', 'public.box_stickers', 'container_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.box_stickers', 'lost_at', 'UPDATE')
     OR has_column_privilege('anon', 'public.box_stickers', 'printed_at', 'UPDATE') THEN
    RAISE EXCEPTION 'box_stickers has a column open that should not be';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.box_stickers', 'printed_at', 'UPDATE') THEN
    RAISE EXCEPTION 'box_stickers.printed_at is not updatable by authenticated: the GRANT did not take effect';
  END IF;
END $$;

-- 2. Who: whoever reads the sticker. The SELECT policy's predicate, word for word.
DROP POLICY IF EXISTS box_stickers_update ON public.box_stickers;
CREATE POLICY box_stickers_update ON public.box_stickers FOR UPDATE TO authenticated
  USING (
    (container_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = container_id AND public.on_site_can_touch_job(c.job_id)))
    OR (container_id IS NULL AND EXISTS (
      SELECT 1 FROM public.sticker_runs r
      WHERE r.id = run_id AND (public.on_site_can_touch_job(r.job_id) OR (r.job_id IS NULL AND public.is_office_staff()))
    ))
  )
  WITH CHECK (
    (container_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = container_id AND public.on_site_can_touch_job(c.job_id)))
    OR (container_id IS NULL AND EXISTS (
      SELECT 1 FROM public.sticker_runs r
      WHERE r.id = run_id AND (public.on_site_can_touch_job(r.job_id) OR (r.job_id IS NULL AND public.is_office_staff()))
    ))
  );

-- 3. When: the server's. A direct caller's time is replaced; the service role and a definer pass untouched.
CREATE OR REPLACE FUNCTION public.box_stickers_stamp_printed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.printed_at IS NOT NULL THEN
    NEW.printed_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.box_stickers_stamp_printed() IS 'Stickers (#373): BEFORE UPDATE OF printed_at on box_stickers. From a direct caller a time that is not null becomes the server''s now(); NULL, the mark taken back off, is let through.';
REVOKE EXECUTE ON FUNCTION public.box_stickers_stamp_printed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.box_stickers_stamp_printed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.box_stickers_stamp_printed() FROM authenticated;
CREATE OR REPLACE TRIGGER box_stickers_stamp_printed BEFORE UPDATE OF printed_at ON public.box_stickers
  FOR EACH ROW EXECUTE FUNCTION public.box_stickers_stamp_printed();
