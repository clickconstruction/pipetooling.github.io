SET lock_timeout = '3s';

-- Every Stripe bill email a line in the job's trail (v2.5634, 2026-10-19). The invoice trigger
-- (20260608010000, jobs_ledger_invoices_to_activity) logs a bill's FIRST send only: invoice_sent when
-- sent_to_customer_at is first stamped, guarded once per invoice. send-stripe-invoice stamps the invoice and then
-- appends a row to jobs_ledger_invoice_stripe_email_sends on EVERY send, and that log had no trigger, so a resend from
-- the row's Stripe Resend button made no line in the trail (the owner's catch on the Palmer row, job 251). The
-- backfill of 2026-06-08 (20260608010100) turned the log's rows into invoice_stripe_email_sent events once; this
-- trigger does it for every new row, and the backfill below for the rows since.
--
-- A bill's first send keeps its one invoice_sent line: a send whose invoice already has a sent event within two
-- minutes writes nothing, since the function stamps the invoice and appends the log row with the same sent_at in one
-- call. The guard reads the job's own events (job_id first, which is indexed), never the whole table.

create or replace function public.jobs_ledger_invoice_stripe_email_sends_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_at timestamptz := coalesce(new.sent_at, new.created_at, now());
begin
  select i.job_id into v_job_id from public.jobs_ledger_invoices i where i.id = new.jobs_ledger_invoice_id;
  if v_job_id is null then
    return new;
  end if;

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select v_job_id, 'invoice_stripe_email_sent', v_at, auth.uid(),
         'Invoice emailed to customer (Stripe)',
         jsonb_build_object('invoice_id', new.jobs_ledger_invoice_id, 'source_id', new.id::text), true
  where not exists (
    select 1 from public.job_activity_events e
    where e.job_id = v_job_id
      and e.event_type in ('invoice_sent', 'invoice_stripe_email_sent')
      and e.detail ->> 'invoice_id' = new.jobs_ledger_invoice_id::text
      and e.occurred_at between v_at - interval '2 minutes' and v_at + interval '2 minutes'
  );

  return new;
end;
$$;

drop trigger if exists jobs_ledger_invoice_stripe_email_sends_to_activity_ins on public.jobs_ledger_invoice_stripe_email_sends;
create trigger jobs_ledger_invoice_stripe_email_sends_to_activity_ins
  after insert on public.jobs_ledger_invoice_stripe_email_sends
  for each row execute function public.jobs_ledger_invoice_stripe_email_sends_to_activity();

-- The sends already logged with no line of their own (the resends since the first backfill), one line each, under
-- the same two-minute guard, so a first send keeps its one invoice_sent line. Idempotent: a send with its line is
-- skipped by source_id.
insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select i.job_id, 'invoice_stripe_email_sent', coalesce(s.sent_at, s.created_at, now()), null,
       'Invoice emailed to customer (Stripe)',
       jsonb_build_object('invoice_id', s.jobs_ledger_invoice_id, 'source_id', s.id::text), true
from public.jobs_ledger_invoice_stripe_email_sends s
join public.jobs_ledger_invoices i on i.id = s.jobs_ledger_invoice_id
where not exists (
    select 1 from public.job_activity_events e
    where e.event_type = 'invoice_stripe_email_sent' and e.detail ->> 'source_id' = s.id::text
  )
  and not exists (
    select 1 from public.job_activity_events e
    where e.job_id = i.job_id
      and e.event_type in ('invoice_sent', 'invoice_stripe_email_sent')
      and e.detail ->> 'invoice_id' = s.jobs_ledger_invoice_id::text
      and e.occurred_at between coalesce(s.sent_at, s.created_at, now()) - interval '2 minutes'
                            and coalesce(s.sent_at, s.created_at, now()) + interval '2 minutes'
  );
