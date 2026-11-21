SET lock_timeout = '3s';

-- ===============================================================================================================
-- The Document builder: a draft has a number (punch list #404, a fault the review of 2026-11-20 found).
--
-- A builder and a job's sheet each hold a draft that the page saves a moment after the typing rests. A save named
-- nothing it was loaded at, so a tab left open wrote its old draft over a newer one, and a publish from it then put
-- the old words out as the next revision. A publish named the revision alone, which a draft saved by someone else
-- does not move.
--
--   document_builders.draft_no         goes up one each time the builder's draft or its revision changes
--   document_builder_sheets.draft_no   the same, for a job's sheet
--
-- The page reads the number with the row, and a save or a publish names it:  ... WHERE key = $1 AND draft_no = $2.
-- A row that moved on matches nothing, so the write lands on no row and the page says so. The number is the
-- database's own: each stamp sets it from the row as it was, whatever the client sent.
--
-- A read mark changes neither the draft nor the revision, so it does not move the number: marking a revision as
-- read in one tab does not refuse a save from another.
--
-- Additive. Both tables are small and a dev's alone, and a column with a constant default is added without a
-- rewrite. A page on the old client names no number, and keeps saving as it did until it is reloaded.
-- ===============================================================================================================

ALTER TABLE public.document_builders
  ADD COLUMN IF NOT EXISTS draft_no integer NOT NULL DEFAULT 0 CHECK (draft_no >= 0);
COMMENT ON COLUMN public.document_builders.draft_no IS 'The draft''s number: up one each time the draft or the revision changes, set by the stamp whatever the client sent. A save or a publish names the number its page read (WHERE draft_no = n), so one from a page that fell behind lands on no row. A read mark does not move it.';

ALTER TABLE public.document_builder_sheets
  ADD COLUMN IF NOT EXISTS draft_no integer NOT NULL DEFAULT 0 CHECK (draft_no >= 0);
COMMENT ON COLUMN public.document_builder_sheets.draft_no IS 'The draft''s number: up one each time the job''s draft or its revision changes, set by the stamp whatever the client sent. A save or a publish names the number its page read (WHERE draft_no = n), so one from a page that fell behind lands on no row.';

-- The builder's stamp, as 20261120032253 wrote it, with the draft's number kept.
CREATE OR REPLACE FUNCTION public.document_builders_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A builder starts as a draft. Nothing is published and nobody has read it.
    NEW.published := NULL;
    NEW.revision := 0;
    NEW.draft_no := 0;
    NEW.published_at := NULL;
    NEW.published_by := NULL;
    NEW.read_revision := NULL;
    NEW.read_by_name := '';
    NEW.read_on := NULL;
    NEW.read_marked_by := NULL;
    NEW.read_marked_at := NULL;
    NEW.created_at := now();
    NEW.created_by := auth.uid();
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    RETURN NEW;
  END IF;

  -- Which builder it is, its kind and who made it stand.
  NEW.key := OLD.key;
  NEW.kind := OLD.kind;
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;

  IF NEW.revision IS DISTINCT FROM OLD.revision THEN
    IF NEW.revision IS DISTINCT FROM OLD.revision + 1 THEN
      RAISE EXCEPTION 'A revision goes up one at a time. This builder is on revision %.', OLD.revision USING ERRCODE = 'P0001';
    END IF;
    IF NEW.published IS NULL THEN
      RAISE EXCEPTION 'A new revision needs its published copy.' USING ERRCODE = 'P0001';
    END IF;
    NEW.published_at := now();
    NEW.published_by := auth.uid();
  ELSE
    IF NEW.published IS DISTINCT FROM OLD.published THEN
      RAISE EXCEPTION 'A published copy changes only with a new revision.' USING ERRCODE = 'P0001';
    END IF;
    NEW.published_at := OLD.published_at;
    NEW.published_by := OLD.published_by;
  END IF;

  -- The draft's number is the row's own: up one when the draft or the revision changed, and as it was otherwise.
  IF NEW.draft IS DISTINCT FROM OLD.draft OR NEW.revision IS DISTINCT FROM OLD.revision THEN
    NEW.draft_no := OLD.draft_no + 1;
  ELSE
    NEW.draft_no := OLD.draft_no;
  END IF;

  NEW.read_by_name := btrim(coalesce(NEW.read_by_name, ''));
  IF (NEW.read_revision, NEW.read_by_name, NEW.read_on) IS DISTINCT FROM (OLD.read_revision, OLD.read_by_name, OLD.read_on) THEN
    IF NEW.read_revision IS NULL THEN
      -- A mark taken off: a wrong name, or the wrong day.
      NEW.read_by_name := '';
      NEW.read_on := NULL;
      NEW.read_marked_by := NULL;
      NEW.read_marked_at := NULL;
    ELSE
      IF NEW.read_revision IS DISTINCT FROM NEW.revision OR NEW.revision = 0 THEN
        RAISE EXCEPTION 'Only the published revision can be marked as read. This builder is on revision %.', NEW.revision USING ERRCODE = 'P0001';
      END IF;
      NEW.read_marked_by := auth.uid();
      NEW.read_marked_at := now();
    END IF;
  ELSE
    NEW.read_marked_by := OLD.read_marked_by;
    NEW.read_marked_at := OLD.read_marked_at;
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.document_builders_stamp() IS 'BEFORE INSERT OR UPDATE on document_builders: a builder starts as a draft; a revision goes up one at a time and only with its published copy; a published copy changes only with its revision; the draft''s number goes up one with each change to the draft or the revision, whatever the client sent; only the published revision can be marked as read; and who made, published and marked it is the caller.';
REVOKE EXECUTE ON FUNCTION public.document_builders_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_builders_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.document_builders_stamp() FROM authenticated;

-- A job's sheet's stamp, as 20261120034225 wrote it, with the draft's number kept.
CREATE OR REPLACE FUNCTION public.document_builder_sheets_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_kind text;
  v_usual integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT b.kind INTO v_kind FROM public.document_builders b WHERE b.key = NEW.builder_key;
    IF v_kind IS DISTINCT FROM 'filled' THEN
      RAISE EXCEPTION 'Only a builder that is one page with blanks has a sheet for a job.' USING ERRCODE = 'P0001';
    END IF;
    -- A job's sheet starts as a draft. Nothing is published.
    NEW.published := NULL;
    NEW.published_sheet := NULL;
    NEW.revision := 0;
    NEW.draft_no := 0;
    NEW.usual_revision := NULL;
    NEW.published_at := NULL;
    NEW.published_by := NULL;
    NEW.created_at := now();
    NEW.created_by := auth.uid();
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    RETURN NEW;
  END IF;

  -- Which builder and which job it is, and who made it, stand.
  NEW.builder_key := OLD.builder_key;
  NEW.project_id := OLD.project_id;
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;

  IF NEW.revision IS DISTINCT FROM OLD.revision THEN
    IF NEW.revision IS DISTINCT FROM OLD.revision + 1 THEN
      RAISE EXCEPTION 'A revision goes up one at a time. This sheet is on revision %.', OLD.revision USING ERRCODE = 'P0001';
    END IF;
    IF NEW.published IS NULL OR NEW.published_sheet IS NULL THEN
      RAISE EXCEPTION 'A new revision needs its published copy.' USING ERRCODE = 'P0001';
    END IF;
    -- A sheet goes out on the usual as it is published now, never on a draft of it or on an older one.
    SELECT b.revision INTO v_usual FROM public.document_builders b WHERE b.key = NEW.builder_key;
    IF coalesce(v_usual, 0) < 1 THEN
      RAISE EXCEPTION 'Publish the usual sheet first.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.usual_revision IS DISTINCT FROM v_usual THEN
      RAISE EXCEPTION 'The usual sheet is on revision %. Publish this sheet on that one.', v_usual USING ERRCODE = 'P0001';
    END IF;
    NEW.published_at := now();
    NEW.published_by := auth.uid();
  ELSE
    IF NEW.published IS DISTINCT FROM OLD.published OR NEW.published_sheet IS DISTINCT FROM OLD.published_sheet OR NEW.usual_revision IS DISTINCT FROM OLD.usual_revision THEN
      RAISE EXCEPTION 'A published copy changes only with a new revision.' USING ERRCODE = 'P0001';
    END IF;
    NEW.published_at := OLD.published_at;
    NEW.published_by := OLD.published_by;
  END IF;

  -- The draft's number is the row's own: up one when the draft or the revision changed, and as it was otherwise.
  IF NEW.draft IS DISTINCT FROM OLD.draft OR NEW.revision IS DISTINCT FROM OLD.revision THEN
    NEW.draft_no := OLD.draft_no + 1;
  ELSE
    NEW.draft_no := OLD.draft_no;
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.document_builder_sheets_stamp() IS 'BEFORE INSERT OR UPDATE on document_builder_sheets: only a filled builder has sheets; a sheet starts as a draft; a revision goes up one at a time, only with its published copy and the page it made, and only on the usual''s published revision; a published copy changes only with its revision; the draft''s number goes up one with each change to the draft or the revision, whatever the client sent; and who made and published it is the caller.';
REVOKE EXECUTE ON FUNCTION public.document_builder_sheets_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_builder_sheets_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.document_builder_sheets_stamp() FROM authenticated;
