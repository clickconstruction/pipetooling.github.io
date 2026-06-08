-- Job activity ledger (Phase 2): idempotent backfill from existing dated tables.
-- Re-runnable: every insert is guarded on (event_type, detail->>'source_id'), so
-- running this before/after triggers start capturing yields no duplicates.
-- (Removals and combine/separate have no historical rows to backfill.)

-- Status changes
insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select s.job_id, 'status_change', coalesce(s.changed_at, now()), s.changed_by_user_id,
       public.humanize_job_status(s.from_status) || ' → ' || public.humanize_job_status(s.to_status),
       jsonb_build_object('from', s.from_status, 'to', s.to_status, 'source_id', s.id::text),
       false
from public.job_status_events s
where not exists (
  select 1 from public.job_activity_events e
  where e.event_type = 'status_change' and e.detail ->> 'source_id' = s.id::text
);

-- Payments
insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select p.job_id, 'payment_added', coalesce(p.created_at, now()), null,
       'Payment $' || to_char(coalesce(p.amount, 0), 'FM999,999,990.00')
         || coalesce(' (' || nullif(concat_ws(' · ',
              nullif(trim(coalesce(p.payment_type, '')), ''),
              nullif(trim(coalesce(p.reference_number, '')), '')), '') || ')', ''),
       jsonb_build_object('amount', p.amount, 'payment_type', p.payment_type, 'source_id', p.id::text),
       true
from public.jobs_ledger_payments p
where not exists (
  select 1 from public.job_activity_events e
  where e.event_type = 'payment_added' and e.detail ->> 'source_id' = p.id::text
);

-- Invoice milestones (one statement per dated column)
insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select i.job_id, 'invoice_created', coalesce(i.created_at, now()), null,
       'Invoice created $' || to_char(coalesce(i.amount, 0), 'FM999,999,990.00'),
       jsonb_build_object('invoice_id', i.id, 'source_id', i.id::text), true
from public.jobs_ledger_invoices i
where i.created_at is not null
  and not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_created' and e.detail ->> 'source_id' = i.id::text);

insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select i.job_id, 'invoice_billed', i.billed_at, null,
       'Marked billed $' || to_char(coalesce(i.amount, 0), 'FM999,999,990.00'),
       jsonb_build_object('invoice_id', i.id, 'source_id', i.id::text), true
from public.jobs_ledger_invoices i
where i.billed_at is not null
  and not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_billed' and e.detail ->> 'source_id' = i.id::text);

insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select i.job_id, 'invoice_sent', i.sent_to_customer_at, null,
       'Invoice sent to customer' || coalesce(' (' || nullif(trim(coalesce(i.external_send_channel, '')), '') || ')', ''),
       jsonb_build_object('invoice_id', i.id, 'source_id', i.id::text, 'channel', i.external_send_channel), true
from public.jobs_ledger_invoices i
where i.sent_to_customer_at is not null
  and not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_sent' and e.detail ->> 'source_id' = i.id::text);

insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select i.job_id, 'invoice_write_down', i.agreed_write_down_at, null,
       'Agreed write-down: '
         || coalesce('$' || to_char(i.agreed_write_down_previous_amount, 'FM999,999,990.00') || ' → ', '')
         || '$' || to_char(coalesce(i.amount, 0), 'FM999,999,990.00')
         || coalesce(' — ' || nullif(trim(coalesce(i.agreed_write_down_note, '')), ''), ''),
       jsonb_build_object('invoice_id', i.id, 'source_id', i.id::text, 'previous_amount', i.agreed_write_down_previous_amount), true
from public.jobs_ledger_invoices i
where i.agreed_write_down_at is not null
  and not exists (select 1 from public.job_activity_events e where e.event_type = 'invoice_write_down' and e.detail ->> 'source_id' = i.id::text);

-- Stripe invoice emails (resolve job_id via the parent invoice)
insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select i.job_id, 'invoice_stripe_email_sent', coalesce(s.sent_at, s.created_at, now()), null,
       'Invoice emailed to customer (Stripe)',
       jsonb_build_object('invoice_id', s.jobs_ledger_invoice_id, 'source_id', s.id::text), true
from public.jobs_ledger_invoice_stripe_email_sends s
join public.jobs_ledger_invoices i on i.id = s.jobs_ledger_invoice_id
where not exists (
  select 1 from public.job_activity_events e
  where e.event_type = 'invoice_stripe_email_sent' and e.detail ->> 'source_id' = s.id::text
);

-- Crew added
insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
select t.job_id, 'crew_added', coalesce(t.created_at, now()), null,
       coalesce(nullif(trim(coalesce(u.name, '')), ''), 'Someone') || ' added to crew',
       jsonb_build_object('user_id', t.user_id, 'source_id', t.id::text), false
from public.jobs_ledger_team_members t
left join public.users u on u.id = t.user_id
where not exists (
  select 1 from public.job_activity_events e
  where e.event_type = 'crew_added' and e.detail ->> 'source_id' = t.id::text
);
