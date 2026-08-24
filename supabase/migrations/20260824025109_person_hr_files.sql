SET lock_timeout = '3s';

-- v2.2220 (HR files): dev-only employee files on People → HR. Two layers:
--   person_file_entries — append-only raw log (facts with dates). Deliberately
--     has NO UPDATE/DELETE policies: corrections are new entries, so history
--     can never be silently rewritten. Break-glass edits are dev SQL only.
--   person_files — the two curated documents per person ('summary',
--     'narrative'), freely rewritable by devs/the agent; regenerable from the
--     entries if ever mangled.
-- Keyed on people.id (never name text — PERSON_IDENTITY invariant #1).
-- entry_date is supplied by the client/agent in APP_CALENDAR_TZ, not defaulted
-- server-side (server UTC crosses midnight early).
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.person_file_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  content text NOT NULL,
  -- conversation | payroll_event | incident | review | milestone | job_event
  source text NOT NULL DEFAULT 'conversation',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.person_file_entries IS
  'HR files raw log (v2.2220): append-only dated facts about a person, dev-only. No UPDATE/DELETE policies by design — corrections are new entries. The curated person_files docs are derived from these.';

CREATE INDEX IF NOT EXISTS idx_person_file_entries_person_date
  ON public.person_file_entries (person_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS public.person_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('summary', 'narrative')),
  content text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, kind)
);

COMMENT ON TABLE public.person_files IS
  'HR files curated docs (v2.2220): one summary + one narrative per person, dev-only, maintained mostly by the agent. Rewritable — the append-only person_file_entries log is the source of truth.';

ALTER TABLE public.person_file_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_files ENABLE ROW LEVEL SECURITY;

-- Entries: devs read and append. Append-only is enforced by the ABSENCE of
-- UPDATE/DELETE policies — do not add them.
DROP POLICY IF EXISTS "Devs can read person file entries" ON public.person_file_entries;
CREATE POLICY "Devs can read person file entries" ON public.person_file_entries
  FOR SELECT USING (public.is_dev());
DROP POLICY IF EXISTS "Devs can append person file entries" ON public.person_file_entries;
CREATE POLICY "Devs can append person file entries" ON public.person_file_entries
  FOR INSERT WITH CHECK (public.is_dev());

-- Curated files: devs manage fully.
DROP POLICY IF EXISTS "Devs can manage person files" ON public.person_files;
CREATE POLICY "Devs can manage person files" ON public.person_files
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
