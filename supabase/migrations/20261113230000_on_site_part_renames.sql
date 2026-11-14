SET lock_timeout = '3s';

-- Materials on site: fix a part's typed name (the owner's ask, 2026-11-13).
--
-- A name a crew types on site is the only name its line has. The ledger (job_material_movements) takes inserts
-- alone, so a name typed wrong could not be fixed: the one way was to count the line to zero and add it again
-- under a new name, which reads as a shortfall and as a second delivery.
--
-- A rename is a row here, and inserting the row is the act, as a sticker's placing is (box_sticker_events):
--
--   1. job_part_renames          - one row a rename: the job, the old name, the new one, the ledger rows it
--                                  changed, who and when. Insert only.
--   2. job_part_renames_judge    - BEFORE INSERT: cleans the two names, finds the job's typed rows that carry
--                                  the old one, and fills the row. It writes nothing else.
--   3. job_part_renames_apply    - AFTER INSERT, so after the caller's own RLS allowed the row: sets part_name
--                                  on exactly those ledger rows. This is the one place a ledger row is updated,
--                                  and it touches the name alone, never a quantity, a reason, a box or a time.
--
-- A rename is job wide, never one box: a part moved between two boxes is one ledger row both boxes read, so a
-- rename in one box alone would split the other box's line.
-- Only a typed name (part_id IS NULL). A parts-book part reads its name from the book.
-- A rename is undone by a second row that names the first (undo_of): it puts the old name back on the rows the
-- first one changed that still carry its new name. Each rename is undone once.
--
-- The caller is judged by on_site_can_touch_job under their own RLS, in the INSERT policy. The two trigger
-- functions are definers because the ledger has no UPDATE policy, by design.

CREATE TABLE IF NOT EXISTS public.job_part_renames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  old_name text NOT NULL DEFAULT '' CHECK (length(old_name) <= 160),
  new_name text NOT NULL DEFAULT '' CHECK (length(new_name) <= 160),
  movement_ids uuid[] NOT NULL DEFAULT '{}',
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  undo_of uuid REFERENCES public.job_part_renames(id) ON DELETE SET NULL,
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_part_renames_job_at_idx ON public.job_part_renames (job_id, at);
CREATE UNIQUE INDEX IF NOT EXISTS job_part_renames_undo_once_key ON public.job_part_renames (undo_of) WHERE undo_of IS NOT NULL;
COMMENT ON TABLE public.job_part_renames IS 'Materials on site: a typed part name fixed on a job, insert only. Inserting a row is the act: a trigger sets part_name on the job''s typed ledger rows that carried old_name and keeps their ids in movement_ids. undo_of names the rename a row takes back.';
COMMENT ON COLUMN public.job_part_renames.movement_ids IS 'The job_material_movements rows this rename changed, so an undo puts the old name back on exactly those.';

-- 2. The judge. It reads the ledger as a definer and fills the row; it changes nothing. A rename that finds no
--    row is not refused here: this runs before the caller's RLS is asked, and a refusal would tell a stranger
--    which names a job holds. The apply refuses it, after the policy.
CREATE OR REPLACE FUNCTION public.job_part_renames_judge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_old text;
  v_new text;
  v_ids uuid[];
  v_src public.job_part_renames%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to rename a part.' USING ERRCODE = '42501';
  END IF;
  IF NEW.undo_of IS NOT NULL THEN
    SELECT * INTO v_src FROM public.job_part_renames r WHERE r.id = NEW.undo_of AND r.job_id = NEW.job_id;
    IF NOT FOUND THEN
      v_old := '';
      v_new := '';
      v_ids := '{}';
    ELSE
      v_old := v_src.new_name;
      v_new := v_src.old_name;
      SELECT COALESCE(array_agg(m.id), '{}') INTO v_ids
      FROM public.job_material_movements m
      WHERE m.id = ANY (v_src.movement_ids) AND m.job_id = NEW.job_id AND m.part_id IS NULL AND m.part_name = v_src.new_name;
    END IF;
  ELSE
    v_old := btrim(regexp_replace(COALESCE(NEW.old_name, ''), '\s+', ' ', 'g'));
    v_new := btrim(regexp_replace(COALESCE(NEW.new_name, ''), '\s+', ' ', 'g'));
    IF v_new = '' THEN
      RAISE EXCEPTION 'Give the part a name.' USING ERRCODE = 'P0PRN';
    END IF;
    IF length(v_new) > 160 THEN
      RAISE EXCEPTION 'A part name holds 160 characters. This one is %.', length(v_new) USING ERRCODE = 'P0PRN';
    END IF;
    IF v_old = v_new THEN
      RAISE EXCEPTION 'That is the name it has.' USING ERRCODE = 'P0PRN';
    END IF;
    SELECT COALESCE(array_agg(m.id), '{}') INTO v_ids
    FROM public.job_material_movements m
    WHERE m.job_id = NEW.job_id AND m.part_id IS NULL
      AND lower(btrim(regexp_replace(m.part_name, '\s+', ' ', 'g'))) = lower(v_old);
  END IF;
  NEW.old_name := v_old;
  NEW.new_name := v_new;
  NEW.movement_ids := v_ids;
  NEW.row_count := COALESCE(cardinality(v_ids), 0);
  NEW.by_user_id := auth.uid();
  NEW.by_name := public.box_sticker_caller_name();
  NEW.at := now();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.job_part_renames_judge() IS 'Materials on site: BEFORE INSERT on job_part_renames. Cleans the names, finds the job''s typed ledger rows that carry the old one (or, for an undo, the rows the named rename changed that still carry its new name) and fills the row. Writes nothing else.';
REVOKE EXECUTE ON FUNCTION public.job_part_renames_judge() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_part_renames_judge() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_part_renames_judge() FROM authenticated;
CREATE OR REPLACE TRIGGER job_part_renames_judge BEFORE INSERT ON public.job_part_renames
  FOR EACH ROW EXECUTE FUNCTION public.job_part_renames_judge();

-- 3. The apply. It runs after the INSERT policy let the row in, so the caller may touch the job.
CREATE OR REPLACE FUNCTION public.job_part_renames_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.row_count = 0 THEN
    IF NEW.undo_of IS NOT NULL THEN
      RAISE EXCEPTION 'Nothing is left to undo. The part was renamed again, or that rename is not on this job.' USING ERRCODE = 'P0PRN';
    END IF;
    RAISE EXCEPTION 'No typed part named % is on this job.', NEW.old_name USING ERRCODE = 'P0PRN';
  END IF;
  UPDATE public.job_material_movements m
  SET part_name = NEW.new_name
  WHERE m.id = ANY (NEW.movement_ids) AND m.job_id = NEW.job_id AND m.part_id IS NULL;
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.job_part_renames_apply() IS 'Materials on site: AFTER INSERT on job_part_renames. Sets part_name on the ledger rows the judge found, and refuses a rename that found none. The one update of job_material_movements, and of the name alone.';
REVOKE EXECUTE ON FUNCTION public.job_part_renames_apply() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_part_renames_apply() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_part_renames_apply() FROM authenticated;
CREATE OR REPLACE TRIGGER job_part_renames_apply AFTER INSERT ON public.job_part_renames
  FOR EACH ROW EXECUTE FUNCTION public.job_part_renames_apply();

-- Who: read and insert by the on-site gate, under the caller's own RLS. Never updated, never deleted.
ALTER TABLE public.job_part_renames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_part_renames_select ON public.job_part_renames;
CREATE POLICY job_part_renames_select ON public.job_part_renames FOR SELECT TO authenticated
  USING (public.on_site_can_touch_job(job_id));
DROP POLICY IF EXISTS job_part_renames_insert ON public.job_part_renames;
CREATE POLICY job_part_renames_insert ON public.job_part_renames FOR INSERT TO authenticated
  WITH CHECK (public.on_site_can_touch_job(job_id) AND by_user_id = auth.uid());

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
