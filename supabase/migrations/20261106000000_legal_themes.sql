SET lock_timeout = '3s';
-- Themes on the record (v2.6545, punch list #269 T1). A theme is a plain-words name for a pattern the office wants to
-- find again across a large record (Dishonesty, Disrespectful conduct, Interference with the business): a company-wide
-- word with one line on what counts and optional words for counsel, retired never deleted, so old marks keep their
-- meaning. A mark is a row on something that already exists — an HR entry, a piece of evidence, a matter's document
-- or event — carrying why it fits and how it proves the theme (a document · their own words · a firsthand account · a
-- relayed account); never deleted, only stamped removed with a reason. The HR agent and the dev seat propose marks
-- (proposed = true) and a dev keeps or drops them. Both tables are a dev's, like the HR file. This file is the catalog
-- and the marks; the pickers, the Timeline's theme row and the By theme view come in the PRs after it.

CREATE TABLE IF NOT EXISTS public.legal_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  what_counts text NOT NULL DEFAULT '' CHECK (char_length(what_counts) <= 400),
  counsel_words text NOT NULL DEFAULT '' CHECK (char_length(counsel_words) <= 200),
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz NULL,
  retired_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  -- The agent's proposal, dashed on the screen until a dev keeps it (kept_at) or retires it.
  proposed_by_agent boolean NOT NULL DEFAULT false,
  kept_at timestamptz NULL
);
COMMENT ON TABLE public.legal_themes IS
  'Themes on the record (v2.6545): a company-wide plain-words name for a pattern, what counts, counsel''s words; retired, never deleted. Dev-only; the HR agent may propose one.';

-- One standing theme a name, whatever the case; a retired name may be used again.
CREATE UNIQUE INDEX IF NOT EXISTS legal_themes_name_standing_key ON public.legal_themes (lower(btrim(name))) WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS public.legal_theme_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES public.legal_themes(id) ON DELETE RESTRICT,
  target_kind text NOT NULL CHECK (target_kind IN ('hr_entry', 'hr_evidence', 'matter_document', 'matter_entry')),
  target_id uuid NOT NULL,
  person_id uuid NULL REFERENCES public.people(id) ON DELETE CASCADE,
  matter_id uuid NULL REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  why text NOT NULL DEFAULT '' CHECK (char_length(why) <= 200),
  proves_by text NULL CHECK (proves_by IS NULL OR proves_by IN ('document', 'own_words', 'firsthand', 'relayed')),
  marked_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  author_label text NULL,
  proposed boolean NOT NULL DEFAULT false,
  kept_at timestamptz NULL,
  kept_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  removed_at timestamptz NULL,
  removed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  removed_why text NOT NULL DEFAULT '' CHECK (char_length(removed_why) <= 200),
  CONSTRAINT legal_theme_marks_on_someone CHECK (person_id IS NOT NULL OR matter_id IS NOT NULL)
);
COMMENT ON TABLE public.legal_theme_marks IS
  'A theme marked on an HR entry, a piece of evidence, a matter document or a matter event (v2.6545): why it fits, how it proves the theme, who marked it; proposed by the agent until kept; never deleted, stamped removed with a reason. Dev-only.';

-- One live mark a theme a thing; a removed mark may be marked again.
CREATE UNIQUE INDEX IF NOT EXISTS legal_theme_marks_live_key ON public.legal_theme_marks (theme_id, target_kind, target_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_legal_theme_marks_person ON public.legal_theme_marks (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legal_theme_marks_matter ON public.legal_theme_marks (matter_id) WHERE matter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legal_theme_marks_target ON public.legal_theme_marks (target_kind, target_id);

-- A mark is what it was when made: only the kept and removed stamps may change afterwards.
CREATE OR REPLACE FUNCTION public.legal_theme_marks_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.theme_id <> OLD.theme_id OR NEW.target_kind <> OLD.target_kind OR NEW.target_id <> OLD.target_id
     OR NEW.person_id IS DISTINCT FROM OLD.person_id OR NEW.matter_id IS DISTINCT FROM OLD.matter_id
     OR NEW.why <> OLD.why OR NEW.proves_by IS DISTINCT FROM OLD.proves_by
     OR NEW.marked_by IS DISTINCT FROM OLD.marked_by OR NEW.marked_at <> OLD.marked_at OR NEW.proposed <> OLD.proposed THEN
    RAISE EXCEPTION 'legal_theme_marks: a mark is what it was when made; remove it with a reason and mark again' USING ERRCODE = '23514';
  END IF;
  IF OLD.removed_at IS NOT NULL AND (NEW.removed_at IS DISTINCT FROM OLD.removed_at OR NEW.removed_why <> OLD.removed_why) THEN
    RAISE EXCEPTION 'legal_theme_marks: a removed mark stays removed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS legal_theme_marks_guard ON public.legal_theme_marks;
CREATE TRIGGER legal_theme_marks_guard BEFORE UPDATE ON public.legal_theme_marks FOR EACH ROW EXECUTE FUNCTION public.legal_theme_marks_guard();

ALTER TABLE public.legal_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_theme_marks ENABLE ROW LEVEL SECURITY;

-- Devs: read, add, change (a theme's words, a mark's stamps). No delete policy exists on either table.
DROP POLICY IF EXISTS legal_themes_dev_select ON public.legal_themes;
CREATE POLICY legal_themes_dev_select ON public.legal_themes FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS legal_themes_dev_insert ON public.legal_themes;
CREATE POLICY legal_themes_dev_insert ON public.legal_themes FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS legal_themes_dev_update ON public.legal_themes;
CREATE POLICY legal_themes_dev_update ON public.legal_themes FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS legal_theme_marks_dev_select ON public.legal_theme_marks;
CREATE POLICY legal_theme_marks_dev_select ON public.legal_theme_marks FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS legal_theme_marks_dev_insert ON public.legal_theme_marks;
CREATE POLICY legal_theme_marks_dev_insert ON public.legal_theme_marks FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS legal_theme_marks_dev_update ON public.legal_theme_marks;
CREATE POLICY legal_theme_marks_dev_update ON public.legal_theme_marks FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());
GRANT SELECT, INSERT, UPDATE ON public.legal_themes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.legal_theme_marks TO authenticated;

-- The HR agent: reads both, proposes a theme or a mark, never keeps, removes or changes one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN
    GRANT SELECT, INSERT ON public.legal_themes TO hr_agent;
    GRANT SELECT, INSERT ON public.legal_theme_marks TO hr_agent;
    DROP POLICY IF EXISTS "hr_agent reads themes" ON public.legal_themes;
    CREATE POLICY "hr_agent reads themes" ON public.legal_themes FOR SELECT TO hr_agent USING (true);
    DROP POLICY IF EXISTS "hr_agent proposes a theme" ON public.legal_themes;
    CREATE POLICY "hr_agent proposes a theme" ON public.legal_themes FOR INSERT TO hr_agent WITH CHECK (proposed_by_agent AND kept_at IS NULL AND retired_at IS NULL);
    DROP POLICY IF EXISTS "hr_agent reads theme marks" ON public.legal_theme_marks;
    CREATE POLICY "hr_agent reads theme marks" ON public.legal_theme_marks FOR SELECT TO hr_agent USING (true);
    DROP POLICY IF EXISTS "hr_agent proposes a mark" ON public.legal_theme_marks;
    CREATE POLICY "hr_agent proposes a mark" ON public.legal_theme_marks FOR INSERT TO hr_agent WITH CHECK (proposed AND kept_at IS NULL AND removed_at IS NULL);
  END IF;
END $$;

-- New tables: the read-only fences and the twin fence, which create only what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
