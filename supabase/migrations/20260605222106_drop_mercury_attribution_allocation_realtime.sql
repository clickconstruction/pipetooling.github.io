-- Drop mercury_transaction_job_allocations + mercury_transaction_attributions from Supabase
-- Realtime. Continues PR #85 (mercury_transactions): both are churned by the Mercury sync +
-- field tally/allocation flows, not by their reader. The only live consumer is the per-user
-- review modal (useUserMercuryWindow), which already loads on mount and refetches after the
-- user's own edits -> degrades to "loads on open, no auto-refresh while idle-open" (same
-- trade-off accepted in PR #85). Baseline (20250101000000) ADDs these to the publication;
-- this forward migration removes them so a fresh `db reset` ends correct (add -> drop).
-- Guarded so it is re-runnable / drift-safe.
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public'
               and tablename = 'mercury_transaction_job_allocations') then
    alter publication supabase_realtime drop table public.mercury_transaction_job_allocations;
  end if;
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public'
               and tablename = 'mercury_transaction_attributions') then
    alter publication supabase_realtime drop table public.mercury_transaction_attributions;
  end if;
end $$;
