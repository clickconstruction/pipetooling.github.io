SET lock_timeout = '3s';

-- A job's kind (punch list #238, PR 1, v2.6329): service call or project, the office's own answer. The owner, 2026-11-01:
-- a project is priced before the first hour is worked, from a bid, an estimate or a handshake the office typed in, and
-- its price moves only by change orders; a service call is priced by the work and billed at the end. The app had four
-- signals that each said part of it (an HCP number against a Click number, a bid or a GC project behind the job, Stage
-- Plan rows, the customer's Res/Comm) and no kind; #234's hours baseline and #237's stage checklists were about to gate
-- on the customer's kind, which misfires both ways. The kernel src/lib/jobs/jobKind.ts reads the kind from the job's
-- own facts; this column is the office's press, which wins over the signals from then on. Nullable: a job nobody has
-- settled reads from the signals, and the Quickfill deck line (PR 2) lists the ones the signals cannot settle.
-- Additive, no table, no fences, no default, so no rewrite and no backfill: the column is one catalog write. See
-- docs/migrations/20261102043000_job_kind.md.

ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS kind text;

COMMENT ON COLUMN public.jobs_ledger.kind IS
  'A job''s kind (#238): service (priced by the work, billed at the end) or project (priced before the work, moved by change orders). Null until the office presses one on the New Job or Edit Job form, or New Job sees a price before any work that no other signal would keep; the kernel jobKind reads the signals meanwhile. The explicit kind wins over the signals.';

-- The two words only, on every write from here on. Left NOT VALID on purpose: every row is null today, so there is
-- nothing to prove, and db push sends a file as one transaction, so a VALIDATE here would scan this table under the
-- ADD COLUMN's lock, which is held to the commit.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_ledger_kind_known' AND conrelid = 'public.jobs_ledger'::regclass
  ) THEN
    ALTER TABLE public.jobs_ledger
      ADD CONSTRAINT jobs_ledger_kind_known CHECK (kind IS NULL OR kind IN ('service', 'project')) NOT VALID;
  END IF;
END $$;
