SET lock_timeout = '3s';

-- Discount tools round two, PR 2 (v2.3268): add a discount from Bill Customer.
--
-- apply_job_discount inserts ONE discount row on a job in a single transaction
-- and keeps the money true around it:
--   1. the row goes last (sequence_order = max + 1) as line_kind 'discount',
--      the SIGNED amount negative with count 1 (the client derives the dollars
--      with the shared kernel; a percent row also stores discount_pct);
--   2. jobs_ledger.revenue is recomputed the way the client's save does —
--      named rows' count × price plus the job's un-voided hazmat fees;
--   3. draft (ready_to_bill) invoices the client re-priced ride in
--      p_draft_amounts as [{invoice_id, amount}] — only this job's drafts are
--      touched; the elastic primary remainder resizes through the ensure RPC
--      as it always has;
--   4. a discount_added activity event (financial) is written — the client's
--      own snapshot diff never fires for a row it did not type.
-- Office roles only, and the caller must be able to read the job.

create or replace function public.apply_job_discount(
  p_job_id uuid,
  p_name text,
  p_pct numeric,
  p_dollars numeric,
  p_basis_positions integer[],
  p_reason text,
  p_draft_amounts jsonb default '[]'::jsonb,
  p_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_seq integer;
  v_revenue numeric;
  v_dollars numeric := round(coalesce(p_dollars, 0)::numeric, 2);
  v_draft jsonb;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = any (array['dev', 'master_technician', 'assistant', 'controller']::user_role[])
  ) then
    raise exception 'not allowed';
  end if;
  if not public.can_read_job_activity(p_job_id, false) then
    raise exception 'not allowed';
  end if;
  if v_dollars <= 0 then
    raise exception 'a discount needs an amount';
  end if;
  if p_pct is not null and (p_pct < 0 or p_pct > 100) then
    raise exception 'percent out of range';
  end if;

  select coalesce(max(sequence_order), -1) + 1 into v_seq
  from public.jobs_ledger_fixtures where job_id = p_job_id;

  insert into public.jobs_ledger_fixtures
    (job_id, name, count, sequence_order, line_unit_price, line_description, invoice_id,
     stage_kind, shared_with_gc, line_kind, discount_pct, discount_basis_positions, discount_reason)
  values
    (p_job_id, left(coalesce(nullif(btrim(p_name), ''), 'Discount'), 200), 1, v_seq, -v_dollars, null, null,
     null, false, 'discount', p_pct, p_basis_positions, nullif(btrim(coalesce(p_reason, '')), ''))
  returning id into v_id;

  -- Revenue = named rows' count × price (discount rows are negative) + un-voided hazmat fees.
  select round(
           coalesce((
             select sum((case when coalesce(f.count, 0) > 0 then f.count else 1 end) * coalesce(f.line_unit_price, 0))
             from public.jobs_ledger_fixtures f
             where f.job_id = p_job_id and coalesce(btrim(f.name), '') <> ''
           ), 0)
           + coalesce((select sum(h.fee_amount) from public.job_hazmat_incidents h where h.job_id = p_job_id and h.voided_at is null), 0)
         , 2)
  into v_revenue;
  update public.jobs_ledger set revenue = v_revenue, updated_at = now() where id = p_job_id;

  for v_draft in select * from jsonb_array_elements(coalesce(p_draft_amounts, '[]'::jsonb)) loop
    update public.jobs_ledger_invoices
      set amount = round((v_draft ->> 'amount')::numeric, 2)
      where id = (v_draft ->> 'invoice_id')::uuid
        and job_id = p_job_id
        and status = 'ready_to_bill';
  end loop;

  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  values (
    p_job_id, 'discount_added', now(), auth.uid(),
    left(coalesce(nullif(btrim(p_summary), ''), 'Discount added: ' || coalesce(nullif(btrim(p_name), ''), 'Discount')), 500),
    jsonb_build_object('name', p_name, 'pct', p_pct, 'dollars', v_dollars, 'source', 'bill_customer', 'fixture_id', v_id),
    true
  );

  return jsonb_build_object('ok', true, 'fixture_id', v_id, 'revenue', v_revenue);
end;
$$;

revoke all on function public.apply_job_discount(uuid, text, numeric, numeric, integer[], text, jsonb, text) from public, anon;
grant execute on function public.apply_job_discount(uuid, text, numeric, numeric, integer[], text, jsonb, text) to authenticated;

comment on function public.apply_job_discount(uuid, text, numeric, numeric, integer[], text, jsonb, text) is
  'Bill Customer → Add discount (v2.3268): inserts one discount row, recomputes revenue, re-prices the given drafts, logs discount_added. Office roles.';
