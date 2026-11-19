SET lock_timeout = '3s';

-- Painted maps, Your last jobs (punch list #392, call 14): the jobs a person changed in the app.
--
-- The picker reads the job activity record by who made the change, newest first:
--   select job_id, occurred_at from job_activity_events
--   where actor_user_id = <me> order by occurred_at desc limit 200
-- Until now the record had an index by job and one by source, and none by person. Without one that
-- read walks the whole table, then runs the read rule (can_read_job_activity, a function a row) on
-- every row the person made before it can sort them. With this index it walks the person's newest
-- rows in order and stops at 200.
--
-- Partial on rows that have an actor: rows written by a trigger with no person behind them are
-- never read this way, and leaving them out keeps the index small.
--
-- Additive and idempotent. The table is small, so a plain CREATE INDEX builds in well under a
-- second. It holds off writes to the record for that moment only; the lock timeout above makes the
-- push fail fast instead of queueing behind a long write.
CREATE INDEX IF NOT EXISTS job_activity_events_actor_occurred_idx
  ON public.job_activity_events (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
