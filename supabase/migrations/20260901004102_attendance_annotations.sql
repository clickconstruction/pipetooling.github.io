SET lock_timeout = '3s';

-- v2.2556: excuse notes for the derived attendance ledger (Late-chip design
-- review, option G). The late FACT stays derived from clock records; this
-- table stores only the human context beside it ("Excused — dentist, told
-- office 7:40"). Append-only (no UPDATE/DELETE policies) — corrections are a
-- newer note; the ledger renders the latest per person-day. An annotation on
-- a day later corrected to not-late is a harmless orphan (never rendered).

CREATE TABLE IF NOT EXISTS public.attendance_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  note text NOT NULL,
  author_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.attendance_annotations IS
  'Excuse/context notes on derived attendance (late) days — append-only; latest note per subject/work_date renders and excuses the day from pattern counts (v2.2556).';

CREATE INDEX IF NOT EXISTS attendance_annotations_subject_idx
  ON public.attendance_annotations (subject_user_id, work_date);
CREATE INDEX IF NOT EXISTS attendance_annotations_date_idx
  ON public.attendance_annotations (work_date);

ALTER TABLE public.attendance_annotations ENABLE ROW LEVEL SECURITY;

-- Readers mirror the People → Writeups tab (dev / master / assistant / controller).
DROP POLICY IF EXISTS "Writeups staff can read attendance annotations" ON public.attendance_annotations;
CREATE POLICY "Writeups staff can read attendance annotations" ON public.attendance_annotations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() )
      AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
  ));

-- Writers: the same office set; author stamped as themselves.
DROP POLICY IF EXISTS "Writeups staff can add attendance annotations" ON public.attendance_annotations;
CREATE POLICY "Writeups staff can add attendance annotations" ON public.attendance_annotations FOR INSERT
  WITH CHECK (
    author_id = ( SELECT auth.uid() )
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = ( SELECT auth.uid() )
        AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
    )
  );

-- Deliberately NO UPDATE or DELETE policies: append-only, like person_file_entries.

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
