SET lock_timeout = '3s';

-- Prospects: three kinds of company to find (v2.5559, punch list #110; the owner, 2026-10-15: "we use prospects to find
-- General Contractors for our trades to bid, but now that we have the option to be a GC ... add tabs for finding Jobs
-- that we could GC and finding Subs"). A prospect is now a customer (a GC or an owner who could send us plans for our
-- trades, every row before today), a GC lead (an owner, developer, architect or owner's rep with a job we could build
-- as the GC) or a sub (a company that does a trade we buy out). One deck serves all three; each kind carries its own
-- facts and lands where it already lives in the app when the call goes well: a sub on the bench (gc_companies), a GC
-- lead as a customer and, later, a GC project. The conversion keeps a real link from here on (converted_customer_id,
-- converted_gc_company_id); until today the customer was named only in a comment's text. A GC lead's jobs are rows of
-- their own (prospect_jobs), since an owner has several over the years and the bid day is the job's, not the owner's.
-- Everything is additive: nothing changes for a customer prospect or for the Hiring board.

-- ---------- the kind, and each kind's facts ----------

ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'customer';
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_kind_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_kind_known CHECK (kind IN ('customer', 'gc_lead', 'sub'));

-- Where we found them: a GC's sub list, PlanHub, a permit, a referral, the architect, a supply house, drove by.
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS source text;

-- A sub: the trades they do (the bench's own trade names), how far they go, and their language.
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS trades text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS max_miles integer;
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_max_miles_positive;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_max_miles_positive CHECK (max_miles IS NULL OR max_miles > 0);
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS lang text;
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_lang_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_lang_known CHECK (lang IS NULL OR lang IN ('en', 'es'));

-- A GC lead: who they are. developer and architect are the deck's own words; on a GC project the developer is the
-- owner we work for and the architect is the firm that drew the plans (gc_projects.architect_customer_id).
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS company_role text;
ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_company_role_known;
ALTER TABLE public.prospects ADD CONSTRAINT prospects_company_role_known
  CHECK (company_role IS NULL OR company_role IN ('owner', 'developer', 'architect', 'ownersRep', 'gc'));

-- A lead who is already a customer (a trade customer who could hire us as the GC) links to that record instead of
-- making a second one.
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- What the prospect became. One of the two is set when prospect_fit_status = 'converted' from here on.
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS converted_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS converted_gc_company_id uuid REFERENCES public.gc_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prospects_kind_idx ON public.prospects (kind);

COMMENT ON COLUMN public.prospects.kind IS
  'Prospects, v2.5559: customer (a GC or an owner who could send us plans for our trades; every row before then), gc_lead (an owner, developer, architect or owner''s rep with a job we could build as the GC) or sub (a company that does a trade we buy out). One deck serves all three.';
COMMENT ON COLUMN public.prospects.source IS 'Where we found them, in the caller''s words (a GC''s sub list, PlanHub, a permit, a referral, the architect, a supply house, drove by).';
COMMENT ON COLUMN public.prospects.trades IS 'A sub: the trades they do, the bench''s own trade names. Empty for the other kinds.';
COMMENT ON COLUMN public.prospects.max_miles IS 'A sub: how far their crews go from their address. Null: not said.';
COMMENT ON COLUMN public.prospects.lang IS 'A sub: en or es, as gc_companies.lang. Null: not said.';
COMMENT ON COLUMN public.prospects.company_role IS 'A GC lead: owner, developer, architect, ownersRep or gc. Null for the other kinds.';
COMMENT ON COLUMN public.prospects.customer_id IS 'A GC lead who is already a customer: that record, so Asked us links instead of making a second one.';
COMMENT ON COLUMN public.prospects.converted_customer_id IS 'The customer this prospect became (Converted or Asked us), from v2.5559; older conversions name the customer only in the converted comment''s text.';
COMMENT ON COLUMN public.prospects.converted_gc_company_id IS 'The trade partner company this sub became (Add to the bench), v2.5559.';

-- ---------- a GC lead's jobs ----------

CREATE TABLE IF NOT EXISTS public.prospect_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  name text NOT NULL
    CONSTRAINT prospect_jobs_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  address text,
  sq_ft integer
    CONSTRAINT prospect_jobs_sq_ft_positive CHECK (sq_ft IS NULL OR sq_ft > 0),
  -- The words after the size: "retail shell, one story".
  size_note text,
  -- Where the plans are: a plan room's link (PlanHub, BuildingConnected, Procore) or a Drive link.
  plans_link text
    CONSTRAINT prospect_jobs_plans_link_shape CHECK (plans_link IS NULL OR (plans_link ~ '^https?://' AND length(plans_link) <= 2000)),
  bid_due date,
  -- open: a job we could bid. asked: they asked us, and a GC project holds it now. lost: another builder got it.
  -- dropped: not happening.
  status text NOT NULL DEFAULT 'open'
    CONSTRAINT prospect_jobs_status_known CHECK (status IN ('open', 'asked', 'lost', 'dropped')),
  -- Who got it, when lost.
  won_by text,
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.prospect_jobs IS
  'Prospects, v2.5559 (punch list #110): a GC lead''s jobs, each a project we could build as the GC, with its bid day. An owner has several over the years; the queue runs on the soonest open one. Asked us hands the chosen job to New project.';

CREATE INDEX IF NOT EXISTS prospect_jobs_prospect_due ON public.prospect_jobs (prospect_id, bid_due);

DROP TRIGGER IF EXISTS prospect_jobs_updated_at_trg ON public.prospect_jobs;
CREATE TRIGGER prospect_jobs_updated_at_trg BEFORE UPDATE ON public.prospect_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.prospect_jobs ENABLE ROW LEVEL SECURITY;
-- Mirror prospects: the prospects staff (dev, master, assistant, controller, an estimator with the flag).
DROP POLICY IF EXISTS prospect_jobs_select ON public.prospect_jobs;
CREATE POLICY prospect_jobs_select ON public.prospect_jobs
  FOR SELECT TO authenticated USING (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS prospect_jobs_insert ON public.prospect_jobs;
CREATE POLICY prospect_jobs_insert ON public.prospect_jobs
  FOR INSERT TO authenticated WITH CHECK (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS prospect_jobs_update ON public.prospect_jobs;
CREATE POLICY prospect_jobs_update ON public.prospect_jobs
  FOR UPDATE TO authenticated USING (public.user_has_prospects_staff_access()) WITH CHECK (public.user_has_prospects_staff_access());
DROP POLICY IF EXISTS prospect_jobs_delete ON public.prospect_jobs;
CREATE POLICY prospect_jobs_delete ON public.prospect_jobs
  FOR DELETE TO authenticated USING (public.user_has_prospects_staff_access());

REVOKE ALL ON TABLE public.prospect_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prospect_jobs TO authenticated;
GRANT ALL ON TABLE public.prospect_jobs TO service_role;

-- House rules: read-only training mode and the twin write fence cover the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
