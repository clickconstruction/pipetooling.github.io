-- Chronological thread notes on estimates (Estimates Stages expand row; append-only).

CREATE TABLE public.estimates_thread_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.estimates_thread_notes IS
  'Chronological staff notes on estimates; SELECT/INSERT aligned with estimate list visibility.';

CREATE INDEX idx_estimates_thread_notes_estimate_created
  ON public.estimates_thread_notes (estimate_id, created_at);

ALTER TABLE public.estimates_thread_notes ENABLE ROW LEVEL SECURITY;

-- Same visibility shape as estimate_customer_events_select (staff roles + parent estimate access).
CREATE POLICY estimates_thread_notes_select
  ON public.estimates_thread_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN (
          'dev',
          'master_technician',
          'assistant',
          'estimator',
          'primary',
          'superintendent'
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = estimates_thread_notes.estimate_id
        AND (
          public.user_can_access_estimate(e)
          OR public.superintendent_can_access_estimate(e)
          OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
              AND role IN (
                'dev',
                'assistant',
                'estimator',
                'master_technician',
                'primary'
              )
          )
        )
    )
  );

CREATE POLICY estimates_thread_notes_insert
  ON public.estimates_thread_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN (
          'dev',
          'master_technician',
          'assistant',
          'estimator',
          'primary',
          'superintendent'
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = estimates_thread_notes.estimate_id
        AND (
          public.user_can_access_estimate(e)
          OR public.superintendent_can_access_estimate(e)
          OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
              AND role IN (
                'dev',
                'assistant',
                'estimator',
                'master_technician',
                'primary'
              )
          )
        )
    )
  );

GRANT SELECT, INSERT ON public.estimates_thread_notes TO authenticated;

CREATE OR REPLACE FUNCTION public.estimates_thread_note_stats(p_estimate_ids uuid[])
RETURNS TABLE (
  estimate_id uuid,
  note_count bigint,
  last_note_at timestamptz,
  last_note_body text,
  last_note_author_name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      n.estimate_id,
      n.created_at,
      left(n.body, 400) AS body_prev,
      u.name AS author_nm,
      count(*) OVER (PARTITION BY n.estimate_id) AS note_count_val,
      row_number() OVER (PARTITION BY n.estimate_id ORDER BY n.created_at DESC) AS rn
    FROM public.estimates_thread_notes n
    LEFT JOIN public.users u ON u.id = n.author_user_id
    WHERE n.estimate_id = ANY(p_estimate_ids)
  )
  SELECT
    r.estimate_id,
    r.note_count_val::bigint AS note_count,
    r.created_at AS last_note_at,
    r.body_prev AS last_note_body,
    r.author_nm AS last_note_author_name
  FROM ranked r
  WHERE r.rn = 1;
$$;

COMMENT ON FUNCTION public.estimates_thread_note_stats(uuid[]) IS
  'Per-estimate thread aggregates for Estimates Stages: count, last note time, preview body (400 chars), author display name; estimates with ≥1 note only. Single-scan aggregation.';

GRANT EXECUTE ON FUNCTION public.estimates_thread_note_stats(uuid[]) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'estimates_thread_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estimates_thread_notes;
  END IF;
END
$$;
