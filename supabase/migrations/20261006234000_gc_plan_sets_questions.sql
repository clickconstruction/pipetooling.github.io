SET lock_timeout = '3s';

-- GC mode, the real build, step 3 (v2.4691): the plan sets and the questions about them, from the
-- prototype's model (to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on branch spike/gc-mode, "The
-- tables"). A set is one row with what it did to each sheet and section as rows of its own, so the
-- sheets as they stand at any set are a fold over those rows (sheetsAtRev and friends in the
-- kernels). Who sees them: dev only while it is built, like step 2's tables. Nothing reads or
-- writes these yet.

-- One row per set of plans: the first set (rev 0: a bid, pricing or permit set) and each later one
-- (an addendum, a bulletin, a revised set, ...). The Drive link lives on the set.
CREATE TABLE IF NOT EXISTS public.gc_plan_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rev integer NOT NULL
    CONSTRAINT gc_plan_sets_rev_counted CHECK (rev >= 0),
  -- "Bid set", "Addendum 2", "Bulletin 1" (nextSetLabel in src/lib/gc/setKinds.ts).
  label text NOT NULL
    CONSTRAINT gc_plan_sets_labeled CHECK (btrim(label) <> ''),
  -- The first set's kind (bid, pricing, permit) or a later set's (addendum, bulletin, revised, permit, construction).
  kind text NOT NULL DEFAULT '',
  issued_on date NOT NULL,
  note text NOT NULL DEFAULT '',
  -- Who on our team checked the set's files before it went out (the owner, 2026-10-04).
  checked_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The set's Google Drive file or folder, and the last check of who can open it.
  drive_url text NOT NULL DEFAULT '',
  drive_access text
    CONSTRAINT gc_plan_sets_drive_access_known CHECK (drive_access IS NULL OR drive_access IN ('anyone', 'restricted')),
  drive_checked_on date,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_plan_sets_one_per_rev UNIQUE (project_id, rev)
);

COMMENT ON TABLE public.gc_plan_sets IS
  'GC mode (v2.4691): one row per set of plans on a GC project: rev 0 is the first set, each later one an addendum, bulletin or reissue, with its kind, the day it came, its note, who checked its files, and its Google Drive link with the last check of who can open it. What it did to each sheet and section is in gc_plan_set_items.';

CREATE INDEX IF NOT EXISTS gc_plan_sets_project_idx ON public.gc_plan_sets (project_id, rev);

-- What each set did to each sheet and section, one row each. The first set's rows are all
-- "issued": the sheet index and the manual's table of contents. One table holds sheets and
-- sections, so a set that changes both is one list.
CREATE TABLE IF NOT EXISTS public.gc_plan_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.gc_plan_sets(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL
    CONSTRAINT gc_plan_set_items_kind_known CHECK (kind IN ('sheet', 'section')),
  -- "E-201" or "09 91 23".
  number text NOT NULL
    CONSTRAINT gc_plan_set_items_numbered CHECK (btrim(number) <> ''),
  title text NOT NULL DEFAULT '',
  change text NOT NULL DEFAULT 'issued'
    CONSTRAINT gc_plan_set_items_change_known CHECK (change IN ('issued', 'revised', 'added', 'removed', 'renamed')),
  -- The title before a rename.
  was_title text,
  -- The discipline the office picked for a sheet whose number's letters do not say it, and the
  -- plan PDF page it was read from (the sheet table, src/lib/gc/sheets.ts).
  discipline text,
  page integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_plan_set_items IS
  'GC mode (v2.4691): what a set of plans did to one sheet or one section of the manual: issued (the first set), revised, added, removed or renamed (was_title). The sheets and sections as they stand at any set are a fold over these rows (sheetsAtRev, specsAtRev in the kernels).';

CREATE INDEX IF NOT EXISTS gc_plan_set_items_set_idx ON public.gc_plan_set_items (set_id, position);

-- A question about the plans while we bid, from a company on a trade or from us: sent to the
-- architect, answered, and carried in a later set. company_id is the Board's company record,
-- which comes with its own step, so it has no foreign key yet.
CREATE TABLE IF NOT EXISTS public.gc_plan_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE SET NULL,
  company_id uuid,
  text text NOT NULL
    CONSTRAINT gc_plan_questions_asked CHECK (btrim(text) <> ''),
  sheets text[] NOT NULL DEFAULT '{}',
  asked_on date NOT NULL,
  sent_to_architect_on date,
  answered_on date,
  answer text NOT NULL DEFAULT '',
  -- The companies the answer went to.
  answer_sent_to uuid[] NOT NULL DEFAULT '{}',
  -- The set that carried the answer.
  in_set_id uuid REFERENCES public.gc_plan_sets(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_plan_questions IS
  'GC mode (v2.4691): a question about the plans while we bid a GC project, from a company on a trade (company_id, the Board''s record once it exists) or from us: the sheets it is about, the day asked, sent to the architect, answered, who the answer went to, and the set that carried it.';

CREATE INDEX IF NOT EXISTS gc_plan_questions_project_idx ON public.gc_plan_questions (project_id, asked_on);

-- Which companies a set reached, and whether it changed their trade. The email itself is logged
-- in email_send_log; this is what the portal and the Board read.
CREATE TABLE IF NOT EXISTS public.gc_plan_set_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.gc_plan_sets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  touched boolean NOT NULL DEFAULT false,
  email_send_log_id uuid REFERENCES public.email_send_log(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_plan_set_sends_once UNIQUE (set_id, company_id)
);

COMMENT ON TABLE public.gc_plan_set_sends IS
  'GC mode (v2.4691): which companies a set of plans went to and whether it changed their trade (touched), with the email''s row in email_send_log. The portal reads it for "you have the latest set".';

CREATE INDEX IF NOT EXISTS gc_plan_set_sends_set_idx ON public.gc_plan_set_sends (set_id);

-- A scope line that a later set added points at that set (step 2 left the column with no key).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gc_scope_items_added_in_set_fkey'
  ) THEN
    ALTER TABLE public.gc_scope_items
      ADD CONSTRAINT gc_scope_items_added_in_set_fkey
      FOREIGN KEY (added_in_set_id) REFERENCES public.gc_plan_sets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Who sees them: dev only while it is built, like step 2.
ALTER TABLE public.gc_plan_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_plan_set_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_plan_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_plan_set_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_plan_sets_dev ON public.gc_plan_sets;
CREATE POLICY gc_plan_sets_dev ON public.gc_plan_sets FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_plan_set_items_dev ON public.gc_plan_set_items;
CREATE POLICY gc_plan_set_items_dev ON public.gc_plan_set_items FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_plan_questions_dev ON public.gc_plan_questions;
CREATE POLICY gc_plan_questions_dev ON public.gc_plan_questions FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS gc_plan_set_sends_dev ON public.gc_plan_set_sends;
CREATE POLICY gc_plan_set_sends_dev ON public.gc_plan_set_sends FOR ALL TO authenticated
  USING (public.is_dev()) WITH CHECK (public.is_dev());

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
