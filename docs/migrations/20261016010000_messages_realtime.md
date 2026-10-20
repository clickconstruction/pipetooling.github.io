# 20261016010000_messages_realtime.sql (2026-10-16, v2.5572)

Messages hears a new line as it lands (v2.5572): adds `public.messages` and `public.contacts` to the `supabase_realtime` publication, each only when not there yet, the way `20260608010000_job_activity_events.sql` added the ledger. No table, column or policy changes; `SET lock_timeout = '3s'` as every migration.

Apply order: any time around the client. Before the push the client's subscription hears nothing and the pages read as they did (once, and after their own presses); after it they re-read within a second of a text, a call, a delivery or a teammate's press.

Realtime applies the tables' own row policies to each subscriber (`gc_office_team()` for the office, `messages_tech_read` and `contacts_tech_read` for a tech on their job), so nobody hears a row they could not read. A policy that calls a function runs it once per change per subscriber; the office is a handful of people, so the cost is small. Rolling back is `alter publication supabase_realtime drop table public.messages, public.contacts`, which only silences the feed.
