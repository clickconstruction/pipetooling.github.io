SET lock_timeout = '3s';

-- Day book PR 1b (to-dos/day-book, v2.3711): the invoice send carries who sent it.
--
-- The census behind the Day book found 94 % of `invoice_sent` activity rows with no
-- actor: `send-stripe-invoice` persists the send under the service role, so the
-- activity trigger's auth.uid() is NULL and the send is nobody's outcome. The office
-- billing act had to be read off "Marked billed" instead, and the Stripe sends
-- showed only as "and N more by the system" on the day header.
--
-- Fix: a nullable `sent_by_user_id` on the invoice, written by the two send
-- functions from the caller they already resolve off the Authorization header, and
-- the trigger stamps `coalesce(auth.uid(), new.sent_by_user_id)` on the send event.
-- In-app sends keep auth.uid(); the Stripe function's service-role write now carries
-- the sender too. Backfills and imports still write NULL and stay system rows.
--
-- Additive; no new table, so no read-only-block calls.

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS sent_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.jobs_ledger_invoices.sent_by_user_id IS
  'Who sent this bill to the customer (v2.3711): stamped by send-stripe-invoice / send-physical-invoice-email from the signed-in caller, so the invoice_sent activity event is attributed even when the row is written under the service role.';

-- Same body as 20260608010000_job_activity_events.sql; the one change is the actor
-- on the invoice_sent branch.
create or replace function public.jobs_ledger_invoices_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amt text := '$' || to_char(coalesce(new.amount, 0), 'FM999,999,990.00');
  v_channel text := nullif(trim(coalesce(new.external_send_channel, '')), '');
  v_prev numeric := new.agreed_write_down_previous_amount;
begin
  if tg_op = 'INSERT' then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_created', coalesce(new.created_at, now()), auth.uid(),
           'Invoice created ' || v_amt,
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_created' and e.detail ->> 'source_id' = new.id::text);
  end if;

  if new.billed_at is not null and (tg_op = 'INSERT' or old.billed_at is null) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_billed', new.billed_at, auth.uid(), 'Marked billed ' || v_amt,
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_billed' and e.detail ->> 'source_id' = new.id::text);
  end if;

  if new.sent_to_customer_at is not null and (tg_op = 'INSERT' or old.sent_to_customer_at is null) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_sent', new.sent_to_customer_at, coalesce(auth.uid(), new.sent_by_user_id),
           'Invoice sent to customer' || coalesce(' (' || v_channel || ')', ''),
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text, 'channel', new.external_send_channel), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_sent' and e.detail ->> 'source_id' = new.id::text);
  end if;

  if new.agreed_write_down_at is not null and (tg_op = 'INSERT' or old.agreed_write_down_at is null) then
    insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    select new.job_id, 'invoice_write_down', new.agreed_write_down_at, auth.uid(),
           'Agreed write-down: '
             || coalesce('$' || to_char(v_prev, 'FM999,999,990.00') || ' → ', '') || v_amt
             || coalesce(' — ' || nullif(trim(coalesce(new.agreed_write_down_note, '')), ''), ''),
           jsonb_build_object('invoice_id', new.id, 'source_id', new.id::text, 'previous_amount', v_prev), true
    where not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_write_down' and e.detail ->> 'source_id' = new.id::text);
  end if;

  return new;
end;
$$;
