SET lock_timeout = '3s';

-- Recent Reports inbox redesign (v2.1468): report_reads has tracked per-user
-- READ state since the baseline (upsert on expand, delete on mark-unread; RLS
-- own-rows select/insert/delete). The redesign adds the durable DONE state —
-- "Done" clears a report from the dashboard section on every device (the
-- full-screen View all still shows it) — replacing the section's
-- localStorage hidden/hide-on-refresh machinery. UI ships in the follow-up
-- client PR.

ALTER TABLE public.report_reads
  ADD COLUMN IF NOT EXISTS done_at timestamptz;

COMMENT ON COLUMN public.report_reads.done_at IS
  'Set by the Dashboard Recent Reports "Done" action (v2.1468): clears the report from the dashboard section cross-device; null = opened but still listed (dimmed). Cleared if the user marks the report unread.';

-- The baseline shipped select/insert/delete own-rows policies only (the old
-- flow never updated rows). Done toggling updates read rows in place.
DROP POLICY IF EXISTS "Users update own report reads" ON public.report_reads;
CREATE POLICY "Users update own report reads" ON public.report_reads
  FOR UPDATE USING (user_id = (SELECT auth.uid()));
