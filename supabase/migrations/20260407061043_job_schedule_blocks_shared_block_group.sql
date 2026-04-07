-- Linked schedule legs: same time/note across assignees (Dispatch mirror / crew blocks).
ALTER TABLE public.job_schedule_blocks
  ADD COLUMN IF NOT EXISTS shared_block_group_id uuid NULL;

COMMENT ON COLUMN public.job_schedule_blocks.shared_block_group_id IS
  'When non-null, rows sharing this uuid are the same logical block (synced times/note); one row per assignee.';

CREATE INDEX IF NOT EXISTS idx_job_schedule_blocks_shared_group
  ON public.job_schedule_blocks (shared_block_group_id)
  WHERE shared_block_group_id IS NOT NULL;
