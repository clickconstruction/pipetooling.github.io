SET lock_timeout = '3s';

-- Messages, cut 10 (photos saved on arrival, v2.5457): a job's tick to save its photos to Drive, and the mark on a text's
-- picture we could not copy.
--
--   1) photo_saves: one row per job whose office ticked *Save every photo on this job to Drive as it comes in* (the
--      prototype's quo-messages-mockup.html draft 9, on branch spike/gc-mode). A job is a bid, a GC project or a Pipeline
--      job, one of the three, as the spine ties a line. The tick starts off on every job: no row is off (the lead,
--      2026-10-13). on_since is when it went on, null once it went off again, so the photo-save sweep copies only a
--      photo that came after it went on. The office team reads the ticks and changes one only through set_photo_save,
--      which stamps who and when; training mode and a twin cannot. The sweep reads them as the service role.
--   2) message_attachments.left_in_gmail takes 'quo_not_copied': a picture or a file on a text the quo-webhook could not
--      copy, which Quo's own history still holds (src/lib/quo/mediaKeep.ts). 'not_copied' stays an email's, which reads
--      as still in Gmail.
-- A new table, so the three house calls end it. See docs/migrations/20261014070000_photo_saves.md.

-- 1) The ticks.
CREATE TABLE IF NOT EXISTS public.photo_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The job, one of the three, as the spine ties a line.
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- When the tick went on; null while it is off.
  on_since timestamptz,
  -- Who last turned it on or off, and when.
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT photo_saves_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) = 1)
);

COMMENT ON TABLE public.photo_saves IS
  'Messages (cut 10, v2.5457): a job''s tick, Save every photo on this job to Drive as it comes in. One row per job (a bid, a GC project or a Pipeline job); no row is off, as every job starts. on_since is when it went on, null once off, and the photo-save sweep copies a photo that came in on a line tied to the job after it. The office team reads; set_photo_save writes, stamped.';

CREATE UNIQUE INDEX IF NOT EXISTS photo_saves_bid ON public.photo_saves (bid_id) WHERE bid_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS photo_saves_project ON public.photo_saves (project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS photo_saves_jobs_ledger ON public.photo_saves (jobs_ledger_id) WHERE jobs_ledger_id IS NOT NULL;

ALTER TABLE public.photo_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photo_saves_office_reads ON public.photo_saves;
CREATE POLICY photo_saves_office_reads ON public.photo_saves FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()));

REVOKE ALL ON TABLE public.photo_saves FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.photo_saves FROM authenticated;
GRANT SELECT ON TABLE public.photo_saves TO authenticated;
GRANT ALL ON TABLE public.photo_saves TO service_role;

-- The office's press: a job's tick on or off. On keeps the day it first went on; off clears it. Returns on_since.
CREATE OR REPLACE FUNCTION public.set_photo_save(p_bid_id uuid, p_project_id uuid, p_jobs_ledger_id uuid, p_on boolean)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_since timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change a job''s photos.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office changes where a job''s photos go.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot change where a job''s photos go.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot change where a job''s photos go.' USING ERRCODE = '42501';
  END IF;
  IF num_nonnulls(p_bid_id, p_project_id, p_jobs_ledger_id) <> 1 THEN
    RAISE EXCEPTION 'Name one job: a bid, a GC project or a Pipeline job.' USING ERRCODE = '22023';
  END IF;
  IF p_on IS NULL THEN
    RAISE EXCEPTION 'Say on or off.' USING ERRCODE = '22023';
  END IF;

  SELECT s.id, s.on_since INTO v_id, v_since
  FROM public.photo_saves s
  WHERE s.bid_id IS NOT DISTINCT FROM p_bid_id
    AND s.project_id IS NOT DISTINCT FROM p_project_id
    AND s.jobs_ledger_id IS NOT DISTINCT FROM p_jobs_ledger_id
  FOR UPDATE;

  IF v_id IS NULL THEN
    -- Off is every job's start: turning off a job never ticked writes nothing.
    IF NOT p_on THEN
      RETURN NULL;
    END IF;
    INSERT INTO public.photo_saves (bid_id, project_id, jobs_ledger_id, on_since, set_by)
    VALUES (p_bid_id, p_project_id, p_jobs_ledger_id, clock_timestamp(), auth.uid())
    RETURNING on_since INTO v_since;
    RETURN v_since;
  END IF;

  -- The same press twice changes nothing: on stays on since it first went on, off stays off.
  IF p_on = (v_since IS NOT NULL) THEN
    RETURN v_since;
  END IF;
  UPDATE public.photo_saves
  SET on_since = CASE WHEN p_on THEN clock_timestamp() END, set_by = auth.uid(), set_at = clock_timestamp()
  WHERE id = v_id
  RETURNING on_since INTO v_since;
  RETURN v_since;
END;
$$;

COMMENT ON FUNCTION public.set_photo_save(uuid, uuid, uuid, boolean) IS
  'Messages (cut 10, v2.5457): the office''s tick, Save every photo on this job to Drive as it comes in, on or off for one job (a bid, a GC project or a Pipeline job). On keeps the time it first went on; off clears it; the same press twice changes nothing. gc_office_team() only, never training mode or a twin. Returns on_since, null when off.';

REVOKE ALL ON FUNCTION public.set_photo_save(uuid, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_photo_save(uuid, uuid, uuid, boolean) TO authenticated, service_role;

-- 2) A text's picture or file the webhook could not copy.
ALTER TABLE public.message_attachments
  DROP CONSTRAINT IF EXISTS message_attachments_left_known,
  ADD CONSTRAINT message_attachments_left_known CHECK (left_in_gmail IN ('too_big', 'not_copied', 'quo_not_copied')) NOT VALID;
ALTER TABLE public.message_attachments VALIDATE CONSTRAINT message_attachments_left_known;

COMMENT ON COLUMN public.message_attachments.left_in_gmail IS
  'Messages (cut 6; cut 10, v2.5457): a file with no copy of ours. too_big: an email''s file over 25 MB, left in Gmail. not_copied: an email''s file the reader could not copy, left in Gmail. quo_not_copied: a picture or a file on a text the quo-webhook could not copy, which Quo''s history still holds.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
