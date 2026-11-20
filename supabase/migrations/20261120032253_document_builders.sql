SET lock_timeout = '3s';

-- ===============================================================================================================
-- The Document builder's builders (punch list #404, step 2).
--
-- Documents has a Document builder tab, a dev's for now, that lists builders. A builder makes one kind of paper.
-- Until now a builder's contents were a file in the client. This table is where they live:
--
--   document_builders   one row a builder: its kind, the draft being set up, the copy everyone outside sees, that
--                       copy's revision, who published it, and who read which revision
--
-- A draft is changed freely. A published copy changes only with its revision, and a revision goes up one at a
-- time, so a revision number always names one set of words. The read mark names a revision, so a new revision is
-- unread until someone marks it.
--
-- This migration writes no words. The first draft is loaded by a press in the app, from words a person typed.
--
-- Dev-only by RLS, as the tab is. A public page that later shows a published copy reads it through an edge
-- function with the service role, never through a policy.
-- ===============================================================================================================

CREATE TABLE IF NOT EXISTS public.document_builders (
  -- The builder's name in the app's own registry and in the address: sub-nda.
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9-]{0,39}$'),
  -- walked: someone walks it page by page and picks a level. filled: one page with blanks that each job fills.
  kind text NOT NULL CHECK (kind IN ('walked', 'filled')),
  -- The contents being set up. Only the tab's own people read it.
  draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object'),
  -- The contents everyone outside sees. Null until the first publish.
  published jsonb CHECK (published IS NULL OR jsonb_typeof(published) = 'object'),
  -- The published copy's number. 0 means never published.
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  published_at timestamptz,
  published_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Who read which revision: an attorney for one builder, an insurance agent for another. The name is typed.
  read_revision integer,
  read_by_name text NOT NULL DEFAULT '' CHECK (length(read_by_name) <= 120),
  read_on date,
  read_marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  read_marked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- A revision and its copy come and go together.
  CONSTRAINT document_builders_published_with_revision CHECK ((revision = 0) = (published IS NULL)),
  -- A read mark is whole or absent: the revision, the reader's name and the day. Each column is named in both
  -- branches, since a CHECK passes when its answer is unknown.
  CONSTRAINT document_builders_read_mark_whole CHECK (
    (read_revision IS NULL AND read_by_name = '' AND read_on IS NULL)
    OR (read_revision IS NOT NULL AND read_revision >= 1 AND read_revision <= revision AND btrim(read_by_name) <> '' AND read_on IS NOT NULL)
  )
);
COMMENT ON TABLE public.document_builders IS 'The Document builder tab''s builders (punch list #404): one row a builder, with its kind (walked or filled), the draft being set up, the published copy everyone outside sees, that copy''s revision and who published it, and who read which revision. A published copy changes only with its revision, one step at a time. Dev-only by RLS.';
COMMENT ON COLUMN public.document_builders.key IS 'The builder''s name in the client''s registry (src/lib/documentBuilder/builders.ts) and in the address.';
COMMENT ON COLUMN public.document_builders.revision IS 'The published copy''s number. 0 means never published. Goes up one at a time, with the copy.';
COMMENT ON COLUMN public.document_builders.read_revision IS 'The revision the read mark is for. The builder is read when this equals revision, so a new revision is unread again.';

-- Who made, published and marked a builder is the caller, whatever the client sent. The rules of a revision live
-- here too, so a number always names one set of words.
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
COMMENT ON FUNCTION public.document_builders_stamp() IS 'BEFORE INSERT OR UPDATE on document_builders: a builder starts as a draft; a revision goes up one at a time and only with its published copy; a published copy changes only with its revision; only the published revision can be marked as read; and who made, published and marked it is the caller.';
REVOKE EXECUTE ON FUNCTION public.document_builders_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_builders_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.document_builders_stamp() FROM authenticated;
CREATE OR REPLACE TRIGGER document_builders_stamp BEFORE INSERT OR UPDATE ON public.document_builders
  FOR EACH ROW EXECUTE FUNCTION public.document_builders_stamp();

ALTER TABLE public.document_builders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_builders FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_builders TO authenticated;
GRANT ALL ON TABLE public.document_builders TO service_role;
DROP POLICY IF EXISTS document_builders_select ON public.document_builders;
CREATE POLICY document_builders_select ON public.document_builders FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS document_builders_insert ON public.document_builders;
CREATE POLICY document_builders_insert ON public.document_builders FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS document_builders_update ON public.document_builders;
CREATE POLICY document_builders_update ON public.document_builders FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS document_builders_delete ON public.document_builders;
CREATE POLICY document_builders_delete ON public.document_builders FOR DELETE TO authenticated USING (public.is_dev());

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
