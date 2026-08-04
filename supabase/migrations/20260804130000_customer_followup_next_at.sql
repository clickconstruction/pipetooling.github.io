SET lock_timeout = '3s';

-- Followup Phase 3 (v2.1389): Call sessions promise a next follow-up date
-- before hangup, and the call queue orders by those promises — overdue
-- promises first, then no-promise builders by staleness, then future
-- promises by due date. Additive column on the PR-A prefs table; no new
-- table, so no read-only sweep needed.

ALTER TABLE public.customer_followup_prefs
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz;

COMMENT ON COLUMN public.customer_followup_prefs.next_followup_at IS
  'Promised next follow-up instant, set when ending a call session (or cleared). Queue ordering: overdue promises float to the top of the Oldest-first call queue; future promises sink below the staleness-ordered builders until due.';
