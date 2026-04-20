-- Optional link from pay stub additional line to originating clock session (e.g. prevailing wage top-up).
-- One line per session per stub when source_clock_session_id is set.

ALTER TABLE public.pay_stub_additional_lines
  ADD COLUMN IF NOT EXISTS source_clock_session_id UUID REFERENCES public.clock_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pay_stub_additional_lines_stub_session_uniq
  ON public.pay_stub_additional_lines (pay_stub_id, source_clock_session_id)
  WHERE source_clock_session_id IS NOT NULL;

COMMENT ON COLUMN public.pay_stub_additional_lines.source_clock_session_id IS
  'Optional clock session this additional line was generated from (e.g. prevailing wage); at most one row per stub per session when set.';
