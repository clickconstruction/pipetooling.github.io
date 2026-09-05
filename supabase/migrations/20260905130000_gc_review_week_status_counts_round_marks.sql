SET lock_timeout = '3s';

-- gc_review_week_status v3 (v2.2842): "Sent it" round marks count as sent.
--
-- The Wednesday GC-review nudge could never go green for a week worked through
-- the personal statement round — the ritual's preferred lane. `gcs_sent` read
-- only `gc_statement_emails` (app sends), while a "Sent it ✓" mark writes
-- `gc_statement_round_marks`. Live on a Wednesday evening the RPC returned
-- {outstanding 10, certified 10, sent 0} with every statement out by hand, so
-- the Dashboard badge stayed at 10 all week and told the office to "send each
-- statement off" — a duplicate-statement risk. The help guide already promised
-- "both count as sent everywhere"; the modal's strip (mergeMarksIntoLastSent)
-- already did; the morning round email's `last_statement` (v2.2812,
-- get_statement_round_for_user) already reads GREATEST(max sent-mark acted_at,
-- max gc_statement_emails.sent_at). This RPC was the last surface reading
-- emails alone.
--
-- Change (one predicate): a GC is `sent` this week when EITHER
--   * a gc_statement_emails row for that gc_customer_id was sent in the week
--     (Chicago calendar, unchanged from v2), OR
--   * a gc_statement_round_marks row for that GC has week_start = p_week_start
--     AND action = 'sent' — the same row the modal and
--     get_statement_round_for_user's `marks` CTE read.
-- Never `contacted` (v2.2813: "counts for the week and never as a statement")
-- and never `skipped`. Whole-report internal copies ("All GCs" schedules)
-- audit with gc_customer_id NULL and stay excluded — they never matched a GC.
-- `gcs_done` (certified AND sent) inherits the fix, so the Needs-you badge
-- finally reaches 0 and the Wednesday banner turns green.
--
-- Same signature, same four keys; the outstanding / certified maths are
-- byte-for-byte v2 (20260903184432). Idempotent.
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
          (
            -- An app send (Draft Message, a per-GC scheduled send) this week…
            exists (
              select 1 from public.gc_statement_emails e
              where e.gc_customer_id = g.gc_customer_id
                and (e.sent_at at time zone 'America/Chicago')::date >= p_week_start
            )
            -- …or a "Sent it" round mark for this week. Only action = 'sent':
            -- 'contacted' is a conversation, not a statement; 'skipped' defers.
            or exists (
              select 1 from public.gc_statement_round_marks m
              where m.gc_customer_id = g.gc_customer_id
                and m.week_start = p_week_start
                and m.action = 'sent'
            )
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
  'Dashboard GC-review nudge (v3 in v2.2842): GCs with live outstanding > 0 (board row math), certified = latest attestation this week still equals the live total, sent = a gc_statement_emails row this week OR a gc_statement_round_marks row (week_start = p_week_start, action = sent — never contacted/skipped), done = certified and sent. Whole-report copies (gc_customer_id NULL) never count.';

grant execute on function public.gc_review_week_status(date) to authenticated;
