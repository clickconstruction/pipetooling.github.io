-- Chronological thread notes on jobs (Jobs Stages expand row; append-only).

CREATE TABLE public.jobs_ledger_thread_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.jobs_ledger_thread_notes IS 'Chronological notes on jobs_ledger; SELECT/INSERT aligned with job_status_events job visibility.';

CREATE INDEX idx_jobs_ledger_thread_notes_job_created
  ON public.jobs_ledger_thread_notes (job_id, created_at);

ALTER TABLE public.jobs_ledger_thread_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_ledger_thread_notes_select"
  ON public.jobs_ledger_thread_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = jobs_ledger_thread_notes.job_id
        AND (
          j.master_user_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), j.master_user_id)
          OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
        )
    )
  );

CREATE POLICY "jobs_ledger_thread_notes_insert"
  ON public.jobs_ledger_thread_notes FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = jobs_ledger_thread_notes.job_id
        AND (
          j.master_user_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = j.master_user_id)
          OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = j.master_user_id AND assistant_id = auth.uid())
          OR public.assistants_share_master(auth.uid(), j.master_user_id)
          OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = j.id AND user_id = auth.uid())
        )
    )
  );

-- RPC: note count and last activity per job for Stages row badges (RLS applies).
CREATE OR REPLACE FUNCTION public.jobs_ledger_thread_note_stats(p_job_ids uuid[])
RETURNS TABLE (job_id uuid, note_count bigint, last_note_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT n.job_id,
         count(*)::bigint AS note_count,
         max(n.created_at) AS last_note_at
  FROM public.jobs_ledger_thread_notes n
  WHERE n.job_id = ANY(p_job_ids)
  GROUP BY n.job_id
$$;

COMMENT ON FUNCTION public.jobs_ledger_thread_note_stats(uuid[]) IS 'Aggregates thread notes for Jobs Stages expand badges; empty input returns no rows.';

GRANT EXECUTE ON FUNCTION public.jobs_ledger_thread_note_stats(uuid[]) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jobs_ledger_thread_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs_ledger_thread_notes;
  END IF;
END
$$;
