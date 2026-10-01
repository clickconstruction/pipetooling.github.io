SET lock_timeout = '3s';

-- Who applied a payment, and when it was linked to a bank deposit
-- (docs/migrations/20261001153000_payment_actor_and_link.md, punch list #74 PR 4).
--
-- Until now the only record of who recorded a payment was the job history's "Payment" event,
-- stamped with auth.uid(). Mark Paid on a Stripe bill (record-stripe-invoice-out-of-band-payment)
-- inserts with the service role, so those rows — 13 of the 38 AR payments in September 2026 —
-- had no name. And linking a hand-recorded payment to its deposit in Accounts Receivable is an
-- UPDATE nothing logged. Three columns and one stamp fix both.

alter table public.jobs_ledger_payments
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists linked_at timestamptz,
  add column if not exists linked_by uuid references public.users(id) on delete set null;

comment on column public.jobs_ledger_payments.created_by is 'Who recorded the payment: auth.uid() at insert, or the caller an edge function names (v2.4289).';
comment on column public.jobs_ledger_payments.linked_at is 'When mercury_transaction_id was set on a row that had none — a hand-recorded payment linked to its deposit (v2.4289).';
comment on column public.jobs_ledger_payments.linked_by is 'Who linked it (v2.4289).';

-- One-time backfill: the history already knows who added most rows.
update public.jobs_ledger_payments p
set created_by = e.actor_user_id
from public.job_activity_events e
where p.created_by is null
  and e.event_type = 'payment_added'
  and e.actor_user_id is not null
  and e.detail ->> 'source_id' = p.id::text
  and exists (select 1 from public.users u where u.id = e.actor_user_id);

-- The stamp: created_by on insert when the writer did not name one; linked_at / linked_by when
-- a deposit is attached to a row that had none (or a different one).
create or replace function public.jobs_ledger_payments_stamp_actor()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    return new;
  end if;
  if new.mercury_transaction_id is not null
     and (old.mercury_transaction_id is null or old.mercury_transaction_id <> new.mercury_transaction_id) then
    new.linked_at := now();
    new.linked_by := auth.uid();
  end if;
  return new;
end;
$function$;

drop trigger if exists jobs_ledger_payments_stamp_actor on public.jobs_ledger_payments;
create trigger jobs_ledger_payments_stamp_actor
  before insert or update of mercury_transaction_id on public.jobs_ledger_payments
  for each row execute function public.jobs_ledger_payments_stamp_actor();

-- The history's "Payment" event names created_by when the writer had no auth.uid() (an edge
-- function naming its caller). Body as 20260930213000 (the newest definition in the repo);
-- the one change is the actor expression. A removal is still stamped by whoever removed it.
create or replace function public.jobs_ledger_payments_to_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.jobs_ledger_payments%rowtype;
  v_type text;
  v_qual text;
  v_summary text;
  v_at timestamptz;
  v_adds int;
  v_removals int;
begin
  if tg_op = 'DELETE' then r := old; v_type := 'payment_removed'; else r := new; v_type := 'payment_added'; end if;
  v_qual := nullif(
    concat_ws(' · ', nullif(trim(coalesce(r.payment_type, '')), ''), nullif(trim(coalesce(r.reference_number, '')), '')),
    ''
  );
  v_summary := (case when v_type = 'payment_removed' then 'Payment removed ' else 'Payment ' end)
    || '$' || to_char(coalesce(r.amount, 0), 'FM999,999,990.00')
    || coalesce(' (' || v_qual || ')', '');

  if v_type = 'payment_removed' then
    v_at := now();
  else
    -- One add and one removal per life of the row; counted, not ordered, because a delete
    -- and a re-insert in one transaction share the same now().
    select count(*) filter (where e.event_type = 'payment_added'),
           count(*) filter (where e.event_type = 'payment_removed')
      into v_adds, v_removals
    from public.job_activity_events e
    where e.event_type in ('payment_added', 'payment_removed')
      and e.detail ->> 'source_id' = r.id::text;
    if v_adds > v_removals then
      return r;  -- already logged for this life of the row
    end if;
    v_at := case when v_removals > 0 then now() else coalesce(r.created_at, now()) end;
  end if;

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select r.job_id, v_type, v_at,
         case when v_type = 'payment_removed' then auth.uid() else coalesce(r.created_by, auth.uid()) end,
         v_summary,
         jsonb_build_object('amount', r.amount, 'payment_type', r.payment_type, 'source_id', r.id::text),
         true
  where exists (select 1 from public.jobs_ledger jl where jl.id = r.job_id);
  return r;
end;
$function$;

-- The trail read (20260930230000) says how the payment was recorded and when it was linked.
-- The return shape changes, so the function is dropped and made again.
drop function if exists public.list_ar_deposit_trails(uuid[]);

create function public.list_ar_deposit_trails(p_tx_ids uuid[])
returns table(
  mercury_transaction_id uuid,
  payment_id uuid,
  live boolean,
  job_id uuid,
  job_number text,
  job_name text,
  invoice_id uuid,
  amount numeric,
  applied_at timestamptz,
  applied_by text,
  removed_at timestamptz,
  removed_by text,
  payment_type text,
  reference_number text,
  recorded_by_hand boolean,
  linked_at timestamptz,
  linked_by text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'list_ar_deposit_trails: not authenticated';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) then
    raise exception 'list_ar_deposit_trails: not authorized';
  end if;
  if p_tx_ids is null or cardinality(p_tx_ids) = 0 then
    return;
  end if;
  if cardinality(p_tx_ids) > 1000 then
    raise exception 'list_ar_deposit_trails: at most 1000 deposits per call';
  end if;

  return query
  with live as (
    select p.mercury_transaction_id, p.id as payment_id, true as live, p.job_id, p.invoice_id,
           p.amount::numeric as amount, p.created_at as applied_at, p.created_by,
           null::timestamptz as removed_at, null::uuid as removed_by,
           p.payment_type, p.reference_number, p.linked_at, p.linked_by
    from public.jobs_ledger_payments p
    where p.mercury_transaction_id = any(p_tx_ids)
  ), gone as (
    select (a.row_data->>'mercury_transaction_id')::uuid, (a.row_data->>'id')::uuid, false,
           (a.row_data->>'job_id')::uuid, (a.row_data->>'invoice_id')::uuid,
           (a.row_data->>'amount')::numeric, (a.row_data->>'created_at')::timestamptz,
           (a.row_data->>'created_by')::uuid,
           a.deleted_at, a.deleted_by,
           a.row_data->>'payment_type', a.row_data->>'reference_number',
           (a.row_data->>'linked_at')::timestamptz, (a.row_data->>'linked_by')::uuid
    from public.deleted_records_archive a
    where a.table_name = 'jobs_ledger_payments'
      and a.restored_at is null
      and (a.row_data->>'mercury_transaction_id') = any(p_tx_ids::text[])
  ), allp as (
    select * from live union all select * from gone
  )
  select r.mercury_transaction_id, r.payment_id, r.live, r.job_id,
         coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), '') as job_number,
         j.job_name, r.invoice_id, r.amount, r.applied_at,
         coalesce(
           (select coalesce(nullif(u.name, ''), u.email) from public.users u where u.id = r.created_by),
           (select coalesce(nullif(u.name, ''), u.email)
              from public.job_activity_events e
              join public.users u on u.id = e.actor_user_id
             where e.event_type = 'payment_added'
               and (e.detail->>'source_id') = r.payment_id::text
             order by e.occurred_at
             limit 1)
         ) as applied_by,
         r.removed_at,
         (select coalesce(nullif(u.name, ''), u.email) from public.users u where u.id = r.removed_by) as removed_by,
         r.payment_type,
         r.reference_number,
         (r.reference_number is distinct from t.mercury_id::text) as recorded_by_hand,
         r.linked_at,
         (select coalesce(nullif(u.name, ''), u.email) from public.users u where u.id = r.linked_by) as linked_by
  from allp r
  left join public.jobs_ledger j on j.id = r.job_id
  left join public.mercury_transactions t on t.id = r.mercury_transaction_id
  where j.id is null
     or (j.master_user_id = auth.uid() or public.is_dev()
         or exists (select 1 from public.users where id = auth.uid() and role = 'primary')
         or public.is_office_or_estimator()
         or public.assistants_share_master(auth.uid(), j.master_user_id))
  order by r.applied_at, r.payment_id;
end;
$function$;

revoke all on function public.list_ar_deposit_trails(uuid[]) from public;
grant execute on function public.list_ar_deposit_trails(uuid[]) to authenticated;

comment on function public.list_ar_deposit_trails(uuid[]) is
  'Accounts Receivable: every payment each deposit ever carried (live, and removed from deleted_records_archive) with who recorded it, how (recorded_by_hand when its reference is not the deposit''s Mercury id), when it was linked to the deposit, and who took it off — the trail line on the deposit row (v2.4274, v2.4289). Dev/master/assistant/controller/primary; at most 1000 ids per call.';

-- A full Mark Paid on a Stripe bill lands through stripe-webhook → mark_invoice_paid_from_stripe,
-- also with the service role. The caller rides on the invoice's metadata (pt_recorded_by) and
-- arrives here as p_recorded_by. Body as live on 2026-09-30 (pg_get_functiondef); the two
-- changes are the new argument and created_by on the insert. The 5-argument form is dropped so
-- a named-argument call cannot be ambiguous; a call without p_recorded_by takes the default.
drop function if exists public.mark_invoice_paid_from_stripe(uuid, text, text, date, text);

create or replace function public.mark_invoice_paid_from_stripe(
  p_invoice_id uuid,
  p_payment_type text default null,
  p_reference_number text default null,
  p_paid_on date default null,
  p_internal_note text default null,
  p_recorded_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_invoice RECORD;
  v_next_order INTEGER;
  v_applied NUMERIC;
  v_remaining NUMERIC;
  v_paid_on DATE;
  v_pt TEXT;
  v_ref TEXT;
  v_note TEXT;
  v_row_note TEXT;
BEGIN
  -- B6: FOR UPDATE serializes the dual-event webhook race (invoice.paid +
  -- invoice.payment_succeeded) — the second call waits, then exits on the
  -- 'paid' / remaining<=0 checks instead of inserting a duplicate row.
  SELECT id, job_id, amount, status INTO v_invoice
  FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status to mark as paid');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  v_remaining := COALESCE(v_invoice.amount, 0) - v_applied;

  IF v_remaining <= 0 THEN
    UPDATE public.jobs_ledger_invoices SET status = 'paid' WHERE id = p_invoice_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_paid_on := COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date);  -- tz-ok: as live; the webhook always sends pt_paid_on
  v_pt := NULLIF(trim(COALESCE(p_payment_type, '')), '');
  v_ref := NULLIF(trim(COALESCE(p_reference_number, '')), '');
  v_note := NULLIF(trim(COALESCE(p_internal_note, '')), '');

  IF v_pt IS NULL AND v_ref IS NULL AND v_note IS NULL THEN
    v_row_note := 'Stripe';
  ELSE
    v_row_note := v_note;
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (
    job_id,
    amount,
    sequence_order,
    paid_on,
    note,
    invoice_id,
    payment_type,
    reference_number,
    created_by
  )
  VALUES (
    v_invoice.job_id,
    v_remaining,
    v_next_order,
    v_paid_on,
    v_row_note,
    p_invoice_id,
    v_pt,
    v_ref,
    p_recorded_by
  );

  -- B3: payments_made is trigger-maintained (already includes this payment).
  UPDATE public.jobs_ledger
  SET status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_invoice.job_id;

  UPDATE public.jobs_ledger_invoices
  SET status = 'paid'
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

revoke all on function public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid) from public;
grant execute on function public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid) to service_role;
