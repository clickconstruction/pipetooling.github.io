SET lock_timeout = '3s';

-- ===============================================================================================================
-- The Document builder's ground for a job's sheet, its link and its sends (punch list #404, steps 3 to 5 and 8, 9).
--
-- A filled builder is one page with blanks that each job fills. The standing sheet is the builder's own row in
-- document_builders. This migration adds what hangs off a builder:
--
--   document_builder_sheets   one row a job's sheet: the job's own part as a draft and as published, the whole
--                             page as it read when published, its revision, and the usual's revision it went out on
--   document_builder_links    one row a link to a published sheet or builder, for someone with no page of their
--                             own. Only the hash of the link's code is kept
--   document_builder_sends    one row a send: what went, to which trade or customer, to whom, the job it is about,
--                             the revision that went, and the day and the revision they opened
--
-- A job's sheet follows the same rule as a builder: a published copy changes only with its revision, one step at a
-- time. It goes out laid over the builder's published copy, never over a draft of it.
--
-- Dev-only by RLS, as the tab is. A link is made, ended and opened only by an edge function with the service role,
-- so no signed-in caller writes one. A send is written by the function too; a dev may only take one off a page.
-- A public page and a trade's or a customer's own page read through their edge functions, never through a policy.
--
-- This migration writes no row and no words.
-- ===============================================================================================================

-- ---------------------------------------------------------------------------------------------------------------
-- A job's sheet.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_builder_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_key text NOT NULL REFERENCES public.document_builders(key) ON DELETE RESTRICT,
  -- The job the company runs as the GC. GC mode's tables point at projects, and so does this.
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- The job's own part being set up: its name, its place, who must be named, and only the fields that differ.
  draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object'),
  -- The job's own part as published. Null until the first publish.
  published jsonb CHECK (published IS NULL OR jsonb_typeof(published) = 'object'),
  -- The whole page as it read when published, laid over the usual. This is what everyone outside sees.
  published_sheet jsonb CHECK (published_sheet IS NULL OR jsonb_typeof(published_sheet) = 'object'),
  -- The published copy's number. 0 means never published.
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  -- The usual's revision this sheet was published on.
  usual_revision integer,
  published_at timestamptz,
  published_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT document_builder_sheets_one_a_job UNIQUE (builder_key, project_id),
  -- A revision comes and goes with its copy, the page it made and the usual it went out on.
  CONSTRAINT document_builder_sheets_published_whole CHECK (
    (revision = 0 AND published IS NULL AND published_sheet IS NULL AND usual_revision IS NULL)
    OR (revision >= 1 AND published IS NOT NULL AND published_sheet IS NOT NULL AND usual_revision IS NOT NULL AND usual_revision >= 1)
  )
);
CREATE INDEX IF NOT EXISTS document_builder_sheets_project_idx ON public.document_builder_sheets (project_id);
COMMENT ON TABLE public.document_builder_sheets IS 'A job''s sheet of a filled builder (punch list #404): the job''s own part as a draft and as published, the whole page as it read when published (published_sheet, what everyone outside sees), its revision, and the usual''s revision it went out on. One sheet a builder and a job. Dev-only by RLS.';
COMMENT ON COLUMN public.document_builder_sheets.published_sheet IS 'The page as a sub reads it: the builder''s published copy laid over by this job''s own part, at the moment of the publish. A later change to either reaches nobody until the sheet is published again.';
COMMENT ON COLUMN public.document_builder_sheets.usual_revision IS 'The builder''s revision this sheet was published on. A sheet is behind the usual when this is less than the builder''s revision.';

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

  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.document_builder_sheets_stamp() IS 'BEFORE INSERT OR UPDATE on document_builder_sheets: only a filled builder has sheets; a sheet starts as a draft; a revision goes up one at a time, only with its published copy and the page it made, and only on the usual''s published revision; a published copy changes only with its revision; and who made and published it is the caller.';
REVOKE EXECUTE ON FUNCTION public.document_builder_sheets_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_builder_sheets_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.document_builder_sheets_stamp() FROM authenticated;
CREATE OR REPLACE TRIGGER document_builder_sheets_stamp BEFORE INSERT OR UPDATE ON public.document_builder_sheets
  FOR EACH ROW EXECUTE FUNCTION public.document_builder_sheets_stamp();

ALTER TABLE public.document_builder_sheets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_builder_sheets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_builder_sheets TO authenticated;
GRANT ALL ON TABLE public.document_builder_sheets TO service_role;
DROP POLICY IF EXISTS document_builder_sheets_select ON public.document_builder_sheets;
CREATE POLICY document_builder_sheets_select ON public.document_builder_sheets FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS document_builder_sheets_insert ON public.document_builder_sheets;
CREATE POLICY document_builder_sheets_insert ON public.document_builder_sheets FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS document_builder_sheets_update ON public.document_builder_sheets;
CREATE POLICY document_builder_sheets_update ON public.document_builder_sheets FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS document_builder_sheets_delete ON public.document_builder_sheets;
CREATE POLICY document_builder_sheets_delete ON public.document_builder_sheets FOR DELETE TO authenticated USING (public.is_dev());

-- ---------------------------------------------------------------------------------------------------------------
-- A link: a second way in, for someone with no page of their own.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_builder_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_key text NOT NULL REFERENCES public.document_builders(key) ON DELETE CASCADE,
  -- The job's sheet the link opens. Null for a link to the builder itself.
  sheet_id uuid REFERENCES public.document_builder_sheets(id) ON DELETE CASCADE,
  -- Random letters that, with a secret only the function holds, make the link's code again. Not the code.
  nonce text NOT NULL CHECK (nonce ~ '^[0-9a-f]{32}$'),
  -- SHA-256 of the link's code. The code itself is never kept.
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  made_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  made_at timestamptz NOT NULL DEFAULT now(),
  -- A link that was switched off, or that a new link replaced.
  ended_at timestamptz,
  ended_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  CONSTRAINT document_builder_links_code_hash_key UNIQUE (code_hash)
);
-- One live link a sheet, and one a builder: a new link stops the old one.
CREATE UNIQUE INDEX IF NOT EXISTS document_builder_links_live_key
  ON public.document_builder_links (builder_key, coalesce(sheet_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS document_builder_links_sheet_idx ON public.document_builder_links (sheet_id);
COMMENT ON TABLE public.document_builder_links IS 'A link to a published sheet or builder of the Document builder (punch list #404), for someone with no page of their own. Only the SHA-256 of the link''s code is kept, with a nonce the function uses to make the code again. One live link a sheet and one a builder: a new link ends the old one. Made, ended and opened only by the edge function, with the service role. A dev reads it.';

ALTER TABLE public.document_builder_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_builder_links FROM anon, authenticated;
GRANT SELECT ON TABLE public.document_builder_links TO authenticated;
GRANT ALL ON TABLE public.document_builder_links TO service_role;
DROP POLICY IF EXISTS document_builder_links_select ON public.document_builder_links;
CREATE POLICY document_builder_links_select ON public.document_builder_links FOR SELECT TO authenticated USING (public.is_dev());

-- ---------------------------------------------------------------------------------------------------------------
-- A send: what went to whom, and when they opened it.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_builder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_key text NOT NULL REFERENCES public.document_builders(key) ON DELETE RESTRICT,
  -- The job's sheet that went. Null when the builder itself went.
  sheet_id uuid REFERENCES public.document_builder_sheets(id) ON DELETE CASCADE,
  -- Who it went to: a trade partner, or a customer who is the GC on our jobs. Exactly one.
  company_id uuid REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  contact_name text NOT NULL DEFAULT '' CHECK (length(contact_name) <= 160),
  contact_email text NOT NULL DEFAULT '' CHECK (length(contact_email) <= 320),
  -- For a customer: the job it is about. Null means all their jobs with us.
  about_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  -- The revision that went, on the last send.
  sent_revision integer NOT NULL CHECK (sent_revision >= 1),
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sent_by_name text NOT NULL DEFAULT '' CHECK (length(sent_by_name) <= 120),
  times_sent integer NOT NULL DEFAULT 1 CHECK (times_sent >= 1),
  -- The day their page or the link opened it, and the revision they saw then.
  opened_at timestamptz,
  opened_revision integer,
  -- Taken off their page. The row stays as the record that it went.
  taken_off_at timestamptz,
  taken_off_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_builder_sends_one_party CHECK (num_nonnulls(company_id, customer_id) = 1),
  CONSTRAINT document_builder_sends_about_a_customers_job CHECK (about_job_id IS NULL OR customer_id IS NOT NULL),
  CONSTRAINT document_builder_sends_opened_whole CHECK (
    (opened_at IS NULL AND opened_revision IS NULL)
    OR (opened_at IS NOT NULL AND opened_revision IS NOT NULL AND opened_revision >= 1)
  )
);
-- One live send of one thing to one party. Sending again changes that row; taking it off frees the place.
CREATE UNIQUE INDEX IF NOT EXISTS document_builder_sends_live_key
  ON public.document_builder_sends (
    builder_key,
    coalesce(sheet_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(company_id, customer_id)
  )
  WHERE taken_off_at IS NULL;
CREATE INDEX IF NOT EXISTS document_builder_sends_company_idx ON public.document_builder_sends (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_builder_sends_customer_idx ON public.document_builder_sends (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS document_builder_sends_sheet_idx ON public.document_builder_sends (sheet_id);
COMMENT ON TABLE public.document_builder_sends IS 'A send from the Document builder (punch list #404): a job''s sheet to a trade partner, or a builder to a customer who is the GC on our jobs, with who it went to, the job it is about, the revision that went, and the day and the revision they opened. One live send of one thing to one party. Written by the edge function with the service role; a dev reads it and may take one off a page. Dev-only by RLS.';

-- A signed-in caller changes one thing on a send: it is taken off the page, once. Everything else is the function's.
CREATE OR REPLACE FUNCTION public.document_builder_sends_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.taken_off_at IS NOT NULL THEN
    RAISE EXCEPTION 'This send was taken off the page already.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.taken_off_at IS NULL THEN
    RAISE EXCEPTION 'A send is changed only by sending again.' USING ERRCODE = 'P0001';
  END IF;
  -- Only the taking off lands. Every other column stays as it was.
  NEW := OLD;
  NEW.taken_off_at := now();
  NEW.taken_off_by := auth.uid();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.document_builder_sends_guard() IS 'BEFORE UPDATE on document_builder_sends: a signed-in caller may only take a live send off the page, once, and is stamped as who did. The edge function, with the service role, writes everything else.';
REVOKE EXECUTE ON FUNCTION public.document_builder_sends_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.document_builder_sends_guard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.document_builder_sends_guard() FROM authenticated;
CREATE OR REPLACE TRIGGER document_builder_sends_guard BEFORE UPDATE ON public.document_builder_sends
  FOR EACH ROW EXECUTE FUNCTION public.document_builder_sends_guard();

ALTER TABLE public.document_builder_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.document_builder_sends FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.document_builder_sends TO authenticated;
GRANT ALL ON TABLE public.document_builder_sends TO service_role;
DROP POLICY IF EXISTS document_builder_sends_select ON public.document_builder_sends;
CREATE POLICY document_builder_sends_select ON public.document_builder_sends FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS document_builder_sends_update ON public.document_builder_sends;
CREATE POLICY document_builder_sends_update ON public.document_builder_sends FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
