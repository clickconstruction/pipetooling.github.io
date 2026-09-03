SET lock_timeout = '3s';

-- gc_review_week_status v2 (v2.2705). The Dashboard "GC review is still due"
-- card read "10 of 10 certified · 0 sent" with a badge of 0 while the modal
-- said "8 of 11". Three disagreements with the client's gcReviewWeekProgress
-- kernel, all fixed here so the two surfaces count the same way:
--
--  1. A certification counted even after the group changed (a new bill or a
--     payment since sign-off). The client drops such a group back to
--     "certify to release"; now so does this: a GC is certified only when its
--     latest attestation total still equals the live outstanding total.
--  2. Per-row money now mirrors the board: a billed job with no billed invoice
--     is one shell row (revenue − payments_made); otherwise its billed invoices
--     carry the money (amount − payments linked to the invoice), and billed
--     invoices on waiting/working/ready-to-bill jobs count too. A GC counts
--     as outstanding only when that total is > 0 — the client-side rule
--     changed in the same release, so a fully paid job still marked billed
--     no longer inflates either side.
--  3. `gcs_done` — GCs both certified AND sent this week — so the Needs-you
--     badge can show what's actually left instead of outstanding − certified.
--
-- Additive: the three v1 keys keep their names; clients that don't know
-- gcs_done ignore it.
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
      with inv_open as (
        select i.id, i.job_id,
          greatest(0, coalesce(i.amount, 0) - coalesce((
            select sum(p.amount) from public.jobs_ledger_payments p where p.invoice_id = i.id
          ), 0)) as remaining
        from public.jobs_ledger_invoices i
        where i.status = 'billed'
      ),
      job_rows as (
        select j.gc_customer_id, coalesce(j.revenue, 0) - coalesce(j.payments_made, 0) as remaining
        from public.jobs_ledger j
        where j.status = 'billed'
          and j.collections_at is null
          and j.gc_customer_id is not null
          and not exists (select 1 from inv_open o where o.job_id = j.id)
        union all
        select j.gc_customer_id, o.remaining
        from inv_open o
        join public.jobs_ledger j on j.id = o.job_id
        where j.collections_at is null
          and j.gc_customer_id is not null
          and (j.status is null or j.status in ('waiting','working','ready_to_bill','billed'))
      ),
      gc_live as (
        select gc_customer_id, sum(remaining) as live_total
        from job_rows
        group by gc_customer_id
        having sum(remaining) > 0
      ),
      latest_cert as (
        select distinct on (gc_customer_id) gc_customer_id, total
        from public.gc_review_certifications
        where week_start = p_week_start
        order by gc_customer_id, certified_at desc
      ),
      flags as (
        select g.gc_customer_id,
          (lc.total is not null and round(lc.total::numeric, 2) = round(g.live_total::numeric, 2)) as certified,
          exists (
            select 1 from public.gc_statement_emails e
            where e.gc_customer_id = g.gc_customer_id
              and (e.sent_at at time zone 'America/Chicago')::date >= p_week_start
          ) as sent
        from gc_live g
        left join latest_cert lc on lc.gc_customer_id = g.gc_customer_id
      )
      select jsonb_build_object(
        'gcs_outstanding', count(*),
        'gcs_certified', count(*) filter (where certified),
        'gcs_sent', count(*) filter (where sent),
        'gcs_done', count(*) filter (where certified and sent)
      )
      from flags
    )
  end;
$$;

comment on function public.gc_review_week_status(date) is
  'Dashboard GC-review nudge (v2 in v2.2705): GCs with live outstanding > 0 (board row math), certified = latest attestation this week still equals the live total, sent = a gc_statement_emails row this week, done = certified and sent.';

grant execute on function public.gc_review_week_status(date) to authenticated;
