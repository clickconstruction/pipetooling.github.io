SET lock_timeout = '3s';

-- Wednesday GC certification (v2.1980, phase 1 of the weekly certify-and-send
-- ritual). One row per office attestation that a GC's Billed Awaiting Payment
-- group is accurate for a given week: who certified, when, against what
-- (a row snapshot — job/invoice keys + remaining — so the client can show
-- "changed since certified" with a dollar delta). Append-only: re-certifying
-- inserts a new row; the latest row per (week, GC) wins and history is free.
--
-- gc_review_week_status() feeds the Dashboard nudge: how many GCs have
-- outstanding billed money this week, how many are certified, how many were
-- sent their statement (gc_statement_emails audit). Distinct-GC counting only
-- — deliberately none of the client's invoice-bundling row logic, which stays
-- in the gcReviewRollup kernel.

begin;

create table if not exists public.gc_review_certifications (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  gc_customer_id uuid not null references public.customers(id) on delete cascade,
  certified_by uuid references public.users(id) on delete set null,
  certified_by_name text not null default '',
  certified_at timestamptz not null default now(),
  job_count integer not null,
  total numeric not null,
  snapshot jsonb not null,
  note text not null default ''
);

comment on table public.gc_review_certifications is
  'Weekly GC Review attestations (v2.1980): office staff certify a GC''s Billed Awaiting Payment group is accurate. Append-only; latest per (week_start, gc_customer_id) wins. snapshot holds the certified rows so the client can flag "changed since certified".';

create index if not exists idx_gc_review_certs_week_gc_at
  on public.gc_review_certifications (week_start, gc_customer_id, certified_at desc);

alter table public.gc_review_certifications enable row level security;

drop policy if exists gc_review_certifications_select on public.gc_review_certifications;
create policy gc_review_certifications_select on public.gc_review_certifications for select using (
  exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = any (array['dev','master_technician','assistant','controller','primary']::public.user_role[])
  )
);

drop policy if exists gc_review_certifications_insert on public.gc_review_certifications;
create policy gc_review_certifications_insert on public.gc_review_certifications for insert with check (
  certified_by = (select auth.uid())
  and exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = any (array['dev','master_technician','assistant','controller']::public.user_role[])
  )
);

-- Dashboard nudge spine: distinct GCs with outstanding non-collections billed
-- money, vs certified and sent this week. Remaining math mirrors the board's
-- per-row basis (job shell: revenue − payments_made; invoice: amount − linked
-- payments); which GCs owe is bundling-independent, so this can't drift from
-- the client rollup's grouping.
create or replace function public.gc_review_week_status(p_week_start date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.role = any (array['dev','master_technician','assistant','controller','primary']::public.user_role[])
    ) then jsonb_build_object('error', 'not allowed')
    else (
      with outstanding_gcs as (
        select j.gc_customer_id
        from public.jobs_ledger j
        where j.gc_customer_id is not null
          and j.collections_at is null
          and j.status = 'billed'
          and coalesce(j.revenue, 0) - coalesce(j.payments_made, 0) > 0
        union
        select j.gc_customer_id
        from public.jobs_ledger_invoices i
        join public.jobs_ledger j on j.id = i.job_id
        where j.gc_customer_id is not null
          and j.collections_at is null
          and (j.status is null or j.status in ('waiting','working','ready_to_bill','billed'))
          and i.status = 'billed'
          and coalesce(i.amount, 0) - coalesce((
            select sum(p.amount) from public.jobs_ledger_payments p where p.invoice_id = i.id
          ), 0) > 0
      )
      select jsonb_build_object(
        'gcs_outstanding', (select count(*) from outstanding_gcs),
        'gcs_certified', (
          select count(distinct c.gc_customer_id)
          from public.gc_review_certifications c
          where c.week_start = p_week_start
            and c.gc_customer_id in (select gc_customer_id from outstanding_gcs)
        ),
        'gcs_sent', (
          select count(distinct e.gc_customer_id)
          from public.gc_statement_emails e
          where (e.sent_at at time zone 'America/Chicago')::date >= p_week_start
            and e.gc_customer_id in (select gc_customer_id from outstanding_gcs)
        )
      )
    )
  end;
$$;

commit;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
