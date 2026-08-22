SET lock_timeout = '3s';

-- Personal statement rounds (owner-approved mockup, 2026-08-22): each cert
-- week, every GC over the outstanding threshold becomes a personal-email
-- to-do for its assigned sender — released only once the GC is certified
-- (gc_review_certifications). The app plans and tracks; a person sends from
-- their own inbox. Two pieces:
--
-- 1. customers.statement_sender_user_id — standing "who sends this GC their
--    statement" assignment (falls back client-side to the GC's Account Man).
-- 2. gc_statement_round_marks — one row per (week, GC): the sender marked it
--    sent (after emailing personally) or skipped for the week. Upsertable —
--    a skip can become a sent within the same week.

begin;

alter table public.customers
  add column if not exists statement_sender_user_id uuid references public.users(id) on delete set null;

comment on column public.customers.statement_sender_user_id is
  'Standing sender for this GC''s weekly personal statement round (v2.2072). NULL = derive from the GC''s jobs'' Account Man.';

create table if not exists public.gc_statement_round_marks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  gc_customer_id uuid not null references public.customers(id) on delete cascade,
  action text not null check (action in ('sent', 'skipped')),
  acted_by uuid references public.users(id) on delete set null,
  acted_by_name text not null default '',
  acted_at timestamptz not null default now(),
  unique (week_start, gc_customer_id)
);

comment on table public.gc_statement_round_marks is
  'Personal statement round marks (v2.2072): the assigned sender emailed this GC''s certified statement from their own inbox this week (sent) or deferred it (skipped). One row per (week, GC), upsertable; feeds the last-sent pills and round progress.';

create index if not exists idx_gc_stmt_round_marks_week
  on public.gc_statement_round_marks (week_start, gc_customer_id);

alter table public.gc_statement_round_marks enable row level security;

drop policy if exists gc_statement_round_marks_select on public.gc_statement_round_marks;
create policy gc_statement_round_marks_select on public.gc_statement_round_marks for select using (
  exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = any (array['dev','master_technician','assistant','controller','primary']::public.user_role[])
  )
);

drop policy if exists gc_statement_round_marks_insert on public.gc_statement_round_marks;
create policy gc_statement_round_marks_insert on public.gc_statement_round_marks for insert with check (
  acted_by = (select auth.uid())
  and exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = any (array['dev','master_technician','assistant','controller']::public.user_role[])
  )
);

drop policy if exists gc_statement_round_marks_update on public.gc_statement_round_marks;
create policy gc_statement_round_marks_update on public.gc_statement_round_marks for update using (
  exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = any (array['dev','master_technician','assistant','controller']::public.user_role[])
  )
) with check (
  acted_by = (select auth.uid())
);

drop policy if exists gc_statement_round_marks_delete on public.gc_statement_round_marks;
create policy gc_statement_round_marks_delete on public.gc_statement_round_marks for delete using (
  exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = any (array['dev','master_technician','assistant','controller']::public.user_role[])
  )
);

commit;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
