SET lock_timeout = '3s';

-- Four customer sends a line each in the job's trail (v2.5636, 2026-10-19). A review of the Pipeline row's activity
-- (2026-10-19) found papers the app sends a customer that left nothing in job_activity_events, the table
-- list_job_activity_events reads:
--
--   * contract_reminded: remind-job-contracts emails the customer up to three reminders. It bumps
--     job_contracts.reminder_count and logs a `reminded` row in job_contract_events; the job_contracts bridge
--     (20261008080000) logs the sends, the view, the signing and the void, never a reminder. A dry run logs a
--     `reminded` row too (metadata.dry_run) and sends nothing, so it gets no line.
--   * demand_letter_sent: the Lien instruments window records each final demand in job_demand_letters (by email
--     through send-lien-filing-email, or by certified mail, courier or hand), and nothing reached the trail.
--   * lien_notice_sent: a § 53.056 notice or a § 53.057 retainage notice is one job_lien_filings row per job, with
--     its sends to the owner and the original contractor, from the Lien desk's run, the Lien window or the notice
--     recorded by hand. No trigger read it. Affidavits and releases of record are filed with the county, not sent to
--     the customer, and stay out.
--   * invoice_resent: send-physical-invoice-email's resend (the PDF bill emailed again) writes nothing on the bill:
--     the function returns before its update, so sent_to_customer_at keeps the first send and the invoice trigger's
--     one invoice_sent line. The resend's only record is its sent copy, a sent_documents row of kind bill_resent
--     naming the bill. That table is the paper path's sends log, so the line is written from it. Logging each change
--     of the stamp would catch nothing here, since the stamp never moves on a paper resend, and it would double every
--     Stripe resend, which restamps the bill and is logged since v2.5634 from its own sends log.
--
-- One function per source writes the line from the source row, guarded by (event_type, source_id) on the
-- job_activity_events_source_idx index, and is called both by an AFTER INSERT trigger and by the backfill at the end,
-- so a line made today and a line backfilled read alike. A trigger never fails its insert: a line that cannot be
-- written is a warning, and the record (a legal notice, a sent copy) is kept. Every line is financial, in the
-- Billing bucket, as the contract and release lines are. No table, so no RLS fences.

-- When a paper went, as a time: the day the office recorded it went (a date, from a date input) at the time the row
-- was saved when the two fall on the same company day, else noon of that day in the company zone. A day that is not
-- a date reads as the saved time.
create or replace function public.job_activity_send_at(p_day text, p_recorded_at timestamptz)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day date;
begin
  if p_day is null or p_day !~ '^\d{4}-\d{2}-\d{2}$' then
    return p_recorded_at;
  end if;
  begin
    v_day := p_day::date;
  exception when others then
    return p_recorded_at;
  end;
  if p_recorded_at is not null and v_day = (p_recorded_at at time zone 'America/Chicago')::date then
    return p_recorded_at;
  end if;
  return (v_day + time '12:00') at time zone 'America/Chicago';
end;
$$;

-- How a paper went, in words ("by certified mail"); null for a way the line need not name.
create or replace function public.job_activity_send_words(p_method text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_method
    when 'certified_mail' then 'certified mail'
    when 'traceable_courier' then 'courier'
    when 'email' then 'email'
    when 'hand' then 'hand'
  end
$$;

-- 1) A contract reminder: the cron's `reminded` row, on the contract's job, at the row's time, nobody's.
create or replace function public.job_activity_line_contract_reminder(e public.job_contract_events)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_sid text := e.id::text;
  v_n text := nullif(trim(e.metadata ->> 'n'), '');
  v_job_id uuid;
  v_doc text;
  v_to text;
begin
  if e.event_type is distinct from 'reminded' or coalesce(e.metadata ->> 'dry_run', '') = 'true' then
    return;
  end if;
  select c.job_id,
         coalesce(nullif(trim(c.template_name), ''), 'Contract'),
         coalesce(nullif(trim(e.metadata ->> 'to'), ''), nullif(trim(c.recipient_email), ''), 'the customer')
    into v_job_id, v_doc, v_to
  from public.job_contracts c
  where c.id = e.contract_id;
  if v_job_id is null then
    return;
  end if;

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select v_job_id, 'contract_reminded', coalesce(e.occurred_at, now()), e.actor_user_id,
         'Contract reminder' || case when v_n ~ '^[0-9]{1,3}$' then ' ' || v_n else '' end
           || ' emailed to ' || v_to || ' — ' || v_doc,
         jsonb_build_object('source_id', v_sid, 'contract_id', e.contract_id::text, 'reminder', e.metadata -> 'n',
                            'revision', e.metadata -> 'revision'),
         true
  where not exists (
    select 1 from public.job_activity_events x
    where x.event_type = 'contract_reminded' and x.detail ->> 'source_id' = v_sid
  );
end;
$$;

-- 2) A demand letter: the letter's job, the day it went, who recorded it, to whom, how, how much and by when.
create or replace function public.job_activity_line_demand_letter(d public.job_demand_letters)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_sid text := d.id::text;
  v_by text := public.job_activity_send_words(d.sent_method);
begin
  if d.voided_at is not null then
    return;
  end if;

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select d.job_id, 'demand_letter_sent',
         coalesce(public.job_activity_send_at(to_char(d.sent_at::timestamp, 'YYYY-MM-DD'), d.created_at), now()),
         d.created_by,
         'Demand letter sent to ' || coalesce(nullif(trim(d.recipient_name), ''), 'the customer')
           || coalesce(' by ' || v_by, '')
           || ' — $' || to_char(coalesce(d.amount, 0), 'FM999,999,990.00')
           || coalesce(', pay by ' || to_char(d.deadline_date::timestamp, 'FMMon FMDD, YYYY'), ''),
         jsonb_build_object('source_id', v_sid, 'letter_id', v_sid, 'sent_method', d.sent_method, 'amount', d.amount,
                            'deadline_date', d.deadline_date),
         true
  where not exists (
    select 1 from public.job_activity_events x
    where x.event_type = 'demand_letter_sent' and x.detail ->> 'source_id' = v_sid
  );
end;
$$;

-- 3) A lien notice or a retainage notice: the filing's job, the earliest day a copy went, who recorded it, each
-- recipient and how (once, when every copy went the same way), the amount.
create or replace function public.job_activity_line_lien_notice(f public.job_lien_filings)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_sid text := f.id::text;
  v_sends jsonb := case when jsonb_typeof(f.sends) = 'array' then f.sends else '[]'::jsonb end;
  v_doc text := case f.kind when 'retainage_53_057' then 'Retainage notice' else 'Lien notice' end;
  v_same boolean;
  v_by text;
  v_day text;
  v_to text;
begin
  if f.kind not in ('notice_53_056', 'retainage_53_057') or f.voided_at is not null then
    return;
  end if;

  select count(distinct coalesce(public.job_activity_send_words(s.v ->> 'method'), '')) <= 1,
         max(public.job_activity_send_words(s.v ->> 'method')),
         min(s.v ->> 'sent_on') filter (where (s.v ->> 'sent_on') ~ '^\d{4}-\d{2}-\d{2}$')
    into v_same, v_by, v_day
  from jsonb_array_elements(v_sends) as s(v)
  where jsonb_typeof(s.v) = 'object';

  select string_agg(
           case s.v ->> 'recipient'
             when 'owner' then 'the owner'
             when 'original_contractor' then 'the original contractor'
             else coalesce(nullif(trim(s.v ->> 'recipient'), ''), 'a recipient')
           end
           || case when v_same then '' else coalesce(' by ' || public.job_activity_send_words(s.v ->> 'method'), '') end,
           ' and ' order by s.n)
    into v_to
  from jsonb_array_elements(v_sends) with ordinality as s(v, n)
  where jsonb_typeof(s.v) = 'object';

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select f.job_id, 'lien_notice_sent',
         coalesce(public.job_activity_send_at(v_day, f.created_at), now()),
         f.created_by,
         v_doc || ' sent' || coalesce(' to ' || v_to, '')
           || case when v_same then coalesce(' by ' || v_by, '') else '' end
           || ' — $' || to_char(coalesce(f.amount, 0), 'FM999,999,990.00'),
         jsonb_build_object('source_id', v_sid, 'filing_id', v_sid, 'kind', f.kind, 'amount', f.amount),
         true
  where not exists (
    select 1 from public.job_activity_events x
    where x.event_type = 'lien_notice_sent' and x.detail ->> 'source_id' = v_sid
  );
end;
$$;

-- 4) A paper bill emailed again: the sent copy of kind bill_resent, on its bill's job, at the copy's time, by its
-- sender. A copy whose bill is gone writes nothing.
create or replace function public.job_activity_line_bill_resent(s public.sent_documents)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_sid text := s.id::text;
  v_to text := nullif(array_to_string(s.recipient_emails, ', '), '');
  v_job_id uuid;
begin
  if s.kind is distinct from 'bill_resent' or s.source_table is distinct from 'jobs_ledger_invoices' or s.source_id is null then
    return;
  end if;
  select i.job_id into v_job_id from public.jobs_ledger_invoices i where i.id = s.source_id;
  if v_job_id is null then
    return;
  end if;

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select v_job_id, 'invoice_resent', coalesce(s.sent_at, now()), s.sent_by,
         'Invoice emailed again to ' || coalesce(v_to, 'the customer'),
         jsonb_build_object('source_id', v_sid, 'invoice_id', s.source_id, 'channel', 'physical'),
         true
  where not exists (
    select 1 from public.job_activity_events x
    where x.event_type = 'invoice_resent' and x.detail ->> 'source_id' = v_sid
  );
end;
$$;

-- The triggers: each calls its function with the new row, and a line that fails is a warning, never a lost record.
create or replace function public.job_contract_events_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.job_activity_line_contract_reminder(new);
  exception when others then
    raise warning 'job_contract_events_to_activity: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

create or replace function public.job_demand_letters_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.job_activity_line_demand_letter(new);
  exception when others then
    raise warning 'job_demand_letters_to_activity: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

create or replace function public.job_lien_filings_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.job_activity_line_lien_notice(new);
  exception when others then
    raise warning 'job_lien_filings_to_activity: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

create or replace function public.sent_documents_to_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.job_activity_line_bill_resent(new);
  exception when others then
    raise warning 'sent_documents_to_activity: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

-- None of these is called by hand.
revoke all on function public.job_activity_send_at(text, timestamptz) from public, anon, authenticated;
revoke all on function public.job_activity_send_words(text) from public, anon, authenticated;
revoke all on function public.job_activity_line_contract_reminder(public.job_contract_events) from public, anon, authenticated;
revoke all on function public.job_activity_line_demand_letter(public.job_demand_letters) from public, anon, authenticated;
revoke all on function public.job_activity_line_lien_notice(public.job_lien_filings) from public, anon, authenticated;
revoke all on function public.job_activity_line_bill_resent(public.sent_documents) from public, anon, authenticated;
revoke all on function public.job_contract_events_to_activity() from public, anon, authenticated;
revoke all on function public.job_demand_letters_to_activity() from public, anon, authenticated;
revoke all on function public.job_lien_filings_to_activity() from public, anon, authenticated;
revoke all on function public.sent_documents_to_activity() from public, anon, authenticated;

drop trigger if exists job_contract_events_to_activity_ins on public.job_contract_events;
create trigger job_contract_events_to_activity_ins
  after insert on public.job_contract_events
  for each row when (new.event_type = 'reminded')
  execute function public.job_contract_events_to_activity();

drop trigger if exists job_demand_letters_to_activity_ins on public.job_demand_letters;
create trigger job_demand_letters_to_activity_ins
  after insert on public.job_demand_letters
  for each row execute function public.job_demand_letters_to_activity();

drop trigger if exists job_lien_filings_to_activity_ins on public.job_lien_filings;
create trigger job_lien_filings_to_activity_ins
  after insert on public.job_lien_filings
  for each row when (new.kind in ('notice_53_056', 'retainage_53_057'))
  execute function public.job_lien_filings_to_activity();

drop trigger if exists sent_documents_to_activity_ins on public.sent_documents;
create trigger sent_documents_to_activity_ins
  after insert on public.sent_documents
  for each row when (new.kind = 'bill_resent')
  execute function public.sent_documents_to_activity();

-- The backfill: every send already recorded gets its line through the same functions, a voided letter or notice
-- excepted (the office voids a mistaken record). Idempotent: a send with its line is skipped by source_id, so a
-- second run changes nothing. A paper resend before sent copies began (2026-10-05) left no record to read.
do $$
begin
  perform public.job_activity_line_contract_reminder(e)
  from public.job_contract_events e
  where e.event_type = 'reminded';

  perform public.job_activity_line_demand_letter(d)
  from public.job_demand_letters d
  where d.voided_at is null;

  perform public.job_activity_line_lien_notice(f)
  from public.job_lien_filings f
  where f.kind in ('notice_53_056', 'retainage_53_057') and f.voided_at is null;

  perform public.job_activity_line_bill_resent(s)
  from public.sent_documents s
  where s.kind = 'bill_resent';
end;
$$;
