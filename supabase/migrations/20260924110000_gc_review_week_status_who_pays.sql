SET lock_timeout = '3s';

-- gc_review_week_status v4 (v2.3811): a job counts for its GC only when the GC pays it.
--
-- Taunya, 2026-09-24: the GC Review modal read "14 of 14 certified" while the
-- Dashboard's Needs You card read "13 of 14". The modal groups Billed rows by
-- WHO PAYS (gcThatPaysRow → effectiveInvoiceParty, v2.3374 / v2.3403): J1045
-- (Faucet and Drains, $712.50) carries Johnny Ingram as its GC but
-- bill_to_party = 'customer', so the modal keeps it out of his group and his
-- certification (one job, $142.50) still matches. This RPC — last changed in
-- v2.2842, before the who-pays rule — attributed every row by gc_customer_id
-- alone, read Johnny Ingram's live total as $855 and called him uncertified.
--
-- Change: the two job_rows branches apply the same rule the client does. Same
-- signature, same four keys; everything else is byte-for-byte v3
-- (20260905130000). Idempotent.
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
        select i.id, i.job_id, i.bill_to_party, i.bill_to_email,
          greatest(0, coalesce(i.amount, 0) - coalesce((
            select sum(p.amount) from public.jobs_ledger_payments p where p.invoice_id = i.id
          ), 0)) as remaining
        from public.jobs_ledger_invoices i
        where i.status = 'billed'
      ),
      -- v2.3811: a row counts for its GC only when the GC is the one who pays it —
      -- the modal's gcThatPaysRow / effectiveInvoiceParty rule: the job's
      -- bill_to_party (or the invoice's own pick), the GC when the job has no
      -- customer link or the customer IS the GC, never a bill addressed to a
      -- third-party email. job_bill_payer_customer_id is the job-level rule
      -- (v2.3404); the invoice pick is coalesced in front of it.
      job_rows as (
        select j.gc_customer_id, coalesce(j.revenue, 0) - coalesce(j.payments_made, 0) as remaining
        from public.jobs_ledger j
        where j.status = 'billed'
          and j.collections_at is null
          and j.gc_customer_id is not null
          and public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id) = j.gc_customer_id
          and not exists (select 1 from inv_open o where o.job_id = j.id)
        union all
        select j.gc_customer_id, o.remaining
        from inv_open o
        join public.jobs_ledger j on j.id = o.job_id
        where j.collections_at is null
          and j.gc_customer_id is not null
          and (j.status is null or j.status in ('waiting','working','ready_to_bill','billed'))
          and nullif(btrim(coalesce(o.bill_to_email, '')), '') is null
          and public.job_bill_payer_customer_id(coalesce(o.bill_to_party, j.bill_to_party), j.customer_id, j.gc_customer_id) = j.gc_customer_id
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
  'Dashboard GC-review nudge (v3 in v2.2842; who pays since v2.3811): GCs with live outstanding > 0 (board row math, a row under its GC only when the GC pays it — job_bill_payer_customer_id with the invoice pick in front, never a third-party email), certified = latest attestation this week still equals the live total, sent = a gc_statement_emails row this week OR a gc_statement_round_marks row (week_start = p_week_start, action = sent — never contacted/skipped), done = certified and sent. Whole-report copies (gc_customer_id NULL) never count.';

grant execute on function public.gc_review_week_status(date) to authenticated;
