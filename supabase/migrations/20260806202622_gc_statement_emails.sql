SET lock_timeout = '3s';

-- GC statement emails audit (v2.1415, phase 2 of sending statements to GCs).
-- One row per statement the app emails to a GC via the send-gc-statement-email
-- edge function. Feeds the GC Review modal's "last sent {date}" hint and
-- answers "did anyone send Knight their statement this month?".
--
-- Writes come ONLY from the edge function (service role — bypasses RLS), so
-- there is deliberately no INSERT/UPDATE/DELETE policy for authenticated.
-- gc_customer_id is SET NULL on customer delete; gc_name snapshots the name so
-- audit rows stay meaningful.

begin;

create table if not exists public.gc_statement_emails (
  id uuid primary key default gen_random_uuid(),
  gc_customer_id uuid references public.customers(id) on delete set null,
  gc_name text not null,
  group_by text not null default 'gc' check (group_by in ('gc', 'development')),
  sent_to text not null,
  subject text not null,
  total numeric not null,
  job_count integer not null,
  sent_by uuid references public.users(id) on delete set null,
  sent_by_name text not null default '',
  resend_email_id text,
  sent_at timestamptz not null default now()
);

comment on table public.gc_statement_emails is
  'Audit of GC statement emails sent by the send-gc-statement-email edge function (v2.1415). Inserted with the service role only; clients read for the GC Review "last sent" hint.';

create index if not exists idx_gc_statement_emails_gc_sent_at
  on public.gc_statement_emails (gc_customer_id, sent_at desc);

alter table public.gc_statement_emails enable row level security;

drop policy if exists gc_statement_emails_select on public.gc_statement_emails;
create policy gc_statement_emails_select on public.gc_statement_emails for select using (
  exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = any (array['dev','master_technician','assistant','controller','primary']::public.user_role[])
  )
);

commit;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
