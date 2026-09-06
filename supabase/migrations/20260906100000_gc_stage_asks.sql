SET lock_timeout = '3s';

-- v2.2934: the GC asks. On an offered stage the GC can ask for other dates;
-- the office accepts or answers with a window and a why; an accepted window
-- that no longer fits the sub's pick turns into a change request the sub
-- answers from their portal. Additive + idempotent.

ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS asked_start date;
ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS asked_end date;
ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS asked_note text;
ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS asked_at timestamptz;
ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS answered_at timestamptz;
ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS answer text;
ALTER TABLE public.job_stage_windows ADD COLUMN IF NOT EXISTS answer_note text;
ALTER TABLE public.job_stage_windows DROP CONSTRAINT IF EXISTS job_stage_windows_answer_check;
ALTER TABLE public.job_stage_windows
  ADD CONSTRAINT job_stage_windows_answer_check CHECK (answer IS NULL OR answer IN ('accepted', 'proposed'));
COMMENT ON COLUMN public.job_stage_windows.asked_start IS 'The GC''s ask (from their portal). answered_at / answer say how the office replied.';

ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS change_requested_at timestamptz;
ALTER TABLE public.step_commitments ADD COLUMN IF NOT EXISTS change_requested_note text;
COMMENT ON COLUMN public.step_commitments.change_requested_at IS 'The window moved under the sub''s pick — they re-pick from their portal; cleared when they do.';
