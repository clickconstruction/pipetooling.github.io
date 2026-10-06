SET lock_timeout = '3s';

-- GC mode, the real build, step 2 (v2.4703): the first tables, from the prototype's model
-- (to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on branch spike/gc-mode, "The tables"; the owner's
-- word of 2026-10-06 that the prototype's shape is settled). A GC project is a row in `projects`
-- plus a one-to-one side table here (decision 1); its trades, each trade's scope lines and what a
-- trade's quote leaves out; and the four tables that hold what the office changed in the scope
-- book (the book itself is read, not stored). Who sees them (decision 2): dev only while it is
-- built; a later migration opens them to master and controller once a screen reads them.
-- Nothing reads or writes these yet: New project on real data is step 4 of the plan.

-- One row per GC project, keyed by its projects row (the owner as customer_id, the address, the number).
CREATE TABLE IF NOT EXISTS public.gc_projects (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Where the job is in its life (the prototype's GcProject.stage).
  stage text NOT NULL DEFAULT 'bidding'
    CONSTRAINT gc_projects_stage_known CHECK (stage IN ('bidding', 'buyout', 'building', 'closed')),
  bid_due date,
  -- The size as typed in step 1's Size box, and the words after it.
  sq_ft numeric,
  size_note text NOT NULL DEFAULT '',
  -- Who our customer is to the job (the owner, 2026-10-04): the owner, another general
  -- contractor, or an owner's rep. The customer stays projects.customer_id; the property's owner,
  -- when someone else, is a customer row too.
  customer_role text NOT NULL DEFAULT 'owner'
    CONSTRAINT gc_projects_customer_role_known CHECK (customer_role IN ('owner', 'gc', 'owners_rep')),
  property_owner_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  -- The architect is an ordinary customer row (decision 4).
  architect_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  -- Any user, the way bids.account_manager_id is (decision 3).
  project_manager_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Our number's own lines: general conditions in dollars, contingency and fee in percent.
  general_conditions numeric NOT NULL DEFAULT 0,
  contingency_pct numeric NOT NULL DEFAULT 0,
  fee_pct numeric NOT NULL DEFAULT 0,
  -- The project's folder in Google Drive (the sets' own links sit on gc_plan_sets, step 3).
  drive_folder_url text NOT NULL DEFAULT '',
  -- A bid we did not win: the day we heard, why (the Trades mode loss reasons), who won, a note.
  lost_on date,
  lost_why text,
  won_by text,
  lost_note text,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_projects IS
  'GC mode (v2.4703): everything only a GC project needs, one-to-one with its projects row (the customer, the address and the number live there). Stage, bid due, size, who we work for and the property''s owner, the architect and the project manager, our number''s lines, the Drive folder, a lost bid. Read by nothing yet: New project on real data is step 4 of to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md.';

CREATE INDEX IF NOT EXISTS gc_projects_stage_idx ON public.gc_projects (stage);
CREATE INDEX IF NOT EXISTS gc_projects_architect_idx ON public.gc_projects (architect_customer_id) WHERE architect_customer_id IS NOT NULL;

-- One row per trade on a project, in the trade list's order. A trade we do ourselves (ours) has its
-- number in a Trades mode bid, which is the bridge between the two modes.
CREATE TABLE IF NOT EXISTS public.gc_trade_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  trade text NOT NULL
    CONSTRAINT gc_trade_packages_trade_named CHECK (btrim(trade) <> ''),
  position integer NOT NULL DEFAULT 0,
  budget numeric NOT NULL DEFAULT 0,
  ours boolean NOT NULL DEFAULT false,
  own_bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_trade_packages_one_per_trade UNIQUE (project_id, trade)
);

COMMENT ON TABLE public.gc_trade_packages IS
  'GC mode (v2.4703): one row per trade on a GC project, in the trade list''s order, with its budget; ours marks a trade our own crew does, whose number is the Trades mode bid in own_bid_id. The Board''s columns (carried, awarded) come with its own step.';

CREATE INDEX IF NOT EXISTS gc_trade_packages_project_idx ON public.gc_trade_packages (project_id, position);

-- One row per scope line of a trade. sheets and specs null: follow the guess from the line's
-- words (the kernels in src/lib/gc/plans.ts); set: what the office tied the line to.
-- added_in_set_id names the plan set that added the line (null for the first scope); it gains its
-- foreign key when gc_plan_sets exists (step 3).
CREATE TABLE IF NOT EXISTS public.gc_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL
    CONSTRAINT gc_scope_items_label_said CHECK (btrim(label) <> ''),
  sheets text[],
  specs text[],
  added_in_set_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_scope_items IS
  'GC mode (v2.4703): one row per scope line of a trade on a GC project. sheets / specs null means the line reads the sheets and sections its words suggest; added_in_set_id names the plan set that brought the line in late (the scope book reads it).';

CREATE INDEX IF NOT EXISTS gc_scope_items_package_idx ON public.gc_scope_items (package_id, position);

-- What a trade's quote leaves out, and who does it instead: another trade's name, "the owner" or "us".
CREATE TABLE IF NOT EXISTS public.gc_scope_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL
    CONSTRAINT gc_scope_exclusions_label_said CHECK (btrim(label) <> ''),
  by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_scope_exclusions IS
  'GC mode (v2.4703): what a trade''s quote on a GC project leaves out (label) and who does it instead (by: a trade''s name, "the owner" or "us"). The gaps between the trades are read from these (scopeGaps in src/lib/gc/plans.ts).';

CREATE INDEX IF NOT EXISTS gc_scope_exclusions_package_idx ON public.gc_scope_exclusions (package_id, position);

-- The scope book (the owner, 2026-10-04): the book is read from every scope line above, the usual
-- lines and the finished jobs; only what the office changed by hand is stored, company-wide.
CREATE TABLE IF NOT EXISTS public.gc_scope_book_saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade text NOT NULL,
  words text NOT NULL
    CONSTRAINT gc_scope_book_saved_words_said CHECK (btrim(words) <> ''),
  spec text,
  leaves_out_label text,
  leaves_out_by text,
  saved_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_scope_book_saved IS
  'GC mode (v2.4703): a scope book line the office saved by hand: the trade, the words, the spec section it reads from, what a trade with it usually leaves out (leaves_out_label, leaves_out_by). One of the four lists in the kernel''s ScopeBookStore (src/lib/gc/scopeBook.ts).';

CREATE TABLE IF NOT EXISTS public.gc_scope_book_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade text NOT NULL,
  -- The line as the book had it, and what it reads now. clear_* says the office took the spec or
  -- the "leaves out" off; the mapper turns each into the kernel's null.
  words text NOT NULL,
  to_words text NOT NULL,
  to_spec text,
  clear_spec boolean NOT NULL DEFAULT false,
  to_leaves_out_label text,
  to_leaves_out_by text,
  clear_leaves_out boolean NOT NULL DEFAULT false,
  edited_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_scope_book_edits IS
  'GC mode (v2.4703): a change to a scope book line, read oldest first: the words as the book had them and what they read now, a new spec section or its clearing, a new "leaves out" or its clearing (ScopeBookEdit).';

CREATE TABLE IF NOT EXISTS public.gc_scope_book_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade text NOT NULL,
  from_words text NOT NULL,
  into_words text NOT NULL,
  merged_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  merged_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_scope_book_merges IS
  'GC mode (v2.4703): two scope book lines of one trade that say the same thing: from_words folds into into_words (ScopeBookMerge; the kernel follows a chain of merges).';

CREATE TABLE IF NOT EXISTS public.gc_scope_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade text NOT NULL,
  name text NOT NULL
    CONSTRAINT gc_scope_sets_named CHECK (btrim(name) <> ''),
  lines text[] NOT NULL DEFAULT '{}',
  from_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  saved_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_scope_sets IS
  'GC mode (v2.4703): a named list of one trade''s scope lines, taken into a scope in one press, and the project it was saved from (ScopeBookSet).';

CREATE INDEX IF NOT EXISTS gc_scope_book_saved_trade_idx ON public.gc_scope_book_saved (trade);
CREATE INDEX IF NOT EXISTS gc_scope_book_edits_trade_idx ON public.gc_scope_book_edits (trade, edited_at);
CREATE INDEX IF NOT EXISTS gc_scope_book_merges_trade_idx ON public.gc_scope_book_merges (trade);
CREATE INDEX IF NOT EXISTS gc_scope_sets_trade_idx ON public.gc_scope_sets (trade);

-- Who sees them (decision 2): dev only while it is built. One policy a table, for every verb;
-- a later migration opens the GC tables to master and controller, and the scope book to
-- estimators, once a screen reads them.
ALTER TABLE public.gc_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_trade_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_scope_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_scope_book_saved ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_scope_book_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_scope_book_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_scope_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_projects_dev ON public.gc_projects;
CREATE POLICY gc_projects_dev ON public.gc_projects FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_trade_packages_dev ON public.gc_trade_packages;
CREATE POLICY gc_trade_packages_dev ON public.gc_trade_packages FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_scope_items_dev ON public.gc_scope_items;
CREATE POLICY gc_scope_items_dev ON public.gc_scope_items FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_scope_exclusions_dev ON public.gc_scope_exclusions;
CREATE POLICY gc_scope_exclusions_dev ON public.gc_scope_exclusions FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_scope_book_saved_dev ON public.gc_scope_book_saved;
CREATE POLICY gc_scope_book_saved_dev ON public.gc_scope_book_saved FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_scope_book_edits_dev ON public.gc_scope_book_edits;
CREATE POLICY gc_scope_book_edits_dev ON public.gc_scope_book_edits FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_scope_book_merges_dev ON public.gc_scope_book_merges;
CREATE POLICY gc_scope_book_merges_dev ON public.gc_scope_book_merges FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_scope_sets_dev ON public.gc_scope_sets;
CREATE POLICY gc_scope_sets_dev ON public.gc_scope_sets FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
