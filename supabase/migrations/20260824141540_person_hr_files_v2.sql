SET lock_timeout = '3s';

-- v2.2232 (HR files v2 — agent foundations). Four related upgrades to the
-- People → HR files system (v2.2220), all additive and idempotent:
--   1. person_file_revisions — a BEFORE UPDATE trigger on person_files archives
--      the prior content of every summary/narrative rewrite. The curated docs
--      were the only HR layer that lost history; now nothing does.
--   2. person_files.covered_through — the writer's explicit "this doc reflects
--      entries created through T" marker. The freshness kernel prefers it over
--      updated_at inference (v2.2230 UI change).
--   3. author_label on person_files + person_file_entries — provenance for
--      non-user writers (the agent has no auth.uid(); created_by/updated_by
--      stay NULL for it).
--   4. hr_agent_write(jsonb) RPC + hr_agent role — one validated, atomic,
--      least-privilege entrypoint for agent writes. The role's RLS policies
--      make entries append-only BY POLICY for the agent (previously the agent
--      wrote as service-role/postgres, bound only by convention). The role is
--      created WITHOUT a password; set one out-of-band (never in git):
--        ALTER ROLE hr_agent WITH LOGIN PASSWORD '<generated>';

-- ── 2/3: additive columns ────────────────────────────────────────────────────
ALTER TABLE public.person_files ADD COLUMN IF NOT EXISTS covered_through timestamptz;
ALTER TABLE public.person_files ADD COLUMN IF NOT EXISTS author_label text;
ALTER TABLE public.person_file_entries ADD COLUMN IF NOT EXISTS author_label text;

COMMENT ON COLUMN public.person_files.covered_through IS
  'Entries created at or before this instant are folded into this doc (v2.2232). Set by the writer; freshness falls back to updated_at when NULL.';
COMMENT ON COLUMN public.person_files.author_label IS
  'Free-text provenance for non-user writers, e.g. "HR agent" (v2.2232). NULL for UI writes (updated_by covers those).';
COMMENT ON COLUMN public.person_file_entries.author_label IS
  'Free-text provenance for non-user writers, e.g. "HR agent" (v2.2232). NULL for UI writes (created_by covers those).';

-- ── 1: revisions table + archive trigger ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.person_file_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  kind text NOT NULL,
  content text NOT NULL,
  covered_through timestamptz,
  author_label text,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  -- who replaced this version (taken from the NEW row that overwrote it)
  replaced_by uuid,
  replaced_by_label text
);

COMMENT ON TABLE public.person_file_revisions IS
  'HR files doc history (v2.2232): the prior version of every person_files content rewrite, archived by trigger. Dev read-only; rows are written ONLY by the definer trigger — no INSERT/UPDATE/DELETE policies by design.';

CREATE INDEX IF NOT EXISTS idx_person_file_revisions_person_kind
  ON public.person_file_revisions (person_id, kind, replaced_at DESC);

ALTER TABLE public.person_file_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs can read person file revisions" ON public.person_file_revisions;
CREATE POLICY "Devs can read person file revisions" ON public.person_file_revisions
  FOR SELECT USING (public.is_dev());

CREATE OR REPLACE FUNCTION public.person_files_archive_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content
     OR OLD.covered_through IS DISTINCT FROM NEW.covered_through THEN
    INSERT INTO public.person_file_revisions
      (person_id, kind, content, covered_through, author_label, replaced_at, replaced_by, replaced_by_label)
    VALUES
      (OLD.person_id, OLD.kind, OLD.content, OLD.covered_through, OLD.author_label, now(), NEW.updated_by, NEW.author_label);
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS person_files_archive_revision ON public.person_files;
CREATE TRIGGER person_files_archive_revision
  BEFORE UPDATE ON public.person_files
  FOR EACH ROW EXECUTE FUNCTION public.person_files_archive_revision();

-- ── 4: the agent write RPC ───────────────────────────────────────────────────
-- One atomic call: append N validated entries, optionally rewrite the summary,
-- optionally rewrite OR append to the narrative, stamping author_label and
-- covered_through. Payload:
--   { "person_id": uuid, "author_label"?: text (default 'HR agent'),
--     "entries"?: [{ "entry_date": "YYYY-MM-DD", "content": text, "source"?: text }],
--     "summary"?: text, "narrative"?: text, "narrative_append"?: text,
--     "covered_through"?: timestamptz (default now()) }
CREATE OR REPLACE FUNCTION public.hr_agent_write(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_person uuid;
  v_label text;
  v_covered timestamptz;
  v_summary text;
  v_narr text;
  v_narr_append text;
  e jsonb;
  n_entries integer := 0;
  allowed_sources constant text[] :=
    ARRAY['conversation','payroll_event','incident','review','milestone','job_event'];
BEGIN
  v_person := (p->>'person_id')::uuid;
  IF v_person IS NULL THEN
    RAISE EXCEPTION 'hr_agent_write: person_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = v_person) THEN
    RAISE EXCEPTION 'hr_agent_write: person % not found', v_person;
  END IF;

  v_label := COALESCE(NULLIF(btrim(p->>'author_label'), ''), 'HR agent');
  v_covered := COALESCE((p->>'covered_through')::timestamptz, now());
  v_summary := p->>'summary';
  v_narr := p->>'narrative';
  v_narr_append := p->>'narrative_append';
  IF v_narr IS NOT NULL AND v_narr_append IS NOT NULL THEN
    RAISE EXCEPTION 'hr_agent_write: narrative and narrative_append are mutually exclusive';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p->'entries', '[]'::jsonb)) LOOP
    IF NULLIF(btrim(COALESCE(e->>'content', '')), '') IS NULL THEN
      RAISE EXCEPTION 'hr_agent_write: entry content is required';
    END IF;
    IF e->>'entry_date' IS NULL THEN
      RAISE EXCEPTION 'hr_agent_write: entry_date is required';
    END IF;
    IF NOT (COALESCE(e->>'source', 'conversation') = ANY (allowed_sources)) THEN
      RAISE EXCEPTION 'hr_agent_write: unknown source "%"', e->>'source';
    END IF;
    INSERT INTO public.person_file_entries (person_id, entry_date, content, source, author_label)
    VALUES (v_person, (e->>'entry_date')::date, e->>'content',
            COALESCE(e->>'source', 'conversation'), v_label);
    n_entries := n_entries + 1;
  END LOOP;

  IF v_summary IS NOT NULL THEN
    INSERT INTO public.person_files (person_id, kind, content, author_label, covered_through, updated_at)
    VALUES (v_person, 'summary', v_summary, v_label, v_covered, now())
    ON CONFLICT (person_id, kind) DO UPDATE
      SET content = EXCLUDED.content,
          author_label = EXCLUDED.author_label,
          covered_through = EXCLUDED.covered_through,
          updated_at = now();
  END IF;

  IF v_narr IS NOT NULL THEN
    INSERT INTO public.person_files (person_id, kind, content, author_label, covered_through, updated_at)
    VALUES (v_person, 'narrative', v_narr, v_label, v_covered, now())
    ON CONFLICT (person_id, kind) DO UPDATE
      SET content = EXCLUDED.content,
          author_label = EXCLUDED.author_label,
          covered_through = EXCLUDED.covered_through,
          updated_at = now();
  ELSIF v_narr_append IS NOT NULL THEN
    INSERT INTO public.person_files (person_id, kind, content, author_label, covered_through, updated_at)
    VALUES (v_person, 'narrative', v_narr_append, v_label, v_covered, now())
    ON CONFLICT (person_id, kind) DO UPDATE
      SET content = public.person_files.content || E'\n' || EXCLUDED.content,
          author_label = EXCLUDED.author_label,
          covered_through = EXCLUDED.covered_through,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'entries_inserted', n_entries,
    'summary_written', v_summary IS NOT NULL,
    'narrative_written', (v_narr IS NOT NULL OR v_narr_append IS NOT NULL));
END
$fn$;

REVOKE ALL ON FUNCTION public.hr_agent_write(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_agent_write(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.hr_agent_write(jsonb) FROM authenticated;

-- ── 4b: the least-privilege agent role ───────────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN
    CREATE ROLE hr_agent LOGIN NOINHERIT;
  END IF;
END
$do$;

GRANT USAGE ON SCHEMA public TO hr_agent;
GRANT SELECT ON public.people TO hr_agent;
GRANT SELECT, INSERT ON public.person_file_entries TO hr_agent;
GRANT SELECT, INSERT, UPDATE ON public.person_files TO hr_agent;
GRANT SELECT ON public.person_file_revisions TO hr_agent;
GRANT EXECUTE ON FUNCTION public.hr_agent_write(jsonb) TO hr_agent;

-- RLS binds hr_agent like anyone else; give it exactly the verbs it may use.
-- Entries: SELECT + INSERT only — append-only holds for the agent BY POLICY.
DROP POLICY IF EXISTS "hr_agent reads person file entries" ON public.person_file_entries;
CREATE POLICY "hr_agent reads person file entries" ON public.person_file_entries
  FOR SELECT TO hr_agent USING (true);
DROP POLICY IF EXISTS "hr_agent appends person file entries" ON public.person_file_entries;
CREATE POLICY "hr_agent appends person file entries" ON public.person_file_entries
  FOR INSERT TO hr_agent WITH CHECK (true);

DROP POLICY IF EXISTS "hr_agent reads person files" ON public.person_files;
CREATE POLICY "hr_agent reads person files" ON public.person_files
  FOR SELECT TO hr_agent USING (true);
DROP POLICY IF EXISTS "hr_agent inserts person files" ON public.person_files;
CREATE POLICY "hr_agent inserts person files" ON public.person_files
  FOR INSERT TO hr_agent WITH CHECK (true);
DROP POLICY IF EXISTS "hr_agent updates person files" ON public.person_files;
CREATE POLICY "hr_agent updates person files" ON public.person_files
  FOR UPDATE TO hr_agent USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "hr_agent reads person file revisions" ON public.person_file_revisions;
CREATE POLICY "hr_agent reads person file revisions" ON public.person_file_revisions
  FOR SELECT TO hr_agent USING (true);

DROP POLICY IF EXISTS "hr_agent reads people" ON public.people;
CREATE POLICY "hr_agent reads people" ON public.people
  FOR SELECT TO hr_agent USING (true);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
