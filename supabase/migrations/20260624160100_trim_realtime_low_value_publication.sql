-- Trim low-value, low-churn tables out of the `supabase_realtime` publication.
--
-- Context (verified 2026-06-24): the publication had crept back to 11 tables and
-- ALL 11 currently have live client subscriptions, so there is no "dead"
-- subscription to remove the way PR #88 removed the Mercury allocation tables.
-- This trims only the two tables that (a) have a DEDICATED client channel — so
-- dropping them from the publication actually closes a Realtime channel rather
-- than leaving a shared one open — and (b) already have a clean non-realtime
-- refresh path, so the trade-off is just "no live auto-refresh while the surface
-- sits open":
--
--   estimates_thread_notes                  -- dedicated channel in useEstimateThreadNotes;
--                                              notes (re)load when a thread is expanded
--   quickfill_office_arriving_daily_checks   -- dedicated channel in QuickfillOfficeSection;
--                                              already refetched on tab visibility/focus
--
-- DELIBERATELY KEPT published (do NOT add here):
--   * clock_sessions / people_hours / people_crew_* / reports / job_activity_events
--     / job_collect_payment_flows / jobs_ledger_invoices — core live UX / dominant writers.
--   * jobs_ledger_thread_notes — its subscriptions ride inside SHARED multi-table
--     channels (useJobThreadNotes, useJobThreadNotesForModal) that stay open for
--     clock_sessions/job_activity_events/reports anyway, so trimming it would cost
--     live Stages note-badges + live job-modal notes for ~zero connection saving.
--
-- These two are tiny / low-write, so the CDC-load reduction is modest. The real
-- ceiling fixes for the 2026-06-05 / 2026-06-24 pool-exhaustion incidents are the
-- compute-tier bump and Auth percentage-based connections (Dashboard), not this
-- trim — see docs/runbooks/.
--
-- Pair with the client edits that drop the now-dead dedicated channels
-- (useEstimateThreadNotes, QuickfillOfficeSection); deploy the client first so
-- connected users do not lose live refresh before their bundle updates.
--
-- Guarded so it is re-runnable / drift-safe. Baseline (20250101000000) ADDs
-- these to the publication; this forward migration removes them so a fresh
-- `db reset` ends in the correct state (add -> drop). To revert, ALTER
-- PUBLICATION supabase_realtime ADD TABLE the names below.
do $$
declare
  t text;
begin
  foreach t in array array[
    'estimates_thread_notes',
    'quickfill_office_arriving_daily_checks'
  ]
  loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;
