SET lock_timeout = '3s';

-- v2.5572: Messages hears a new line as it lands. The Messages page, the thread window and Follow up read once and
-- again only after their own presses, so a text the webhook wrote stayed unseen until a reload. The client now
-- subscribes to changes on `messages` (a line in, a delivery, a tie) and `contacts` (who has it, a name, the Follow up
-- state) and re-reads; Realtime respects the tables' row policies, so each person hears only the rows they can read.
-- Idempotent, as job_activity_events' was (20260608010000).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contacts'
  ) then
    alter publication supabase_realtime add table public.contacts;
  end if;
end $$;
