-- Tracks which reports a user has marked as read (Dashboard Recent Reports)
CREATE TABLE public.report_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, report_id)
);
COMMENT ON TABLE public.report_reads IS 'Reports a user has marked as read in Dashboard Recent Reports.';
CREATE INDEX IF NOT EXISTS idx_report_reads_user_id ON public.report_reads(user_id);
ALTER TABLE public.report_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own report reads"
  ON public.report_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own report reads"
  ON public.report_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own report reads"
  ON public.report_reads FOR DELETE
  USING (auth.uid() = user_id);
