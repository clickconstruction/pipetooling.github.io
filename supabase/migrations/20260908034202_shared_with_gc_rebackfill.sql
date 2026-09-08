SET lock_timeout = '3s';

-- Stage Plan PR 4: the eye (jobs_ledger_fixtures.shared_with_gc) starts being
-- read — the Edit tab's Stages read-out, the customer drawer, the Subs → Work
-- GC chip. Between the v2.3083 push and the v2.3100 client (which carries the
-- column through the Job form's delete + reinsert save), a save reset the
-- column on any job edited in that window. Re-run the backfill: a line item
-- whose window was offered to the GC is shared. Idempotent.

UPDATE public.jobs_ledger_fixtures f
   SET shared_with_gc = true
  FROM public.job_stage_windows w
 WHERE w.fixture_id = f.id
   AND w.offered_to_gc
   AND NOT f.shared_with_gc;
