-- Enforce minimum block length (aligns with client: JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES).
-- Before applying on a database with existing rows, run:
--   SELECT id FROM job_schedule_blocks WHERE (time_end - time_start) < interval '30 minutes';

ALTER TABLE public.job_schedule_blocks
  ADD CONSTRAINT job_schedule_blocks_min_duration_30m CHECK (
    (time_end - time_start) >= interval '30 minutes'
  );
